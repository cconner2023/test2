/**
 * LoRa Mesh — IndexedDB persistence for witness records and route cache.
 *
 * Database: adtmc-lora-mesh (v1)
 * Stores:
 *   witnesses — keyed by messageId, tracks frames seen/relayed
 *   routes    — keyed by destinationId, learned paths to peers
 *
 * Follows the same patterns as messageStore.ts and outboundQueue.ts:
 * - Singleton IDB instance via `idb` library
 * - Encrypt-at-rest for witness records via encryptString/decryptString
 * - Graceful error handling with logger.warn
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createLogger } from '../../Utilities/Logger'
import { encryptString, decryptString } from '../secureStorage'
import type { WitnessRecord, RouteEntry } from './types'
import {
  WITNESS_TTL_DAYS,
  WITNESS_CONFIRMED_TTL_HOURS,
  ROUTE_TTL_DAYS,
  MAX_WITNESS_RECORDS,
  MAX_ROUTE_ENTRIES,
} from './types'

const logger = createLogger('LoRaDB')

// ---- Database Schema ----

interface LoRaDB extends DBSchema {
  witnesses: {
    key: string // messageId
    value: WitnessRecord
    indexes: {
      'by-confirmed': number  // 0 or 1
      'by-created': number    // createdAt timestamp for TTL pruning
    }
  }
  routes: {
    key: string // destinationId
    value: RouteEntry
    indexes: {
      'by-ttl': number        // ttl timestamp for expiration pruning
    }
  }
}

const DB_NAME = 'adtmc-lora-mesh'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<LoRaDB> | null = null

async function getDb(): Promise<IDBPDatabase<LoRaDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<LoRaDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Witnesses store
      const witnesses = db.createObjectStore('witnesses', { keyPath: 'messageId' })
      witnesses.createIndex('by-confirmed', 'confirmed')
      witnesses.createIndex('by-created', 'createdAt')

      // Routes store
      const routes = db.createObjectStore('routes', { keyPath: 'destinationId' })
      routes.createIndex('by-ttl', 'ttl')
    },
  })

  return dbInstance
}

// ---- Encrypt-at-rest helpers ----

async function encryptWitness(record: WitnessRecord): Promise<WitnessRecord> {
  const encrypted = { ...record }
  encrypted.senderId = await encryptString(record.senderId)
  encrypted.recipientId = await encryptString(record.recipientId)
  encrypted.prevHop = await encryptString(record.prevHop)
  encrypted.nextHop = await encryptString(record.nextHop)
  return encrypted
}

async function decryptWitness(record: WitnessRecord): Promise<WitnessRecord> {
  const decrypted = { ...record }
  decrypted.senderId = await decryptString(record.senderId)
  decrypted.recipientId = await decryptString(record.recipientId)
  decrypted.prevHop = await decryptString(record.prevHop)
  decrypted.nextHop = await decryptString(record.nextHop)
  return decrypted
}

// ---- Witness Operations ----

/** Save a witness record (encrypted at rest). */
export async function saveWitness(record: WitnessRecord): Promise<void> {
  try {
    const db = await getDb()
    const encrypted = await encryptWitness(record)
    await db.put('witnesses', encrypted)
  } catch (e) {
    logger.warn('Failed to save witness:', e)
  }
}

/** Retrieve a witness record by messageId (decrypted). */
export async function getWitness(messageId: string): Promise<WitnessRecord | null> {
  try {
    const db = await getDb()
    const record = await db.get('witnesses', messageId)
    if (!record) return null
    return decryptWitness(record)
  } catch (e) {
    logger.warn('Failed to get witness:', e)
    return null
  }
}

/** Fast dedup check — only tests existence, no decryption. */
export async function hasWitnessed(messageId: string): Promise<boolean> {
  try {
    const db = await getDb()
    const key = await db.getKey('witnesses', messageId)
    return key !== undefined
  } catch (e) {
    logger.warn('Failed to check witness:', e)
    return false
  }
}

/** Remove expired witness records. Returns count of pruned entries. */
export async function pruneExpiredWitnesses(): Promise<number> {
  try {
    const db = await getDb()
    const now = Date.now()
    const unconfirmedCutoff = now - (WITNESS_TTL_DAYS * 24 * 60 * 60 * 1000)
    const confirmedCutoff = now - (WITNESS_CONFIRMED_TTL_HOURS * 60 * 60 * 1000)

    const tx = db.transaction('witnesses', 'readwrite')
    const index = tx.store.index('by-created')
    let cursor = await index.openCursor()
    let pruned = 0

    while (cursor) {
      const record = cursor.value
      const cutoff = record.confirmed ? confirmedCutoff : unconfirmedCutoff
      if (record.createdAt < cutoff) {
        await cursor.delete()
        pruned++
      }
      cursor = await cursor.continue()
    }

    await tx.done
    if (pruned > 0) logger.info(`Pruned ${pruned} expired witnesses`)
    return pruned
  } catch (e) {
    logger.warn('Failed to prune witnesses:', e)
    return 0
  }
}

