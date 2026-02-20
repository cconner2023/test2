/**
 * IndexedDB-based offline storage for notes and sync queue.
 * Uses the 'idb' library for a promise-based IndexedDB wrapper.
 *
 * This module provides:
 * - Local note persistence for offline-first operation
 * - Sync queue management for pending Supabase mutations
 * - Training completion local storage with offline-first sync
 *
 * SCHEMA VERSION HISTORY:
 *   v1 - Original schema with _synced boolean on notes
 *   v2 - Added sync_status ('pending'|'synced'|'error') to notes,
 *        added retry_count + last_error to syncQueue,
 *        added symptom/disposition fields to notes for display,
 *        added compound index on notes for sync queries
 *   v3 - Expanded trainingCompletions store: added completion_type,
 *        result, supervisor_id, step_results, supervisor_notes;
 *        replaced _synced with _sync_status/_sync_retry_count/
 *        _last_sync_error/_last_sync_error_message; added compound
 *        indexes by-user-type and by-user-sync
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CompletionType, CompletionResult, Json } from '../Types/database.types'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('OfflineDb')

// ---- Sync Status Type ----

/** Sync status for local notes. Exposed to the UI for badge display. */
export type NoteSyncStatus = 'pending' | 'synced' | 'error'

/** Sync status for local training completions. */
export type TrainingCompletionSyncStatus = 'pending' | 'synced' | 'error'

// ---- Database Schema ----

/** Shape of a note stored in IndexedDB. Mirrors the Supabase notes row
 *  plus local-only metadata fields prefixed with underscore. */
export interface LocalNote {
  id: string                     // UUID (crypto.randomUUID)
  user_id: string
  clinic_id: string | null
  timestamp: string              // ISO 8601, when the clinical encounter occurred
  display_name: string | null
  rank: string | null
  uic: string | null
  algorithm_reference: string | null
  hpi_encoded: string | null
  symptom_icon: string | null
  symptom_text: string | null
  disposition_type: string | null
  disposition_text: string | null
  preview_text: string | null
  is_imported: boolean
  source_device: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null

  // ---- Local-only metadata (not sent to Supabase) ----
  /** Tracks whether this note has been synced to the server. */
  _sync_status: NoteSyncStatus
  /** Number of consecutive failed sync attempts for this note. */
  _sync_retry_count: number
  /** ISO timestamp of the last sync error, if any. */
  _last_sync_error: string | null
  /** Human-readable error message from the last failed sync. */
  _last_sync_error_message: string | null
}

export interface SyncQueueItem {
  id: string                     // UUID for the queue entry itself
  user_id: string
  action: 'create' | 'update' | 'delete'
  table_name: string
  record_id: string              // ID of the record being synced
  payload: Record<string, unknown>
  created_at: string
  synced_at: string | null
  status: 'pending' | 'synced' | 'failed'
  /** Number of times this item has been retried after failure. */
  retry_count: number
  /** Human-readable error from the last attempt. */
  last_error: string | null
}

/** Shape of a training completion stored in IndexedDB. Mirrors the
 *  Supabase training_completions row plus local-only metadata. */
export interface LocalTrainingCompletion {
  id: string
  user_id: string
  training_item_id: string
  completed: boolean
  completed_at: string | null
  completion_type: CompletionType
  result: CompletionResult
  supervisor_id: string | null
  step_results: Json | null
  supervisor_notes: string | null
  created_at: string
  updated_at: string

  // ---- Local-only metadata (not sent to Supabase) ----
  _sync_status: TrainingCompletionSyncStatus
  _sync_retry_count: number
  _last_sync_error: string | null
  _last_sync_error_message: string | null
}

