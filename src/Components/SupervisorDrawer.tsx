import { useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { Activity, Ban, ChevronLeft, GraduationCap, ShieldCheck, Users, X } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { BottomIsland } from '@/Components/primitives/BottomIsland'
import { AddFab } from '@/Components/primitives/AddFab'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import type { SliderStop } from '@/Components/primitives/SliderRail'
import { ContentWrapper } from '@/Components/primitives/ContentWrapper'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { Sheet } from '@/Components/primitives/Sheet'
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane'
import { PaneHeader } from '@/Components/primitives/PaneHeader'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useEscBackout } from '../Hooks/useEscBackout'
import { useAuthStore } from '../stores/useAuthStore'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useSubClusters } from '../Hooks/useSubClusters'
import { isIctlTaskTestable } from '../Utilities/ictlEvaluation'
import { useEchelonSummaries } from '../Hooks/useEchelonSummaries'
import { useSupervisorData } from './Settings/Supervisor/useSupervisorData'
import {
  formatMedicName,
  medicsInSubCluster,
  buildIctlCategoryRows,
  rollupTrainingActivity,
  recordItemLabel,
  type TaskRecord,
} from './Settings/Supervisor/supervisorHelpers'
import { SupervisorRail, SupervisorSubjectCard } from './Settings/Supervisor/SupervisorRail'
import type { SubjectCardProps } from './Settings/SubjectCard'
import { TrainingView } from './Settings/Supervisor/TrainingView'
import { CoverageTasksView } from './Settings/Supervisor/CoverageTasksView'
import type { CoverageSelection } from './Settings/Supervisor/CoverageTasksView'
import { EvaluationStep } from './Settings/Supervisor/EvaluationStep'
import { RecordDetail } from './Settings/Supervisor/RecordDetail'
import { AlgorithmEvaluateFlow } from './Settings/Supervisor/AlgorithmEvaluateFlow'
import { deleteCompletion, updateAssignment } from '../lib/trainingService'
import { getEvaluableTaskData } from '../Utilities/algorithmCompetency'
import { TrainingExportOverlay } from './Settings/Supervisor/TrainingExportOverlay'
import { useTrainingCompletions } from '../Hooks/useTrainingCompletions'
import { type TreeSelection } from './Settings/Supervisor/SupervisorTree'
import type { ClinicMedic, StepResult } from '../Types/SupervisorTestTypes'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { useMinLoadTime } from '../Hooks/useMinLoadTime'

/** When the child computed what the parent is looking at. Published numbers are
 *  as old as their last fan, and a supervisor acting on them needs to know. */
