import { create } from 'zustand'
import {
  createReadCompletion,
  createTestCompletion,
  createAssignment,
  completeAssignment,
  deleteCompletion as deleteCompletionApi,
  enrichCalendarLinks,
  type TrainingCompletionUI,
} from '../lib/trainingService'
import { loadAuditBySubject } from '../lib/auditService'
import { foldTrainingState, liveTrainingEvents } from '../lib/trainingFold'
import { countAlgorithmRuns } from '../Utilities/algorithmStp'
import {
  isOnline as checkOnline,
  setupConnectivityListeners,
  fullSync,
} from '../lib/syncService'
import { useAuthStore } from './useAuthStore'
import { useCalendarStore } from './useCalendarStore'
import { createLogger } from '../Utilities/Logger'
import { succeed, fail, type ServiceResult } from '../lib/result'
import type { CompletionResult } from '../Types/database.types'
import type { StepResult } from '../Types/SupervisorTestTypes'

const logger = createLogger('TrainingCompletions')

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
        // Create a read completion for completed tasks. A refused emit skips the
        // entry rather than aborting the loop — the remaining tasks are still
        // migratable, and the localStorage key is only dropped once, below.
        const res = await createReadCompletion(taskId, userId);
        if (res.success) migrated++;
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
      const res = await createTestCompletion({
        medicUserId: test.medicId,
        trainingItemId: test.taskNumber,
        result: test.overallResult === 'PASS' ? 'GO' : 'NO_GO',
        stepResults: test.stepResults,
        supervisorNotes: test.notes,
        supervisorId: test.supervisorId || userId,
      });
      if (res.success) migrated++;
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
async function loadFoldedCompletions(
  userId: string,
): Promise<{ completions: TrainingCompletionUI[]; runCounts: Map<string, number> }> {
  // Active clinic, matching what emitTrainingEvent now stamps — a supervisor
  // toggled into a loaned cluster reads back the events they just wrote there.
  const { clinicId, supervisingClinicId } = useAuthStore.getState();
  const activeClinicId = supervisingClinicId ?? clinicId;
  const events = await loadAuditBySubject(userId, activeClinicId ?? '');
  const training = events.filter((e) => e.domain === 'training');
  // Run counts come off the SAME deduped raw set, BEFORE the fold collapses
  // repeat reads. No second fetch, and it is the only way the self surface can
  // see occurrence totals rather than a boolean 'has read this'. Voided events
  // come out first — the fold takes the raw set because it reads the tombstones,
  // a count must not (see liveTrainingEvents).
  return {
    completions: await enrichCalendarLinks(foldTrainingState(training)),
    runCounts: countAlgorithmRuns(liveTrainingEvents(training), userId),
  };
}

interface TrainingState {
  userId: string | null
  completions: TrainingCompletionUI[]
  viewedTasks: Set<string>
  isSyncing: boolean
  pendingCount: number
  algorithmRunCounts: Map<string, number>
  holders: string[]
  refresh: () => Promise<void>
  markTaskCompleted: (taskId: string) => void
  submitTestEvaluation: (params: {
    medicUserId: string
    trainingItemId: string
    result: CompletionResult
    stepResults: StepResult[]
    supervisorNotes?: string
  }) => Promise<ServiceResult>
  deleteCompletion: (completionId: string, deleteCalendarEvent: (eventId: string) => Promise<unknown>) => void
  assignTask: (params: {
    medicUserId: string
    trainingItemId: string
    dueDate: string
    notes?: string
  }) => Promise<TrainingCompletionUI | null>
  markTaskViewed: (taskId: string) => void
}

const initialData = () => ({
  userId: null as string | null,
  completions: [] as TrainingCompletionUI[],
  viewedTasks: new Set<string>(),
  isSyncing: false,
  pendingCount: 0,
  algorithmRunCounts: new Map<string, number>(),
})

async function refreshCompletionsFor(userId: string): Promise<void> {
  let items: TrainingCompletionUI[] = []
  let runCounts: Map<string, number> | null = null
  try {
    const loaded = await loadFoldedCompletions(userId)
    items = loaded.completions
    runCounts = loaded.runCounts
  } catch (err) {
    logger.warn('Fold load failed:', err)
  }
  if (useTrainingStore.getState().userId !== userId) return
  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const pending = items.filter((c) => c.syncStatus === 'pending').length
  useTrainingStore.setState({
    completions: items,
    pendingCount: pending,
    ...(runCounts && { algorithmRunCounts: runCounts }),
  })
}

