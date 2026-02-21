/**
 * useNotesCRUD — Manages optimistic CRUD operations for notes.
 *
 * Handles saveNote, updateNote, deleteNote, deleteClinicNote, and
 * clearAllNotes with optimistic UI updates and async persistence.
 *
 * Extracted from useNotesStorage to isolate CRUD concerns.
 * This hook is NOT meant to be used directly by UI components — it is
 * composed by useNotesStorage.
 */

import { useCallback } from 'react';
import * as notesApi from '../lib/notesService';
import type { NoteSyncStatus } from '../lib/offlineDb';
import { createLogger } from '../Utilities/Logger';
import type { SavedNote } from '../lib/notesService';

const logger = createLogger('NotesCRUD');

/** Dependencies injected from the orchestrator / sync hook. */
export interface NotesCRUDDeps {
  userIdRef: React.MutableRefObject<string | null>;
  clinicIdRef: React.MutableRefObject<string | null>;
  setNotes: React.Dispatch<React.SetStateAction<SavedNote[]>>;
  setClinicNotes: React.Dispatch<React.SetStateAction<SavedNote[]>>;
  setPendingCount: React.Dispatch<React.SetStateAction<number>>;
  refreshNotes: (userId: string) => Promise<void>;
  refreshClinicNotes: (clinicId: string, excludeUserId?: string) => Promise<void>;
}

export interface NotesCRUDResult {
  saveNote: (
    note: Omit<SavedNote, 'id' | 'createdAt' | 'sync_status' | 'authorId' | 'authorName'>,
    options?: { originating_clinic_id?: string | null; timestamp?: string }
  ) => { success: boolean; error?: string; noteId?: string };
  updateNote: (
    noteId: string,
    updates: Partial<Omit<SavedNote, 'id' | 'sync_status' | 'authorId' | 'authorName'>>,
    refreshTimestamp?: boolean
  ) => { success: boolean; error?: string };
  deleteNote: (noteId: string) => void;
  deleteClinicNote: (noteId: string) => void;
  clearAllNotes: () => void;
}

