/**
 * useNotesStorage — Primary hook for note CRUD and offline sync.
 *
 * This hook provides the interface between the React UI and the
 * offline-first notes infrastructure:
 *   - IndexedDB (offlineDb.ts) for local persistence
 *   - Sync queue (offlineDb.ts) for pending mutations
 *   - Sync service (syncService.ts) for push/pull with Supabase
 *   - Notes service (notesService.ts) for CRUD operations
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

import { useState, useCallback, useEffect, useRef } from 'react';
import * as notesApi from '../lib/notesService';
import {
  getLocalNotes,
  getAllLocalNotesIncludingDeleted,
  saveLocalNote as idbSaveNote,
  hardDeleteLocalNote as idbHardDelete,
  migrateV1Notes,
  type NoteSyncStatus,
} from '../lib/offlineDb';
import {
  isOnline as checkOnline,
  setupConnectivityListeners,
  fullSync,
} from '../lib/syncService';
import { supabase } from '../lib/supabase';
import { useRealtimeClinicNotes } from './useRealtimeClinicNotes';
import { usePageVisibility } from './usePageVisibility';

// Re-export SavedNote from notesService so existing imports
// from './useNotesStorage' continue to work.
export type { SavedNote } from '../lib/notesService';
import type { SavedNote } from '../lib/notesService';
export type { NoteSyncStatus };

const STORAGE_KEY = 'adtmc_saved_notes';

/**
 * Migrate notes from localStorage to IndexedDB.
 * This handles the transition from the old localStorage-based
 * storage to the new IndexedDB-based offline-first system.
 *
 * Notes in localStorage that don't exist in IndexedDB are
 * imported as pending-sync notes. After migration, the
 * localStorage key is cleared.
 */
async function migrateFromLocalStorage(userId: string): Promise<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return 0;
    }

    const existingNotes = await getAllLocalNotesIncludingDeleted(userId);
    const existingIds = new Set(existingNotes.map((n) => n.id));
    let migrated = 0;

    for (const note of parsed) {
      if (!note.id || !note.encodedText) continue;
      if (existingIds.has(note.id)) continue;

      const now = new Date().toISOString();
      await idbSaveNote({
        id: note.id,
        user_id: userId,
        clinic_id: null,
        timestamp: note.createdAt || now,
        display_name: null,
        rank: null,
        uic: null,
        algorithm_reference: null,
        hpi_encoded: note.encodedText || null,
        symptom_icon: note.symptomIcon || null,
        symptom_text: note.symptomText || null,
        disposition_type: note.dispositionType || null,
        disposition_text: note.dispositionText || null,
        preview_text: note.previewText || null,
        is_imported: note.source === 'external source',
        source_device: note.source || null,
        created_at: note.createdAt || now,
        updated_at: now,
        deleted_at: null,
        _sync_status: 'pending',
        _sync_retry_count: 0,
        _last_sync_error: null,
        _last_sync_error_message: null,
      });
      migrated++;
    }

    // Clear localStorage after successful migration
    localStorage.removeItem(STORAGE_KEY);
    console.log(`[NotesStorage] Migrated ${migrated} notes from localStorage to IndexedDB`);
    return migrated;
  } catch (err) {
    console.warn('[NotesStorage] localStorage migration failed:', err);
    return 0;
  }
}

