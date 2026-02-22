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
import { NOTES_ENABLED } from './featureFlags'
import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import {
  getPendingSyncItems,
  markSyncItemSynced,
  markSyncItemFailed,
  resetFailedItemsForRetry,
  cleanupSyncedItems,
  getAllLocalNotesIncludingDeleted,
  saveLocalNote,
  updateNoteSyncStatus,
  hardDeleteLocalNote,
  getLocalTrainingCompletions,
  saveLocalTrainingCompletion,
  updateTrainingCompletionSyncStatus,
  hardDeleteLocalTrainingCompletion,
  stripLocalFields,
  type LocalNote,
  type LocalTrainingCompletion,
} from './offlineDb'

const logger = createLogger('SyncService')

/** Tables that the sync queue is allowed to write to. */
const ALLOWED_SYNC_TABLES = ['notes', 'training_completions'] as const
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
  try {
    const { error } = await supabase
      .from('notes')
      .select('id')
      .limit(1)
    return !error
  } catch {
    return false
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
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = BASE_BACKOFF_MS * Math.pow(2, attempt)
  const jitter = Math.random() * BASE_BACKOFF_MS
  return Math.min(MAX_BACKOFF_MS, exponentialDelay + jitter)
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
        // Skip notes sync items when notes are disabled
        if (!NOTES_ENABLED && item.table_name === 'notes') {
          skipped++
          continue
        }

        const table = validateTableName(item.table_name)
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

        // Mark queue item as synced
        await markSyncItemSynced(item.id)

        // Mark the corresponding record as synced in IndexedDB.
        // For deletes, the record is already hard-deleted from IndexedDB,
        // so the update will silently no-op (record not found).
        if (table === 'notes') {
          await updateNoteSyncStatus(item.record_id, 'synced')
        } else if (table === 'training_completions') {
          await updateTrainingCompletionSyncStatus(item.record_id, 'synced')
        }

        processed++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Sync failed for item ${item.id}:`, errorMessage)

        await markSyncItemFailed(item.id, errorMessage)

        // Mark the corresponding record as error in IndexedDB.
        // For deletes, the record is already hard-deleted from IndexedDB,
        // so the update will silently no-op (record not found).
        if (item.table_name === 'notes') {
          await updateNoteSyncStatus(item.record_id, 'error', errorMessage)
        } else if (item.table_name === 'training_completions') {
          await updateTrainingCompletionSyncStatus(item.record_id, 'error', errorMessage)
        }

        failed++

        // Apply exponential backoff before the next item if this one failed
        if (item.retry_count > 0) {
          const delay = getBackoffDelay(item.retry_count)
          logger.debug(`Backing off ${delay}ms before next item`)
          await sleep(delay)
        }
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
// CRUD Handlers
// ============================================================

async function handleCreate(tableName: SyncableTable, payload: Record<string, unknown>): Promise<void> {
  // Use upsert to handle the case where the note was already created
  // on the server (e.g., from another device). This prevents duplicate
  // key errors when retrying a create that partially succeeded.
  const { error } = await supabase
    .from(tableName)
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
    .from(tableName)
    .select('updated_at' as '*')
    .eq('id' as never, recordId)
    .maybeSingle()

  if (existing) {
    const serverUpdatedAt = (existing as Record<string, unknown>).updated_at as string | undefined
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
      .from(tableName)
      .upsert(payload as never, { onConflict: 'id' })

    if (error) throw new Error(`Upsert failed: ${error.message}`)
    return
  }

  const { error } = await supabase
    .from(tableName)
    .update(payload as never)
    .eq('id' as never, recordId)

  if (error) throw new Error(`Update failed: ${error.message}`)
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
      .from(tableName)
      .select('updated_at' as '*')
      .eq('id' as never, recordId)
      .maybeSingle()

    if (existing) {
      const serverUpdatedAt = (existing as Record<string, unknown>).updated_at as string | undefined
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
    .from(tableName)
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

export async function reconcileWithServer(userId: string): Promise<LocalNote[]> {
  if (!NOTES_ENABLED) {
    return []
  }
  if (!isOnline()) {
    logger.debug('Offline, skipping reconciliation')
    return getAllLocalNotesIncludingDeleted(userId)
  }

  logger.info('Starting reconciliation with server')

  try {
    await reconcile<LocalNote, Record<string, unknown>>(userId, {
      tableName: 'notes',
      fetchLocal: getAllLocalNotesIncludingDeleted,
      fetchServer: async (uid) => {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', uid)
          .order('updated_at', { ascending: false })
        if (error) throw error
        return data || []
      },
      getId: (r) => (r as Record<string, unknown>).id as string,
      getTimestamp: (r) => (r as Record<string, unknown>).updated_at as string,
      saveLocal: async (serverRecord) => {
        await saveLocalNote({
          ...serverRecord as unknown as LocalNote,
          _sync_status: 'synced',
          _sync_retry_count: 0,
          _last_sync_error: null,
          _last_sync_error_message: null,
        })
      },
      deleteLocal: hardDeleteLocalNote,
      upsertServer: async () => {},
    })
  } catch (err) {
    logger.error('Failed to reconcile notes:', err)
    return getAllLocalNotesIncludingDeleted(userId)
  }

  return getAllLocalNotesIncludingDeleted(userId)
}

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
    onReconcileComplete?: (notes: LocalNote[]) => void
    onTrainingReconcileComplete?: (completions: LocalTrainingCompletion[]) => void
    /** Called after sync completes so the UI can refresh clinic notes. */
    onClinicRefresh?: () => void
  }
): () => void {
  let syncInProgress = false
  let wasOnline = navigator.onLine

  const performSync = async () => {
    if (syncInProgress) return
    syncInProgress = true

    try {
      callbacks?.onSyncStart?.()

      // 1. Reconcile (pull server changes)
      const reconciledNotes = await reconcileWithServer(userId)
      callbacks?.onReconcileComplete?.(reconciledNotes)

      const reconciledCompletions = await reconcileTrainingCompletionsWithServer(userId)
      callbacks?.onTrainingReconcileComplete?.(reconciledCompletions)

      // 2. Push local changes
      const result = await processSyncQueue(userId)
      callbacks?.onSyncComplete?.(result)

      // 3. Refresh clinic notes to catch changes missed while offline.
      // Supabase Realtime doesn't replay events missed during disconnection,
      // so a full fetch is needed to reconcile clinic-level discrepancies.
      callbacks?.onClinicRefresh?.()

      logger.info(`Full sync completed: ${result.processed} pushed, ${result.failed} failed`)
    } catch (error) {
      logger.error('Sync on reconnect failed:', error)
      callbacks?.onSyncComplete?.({ processed: 0, failed: 0, skipped: 0, aborted: true })
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
  }
}

/**
 * Perform a full sync cycle: reconcile then push.
 * Use this for manual "sync now" triggers or periodic background sync.
 */
export async function fullSync(
  userId: string,
  onReconcileComplete?: (notes: LocalNote[]) => void,
  onTrainingReconcileComplete?: (completions: LocalTrainingCompletion[]) => void
): Promise<SyncResult> {
  if (!isOnline()) {
    return { processed: 0, failed: 0, skipped: 0, aborted: true }
  }

  // 1. Pull
  const reconciledNotes = await reconcileWithServer(userId)
  onReconcileComplete?.(reconciledNotes)

  const reconciledCompletions = await reconcileTrainingCompletionsWithServer(userId)
  onTrainingReconcileComplete?.(reconciledCompletions)

  // 2. Push
  return processSyncQueue(userId)
}
