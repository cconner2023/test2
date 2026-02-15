/**
 * Sync service for offline-first data synchronization.
 *
 * Handles:
 * - Processing the sync queue when connectivity returns
 * - Conflict resolution by most recent timestamp
 * - Connectivity detection
 */
import { supabase } from './supabase'
import { getPendingSyncItems, markSyncItemSynced, markSyncItemFailed } from './offlineDb'

/**
 * Check if the browser is currently online.
 */
export function isOnline(): boolean {
  return navigator.onLine
}

/**
 * Process all pending sync queue items for a user.
 * Items are processed in order (FIFO by created_at).
 * Uses most-recent-timestamp conflict resolution.
 */
export async function processSyncQueue(userId: string): Promise<{
  processed: number
  failed: number
}> {
  if (!isOnline()) {
    return { processed: 0, failed: 0 }
  }

  const pendingItems = await getPendingSyncItems(userId)

  // Sort by created_at to process in order
  pendingItems.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  let processed = 0
  let failed = 0

  for (const item of pendingItems) {
    try {
      switch (item.action) {
        case 'create':
          await handleCreate(item.table_name, item.payload)
          break
        case 'update':
          await handleUpdate(item.table_name, item.record_id, item.payload)
          break
        case 'delete':
          await handleDelete(item.table_name, item.record_id)
          break
      }
      await markSyncItemSynced(item.id)
      processed++
    } catch (error) {
      console.error(`Sync failed for item ${item.id}:`, error)
      await markSyncItemFailed(item.id)
      failed++
    }
  }

  return { processed, failed }
}

async function handleCreate(tableName: string, payload: Record<string, unknown>) {
  const { error } = await supabase
    .from(tableName)
    .insert(payload as Record<string, unknown>)

  if (error) throw error
}

async function handleUpdate(tableName: string, recordId: string, payload: Record<string, unknown>) {
  // Conflict resolution: check server timestamp before updating
  const { data: existing } = await supabase
    .from(tableName)
    .select('updated_at')
    .eq('id', recordId)
    .single()

  if (existing) {
    const serverTime = new Date(existing.updated_at as string).getTime()
    const localTime = new Date(payload.updated_at as string).getTime()

    // Only update if local change is more recent
    if (localTime <= serverTime) {
      console.log(`Skipping update for ${recordId}: server has newer data`)
      return
    }
  }

  const { error } = await supabase
    .from(tableName)
    .update(payload as Record<string, unknown>)
    .eq('id', recordId)

  if (error) throw error
}

async function handleDelete(tableName: string, recordId: string) {
  // Soft delete: set deleted_at timestamp
  const { error } = await supabase
    .from(tableName)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', recordId)

  if (error) throw error
}

/**
 * Set up online/offline event listeners that trigger sync.
 */
export function setupConnectivityListeners(userId: string, onStatusChange?: (online: boolean) => void) {
  const handleOnline = async () => {
    onStatusChange?.(true)
    // Attempt to process sync queue when coming back online
    try {
      const result = await processSyncQueue(userId)
      console.log(`Sync completed: ${result.processed} processed, ${result.failed} failed`)
    } catch (error) {
      console.error('Sync queue processing failed:', error)
    }
  }

  const handleOffline = () => {
    onStatusChange?.(false)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