export const useTrainingStore = create<TrainingState>()((set, get) => ({
  ...initialData(),
  holders: [],

  refresh: async () => {
    const userId = get().userId
    if (userId && userId !== 'guest') await refreshCompletionsFor(userId)
  },

  markTaskCompleted: (taskId) => {
    const userId = get().userId
    if (!userId) return

    const existingAssignment = get().completions.find(
      (c) => c.trainingItemId === taskId && c.completionType === 'assignment' && !c.completedAt
    )

    if (existingAssignment) {
      const optimistic: TrainingCompletionUI = {
        ...existingAssignment,
        completionType: 'read',
        result: 'GO',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      }
      set((s) => ({ completions: s.completions.map((c) => (c.id === existingAssignment.id ? optimistic : c)) }))

      completeAssignment({
        completionId: existingAssignment.id,
        medicUserId: userId,
        completionType: 'read',
        result: 'GO',
        supervisorId: existingAssignment.supervisorId || userId,
      })
        .then((res) => {
          if (get().userId !== userId) return
          if (!res.success) {
            // Put the assignment back. The optimistic row said "done" against
            // an event that was refused, and a refold would have restored the
            // pending assignment anyway — do it now rather than a tick later.
            logger.error('Complete assignment failed:', res.error)
            set((s) => ({ completions: s.completions.map((c) => (c.id === existingAssignment.id ? existingAssignment : c)) }))
            return
          }
          set((s) => ({ completions: s.completions.map((c) => (c.id === existingAssignment.id ? res.completion : c)) }))
        })
        .catch((err) => {
          logger.error('Complete assignment failed:', err)
          void refreshCompletionsFor(userId)
        })
      return
    }

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
    }

    set((s) => ({
      completions: [optimisticCompletion, ...s.completions],
      pendingCount: userId !== 'guest' ? s.pendingCount + 1 : s.pendingCount,
    }))

    createReadCompletion(taskId, userId)
      .then((res) => {
        if (get().userId !== userId) return
        if (!res.success) {
          // Drop the optimistic row — nothing was recorded, and leaving it up
          // shows a completion that vanishes on the next refold with no
          // explanation. Same reason the evaluator keeps its pane open.
          logger.error('Create read completion failed:', res.error)
          set((s) => ({
            completions: s.completions.filter((c) => c.id !== optimisticCompletion.id),
            pendingCount: userId !== 'guest' ? Math.max(0, s.pendingCount - 1) : s.pendingCount,
          }))
          return
        }
        set((s) => ({
          completions: s.completions.map((c) => (c.id === optimisticCompletion.id ? res.completion : c)),
          pendingCount: res.completion.syncStatus === 'synced' && userId !== 'guest'
            ? Math.max(0, s.pendingCount - 1)
            : s.pendingCount,
        }))
      })
      .catch((err) => {
        logger.error('Create read completion failed:', err)
        void refreshCompletionsFor(userId)
      })
  },

  submitTestEvaluation: async (params) => {
    const userId = get().userId
    if (!userId) return fail('Not signed in — the grade was not recorded.')

    const res = await createTestCompletion({
      ...params,
      supervisorId: userId,
    })
    if (!res.success) {
      logger.error('Submit test evaluation failed:', res.error)
      return res
    }
    if (get().userId === userId) {
      set((s) => ({
        completions: [res.completion, ...s.completions],
        pendingCount: res.completion.syncStatus === 'pending' ? s.pendingCount + 1 : s.pendingCount,
      }))
    }
    return succeed()
  },

  deleteCompletion: (completionId, deleteCalendarEvent) => {
    const userId = get().userId
    if (!userId) return

    const target = get().completions.find((c) => c.id === completionId)
    set((s) => ({ completions: s.completions.filter((c) => c.id !== completionId) }))

    // Linked to a calendar event? cascade through the calendar delete gate —
    // it fan-outs 'd' and cascades back via deleteCompletionsByCalendarOriginId
    // (which voids the linked completions). calendarOriginId is populated on the
    // fold rows by enrichCalendarLinks from the link projection.
    if (target?.calendarOriginId) {
      const event = useCalendarStore
        .getState()
        .events.find((e) => e.originId === target.calendarOriginId)
      if (event) {
        deleteCalendarEvent(event.id).catch((err) => {
          logger.error('Cascade calendar delete failed:', err)
          void refreshCompletionsFor(userId)
        })
        return
      }
    }

    // No linked event: event-source the delete (emit completion.voided + drop link).
    // Refresh either way — on a refused void it is what puts the row back.
    deleteCompletionApi(completionId, userId)
      .then((res) => {
        if (!res.success) logger.error('Delete completion failed:', res.error)
        void refreshCompletionsFor(userId)
      })
      .catch((err) => {
        logger.error('Delete completion failed:', err)
        void refreshCompletionsFor(userId)
      })
  },

  assignTask: async (params) => {
    const userId = get().userId
    if (!userId) return null

    const res = await createAssignment({
      medicUserId: params.medicUserId,
      trainingItemId: params.trainingItemId,
      supervisorId: userId,
      dueDate: params.dueDate,
      supervisorNotes: params.notes,
    })
    if (!res.success) {
      logger.error('Assign task failed:', res.error)
      return null
    }
    if (get().userId === userId) {
      set((s) => ({
        completions: [res.completion, ...s.completions],
        pendingCount: res.completion.syncStatus === 'pending' ? s.pendingCount + 1 : s.pendingCount,
      }))
    }
    return res.completion
  },

  markTaskViewed: (taskId) => {
    set((s) => {
      if (s.viewedTasks.has(taskId)) return s
      const next = new Set(s.viewedTasks)
      next.add(taskId)
      return { viewedTasks: next }
    })
  },
}))

