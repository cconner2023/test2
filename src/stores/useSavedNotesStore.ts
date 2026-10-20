/**
 * My Notes — reactive view over savedNotesDb for the side nav + WriteNotePage.
 * Scoped to the signed-in user (null = guest); call load() when that changes.
 */

import { create } from 'zustand'
import { listSavedNotes, putSavedNote, deleteSavedNote, type SavedNote } from '../lib/savedNotesDb'
import { logError } from '../Utilities/ErrorHandler'
import { withTimeout } from '../Utilities/withTimeout'

// iOS can leave an IDB request pending forever; Save/Done must never hang on it.
const IDB_TIMEOUT_MS = 5000

interface SavedNotesState {
  notes: SavedNote[]
  ownerId: string | null
  load: (userId: string | null) => Promise<void>
  save: (note: Omit<SavedNote, 'id' | 'savedAt'> & { id?: string }) => Promise<string | null>
  remove: (id: string) => Promise<void>
}

export const useSavedNotesStore = create<SavedNotesState>((set, get) => ({
  notes: [],
  ownerId: null,

  load: async (userId) => {
    set({ ownerId: userId })
    try {
      const notes = await withTimeout(listSavedNotes(userId), IDB_TIMEOUT_MS, 'savedNotes.list')
      if (get().ownerId === userId) set({ notes })
    } catch (e) {
      logError('useSavedNotesStore.load', e)
    }
  },

  save: async (note) => {
    try {
      const id = note.id ?? crypto.randomUUID()
      const notes = await withTimeout(
        putSavedNote({ ...note, id, savedAt: new Date().toISOString() }),
        IDB_TIMEOUT_MS, 'savedNotes.put',
      )
      if (get().ownerId === note.userId) set({ notes })
      return id
    } catch (e) {
      logError('useSavedNotesStore.save', e)
      return null
    }
  },

  remove: async (id) => {
    set(s => ({ notes: s.notes.filter(n => n.id !== id) }))
    try {
      await withTimeout(deleteSavedNote(id), IDB_TIMEOUT_MS, 'savedNotes.delete')
    } catch (e) {
      logError('useSavedNotesStore.remove', e)
    }
  },
}))