interface PackageBackEndDB extends DBSchema {
  notes: {
    key: string
    value: LocalNote
    indexes: {
      'by-user': string
      'by-sync-status': string
      'by-user-sync': [string, string]
    }
  }
  syncQueue: {
    key: string
    value: SyncQueueItem
    indexes: {
      'by-status': string
      'by-user': string
      'by-user-status': [string, string]
    }
  }
  trainingCompletions: {
    key: string
    value: LocalTrainingCompletion
    indexes: {
      'by-user': string
      'by-training-item': string
      'by-user-type': [string, string]
      'by-user-sync': [string, string]
    }
  }
}

const DB_NAME = 'packagebackend-offline'
const DB_VERSION = 3

let dbInstance: IDBPDatabase<PackageBackEndDB> | null = null

/**
 * Get or create the IndexedDB database instance.
 * Handles schema upgrades from v1 to v2.
 */
export async function getDb(): Promise<IDBPDatabase<PackageBackEndDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<PackageBackEndDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      // ---- Notes store ----
      if (oldVersion < 1) {
        // Fresh install: create from scratch
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' })
        notesStore.createIndex('by-user', 'user_id')
        notesStore.createIndex('by-sync-status', '_sync_status')
        notesStore.createIndex('by-user-sync', ['user_id', '_sync_status'])
      } else if (oldVersion < 2) {
        // Upgrading from v1: add new indexes, migrate _synced -> _sync_status
        const notesStore = transaction.objectStore('notes')

        // Remove old index, add new ones
        if (notesStore.indexNames.contains('by-synced')) {
          notesStore.deleteIndex('by-synced')
        }
        if (!notesStore.indexNames.contains('by-sync-status')) {
          notesStore.createIndex('by-sync-status', '_sync_status')
        }
        if (!notesStore.indexNames.contains('by-user-sync')) {
          notesStore.createIndex('by-user-sync', ['user_id', '_sync_status'])
        }
      }

      // ---- Sync queue store ----
      if (oldVersion < 1) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
        syncStore.createIndex('by-status', 'status')
        syncStore.createIndex('by-user', 'user_id')
        syncStore.createIndex('by-user-status', ['user_id', 'status'])
      } else if (oldVersion < 2) {
        const syncStore = transaction.objectStore('syncQueue')
        if (!syncStore.indexNames.contains('by-user-status')) {
          syncStore.createIndex('by-user-status', ['user_id', 'status'])
        }
      }

      // ---- Training completions store ----
      if (oldVersion < 1) {
        const trainingStore = db.createObjectStore('trainingCompletions', { keyPath: 'id' })
        trainingStore.createIndex('by-user', 'user_id')
        trainingStore.createIndex('by-training-item', 'training_item_id')
      }

      // v2 → v3: Expand trainingCompletions with new columns and sync metadata
      if (oldVersion < 3) {
        const trainingStore = transaction.objectStore('trainingCompletions')

        // Add new compound indexes
        if (!trainingStore.indexNames.contains('by-user-type')) {
          trainingStore.createIndex('by-user-type', ['user_id', 'completion_type'])
        }
        if (!trainingStore.indexNames.contains('by-user-sync')) {
          trainingStore.createIndex('by-user-sync', ['user_id', '_sync_status'])
        }
      }
    },
  })

  // Post-open migration: upgrade existing trainingCompletions rows from v2 format.
  // IndexedDB upgrade transactions can't do async iteration with await in all
  // browsers, so we do this after the DB is fully opened.
  if (DB_VERSION === 3) {
    try {
      const tx = dbInstance.transaction('trainingCompletions', 'readwrite')
      const store = tx.objectStore('trainingCompletions')
      const allItems = await store.getAll()

      for (const item of allItems) {
        const raw = item as Record<string, unknown>
        // Migrate rows that still have the old _synced boolean
        if ('_synced' in raw && !('_sync_status' in raw && raw._sync_status)) {
          const wasSynced = raw._synced as boolean
          const migrated: LocalTrainingCompletion = {
            id: item.id,
            user_id: item.user_id,
            training_item_id: item.training_item_id,
            completed: item.completed ?? true,
            completed_at: item.completed_at ?? null,
            completion_type: (item as LocalTrainingCompletion).completion_type ?? 'read',
            result: (item as LocalTrainingCompletion).result ?? 'GO',
            supervisor_id: (item as LocalTrainingCompletion).supervisor_id ?? null,
            step_results: (item as LocalTrainingCompletion).step_results ?? null,
            supervisor_notes: (item as LocalTrainingCompletion).supervisor_notes ?? null,
            created_at: item.created_at,
            updated_at: item.updated_at,
            _sync_status: wasSynced ? 'synced' : 'pending',
            _sync_retry_count: 0,
            _last_sync_error: null,
            _last_sync_error_message: null,
          }
          await store.put(migrated)
        }
      }

      await tx.done
    } catch (err) {
      logger.warn('Training completions v2→v3 migration error (non-fatal):', err)
    }
  }

  return dbInstance
}

