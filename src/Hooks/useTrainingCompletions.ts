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
  createReadCompletion,
  createTestCompletion,
  createAssignment,
  completeAssignment,
  deleteCompletion as deleteCompletionApi,
  enrichCalendarLinks,
  type TrainingCompletionUI,
} from '../lib/trainingService';
import { getAuditBySubjectLocal, fetchAuditBySubject } from '../lib/auditService';
import { foldTrainingState } from '../lib/trainingFold';
import {
  isOnline as checkOnline,
  setupConnectivityListeners,
  fullSync,
} from '../lib/syncService';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { useRealtimeTrainingCompletions } from './useRealtimeTrainingCompletions';
import { usePageVisibility } from './usePageVisibility';
import { useCalendarWrite } from './useCalendarWrite';
import { useCalendarStore } from '../stores/useCalendarStore';
import { getTaskData } from '../Data/TrainingData';
import { createLogger } from '../Utilities/Logger';
import type { CompletionResult } from '../Types/database.types';
import type { StepResult } from '../Types/SupervisorTestTypes';
import type { subjectAreaArray } from '../Types/CatTypes';

// Re-export TrainingCompletionUI so existing imports
// from './useTrainingCompletions' work without reaching into trainingService.
export type { TrainingCompletionUI } from '../lib/trainingService';

const logger = createLogger('TrainingCompletions');

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
    logger.info(
      `Migrated ${migrated} completed tasks from localStorage, ` +
        `${viewedTaskIds.size} viewed-only tasks tracked locally`
    );
  } catch (err) {
    logger.warn('Training progress migration failed:', err);
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
    logger.info(`Migrated ${migrated} supervisor tests from localStorage`);
  } catch (err) {
    logger.warn('Supervisor tests migration failed:', err);
  }

  return migrated;
}

// ── Shared initial-sync coordinator ──────────────────────────
// ~4 components mount useTrainingCompletions (TrainingPanel ×2, TrainingDrawer,
// SupervisorDrawer); each init() previously fired its own fullSync() network
// pull+push on mount → a training_completions GET fan-out (a top PostgREST
// egress source). fullSync is idempotent (last-write-wins reconcile + queue
// push), so the initial pull is shared here: concurrent mounts await ONE
// in-flight fullSync, and remounts within the TTL skip the network entirely and
// rely on the local IDB read + realtime + the connectivity-listener resync path.
let trainingInitSyncInflight: Promise<void> | null = null
let trainingInitSyncUser: string | null = null
let trainingInitSyncAt = 0
const TRAINING_INIT_SYNC_TTL_MS = 30_000

async function ensureInitialTrainingSync(userId: string): Promise<void> {
  if (trainingInitSyncInflight) return trainingInitSyncInflight
  if (trainingInitSyncUser === userId && Date.now() - trainingInitSyncAt < TRAINING_INIT_SYNC_TTL_MS) {
    return // synced for this user very recently — skip the redundant network round-trip
  }
  trainingInitSyncInflight = (async () => {
    try {
      await fullSync(userId)
    } finally {
      trainingInitSyncUser = userId
      trainingInitSyncAt = Date.now()
      trainingInitSyncInflight = null
    }
  })()
  return trainingInitSyncInflight
}

// ── Load the current-state completions from the audit_log event fold ──────────
// Offline-first: local IDB events + server (read_audit), deduped, training-only,
// folded into TrainingCompletionUI. training_completions is still dual-written and
// serves as a fallback (below) so a fold-fetch failure never blanks training.
async function loadFoldedCompletions(userId: string): Promise<TrainingCompletionUI[]> {
  const clinicId = useAuthStore.getState().clinicId;
  const [local, server] = await Promise.all([
    getAuditBySubjectLocal(userId).catch(() => []),
    clinicId ? fetchAuditBySubject(userId, { clinicId }).catch(() => []) : Promise.resolve([]),
  ]);
  const byId = new Map(([...local, ...server]).map((e) => [e.id, e]));
  const folded = foldTrainingState([...byId.values()].filter((e) => e.domain === 'training'));
  return enrichCalendarLinks(folded);
}

