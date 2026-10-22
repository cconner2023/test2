import { createIdbSingleton } from './idbFactory'
import { withTimeout } from '../Utilities/withTimeout'
import { logError } from '../Utilities/ErrorHandler'
import type { DBSchema, IDBPDatabase } from 'idb'

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

const { getDb, reset } = createIdbSingleton<SavedNotesDB>('beacon-saved-notes', 1, {
  upgrade(db) {
    const store = db.createObjectStore('notes', { keyPath: 'id' })
    store.createIndex('by-savedAt', 'savedAt')
  },
})

// iOS can leave an IDB request pending forever on a wedged connection.
const IDB_TIMEOUT_MS = 5000

/**
 * Run an op bounded by a timeout; on failure drop the cached connection and try
 * once more on a fresh one. A wedged handle otherwise fails every op until reload,
 * which reads to the user as "my notes are gone".
 */
async function run<T>(label: string, op: (db: IDBPDatabase<SavedNotesDB>) => Promise<T>): Promise<T> {
  try {
    return await withTimeout(getDb().then(op), IDB_TIMEOUT_MS, label)
  } catch (e) {
    logError(`${label} (retrying)`, e)
    reset()
    return withTimeout(getDb().then(op), IDB_TIMEOUT_MS, label)
  }
}

let persistRequested = false
/** Ask the browser not to evict this origin's storage under pressure. Best effort, once. */
function requestPersistence(): void {
  if (persistRequested) return
  persistRequested = true
  navigator.storage?.persist?.().catch(() => { /* unsupported */ })
}

async function listFrom(db: IDBPDatabase<SavedNotesDB>, userId: string | null): Promise<SavedNote[]> {
  const all = await db.getAll('notes')
  return all
    .filter(n => n.userId === userId)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** Newest first, scoped to one owner. */
export function listSavedNotes(userId: string | null): Promise<SavedNote[]> {
  return run('savedNotes.list', db => listFrom(db, userId))
}

/** Upsert; evicts the owner's oldest notes past the cap. Returns the owner's list. */
export function putSavedNote(note: SavedNote): Promise<SavedNote[]> {
  requestPersistence()
  return run('savedNotes.put', async db => {
    await db.put('notes', note)
    // Read back — a put that resolved without landing must not report success.
    if (!(await db.get('notes', note.id))) throw new Error('saved note did not persist')
    const list = await listFrom(db, note.userId)
    const overflow = list.slice(SAVED_NOTES_CAP)
    if (overflow.length) {
      const tx = db.transaction('notes', 'readwrite')
      await Promise.all(overflow.map(n => tx.store.delete(n.id)))
      await tx.done
    }
    return list.slice(0, SAVED_NOTES_CAP)
  })
}

export function deleteSavedNote(id: string): Promise<void> {
  return run('savedNotes.delete', db => db.delete('notes', id))
}
