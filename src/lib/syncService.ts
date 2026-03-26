/**
 * Sync service for offline-first data synchronization.
 *
 * Handles:
 * - Processing the sync queue when connectivity returns
 * - Conflict resolution by most-recent timestamp (last-write-wins)
 * - Connectivity detection and automatic sync triggers
 * - Exponential backoff on retries
 * - Batch processing with configurable batch size
 * - Full reconciliation of local IndexedDB vs. Supabase state
 *
 * Security: Only whitelisted tables can be synced to prevent
 * IndexedDB tampering from writing to sensitive tables (e.g. profiles.roles).
 */
import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { getErrorMessage } from '../Utilities/errorUtils'
import {
  getPendingSyncItems,
  markSyncItemSynced,
  markSyncItemFailed,
  resetFailedItemsForRetry,
  cleanupSyncedItems,
  getLocalTrainingCompletions,
  saveLocalTrainingCompletion,
  updateTrainingCompletionSyncStatus,
  hardDeleteLocalTrainingCompletion,
  getLocalPropertyItems,
  saveLocalPropertyItem,
  deleteLocalPropertyItem,
  stripLocalFields,
  getLocalLocationTags,
  getNextRetryTime,
  resetAllFailedItems,
  getDb,
  type LocalTrainingCompletion,
} from './offlineDb'
import type { LocalPropertyItem } from '../Types/PropertyTypes'

const logger = createLogger('SyncService')

/** Tables that the sync queue is allowed to write to. */
const ALLOWED_SYNC_TABLES = ['training_completions', 'property_items', 'property_locations', 'discrepancies', 'custody_ledger', 'location_tags', 'map_overlays'] as const
type SyncableTable = typeof ALLOWED_SYNC_TABLES[number]

/** Maximum number of retries before giving up on a sync item. */
const MAX_RETRIES = 5

/** Base delay for exponential backoff (milliseconds). */
const BASE_BACKOFF_MS = 1000

/** Maximum delay between retries (milliseconds). */
const MAX_BACKOFF_MS = 30000

/** Maximum number of items to process in a single sync batch. */
const BATCH_SIZE = 20

/** Result of a sync operation. */
export interface SyncResult {
  processed: number
  failed: number
  skipped: number
  /** Whether the sync was aborted (e.g., went offline mid-sync). */
  aborted: boolean
}

/**
 * Check if the browser is currently online.
 * Note: navigator.onLine can give false positives (e.g., connected
 * to a LAN with no internet). The sync queue handler catches actual
 * network errors and retries appropriately.
 */
export function isOnline(): boolean {
  return navigator.onLine
}

/**
 * Verify actual Supabase connectivity with a lightweight query.
 * navigator.onLine can report false positives (e.g., connected to
 * a LAN with no internet). This makes a real request to confirm
 * the server is reachable before attempting sync operations.
 */
async function canReachSupabase(): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      signal: controller.signal,
    })
    return resp.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

function validateTableName(tableName: string): SyncableTable {
  if (!(ALLOWED_SYNC_TABLES as readonly string[]).includes(tableName)) {
    throw new Error(`Sync not allowed for table: ${tableName}`)
  }
  return tableName as SyncableTable
}

/**
 * Calculate exponential backoff delay with jitter.
 * Formula: min(MAX_BACKOFF, BASE * 2^attempt + random_jitter)
 *
 * attempt 0 → ~1s, attempt 1 → ~2s, attempt 2 → ~4s,
 * attempt 3 → ~8s, attempt 4 → ~16s, attempt 5+ → 30s (capped)
 */
export function getBackoffDelay(attempt: number): number {
  const exponentialDelay = BASE_BACKOFF_MS * Math.pow(2, attempt)
  const jitter = Math.random() * BASE_BACKOFF_MS
  return Math.min(MAX_BACKOFF_MS, exponentialDelay + jitter)
}

// ============================================================
// Core Sync Operations
// ============================================================

/**
 * Process all pending sync queue items for a user.
 * Items are processed in FIFO order by created_at.
 * Uses last-write-wins conflict resolution for updates.
 *
 * The function:
 * 1. Resets eligible failed items back to pending
 * 2. Processes pending items in batches
 * 3. Applies exponential backoff between failed items
 * 4. Updates note sync_status after each item
 * 5. Aborts if connectivity is lost mid-sync
 */