/** Count total witness records (for budget enforcement). */
export async function countWitnesses(): Promise<number> {
  try {
    const db = await getDb()
    return await db.count('witnesses')
  } catch (e) {
    logger.warn('Failed to count witnesses:', e)
    return 0
  }
}

/** Enforce budget: if over MAX_WITNESS_RECORDS, prune oldest first. */
export async function enforceWitnessBudget(): Promise<number> {
  try {
    const count = await countWitnesses()
    if (count <= MAX_WITNESS_RECORDS) return 0

    const toRemove = count - MAX_WITNESS_RECORDS
    const db = await getDb()
    const tx = db.transaction('witnesses', 'readwrite')
    const index = tx.store.index('by-created')
    let cursor = await index.openCursor()
    let removed = 0

    while (cursor && removed < toRemove) {
      await cursor.delete()
      removed++
      cursor = await cursor.continue()
    }

    await tx.done
    logger.info(`Budget-pruned ${removed} witnesses (was ${count})`)
    return removed
  } catch (e) {
    logger.warn('Failed to enforce witness budget:', e)
    return 0
  }
}

/** Wipe all witness records. */
export async function clearWitnesses(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('witnesses')
    logger.info('Cleared witnesses')
  } catch (e) {
    logger.warn('Failed to clear witnesses:', e)
  }
}

// ---- Route Operations ----

/** Save a route entry. */
export async function saveRoute(entry: RouteEntry): Promise<void> {
  try {
    const db = await getDb()
    await db.put('routes', entry)
  } catch (e) {
    logger.warn('Failed to save route:', e)
  }
}

/** Retrieve a route by destinationId. */
export async function getRoute(destinationId: string): Promise<RouteEntry | null> {
  try {
    const db = await getDb()
    return (await db.get('routes', destinationId)) ?? null
  } catch (e) {
    logger.warn('Failed to get route:', e)
    return null
  }
}

/** Get the highest-priority route for a destination. */
export async function getBestRoute(destinationId: string): Promise<RouteEntry | null> {
  // Currently keyed by destinationId (one entry per destination).
  // getBestRoute exists so we can add multi-path routing later.
  return getRoute(destinationId)
}

/** Remove expired route entries. Returns count of pruned entries. */
export async function pruneExpiredRoutes(): Promise<number> {
  try {
    const db = await getDb()
    const now = Math.floor(Date.now() / 1000)

    const tx = db.transaction('routes', 'readwrite')
    const index = tx.store.index('by-ttl')
    // All entries with TTL < now are expired
    const range = IDBKeyRange.upperBound(now)
    let cursor = await index.openCursor(range)
    let pruned = 0

    while (cursor) {
      await cursor.delete()
      pruned++
      cursor = await cursor.continue()
    }

    await tx.done
    if (pruned > 0) logger.info(`Pruned ${pruned} expired routes`)
    return pruned
  } catch (e) {
    logger.warn('Failed to prune routes:', e)
    return 0
  }
}

/** Update a route on successful delivery: bump priority and lastSuccess. */
export async function updateRouteSuccess(destinationId: string): Promise<void> {
  try {
    const db = await getDb()
    const entry = await db.get('routes', destinationId)
    if (!entry) return

    entry.lastSuccess = Math.floor(Date.now() / 1000)
    entry.priority = Math.min(255, entry.priority + 1)
    entry.ttl = entry.lastSuccess + (ROUTE_TTL_DAYS * 24 * 60 * 60)
    await db.put('routes', entry)
  } catch (e) {
    logger.warn('Failed to update route success:', e)
  }
}

/** Enforce budget: remove lowest-priority routes if over limit. */
export async function enforceRouteBudget(): Promise<number> {
  try {
    const db = await getDb()
    const all = await db.getAll('routes')
    if (all.length <= MAX_ROUTE_ENTRIES) return 0

    // Sort by priority ascending (remove lowest first)
    all.sort((a, b) => a.priority - b.priority)
    const toRemove = all.slice(0, all.length - MAX_ROUTE_ENTRIES)

    const tx = db.transaction('routes', 'readwrite')
    for (const entry of toRemove) {
      await tx.store.delete(entry.destinationId)
    }
    await tx.done

    logger.info(`Budget-pruned ${toRemove.length} routes`)
    return toRemove.length
  } catch (e) {
    logger.warn('Failed to enforce route budget:', e)
    return 0
  }
}

/** Wipe all route entries. */
export async function clearRoutes(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('routes')
    logger.info('Cleared routes')
  } catch (e) {
    logger.warn('Failed to clear routes:', e)
  }
}

// ---- Full Cleanup ----

/** Wipe all LoRa mesh data. Called on sign-out. */
export async function clearLoraDb(): Promise<void> {
  await clearWitnesses()
  await clearRoutes()
}
