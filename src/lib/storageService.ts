/**
 * Storage stats service — read-only IDB introspection.
 *
 * Counts records across all app databases for the Local Storage settings panel.
 * Does NOT expose payloads — counts only.
 */
import { getDb } from './offlineDb'

export interface StorageStats {
  syncQueue: { pending: number; synced: number; failed: number }
  calendar: { events: number; tombstones: number; pendingVaultSends: number }
  property: { items: number; locations: number; discrepancies: number }
  map: { overlays: number; tileSizeBytes: number }
  messages: { messages: number; outboundPending: number }
}

/** Count all records in a named store within any IDB database. */
async function countIdbStore(dbName: string, storeName: string): Promise<number> {
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName)
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.close()
        resolve(0)
        return
      }
      const tx = db.transaction(storeName, 'readonly')
      const cr = tx.objectStore(storeName).count()
      cr.onsuccess = () => { db.close(); resolve(cr.result) }
      cr.onerror = () => { db.close(); resolve(0) }
    }
    req.onerror = () => resolve(0)
    req.onblocked = () => resolve(0)
  })
}

export async function getStorageStats(): Promise<StorageStats> {
  const db = await getDb()

  // Sync queue — count by status
  const allSync = await db.getAll('syncQueue')
  const pending = allSync.filter(i => i.status === 'pending').length
  const synced  = allSync.filter(i => i.status === 'synced').length
  const failed  = allSync.filter(i => i.status === 'failed').length

  // Property and map — typed counts from the main DB
  const [items, locations, discrepancies, overlays] = await Promise.all([
    db.count('propertyItems'),
    db.count('propertyLocations'),
    db.count('propertyDiscrepancies'),
    db.count('mapOverlays'),
  ])

  const tileMetaAll = await db.getAll('tileMetadata')
  const tileSizeBytes = tileMetaAll.reduce((sum, m) => sum + (m.sizeBytes || 0), 0)

  // Calendar and messaging — raw counts (separate IDB databases)
  const [events, tombstones, pendingVaultSends, messages, outboundPending] = await Promise.all([
    countIdbStore('adtmc-calendar-events', 'events'),
    countIdbStore('adtmc-calendar-events', 'tombstones'),
    countIdbStore('adtmc-calendar-events', 'pendingVaultSends'),
    countIdbStore('adtmc-message-store', 'messages'),
    countIdbStore('adtmc-outbound-queue', 'queue'),
  ])

  return {
    syncQueue: { pending, synced, failed },
    calendar:  { events, tombstones, pendingVaultSends },
    property:  { items, locations, discrepancies },
    map:       { overlays, tileSizeBytes },
    messages:  { messages, outboundPending },
  }
}