export async function processSyncQueue(userId: string): Promise<SyncResult> {
  if (!isOnline()) {
    return { processed: 0, failed: 0, skipped: 0, aborted: true }
  }

  // 1. Reset failed items that haven't exceeded max retries
  await resetFailedItemsForRetry(userId, MAX_RETRIES)

  // 2. Get all pending items
  const pendingItems = await getPendingSyncItems(userId)

  if (pendingItems.length === 0) {
    // Clean up old synced items while we're at it
    await cleanupSyncedItems()
    return { processed: 0, failed: 0, skipped: 0, aborted: false }
  }

  logger.info(`Processing ${pendingItems.length} pending items`)

  let processed = 0
  let failed = 0
  let skipped = 0

  // 3. Process in batches
  for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
    // Check connectivity before each batch
    if (!isOnline()) {
      logger.debug('Went offline, aborting sync')
      return { processed, failed, skipped: pendingItems.length - i, aborted: true }
    }

    const batch = pendingItems.slice(i, i + BATCH_SIZE)

    for (const item of batch) {
      // Skip items that have exceeded max retries
      if (item.retry_count >= MAX_RETRIES) {
        logger.warn(`Skipping item ${item.id} (exceeded ${MAX_RETRIES} retries)`)
        skipped++
        continue
      }

      try {
        const table = validateTableName(item.table_name)

        // location_tags use full-canvas-replace, not individual CRUD
        if (table === 'location_tags') {
          await handleLocationTagsSync(item.record_id)
        } else {
          const cleanPayload = stripLocalFields(item.payload)

          switch (item.action) {
            case 'create':
              await handleCreate(table, cleanPayload)
              break
            case 'update':
              await handleUpdate(table, item.record_id, cleanPayload)
              break
            case 'delete':
              // Pass the original payload (not cleaned) because _deleted_at_timestamp
              // is prefixed with _ but is needed for timestamp conflict resolution.
              await handleDelete(table, item.record_id, item.payload)
              break
          }
        }

        // Mark queue item as synced (resets backoff)
        await markSyncItemSynced(item.id)

        if (item.retry_count > 0) {
          logger.info(`✓ Sync succeeded for ${item.table_name}/${item.record_id} after ${item.retry_count} retries — backoff reset`)
        }

        // Mark the corresponding record as synced in IndexedDB.
        // For deletes, the record is already hard-deleted from IndexedDB,
        // so the update will silently no-op (record not found).
        if (table === 'training_completions') {
          await updateTrainingCompletionSyncStatus(item.record_id, 'synced')
        } else if (table === 'property_items' && item.action !== 'delete') {
          await markPropertyRecordSynced('propertyItems', item.record_id)
        } else if (table === 'property_locations' && item.action !== 'delete') {
          await markPropertyRecordSynced('propertyLocations', item.record_id)
        } else if (table === 'discrepancies' && item.action !== 'delete') {
          await markPropertyRecordSynced('propertyDiscrepancies', item.record_id)
        }

        processed++
      } catch (error) {
        const errorMessage = getErrorMessage(error, String(error))

        // Calculate exponential backoff for next retry scheduling
        const backoffDelay = getBackoffDelay(item.retry_count)
        const nextRetryAt = new Date(Date.now() + backoffDelay).toISOString()
        const retryNum = item.retry_count + 1

        logger.info(
          `⏱ Sync failed for ${item.table_name}/${item.record_id} (retry #${retryNum}/${MAX_RETRIES}). ` +
          `Next retry in ${Math.round(backoffDelay)}ms (backoff: ${Math.round(backoffDelay / 1000)}s). ` +
          `Error: ${errorMessage}`
        )

        await markSyncItemFailed(item.id, errorMessage, nextRetryAt)

        // Mark the corresponding record as error in IndexedDB.
        // For deletes, the record is already hard-deleted from IndexedDB,
        // so the update will silently no-op (record not found).
        if (item.table_name === 'training_completions') {
          await updateTrainingCompletionSyncStatus(item.record_id, 'error', errorMessage)
        } else if (['property_items', 'property_locations', 'discrepancies'].includes(item.table_name) && item.action !== 'delete') {
          const storeName = item.table_name === 'property_items' ? 'propertyItems'
            : item.table_name === 'property_locations' ? 'propertyLocations'
            : 'propertyDiscrepancies'
          await markPropertyRecordSynced(storeName, item.record_id, 'error')
        }

        failed++
      }
    }
  }

  // 4. Clean up old synced items
  const cleaned = await cleanupSyncedItems()
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} old synced queue items`)
  }

  logger.info(`Sync complete: ${processed} processed, ${failed} failed, ${skipped} skipped`)
  return { processed, failed, skipped, aborted: false }
}

// ============================================================
// Property Record Sync Status
// ============================================================

/**
 * Mark a property record's _sync_status in IndexedDB after sync.
 * Without this, records stay 'pending' forever and reconciliation
 * skips server updates — breaking cross-device sync.
 */
async function markPropertyRecordSynced(
  storeName: 'propertyItems' | 'propertyLocations' | 'propertyDiscrepancies',
  recordId: string,
  status: 'synced' | 'error' = 'synced',
): Promise<void> {
  try {
    const db = await getDb()
    const record = await db.get(storeName, recordId)
    if (!record) return
    const updated = {
      ...record,
      _sync_status: status,
      _sync_retry_count: status === 'synced' ? 0 : (record._sync_retry_count ?? 0) + 1,
      _last_sync_error: status === 'synced' ? null : new Date().toISOString(),
      _last_sync_error_message: status === 'synced' ? null : record._last_sync_error_message,
    }
    await db.put(storeName, updated as any)
  } catch (err) {
    logger.warn(`Failed to update sync status for ${storeName}/${recordId}:`, err)
  }
}

// ============================================================
// CRUD Handlers
// ============================================================

async function handleCreate(tableName: SyncableTable, payload: Record<string, unknown>): Promise<void> {
  // Use upsert to handle the case where the note was already created
  // on the server (e.g., from another device). This prevents duplicate
  // key errors when retrying a create that partially succeeded.
  const { error } = await supabase
    .from(tableName as any)
    .upsert(payload as never, { onConflict: 'id' })

  if (error) throw new Error(`Create failed: ${error.message}`)
}

async function handleUpdate(
  tableName: SyncableTable,
  recordId: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Last-write-wins conflict resolution:
  // Compare local updated_at against server updated_at.
  // Only apply the update if the local change is more recent.
  const { data: existing } = await supabase
    .from(tableName as any)
    .select('updated_at' as '*')
    .eq('id' as never, recordId)
    .maybeSingle()

  if (existing) {
    const serverUpdatedAt = (existing as unknown as Record<string, unknown>).updated_at as string | undefined
    const localUpdatedAt = payload.updated_at as string | undefined

    if (serverUpdatedAt && localUpdatedAt) {
      const serverTime = new Date(serverUpdatedAt).getTime()
      const localTime = new Date(localUpdatedAt).getTime()

      if (localTime <= serverTime) {
        // Server has a more recent version -- skip this update.
        // This is not an error; the server version wins.
        logger.debug(`Skipping update for ${recordId}: server version is newer`)
        return
      }
    }
  } else {
    // Record doesn't exist on server -- create it instead.
    // This handles the case where a note was created offline,
    // then updated offline before the create was synced.
    const { error } = await supabase
      .from(tableName as any)
      .upsert(payload as never, { onConflict: 'id' })

    if (error) throw new Error(`Upsert failed: ${error.message}`)
    return
  }

  const { error } = await supabase
    .from(tableName as any)
    .update(payload as never)
    .eq('id' as never, recordId)

  if (error) throw new Error(`Update failed: ${error.message}`)
}

/**
 * Push all location tags for a canvas from IndexedDB to Supabase.
 * Uses delete-then-insert (full replace) since tags are managed per-canvas.
 */
async function handleLocationTagsSync(canvasLocationId: string): Promise<void> {
  const localTags = await getLocalLocationTags(canvasLocationId)

  // Delete existing server tags for this canvas
  const { error: delError } = await supabase
    .from('location_tags')
    .delete()
    .eq('location_id', canvasLocationId)

  if (delError) throw new Error(`Tag delete failed: ${delError.message}`)

  // Insert current local tags
  if (localTags.length > 0) {
    const { error: insError } = await supabase
      .from('location_tags')
      .insert(localTags)

    if (insError) throw new Error(`Tag insert failed: ${insError.message}`)
  }
}

async function handleDelete(
  tableName: SyncableTable,
  recordId: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Timestamp-based conflict resolution: if the server has a version
  // newer than our delete timestamp, the server version wins.
  const deletedAtTimestamp = payload._deleted_at_timestamp as string | undefined
  if (deletedAtTimestamp) {
    const { data: existing } = await supabase
      .from(tableName as any)
      .select('updated_at' as '*')
      .eq('id' as never, recordId)
      .maybeSingle()

    if (existing) {
      const serverUpdatedAt = (existing as unknown as Record<string, unknown>).updated_at as string | undefined
      if (serverUpdatedAt) {
        const serverTime = new Date(serverUpdatedAt).getTime()
        const deleteTime = new Date(deletedAtTimestamp).getTime()
        if (serverTime > deleteTime) {
          // Server has a newer version than our delete -- skip the delete.
          // The note will reappear on next reconciliation.
          logger.debug(`Skipping delete for ${recordId}: server version is newer (${serverUpdatedAt} > ${deletedAtTimestamp})`)
          return
        }
      }
    } else {
      // Record doesn't exist on server -- already deleted or never created.
      // Nothing to do; treat as success.
      logger.debug(`Record ${recordId} not found on server, skipping delete`)
      return
    }
  }

  // Hard delete: actually remove the row from the database.
  const { error } = await supabase
    .from(tableName as any)
    .delete()
    .eq('id' as never, recordId)

  // If the record doesn't exist on the server, that's fine -- it may
  // have been created and deleted offline before any sync occurred,
  // or another user in the same clinic already deleted it.
  if (error && !error.message.includes('0 rows')) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

// ============================================================
// Generic Reconciliation
// ============================================================

interface ReconcileConfig<TLocal, TServer> {
  tableName: string
  fetchLocal: (userId: string) => Promise<TLocal[]>
  fetchServer: (userId: string) => Promise<TServer[]>
  getId: (record: TLocal | TServer) => string
  getTimestamp: (record: TLocal | TServer) => string
  saveLocal: (record: TServer) => Promise<void>
  deleteLocal: (id: string) => Promise<void>
  upsertServer: (record: TLocal) => Promise<void>
}

async function reconcile<TLocal extends { _sync_status: string }, TServer>(
  userId: string,
  config: ReconcileConfig<TLocal, TServer>
): Promise<{ uploaded: number; downloaded: number; deleted: number }> {
  let downloaded = 0
  let deleted = 0

  const serverRecords = await config.fetchServer(userId)
  const localRecords = await config.fetchLocal(userId)

  const localMap = new Map(localRecords.map((r) => [config.getId(r), r]))
  const serverMap = new Map(serverRecords.map((r) => [config.getId(r), r]))

  for (const serverRecord of serverRecords) {
    const localRecord = localMap.get(config.getId(serverRecord))

    if (!localRecord) {
      await config.saveLocal(serverRecord)
      downloaded++
      continue
    }

    const serverTime = new Date(config.getTimestamp(serverRecord)).getTime()
    const localTime = new Date(config.getTimestamp(localRecord)).getTime()

    if (localRecord._sync_status === 'pending') {
      if (serverTime > localTime) {
        await config.saveLocal(serverRecord)
        downloaded++
      }
    } else {
      if (serverTime >= localTime) {
        await config.saveLocal(serverRecord)
        downloaded++
      }
    }
  }

  for (const localRecord of localRecords) {
    if (!serverMap.has(config.getId(localRecord))) {
      if (localRecord._sync_status === 'pending') {
        continue
      }
      await config.deleteLocal(config.getId(localRecord))
      deleted++
    }
  }

  return { uploaded: 0, downloaded, deleted }
}

// ============================================================
// Reconciliation: Pull Server State into IndexedDB
// ============================================================

export async function reconcileTrainingCompletionsWithServer(
  userId: string
): Promise<LocalTrainingCompletion[]> {
  if (!isOnline()) {
    logger.debug('Offline, skipping training completions reconciliation')
    return getLocalTrainingCompletions(userId)
  }

  logger.info('Starting training completions reconciliation with server')

  try {
    await reconcile<LocalTrainingCompletion, Record<string, unknown>>(userId, {
      tableName: 'training_completions',
      fetchLocal: getLocalTrainingCompletions,
      fetchServer: async (uid) => {
        const { data, error } = await supabase
          .from('training_completions')
          .select('*')
          .eq('user_id', uid)
          .order('updated_at', { ascending: false })
        if (error) throw error
        return data || []
      },
      getId: (r) => (r as Record<string, unknown>).id as string,
      getTimestamp: (r) => (r as Record<string, unknown>).updated_at as string,
      saveLocal: async (serverRecord) => {
        await saveLocalTrainingCompletion({
          ...serverRecord as unknown as LocalTrainingCompletion,
          _sync_status: 'synced',
          _sync_retry_count: 0,
          _last_sync_error: null,
          _last_sync_error_message: null,
        })
      },
      deleteLocal: hardDeleteLocalTrainingCompletion,
      upsertServer: async () => {},
    })
  } catch (err) {
    logger.error('Failed to reconcile training completions:', err)
    return getLocalTrainingCompletions(userId)
  }

  return getLocalTrainingCompletions(userId)
}

// ============================================================
// Property Reconciliation
// ============================================================

export async function reconcilePropertyWithServer(
  clinicId: string,
): Promise<LocalPropertyItem[]> {
  if (!isOnline()) {
    logger.debug('Offline, skipping property reconciliation')
    return getLocalPropertyItems(clinicId)
  }

  logger.info('Starting property items reconciliation with server')

  try {
    await reconcile<LocalPropertyItem, Record<string, unknown>>(clinicId, {
      tableName: 'property_items',
      fetchLocal: getLocalPropertyItems,
      fetchServer: async (cId) => {
        const { data, error } = await supabase
          .from('property_items' as any)
          .select('*')
          .eq('clinic_id', cId)
          .order('updated_at', { ascending: false })
        if (error) throw error
        return (data || []) as unknown as Record<string, unknown>[]
      },
      getId: (r) => (r as Record<string, unknown>).id as string,
      getTimestamp: (r) => (r as Record<string, unknown>).updated_at as string,
      saveLocal: async (serverRecord) => {
        await saveLocalPropertyItem({
          ...serverRecord as unknown as LocalPropertyItem,
          _sync_status: 'synced',
          _sync_retry_count: 0,
          _last_sync_error: null,
          _last_sync_error_message: null,
        })
      },
      deleteLocal: deleteLocalPropertyItem,
      upsertServer: async () => {},
    })
  } catch (err) {
    logger.error('Failed to reconcile property items:', err)
    return getLocalPropertyItems(clinicId)
  }

  return getLocalPropertyItems(clinicId)
}

export async function reconcilePropertyLocationsWithServer(
  clinicId: string,
): Promise<void> {
  if (!isOnline()) return

  logger.info('Starting property locations reconciliation with server')

  try {
    const { getLocalPropertyLocations, saveLocalPropertyLocation, deleteLocalPropertyLocation } = await import('./offlineDb')
    type LocalLoc = Awaited<ReturnType<typeof getLocalPropertyLocations>>[number]

    await reconcile<LocalLoc, Record<string, unknown>>(clinicId, {
      tableName: 'property_locations',
      fetchLocal: getLocalPropertyLocations,
      fetchServer: async (cId) => {
        const { data, error } = await supabase
          .from('property_locations')
          .select('*')
          .eq('clinic_id', cId)
          .order('updated_at', { ascending: false })
        if (error) throw error
        return (data || []) as unknown as Record<string, unknown>[]
      },
      getId: (r) => (r as Record<string, unknown>).id as string,
      getTimestamp: (r) => (r as Record<string, unknown>).updated_at as string,
      saveLocal: async (serverRecord) => {
        await saveLocalPropertyLocation({
          ...serverRecord as unknown as LocalLoc,
          _sync_status: 'synced',
          _sync_retry_count: 0,
          _last_sync_error: null,
          _last_sync_error_message: null,
        })
      },
      deleteLocal: deleteLocalPropertyLocation,
      upsertServer: async () => {},
    })
  } catch (err) {
    logger.error('Failed to reconcile property locations:', err)
  }
}

// ============================================================
// Heal Stuck Records
// ============================================================

/**
 * One-time heal for records stuck at _sync_status='pending' that have
 * no actual pending sync queue entry. Before this fix, property records
 * were never marked 'synced' after push, blocking cross-device sync.
 */
export async function healStuckPendingRecords(userId: string): Promise<void> {
  try {
    const db = await getDb()

    // Collect all record IDs that actually have pending sync queue entries
    const pendingQueueItems = await getPendingSyncItems(userId)
    const pendingRecordIds = new Set(pendingQueueItems.map((q) => q.record_id))

    // Heal propertyItems
    const allItems = await db.getAll('propertyItems')
    for (const item of allItems) {
      if (item._sync_status === 'pending' && !pendingRecordIds.has(item.id)) {
        await db.put('propertyItems', { ...item, _sync_status: 'synced' } as any)
      }
    }

    // Heal propertyLocations
    const allLocations = await db.getAll('propertyLocations')
    for (const loc of allLocations) {
      if (loc._sync_status === 'pending' && !pendingRecordIds.has(loc.id)) {
        await db.put('propertyLocations', { ...loc, _sync_status: 'synced' } as any)
      }
    }

    // Heal propertyDiscrepancies
    const allDisc = await db.getAll('propertyDiscrepancies')
    for (const disc of allDisc) {
      if (disc._sync_status === 'pending' && !pendingRecordIds.has(disc.id)) {
        await db.put('propertyDiscrepancies', { ...disc, _sync_status: 'synced' } as any)
      }
    }

    const healed = allItems.filter(i => i._sync_status === 'pending' && !pendingRecordIds.has(i.id)).length
      + allLocations.filter(l => l._sync_status === 'pending' && !pendingRecordIds.has(l.id)).length
      + allDisc.filter(d => d._sync_status === 'pending' && !pendingRecordIds.has(d.id)).length

    if (healed > 0) {
      logger.info(`Healed ${healed} stuck 'pending' property records → 'synced'`)
    }
  } catch (err) {
    logger.warn('healStuckPendingRecords failed (non-fatal):', err)
  }
}

// ============================================================
// Connectivity Listeners
// ============================================================

/**
 * Set up online/offline event listeners that trigger sync.
 *
 * When coming back online:
 * 1. Reconcile with server (pull)
 * 2. Process sync queue (push)
 * 3. Notify caller of result
 *
 * Returns a cleanup function to remove the listeners.
 */
export function setupConnectivityListeners(
  userId: string,
  callbacks?: {
    onStatusChange?: (online: boolean) => void
    onSyncStart?: () => void
    onSyncComplete?: (result: SyncResult) => void
    onTrainingReconcileComplete?: (completions: LocalTrainingCompletion[]) => void
    onPropertyReconcileComplete?: (items: LocalPropertyItem[]) => void
    /** Called after tag reconciliation so the UI can refresh the canvas. */
    onTagsReconcileComplete?: () => void
    /** Provides current locations for tag reconciliation scope. */
    getLocations?: () => { id: string }[]
    clinicId?: string
  }
): () => void {
  let syncInProgress = false
  let wasOnline = navigator.onLine
  /** Timer for the next scheduled backoff retry. */
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  /** Whether we've done the one-time session reset of permanently failed items. */
  let sessionResetDone = false

  /** Schedule the next retry based on the soonest failed item's backoff time. */
  const scheduleNextRetry = async () => {
    // Clear any existing timer
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }

    const nextRetryTime = await getNextRetryTime(userId, MAX_RETRIES)
    if (nextRetryTime !== null) {
      const delayMs = Math.max(100, nextRetryTime - Date.now()) // floor at 100ms
      logger.info(`⏱ Next sync retry scheduled in ${Math.round(delayMs)}ms (${Math.round(delayMs / 1000)}s)`)
      retryTimer = setTimeout(() => {
        retryTimer = null
        performSync()
      }, delayMs)
    }
  }

  const performSync = async () => {
    if (syncInProgress) return
    syncInProgress = true

    // Clear retry timer — we're syncing now
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }

    try {
      callbacks?.onSyncStart?.()

      // On first sync of a new session, reset permanently-failed items
      // so they get a fresh set of retry attempts (app restart recovery).
      if (!sessionResetDone) {
        sessionResetDone = true
        const resetCount = await resetAllFailedItems(userId)
        if (resetCount > 0) {
          logger.info(`Session start: reset ${resetCount} permanently-failed sync items for retry`)
        }
      }

      // Heal records stuck as 'pending' from before the _sync_status fix
      await healStuckPendingRecords(userId)

      // 1. Reconcile (pull server changes)
      const reconciledCompletions = await reconcileTrainingCompletionsWithServer(userId)
      callbacks?.onTrainingReconcileComplete?.(reconciledCompletions)

      // 1b. Reconcile property if clinic context available
      if (callbacks?.clinicId) {
        // Heal records stuck as 'pending' from before the _sync_status fix
        await healStuckPendingRecords(userId)

        const reconciledItems = await reconcilePropertyWithServer(callbacks.clinicId)
        callbacks?.onPropertyReconcileComplete?.(reconciledItems)

        // 1b-ii. Reconcile locations (was previously missing)
        await reconcilePropertyLocationsWithServer(callbacks.clinicId)

        // 1c. Reconcile location tags (zones on canvas)
        const locations = callbacks?.getLocations?.() || []
        if (locations.length > 0) {
          const { reconcileLocationTagsWithServer } = await import('./propertyService')
          await reconcileLocationTagsWithServer(callbacks.clinicId, locations)
          callbacks?.onTagsReconcileComplete?.()
        }
      }

      // 2. Push local changes
      const result = await processSyncQueue(userId)
      callbacks?.onSyncComplete?.(result)

      logger.info(`Full sync completed: ${result.processed} pushed, ${result.failed} failed`)

      // 3. If there are failed items with backoff, schedule the next retry
      if (result.failed > 0) {
        await scheduleNextRetry()
      }
    } catch (error) {
      logger.error('Sync on reconnect failed:', error)
      callbacks?.onSyncComplete?.({ processed: 0, failed: 0, skipped: 0, aborted: true })
      // Still try to schedule retries for any previously failed items
      await scheduleNextRetry()
    } finally {
      syncInProgress = false
    }
  }

  const handleOnline = async () => {
    // Verify actual server connectivity before triggering sync.
    // navigator.onLine can report true even without real internet access.
    const reachable = await canReachSupabase()
    if (!reachable) {
      logger.debug('online event fired but Supabase is unreachable')
      return
    }

    wasOnline = true
    callbacks?.onStatusChange?.(true)
    await performSync()
  }

  const handleOffline = () => {
    wasOnline = false
    callbacks?.onStatusChange?.(false)
  }

  // Periodic check for pending items that need syncing.
  // Catches cases where the browser 'online' event was never fired
  // (common on some mobile browsers and PWAs), or where the event
  // fired but Supabase was briefly unreachable at that moment.
  const PERIODIC_CHECK_MS = 30_000
  const periodicTimer = setInterval(async () => {
    if (syncInProgress) return

    const pendingItems = await getPendingSyncItems(userId)
    const hasPending = pendingItems.length > 0
    // Detect reconnection that the 'online' event may have missed
    const possiblyReconnected = !wasOnline && navigator.onLine

    // Only make a network request when there's a reason to sync
    if (!hasPending && !possiblyReconnected) return

    const reachable = await canReachSupabase()
    if (!reachable) {
      if (wasOnline) {
        wasOnline = false
        callbacks?.onStatusChange?.(false)
      }
      return
    }

    if (!wasOnline) {
      wasOnline = true
      callbacks?.onStatusChange?.(true)
    }

    logger.debug(
      `Periodic check: ${hasPending ? pendingItems.length + ' pending items' : 'reconnect detected'}, syncing`
    )
    await performSync()
  }, PERIODIC_CHECK_MS)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    clearInterval(periodicTimer)
    if (retryTimer) clearTimeout(retryTimer)
  }
}

/**
 * Perform a full sync cycle: reconcile then push.
 * Use this for manual "sync now" triggers or periodic background sync.
 */
export async function fullSync(
  userId: string,
  onTrainingReconcileComplete?: (completions: LocalTrainingCompletion[]) => void
): Promise<SyncResult> {
  if (!isOnline()) {
    return { processed: 0, failed: 0, skipped: 0, aborted: true }
  }

  // 1. Pull
  const reconciledCompletions = await reconcileTrainingCompletionsWithServer(userId)
  onTrainingReconcileComplete?.(reconciledCompletions)

  // 2. Push
  return processSyncQueue(userId)
}
