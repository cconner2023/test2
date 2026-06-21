/**
 * Property event tombstones + pending-vault-send queue.
 *
 * Mirror of mapOverlayEventStore.ts. The property projection itself lives in the
 * main offlineDb stores (propertyItems / propertyLocations / propertyDiscrepancies
 * / custodyLedger / locationTags); this DB only holds the resurrection-guard state
 * (tombstones) and the offline fan-out retry queue (pending sends), both of which
 * must outlive a logout (tombstones) or an online-loss restart (pending sends).
 *
 * Only items and zones can be absence-deleted, so only they need tombstones.
 * Custody is append-only, discrepancies are create+rectify, and tags are
 * canvas-replace (an absent tag = deleted) — none can resurrect.
 *
 * Database: adtmc-property-events
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../Utilities/Logger'
import { createIdbSingleton } from './idbFactory'
import type { PropertyEntity, PropertyEventPayload } from './signal/messageContent'

const logger = createLogger('PropertyEventStore')

// ---- Schema ----

interface PropertyTombstone {
  id: string
  deletedAt: number
}

/**
 * A property mutation that failed to fan out (offline / send error) and must be
 * retried on reconnect. holderIds drives the cross-cluster target re-resolve at
 * drain time (the holder may have moved clusters while we were offline).
 */
export interface PendingPropertySend {
  /** `${entity}:${id}` — a newer action for the same entity overwrites the older. */
  key: string
  entity: PropertyEntity
  action: 'c' | 'u' | 'd'
  payload: PropertyEventPayload
  /** Holder user-ids whose clinic sets define the cross-cluster fan-out targets. */
  holderIds: string[]
  authoringClinicId: string | null
  queuedAt: number
}

interface PropertyEventsDB extends DBSchema {
  itemTombstones: {
    key: string
    value: PropertyTombstone
  }
  zoneTombstones: {
    key: string
    value: PropertyTombstone
  }
  pendingPropertySends: {
    key: string
    value: PendingPropertySend
  }
}

const DB_NAME = 'adtmc-property-events'
const DB_VERSION = 1

const { getDb } = createIdbSingleton<PropertyEventsDB>(
  DB_NAME,
  DB_VERSION,
  {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('itemTombstones', { keyPath: 'id' })
        db.createObjectStore('zoneTombstones', { keyPath: 'id' })
        db.createObjectStore('pendingPropertySends', { keyPath: 'key' })
      }
    },
  },
)

// ---- Tombstone API ----

async function addTombstone(store: 'itemTombstones' | 'zoneTombstones', id: string): Promise<void> {
  try {
    const db = await getDb()
    await db.put(store, { id, deletedAt: Date.now() })
  } catch (e) {
    logger.warn(`Failed to write ${store} tombstone:`, e)
  }
}

async function loadTombstones(store: 'itemTombstones' | 'zoneTombstones'): Promise<Set<string>> {
  try {
    const db = await getDb()
    const all = await db.getAll(store)
    return new Set(all.map(t => t.id))
  } catch (e) {
    logger.warn(`Failed to load ${store} tombstones:`, e)
    return new Set()
  }
}

/**
 * Prune tombstones older than maxAgeDays. The bound must exceed the longest
 * window an unpaired 'c' can stay decryptable in the vault — SPK retention
 * (~90d) is the ceiling; 180d gives the same 2x margin as calendar/overlay.
 */
async function clearExpired(store: 'itemTombstones' | 'zoneTombstones', maxAgeDays: number): Promise<void> {
  try {
    const db = await getDb()
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const all = await db.getAll(store)
    const tx = db.transaction(store, 'readwrite')
    for (const entry of all) {
      if (entry.deletedAt < cutoff) tx.store.delete(entry.id)
    }
    await tx.done
  } catch (e) {
    logger.warn(`Failed to clear expired ${store} tombstones:`, e)
  }
}

export const addItemTombstone = (id: string) => addTombstone('itemTombstones', id)
export const loadItemTombstones = () => loadTombstones('itemTombstones')
export const clearExpiredItemTombstones = (maxAgeDays = 180) => clearExpired('itemTombstones', maxAgeDays)

export const addZoneTombstone = (id: string) => addTombstone('zoneTombstones', id)
export const loadZoneTombstones = () => loadTombstones('zoneTombstones')
export const clearExpiredZoneTombstones = (maxAgeDays = 180) => clearExpired('zoneTombstones', maxAgeDays)

// ---- Pending Vault Send Queue ----

/** Queue (or overwrite) a property fan-out for retry when connectivity returns. */
export async function queuePendingPropertySend(entry: Omit<PendingPropertySend, 'queuedAt'>): Promise<void> {
  try {
    const db = await getDb()
    await db.put('pendingPropertySends', { ...entry, queuedAt: Date.now() })
  } catch (e) {
    logger.warn('Failed to queue pending property send:', e)
  }
}

/** Load all queued property sends pending retry. */
export async function loadPendingPropertySends(): Promise<PendingPropertySend[]> {
  try {
    const db = await getDb()
    return db.getAll('pendingPropertySends')
  } catch (e) {
    logger.warn('Failed to load pending property sends:', e)
    return []
  }
}

/** Remove a successfully sent property mutation from the retry queue. */
export async function clearPendingPropertySend(key: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('pendingPropertySends', key)
  } catch (e) {
    logger.warn('Failed to clear pending property send:', e)
  }
}

/** Clear all pending property sends — called on logout alongside the projection clear. */
export async function clearAllPendingPropertySends(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('pendingPropertySends')
  } catch (e) {
    logger.warn('Failed to clear pending property sends:', e)
  }
}
