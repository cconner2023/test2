/**
 * useNotesRealtime — Manages realtime subscription handlers for
 * clinic notes and personal cross-device note sync.
 *
 * Handles clinic upsert/delete and personal upsert/delete callbacks,
 * then wires them into useRealtimeClinicNotes.
 *
 * Extracted from useNotesStorage to isolate realtime concerns.
 * This hook is NOT meant to be used directly by UI components — it is
 * composed by useNotesStorage.
 */

import { useCallback } from 'react';
import {
  saveLocalNote as idbSaveNote,
  hardDeleteLocalNote as idbHardDelete,
} from '../lib/offlineDb';
import { useRealtimeClinicNotes } from './useRealtimeClinicNotes';
import { createLogger } from '../Utilities/Logger';
import type { SavedNote } from '../lib/notesService';

const logger = createLogger('NotesRealtime');

/** Sort SavedNote[] by createdAt descending (newest first). */
export function sortByNewest(notes: SavedNote[]): SavedNote[] {
  return notes.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Merge an incoming note into an existing list using last-write-wins semantics.
 * - If the note already exists, update it only when the incoming timestamp is
 *   newer (or equal).
 * - If the note is new, insert it and re-sort by newest first.
 */
function mergeNoteIntoList(prev: SavedNote[], incoming: SavedNote): SavedNote[] {
  const idx = prev.findIndex((n) => n.id === incoming.id);
  if (idx >= 0) {
    const existing = prev[idx];
    const existingTime = new Date(existing.createdAt).getTime();
    const incomingTime = new Date(incoming.createdAt).getTime();
    if (incomingTime >= existingTime) {
      const next = [...prev];
      next[idx] = incoming;
      return next;
    }
    return prev;
  }
  return sortByNewest([incoming, ...prev]);
}

/** Dependencies injected from the orchestrator / sync hook. */
export interface NotesRealtimeDeps {
  userIdRef: React.MutableRefObject<string | null>;
  setNotes: React.Dispatch<React.SetStateAction<SavedNote[]>>;
  setClinicNotes: React.Dispatch<React.SetStateAction<SavedNote[]>>;
  realtimeClinicId: string | null;
  realtimeUserId: string | null;
  realtimeAuthenticated: boolean;
  realtimeVisibleClinicIds: string[];
  isPageVisible: boolean;
  isNotePanelOpen: boolean;
}

export function useNotesRealtime(deps: NotesRealtimeDeps): void {
  const {
    userIdRef,
    setNotes,
    setClinicNotes,
    realtimeClinicId,
    realtimeUserId,
    realtimeAuthenticated,
    realtimeVisibleClinicIds,
    isPageVisible,
    isNotePanelOpen,
  } = deps;

  // ── Realtime: unified clinic notes subscription ─────────────
  // A single channel handles both clinic-member events (→ clinicNotes)
  // and own-user cross-device events (→ notes + IndexedDB).

  const handleClinicUpsert = useCallback((note: SavedNote) => {
    setClinicNotes((prev) => mergeNoteIntoList(prev, note));
  }, [setClinicNotes]);

  const handleClinicDelete = useCallback((noteId: string) => {
    setClinicNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, [setClinicNotes]);

  const handlePersonalUpsert = useCallback((note: SavedNote) => {
    setNotes((prev) => mergeNoteIntoList(prev, note));

    // Persist to IndexedDB so the note survives tab close / refresh
    const userId = userIdRef.current;
    if (userId && userId !== 'guest') {
      const now = new Date().toISOString();
      idbSaveNote({
        id: note.id,
        user_id: userId,
        clinic_id: note.clinicId ?? null,
        clinic_name: note.clinicName ?? null,
        timestamp: note.createdAt,
        display_name: note.authorName || null,
        rank: null,
        uic: null,
        algorithm_reference: null,
        hpi_encoded: note.encodedText || null,
        symptom_icon: note.symptomIcon || null,
        symptom_text: note.symptomText || null,
        disposition_type: note.dispositionType || null,
        disposition_text: note.dispositionText || null,
        preview_text: note.previewText || null,
        is_imported: note.source?.startsWith('external') ?? false,
        originating_clinic_id: note.originating_clinic_id ?? null,
        visible_clinic_ids: note.visible_clinic_ids ?? [],
        source_device: note.source || null,
        created_at: note.createdAt,
        updated_at: now,
        deleted_at: null,
        _sync_status: 'synced',
        _sync_retry_count: 0,
        _last_sync_error: null,
        _last_sync_error_message: null,
      }).catch((err) => {
        logger.warn('Failed to persist realtime personal note to IndexedDB:', err);
      });
    }
  }, [userIdRef, setNotes]);

  const handlePersonalDelete = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));

    idbHardDelete(noteId).catch((err) => {
      logger.warn('Failed to delete realtime personal note from IndexedDB:', err);
    });
  }, [setNotes]);

  useRealtimeClinicNotes({
    clinicId: realtimeClinicId,
    userId: realtimeUserId,
    isAuthenticated: realtimeAuthenticated,
    visibleClinicIds: realtimeVisibleClinicIds,
    isPageVisible,
    isNotePanelOpen,
    onClinicUpsert: handleClinicUpsert,
    onClinicDelete: handleClinicDelete,
    onPersonalUpsert: handlePersonalUpsert,
    onPersonalDelete: handlePersonalDelete,
  });
}
