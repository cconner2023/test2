/**
 * useTrainingCompletions -- Primary hook for training completion CRUD and offline sync.
 *
 * This hook provides the interface between the React UI and the
 * offline-first training completions infrastructure:
 *   - IndexedDB (offlineDb.ts) for local persistence
 *   - Sync queue (offlineDb.ts) for pending mutations
 *   - Sync service (syncService.ts) for push/pull with Supabase
 *   - Training service (trainingService.ts) for CRUD operations
 *
 * It exposes:
 *   - `completions`: TrainingCompletionUI[] with syncStatus for badge display
 *   - `isTaskCompleted`: check if a read completion exists for a task
 *   - `getTestResult`: get the test completion for a task
 *   - `getSubjectAreaProgress`: viewed/completed/total counts for a subject area
 *   - `markTaskCompleted`, `submitTestEvaluation`, `deleteCompletion`: CRUD
 *   - `isTaskViewed`, `markTaskViewed`: lightweight local state (not synced)
 *   - `isSyncing`, `pendingCount`: sync status indicators
 *
 * IMPORTANT: All writes go to IndexedDB first. If online, an
 * immediate sync to Supabase is attempted. If offline, the change
 * is queued and will sync when connectivity returns.
 *
 * Also handles migration from the old localStorage-based hooks
 * (useTrainingProgress and useSupervisorTests) to the new
 * IndexedDB + Supabase system.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getCompletions,
  createReadCompletion,
  createTestCompletion,
  deleteCompletion as deleteCompletionApi,
  fetchCompletionsFromServer,
  type TrainingCompletionUI,
} from '../lib/trainingService';
import {
  getLocalTrainingCompletions,
  saveLocalTrainingCompletion,
} from '../lib/offlineDb';
import {
  isOnline as checkOnline,
  setupConnectivityListeners,
  fullSync,
} from '../lib/syncService';
import { supabase } from '../lib/supabase';
import { useRealtimeTrainingCompletions } from './useRealtimeTrainingCompletions';
import { getTaskData } from '../Data/TrainingData';
import type { CompletionResult } from '../Types/database.types';
import type { StepResult } from '../Types/SupervisorTestTypes';
import type { subjectAreaArray } from '../Types/CatTypes';

// Re-export TrainingCompletionUI so existing imports
// from './useTrainingCompletions' work without reaching into trainingService.
export type { TrainingCompletionUI } from '../lib/trainingService';

// ── localStorage Keys for Migration ──────────────────────────

const TRAINING_PROGRESS_KEY = 'adtmc_training_progress';
const SUPERVISOR_TESTS_KEY = 'adtmc_supervisor_tests';

// ── Migration Helpers ────────────────────────────────────────

interface OldTaskProgress {
  lastViewedAt: string;
  lastStepIndex: number;
  completed: boolean;
}

interface OldTrainingProgress {
  viewedTasks: Record<string, OldTaskProgress>;
}

interface OldSupervisorTestRecord {
  id: string;
  supervisorId: string;
  medicId: string;
  taskNumber: string;
  stepResults: StepResult[];
  overallResult: 'PASS' | 'FAIL';
  testDate: string;
  notes?: string;
}

interface OldSupervisorTestsData {
  tests: OldSupervisorTestRecord[];
}

/**
 * Migrate training progress from localStorage to the new IndexedDB-backed system.
 *
 * For each entry in `viewedTasks`:
 *   - If `completed: true`, creates a read completion via createReadCompletion().
 *   - If `completed: false` (viewed but not completed), adds to the local
 *     viewedTasks set (lightweight, not synced).
 *
 * After migration, the localStorage key is removed.
 */
async function migrateTrainingProgress(
  userId: string
): Promise<{ viewedTaskIds: Set<string>; migrated: number }> {
  const viewedTaskIds = new Set<string>();
  let migrated = 0;

  try {
    const raw = localStorage.getItem(TRAINING_PROGRESS_KEY);
    if (!raw) return { viewedTaskIds, migrated };

    const parsed: OldTrainingProgress = JSON.parse(raw);
    if (typeof parsed?.viewedTasks !== 'object') {
      localStorage.removeItem(TRAINING_PROGRESS_KEY);
      return { viewedTaskIds, migrated };
    }

    for (const [taskId, progress] of Object.entries(parsed.viewedTasks)) {
      if (progress.completed) {
        // Create a read completion for completed tasks
        await createReadCompletion(taskId, userId);
        migrated++;
      } else {
        // Just viewed, not completed -- track locally only
        viewedTaskIds.add(taskId);
      }
    }

    localStorage.removeItem(TRAINING_PROGRESS_KEY);
    console.log(
      `[TrainingCompletions] Migrated ${migrated} completed tasks from localStorage, ` +
        `${viewedTaskIds.size} viewed-only tasks tracked locally`
    );
  } catch (err) {
    console.warn('[TrainingCompletions] Training progress migration failed:', err);
  }

  return { viewedTaskIds, migrated };
}