const currentUserKey = (): string => useAuthStore.getState().user?.id || 'guest'

let activeHolders = 0
let initGen = 0
let connectivityCleanup: (() => void) | null = null

function stopConnectivity(): void {
  if (connectivityCleanup) {
    connectivityCleanup()
    connectivityCleanup = null
  }
}

async function initFor(userId: string): Promise<void> {
  const gen = ++initGen
  const cancelled = () => gen !== initGen
  stopConnectivity()
  try {
    useTrainingStore.setState({ userId })

    const { viewedTaskIds } = await migrateTrainingProgress(userId)
    if (cancelled()) return
    if (viewedTaskIds.size > 0) useTrainingStore.setState({ viewedTasks: viewedTaskIds })

    await migrateSupervisorTests(userId)
    if (cancelled()) return

    if (userId !== 'guest' && checkOnline()) {
      try {
        useTrainingStore.setState({ isSyncing: true })
        await ensureInitialTrainingSync(userId)
      } catch (err) {
        logger.warn('Initial sync failed, using local data:', err)
      } finally {
        if (!cancelled()) useTrainingStore.setState({ isSyncing: false })
      }
    }
    if (cancelled()) return

    await refreshCompletionsFor(userId)
    if (cancelled()) return

    if (userId !== 'guest') {
      connectivityCleanup = setupConnectivityListeners(userId, {
        onSyncStart: () => {
          if (!cancelled()) useTrainingStore.setState({ isSyncing: true })
        },
        onSyncComplete: () => {
          if (cancelled()) return
          useTrainingStore.setState({ isSyncing: false })
          void refreshCompletionsFor(userId)
        },
        onTrainingReconcileComplete: () => {
          if (!cancelled()) void refreshCompletionsFor(userId)
        },
      })
    }
  } catch (err) {
    logger.error('Initialization failed:', err)
  }
}

export function resetTrainingStore(): void {
  initGen++
  stopConnectivity()
  useTrainingStore.setState(initialData())
  if (activeHolders > 0) void initFor(currentUserKey())
}

export function acquireTraining(holderId: string): () => void {
  activeHolders += 1
  useTrainingStore.setState((s) => ({ holders: [...s.holders, holderId] }))
  if (activeHolders === 1) {
    const key = currentUserKey()
    if (useTrainingStore.getState().userId !== key) useTrainingStore.setState(initialData())
    void initFor(key)
  }
  return () => {
    activeHolders -= 1
    useTrainingStore.setState((s) => ({ holders: s.holders.filter((h) => h !== holderId) }))
    if (activeHolders === 0) {
      initGen++
      stopConnectivity()
    }
  }
}

queueMicrotask(() => {
  let lastKey = currentUserKey()
  useAuthStore.subscribe((s) => {
    const key = s.user?.id || 'guest'
    if (key === lastKey) return
    lastKey = key
    resetTrainingStore()
  })
})
