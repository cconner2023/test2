/**
 * useNotesSync — Manages online/offline detection, connectivity listeners,
 * migration, initialization, page-visibility catch-up, and manual sync.
 *
 * Extracted from useNotesStorage to isolate sync orchestration concerns.
 * This hook is NOT meant to be used directly by UI components — it is
 * composed by useNotesStorage.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as notesApi from '../lib/notesService';
import {
  getLocalNotes,
  getAllLocalNotesIncludingDeleted,
  saveLocalNote as idbSaveNote,
  migrateV1Notes,
} from '../lib/offlineDb';
import {
  isOnline as checkOnline,
  setupConnectivityListeners,
  fullSync,
} from '../lib/syncService';
import { supabase } from '../lib/supabase';
import { usePageVisibility } from './usePageVisibility';
import { createLogger } from '../Utilities/Logger';
import type { SavedNote } from '../lib/notesService';
import { sortByNewest } from './useNotesRealtime';

const logger = createLogger('NotesSync');

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
    logger.info(`Migrated ${migrated} notes from localStorage to IndexedDB`);
    return migrated;
  } catch (err) {
    logger.warn('localStorage migration failed:', err);
    return 0;
  }
}

/** State and setters shared with the orchestrator for notes/clinicNotes. */
export interface NotesSyncDeps {
  setNotes: React.Dispatch<React.SetStateAction<SavedNote[]>>;
  setClinicNotes: React.Dispatch<React.SetStateAction<SavedNote[]>>;
}

export interface NotesSyncResult {
  online: boolean;
  isSyncing: boolean;
  pendingCount: number;
  errorCount: number;
  lastSyncTime: Date | null;
  /** Refs for use by CRUD and Realtime hooks */
  userIdRef: React.MutableRefObject<string | null>;
  clinicIdRef: React.MutableRefObject<string | null>;
  initDone: React.MutableRefObject<boolean>;
  /** Refresh notes from IndexedDB into state */
  refreshNotes: (userId: string) => Promise<void>;
  /** Refresh clinic notes from server */
  refreshClinicNotes: (clinicId: string, excludeUserId?: string) => Promise<void>;
  /** Manually trigger a full sync */
  triggerSync: () => Promise<void>;
  /** Setters exposed so CRUD can update counts optimistically */
  setPendingCount: React.Dispatch<React.SetStateAction<number>>;
  setErrorCount: React.Dispatch<React.SetStateAction<number>>;
  /** Page visibility state (used by realtime hook) */
  isPageVisible: boolean;
  /** Realtime-ready state values */
  realtimeClinicId: string | null;
  realtimeUserId: string | null;
  realtimeAuthenticated: boolean;
  /** Auth version counter — exposed so the main hook can depend on it if needed */
  authVersion: number;
}

export function useNotesSync(deps: NotesSyncDeps): NotesSyncResult {
  const { setNotes, setClinicNotes } = deps;

  const [online, setOnline] = useState<boolean>(checkOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

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
        setErrorCount(0);
        setLastSyncTime(null);
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
  }, [setNotes, setClinicNotes]);

  /**
   * Refresh the notes list from IndexedDB and update pending count.
   */
  const refreshNotes = useCallback(async (userId: string) => {
    const localNotes = await getLocalNotes(userId);
    const savedNotes = localNotes.map((n) => notesApi.localNoteToSavedNote(n));
    // Sort newest first
    sortByNewest(savedNotes);
    setNotes(savedNotes);

    // Update pending and error counts
    const pending = savedNotes.filter((n) => n.sync_status === 'pending').length;
    setPendingCount(pending);
    const errors = savedNotes.filter((n) => n.sync_status === 'error').length;
    setErrorCount(errors);
  }, [setNotes]);

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
      sortByNewest(saved);
      setClinicNotes(saved);
    } catch (err) {
      logger.warn('Failed to fetch clinic notes:', err);
    }
  }, [setClinicNotes]);

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
          logger.info(`Migrated ${v1Migrated} v1 notes to v2 format`);
        }

        // 3. Migrate from localStorage (if any)
        await migrateFromLocalStorage(userId);

        if (cancelled) return;

        // 4. If authenticated and online, do initial sync
        if (userId !== 'guest' && checkOnline()) {
          try {
            setIsSyncing(true);

            // fullSync() handles reconciliation (pull) + push in one call.
            // reconcileWithServer() inside fullSync does the same last-write-wins
            // merge that was previously duplicated here.
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
            if (!cancelled) setLastSyncTime(new Date());
          } catch (err) {
            logger.warn('Initial sync failed, using local data:', err);
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
                setLastSyncTime(new Date());
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
        logger.error('Initialization failed:', err);
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

  return {
    online,
    isSyncing,
    pendingCount,
    errorCount,
    lastSyncTime,
    userIdRef,
    clinicIdRef,
    initDone,
    refreshNotes,
    refreshClinicNotes,
    triggerSync,
    setPendingCount,
    setErrorCount,
    isPageVisible,
    realtimeClinicId,
    realtimeUserId,
    realtimeAuthenticated,
    authVersion,
  };
}