// ============================================================
// Notes Operations
// ============================================================

/**
 * Get all local notes for a user.
 * With hard deletes, all notes in IndexedDB are active (deleted notes
 * are removed entirely). The deleted_at filter is kept as a safety net
 * for any legacy soft-deleted notes that may still exist from before
 * the hard-delete migration.
 */
export async function getLocalNotes(userId: string): Promise<LocalNote[]> {
  const db = await getDb()
  const allNotes = await db.getAllFromIndex('notes', 'by-user', userId)
  return allNotes.filter((n) => n.deleted_at === null)
}

/**
 * Get ALL local notes for a user including soft-deleted ones.
 * Used by the sync reconciliation process to compare full state
 * against the server.
 */
export async function getAllLocalNotesIncludingDeleted(userId: string): Promise<LocalNote[]> {
  const db = await getDb()
  return db.getAllFromIndex('notes', 'by-user', userId)
}

/**
 * Save or update a note in IndexedDB.
 * This is a put (upsert) operation -- if a note with the same ID
 * exists, it will be overwritten.
 */
export async function saveLocalNote(note: LocalNote): Promise<void> {
  const db = await getDb()
  await db.put('notes', note)
}

/**
 * Hard-delete a local note from IndexedDB entirely.
 * Only use this after confirming the server-side delete succeeded
 * or for cleanup of synced+deleted notes.
 */
export async function hardDeleteLocalNote(noteId: string): Promise<void> {
  const db = await getDb()
  await db.delete('notes', noteId)
}

/**
 * Update the sync status of a local note.
 */
export async function updateNoteSyncStatus(
  noteId: string,
  status: NoteSyncStatus,
  errorMessage?: string
): Promise<void> {
  const db = await getDb()
  const note = await db.get('notes', noteId)
  if (!note) return

  note._sync_status = status
  if (status === 'error') {
    note._sync_retry_count = (note._sync_retry_count || 0) + 1
    note._last_sync_error = new Date().toISOString()
    note._last_sync_error_message = errorMessage || 'Unknown error'
  } else if (status === 'synced') {
    note._sync_retry_count = 0
    note._last_sync_error = null
    note._last_sync_error_message = null
  }

  await db.put('notes', note)
}

// ============================================================
// Sync Queue Operations
// ============================================================

/**
 * Add an item to the sync queue.
 * Deduplicates: if a pending item for the same record+action exists,
 * it replaces the payload rather than creating a duplicate.
 */