/**
 * Migrate supervisor tests from localStorage to the new IndexedDB-backed system.
 *
 * For each test record, creates a test completion via createTestCompletion().
 * After migration, the localStorage key is removed.
 */
async function migrateSupervisorTests(userId: string): Promise<number> {
  let migrated = 0;

  try {
    const raw = localStorage.getItem(SUPERVISOR_TESTS_KEY);
    if (!raw) return 0;

    const parsed: OldSupervisorTestsData = JSON.parse(raw);
    if (!Array.isArray(parsed?.tests) || parsed.tests.length === 0) {
      localStorage.removeItem(SUPERVISOR_TESTS_KEY);
      return 0;
    }

    for (const test of parsed.tests) {
      await createTestCompletion({
        medicUserId: test.medicId,
        trainingItemId: test.taskNumber,
        result: test.overallResult === 'PASS' ? 'GO' : 'NO_GO',
        stepResults: test.stepResults,
        supervisorNotes: test.notes,
        supervisorId: test.supervisorId || userId,
      });
      migrated++;
    }

    localStorage.removeItem(SUPERVISOR_TESTS_KEY);
    console.log(`[TrainingCompletions] Migrated ${migrated} supervisor tests from localStorage`);
  } catch (err) {
    console.warn('[TrainingCompletions] Supervisor tests migration failed:', err);
  }

  return migrated;
}

// ── Hook ─────────────────────────────────────────────────────

