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
import type { LocalPropertyItem, LocalPropertyLocation, LocalDiscrepancy, LocationTag } from '../Types/PropertyTypes'
import { createLogger } from '../Utilities/Logger'
import { encryptString, decryptString } from './secureStorage'

const logger = createLogger('OfflineDb')

// ---- Sync Status Type ----

/** Sync status for local training completions. */
export type TrainingCompletionSyncStatus = 'pending' | 'synced' | 'error'

// ---- Database Schema ----

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
  propertyItems: {
    key: string
    value: LocalPropertyItem
    indexes: {
      'by-clinic': string
      'by-holder': string
      'by-parent': string
      'by-clinic-sync': [string, string]
    }
  }
  propertyLocations: {
    key: string
    value: LocalPropertyLocation
    indexes: {
      'by-clinic': string
      'by-parent': string
    }
  }
  propertyDiscrepancies: {
    key: string
    value: LocalDiscrepancy
    indexes: {
      'by-responsible': string
      'by-item': string
      'by-status': string
    }
  }
  locationTags: {
    key: string
    value: LocationTag
    indexes: {
      'by-location': string
    }
  }
}

const DB_NAME = 'packagebackend-offline'
const DB_VERSION = 5

let dbInstance: IDBPDatabase<PackageBackEndDB> | null = null

/**
 * Get or create the IndexedDB database instance.
 * Handles schema upgrades from v1 to v2.
 */
export async function getDb(): Promise<IDBPDatabase<PackageBackEndDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<PackageBackEndDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      // ---- Legacy notes store (no longer used, kept for schema compat) ----
      if (oldVersion < 1) {
        const notesStore = (db as any).createObjectStore('notes', { keyPath: 'id' })
        notesStore.createIndex('by-user', 'user_id')
        notesStore.createIndex('by-sync-status', '_sync_status')
        notesStore.createIndex('by-user-sync', ['user_id', '_sync_status'])
      } else if (oldVersion < 2) {
        const notesStore = (transaction as any).objectStore('notes')
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

      // v3 → v4: Property management stores
      if (oldVersion < 4) {
        // Property items
        const itemsStore = db.createObjectStore('propertyItems', { keyPath: 'id' })
        itemsStore.createIndex('by-clinic', 'clinic_id')
        itemsStore.createIndex('by-holder', 'current_holder_id')
        itemsStore.createIndex('by-parent', 'parent_item_id')
        itemsStore.createIndex('by-clinic-sync', ['clinic_id', '_sync_status'])

        // Property locations
        const locationsStore = db.createObjectStore('propertyLocations', { keyPath: 'id' })
        locationsStore.createIndex('by-clinic', 'clinic_id')
        locationsStore.createIndex('by-parent', 'parent_id')

        // Property discrepancies
        const discrepanciesStore = db.createObjectStore('propertyDiscrepancies', { keyPath: 'id' })
        discrepanciesStore.createIndex('by-responsible', 'responsible_holder_id')
        discrepanciesStore.createIndex('by-item', 'item_id')
        discrepanciesStore.createIndex('by-status', 'status')
      }

      // v4 → v5: Location tags store
      if (oldVersion < 5) {
        const tagsStore = db.createObjectStore('locationTags', { keyPath: 'id' })
        tagsStore.createIndex('by-location', 'location_id')
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
        const raw = item as unknown as Record<string, unknown>
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
// Sync Queue Payload Encryption
// ============================================================

/** Encrypt a payload object for at-rest storage in IndexedDB. */
async function encryptPayload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const encrypted = await encryptString(JSON.stringify(payload))
    return { _encrypted: encrypted }
  } catch {
    return payload
  }
}

/** Decrypt a payload that may be encrypted or legacy plaintext. */
async function decryptPayload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (typeof payload._encrypted === 'string') {
    try {
      const decrypted = await decryptString(payload._encrypted)
      return JSON.parse(decrypted) as Record<string, unknown>
    } catch {
      return payload
    }
  }
  return payload
}

