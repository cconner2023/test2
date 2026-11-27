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

import { useCallback, useEffect, useId, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { TrainingCompletionUI } from '../lib/trainingService';
import { useTrainingStore, acquireTraining } from '../stores/useTrainingStore';
import { useRealtimeTrainingCompletions } from './useRealtimeTrainingCompletions';
import { usePageVisibility } from './usePageVisibility';
import { useCalendarWrite } from './useCalendarWrite';
import { getTaskData } from '../Data/TrainingData';
import type { subjectAreaArray } from '../Types/CatTypes';

// Re-export TrainingCompletionUI so existing imports
// from './useTrainingCompletions' work without reaching into trainingService.
export type { TrainingCompletionUI } from '../lib/trainingService';

// ── Hook ─────────────────────────────────────────────────────

/**
 * Primary hook for training completion CRUD, offline-first IndexedDB persistence, and Supabase sync.
 * Provides read/test completion queries, progress tracking, and realtime cross-device updates.
 */
export function useTrainingCompletions() {
  const holderId = useId();
  const {
    userId,
    completions,
    viewedTasks,
    isSyncing,
    pendingCount,
    algorithmRunCounts,
    isOwner,
    refresh,
    markTaskCompleted,
    submitTestEvaluation,
    deleteCompletionInStore,
    assignTask,
    markTaskViewed,
  } = useTrainingStore(useShallow((s) => ({
    userId: s.userId,
    completions: s.completions,
    viewedTasks: s.viewedTasks,
    isSyncing: s.isSyncing,
    pendingCount: s.pendingCount,
    algorithmRunCounts: s.algorithmRunCounts,
    isOwner: s.holders[0] === holderId,
    refresh: s.refresh,
    markTaskCompleted: s.markTaskCompleted,
    submitTestEvaluation: s.submitTestEvaluation,
    deleteCompletionInStore: s.deleteCompletion,
    assignTask: s.assignTask,
    markTaskViewed: s.markTaskViewed,
  })));

  useEffect(() => acquireTraining(holderId), [holderId]);

  // Page visibility — pauses realtime channels when backgrounded
  const isPageVisible = usePageVisibility();

  // Calendar delete gate — used to cascade assignment deletion into the
  // linked calendar event before the training row is removed.
  const { deleteEvent: deleteCalendarEvent } = useCalendarWrite();

  // ── Catch-up refresh when page becomes visible ─────────────

  const prevVisibleRef = useRef(true);
  useEffect(() => {
    if (isOwner && isPageVisible && !prevVisibleRef.current) {
      void refresh();
    }
    prevVisibleRef.current = isPageVisible;
  }, [isOwner, isPageVisible, refresh]);

  // ── Query Operations ───────────────────────────────────────

  const isTaskCompleted = useCallback(
    (taskId: string): boolean => {
      return completions.some(
        (c) => c.trainingItemId === taskId && c.completionType === 'read'
      );
    },
    [completions]
  );

  /**
   * The most recent read of a task, or undefined if it has never been read.
   *
   * Reads stack one row per rep (see trainingFold), so "when did I last do this"
   * is a max over rows rather than a lookup — and it is the value a doctrine
   * refresh interval is measured from, which is why the reader shows the date
   * rather than a bare "Completed".
   */
  const getLastRead = useCallback(
    (taskId: string): TrainingCompletionUI | undefined => {
      let latest: TrainingCompletionUI | undefined;
      for (const c of completions) {
        if (c.trainingItemId !== taskId || c.completionType !== 'read') continue;
        const at = c.completedAt ?? c.updatedAt;
        if (!latest || at > (latest.completedAt ?? latest.updatedAt)) latest = c;
      }
      return latest;
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

  const deleteCompletion = useCallback(
    (completionId: string): void => deleteCompletionInStore(completionId, deleteCalendarEvent),
    [deleteCompletionInStore, deleteCalendarEvent]
  );

  // ── Viewed Tasks (Local-Only) ──────────────────────────────

  const isTaskViewed = useCallback(
    (taskId: string): boolean => {
      return viewedTasks.has(taskId);
    },
    [viewedTasks]
  );

  // ── Realtime: training completions subscription ────────────

  // Cross-device training events arrive as audit_log inserts. State is the event
  // fold (synthetic ids), so realtime can't mutate in place — it re-folds instead.
  const handleRealtimeChange = useCallback(() => {
    void refresh();
  }, [refresh]);

  const realtimeUserId = isOwner ? userId : null;
  useRealtimeTrainingCompletions({
    userId: realtimeUserId,
    isAuthenticated: !!realtimeUserId && realtimeUserId !== 'guest',
    isPageVisible,
    onChange: handleRealtimeChange,
  });

  return {
    completions,
    /** Logged runs per algorithm id for the current user, from raw events -
     *  the runs component of algorithm completion. Empty until the first fold
     *  load resolves. */
    algorithmRunCounts,
    isTaskCompleted,
    getLastRead,
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
