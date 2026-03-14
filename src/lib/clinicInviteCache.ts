/**
 * IndexedDB cache for clinic association invites.
 *
 * Caches invite records so the association panel renders instantly on
 * subsequent visits, with a background refresh from Supabase.
 *
 * Database: adtmc-clinic-invites
 * Stores:
 *   invites — ClinicInvite objects keyed by invite id
 *
 * Follows the same patterns as clinicUsersCache.ts:
 * - Singleton IDB instance via createIdbSingleton
 * - Graceful error handling (try/catch, logger.warn, return defaults)
 * - idb library
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../Utilities/Logger'
import { createIdbSingleton } from './idbFactory'
import type { ClinicInvite } from './clinicAssociationService'

const logger = createLogger('ClinicInviteCache')

// ---- Database Schema ----

interface ClinicInviteDB extends DBSchema {
  invites: {
    key: string
    value: ClinicInvite
  }
}

const DB_NAME = 'adtmc-clinic-invites'
const DB_VERSION = 1

const { getDb } = createIdbSingleton<ClinicInviteDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore('invites', { keyPath: 'id' })
  },
})

// ---- Load ----

/** Return all cached clinic invites, or empty array on failure. */
export async function loadCachedInvites(): Promise<ClinicInvite[]> {
  try {
    const db = await getDb()
    return await db.getAll('invites')
  } catch (err) {
    logger.warn('Failed to load cached invites:', err)
    return []
  }
}

// ---- Save ----

/** Clear store and write a fresh list of clinic invites. */
export async function saveCachedInvites(invites: ClinicInvite[]): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('invites', 'readwrite')
    await tx.store.clear()
    await Promise.all(invites.map(i => tx.store.put(i)))
    await tx.done
  } catch (err) {
    logger.warn('Failed to save cached invites:', err)
  }
}

// ---- Cleanup ----

/** Wipe cached clinic invites. Called on sign-out. */
export async function clearInviteCache(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('invites')
  } catch (err) {
    logger.warn('Failed to clear invite cache:', err)
  }
}
