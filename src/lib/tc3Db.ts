import { createIdbSingleton } from './idbFactory'
import type { DBSchema } from 'idb'
import type { TC3Card, TC3QueueEntry } from '../Types/TC3Types'

interface TC3DB extends DBSchema {
  activeCard: {
    key: string
    value: TC3Card
  }
  queue: {
    key: string
    value: TC3QueueEntry
    indexes: {
      'by-queuedAt': string
    }
  }
}

const { getDb } = createIdbSingleton<TC3DB>('beacon-tc3', 3, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('activeCard', { keyPath: 'id' })
      const queueStore = db.createObjectStore('queue', { keyPath: 'card.id' })
      queueStore.createIndex('by-queuedAt', 'queuedAt')
    }
    if (oldVersion < 3) {
      if (db.objectStoreNames.contains('incidents' as never)) {
        db.deleteObjectStore('incidents' as never)
      }
    }
  },
})

// ── Active card ───────────────────────────────────────────────────────────

export async function saveActiveCard(card: TC3Card): Promise<void> {
  const db = await getDb()
  await db.put('activeCard', card)
}

export async function loadActiveCard(): Promise<TC3Card | null> {
  const db = await getDb()
  const all = await db.getAll('activeCard')
  return all.length > 0 ? all[0] : null
}

export async function clearActiveCard(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('activeCard', 'readwrite')
  await tx.objectStore('activeCard').clear()
  await tx.done
}

// ── Queue ─────────────────────────────────────────────────────────────────

export async function saveQueueEntry(entry: TC3QueueEntry): Promise<void> {
  const db = await getDb()
  await db.put('queue', entry)
}

export async function loadQueue(): Promise<TC3QueueEntry[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('queue', 'by-queuedAt')
  return all.reverse()
}

export async function removeQueueEntry(cardId: string): Promise<void> {
  const db = await getDb()
  await db.delete('queue', cardId)
}

export async function clearQueue(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('queue', 'readwrite')
  await tx.objectStore('queue').clear()
  await tx.done
}
