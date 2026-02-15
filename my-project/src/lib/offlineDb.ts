/**
 * IndexedDB-based offline storage for notes and sync queue.
 * Uses the 'idb' library for a promise-based IndexedDB wrapper.
 *
 * This module provides:
 * - Local note persistence for offline-first operation
 * - Sync queue management for pending Supabase mutations
 * - Training completion local storage
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// ---- Database Schema ----

interface PackageBackEndDB extends DBSchema {
  notes: {
    key: string // note id (UUID)
    value: {
      id: string
      user_id: string
      clinic_id: string | null
      timestamp: string
      display_name: string | null
      rank: string | null
      uic: string | null
      algorithm_reference: string | null
      hpi_encoded: string | null
      is_imported: boolean
      source_device: string | null
      created_at: string
      updated_at: string
      deleted_at: string | null
      // Local-only fields
      _synced: boolean // true if synced to Supabase
    }
    indexes: {
      'by-user': string
      'by-synced': number // 0 = not synced, 1 = synced
    }
  }
  syncQueue: {
    key: string // queue item id
    value: {
      id: string
      user_id: string
      action: 'create' | 'update' | 'delete'
      table_name: string
      record_id: string
      payload: Record<string, unknown>
      created_at: string
      synced_at: string | null
      status: 'pending' | 'synced' | 'failed'
    }
    indexes: {
      'by-status': string
      'by-user': string
    }
  }
  trainingCompletions: {
    key: string // completion id
    value: {
      id: string
      user_id: string
      training_item_id: string
      completed: boolean
      completed_at: string | null
      created_at: string
      updated_at: string
      _synced: boolean
    }
    indexes: {
      'by-user': string
      'by-training-item': string
    }
  }
}

const DB_NAME = 'packagebackend-offline'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<PackageBackEndDB> | null = null

/**
 * Get or create the IndexedDB database instance.
 */
export async function getDb(): Promise<IDBPDatabase<PackageBackEndDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<PackageBackEndDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Notes store
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' })
        notesStore.createIndex('by-user', 'user_id')
        notesStore.createIndex('by-synced', '_synced')
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
        syncStore.createIndex('by-status', 'status')
        syncStore.createIndex('by-user', 'user_id')
      }

      // Training completions store
      if (!db.objectStoreNames.contains('trainingCompletions')) {
        const trainingStore = db.createObjectStore('trainingCompletions', { keyPath: 'id' })
        trainingStore.createIndex('by-user', 'user_id')
        trainingStore.createIndex('by-training-item', 'training_item_id')
      }
    },
  })

  return dbInstance
}

// ---- Notes Operations ----

export async function getLocalNotes(userId: string) {
  const db = await getDb()
  const allNotes = await db.getAllFromIndex('notes', 'by-user', userId)
  return allNotes.filter((n) => n.deleted_at === null)
}

export async function saveLocalNote(note: PackageBackEndDB['notes']['value']) {
  const db = await getDb()
  await db.put('notes', note)
}

export async function deleteLocalNote(noteId: string) {
  const db = await getDb()
  const note = await db.get('notes', noteId)
  if (note) {
    note.deleted_at = new Date().toISOString()
    note.updated_at = new Date().toISOString()
    note._synced = false
    await db.put('notes', note)
  }
}

// ---- Sync Queue Operations ----

export async function addToSyncQueue(item: Omit<PackageBackEndDB['syncQueue']['value'], 'id' | 'created_at' | 'synced_at' | 'status'>) {
  const db = await getDb()
  const queueItem: PackageBackEndDB['syncQueue']['value'] = {
    ...item,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    synced_at: null,
    status: 'pending',
  }
  await db.put('syncQueue', queueItem)
  return queueItem
}

export async function getPendingSyncItems(userId: string) {
  const db = await getDb()
  const allPending = await db.getAllFromIndex('syncQueue', 'by-status', 'pending')
  return allPending.filter((item) => item.user_id === userId)
}

export async function markSyncItemSynced(itemId: string) {
  const db = await getDb()
  const item = await db.get('syncQueue', itemId)
  if (item) {
    item.status = 'synced'
    item.synced_at = new Date().toISOString()
    await db.put('syncQueue', item)
  }
}

export async function markSyncItemFailed(itemId: string) {
  const db = await getDb()
  const item = await db.get('syncQueue', itemId)
  if (item) {
    item.status = 'failed'
    await db.put('syncQueue', item)
  }
}

// ---- Training Completions Operations ----

export async function getLocalTrainingCompletions(userId: string) {
  const db = await getDb()
  return db.getAllFromIndex('trainingCompletions', 'by-user', userId)
}

export async function saveLocalTrainingCompletion(completion: PackageBackEndDB['trainingCompletions']['value']) {
  const db = await getDb()
  await db.put('trainingCompletions', completion)
}