export function useNotesStorage(isNotePanelOpen = false) {
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [clinicNotes, setClinicNotes] = useState<SavedNote[]>([]);
  const [online, setOnline] = useState<boolean>(checkOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const userIdRef = useRef<string | null>(null);
  const clinicIdRef = useRef<string | null>(null);
  const initDone = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // State copies for the Realtime hook (refs are still used for sync CRUD)
  const [realtimeClinicId, setRealtimeClinicId] = useState<string | null>(null);
  const [realtimeUserId, setRealtimeUserId] = useState<string | null>(null);
  const [realtimeAuthenticated, setRealtimeAuthenticated] = useState(false);

  // Auth version counter — incremented on SIGNED_IN / SIGNED_OUT to
  // trigger the init effect to re-run with the new user context.
  const [authVersion, setAuthVersion] = useState(0);

  // Page visibility — pauses realtime channels when backgrounded
  const isPageVisible = usePageVisibility();

  // ── Auth state tracking — re-init on login/logout ─────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // Immediately clear state so UI shows no stale data
        setNotes([]);
        setClinicNotes([]);
        setPendingCount(0);
        setRealtimeClinicId(null);
        setRealtimeUserId(null);
        setRealtimeAuthenticated(false);
        userIdRef.current = null;
        clinicIdRef.current = null;
        initDone.current = false;
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setAuthVersion((v) => v + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Refresh the notes list from IndexedDB and update pending count.
   */
  const refreshNotes = useCallback(async (userId: string) => {
    const localNotes = await getLocalNotes(userId);
    const savedNotes = localNotes.map((n) => notesApi.localNoteToSavedNote(n));
    // Sort newest first
    savedNotes.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setNotes(savedNotes);

    // Update pending count
    const pending = savedNotes.filter((n) => n.sync_status === 'pending').length;
    setPendingCount(pending);
  }, []);

  /**
   * Fetch clinic notes from the server and update state.
   * Clinic notes are server-only (never stored in IndexedDB).
   *
   * The excludeUserId parameter filters out the current user's own
   * notes at the database level (via .neq('user_id', ...)). This
   * prevents duplicates since the user's own notes are already
   * present in the local `notes` array from IndexedDB.
   */
  const refreshClinicNotes = useCallback(async (clinicId: string, excludeUserId?: string) => {
    try {
      // fetchClinicNotesFromServer returns SavedNote[] directly
      // (already converted with author info from profiles join).
      const saved = await notesApi.fetchClinicNotesFromServer(clinicId, excludeUserId);
      // Sort newest first
      saved.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setClinicNotes(saved);
    } catch (err) {
      console.warn('[NotesStorage] Failed to fetch clinic notes:', err);
    }
  }, []);

  // ── Initialization ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Determine user context
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || 'guest';
        userIdRef.current = userId;
        setRealtimeUserId(userId);
        setRealtimeAuthenticated(userId !== 'guest');

        if (cancelled) return;

        // 2. Migrate v1 IndexedDB notes (if any)
        const v1Migrated = await migrateV1Notes();
        if (v1Migrated > 0) {
          console.log(`[NotesStorage] Migrated ${v1Migrated} v1 notes to v2 format`);
        }

        // 3. Migrate from localStorage (if any)
        await migrateFromLocalStorage(userId);

        if (cancelled) return;

        // 4. If authenticated and online, do initial sync
        if (userId !== 'guest' && checkOnline()) {
          try {
            setIsSyncing(true);
            const reconciledNotes = await notesApi.fetchNotesFromServer(userId);

            if (cancelled) return;

            // Merge server notes into IndexedDB
            const existingLocal = await getAllLocalNotesIncludingDeleted(userId);
            const localMap = new Map(existingLocal.map((n) => [n.id, n]));

            for (const serverNote of reconciledNotes) {
              const local = localMap.get(serverNote.id);
              if (!local) {
                // Server-only note -- pull into IndexedDB
                await idbSaveNote(serverNote);
              } else if (local._sync_status !== 'pending') {
                // Both exist, local is not pending -- update from server
                const serverTime = new Date(serverNote.updated_at).getTime();
                const localTime = new Date(local.updated_at).getTime();
                if (serverTime >= localTime) {
                  await idbSaveNote(serverNote);
                }
              }
              // If local is pending, keep it -- it will be pushed to server
            }

            // Push any pending local changes to server
            await fullSync(userId);

            if (cancelled) return;

            // 4b. Fetch clinic notes (server-only, not stored in IndexedDB)
            const { data: profile } = await supabase
              .from('profiles')
              .select('clinic_id')
              .eq('id', userId)
              .single();

            const clinicId = profile?.clinic_id ?? null;
            clinicIdRef.current = clinicId;
            if (!cancelled) setRealtimeClinicId(clinicId);

            if (clinicId) {
              await refreshClinicNotes(clinicId, userId);
            }
          } catch (err) {
            console.warn('[NotesStorage] Initial sync failed, using local data:', err);
          } finally {
            if (!cancelled) setIsSyncing(false);
          }
        }

        if (cancelled) return;

        // 5. Load notes from IndexedDB into state
        await refreshNotes(userId);

        // 6. Set up connectivity listeners for automatic sync
        if (userId !== 'guest') {
          cleanupRef.current = setupConnectivityListeners(userId, {
            onStatusChange: (isOnline) => {
              if (!cancelled) setOnline(isOnline);
            },
            onSyncStart: () => {
              if (!cancelled) setIsSyncing(true);
            },
            onSyncComplete: () => {
              if (!cancelled) {
                setIsSyncing(false);
                refreshNotes(userId);
              }
            },
            onReconcileComplete: () => {
              if (!cancelled) {
                refreshNotes(userId);
              }
            },
            onClinicRefresh: async () => {
              if (cancelled) return;

              let clinicId = clinicIdRef.current;

              // If clinicId is not yet known (app started offline), fetch it now
              if (!clinicId) {
                try {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('clinic_id')
                    .eq('id', userId)
                    .single();
                  clinicId = profile?.clinic_id ?? null;
                  clinicIdRef.current = clinicId;
                  if (clinicId && !cancelled) setRealtimeClinicId(clinicId);
                } catch {
                  // Will retry on next sync cycle
                }
              }

              if (clinicId && !cancelled) {
                refreshClinicNotes(clinicId, userId);
              }
            },
          });
        }

        initDone.current = true;
      } catch (err) {
        console.error('[NotesStorage] Initialization failed:', err);
        initDone.current = true;
      }
    }

    init();

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [refreshNotes, refreshClinicNotes, authVersion]);

  // ── Track online status changes ─────────────────────────────

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Catch-up sync when page becomes visible ────────────────
  // Realtime channels are paused while backgrounded, so we refresh
  // notes from IndexedDB + server when the user returns.

  const prevVisibleRef = useRef(true);
  useEffect(() => {
    // Only trigger on transition from hidden → visible
    if (isPageVisible && !prevVisibleRef.current && initDone.current) {
      const userId = userIdRef.current;
      if (userId && userId !== 'guest' && checkOnline()) {
        refreshNotes(userId);
        const clinicId = clinicIdRef.current;
        if (clinicId) {
          refreshClinicNotes(clinicId, userId);
        }
      }
    }
    prevVisibleRef.current = isPageVisible;
  }, [isPageVisible, refreshNotes, refreshClinicNotes]);

  // ── CRUD Operations ─────────────────────────────────────────

  const saveNote = useCallback(
    (
      note: Omit<SavedNote, 'id' | 'createdAt' | 'sync_status' | 'authorId' | 'authorName'>
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
        createdAt: new Date().toISOString(),
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
      notesApi
        .createNote(note, noteId)
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
          console.error('[NotesStorage] Create note failed:', err);
          // The note was still saved to IndexedDB by createNote,
          // just the immediate Supabase sync may have failed.
          // Refresh to get the actual state.
          refreshNotes(userId);
        });

      return { success: true, noteId };
    },
    [refreshNotes]
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
          console.error('[NotesStorage] Update note failed:', err);
          refreshNotes(userId);
        });

      return { success: true };
    },
    [refreshNotes]
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      const userId = userIdRef.current;
      if (!userId) return;

      // Optimistically remove from UI
      setNotes((prev) => prev.filter((n) => n.id !== noteId));

      // Hard-delete from IndexedDB + queue sync for Supabase deletion
      notesApi.deleteNote(noteId, userId).catch((err) => {
        console.error('[NotesStorage] Delete note failed:', err);
        refreshNotes(userId);
      });
    },
    [refreshNotes]
  );

  const deleteClinicNote = useCallback(
    (noteId: string) => {
      // Optimistically remove from clinic notes UI
      setClinicNotes((prev) => prev.filter((n) => n.id !== noteId));

      // Hard-delete on Supabase (clinic notes are server-only).
      // RLS policy "Notes: clinic members can delete" (migration 009)
      // allows any user in the same clinic to delete.
      notesApi.deleteClinicNote(noteId).catch((err) => {
        console.error('[NotesStorage] Delete clinic note failed:', err);
        // Refresh to restore the note if the delete failed
        const clinicId = clinicIdRef.current;
        if (clinicId) refreshClinicNotes(clinicId, userIdRef.current ?? undefined);
      });
    },
    [refreshClinicNotes]
  );

  const clearAllNotes = useCallback(() => {
    const userId = userIdRef.current;
    if (!userId) return;

    // Optimistically clear UI
    setNotes([]);

    // Hard-delete all notes asynchronously
    notesApi.deleteAllNotes(userId).catch((err) => {
      console.error('[NotesStorage] Clear all notes failed:', err);
      refreshNotes(userId);
    });
  }, [refreshNotes]);

  /**
   * Manually trigger a sync. Returns the sync result.
   */
  const triggerSync = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId || userId === 'guest' || !checkOnline()) return;

    setIsSyncing(true);
    try {
      await fullSync(userId, () => refreshNotes(userId));
      await refreshNotes(userId);

      // Also refresh clinic notes if the user belongs to a clinic
      const clinicId = clinicIdRef.current;
      if (clinicId) {
        await refreshClinicNotes(clinicId, userId);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [refreshNotes, refreshClinicNotes]);

  // ── Realtime: unified clinic notes subscription ─────────────
  // A single channel handles both clinic-member events (→ clinicNotes)
  // and own-user cross-device events (→ notes + IndexedDB).

  const handleClinicUpsert = useCallback((note: SavedNote) => {
    setClinicNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx >= 0) {
        const existing = prev[idx];
        const existingTime = new Date(existing.createdAt).getTime();
        const incomingTime = new Date(note.createdAt).getTime();
        if (incomingTime >= existingTime) {
          const next = [...prev];
          next[idx] = note;
          return next;
        }
        return prev;
      }
      return [note, ...prev].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, []);

  const handleClinicDelete = useCallback((noteId: string) => {
    setClinicNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const handlePersonalUpsert = useCallback((note: SavedNote) => {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id);
      if (idx >= 0) {
        const existing = prev[idx];
        const existingTime = new Date(existing.createdAt).getTime();
        const incomingTime = new Date(note.createdAt).getTime();
        if (incomingTime >= existingTime) {
          const next = [...prev];
          next[idx] = note;
          return next;
        }
        return prev;
      }
      return [note, ...prev].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    // Persist to IndexedDB so the note survives tab close / refresh
    const userId = userIdRef.current;
    if (userId && userId !== 'guest') {
      const now = new Date().toISOString();
      idbSaveNote({
        id: note.id,
        user_id: userId,
        clinic_id: null,
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
        is_imported: note.source === 'external source',
        source_device: note.source || null,
        created_at: note.createdAt,
        updated_at: now,
        deleted_at: null,
        _sync_status: 'synced',
        _sync_retry_count: 0,
        _last_sync_error: null,
        _last_sync_error_message: null,
      }).catch((err) => {
        console.warn('[NotesStorage] Failed to persist realtime personal note to IndexedDB:', err);
      });
    }
  }, []);

  const handlePersonalDelete = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));

    idbHardDelete(noteId).catch((err) => {
      console.warn('[NotesStorage] Failed to delete realtime personal note from IndexedDB:', err);
    });
  }, []);

  useRealtimeClinicNotes({
    clinicId: realtimeClinicId,
    userId: realtimeUserId,
    isAuthenticated: realtimeAuthenticated,
    isPageVisible,
    isNotePanelOpen,
    onClinicUpsert: handleClinicUpsert,
    onClinicDelete: handleClinicDelete,
    onPersonalUpsert: handlePersonalUpsert,
    onPersonalDelete: handlePersonalDelete,
  });

  return {
    notes,
    /** Read-only clinic notes fetched from server. Never stored in IndexedDB. */
    clinicNotes,
    saveNote,
    updateNote,
    deleteNote,
    /** Hard-delete a clinic note. Any user in the same clinic can delete. Server-side only. */
    deleteClinicNote,
    clearAllNotes,
    /** Whether the browser is currently online. */
    isOnline: online,
    /** Whether a sync operation is currently in progress. */
    isSyncing,
    /** Number of notes with sync_status === 'pending'. */
    pendingCount,
    /** Manually trigger a full sync (pull + push). */
    triggerSync,
  };
}
