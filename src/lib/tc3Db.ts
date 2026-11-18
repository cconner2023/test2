import { createIdbSingleton } from './idbFactory'
import { encryptString, decryptString } from './secureStorage'
import type { DBSchema } from 'idb'
import type { TC3Card, TC3QueueEntry } from '../Types/TC3Types'

// Casualty cards hold name, last-4, allergies, injuries and meds, so each row is
// stored as an AES-GCM blob under the device key (secureStorage.encryptString). Only
// the key path (card id) and the queue sort key stay in the clear. Rows written
// before this were plain TC3Card / TC3QueueEntry objects; they still load (no `enc`)
// and are re-sealed on their next save.
interface SealedCard { id: string; enc: string }
interface SealedQueueEntry { card: { id: string }; queuedAt: string; enc: string }

interface TC3DB extends DBSchema {
  activeCard: {
    key: string
    value: SealedCard | TC3Card
  }
  queue: {
    key: string
    value: SealedQueueEntry | TC3QueueEntry
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

async function openCard(row: SealedCard | TC3Card): Promise<TC3Card> {
  return 'enc' in row ? JSON.parse(await decryptString(row.enc)) as TC3Card : row
}

export async function saveActiveCard(card: TC3Card): Promise<void> {
  const db = await getDb()
  await db.put('activeCard', { id: card.id, enc: await encryptString(JSON.stringify(card)) })
}

export async function loadActiveCard(): Promise<TC3Card | null> {
  const db = await getDb()
  const all = await db.getAll('activeCard')
  if (all.length === 0) return null
  try { return await openCard(all[0]) } catch { return null }
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
  await db.put('queue', {
    card: { id: entry.card.id },
    queuedAt: entry.queuedAt,
    enc: await encryptString(JSON.stringify(entry)),
  })
}

export async function loadQueue(): Promise<TC3QueueEntry[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('queue', 'by-queuedAt')
  const out: TC3QueueEntry[] = []
  for (const row of all.reverse()) {
    try {
      out.push('enc' in row ? JSON.parse(await decryptString(row.enc)) as TC3QueueEntry : row)
    } catch { /* unreadable under the current device key: drop */ }
  }
  return out
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