export async function addToSyncQueue(
  item: Omit<SyncQueueItem, 'id' | 'created_at' | 'synced_at' | 'status' | 'retry_count' | 'last_error'>
): Promise<SyncQueueItem> {
  const db = await getDb()
  const tx = db.transaction('syncQueue', 'readwrite')
  const store = tx.objectStore('syncQueue')

  // Check for existing pending item for the same record
  const allPending = await store.index('by-user-status').getAll([item.user_id, 'pending'])
  const existing = allPending.find(
    (q) => q.record_id === item.record_id && q.table_name === item.table_name
  )

  if (existing) {
    // Merge: upgrade action priority (create+update=create, create+delete=remove both,
    // update+delete=delete)
    if (existing.action === 'create' && item.action === 'delete') {
      // Note was created offline then deleted offline -- remove from queue entirely,
      // nothing to sync since the server never saw it.
      await store.delete(existing.id)
      await tx.done
      return { ...existing, status: 'synced' }
    }

    if (existing.action === 'create' && item.action === 'update') {
      // Note was created offline then updated offline -- keep as create with
      // the latest payload.
      existing.payload = { ...existing.payload, ...item.payload }
      existing.created_at = new Date().toISOString()
      await store.put(existing)
      await tx.done
      return existing
    }

    // For all other cases (update+update, update+delete), use the latest action
    existing.action = item.action
    existing.payload = item.payload
    existing.created_at = new Date().toISOString()
    await store.put(existing)
    await tx.done
    return existing
  }

  // No existing item: create new queue entry
  const queueItem: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    synced_at: null,
    status: 'pending',
    retry_count: 0,
    last_error: null,
  }
  await store.put(queueItem)
  await tx.done
  return queueItem
}

/**
 * Get all pending sync items for a user, ordered by creation time (FIFO).
 */
export async function getPendingSyncItems(userId: string): Promise<SyncQueueItem[]> {
  const db = await getDb()
  const items = await db.getAllFromIndex('syncQueue', 'by-user-status', [userId, 'pending'])
  return items.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

/**
 * Get all failed sync items for a user (for retry).
 */
export async function getFailedSyncItems(userId: string): Promise<SyncQueueItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('syncQueue', 'by-user-status', [userId, 'failed'])
}

/**
 * Mark a sync queue item as successfully synced.
 */
export async function markSyncItemSynced(itemId: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('syncQueue', itemId)
  if (item) {
    item.status = 'synced'
    item.synced_at = new Date().toISOString()
    await db.put('syncQueue', item)
  }
}

/**
 * Mark a sync queue item as failed, recording the error message.
 */
export async function markSyncItemFailed(itemId: string, error?: string): Promise<void> {
  const db = await getDb()
  const item = await db.get('syncQueue', itemId)
  if (item) {
    item.status = 'failed'
    item.retry_count = (item.retry_count || 0) + 1
    item.last_error = error || 'Unknown error'
    await db.put('syncQueue', item)
  }
}

/**
 * Reset failed sync items back to pending for retry.
 * Only resets items that haven't exceeded maxRetries.
 */
export async function resetFailedItemsForRetry(
  userId: string,
  maxRetries: number = 5
): Promise<number> {
  const db = await getDb()
  const failedItems = await getFailedSyncItems(userId)
  let resetCount = 0

  const tx = db.transaction('syncQueue', 'readwrite')
  const store = tx.objectStore('syncQueue')

  for (const item of failedItems) {
    if (item.retry_count < maxRetries) {
      item.status = 'pending'
      await store.put(item)
      resetCount++
    }
  }

  await tx.done
  return resetCount
}

/**
 * Clean up old synced queue items to prevent IndexedDB bloat.
 * Removes items synced more than `maxAgeMs` ago.
 */
export async function cleanupSyncedItems(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = await getDb()
  const tx = db.transaction('syncQueue', 'readwrite')
  const store = tx.objectStore('syncQueue')
  const allItems = await store.getAll()
  let removed = 0

  const cutoff = Date.now() - maxAgeMs
  for (const item of allItems) {
    if (
      item.status === 'synced'
      && item.synced_at
      && new Date(item.synced_at).getTime() < cutoff
    ) {
      await store.delete(item.id)
      removed++
    }
  }

  await tx.done
  return removed
}

// ============================================================
// Training Completions Operations
// ============================================================

/**
 * Get all local training completions for a user.
 */