/** Decrypt the payload field on a SyncQueueItem (returns a copy). */
async function decryptQueueItem(item: SyncQueueItem): Promise<SyncQueueItem> {
  return { ...item, payload: await decryptPayload(item.payload) }
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

  // Phase 1: Read existing items (separate transaction so async encryption doesn't break it)
  const allPending = await db.getAllFromIndex('syncQueue', 'by-user-status', [item.user_id, 'pending'])
  const existing = allPending.find(
    (q) => q.record_id === item.record_id && q.table_name === item.table_name
  )

  if (existing) {
    if (existing.action === 'create' && item.action === 'delete') {
      await db.delete('syncQueue', existing.id)
      return { ...existing, payload: item.payload, status: 'synced' }
    }

    if (existing.action === 'create' && item.action === 'update') {
      const existingPayload = await decryptPayload(existing.payload)
      const mergedPayload = { ...existingPayload, ...item.payload }
      existing.payload = await encryptPayload(mergedPayload)
      existing.created_at = new Date().toISOString()
      await db.put('syncQueue', existing)
      return { ...existing, payload: mergedPayload }
    }

    existing.action = item.action
    existing.payload = await encryptPayload(item.payload)
    existing.created_at = new Date().toISOString()
    await db.put('syncQueue', existing)
    return { ...existing, payload: item.payload }
  }

  // Phase 2: Encrypt and write new item
  const encryptedPayload = await encryptPayload(item.payload)
  const queueItem: SyncQueueItem = {
    ...item,
    payload: encryptedPayload,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    synced_at: null,
    status: 'pending',
    retry_count: 0,
    last_error: null,
  }
  await db.put('syncQueue', queueItem)
  return { ...queueItem, payload: item.payload }
}

/**
 * Get all pending sync items for a user, ordered by creation time (FIFO).
 */
export async function getPendingSyncItems(userId: string): Promise<SyncQueueItem[]> {
  const db = await getDb()
  const items = await db.getAllFromIndex('syncQueue', 'by-user-status', [userId, 'pending'])
  const decrypted = await Promise.all(items.map(decryptQueueItem))
  return decrypted.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

/**
 * Get all failed sync items for a user (for retry).
 */
export async function getFailedSyncItems(userId: string): Promise<SyncQueueItem[]> {
  const db = await getDb()
  const items = await db.getAllFromIndex('syncQueue', 'by-user-status', [userId, 'failed'])
  return Promise.all(items.map(decryptQueueItem))
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
// Property Items Operations
// ============================================================

/**
 * Get all local property items for a clinic.
 */
export async function getLocalPropertyItems(clinicId: string): Promise<LocalPropertyItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('propertyItems', 'by-clinic', clinicId)
}

/**
 * Save or update a property item in IndexedDB (upsert).
 */
export async function saveLocalPropertyItem(item: LocalPropertyItem): Promise<void> {
  const db = await getDb()
  await db.put('propertyItems', item)
}

/**
 * Hard-delete a property item from IndexedDB.
 */
export async function deleteLocalPropertyItem(itemId: string): Promise<void> {
  const db = await getDb()
  await db.delete('propertyItems', itemId)
}

/**
 * Get property items by holder.
 */
export async function getLocalPropertyItemsByHolder(holderId: string): Promise<LocalPropertyItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('propertyItems', 'by-holder', holderId)
}

/**
 * Get sub-items of a parent property item.
 */
export async function getLocalPropertySubItems(parentId: string): Promise<LocalPropertyItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('propertyItems', 'by-parent', parentId)
}

// ============================================================
// Property Locations Operations
// ============================================================

/**
 * Get all local property locations for a clinic.
 */
export async function getLocalPropertyLocations(clinicId: string): Promise<LocalPropertyLocation[]> {
  const db = await getDb()
  return db.getAllFromIndex('propertyLocations', 'by-clinic', clinicId)
}

/**
 * Save or update a property location in IndexedDB (upsert).
 */
