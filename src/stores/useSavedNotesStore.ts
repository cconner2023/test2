/**
 * My Notes — reactive view over savedNotesDb for the side nav + WriteNotePage.
 * Scoped to the signed-in user (null = guest); call load() when that changes.
 */

import { create } from 'zustand'
import { listSavedNotes, putSavedNote, deleteSavedNote, type SavedNote } from '../lib/savedNotesDb'
import { logError } from '../Utilities/ErrorHandler'

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
      const notes = await listSavedNotes(userId)
      if (get().ownerId === userId) set({ notes })
    } catch (e) {
      logError('useSavedNotesStore.load', e)
    }
  },

  save: async (note) => {
    const id = note.id ?? crypto.randomUUID()
    try {
      const notes = await putSavedNote({ ...note, id, savedAt: new Date().toISOString() })
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
      await deleteSavedNote(id)
    } catch (e) {
      logError('useSavedNotesStore.remove', e)
    }
  },
}))