export async function getLocalTrainingCompletions(userId: string): Promise<LocalTrainingCompletion[]> {
  const db = await getDb()
  return db.getAllFromIndex('trainingCompletions', 'by-user', userId)
}

/**
 * Save or update a training completion in IndexedDB (upsert).
 */
export async function saveLocalTrainingCompletion(
  completion: LocalTrainingCompletion
): Promise<void> {
  const db = await getDb()
  await db.put('trainingCompletions', completion)
}

/**
 * Hard-delete a training completion from IndexedDB entirely.
 */
export async function hardDeleteLocalTrainingCompletion(completionId: string): Promise<void> {
  const db = await getDb()
  await db.delete('trainingCompletions', completionId)
}

/**
 * Update the sync status of a local training completion.
 */
export async function updateTrainingCompletionSyncStatus(
  completionId: string,
  status: TrainingCompletionSyncStatus,
  errorMessage?: string
): Promise<void> {
  const db = await getDb()
  const completion = await db.get('trainingCompletions', completionId)
  if (!completion) return

  completion._sync_status = status
  if (status === 'error') {
    completion._sync_retry_count = (completion._sync_retry_count || 0) + 1
    completion._last_sync_error = new Date().toISOString()
    completion._last_sync_error_message = errorMessage || 'Unknown error'
  } else if (status === 'synced') {
    completion._sync_retry_count = 0
    completion._last_sync_error = null
    completion._last_sync_error_message = null
  }

  await db.put('trainingCompletions', completion)
}

// ============================================================
// Cleanup Operations
// ============================================================

/**
 * Clear all user data from IndexedDB.
 * Called on intentional sign-out to prevent data leaking between accounts.
 */
export async function clearAllUserData(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['notes', 'syncQueue', 'trainingCompletions'], 'readwrite')
  await tx.objectStore('notes').clear()
  await tx.objectStore('syncQueue').clear()
  await tx.objectStore('trainingCompletions').clear()
  await tx.done
  logger.info('Cleared all user data from IndexedDB')
}

// ============================================================
// Migration Helpers
// ============================================================

/**
 * Migrate v1 notes (with _synced boolean) to v2 format (with _sync_status).
 * Called automatically during the upgrade, but can also be called manually
 * for any notes that slipped through.
 */
export async function migrateV1Notes(): Promise<number> {
  const db = await getDb()
  const tx = db.transaction('notes', 'readwrite')
  const store = tx.objectStore('notes')
  const allNotes = await store.getAll()
  let migrated = 0

  for (const note of allNotes) {
    const raw = note as Record<string, unknown>
    // Check if this note has the old _synced field but no _sync_status
    if ('_synced' in raw && !('_sync_status' in raw && raw._sync_status)) {
      const wasSync = raw._synced as boolean
      const migrationNote = note as LocalNote
      migrationNote._sync_status = wasSync ? 'synced' : 'pending'
      migrationNote._sync_retry_count = 0
      migrationNote._last_sync_error = null
      migrationNote._last_sync_error_message = null
      // Add missing fields with defaults
      if (!migrationNote.symptom_icon) migrationNote.symptom_icon = null
      if (!migrationNote.symptom_text) migrationNote.symptom_text = null
      if (!migrationNote.disposition_type) migrationNote.disposition_type = null
      if (!migrationNote.disposition_text) migrationNote.disposition_text = null
      if (!migrationNote.preview_text) migrationNote.preview_text = null
      await store.put(migrationNote)
      migrated++
    }
  }

  await tx.done
  return migrated
}

// ============================================================
// Shared Utilities
// ============================================================

/**
 * Strip local-only metadata fields from a record before sending to Supabase.
 * Fields prefixed with _ are IndexedDB-only tracking fields.
 */
export function stripLocalFields(record: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!key.startsWith('_')) {
      cleaned[key] = value
    }
  }
  return cleaned
}