export async function saveLocalPropertyLocation(location: LocalPropertyLocation): Promise<void> {
  const db = await getDb()
  await db.put('propertyLocations', location)
}

/**
 * Hard-delete a property location from IndexedDB.
 */
export async function deleteLocalPropertyLocation(locationId: string): Promise<void> {
  const db = await getDb()
  await db.delete('propertyLocations', locationId)
}

// ============================================================
// Location Tags Operations
// ============================================================

/**
 * Get all local location tags for a given canvas location.
 */
export async function getLocalLocationTags(locationId: string): Promise<LocationTag[]> {
  const db = await getDb()
  return db.getAllFromIndex('locationTags', 'by-location', locationId)
}

/**
 * Get local location tags for multiple canvas locations in a single transaction.
 * Returns a Map of locationId → tags[].
 */
export async function getLocalLocationTagsBatch(locationIds: string[]): Promise<Map<string, LocationTag[]>> {
  const db = await getDb()
  const tx = db.transaction('locationTags', 'readonly')
  const idx = tx.objectStore('locationTags').index('by-location')
  const result = new Map<string, LocationTag[]>()
  for (const id of locationIds) {
    result.set(id, await idx.getAll(id))
  }
  await tx.done
  return result
}

/**
 * Full-replace all tags for a location in IndexedDB.
 * Deletes existing tags for the location, then inserts the new set.
 */
export async function saveLocalLocationTags(locationId: string, tags: LocationTag[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('locationTags', 'readwrite')
  const store = tx.objectStore('locationTags')
  // Delete existing tags for this location
  const existing = await store.index('by-location').getAllKeys(locationId)
  for (const key of existing) {
    await store.delete(key)
  }
  // Insert new tags
  for (const tag of tags) {
    await store.put(tag)
  }
  await tx.done
}

/**
 * Remove all local tags that reference a given target (e.g., a deleted location).
 * Scans all tags and deletes those where target_id matches.
 */
export async function deleteLocalTagsByTarget(targetId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('locationTags', 'readwrite')
  const store = tx.objectStore('locationTags')
  let cursor = await store.openCursor()
  while (cursor) {
    if (cursor.value.target_id === targetId) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }
  await tx.done
}

// ============================================================
// Property Discrepancies Operations
// ============================================================

/**
 * Get discrepancies for a responsible holder.
 */
export async function getLocalDiscrepancies(holderId: string): Promise<LocalDiscrepancy[]> {
  const db = await getDb()
  return db.getAllFromIndex('propertyDiscrepancies', 'by-responsible', holderId)
}

/**
 * Get all discrepancies for a clinic (by iterating items).
 */
export async function getLocalDiscrepanciesByStatus(status: string): Promise<LocalDiscrepancy[]> {
  const db = await getDb()
  return db.getAllFromIndex('propertyDiscrepancies', 'by-status', status)
}

/**
 * Save or update a discrepancy in IndexedDB (upsert).
 */
export async function saveLocalDiscrepancy(discrepancy: LocalDiscrepancy): Promise<void> {
  const db = await getDb()
  await db.put('propertyDiscrepancies', discrepancy)
}

/**
 * Hard-delete a discrepancy from IndexedDB.
 */
export async function deleteLocalDiscrepancy(discrepancyId: string): Promise<void> {
  const db = await getDb()
  await db.delete('propertyDiscrepancies', discrepancyId)
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
  const tx = db.transaction(
    ['syncQueue', 'trainingCompletions', 'propertyItems', 'propertyLocations', 'propertyDiscrepancies', 'locationTags'],
    'readwrite',
  )
  await tx.objectStore('syncQueue').clear()
  await tx.objectStore('trainingCompletions').clear()
  await tx.objectStore('propertyItems').clear()
  await tx.objectStore('propertyLocations').clear()
  await tx.objectStore('propertyDiscrepancies').clear()
  await tx.objectStore('locationTags').clear()
  await tx.done
  logger.info('Cleared all user data from IndexedDB')
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