export function useNotesCRUD(deps: NotesCRUDDeps): NotesCRUDResult {
  const {
    userIdRef,
    clinicIdRef,
    setNotes,
    setClinicNotes,
    setPendingCount,
    refreshNotes,
    refreshClinicNotes,
  } = deps;

  const saveNote = useCallback(
    (
      note: Omit<SavedNote, 'id' | 'createdAt' | 'sync_status' | 'authorId' | 'authorName'>,
      options?: { originating_clinic_id?: string | null; timestamp?: string }
    ): { success: boolean; error?: string; noteId?: string } => {
      const userId = userIdRef.current;
      if (!userId) {
        return { success: false, error: 'Not initialized yet. Please try again.' };
      }

      // Kick off the async create and immediately return the note ID.
      // The UI gets the optimistic result; sync happens in the background.
      const noteId = crypto.randomUUID();

      // Create optimistic SavedNote for immediate UI update
      const optimisticNote: SavedNote = {
        id: noteId,
        encodedText: note.encodedText,
        createdAt: options?.timestamp ?? new Date().toISOString(),
        symptomIcon: note.symptomIcon,
        symptomText: note.symptomText,
        dispositionType: note.dispositionType,
        dispositionText: note.dispositionText,
        previewText: note.previewText,
        source: note.source,
        sync_status: userId === 'guest' ? 'synced' : 'pending',
        authorId: userId,
        authorName: null, // Will be populated after async createNote completes
      };

      // Optimistically update state
      setNotes((prev) => [optimisticNote, ...prev]);
      if (userId !== 'guest') {
        setPendingCount((prev) => prev + 1);
      }

      // Persist asynchronously. Pass the pre-generated noteId so the
      // IndexedDB record shares the same ID as the optimistic UI note.
      // This prevents race conditions where refreshNotes (reading from
      // IndexedDB) runs before the .then() callback -- both now reference
      // the same note ID, so the status update is never lost.
      // For imported notes, pass originating_clinic_id via the note input.
      const noteInput = options?.originating_clinic_id != null
        ? { ...note, originating_clinic_id: options.originating_clinic_id }
        : note
      notesApi
        .createNote(noteInput, noteId, options?.timestamp)
        .then((savedNote) => {
          // Replace the optimistic note with the persisted version.
          // Both share the same ID (noteId), so this works reliably
          // even if refreshNotes ran between the optimistic update
          // and this callback.
          setNotes((prev) =>
            prev.map((n) => (n.id === noteId ? savedNote : n))
          );

          // Update pending count based on actual sync status
          if (savedNote.sync_status === 'synced' && userId !== 'guest') {
            setPendingCount((prev) => Math.max(0, prev - 1));
          }
        })
        .catch((err) => {
          logger.error('Create note failed:', err);
          // The note was still saved to IndexedDB by createNote,
          // just the immediate Supabase sync may have failed.
          // Refresh to get the actual state.
          refreshNotes(userId);
        });

      return { success: true, noteId };
    },
    [userIdRef, setNotes, setPendingCount, refreshNotes]
  );

  const updateNote = useCallback(
    (
      noteId: string,
      updates: Partial<Omit<SavedNote, 'id' | 'sync_status' | 'authorId' | 'authorName'>>,
      refreshTimestamp = false
    ): { success: boolean; error?: string } => {
      const userId = userIdRef.current;
      if (!userId) {
        return { success: false, error: 'Not initialized yet.' };
      }

      // Apply the updates and refreshTimestamp flag
      const appliedUpdates = {
        ...updates,
        ...(refreshTimestamp ? { createdAt: new Date().toISOString() } : {}),
      };

      // Optimistically update UI state
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== noteId) return n;
          return {
            ...n,
            ...appliedUpdates,
            sync_status: userId === 'guest' ? 'synced' : ('pending' as NoteSyncStatus),
          };
        })
      );

      if (userId !== 'guest') {
        setPendingCount((prev) => prev + 1);
      }

      // Persist asynchronously
      notesApi
        .updateNote(noteId, appliedUpdates, userId)
        .then((updatedNote) => {
          if (updatedNote) {
            setNotes((prev) =>
              prev.map((n) => (n.id === noteId ? updatedNote : n))
            );
            if (updatedNote.sync_status === 'synced' && userId !== 'guest') {
              setPendingCount((prev) => Math.max(0, prev - 1));
            }
          }
        })
        .catch((err) => {
          logger.error('Update note failed:', err);
          refreshNotes(userId);
        });

      return { success: true };
    },
    [userIdRef, setNotes, setPendingCount, refreshNotes]
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      const userId = userIdRef.current;
      if (!userId) return;

      // Optimistically remove from UI
      setNotes((prev) => prev.filter((n) => n.id !== noteId));

      // Hard-delete from IndexedDB + queue sync for Supabase deletion
      notesApi.deleteNote(noteId, userId).catch((err) => {
        logger.error('Delete note failed:', err);
        refreshNotes(userId);
      });
    },
    [userIdRef, setNotes, refreshNotes]
  );

  const deleteClinicNote = useCallback(
    (noteId: string) => {
      const clinicId = clinicIdRef.current;

      // Find the note before removing from UI to check import status
      let targetNote: SavedNote | undefined;
      setClinicNotes((prev) => {
        targetNote = prev.find((n) => n.id === noteId);
        return prev.filter((n) => n.id !== noteId);
      });

      // For imported notes where the deleter's clinic is in visible_clinic_ids
      // but NOT the originating clinic: remove clinic from visibility instead of hard delete.
      // This way the note remains visible to other clinics that imported it.
      if (targetNote?.originating_clinic_id && clinicId && targetNote.originating_clinic_id !== clinicId) {
        notesApi.removeClinicVisibility(noteId, clinicId).catch((err) => {
          logger.error('Remove clinic visibility failed:', err);
          if (clinicId) refreshClinicNotes(clinicId, userIdRef.current ?? undefined);
        });
        return;
      }

      // Hard-delete on Supabase (clinic notes are server-only).
      // RLS policy "Notes: delete by clinic hierarchy" allows users in
      // the same clinic hierarchy to delete.
      notesApi.deleteClinicNote(noteId).catch((err) => {
        logger.error('Delete clinic note failed:', err);
        if (clinicId) refreshClinicNotes(clinicId, userIdRef.current ?? undefined);
      });
    },
    [userIdRef, clinicIdRef, setClinicNotes, refreshClinicNotes]
  );

  const clearAllNotes = useCallback(() => {
    const userId = userIdRef.current;
    if (!userId) return;

    // Optimistically clear UI
    setNotes([]);

    // Hard-delete all notes asynchronously
    notesApi.deleteAllNotes(userId).catch((err) => {
      logger.error('Clear all notes failed:', err);
      refreshNotes(userId);
    });
  }, [userIdRef, setNotes, refreshNotes]);

  return {
    saveNote,
    updateNote,
    deleteNote,
    deleteClinicNote,
    clearAllNotes,
  };
}
