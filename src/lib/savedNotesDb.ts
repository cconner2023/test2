import { createIdbSingleton } from './idbFactory'
import type { DBSchema } from 'idb'

/**
 * My Notes — device-local cache of de-identified encoded notes.
 * Only the encoded barcode string is kept (AES "enc:" token when signed in);
 * symptom/disposition labels are algorithm vocabulary, never patient data.
 */
export interface SavedNote {
  id: string
  /** Owner auth id; null for guest-written notes. */
  userId: string | null
  /** Which surface reopens it; absent = medic (pre-provider entries). */
  kind?: 'medic' | 'provider'
  encodedText: string
  symptomIcon: string
  symptomText: string
  dispositionType: string
  dispositionText: string
  savedAt: string
}

export const SAVED_NOTES_CAP = 5

interface SavedNotesDB extends DBSchema {
  notes: {
    key: string
    value: SavedNote
    indexes: { 'by-savedAt': string }
  }
}

const { getDb } = createIdbSingleton<SavedNotesDB>('beacon-saved-notes', 1, {
  upgrade(db) {
    const store = db.createObjectStore('notes', { keyPath: 'id' })
    store.createIndex('by-savedAt', 'savedAt')
  },
})

/** Newest first, scoped to one owner. */
export async function listSavedNotes(userId: string | null): Promise<SavedNote[]> {
  const db = await getDb()
  const all = await db.getAll('notes')
  return all
    .filter(n => n.userId === userId)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** Upsert; evicts the owner's oldest notes past the cap. Returns the owner's list. */
export async function putSavedNote(note: SavedNote): Promise<SavedNote[]> {
  const db = await getDb()
  await db.put('notes', note)
  const list = await listSavedNotes(note.userId)
  const overflow = list.slice(SAVED_NOTES_CAP)
  if (overflow.length) {
    const tx = db.transaction('notes', 'readwrite')
    await Promise.all(overflow.map(n => tx.store.delete(n.id)))
    await tx.done
  }
  return list.slice(0, SAVED_NOTES_CAP)
}

export async function deleteSavedNote(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('notes', id)
}