function formatPublishedAt(iso: string): string {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ─── State Machine ───────────────────────────────────────────────────────────

/**
 * Three independent axes, deliberately not one union:
 *
 *   subject     — WHO the drawer is pointed at. Set from the rail, and ONLY from
 *                 the rail. Changing it re-points the center and swaps the
 *                 SubjectCard; it does not open the pane, so the rail survives
 *                 the selection.
 *   centerStack — the browsable drill INSIDE that subject. A category, which is
 *                 to say something with a filter or a list you scan, belongs
 *                 here rather than in a 380px pane. The header's back owns this
 *                 stack and nothing else.
 *   pane        — a terminal: one entity's action or contents. Only this
 *                 collapses the rail.
 *
 * Both the center and the pane are discriminated unions now that Training and
 * the evaluator have landed.
 */
type Section = 'training' | 'encounters' | 'certs'

/**
 * The browsable chain inside a subject: a subject area's task list, then one ICTL
 * within it, then one of that ICTL's prerequisite algorithms — each a scannable
 * list, so each is a center drill and none is a 380px terminal.
 *
 * The last two used to be local state inside CoverageTasksView, which put them
 * outside the reach of the back button: backing out of a task dropped the whole
 * category. On the stack, back walks the chain one step at a time for free.
 */
type CenterScreen =
  | { kind: 'area'; areaName: string }
  | { kind: 'drill'; selection: CoverageSelection }

/** What the header calls a screen. */
function screenTitle(screen: CenterScreen): string {
  if (screen.kind === 'area') return screen.areaName
  return screen.selection.kind === 'ictl'
    ? screen.selection.task.title
    : screen.selection.algorithmName
}

/**
 * A terminal. Grading is the first one, and it is a terminal by the definition
 * the layout already uses: it ACTS on one (soldier, task) pair rather than
 * offering a list to scan, and it is the one thing in this drawer you should not
 * be able to walk away from by re-pointing the rail — which is exactly what
 * collapsing the rail enforces.
 *
 * An algorithm is its own kind rather than a taskNumber, because it does not
 * grade one task: it walks every evaluable unit under the algorithm in sequence
 * and persists each as it goes (see AlgorithmEvaluateFlow's cascade).
 *
 * A RECORD is the third, and it is a terminal for the same reason the first two
 * are: it acts on one row — void it, move its due date, re-walk it — rather than
 * offering anything to scan, and the acts are destructive enough that walking
 * away from them by re-pointing the rail would be the wrong affordance.
 */
type PaneScreen =
  | { kind: 'evaluate-task'; soldier: ClinicMedic; taskNumber: string; taskTitle: string }
  | { kind: 'evaluate-algorithm'; soldier: ClinicMedic; algorithmId: string; algorithmName: string }
  | { kind: 'record'; record: TaskRecord }

/** Who a terminal is about. Grading is reached from a roster row and a record
 *  carries its own soldier, so in both cases this differs from the rail's
 *  subject at any group scope. */
function paneSoldierOf(pane: PaneScreen): ClinicMedic {
  return pane.kind === 'record' ? pane.record.soldier : pane.soldier
}

/** What the pane's chrome calls a terminal. Derived, never stored — a title held
 *  beside the thing it names is a second copy that can go stale. */
function paneTitleOf(pane: PaneScreen): string {
  if (pane.kind === 'evaluate-task') return pane.taskTitle
  if (pane.kind === 'evaluate-algorithm') return pane.algorithmName
  return recordItemLabel(pane.record.completion.trainingItemId)
}

interface SupervisorDrawerProps {
  isVisible: boolean
  onClose: () => void
}

export function SupervisorDrawer({ isVisible, onClose }: SupervisorDrawerProps) {
  const [subject, setSubject] = useState<TreeSelection>({ type: 'cluster' })
  const [section, setSection] = useState<Section>('training')
  const [centerStack, setCenterStack] = useState<CenterScreen[]>([])
  const [pane, setPane] = useState<PaneScreen | null>(null)
  /** Why the last grade did not take. Held on the drawer rather than inside the
   *  evaluator because it must survive the evaluator staying mounted — the whole
   *  point is that the walk is still on screen with its measures marked. */
  const [paneError, setPaneError] = useState<string | null>(null)
  // Mobile only: the rail lives in a sheet, so its visibility is explicit.
  const [railSheetOpen, setRailSheetOpen] = useState(false)
  // Coverage for whatever the center is pointed at — an ICTL or an algorithm.
  // Reported UP from CoverageTasksView, which is where the per-medic fold behind
  // the number lives; while it is set the subject card carries it in place of the
  // subject's two training bars.
  const [ictlStat, setIctlStat] = useState<SubjectCardProps['stat']>(undefined)
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  // Personnel search — DESKTOP ONLY, and it lives in the rail it filters
  // (calendar's roster search, CalendarDrawer.tsx:374). Mobile has no search at
  // all: the rail is a sheet there, so any header field either does nothing
  // visible or has to yank the sheet open on focus, and a control that opens a
  // surface out from under your thumb is worse than no control.
  const [search, setSearch] = useState('')
  const fabRef = useRef<HTMLDivElement>(null)

  const isMobile = useIsMobile()

  const center = centerStack[centerStack.length - 1] ?? null
  // The one thing that collapses the rail.
  const railCollapsed = pane !== null

  // ── Data ───────────────────────────────────────────────────────────────────

  // The supervisor toggle picks which clinic this drawer administers.
  // Defaults to the assigned clinic for single-clinic users.
  const clinicId = useAuthStore(s => s.supervisingClinicId ?? s.clinicId)

  const {
    loading: _loading,
    isSupervisor,
    currentUserId,
    medics,
    clinicName,
    teamMetrics,
    competencyMatrix,
    trainingEvents,
    testableTaskMap,
    testsForSoldier,
    readsForSoldier,
    assignmentsForSoldier,
    runCountsForSoldier,
    tests,
    resolveName,
    refreshData,
  } = useSupervisorData()
  const loading = useMinLoadTime(_loading)

  // The write side. useSupervisorData is a READ fold over the audit stream, so a
  // grade goes out through the completions hook and comes back on the next fold
  // — which is why every submit path below ends in refreshData rather than
  // patching a local row.
  const { submitTestEvaluation } = useTrainingCompletions()

  const { subClusters } = useSubClusters()
  // Fetched HERE, not in the rail: the rail draws a child's card from these and
  // the center draws its Training pane from the same summaries.
  const { cards: childClusters } = useEchelonSummaries(clinicId ?? null, isSupervisor)

  // ── Scope ──────────────────────────────────────────────────────────────────

  const knownSubClusterIds = useMemo(
    () => new Set(subClusters.map(s => s.id)),
    [subClusters],
  )

  /**
   * The roster behind the current subject — the one place a rail selection turns
   * into people. Every scoped number downstream is a slice keyed on this.
   *
   * A child echelon resolves to nobody on purpose: a subordinate cluster fans up
   * a PUBLISHED readiness summary, and the parent holds none of the records
   * behind it (they are sealed in the child's vault). Its card carries the
   * summary; the center has to say it has no detail rather than draw zeroes.
   */
  const scopeMedics = useMemo<ClinicMedic[]>(() => {
    if (subject.type === 'soldier') {
      const soldier = medics.find(m => m.id === subject.soldierId)
      return soldier ? [soldier] : []
    }
    if (subject.type === 'sub-cluster') {
      return medicsInSubCluster(medics, subject.subClusterId, knownSubClusterIds)
    }
    if (subject.type === 'cluster') return medics
    return []
  }, [subject, medics, knownSubClusterIds])

  const isChildScope = subject.type === 'child-cluster' || subject.type === 'child-soldier'

  const scopeIds = useMemo(() => new Set(scopeMedics.map(m => m.id)), [scopeMedics])

  // Sliced, never re-folded — see useSupervisorData.competencyMatrix.
  const categoryRows = useMemo(
    () => buildIctlCategoryRows(
      competencyMatrix.filter(s => scopeIds.has(s.soldierId)),
      testableTaskMap,
    ),
    [competencyMatrix, scopeIds, testableTaskMap],
  )

  const activity = useMemo(
    () => rollupTrainingActivity(trainingEvents, scopeIds),
    [trainingEvents, scopeIds],
  )

  // ── Child echelon ──────────────────────────────────────────────────────────

  /**
   * A subordinate cluster's Training pane, rebuilt from what it PUBLISHED.
   *
   * The parent holds none of the records — they are sealed in the child's vault
   * — so these numbers are a readout of a fan-up, not a fold. They land in the
   * same IctlCategoryRow / TrainingActivityWeek shapes the local path produces,
   * which is what lets one TrainingView serve both and is why the published week
   * is a bucket start and two counts rather than a display string.
   *
   * Null until a child publishes detail: back-compat summaries carry the two
   * percentages and no categories, and an unpublished cluster carries nothing.
   */
  const childTraining = useMemo(() => {
    if (!isChildScope) return null
    const childClinicId = subject.type === 'child-cluster' || subject.type === 'child-soldier'
      ? subject.clinicId
      : null
    const summary = childClusters.find(c => c.clinicId === childClinicId)?.summary
    const categories = summary?.categories
    if (!summary || !categories?.length) return null

    const row = (areaName: string, passed: number, total: number) => ({
      areaName,
      passed,
      total,
      pct: total > 0 ? Math.round((passed / total) * 100) : 0,
    })

    if (subject.type === 'child-soldier') {
      const areas = summary.soldiers?.find(s => s.user_id === subject.soldier.id)?.areas
      if (!areas) return null
      const passedByArea = new Map(areas.map(a => [a.area, a.passed]))
      return {
        rows: categories.map(c => row(c.area, passedByArea.get(c.area) ?? 0, c.tasks)),
        soldierCount: 1,
        // The child publishes ONE cluster-wide series. Drawing it under a
        // soldier's name would attribute their unit's work to them.
        activity: undefined,
        computedAt: summary.computed_at,
      }
    }

    return {
      rows: categories.map(c => row(c.area, c.passed, c.tasks * summary.medic_count)),
      soldierCount: summary.medic_count,
      activity: summary.activity,
      computedAt: summary.computed_at,
    }
  }, [isChildScope, subject, childClusters])

  const subjectLabel = useMemo(() => {
    if (subject.type === 'soldier') {
      const soldier = medics.find(m => m.id === subject.soldierId)
      return soldier ? formatMedicName(soldier) : ''
    }
    if (subject.type === 'child-soldier') return subject.soldier.name
    if (subject.type === 'sub-cluster' || subject.type === 'child-cluster') return subject.name
    return clinicName ?? 'My Cluster'
  }, [subject, medics, clinicName])

  // ── Navigation ─────────────────────────────────────────────────────────────

  /** Rail selection. Re-points the center and unwinds any drill within the old
   *  subject; the pane is a different axis and closes on its own terms. */
  const handleSelectSubject = useCallback((selection: TreeSelection) => {
    setSubject(selection)
    setCenterStack([])
    // Mobile: the pick was the point of opening the sheet, so it gets out of
    // the way and reveals the center it just re-pointed.
    setRailSheetOpen(false)
  }, [])

  /** Island stop. The stack belongs to the section that pushed it, so switching
   *  sections unwinds it. */
  const handleSelectSection = useCallback((id: string) => {
    setSection(id as Section)
    setCenterStack([])
  }, [])

  const popCenter = useCallback(() => {
    setCenterStack(prev => prev.slice(0, -1))
  }, [])

  const closePane = useCallback(() => {
    setPane(null)
    setPaneError(null)
  }, [])

  /** Selecting a subject is not a step, so there is nothing behind it to go back
   *  to — back unwinds the pane, then the center drill, and stops. */
  const handleBack = useCallback(() => {
    if (pane) { closePane(); return }
    if (centerStack.length > 0) popCenter()
  }, [pane, centerStack.length, closePane, popCenter])

  const handleClose = useCallback(() => {
    setSubject({ type: 'cluster' })
    setCenterStack([])
    setPane(null)
    setRailSheetOpen(false)
    onClose()
  }, [onClose])

  /** A category row. The area's task list is a scannable list with a per-task
   *  coverage bar, so it drills the CENTER rather than opening the pane. */
  /** Stable by necessity: CoverageTasksView reports through an effect keyed on
   *  this identity, so a fresh closure each render would re-report forever. */
  const handleOpenIctl = useCallback((stat: SubjectCardProps['stat'] | null) => {
    setIctlStat(stat ?? undefined)
  }, [])

  const handleSelectCategory = useCallback((areaName: string) => {
    setCenterStack(prev => [...prev, { kind: 'area', areaName }])
  }, [])

  /** A drill INSIDE the open area — an ICTL, or one of its algorithms. Pushed, so
   *  back returns to whatever you were reading rather than to the category list. */
  const handleSelectDrill = useCallback((sel: CoverageSelection) => {
    setCenterStack(prev => [...prev, { kind: 'drill', selection: sel }])
  }, [])

  const requestNewCalendarEvent = useNavigationStore(s => s.requestNewCalendarEvent)

  /** Assigning a task IS scheduling it, and the calendar owns scheduling — this
   *  hands off with the task prefilled rather than growing a second composer. */
  const handleAssign = useCallback((soldier: ClinicMedic, taskId: string, taskTitle: string) => {
    requestNewCalendarEvent({
      title: `Training: ${taskTitle}`,
      category: 'training',
      assignedTo: [soldier.id],
      trainingItemId: taskId,
    })
    handleClose()
  }, [requestNewCalendarEvent, handleClose])

  // ── Evaluation (the pane's terminals) ──────────────────────────────────────

  /** Grading opens the PANE, from every scope and every list. The rail collapses
   *  behind it on purpose: re-pointing the subject halfway through a walk would
   *  leave a half-graded task with no owner. */
  const handleEvaluateTask = useCallback((soldier: ClinicMedic, taskId: string, taskTitle: string) => {
    setPane({ kind: 'evaluate-task', soldier, taskNumber: taskId, taskTitle })
    setPaneError(null)
  }, [])

  const handleEvaluateAlgorithm = useCallback((soldier: ClinicMedic, algorithmId: string, algorithmName: string) => {
    setPane({ kind: 'evaluate-algorithm', soldier, algorithmId, algorithmName })
    setPaneError(null)
  }, [])

  /** One task, one grade. A single NO_GO fails the walk — the measures are a
   *  standard, not a score, so there is no partial credit to average. */
  const handleSubmitEvaluation = useCallback(async (stepResults: StepResult[], notes: string) => {
    if (pane?.kind !== 'evaluate-task') return
    const res = await submitTestEvaluation({
      medicUserId: pane.soldier.id,
      trainingItemId: pane.taskNumber,
      result: stepResults.some(s => s.result === 'NO_GO') ? 'NO_GO' : 'GO',
      stepResults,
      supervisorNotes: notes || undefined,
    })
    // A refused write leaves the pane exactly as it was — measures marked, notes
    // typed — so the supervisor can retry without walking the soldier again.
    // Closing on it was what made a dead write look like a dead button.
    if (!res.success) {
      setPaneError(res.error)
      return
    }
    setPaneError(null)
    refreshData()
    // Back to the roster that sent us here, with the grade already in it. The
    // center never moved, so there is nothing to restore.
    closePane()
  }, [pane, submitTestEvaluation, refreshData, closePane])

  /** One unit of an algorithm walk. Persisted AS IT IS GRADED rather than
   *  batched at the end: a cascade is several real records, and a supervisor
   *  interrupted after unit three should keep three grades, not lose them.
   *  STP units write real STP completions; synthetic units write `algo:<id>:<dim>`.
   *  Returns whether it landed, so the flow holds rather than walking on. */
  const handleSubmitAlgorithmUnit = useCallback(async (trainingItemId: string, stepResults: StepResult[], notes: string): Promise<boolean> => {
    if (pane?.kind !== 'evaluate-algorithm') return false
    const res = await submitTestEvaluation({
      medicUserId: pane.soldier.id,
      trainingItemId,
      result: stepResults.some(s => s.result === 'NO_GO') ? 'NO_GO' : 'GO',
      stepResults,
      supervisorNotes: notes || undefined,
    })
    setPaneError(res.success ? null : res.error)
    return res.success
  }, [pane, submitTestEvaluation])

  /** Every unit graded. One refresh for the whole cascade — refolding per unit
   *  would rebuild the matrix mid-walk under the flow that is still reading it. */
  const handleAlgorithmEvalComplete = useCallback(() => {
    refreshData()
    closePane()
  }, [refreshData, closePane])

  // ── Records (the pane's third terminal) ────────────────────────────────────

  /**
   * All three completion types for one soldier, in one list.
   *
   * The coverage surfaces read `testsForSoldier` alone because a bar only cares
   * about the latest verdict. The records list is the other question — what is
   * actually on file — and reads/assignments were folded all along with nothing
   * consuming them. This is what connects them.
   */
  const completionsForSoldier = useCallback(
    (userId: string) => [
      ...testsForSoldier(userId),
      ...readsForSoldier(userId),
      ...assignmentsForSoldier(userId),
    ],
    [testsForSoldier, readsForSoldier, assignmentsForSoldier],
  )

  const handleOpenRecord = useCallback((record: TaskRecord) => {
    setPane({ kind: 'record', record })
    setPaneError(null)
  }, [])

  /**
   * Void the record and purge the events behind it (see trainingService's
   * tombstone-then-purge). The linked calendar event is NOT touched: deleting a
   * grade is not cancelling the training block it was given at, and the link is
   * dropped so nothing points at a record that no longer exists.
   *
   * A refused delete holds the pane open with the reason — the same contract as
   * a refused grade, and for the same reason: a dead write that closes the
   * surface looks like it worked.
   */
  const handleDeleteRecord = useCallback(async (record: TaskRecord) => {
    if (!currentUserId) { setPaneError('Not signed in — the record was not deleted.'); return }
    const res = await deleteCompletion(record.completion.id, currentUserId)
    if (!res.success) { setPaneError(res.error); return }
    refreshData()
    closePane()
  }, [currentUserId, refreshData, closePane])

  /** Edit a pending assignment. Emits a fresh assignment.created, which the fold
   *  collapses onto the same row — see trainingService.updateAssignment. */
  const handleSaveAssignment = useCallback(async (record: TaskRecord, dueDate: string, notes: string) => {
    if (!currentUserId) { setPaneError('Not signed in — the assignment was not changed.'); return }
    const res = await updateAssignment({
      medicUserId: record.completion.userId,
      trainingItemId: record.completion.trainingItemId,
      supervisorId: currentUserId,
      dueDate,
      supervisorNotes: notes || null,
    })
    if (!res.success) { setPaneError(res.error); return }
    refreshData()
    closePane()
  }, [currentUserId, refreshData, closePane])

  /** Correcting a grade means walking the measures again, so the record hands
   *  the pane to the evaluator rather than editing a result in place. The new
   *  grade replaces the old row on the next fold — same (soldier, item, type). */
  const handleReEvaluateRecord = useCallback((record: TaskRecord) => {
    const itemId = record.completion.trainingItemId
    handleEvaluateTask(record.soldier, itemId, recordItemLabel(itemId))
  }, [handleEvaluateTask])

  /** An algorithm schedules through `encounterAlgorithmId`, NOT trainingItemId:
   *  it is not on the training roster, and prefilling it as one would mint an
   *  assignment against a task id that no packet answers to. */
  const handleScheduleAlgorithm = useCallback((soldier: ClinicMedic, algorithmId: string, algorithmName: string) => {
    requestNewCalendarEvent({
      title: `Algorithm training — ${algorithmName}`,
      category: 'training',
      encounterAlgorithmId: algorithmId,
      assignedTo: [soldier.id],
    })
    handleClose()
  }, [requestNewCalendarEvent, handleClose])

  const [exportOpen, setExportOpen] = useState(false)

  /**
   * The island FAB's options — the ONE action surface that follows the rail, and
   * the reason no card or category grew an export pill of its own.
   *
   * EXPORT is the standing option at every local scope, which is what keeps the
   * FAB on the main panel rather than appearing only once you have drilled: the
   * question "pull this cluster's completions" is asked of the roster you are
   * looking at, not of a task you opened.
   *
   * The rest are scope-dependent, and they exist because soldier scope has
   * nowhere else to put them. Every other scope acts through a roster row, but at
   * soldier scope CoverageTasksView renders no roster (a list of the one person
   * the surface is scoped to restates the card), so without these a supervisor
   * pointed at a soldier could read their gaps and do nothing about them.
   */
  const fabOptions = useMemo(() => {
    // A subordinate cluster publishes a summary and keeps its records sealed in
    // its own vault, so there is nothing here to pull or grade.
    if (isChildScope) return []

    const options: { key: string; label: string; onAction: () => void }[] = [
      { key: 'export', label: 'Export completions', onAction: () => setExportOpen(true) },
    ]

    const soldier = subject.type === 'soldier' ? scopeMedics[0] : null
    if (!soldier || center?.kind !== 'drill') return options
    const sel = center.selection

    if (sel.kind === 'algorithm') {
      options.push(
        { key: 'evaluate', label: 'Evaluate', onAction: () => handleEvaluateAlgorithm(soldier, sel.algorithmId, sel.algorithmName) },
        { key: 'schedule', label: 'Schedule Training', onAction: () => handleScheduleAlgorithm(soldier, sel.algorithmId, sel.algorithmName) },
      )
      return options
    }
    // A task with no graded measures is on the roster but cannot be walked, so
    // it offers scheduling alone rather than a grade there is nothing to give.
    if (isIctlTaskTestable(sel.task.taskId)) {
      options.push({
        key: 'evaluate',
        label: 'Evaluate',
        onAction: () => handleEvaluateTask(soldier, sel.task.taskId, sel.task.title),
      })
    }
    options.push({ key: 'assign', label: 'Assign Task', onAction: () => handleAssign(soldier, sel.task.taskId, sel.task.title) })
    return options
  }, [isChildScope, subject, scopeMedics, center, handleEvaluateTask, handleEvaluateAlgorithm, handleScheduleAlgorithm, handleAssign])

  /** What the export pulls. Scoped to the rail's roster, and narrowed further to
   *  the open subject area's tasks when one is open — the FAB acts on what you
   *  are looking at, which is the whole reason there is only one of it. */
  const exportCompletions = useMemo(
    () => tests.filter(t => scopeIds.has(t.userId)),
    [tests, scopeIds],
  )

  const exportTaskIds = useMemo(() => {
    const areaScreen = centerStack.find(s => s.kind === 'area')
    if (!areaScreen) return undefined
    return new Set((testableTaskMap.get(areaScreen.areaName) ?? []).map(t => t.taskId))
  }, [centerStack, testableTaskMap])

  // Desktop Esc: back out one layer — pane, then center drill.
  useEscBackout(!isMobile && (!!pane || centerStack.length > 0), handleBack)

  // ── Swipe Back (mobile) ────────────────────────────────────────────────────

  const canSwipeBack = isMobile && centerStack.length > 0
  const swipeHandlers = useSwipeBack(
    useMemo(() => (canSwipeBack ? handleBack : undefined), [canSwipeBack, handleBack]),
    canSwipeBack,
  )

  // ── Rail (desktop pane / mobile sheet root) ────────────────────────────────

  // Selection only, and that is the whole contract: every node is a scope. There
  // are no edit handlers to pass because this drawer does not edit — the card
  // therefore renders no action button here, unlike the settings rail's.
  const renderRail = (scrollable: boolean, withSearch: boolean, withCard: boolean) => (
    <SupervisorRail
      scrollable={scrollable}
      showCard={withCard}
      stat={ictlStat}
      medics={medics}
      clinicName={clinicName}
      teamMetrics={teamMetrics}
      childClusters={childClusters}
      selection={subject}
      onSelect={handleSelectSubject}
      searchQuery={search}
      onSearchChange={withSearch ? setSearch : undefined}
    />
  )

  // ── Center ─────────────────────────────────────────────────────────────────

  /** Desktop header. Names the deepest thing open: an algorithm, an ICTL, the
   *  category, then the subject — the same order back unwinds them. */
  const centerTitle = center ? screenTitle(center) : subjectLabel

  const renderCenterBody = () => {
    // A drill belongs to the subject, not to the section stop under it, so it
    // renders ahead of the section switch. The AREA is what the view is built
    // from and the TOP of the stack is what it is pointed at — one component
    // renders every step of the chain, which is why back can walk it.
    const areaScreen = centerStack.find(s => s.kind === 'area')
    if (areaScreen) {
      const drill = center?.kind === 'drill' ? center.selection : null
      return (
        <CoverageTasksView
          selection={drill}
          onSelect={handleSelectDrill}
          tasks={testableTaskMap.get(areaScreen.areaName) ?? []}
          medics={scopeMedics}
          testsForSoldier={testsForSoldier}
          runCountsForSoldier={runCountsForSoldier}
          onEvaluate={handleEvaluateTask}
          onEvaluateAlgorithm={handleEvaluateAlgorithm}
          onScheduleAlgorithm={handleScheduleAlgorithm}
          onAssign={handleAssign}
          onOpenIctl={handleOpenIctl}
          completionsForSoldier={completionsForSoldier}
          onOpenRecord={handleOpenRecord}
          // At soldier scope the task list is already about one person, so it
          // acts on them directly instead of listing a roster of one.
          preSelectedSoldier={subject.type === 'soldier' ? scopeMedics[0] : undefined}
        />
      )
    }

    if (section === 'training') {
      if (isChildScope) {
        if (!childTraining) {
          return (
            <p className="text-sm text-tertiary text-center py-12">
              {subjectLabel} has not published training detail yet.
            </p>
          )
        }
        return (
          <TrainingView
            rows={childTraining.rows}
            activity={childTraining.activity}
            soldierCount={childTraining.soldierCount}
            asOf={formatPublishedAt(childTraining.computedAt)}
            // No drill: the tasks behind these rows are in the child's vault.
          />
        )
      }
      return (
        <TrainingView
          rows={categoryRows}
          activity={activity}
          soldierCount={scopeMedics.length}
          onSelectCategory={handleSelectCategory}
        />
      )
    }

    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-tertiary">{subjectLabel} · {section}</p>
      </div>
    )
  }

  const sectionStops: SliderStop[] = [
    { id: 'training', title: 'Training', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'encounters', title: 'Encounters', icon: <Activity className="w-5 h-5" /> },
    { id: 'certs', title: 'Certs', icon: <ShieldCheck className="w-5 h-5" /> },
  ]

  // One FAB, scope-aware: its options follow the rail's selection rather than
  // sitting as a pill on each card. It rides the main panel at every local scope
  // because Export is always on offer there — it is only absent at child-echelon
  // scope, where the parent holds no records to act on and the options really are
  // empty. It doubles as the export overlay's anchor.
  const islandFab = fabOptions.length > 0 ? (
    <div ref={fabRef} className="absolute right-4">
      <AddFab label="Actions" onClick={() => setActionSheetOpen(true)} />
    </div>
  ) : undefined

  // Mobile heads the center with the subject rather than the sheet: the sheet is
  // for picking, the center is for reading, and the card belongs to what you read.
  //
  // The card IS the mobile header — the drawer renders none, and Personnel and
  // Close ride the cover in the corners the card's own action would have used. A
  // bar above it would only name the subject the card already names, an inch
  // apart. A drill does NOT take it back: an ICTL category is content INSIDE the
  // subject, so it swaps the body under a header that never moves, and the left
  // pill becomes the way back out of it.
  const showCenterCard = isMobile
  const drilled = centerStack.length > 0

  const renderCenter = () => (
    <>
      {/* No header of its own on either platform — the center IS the drawer's
          subject, so the drawer header names it and carries the back. Only the
          right pane, which is a layer ON TOP of the center, owns its chrome. */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${isMobile ? 'pb-24' : 'px-5 py-5 pb-24'}`}>
        {showCenterCard && (
          <SupervisorSubjectCard
            medics={medics}
            clinicName={clinicName}
            teamMetrics={teamMetrics}
            childClusters={childClusters}
            selection={subject}
            stat={ictlStat}
            // Pinned: the pills are this surface's only chrome, so they cannot be
            // allowed to scroll off. The cover carries the status-bar pad itself.
            stickyCover
            coverHeightClass="h-24"
            coverLeft={
              <HeaderPill>
                {drilled ? (
                  <PillButton icon={ChevronLeft} onClick={handleBack} label="Back" />
                ) : (
                  <PillButton icon={Users} onClick={() => setRailSheetOpen(true)} label="Personnel" />
                )}
              </HeaderPill>
            }
            coverRight={
              <HeaderPill>
                <PillButton icon={X} onClick={handleClose} label="Close" />
              </HeaderPill>
            }
          />
        )}
        {/* Keyed on what is being read, so a drill or a section change re-runs
            AppearIn on the body alone — the swap under a fixed card, stated. */}
        <div
          key={`${section}:${centerStack.length}:${centerTitle}`}
          className={`animate-AppearIn ${isMobile ? 'px-4' : ''}`}
        >
          {renderCenterBody()}
        </div>
      </div>
      {/* The island switches sections; a drill inside one sits above it, so the
          island stays put rather than swapping out from under the drill. */}
      <BottomIsland
        glass
        z="z-20"
        ariaLabel="Supervisor sections"
        activeId={section}
        onSelect={handleSelectSection}
        stops={sectionStops}
        fab={islandFab}
      />
    </>
  )

  // ── Pane (terminals) ───────────────────────────────────────────────────────

  const paneTitle = pane ? paneTitleOf(pane) : ''

  /** Who the terminal is about — NOT the rail's subject. Grading is reached from
   *  a roster row, so at cluster scope the two differ, and an eyebrow naming the
   *  cluster over one soldier's scorecard is the wrong name in the one place a
   *  supervisor needs it right. */
  const paneEyebrow = pane ? formatMedicName(paneSoldierOf(pane)) : subjectLabel

  /** The packet number. It used to head the evaluator's body; it belongs with the
   *  title that names the same thing, not a line below it. */
  const paneSubtitle = pane
    ? (pane.kind === 'evaluate-task' ? pane.taskNumber
      : pane.kind === 'evaluate-algorithm' ? pane.algorithmId
      : pane.record.completion.trainingItemId)
    : undefined

  /** Terminal bodies — headerless AND scroll-less. The desktop pane wraps them
   *  in its own scroll region; the mobile sheet already has one, and nesting a
   *  second inside it makes the two fight for the same drag. EvaluationStep was
   *  flattened to honour that: it renders plain flow and lets its submit bar
   *  stick to whichever scrollport it lands in.
   *
   *  Only the evaluator lives here. Every rail selection — soldier, sub-cluster,
   *  subordinate cluster — is a SCOPE that re-points the card rather than a
   *  terminal, and this drawer edits none of them: roster and membership
   *  operations are cluster management's, and supervisor is training only. */
  const renderPaneBody = () => {
    if (!pane) return null

    // Rides ABOVE the walk rather than by the FAB that triggered it: the measures
    // stay marked and the FAB stays live for the retry, so the message belongs
    // where it is read on the way back in, not where it was dismissed.
    const errorBanner = paneError ? (
      <div className="mx-4 mt-4 rounded-lg bg-themeredred/10 px-3 py-2">
        <p className="text-sm text-themeredred">{paneError}</p>
        <p className="text-[9pt] text-tertiary mt-0.5">
          Nothing was recorded. The grades below are still here — submit again.
        </p>
      </div>
    ) : null

    if (pane.kind === 'record') {
      const c = pane.record.completion
      // Re-evaluate is offered only where there is something to re-walk: a grade
      // whose item still has graded measures. A read is the soldier's own report
      // and an assignment is edited rather than re-graded, so neither carries it.
      const reWalkable = c.completionType === 'test'
        && (getEvaluableTaskData(c.trainingItemId)?.gradedSteps?.length ?? 0) > 0
      const pendingAssignment = c.completionType === 'assignment' && !c.completedAt
      return (
        <>
          {errorBanner}
          <RecordDetail
            record={pane.record}
            resolveName={resolveName}
            onReEvaluate={reWalkable ? () => handleReEvaluateRecord(pane.record) : undefined}
            onSaveAssignment={pendingAssignment
              ? (dueDate, notes) => handleSaveAssignment(pane.record, dueDate, notes)
              : undefined}
            onDelete={() => handleDeleteRecord(pane.record)}
          />
        </>
      )
    }

    if (pane.kind === 'evaluate-task') {
      // Straight to the evaluator, with no task-picking step before it. Every
      // route into this pane arrives with a (soldier, task) pair already chosen —
      // the roster row, the record, or the FAB IS the picker.
      return (
        <>
          {errorBanner}
          <EvaluationStep
            taskNumber={pane.taskNumber}
            onSubmit={handleSubmitEvaluation}
          />
        </>
      )
    }

    return (
      <>
        {errorBanner}
        <AlgorithmEvaluateFlow
          algorithmId={pane.algorithmId}
          onSubmitUnit={handleSubmitAlgorithmUnit}
          onComplete={handleAlgorithmEvalComplete}
        />
      </>
    )
  }

  // ── Header Config ──────────────────────────────────────────────────────────

  const headerConfig = useMemo(() => {
    const closePill = (
      <HeaderPill>
        <PillButton icon={X} onClick={handleClose} label="Close" />
      </HeaderPill>
    )

    // Mobile has NO drawer header at all — the card is it, at root and inside a
    // drill both. Return undefined rather than an empty config: BaseDrawer renders
    // children raw when there is no header, so nothing reserves the space the
    // cover wants.
    if (isMobile) return undefined

    // Desktop: the header names the drill, never the subject — the SubjectCard is
    // where the subject is named, and retitling the whole surface after a
    // selection duplicated it a rail's width away.
    return {
      title: drilled ? centerTitle : 'Supervisor',
      ...(drilled ? { showBack: true, onBack: handleBack } : {}),
      rightContent: closePill,
      hideDefaultClose: true,
    }
  }, [isMobile, drilled, centerTitle, handleBack, handleClose])

  // ── Render ─────────────────────────────────────────────────────────────────

  const guarded = (body: ReactNode) => {
    if (loading) {
      return (
        <div className="relative h-full">
          <LoadingOverlay visible size={140} />
        </div>
      )
    }
    if (!isSupervisor) {
      return (
        <div className="h-full flex items-center justify-center px-4">
          <div className="text-center">
            <Ban size={28} className="mx-auto mb-3 text-tertiary" />
            <h3 className="text-base font-semibold text-primary mb-1">Access Denied</h3>
            <p className="text-sm text-tertiary">You need the supervisor role to access this panel.</p>
          </div>
        </div>
      )
    }
    return body
  }

  return (
    <>
      <BaseDrawer
        isVisible={isVisible}
        onClose={handleClose}
        mobileFullScreen
        desktopPosition="left"
        desktopWidth="w-[90%]"
        header={headerConfig}
        scrollDisabled
        glassHeader={isMobile && !!headerConfig}
      >
        {/* No slide. The whole center used to travel on a drill, card included,
            which read as a new screen arriving — the thing this layout exists to
            stop. The card is furniture now; only the body under it changes, and it
            says so with the same AppearIn the card itself uses. */}
        <ContentWrapper swipeHandlers={canSwipeBack ? swipeHandlers : undefined}>
          <div className="h-full relative">
            {guarded(
              isMobile ? (
                <div className="h-full flex flex-col relative">{renderCenter()}</div>
              ) : (
                <div className="flex h-full">
                  {/* Left rail — the subject selector. Collapses only for a
                      terminal, never for a selection. */}
                  <SlideRevealPane
                    open={!railCollapsed}
                    side="left"
                    width={260}
                    keepMounted
                    className="border-r border-tertiary/10 bg-themewhite"
                  >
                    {renderRail(true, true, true)}
                  </SlideRevealPane>

                  {/* Center — the subject's contents and any drill within it. */}
                  <div className="flex-1 min-w-0 flex flex-col relative">
                    {renderCenter()}
                  </div>

                  {/* Right pane — terminals only. */}
                  <SlideRevealPane
                    open={railCollapsed}
                    side="right"
                    width={380}
                    className="border-l border-primary/10 bg-themewhite"
                  >
                    {pane && (
                      <>
                        <PaneHeader
                          eyebrow={paneEyebrow}
                          title={paneTitle}
                          subtitle={paneSubtitle}
                          onBack={closePane}
                          backLabel="Back"
                        />
                        <div className="flex-1 min-h-0 overflow-y-auto">
                          {renderPaneBody()}
                        </div>
                      </>
                    )}
                  </SlideRevealPane>
                </div>
              ),
            )}
          </div>
        </ContentWrapper>
      </BaseDrawer>

      {/* Mobile: ONE morphing sheet. Root step is the rail — selecting a soldier
          there swaps the SubjectCard in place and re-scopes the full-screen
          center behind it, so the root neither dismisses nor pushes. Terminals
          push as leaf steps whose back pops to the root. */}
      {isMobile && (
        <Sheet
          isOpen={(railSheetOpen || !!pane) && isVisible}
          onClose={() => { setPane(null); setRailSheetOpen(false) }}
          title={pane ? paneTitle : 'Personnel'}
          // Mobile's counterpart to PaneHeader's eyebrow/title/subtitle stack.
          // The evaluator's body no longer names the soldier, the task or the
          // number, so this is where all three have to be — `title` alone would
          // drop two of them.
          titleNode={pane ? (
            <div className="min-w-0">
              <div className="truncate text-[9pt] text-tertiary">{paneEyebrow}</div>
              <div className="truncate text-[10pt] font-semibold text-primary">{paneTitle}</div>
              <div className="truncate text-[9pt] text-tertiary font-mono">{paneSubtitle}</div>
            </div>
          ) : undefined}
          // The rail caps at 60svh so the center it re-scopes stays read behind
          // it — a picker you glance at. The evaluator is not that: it is twenty
          // graded measures you work down, and a 60% window turns one standard
          // into a scroll. Same surface, and the cap follows what is on it.
          height="fit"
          maxHeight={pane ? 92 : 60}
          zIndex={1200}
          leftContent={pane ? (
            <button
              type="button"
              onClick={closePane}
              aria-label="Back"
              className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
          ) : undefined}
        >
          {/* One scroll, the sheet's own — every body rendered here is plain
              flow, so nothing competes with it for the drag. */}
          {pane ? renderPaneBody() : renderRail(false, false, false)}
        </Sheet>
      )}

      {/* The island's FAB. Its options follow the rail selection, so there is
          one action surface rather than a pill per card — see fabOptions for why
          it is soldier-scope-only. */}
      <ActionSheet
        visible={actionSheetOpen}
        title={subjectLabel}
        options={fabOptions}
        onClose={() => setActionSheetOpen(false)}
      />

      {/* The one export surface, anchored on the FAB that opened it. Scoped by the
          rail and narrowed by the open category — no per-card or per-category
          pull, which would be the same overlay reached with a narrower scope. */}
      <TrainingExportOverlay
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        anchorRect={fabRef.current?.getBoundingClientRect() ?? null}
        scopeLabel={centerStack.length > 0 ? `${subjectLabel} · ${centerTitle}` : subjectLabel}
        filenameStem={subjectLabel}
        completions={exportCompletions}
        resolveName={resolveName}
        taskIds={exportTaskIds}
      />
    </>
  )
}
