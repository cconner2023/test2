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
  type LocalNote,
  type LocalTrainingCompletion,
} from './offlineDb'

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

/**
 * Strip local-only metadata fields from a note before sending to Supabase.
 * Fields prefixed with _ are IndexedDB-only tracking fields.
 */
function stripLocalFields(payload: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (!key.startsWith('_')) {
      cleaned[key] = value
    }
  }
  return cleaned
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

  console.log(`[SyncService] Processing ${pendingItems.length} pending items`)

  let processed = 0
  let failed = 0
  let skipped = 0

  // 3. Process in batches
  for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
    // Check connectivity before each batch
    if (!isOnline()) {
      console.log('[SyncService] Went offline, aborting sync')
      return { processed, failed, skipped: pendingItems.length - i, aborted: true }
    }

    const batch = pendingItems.slice(i, i + BATCH_SIZE)

    for (const item of batch) {
      // Skip items that have exceeded max retries
      if (item.retry_count >= MAX_RETRIES) {
        console.warn(`[SyncService] Skipping item ${item.id} (exceeded ${MAX_RETRIES} retries)`)
        skipped++
        continue
      }

      try {
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
        console.error(`[SyncService] Sync failed for item ${item.id}:`, errorMessage)

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
          console.log(`[SyncService] Backing off ${delay}ms before next item`)
          await sleep(delay)
        }
      }
    }
  }

  // 4. Clean up old synced items
  const cleaned = await cleanupSyncedItems()
  if (cleaned > 0) {
    console.log(`[SyncService] Cleaned up ${cleaned} old synced queue items`)
  }

  console.log(`[SyncService] Sync complete: ${processed} processed, ${failed} failed, ${skipped} skipped`)
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
        console.log(`[SyncService] Skipping update for ${recordId}: server version is newer`)
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
          console.log(`[SyncService] Skipping delete for ${recordId}: server version is newer (${serverUpdatedAt} > ${deletedAtTimestamp})`)
          return
        }
      }
    } else {
      // Record doesn't exist on server -- already deleted or never created.
      // Nothing to do; treat as success.
      console.log(`[SyncService] Record ${recordId} not found on server, skipping delete`)
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
// Reconciliation: Pull Server State into IndexedDB
// ============================================================

/**
 * Reconcile local IndexedDB notes with the Supabase server.
 *
 * This is a "pull" operation that:
 * 1. Fetches ALL notes for the user from Supabase (hard-deleted notes
 *    simply won't exist on the server)
 * 2. Compares each server note against the local IndexedDB version
 * 3. Applies last-write-wins: if server is newer, overwrite local;
 *    if local is newer AND pending sync, keep local (it will be pushed)
 * 4. Detects notes that exist on server but not locally (e.g., created
 *    on another device) and pulls them in
 * 5. Detects notes that were hard-deleted on server (by owner or a
 *    clinic member) but still exist locally -- removes them from IndexedDB
 *
 * This function does NOT push local changes to the server. That is
 * handled by processSyncQueue(). Call both in sequence for full sync:
 *   await reconcileWithServer(userId)
 *   await processSyncQueue(userId)
 *
 * Returns the final list of active local notes.
 */
export async function reconcileWithServer(userId: string): Promise<LocalNote[]> {
  if (!isOnline()) {
    console.log('[SyncService] Offline, skipping reconciliation')
    // With hard deletes, all notes in IndexedDB are active.
    return getAllLocalNotesIncludingDeleted(userId)
  }

  console.log('[SyncService] Starting reconciliation with server')

  // 1. Fetch all notes from server. With hard deletes, deleted notes
  //    simply won't exist -- no soft-delete filtering needed.
  const { data: serverNotes, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[SyncService] Failed to fetch server notes for reconciliation:', error.message)
    // Fall back to local data
    return getAllLocalNotesIncludingDeleted(userId)
  }

  // 2. Build lookup maps
  const localNotes = await getAllLocalNotesIncludingDeleted(userId)
  const localMap = new Map(localNotes.map((n) => [n.id, n]))
  const serverMap = new Map((serverNotes || []).map((n) => [n.id, n]))

  // 3. Process server notes: update or insert into local
  for (const serverNote of (serverNotes || [])) {
    const localNote = localMap.get(serverNote.id)

    if (!localNote) {
      // Note exists on server but not locally -- pull it in.
      await saveLocalNote({
        ...serverNote,
        _sync_status: 'synced',
        _sync_retry_count: 0,
        _last_sync_error: null,
        _last_sync_error_message: null,
      })
      continue
    }

    // Note exists both locally and on server -- apply last-write-wins.
    const serverTime = new Date(serverNote.updated_at).getTime()
    const localTime = new Date(localNote.updated_at).getTime()

    if (localNote._sync_status === 'pending') {
      // Local note has unsynced changes. Keep local version -- it will
      // be pushed to the server by processSyncQueue().
      // Exception: if server is newer (e.g., edited on another device
      // AFTER our pending change), the server wins. This is a genuine
      // conflict, and last-write-wins means server takes precedence
      // because it has the later timestamp.
      if (serverTime > localTime) {
        await saveLocalNote({
          ...serverNote,
          _sync_status: 'synced',
          _sync_retry_count: 0,
          _last_sync_error: null,
          _last_sync_error_message: null,
        })
      }
      // Otherwise keep local pending version (do nothing)
    } else {
      // Local note is synced or errored -- update from server if newer.
      if (serverTime >= localTime) {
        await saveLocalNote({
          ...serverNote,
          _sync_status: 'synced',
          _sync_retry_count: 0,
          _last_sync_error: null,
          _last_sync_error_message: null,
        })
      }
    }
  }

  // 4. Handle notes that exist locally but not on server.
  // These are either:
  //   a) Created locally while offline (pending sync) -- keep them
  //   b) Deleted on server (hard-deleted or by admin) -- remove locally
  for (const localNote of localNotes) {
    if (!serverMap.has(localNote.id)) {
      if (localNote._sync_status === 'pending') {
        // Created offline, not yet on server -- keep it for sync queue
        continue
      }
      // Was on server before but now gone -- remove local copy
      await hardDeleteLocalNote(localNote.id)
    }
  }

  // 5. Return final active notes.
  // With hard deletes, all notes in IndexedDB are active.
  return getAllLocalNotesIncludingDeleted(userId)
}

/**
 * Reconcile local IndexedDB training completions with the Supabase server.
 *
 * Follows the same pattern as reconcileWithServer() but for the
 * training_completions table. Key differences:
 * - No soft-delete logic (training completions use hard deletes only)
 * - Fetches from training_completions table
 * - Uses LocalTrainingCompletion type and related IndexedDB helpers
 *
 * Returns the final list of local training completions.
 */
export async function reconcileTrainingCompletionsWithServer(
  userId: string
): Promise<LocalTrainingCompletion[]> {
  if (!isOnline()) {
    console.log('[SyncService] Offline, skipping training completions reconciliation')
    return getLocalTrainingCompletions(userId)
  }

  console.log('[SyncService] Starting training completions reconciliation with server')

  // 1. Fetch all training completions from server.
  const { data: serverCompletions, error } = await supabase
    .from('training_completions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error(
      '[SyncService] Failed to fetch server training completions for reconciliation:',
      error.message
    )
    // Fall back to local data
    return getLocalTrainingCompletions(userId)
  }

  // 2. Build lookup maps
  const localCompletions = await getLocalTrainingCompletions(userId)
  const localMap = new Map(localCompletions.map((c) => [c.id, c]))
  const serverMap = new Map((serverCompletions || []).map((c) => [c.id, c]))

  // 3. Process server completions: update or insert into local
  for (const serverCompletion of (serverCompletions || [])) {
    const localCompletion = localMap.get(serverCompletion.id)

    if (!localCompletion) {
      // Completion exists on server but not locally -- pull it in.
      await saveLocalTrainingCompletion({
        ...serverCompletion,
        _sync_status: 'synced',
        _sync_retry_count: 0,
        _last_sync_error: null,
        _last_sync_error_message: null,
      })
      continue
    }

    // Completion exists both locally and on server -- apply last-write-wins.
    const serverTime = new Date(serverCompletion.updated_at).getTime()
    const localTime = new Date(localCompletion.updated_at).getTime()

    if (localCompletion._sync_status === 'pending') {
      // Local completion has unsynced changes. Keep local version -- it will
      // be pushed to the server by processSyncQueue().
      // Exception: if server is newer, the server wins (last-write-wins).
      if (serverTime > localTime) {
        await saveLocalTrainingCompletion({
          ...serverCompletion,
          _sync_status: 'synced',
          _sync_retry_count: 0,
          _last_sync_error: null,
          _last_sync_error_message: null,
        })
      }
      // Otherwise keep local pending version (do nothing)
    } else {
      // Local completion is synced or errored -- update from server if newer.
      if (serverTime >= localTime) {
        await saveLocalTrainingCompletion({
          ...serverCompletion,
          _sync_status: 'synced',
          _sync_retry_count: 0,
          _last_sync_error: null,
          _last_sync_error_message: null,
        })
      }
    }
  }

  // 4. Handle completions that exist locally but not on server.
  // These are either:
  //   a) Created locally while offline (pending sync) -- keep them
  //   b) Deleted on server (hard-deleted) -- remove locally
  for (const localCompletion of localCompletions) {
    if (!serverMap.has(localCompletion.id)) {
      if (localCompletion._sync_status === 'pending') {
        // Created offline, not yet on server -- keep it for sync queue
        continue
      }
      // Was on server before but now gone -- remove local copy
      await hardDeleteLocalTrainingCompletion(localCompletion.id)
    }
  }

  // 5. Return final local completions.
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

      console.log(`[SyncService] Full sync completed: ${result.processed} pushed, ${result.failed} failed`)
    } catch (error) {
      console.error('[SyncService] Sync on reconnect failed:', error)
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
      console.log('[SyncService] online event fired but Supabase is unreachable')
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

    console.log(
      `[SyncService] Periodic check: ${hasPending ? pendingItems.length + ' pending items' : 'reconnect detected'}, syncing`
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
