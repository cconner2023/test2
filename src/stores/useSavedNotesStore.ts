/**
 * My Notes — reactive view over savedNotesDb for the side nav + WriteNotePage.
 * Scoped to the signed-in user (null = guest); call load() when that changes.
 * IDB timeouts and wedged-connection retries live in savedNotesDb.
 */

import { create } from 'zustand'
import { listSavedNotes, putSavedNote, deleteSavedNote, type SavedNote } from '../lib/savedNotesDb'
import { decodeSavedNote, savedNoteErrorMessage } from '../Utilities/savedNoteCodec'
import { emitErrorToast } from '../lib/errorFeedback'
import { logError } from '../Utilities/ErrorHandler'

interface SavedNotesState {
  notes: SavedNote[]
  ownerId: string | null
  load: (userId: string | null) => Promise<void>
  /** Resolves the id on success; null after showing the failure to the user. */
  save: (note: Omit<SavedNote, 'id' | 'savedAt'> & { id?: string }) => Promise<string | null>
  remove: (id: string) => Promise<void>
}

export const useSavedNotesStore = create<SavedNotesState>((set, get) => ({
  notes: [],
  ownerId: null,

  load: async (userId) => {
    set({ ownerId: userId })
    try {
      const notes = await listSavedNotes(userId)
      if (get().ownerId === userId) set({ notes })
    } catch (e) {
      logError('useSavedNotesStore.load', e)
    }
  },

  save: async (note) => {
    // Prove it reopens before writing — a saved note that can't be restored is
    // worse than a failed save the medic can see and work around.
    try {
      await decodeSavedNote(note)
    } catch (e) {
      logError('useSavedNotesStore.save.verify', e)
      emitErrorToast('Note not saved', savedNoteErrorMessage(e, 'This note could not be verified. Copy or export it before closing.'))
      return null
    }
    try {
      const id = note.id ?? crypto.randomUUID()
      const notes = await putSavedNote({ ...note, id, savedAt: new Date().toISOString() })
      if (get().ownerId === note.userId) set({ notes })
      return id
    } catch (e) {
      logError('useSavedNotesStore.save', e)
      emitErrorToast('Note not saved', 'Device storage did not respond. Try again, or copy/export the note before closing.')
      return null
    }
  },

  remove: async (id) => {
    set(s => ({ notes: s.notes.filter(n => n.id !== id) }))
    try {
      await deleteSavedNote(id)
    } catch (e) {
      logError('useSavedNotesStore.remove', e)
      void get().load(get().ownerId)
    }
  },
}))
