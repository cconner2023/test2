/**
 * IndexedDB cache for the caller's clinic sub-cluster list.
 *
 * Sub-clusters (platoon/squad grouping) are read by ~9 mount points — calendar,
 * property, messages, supervisor, clinic settings — to drive collapsible roster
 * trees. The list is tiny and changes rarely (supervisor/dev rename/create/delete),
 * but a cold network fetch on every panel open made the grouped roster flash
 * flat → grouped while the select resolved. Caching the last-known list lets the
 * tree paint instantly on subsequent opens, with a silent background refresh.
 *
 * Database: adtmc-sub-clusters
 * Stores:
 *   subClusters — SubCluster objects keyed by id
 *
 * Mirrors clinicUsersCache.ts (same idbFactory singleton + graceful fallback).
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../Utilities/Logger'
import { createIdbSingleton } from './idbFactory'
import type { SubCluster } from './subClusterService'

const logger = createLogger('SubClusterCache')

interface SubClustersDB extends DBSchema {
  subClusters: {
    key: string
    value: SubCluster
  }
}

const DB_NAME = 'adtmc-sub-clusters'
const DB_VERSION = 1

const { getDb } = createIdbSingleton<SubClustersDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore('subClusters', { keyPath: 'id' })
  },
})

/** Return all cached sub-clusters (name-sorted), or empty array on failure. */
export async function loadCachedSubClusters(): Promise<SubCluster[]> {
  try {
    const db = await getDb()
    const rows = await db.getAll('subClusters')
    return rows.sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    logger.warn('Failed to load cached sub-clusters:', err)
    return []
  }
}

/** Clear store and write a fresh list. */
export async function saveCachedSubClusters(subClusters: SubCluster[]): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('subClusters', 'readwrite')
    await tx.store.clear()
    await Promise.all(subClusters.map(s => tx.store.put(s)))
    await tx.done
  } catch (err) {
    logger.warn('Failed to save cached sub-clusters:', err)
  }
}

/** Wipe the cache. Called on sign-out alongside the other clinic-scoped caches. */
export async function clearSubClusterCache(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('subClusters')
    logger.info('Cleared sub-cluster cache')
  } catch (err) {
    logger.warn('Failed to clear sub-cluster cache:', err)
  }
}
