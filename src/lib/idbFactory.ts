/**
 * IDB Singleton Factory
 *
 * Eliminates the boilerplate singleton getter + destroy pattern that was
 * duplicated across 6+ IndexedDB modules (keyStore.ts, messageStore.ts,
 * outboundQueue.ts, loraDb.ts, clinicUsersCache.ts, offlineDb.ts).
 *
 * Each module defines its schema and upgrade function once, then delegates
 * open/close/delete lifecycle to these helpers.
 */

import { openDB, type DBSchema, type IDBPDatabase, type OpenDBCallbacks } from 'idb'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('IdbFactory')

export interface IdbSingleton<T extends DBSchema> {
  /** Open and return the database (cached after first open). */
  getDb: () => Promise<IDBPDatabase<T>>
  /**
   * Destroy the database: close the connection, delete the database file,
   * and reset internal state. Safe to call even if never opened.
   */
  destroy: () => Promise<void>
}

/**
 * Create a self-contained IDB singleton for a given schema.
 *
 * Returns `{ getDb, destroy }` where:
 * - `getDb()` opens the database on first call and returns the cached instance.
 * - `destroy()` closes the connection, deletes the database, and resets state.
 *
 * Usage:
 * ```ts
 * const { getDb, destroy } = createIdbSingleton<MySchema>('my-db', 1, {
 *   upgrade(db) { ... }
 * })
 *
 * // In cleanup / logout:
 * await destroy()
 * ```
 */
export function createIdbSingleton<T extends DBSchema>(
  name: string,
  version: number,
  callbacks: OpenDBCallbacks<T>,
): IdbSingleton<T> {
  let instance: IDBPDatabase<T> | null = null

  async function getDb(): Promise<IDBPDatabase<T>> {
    if (instance) return instance
    instance = await openDB<T>(name, version, callbacks)
    return instance
  }

  async function destroy(): Promise<void> {
    try {
      if (instance) {
        instance.close()
        instance = null
      }
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(name)
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()   // best effort
        req.onblocked = () => resolve()
      })
      logger.info(`Destroyed IDB database: ${name}`)
    } catch (err) {
      logger.warn(`Failed to destroy IDB database ${name}:`, err)
    }
  }

  return { getDb, destroy }
}
