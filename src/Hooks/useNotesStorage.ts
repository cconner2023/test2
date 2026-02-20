/**
 * useNotesStorage — Primary hook for note CRUD and offline sync.
 *
 * This is a thin orchestrator that composes three focused sub-hooks:
 *   - useNotesSync: online/offline detection, connectivity listeners,
 *     migration, initialization, page-visibility catch-up, triggerSync
 *   - useNotesCRUD: saveNote, updateNote, deleteNote, deleteClinicNote,
 *     clearAllNotes with optimistic UI updates
 *   - useNotesRealtime: realtime subscription handlers for clinic notes
 *     and personal cross-device note sync
 *
 * It exposes:
 *   - `notes`: SavedNote[] with sync_status for badge display
 *   - `isOnline`: current connectivity status
 *   - `isSyncing`: whether a sync operation is in progress
 *   - `pendingCount`: number of notes waiting to sync
 *   - `saveNote`, `updateNote`, `deleteNote`, `clearAllNotes`: CRUD
 *
 * IMPORTANT: All writes go to IndexedDB first. If online, an
 * immediate sync to Supabase is attempted. If offline, the change
 * is queued and will sync when connectivity returns.
 */

import { useState } from 'react';
import { useNotesSync } from './useNotesSync';
import { useNotesCRUD } from './useNotesCRUD';
import { useNotesRealtime } from './useNotesRealtime';
import type { SavedNote } from '../lib/notesService';
import type { NoteSyncStatus } from '../lib/offlineDb';

// Re-export SavedNote from notesService so existing imports
// from './useNotesStorage' continue to work.
export type { SavedNote } from '../lib/notesService';
export type { NoteSyncStatus };

/**
 * Primary hook for note CRUD, offline-first IndexedDB persistence, and Supabase sync.
 * Manages both personal notes and clinic notes, with realtime cross-device updates.
 * @param isNotePanelOpen - When true, enables the realtime Supabase subscription for clinic notes
 */
export function useNotesStorage(isNotePanelOpen = false) {
  // Shared state owned by the orchestrator, passed to sub-hooks
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [clinicNotes, setClinicNotes] = useState<SavedNote[]>([]);

  // ── Sync: online/offline, migration, init, connectivity, triggerSync ──
  const sync = useNotesSync({ setNotes, setClinicNotes });

  // ── CRUD: saveNote, updateNote, deleteNote, deleteClinicNote, clearAllNotes ──
  const crud = useNotesCRUD({
    userIdRef: sync.userIdRef,
    clinicIdRef: sync.clinicIdRef,
    setNotes,
    setClinicNotes,
    setPendingCount: sync.setPendingCount,
    refreshNotes: sync.refreshNotes,
    refreshClinicNotes: sync.refreshClinicNotes,
  });

  // ── Realtime: clinic + personal cross-device subscription ──
  useNotesRealtime({
    userIdRef: sync.userIdRef,
    setNotes,
    setClinicNotes,
    realtimeClinicId: sync.realtimeClinicId,
    realtimeUserId: sync.realtimeUserId,
    realtimeAuthenticated: sync.realtimeAuthenticated,
    realtimeVisibleClinicIds: sync.realtimeVisibleClinicIds,
    isPageVisible: sync.isPageVisible,
    isNotePanelOpen,
  });

  return {
    notes,
    /** Read-only clinic notes fetched from server. Never stored in IndexedDB. */
    clinicNotes,
    saveNote: crud.saveNote,
    updateNote: crud.updateNote,
    deleteNote: crud.deleteNote,
    /** Hard-delete a clinic note. Any user in the same clinic can delete. Server-side only. */
    deleteClinicNote: crud.deleteClinicNote,
    clearAllNotes: crud.clearAllNotes,
    /** Whether the browser is currently online. */
    isOnline: sync.online,
    /** Whether a sync operation is currently in progress. */
    isSyncing: sync.isSyncing,
    /** Number of notes with sync_status === 'pending'. */
    pendingCount: sync.pendingCount,
    /** Number of notes with sync_status === 'error'. */
    errorCount: sync.errorCount,
    /** Timestamp of the last successful sync, or null if never synced. */
    lastSyncTime: sync.lastSyncTime,
    /** Manually trigger a full sync (pull + push). */
    triggerSync: sync.triggerSync,
  };
}
