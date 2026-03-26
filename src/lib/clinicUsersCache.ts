/**
 * IndexedDB cache for clinic user profiles.
 *
 * Caches the contact list so the messaging panel renders instantly on
 * subsequent visits, with a background refresh from Supabase.
 *
 * Database: adtmc-clinic-users
 * Stores:
 *   users — ClinicMedic objects keyed by user id
 *
 * Follows the same patterns as messageStore.ts / keyStore.ts:
 * - Singleton IDB instance
 * - Graceful error handling (try/catch, logger.warn, return defaults)
 * - idb library
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../Utilities/Logger'
import { createIdbSingleton } from './idbFactory'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

const logger = createLogger('ClinicUsersCache')

// ---- Database Schema ----

interface ClinicUsersDB extends DBSchema {
  users: {
    key: string
    value: ClinicMedic
  }
}

const DB_NAME = 'adtmc-clinic-users'
const DB_VERSION = 1

const { getDb, destroy: destroyClinicUsersDb } = createIdbSingleton<ClinicUsersDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore('users', { keyPath: 'id' })
  },
})

// ---- Load ----

/** Return all cached clinic users, or empty array on failure. */
export async function loadCachedClinicUsers(): Promise<ClinicMedic[]> {
  try {
    const db = await getDb()
    return await db.getAll('users')
  } catch (err) {
    logger.warn('Failed to load cached clinic users:', err)
    return []
  }
}

// ---- Save ----

/** Clear store and write a fresh list of clinic users. */
export async function saveCachedClinicUsers(medics: ClinicMedic[]): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('users', 'readwrite')
    await tx.store.clear()
    await Promise.all(medics.map(m => tx.store.put(m)))
    await tx.done
  } catch (err) {
    logger.warn('Failed to save cached clinic users:', err)
  }
}

// ---- Cleanup ----

/** Wipe cached clinic users. Called on sign-out. */
export async function clearClinicUsersCache(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('users')
    logger.info('Cleared clinic users cache')
  } catch (err) {
    logger.warn('Failed to clear clinic users cache:', err)
  }
}
