/**
 * Map overlay tombstones + pending-vault-send queue.
 *
 * Mirror of calendarEventStore.ts's tombstone / pending-send halves. The
 * overlay projection itself lives in the existing offlineDb mapOverlays
 * store; this DB only holds the resurrection-guard state and the offline
 * send queue, both of which must outlive a logout (tombstones) or an
 * online-loss restart (pending sends).
 *
 * Database: adtmc-map-overlay-events
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../Utilities/Logger'
import { createIdbSingleton } from './idbFactory'
import type { MapOverlayPayload } from './signal/messageContent'

const logger = createLogger('MapOverlayEventStore')

// ---- Schema ----

interface MapOverlayTombstone {
  id: string
  deletedAt: number
}

interface PendingVaultSend {
  id: string
  overlay: MapOverlayPayload
  queuedAt: number
}

interface MapOverlayEventsDB extends DBSchema {
  tombstones: {
    key: string
    value: MapOverlayTombstone
  }
  pendingVaultSends: {
    key: string
    value: PendingVaultSend
  }
}

const DB_NAME = 'adtmc-map-overlay-events'
const DB_VERSION = 1

const { getDb } = createIdbSingleton<MapOverlayEventsDB>(
  DB_NAME,
  DB_VERSION,
  {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('tombstones', { keyPath: 'id' })
        db.createObjectStore('pendingVaultSends', { keyPath: 'id' })
      }
    },
  },
)

// ---- Tombstone API ----

/** Record a durable deletion so replayed messages cannot resurrect the overlay. */
export async function addOverlayTombstone(overlayId: string): Promise<void> {
  try {
    const db = await getDb()
    await db.put('tombstones', { id: overlayId, deletedAt: Date.now() })
  } catch (e) {
    logger.warn('Failed to write overlay tombstone:', e)
  }
}

/** Load all tombstoned overlay IDs into a Set for O(1) in-memory lookups. */
export async function loadOverlayTombstones(): Promise<Set<string>> {
  try {
    const db = await getDb()
    const all = await db.getAll('tombstones')
    return new Set(all.map(t => t.id))
  } catch (e) {
    logger.warn('Failed to load overlay tombstones:', e)
    return new Set()
  }
}

/**
 * Prune tombstones older than maxAgeDays. Bound must exceed the longest
 * window in which an unpaired 'c' can remain decryptable in the vault —
 * SPK retention (~90d) is the ceiling; 180d gives the same 2x margin as
 * calendar tombstones.
 */
export async function clearExpiredOverlayTombstones(maxAgeDays = 180): Promise<void> {
  try {
    const db = await getDb()
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const all = await db.getAll('tombstones')
    const tx = db.transaction('tombstones', 'readwrite')
    for (const entry of all) {
      if (entry.deletedAt < cutoff) tx.store.delete(entry.id)
    }
    await tx.done
  } catch (e) {
    logger.warn('Failed to clear expired overlay tombstones:', e)
  }
}

// ---- Pending Vault Send Queue ----

/** Queue an overlay for vault fan-out retry when connectivity returns. */
export async function queuePendingOverlaySend(overlay: MapOverlayPayload): Promise<void> {
  try {
    const db = await getDb()
    await db.put('pendingVaultSends', { id: overlay.id, overlay, queuedAt: Date.now() })
  } catch (e) {
    logger.warn('Failed to queue pending overlay send:', e)
  }
}

/** Load all queued overlay sends pending retry. */
export async function loadPendingOverlaySends(): Promise<PendingVaultSend[]> {
  try {
    const db = await getDb()
    return db.getAll('pendingVaultSends')
  } catch (e) {
    logger.warn('Failed to load pending overlay sends:', e)
    return []
  }
}

/** Remove a successfully sent overlay from the retry queue. */
export async function clearPendingOverlaySend(id: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('pendingVaultSends', id)
  } catch (e) {
    logger.warn('Failed to clear pending overlay send:', e)
  }
}

/** Clear all pending overlay sends — called on logout alongside the projection clear. */
export async function clearAllPendingOverlaySends(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('pendingVaultSends')
  } catch (e) {
    logger.warn('Failed to clear pending overlay sends:', e)
  }
}