// ── Hook ─────────────────────────────────────────────────────

/**
 * Primary hook for training completion CRUD, offline-first IndexedDB persistence, and Supabase sync.
 * Provides read/test completion queries, progress tracking, and realtime cross-device updates.
 */
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

  // Page visibility — pauses realtime channels when backgrounded
  const isPageVisible = usePageVisibility();

  // Calendar delete gate — used to cascade assignment deletion into the
  // linked calendar event before the training row is removed.
  const { deleteEvent: deleteCalendarEvent } = useCalendarWrite();

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
    // Read current state from the audit_log event fold. The fold's loaders
    // read-through-cache server events into local IDB, so it is offline-complete;
    // the legacy training_completions union has been retired (fold verified).
    let items: TrainingCompletionUI[] = [];
    try {
      items = await loadFoldedCompletions(userId);
    } catch (err) {
      logger.warn('Fold load failed:', err);
    }
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
        const user = useAuthStore.getState().user;
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

            // fullSync() handles reconciliation (pull) + push in one call.
            // reconcileTrainingCompletionsWithServer() inside fullSync does the
            // same last-write-wins merge that was previously duplicated here.
            // Deduped across concurrent mounts via the shared coordinator so N
            // consumers don't each fire their own pull on mount.
            await ensureInitialTrainingSync(userId);
          } catch (err) {
            logger.warn('Initial sync failed, using local data:', err);
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
  }, [refreshCompletions, authVersion]);

  // ── Catch-up refresh when page becomes visible ─────────────

  const prevVisibleRef = useRef(true);
  useEffect(() => {
    if (isPageVisible && !prevVisibleRef.current && initDone.current) {
      const userId = userIdRef.current;
      if (userId && userId !== 'guest') {
        refreshCompletions(userId);
      }
    }
    prevVisibleRef.current = isPageVisible;
  }, [isPageVisible, refreshCompletions]);

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

  // ── Assignment Queries ─────────────────────────────────────

  const getAssignments = useCallback(
    (): TrainingCompletionUI[] => {
      return completions.filter((c) => c.completionType === 'assignment');
    },
    [completions]
  );

  const getPendingAssignments = useCallback(
    (): TrainingCompletionUI[] => {
      return completions.filter(
        (c) => c.completionType === 'assignment' && !c.completedAt
      );
    },
    [completions]
  );

  const getOverdueAssignments = useCallback(
    (): TrainingCompletionUI[] => {
      const now = new Date();
      return completions.filter(
        (c) =>
          c.completionType === 'assignment' &&
          !c.completedAt &&
          c.dueDate &&
          new Date(c.dueDate) < now
      );
    },
    [completions]
  );

  const isTaskAssigned = useCallback(
    (taskId: string): boolean => {
      return completions.some(
        (c) => c.trainingItemId === taskId && c.completionType === 'assignment'
      );
    },
    [completions]
  );

  const getAssignment = useCallback(
    (taskId: string): TrainingCompletionUI | undefined => {
      return completions.find(
        (c) => c.trainingItemId === taskId && c.completionType === 'assignment'
      );
    },
    [completions]
  );

  // ── Mutation Operations ────────────────────────────────────

  const markTaskCompleted = useCallback(
    (taskId: string): void => {
      const userId = userIdRef.current;
      if (!userId) return;

      // Check if an assignment exists for this task — complete it instead of creating new
      const existingAssignment = completions.find(
        (c) => c.trainingItemId === taskId && c.completionType === 'assignment' && !c.completedAt
      );

      if (existingAssignment) {
        // Optimistic: update the assignment in-place
        const optimistic: TrainingCompletionUI = {
          ...existingAssignment,
          completionType: 'read',
          result: 'GO',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending',
        };
        setCompletions((prev) =>
          prev.map((c) => (c.id === existingAssignment.id ? optimistic : c))
        );

        completeAssignment({
          completionId: existingAssignment.id,
          medicUserId: userId,
          completionType: 'read',
          result: 'GO',
          supervisorId: existingAssignment.supervisorId || userId,
        })
          .then((saved) => {
            setCompletions((prev) =>
              prev.map((c) => (c.id === existingAssignment.id ? saved : c))
            );
          })
          .catch((err) => {
            logger.error('Complete assignment failed:', err);
            refreshCompletions(userId);
          });
        return;
      }

      // Standard path: create a new read completion
      const optimisticCompletion: TrainingCompletionUI = {
        id: crypto.randomUUID(),
        userId,
        trainingItemId: taskId,
        completionType: 'read',
        result: 'GO',
        supervisorId: null,
        stepResults: null,
        supervisorNotes: null,
        dueDate: null,
        calendarOriginId: null,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: userId === 'guest' ? 'synced' : 'pending',
      };

      setCompletions((prev) => [optimisticCompletion, ...prev]);
      if (userId !== 'guest') {
        setPendingCount((prev) => prev + 1);
      }

      createReadCompletion(taskId, userId)
        .then((saved) => {
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
          logger.error('Create read completion failed:', err);
          refreshCompletions(userId);
        });
    },
    [refreshCompletions, completions]
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

      // Optimistically remove from UI (id is a synthetic fold id).
      setCompletions((prev) => prev.filter((c) => c.id !== completionId));

      // Linked to a calendar event? cascade through the calendar delete gate —
      // it fan-outs 'd' and cascades back via deleteCompletionsByCalendarOriginId
      // (which voids the linked completions). calendarOriginId is populated on the
      // fold rows by enrichCalendarLinks from the link projection.
      const target = completions.find((c) => c.id === completionId);
      if (target?.calendarOriginId) {
        const event = useCalendarStore
          .getState()
          .events.find((e) => e.originId === target.calendarOriginId);
        if (event) {
          deleteCalendarEvent(event.id).catch((err) => {
            logger.error('Cascade calendar delete failed:', err);
            refreshCompletions(userId);
          });
          return;
        }
      }

      // No linked event: event-source the delete (emit completion.voided + drop link).
      deleteCompletionApi(completionId, userId)
        .then(() => refreshCompletions(userId))
        .catch((err) => {
          logger.error('Delete completion failed:', err);
          refreshCompletions(userId);
        });
    },
    [refreshCompletions, completions, deleteCalendarEvent]
  );

  const assignTask = useCallback(
    async (params: {
      medicUserId: string;
      trainingItemId: string;
      dueDate: string;
      notes?: string;
    }): Promise<TrainingCompletionUI | null> => {
      const userId = userIdRef.current;
      if (!userId) return null;

      const saved = await createAssignment({
        medicUserId: params.medicUserId,
        trainingItemId: params.trainingItemId,
        supervisorId: userId,
        dueDate: params.dueDate,
        supervisorNotes: params.notes,
      });

      setCompletions((prev) => [saved, ...prev]);
      if (saved.syncStatus === 'pending') {
        setPendingCount((prev) => prev + 1);
      }

      return saved;
    },
    []
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

  // Cross-device training events arrive as audit_log inserts. State is the event
  // fold (synthetic ids), so realtime can't mutate in place — it re-folds instead.
  const handleRealtimeChange = useCallback(() => {
    const userId = userIdRef.current;
    if (userId && userId !== 'guest') void refreshCompletions(userId);
  }, [refreshCompletions]);

  useRealtimeTrainingCompletions({
    userId: realtimeUserId,
    isAuthenticated: realtimeAuthenticated,
    isPageVisible,
    onChange: handleRealtimeChange,
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
    // Assignment queries
    getAssignments,
    getPendingAssignments,
    getOverdueAssignments,
    isTaskAssigned,
    getAssignment,
    // Assignment mutation
    assignTask,
    /** Whether a sync operation is currently in progress. */
    isSyncing,
    /** Number of completions with syncStatus === 'pending'. */
    pendingCount,
  };
}