export function useTrainingCompletions() {
  const [completions, setCompletions] = useState<TrainingCompletionUI[]>([]);
  const [viewedTasks, setViewedTasks] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const userIdRef = useRef<string | null>(null);
  const initDone = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // State copies for the Realtime hook
  const [realtimeUserId, setRealtimeUserId] = useState<string | null>(null);
  const [realtimeAuthenticated, setRealtimeAuthenticated] = useState(false);

  // Auth version counter — incremented on SIGNED_IN / SIGNED_OUT to
  // trigger the init effect to re-run with the new user context.
  const [authVersion, setAuthVersion] = useState(0);

  // ── Auth state tracking — re-init on login/logout ─────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCompletions([]);
        setViewedTasks(new Set());
        setPendingCount(0);
        setRealtimeUserId(null);
        setRealtimeAuthenticated(false);
        userIdRef.current = null;
        initDone.current = false;
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setAuthVersion((v) => v + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Refresh the completions list from IndexedDB and update pending count.
   */
  const refreshCompletions = useCallback(async (userId: string) => {
    const items = await getCompletions(userId);
    // Sort newest first
    items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setCompletions(items);

    // Update pending count
    const pending = items.filter((c) => c.syncStatus === 'pending').length;
    setPendingCount(pending);
  }, []);

  // ── Initialization ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Determine user context
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const userId = user?.id || 'guest';
        userIdRef.current = userId;
        setRealtimeUserId(userId);
        setRealtimeAuthenticated(userId !== 'guest');

        if (cancelled) return;

        // 2. Migrate from localStorage (training progress + supervisor tests)
        const { viewedTaskIds } = await migrateTrainingProgress(userId);
        if (viewedTaskIds.size > 0 && !cancelled) {
          setViewedTasks(viewedTaskIds);
        }

        await migrateSupervisorTests(userId);

        if (cancelled) return;

        // 3. If authenticated and online, do initial sync
        if (userId !== 'guest' && checkOnline()) {
          try {
            setIsSyncing(true);
            const serverCompletions = await fetchCompletionsFromServer(userId);

            if (cancelled) return;

            // Merge server completions into IndexedDB
            const existingLocal = await getLocalTrainingCompletions(userId);
            const localMap = new Map(existingLocal.map((c) => [c.id, c]));

            for (const serverCompletion of serverCompletions) {
              const local = localMap.get(serverCompletion.id);
              if (!local) {
                // Server-only completion -- pull into IndexedDB
                await saveLocalTrainingCompletion(serverCompletion);
              } else if (local._sync_status !== 'pending') {
                // Both exist, local is not pending -- update from server
                const serverTime = new Date(serverCompletion.updated_at).getTime();
                const localTime = new Date(local.updated_at).getTime();
                if (serverTime >= localTime) {
                  await saveLocalTrainingCompletion(serverCompletion);
                }
              }
              // If local is pending, keep it -- it will be pushed to server
            }

            // Push any pending local changes to server
            await fullSync(userId);
          } catch (err) {
            console.warn('[TrainingCompletions] Initial sync failed, using local data:', err);
          } finally {
            if (!cancelled) setIsSyncing(false);
          }
        }

        if (cancelled) return;

        // 4. Load completions from IndexedDB into state
        await refreshCompletions(userId);

        // 5. Set up connectivity listeners for automatic sync
        if (userId !== 'guest') {
          cleanupRef.current = setupConnectivityListeners(userId, {
            onStatusChange: () => {
              // Online status tracked by the browser events useEffect below
            },
            onSyncStart: () => {
              if (!cancelled) setIsSyncing(true);
            },
            onSyncComplete: () => {
              if (!cancelled) {
                setIsSyncing(false);
                refreshCompletions(userId);
              }
            },
            onReconcileComplete: () => {
              if (!cancelled) {
                refreshCompletions(userId);
              }
            },
            onTrainingReconcileComplete: () => {
              if (!cancelled) {
                refreshCompletions(userId);
              }
            },
          });
        }

        initDone.current = true;
      } catch (err) {
        console.error('[TrainingCompletions] Initialization failed:', err);
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
  }, [refreshCompletions, authVersion]);

  // ── Query Operations ───────────────────────────────────────

  const isTaskCompleted = useCallback(
    (taskId: string): boolean => {
      return completions.some(
        (c) => c.trainingItemId === taskId && c.completionType === 'read'
      );
    },
    [completions]
  );

  const getTestResult = useCallback(
    (taskId: string): TrainingCompletionUI | undefined => {
      return completions.find(
        (c) => c.trainingItemId === taskId && c.completionType === 'test'
      );
    },
    [completions]
  );

  const getSubjectAreaProgress = useCallback(
    (area: subjectAreaArray): { viewed: number; completed: number; total: number } => {
      const tasks = area.options;
      let viewed = 0;
      let completed = 0;
      let total = 0;

      for (const task of tasks) {
        const hasData = !!getTaskData(task.icon);
        if (!hasData) continue;
        total++;

        // Check if the task has a read completion
        const hasReadCompletion = completions.some(
          (c) => c.trainingItemId === task.icon && c.completionType === 'read'
        );
        if (hasReadCompletion) {
          completed++;
          viewed++;
        } else if (viewedTasks.has(task.icon)) {
          viewed++;
        }
      }

      return { viewed, completed, total };
    },
    [completions, viewedTasks]
  );

  // ── Mutation Operations ────────────────────────────────────

  const markTaskCompleted = useCallback(
    (taskId: string): void => {
      const userId = userIdRef.current;
      if (!userId) return;

      // Optimistic update: add a placeholder completion to state
      const optimisticCompletion: TrainingCompletionUI = {
        id: crypto.randomUUID(),
        userId,
        trainingItemId: taskId,
        completionType: 'read',
        result: 'GO',
        supervisorId: null,
        stepResults: null,
        supervisorNotes: null,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: userId === 'guest' ? 'synced' : 'pending',
      };

      setCompletions((prev) => [optimisticCompletion, ...prev]);
      if (userId !== 'guest') {
        setPendingCount((prev) => prev + 1);
      }

      // Persist asynchronously
      createReadCompletion(taskId, userId)
        .then((saved) => {
          // Replace optimistic entry with the persisted version
          setCompletions((prev) =>
            prev.map((c) =>
              c.id === optimisticCompletion.id ? saved : c
            )
          );
          if (saved.syncStatus === 'synced' && userId !== 'guest') {
            setPendingCount((prev) => Math.max(0, prev - 1));
          }
        })
        .catch((err) => {
          console.error('[TrainingCompletions] Create read completion failed:', err);
          refreshCompletions(userId);
        });
    },
    [refreshCompletions]
  );

  const submitTestEvaluation = useCallback(
    async (params: {
      medicUserId: string;
      trainingItemId: string;
      result: CompletionResult;
      stepResults: StepResult[];
      supervisorNotes?: string;
    }): Promise<void> => {
      const userId = userIdRef.current;
      if (!userId) return;

      const saved = await createTestCompletion({
        ...params,
        supervisorId: userId,
      });

      // Add to state
      setCompletions((prev) => [saved, ...prev]);
      if (saved.syncStatus === 'pending') {
        setPendingCount((prev) => prev + 1);
      }
    },
    []
  );

  const deleteCompletion = useCallback(
    (completionId: string): void => {
      const userId = userIdRef.current;
      if (!userId) return;

      // Optimistically remove from UI
      setCompletions((prev) => prev.filter((c) => c.id !== completionId));

      // Hard-delete from IndexedDB + queue sync for Supabase deletion
      deleteCompletionApi(completionId, userId).catch((err) => {
        console.error('[TrainingCompletions] Delete completion failed:', err);
        refreshCompletions(userId);
      });
    },
    [refreshCompletions]
  );

  // ── Viewed Tasks (Local-Only) ──────────────────────────────

  const isTaskViewed = useCallback(
    (taskId: string): boolean => {
      return viewedTasks.has(taskId);
    },
    [viewedTasks]
  );

  const markTaskViewed = useCallback((taskId: string): void => {
    setViewedTasks((prev) => {
      if (prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  }, []);

  // ── Realtime: training completions subscription ────────────

  const handleRealtimeUpsert = useCallback((completion: TrainingCompletionUI) => {
    setCompletions((prev) => {
      const idx = prev.findIndex((c) => c.id === completion.id);
      if (idx >= 0) {
        const existing = prev[idx];
        const existingTime = new Date(existing.createdAt).getTime();
        const incomingTime = new Date(completion.createdAt).getTime();
        if (incomingTime >= existingTime) {
          const next = [...prev];
          next[idx] = completion;
          return next;
        }
        return prev;
      }
      return [completion, ...prev].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    // Persist to IndexedDB so the completion survives tab close / refresh
    const userId = userIdRef.current;
    if (userId && userId !== 'guest') {
      saveLocalTrainingCompletion({
        id: completion.id,
        user_id: completion.userId,
        training_item_id: completion.trainingItemId,
        completed: true,
        completed_at: completion.completedAt,
        completion_type: completion.completionType,
        result: completion.result,
        supervisor_id: completion.supervisorId,
        step_results: completion.stepResults as unknown as null,
        supervisor_notes: completion.supervisorNotes,
        created_at: completion.createdAt,
        updated_at: completion.updatedAt,
        _sync_status: 'synced',
        _sync_retry_count: 0,
        _last_sync_error: null,
        _last_sync_error_message: null,
      }).catch((err) => {
        console.warn('[TrainingCompletions] Failed to persist realtime completion to IndexedDB:', err);
      });
    }
  }, []);

  const handleRealtimeDelete = useCallback((completionId: string) => {
    setCompletions((prev) => prev.filter((c) => c.id !== completionId));

    // Also remove from IndexedDB
    import('../lib/offlineDb').then(({ hardDeleteLocalTrainingCompletion }) => {
      hardDeleteLocalTrainingCompletion(completionId).catch((err) => {
        console.warn(
          '[TrainingCompletions] Failed to delete realtime completion from IndexedDB:',
          err
        );
      });
    });
  }, []);

  useRealtimeTrainingCompletions({
    userId: realtimeUserId,
    isAuthenticated: realtimeAuthenticated,
    onUpsert: handleRealtimeUpsert,
    onDelete: handleRealtimeDelete,
  });

  return {
    completions,
    isTaskCompleted,
    getTestResult,
    getSubjectAreaProgress,
    markTaskCompleted,
    submitTestEvaluation,
    deleteCompletion,
    isTaskViewed,
    markTaskViewed,
    /** Whether a sync operation is currently in progress. */
    isSyncing,
    /** Number of completions with syncStatus === 'pending'. */
    pendingCount,
  };
}
