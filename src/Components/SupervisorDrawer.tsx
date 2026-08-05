import { useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { Activity, Ban, ChevronLeft, ChevronRight, ClipboardCheck, GraduationCap, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { BottomIsland } from '@/Components/primitives/BottomIsland'
import { AddFab } from '@/Components/primitives/AddFab'
import { ActionSheet } from '@/Components/primitives/ActionSheet'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
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
  rollupEncounterReads,
  rollupEncounterActivity,
  buildCertTitleRows,
  collectCertHolders,
  recordItemLabel,
  collectWeekRecords,
  weekStartLabel,
  type CertHolder,
  type CertTitleRow,
  type TaskRecord,
} from './Settings/Supervisor/supervisorHelpers'
import { TaskRecords } from './Settings/Supervisor/TaskRecords'
import { SupervisorRail, SupervisorSubjectCard } from './Settings/Supervisor/SupervisorRail'
import type { SubjectCardProps } from './Settings/SubjectCard'
import { TrainingView } from './Settings/Supervisor/TrainingView'
import { AlgorithmsView } from './Settings/Supervisor/AlgorithmsView'
import { CertsView } from './Settings/Supervisor/CertsView'
import { CertDetail } from './Settings/Supervisor/CertDetail'
import { CertCompose } from './Settings/Supervisor/CertCompose'
import { CoverageTasksView } from './Settings/Supervisor/CoverageTasksView'
import type { CoverageSelection } from './Settings/Supervisor/CoverageTasksView'
import { EvaluationStep } from './Settings/Supervisor/EvaluationStep'
import { RecordDetail } from './Settings/Supervisor/RecordDetail'
import { AlgorithmEvaluateFlow } from './Settings/Supervisor/AlgorithmEvaluateFlow'
import { deleteCompletion, updateAssignment } from '../lib/trainingService'
import {
  adminAddCertification,
  adminDeleteCertification,
  updateCertification,
  verifyCertification,
  unverifyCertification,
} from '../lib/certificationService'
import { removeCertDocument } from '../lib/certDocumentService'
import {
  buildCertificationExportRows,
  certificationCsvFilename,
  shareCertificationCsv,
} from '../lib/certificationCsv'
import { getExpirationStatus, type CertFormData } from './Certifications/certHelpers'
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
/** ALGORITHMS, not Encounters (renamed 2026-08-04). The stop is named after the
 *  thing being counted rather than the act of logging one: a supervisor asks
 *  which algorithms the clinic is running, and "encounters" named the event while
 *  every row on the surface, and every route out of it, is an algorithm. */
type Section = 'training' | 'algorithms' | 'certs'

/**
 * The browsable chain inside a subject: a subject area's task list, then one ICTL
 * within it, then one of that ICTL's prerequisite algorithms — each a scannable
 * list, so each is a center drill and none is a 380px terminal.
 *
 * The last two used to be local state inside CoverageTasksView, which put them
 * outside the reach of the back button: backing out of a task dropped the whole
 * category. On the stack, back walks the chain one step at a time for free.
 *
 * The other two stops push onto the SAME stack, which is what lets one back
 * button serve all three. A body-system category and a credential are categories
 * in the sense this axis means it — a list you scan — and an algorithm reached
 * from a category pushes the very same `drill` the ICTL route pushes, because
 * there is one algorithm route and the stop you came in by does not change it.
 */
type CenterScreen =
  | { kind: 'area'; areaName: string }
  | { kind: 'drill'; selection: CoverageSelection }
  | { kind: 'algo-category'; category: string }
  | { kind: 'cert'; title: string; certKey: string }

/** What the header calls a screen. */
function screenTitle(screen: CenterScreen): string {
  if (screen.kind === 'area') return screen.areaName
  if (screen.kind === 'algo-category') return screen.category
  if (screen.kind === 'cert') return screen.title
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
 *
 * A WEEK is the fourth and the only one that is a LIST, which is a deliberate
 * exception to "the center scans, the pane acts". The list exists to reach the
 * record terminal, and it is anchored to a column of a graph that stays on
 * screen behind it — put it in the center and the graph it belongs to is the
 * thing it would have replaced. It is therefore a STEP, not a destination: the
 * pane is a stack precisely so a week can push a record and back can walk out
 * the way it came in.
 */
type PaneScreen =
  | { kind: 'evaluate-task'; soldier: ClinicMedic; taskNumber: string; taskTitle: string }
  | { kind: 'evaluate-algorithm'; soldier: ClinicMedic; algorithmId: string; algorithmName: string }
  | { kind: 'record'; record: TaskRecord }
  | { kind: 'week'; start: number }
  /** A CERT IS HELD BY ID, not by value, and that is the difference between it
   *  and a record: a record is corrected by filing a newer one, so the row on
   *  screen is a snapshot that stays true. A cert is UPDATEd in place — verify
   *  it, edit its dates — so a copy carried on the stack would show the old row
   *  the moment the act it was opened for succeeded. It is re-read from the
   *  fetched certs every render, and the pane closes when it stops existing. */
  | { kind: 'cert'; certId: string; soldier: ClinicMedic }
  | { kind: 'cert-new'; soldier: ClinicMedic }

/** Who a terminal is about. Grading is reached from a roster row and a record
 *  carries its own soldier, so in both cases this differs from the rail's
 *  subject at any group scope. A week is about the whole scope and therefore
 *  about nobody in particular — the rail's subject names it. */
function paneSoldierOf(pane: PaneScreen): ClinicMedic | null {
  if (pane.kind === 'week') return null
  return pane.kind === 'record' ? pane.record.soldier : pane.soldier
}

/** What the pane's chrome calls a terminal. Derived, never stored — a title held
 *  beside the thing it names is a second copy that can go stale. A cert is the
 *  case that proves it: its title is editable, so the drawer names it from the
 *  live row rather than from the stack (see paneTitle). */
function paneTitleOf(pane: PaneScreen): string {
  if (pane.kind === 'evaluate-task') return pane.taskTitle
  if (pane.kind === 'evaluate-algorithm') return pane.algorithmName
  if (pane.kind === 'week') return `Week of ${weekStartLabel(pane.start)}`
  if (pane.kind === 'cert-new') return 'New certification'
  if (pane.kind === 'cert') return 'Certification'
  return recordItemLabel(pane.record.completion.trainingItemId)
}

/** Blank fields are absent facts, not empty strings — the columns are nullable,
 *  and a "" expiration would read as a date the row does not have (and sorts
 *  ahead of every real one). */
function certInput(form: CertFormData) {
  return {
    title: form.title.trim(),
    cert_number: form.cert_number.trim() || null,
    issue_date: form.issue_date || null,
    exp_date: form.exp_date || null,
    is_primary: form.is_primary,
  }
}

interface SupervisorDrawerProps {
  isVisible: boolean
  onClose: () => void
}

export function SupervisorDrawer({ isVisible, onClose }: SupervisorDrawerProps) {
  const [subject, setSubject] = useState<TreeSelection>({ type: 'cluster' })
  const [section, setSection] = useState<Section>('training')
  const [centerStack, setCenterStack] = useState<CenterScreen[]>([])
  /** The pane is a STACK, and it is one only because a week of the activity graph
   *  is a list that reaches a record. Everything else on this axis is a single
   *  terminal entered from the center, which is why openPane RESETS rather than
   *  pushes: a grade started from a roster row is not a step deeper into whatever
   *  the pane happened to be showing. */
  const [paneStack, setPaneStack] = useState<PaneScreen[]>([])
  /** Why the last grade did not take. Held on the drawer rather than inside the
   *  evaluator because it must survive the evaluator staying mounted — the whole
   *  point is that the walk is still on screen with its measures marked. */
  const [paneError, setPaneError] = useState<string | null>(null)
  /** The open record's ellipsis, published up by RecordDetail so the pane header
   *  (desktop) and the sheet's action pill (mobile) render one object-level menu
   *  in the one place this app keeps object actions. */
  const [recordHeaderActions, setRecordHeaderActions] = useState<ReactNode>(null)
  /** A record list's row menu, and why the last act on one was refused. Held here
   *  rather than in TaskRecords because the list is rendered in two places (the
   *  week pane and the drill) and a delete needs a confirm that outlives the row
   *  it was ordered from. */
  const [rowMenu, setRowMenu] = useState<
    { record: TaskRecord; rect: DOMRect; open: (record: TaskRecord) => void } | null
  >(null)
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<TaskRecord | null>(null)
  const [listError, setListError] = useState<string | null>(null)
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
  const pane = paneStack[paneStack.length - 1] ?? null
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
    certs,
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

  // ── Algorithms (volume) ────────────────────────────────────────────────────

  // Scoped the same way the training activity is, and from the same raw stream:
  // the fold collapses repeat reads, so a folded row can say "ran it" but never
  // "ran it eleven times", which is the only thing this stop is asking.
  const encounterWeeks = useMemo(
    () => rollupEncounterActivity(trainingEvents, scopeIds),
    [trainingEvents, scopeIds],
  )

  // Only what was actually logged, volume-descending — the stop is a breakdown of
  // what exists, so a never-run category is not a row waiting to be scanned past.
  const encounterCatalog = useMemo(
    () => rollupEncounterReads(trainingEvents, scopeIds).categories,
    [trainingEvents, scopeIds],
  )

  // ── Certifications ─────────────────────────────────────────────────────────

  // Certs are fetched for the whole roster and sliced here, exactly like the
  // competency matrix: a cert row is about one person and says nothing about who
  // else is in scope, so a sub-cluster's rows are literally the cluster's rows.
  const scopeCerts = useMemo(
    () => certs.filter(c => scopeIds.has(c.user_id)),
    [certs, scopeIds],
  )

  const certRows = useMemo(
    () => buildCertTitleRows(scopeMedics, scopeCerts),
    [scopeMedics, scopeCerts],
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
    // The refusal was about a row in the list being left behind.
    setListError(null)
  }, [])

  /** Leaves the pane axis entirely. What a submitted grade or a completed act
   *  does — the surface it came from is the center, not the step below it. */
  const closePane = useCallback(() => {
    setPaneStack([])
    setPaneError(null)
  }, [])

  /** Enter the pane from the CENTER. Resets the stack, so the pane always shows
   *  what was just asked for rather than stacking it on a leftover. */
  const openPane = useCallback((screen: PaneScreen) => {
    setPaneStack([screen])
    setPaneError(null)
  }, [])

  /** One step deeper INSIDE the pane — a week's record, a record's re-walk. */
  const pushPane = useCallback((screen: PaneScreen) => {
    setPaneStack(prev => [...prev, screen])
    setPaneError(null)
  }, [])

  /** Back out one pane step. From a week's record that is the week, so a delete
   *  returns to the list it was deleted from rather than dropping the supervisor
   *  back to the graph to re-open the same column. */
  const popPane = useCallback(() => {
    setPaneStack(prev => prev.slice(0, -1))
    setPaneError(null)
  }, [])

  /** The pane's own back: a step if there is one under it, otherwise out. */
  const paneBack = useCallback(() => {
    if (paneStack.length > 1) popPane()
    else closePane()
  }, [paneStack.length, popPane, closePane])

  /** Selecting a subject is not a step, so there is nothing behind it to go back
   *  to — back unwinds the pane, then the center drill, and stops. */
  const handleBack = useCallback(() => {
    if (pane) { paneBack(); return }
    if (centerStack.length > 0) popCenter()
  }, [pane, centerStack.length, paneBack, popCenter])

  const handleClose = useCallback(() => {
    setSubject({ type: 'cluster' })
    setCenterStack([])
    setPaneStack([])
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
    // Each drill brings its own records; a refusal from the last one is not
    // about any row in this list.
    setListError(null)
  }, [])

  /** A body-system category. The same axis an ICTL category sits on — a list you
   *  scan — so it pushes the center rather than opening the pane. */
  const handleSelectAlgoCategory = useCallback((category: string) => {
    setCenterStack(prev => [...prev, { kind: 'algo-category', category }])
  }, [])

  /** A credential's holder roster. Carries the display title for the header and
   *  the match key for the fold — the two differ because the roster is grouped on
   *  a normalised title (see buildCertTitleRows). */
  const handleSelectCertTitle = useCallback((row: CertTitleRow) => {
    setCenterStack(prev => [...prev, { kind: 'cert', title: row.title, certKey: row.key }])
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
    openPane({ kind: 'evaluate-task', soldier, taskNumber: taskId, taskTitle })
  }, [openPane])

  const handleEvaluateAlgorithm = useCallback((soldier: ClinicMedic, algorithmId: string, algorithmName: string) => {
    openPane({ kind: 'evaluate-algorithm', soldier, algorithmId, algorithmName })
  }, [openPane])

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
    openPane({ kind: 'record', record })
  }, [openPane])

  /**
   * A week of the activity graph, as the records that now sit in it.
   *
   * The graph was the one surface in this drawer that said WHEN and could not be
   * asked about it — every column was a count with nothing behind it. This is
   * that answer, and it deliberately reuses the record list the drill already
   * uses rather than growing a second one: the rows are the same rows, and the
   * terminal they open is the same terminal.
   */
  const handleSelectWeek = useCallback((start: number) => {
    openPane({ kind: 'week', start })
  }, [openPane])

  /** A record reached FROM a week is a step inside the pane, so it pushes — back
   *  returns to the week's list, and a delete lands there too. */
  const handleOpenWeekRecord = useCallback((record: TaskRecord) => {
    pushPane({ kind: 'record', record })
  }, [pushPane])

  /** Read off the STACK, not off the top of it: opening a record from a week
   *  pushes over the list, and the column it came from has to stay lit under the
   *  terminal or the graph deselects itself the moment you act on it. Same rule
   *  as the center, where the open area survives a drill into one of its tasks. */
  const openWeek = useMemo(() => {
    const step = paneStack.find(s => s.kind === 'week')
    return step?.kind === 'week' ? step.start : null
  }, [paneStack])

  const weekRecords = useMemo(
    () => (openWeek == null ? [] : collectWeekRecords(scopeMedics, completionsForSoldier, openWeek)),
    [openWeek, scopeMedics, completionsForSoldier],
  )

  /**
   * Events the column counted whose record has since moved on.
   *
   * The bars are RAW events and the list is FOLDED records (see
   * collectWeekRecords), so a task read twice in one week draws two but lists
   * one, and a grade corrected in August leaves July's column standing while its
   * row sits under August. Both are right, and a supervisor comparing a bar of
   * five against a list of three deserves the sentence rather than the doubt.
   */
  const weekSuperseded = useMemo(() => {
    if (openWeek == null) return 0
    const week = activity.find(w => w.start === openWeek)
    if (!week) return 0
    const plotted = week.evaluated + week.ran
    // Assignments are listed and never plotted — they cannot account for a gap.
    const listed = weekRecords.filter(r => r.completion.completionType !== 'assignment').length
    return Math.max(0, plotted - listed)
  }, [openWeek, activity, weekRecords])

  /**
   * Void the record and purge the events behind it (see trainingService's
   * tombstone-then-purge). The linked calendar event is NOT touched: deleting a
   * grade is not cancelling the training block it was given at, and the link is
   * dropped so nothing points at a record that no longer exists.
   *
   * A refused delete holds the surface open with the reason — the same contract
   * as a refused grade, and for the same reason: a dead write that closes the
   * surface looks like it worked. WHERE the reason lands follows where the act
   * was ordered from: the terminal's banner when it was the terminal, the list's
   * own pill when it was a row, because a row deleted from a list leaves the list
   * standing and the pane banner is nowhere near it.
   */
  const deleteRecord = useCallback(async (record: TaskRecord, fromTerminal: boolean) => {
    const fail = fromTerminal ? setPaneError : setListError
    if (!currentUserId) { fail('Not signed in — the record was not deleted.'); return }
    const res = await deleteCompletion(record.completion.id, currentUserId)
    if (!res.success) { fail(res.error); return }
    refreshData()
    // Only the terminal steps back. A row's list is what you were reading, and
    // the deleted row simply stops being in it on the refresh.
    if (fromTerminal) popPane()
  }, [currentUserId, refreshData, popPane])

  const handleDeleteRecord = useCallback(
    (record: TaskRecord) => { void deleteRecord(record, true) },
    [deleteRecord],
  )

  /** A row's ellipsis. The menu is built at the render site — it needs the same
   *  re-walkable test the terminal makes, and building it here would put the test
   *  in two places.
   *
   *  Each list hands in its OWN open: a week's row is a step deeper inside the
   *  pane (back returns to the week), a drill's row enters the pane from the
   *  center. The menu's Open has to be the row's own verb or opening from a
   *  week's menu would drop the week the row belongs to. */
  const handleOpenWeekRowMenu = useCallback((record: TaskRecord, rect: DOMRect) => {
    setListError(null)
    setRowMenu({ record, rect, open: handleOpenWeekRecord })
  }, [handleOpenWeekRecord])

  const handleOpenDrillRowMenu = useCallback((record: TaskRecord, rect: DOMRect) => {
    setListError(null)
    setRowMenu({ record, rect, open: handleOpenRecord })
  }, [handleOpenRecord])

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
    popPane()
  }, [currentUserId, refreshData, popPane])

  /** Correcting a grade means walking the measures again, so the record hands
   *  the pane to the evaluator rather than editing a result in place. The new
   *  grade replaces the old row on the next fold — same (soldier, item, type).
   *
   *  Pushed rather than opened: abandoning the re-walk should put the record back
   *  as it was, not throw the supervisor out of the pane. A SUBMITTED one still
   *  closes the whole stack — the record under it describes the row that grade
   *  just replaced. */
  const handleReEvaluateRecord = useCallback((record: TaskRecord) => {
    const itemId = record.completion.trainingItemId
    pushPane({
      kind: 'evaluate-task',
      soldier: record.soldier,
      taskNumber: itemId,
      taskTitle: recordItemLabel(itemId),
    })
  }, [pushPane])

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

  // ── Certifications (the pane's fifth terminal) ─────────────────────────────

  /**
   * The open cert, re-read from the fetched rows every render.
   *
   * The stack holds an ID for this — a cert is UPDATEd in place, so a copy
   * carried on the stack would show the pre-verify row the instant the verify
   * succeeded, and the supervisor would press the button again. Null once the row
   * is gone, which the body says rather than the drawer guessing.
   */
  const openCert = useMemo<CertHolder | null>(() => {
    if (pane?.kind !== 'cert') return null
    const cert = certs.find(c => c.id === pane.certId)
    return cert
      ? { soldier: pane.soldier, cert, status: getExpirationStatus(cert.exp_date) }
      : null
  }, [pane, certs])

  const handleOpenCert = useCallback((holder: CertHolder) => {
    openPane({ kind: 'cert', certId: holder.cert.id, soldier: holder.soldier })
  }, [openPane])

  /** Filing a card a supervisor is holding. Soldier scope only — the row is
   *  written against one person, and at group scope there is nobody to write it
   *  against without asking a second question the FAB has no room for. */
  const handleAddCert = useCallback(() => {
    const soldier = subject.type === 'soldier' ? scopeMedics[0] : null
    if (!soldier) return
    openPane({ kind: 'cert-new', soldier })
  }, [subject, scopeMedics, openPane])

  const handleCreateCert = useCallback(async (form: CertFormData) => {
    if (pane?.kind !== 'cert-new') return
    const res = await adminAddCertification(pane.soldier.id, certInput(form))
    // A refused write leaves the form exactly as typed — same contract as a
    // refused grade, and for the same reason.
    if (!res.success) { setPaneError(res.error); return }
    setPaneError(null)
    refreshData()
    closePane()
  }, [pane, refreshData, closePane])

  /** A cert is EDITED, not re-recorded. The training records around it are a fold
   *  over append-only events; this is a plain row with an UPDATE policy, so the
   *  correction is the update. */
  const handleSaveCert = useCallback(async (holder: CertHolder, form: CertFormData) => {
    const res = await updateCertification(holder.cert.id, certInput(form))
    if (!res.success) { setPaneError(res.error); return }
    setPaneError(null)
    refreshData()
    // The terminal STAYS OPEN. Saving a cert is not leaving it — the row it
    // re-reads is the one just written, and the next act (verify, upload) is
    // usually the reason the supervisor opened it.
  }, [refreshData])

  /** The supervisor's signature. The holder can write the row; only a supervisor
   *  can say they saw the card, which is what verified_by records. */
  const handleVerifyCert = useCallback(async (holder: CertHolder, verified: boolean) => {
    if (verified && !currentUserId) {
      setPaneError('Not signed in — the certification was not verified.')
      return
    }
    const res = verified
      ? await verifyCertification(holder.cert.id, currentUserId as string)
      : await unverifyCertification(holder.cert.id)
    if (!res.success) { setPaneError(res.error); return }
    setPaneError(null)
    refreshData()
  }, [currentUserId, refreshData])

  const handleDeleteCert = useCallback(async (holder: CertHolder) => {
    const res = await adminDeleteCertification(
      holder.cert.id,
      holder.cert.user_id,
      holder.cert.is_primary,
    )
    if (!res.success) { setPaneError(res.error); return }
    // Best-effort, and after the row: an orphaned blob is a storage cost, a
    // deleted document beside a surviving row is a lie.
    void removeCertDocument(holder.cert.user_id, holder.cert.id)
    setPaneError(null)
    refreshData()
    popPane()
  }, [refreshData, popPane])

  /**
   * The renewal, handed to the calendar — the same hand-off Assign makes, and for
   * the same reason: the calendar owns scheduling, and a second composer here
   * would be a second place for a date to be wrong.
   *
   * Seeded THIRTY DAYS BEFORE the expiration rather than on it. A reminder that
   * fires the day a card lapses is a notification about a fact, not a chance to
   * act; a lapsed or nearly-lapsed cert falls back to tomorrow, which is the
   * soonest an unlapsing can start.
   */
  const handleRemindCert = useCallback((holder: CertHolder) => {
    const { cert, soldier } = holder
    if (!cert.exp_date) return
    const exp = new Date(`${cert.exp_date}T09:00:00`)
    const lead = new Date(exp)
    lead.setDate(lead.getDate() - 30)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const when = lead.getTime() > Date.now() ? lead : tomorrow
    const pad = (n: number) => `${n}`.padStart(2, '0')
    const startISO = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`

    requestNewCalendarEvent({
      title: `Certification renewal — ${cert.title}`,
      category: 'appointment',
      startISO,
      assignedTo: [soldier.id],
      notes: `${formatMedicName(soldier)} · ${cert.title} expires ${cert.exp_date}.`,
    })
    handleClose()
  }, [requestNewCalendarEvent, handleClose])

  /** The credential roster as a sheet. No date window, unlike the completions
   *  export: a cert is a STATE, and bounding state by a date range answers a
   *  question nobody asked (see certificationCsv). */
  const handleExportCerts = useCallback(async () => {
    const rows = buildCertificationExportRows(scopeCerts, {
      resolveName,
      resolveVerifier: resolveName,
    })
    if (rows.length === 0) return
    try {
      await shareCertificationCsv(rows, certificationCsvFilename(subjectLabel))
    } catch {
      // A cancelled Web Share sheet lands here too, so this is not surfaced.
    }
  }, [scopeCerts, resolveName, subjectLabel])

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

    const soldierScope = subject.type === 'soldier' ? scopeMedics[0] : null

    // The FAB follows the STOP as well as the rail. On Certs the standing pull is
    // the credential roster, not the completions one — offering "Export
    // completions" from a surface with no completion on it is the same fault the
    // scope-blind pills had, one axis over.
    if (section === 'certs') {
      const certOptions: { key: string; label: string; onAction: () => void }[] = []
      if (soldierScope) {
        certOptions.push({
          key: 'add-cert',
          label: 'Add certification',
          onAction: handleAddCert,
        })
      }
      // Nothing to pull is not a dimmed row — it is no row (see no-disabled-actions).
      if (scopeCerts.length > 0) {
        certOptions.push({
          key: 'export-certs',
          label: 'Export certifications',
          onAction: () => { void handleExportCerts() },
        })
      }
      return certOptions
    }

    const options: { key: string; label: string; onAction: () => void }[] = [
      { key: 'export', label: 'Export completions', onAction: () => setExportOpen(true) },
    ]

    const soldier = soldierScope
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
  }, [
    isChildScope, subject, scopeMedics, center, section, scopeCerts.length,
    handleEvaluateTask, handleEvaluateAlgorithm, handleScheduleAlgorithm, handleAssign,
    handleAddCert, handleExportCerts,
  ])

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
    //
    // An algorithm reached from the Algorithms stop has NO area under it, and
    // that is fine: the area supplies the ICTL task list, which an algorithm
    // roster does not read. The empty list is what "there is no category above
    // this" looks like, not a missing prop.
    const areaScreen = centerStack.find(s => s.kind === 'area')
    const drillScreen = center?.kind === 'drill' ? center : null
    if (areaScreen || drillScreen) {
      const drill = drillScreen?.selection ?? null
      return (
        <CoverageTasksView
          selection={drill}
          onSelect={handleSelectDrill}
          tasks={areaScreen ? testableTaskMap.get(areaScreen.areaName) ?? [] : []}
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
          onOpenRecordMenu={handleOpenDrillRowMenu}
          recordError={listError}
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
          onSelectWeek={handleSelectWeek}
          selectedWeek={openWeek}
        />
      )
    }

    // A subordinate cluster publishes ICTL coverage and an activity series and
    // nothing else — no encounter volume, no cert rows. Both stops say so rather
    // than drawing zeroes over a scope whose records are sealed in its own vault.
    if (isChildScope) {
      return (
        <p className="text-sm text-tertiary text-center py-12">
          {subjectLabel} publishes training readiness only.
        </p>
      )
    }

    if (section === 'algorithms') {
      return (
        <AlgorithmsView
          weeks={encounterWeeks}
          categories={encounterCatalog}
          category={center?.kind === 'algo-category' ? center.category : null}
          onSelectCategory={handleSelectAlgoCategory}
        />
      )
    }

    const certScreen = center?.kind === 'cert' ? center : null
    return (
      <CertsView
        rows={certRows}
        holders={certScreen ? collectCertHolders(scopeMedics, scopeCerts, certScreen.certKey) : []}
        title={certScreen?.title ?? null}
        single={subject.type === 'soldier'}
        onSelectTitle={handleSelectCertTitle}
        onOpenCert={handleOpenCert}
        onAddCert={subject.type === 'soldier' ? handleAddCert : undefined}
      />
    )
  }

  const sectionStops: SliderStop[] = [
    { id: 'training', title: 'Training', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'algorithms', title: 'Algorithms', icon: <Activity className="w-5 h-5" /> },
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

  /** A cert names itself from the LIVE row — its title is editable, so the one
   *  on the stack would be the pre-edit spelling for as long as the pane stayed
   *  open. Everything else on this axis is named by something immutable. */
  const paneTitle = !pane ? ''
    : pane.kind === 'cert' ? (openCert?.cert.title ?? paneTitleOf(pane))
      : paneTitleOf(pane)

  /** Who the terminal is about — NOT the rail's subject. Grading is reached from
   *  a roster row, so at cluster scope the two differ, and an eyebrow naming the
   *  cluster over one soldier's scorecard is the wrong name in the one place a
   *  supervisor needs it right.
   *
   *  A RECORD CARRIES NEITHER. Its chrome is a title, an ellipsis and a close —
   *  a three-line stack is breadcrumb furniture, and this pane does not
   *  breadcrumb. The soldier and the item id are FACTS about the record, so they
   *  are rows in its body where every other fact about it already is. The
   *  evaluator keeps the stack because its body deliberately names none of the
   *  three (EvaluationStep) — drop them there and grading goes anonymous. */
  const paneSoldier = pane ? paneSoldierOf(pane) : null
  const paneEyebrow = !pane || pane.kind === 'record'
    ? undefined
    : paneSoldier ? formatMedicName(paneSoldier) : subjectLabel

  /** The packet number. It used to head the evaluator's body; it belongs with the
   *  title that names the same thing, not a line below it. A week has no such
   *  identifier — its rows each name their own — so it carries none, and neither
   *  does a cert: its number is a fact ON the card, listed with the rest of them. */
  const paneSubtitle = !pane
    || pane.kind === 'week' || pane.kind === 'record'
    || pane.kind === 'cert' || pane.kind === 'cert-new'
    ? undefined
    : pane.kind === 'evaluate-task' ? pane.taskNumber
      : pane.algorithmId

  /** Object actions belong in the chrome beside Close, not in the body. A record
   *  and a cert are the two terminals that HAVE any — they act on a row that
   *  already exists. Everything else commits through its own FAB. Both publish
   *  their menu up through the same slot, so only one can be open at a time,
   *  which the pane stack already guarantees. */
  const paneActions = pane?.kind === 'record' || pane?.kind === 'cert'
    ? recordHeaderActions
    : null

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
    const isCertPane = pane.kind === 'cert' || pane.kind === 'cert-new'
    const errorBanner = paneError ? (
      <div className="mx-4 mt-4 rounded-lg bg-themeredred/10 px-3 py-2">
        <p className="text-sm text-themeredred">{paneError}</p>
        <p className="text-[9pt] text-tertiary mt-0.5">
          {isCertPane
            // A cert write is online-only (the row is not event-sourced, so it
            // does not ride the sync queue), which is what most refusals here
            // actually mean.
            ? 'Nothing was saved. The card is unchanged — try again when you are back on a connection.'
            : 'Nothing was recorded. The grades below are still here — submit again.'}
        </p>
      </div>
    ) : null

    if (pane.kind === 'week') {
      return (
        <div className="px-4 pb-4">
          {weekSuperseded > 0 && (
            <p className="mt-4 text-[9pt] text-tertiary leading-snug">
              {weekSuperseded} earlier {weekSuperseded === 1 ? 'entry' : 'entries'} from this week
              {weekSuperseded === 1 ? ' was' : ' were'} recorded again later — the graph still
              counts the work, but the record now sits under the newer date.
            </p>
          )}
          <TaskRecords
            records={weekRecords}
            onOpen={handleOpenWeekRecord}
            onOpenMenu={handleOpenWeekRowMenu}
            error={listError}
            // At soldier scope every row is about the person the card already
            // names; at any group scope the name IS what separates the rows.
            hideSoldier={subject.type === 'soldier'}
            emptyLabel="Every record from this week has since been re-recorded — nothing stands here now."
          />
        </div>
      )
    }

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
          {/* Handlers pass through UNWRAPPED — the record comes back on the
              callback. RecordDetail memoizes the header menu it publishes up
              here, so a closure minted per render would republish per render and
              set state on this component in a loop. */}
          {/* Keyed on the record: the pane swaps one record for another in the
              same slot (week list → row → back → another row), and an unkeyed
              remount would carry the previous assignment's edit state into it. */}
          <RecordDetail
            key={pane.record.completion.id}
            record={pane.record}
            resolveName={resolveName}
            onReEvaluate={reWalkable ? handleReEvaluateRecord : undefined}
            onSaveAssignment={pendingAssignment ? handleSaveAssignment : undefined}
            onDelete={handleDeleteRecord}
            onHeaderActions={setRecordHeaderActions}
          />
        </>
      )
    }

    if (pane.kind === 'cert') {
      // Gone rather than empty: a cert deleted from another device (or from the
      // profile page the soldier owns) leaves this terminal pointed at nothing,
      // and a blank card would read as a load that never finished.
      if (!openCert) {
        return (
          <p className="px-4 py-12 text-sm text-tertiary text-center">
            This certification is no longer on file.
          </p>
        )
      }
      return (
        <>
          {errorBanner}
          {/* Keyed on the cert for the same reason RecordDetail is: the pane
              swaps one row for another in the same slot, and an unkeyed remount
              would carry the previous card's edit state into it. */}
          <CertDetail
            key={openCert.cert.id}
            holder={openCert}
            resolveName={resolveName}
            onSave={handleSaveCert}
            onVerify={handleVerifyCert}
            onRemind={openCert.cert.exp_date ? handleRemindCert : undefined}
            onDelete={handleDeleteCert}
            onHeaderActions={setRecordHeaderActions}
          />
        </>
      )
    }

    if (pane.kind === 'cert-new') {
      return (
        <>
          {errorBanner}
          <CertCompose onSave={handleCreateCert} />
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
                          onBack={paneBack}
                          backLabel="Back"
                          actions={paneActions ? <HeaderPill>{paneActions}</HeaderPill> : undefined}
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
          onClose={() => { setPaneStack([]); setRailSheetOpen(false) }}
          title={pane ? paneTitle : 'Personnel'}
          // Mobile's counterpart to PaneHeader's eyebrow/title/subtitle stack.
          // The evaluator's body no longer names the soldier, the task or the
          // number, so this is where all three have to be — `title` alone would
          // drop two of them. Each line is conditional: a week has no packet
          // number and a record has neither line at all (see paneEyebrow), and an
          // empty caption reserves height for nothing.
          titleNode={pane ? (
            <div className="min-w-0">
              {paneEyebrow && <div className="truncate text-[9pt] text-tertiary">{paneEyebrow}</div>}
              <div className="truncate text-[10pt] font-semibold text-primary">{paneTitle}</div>
              {paneSubtitle && (
                <div className="truncate text-[9pt] text-tertiary font-mono">{paneSubtitle}</div>
              )}
            </div>
          ) : undefined}
          // The rail caps at 60svh so the center it re-scopes stays read behind
          // it — a picker you glance at. The evaluator is not that: it is twenty
          // graded measures you work down, and a 60% window turns one standard
          // into a scroll. Same surface, and the cap follows what is on it.
          //
          // A week takes the rail's cap for the rail's reason: the column that
          // opened it is what the list is ABOUT, and a sheet that swallows the
          // graph leaves the supervisor reading a date with no bar beside it.
          height="fit"
          maxHeight={!pane || pane.kind === 'week' ? 60 : 92}
          zIndex={1200}
          // Folded INSIDE the close pill, so the record's ellipsis and Close read
          // as one cluster rather than two floating controls.
          actions={paneActions ?? undefined}
          leftContent={pane ? (
            <button
              type="button"
              onClick={paneBack}
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

      {/* A record row's menu — the same verbs the record's own terminal carries,
          reached without opening it. Open is one of them on purpose: the row IS
          the tap target, but a menu that offers only the destructive half of what
          the row does reads as a delete button wearing an ellipsis. */}
      {rowMenu && (() => {
        const c = rowMenu.record.completion
        const reWalkable = c.completionType === 'test'
          && (getEvaluableTaskData(c.trainingItemId)?.gradedSteps?.length ?? 0) > 0
        const items: ContextMenuItem[] = [
          { key: 'open', label: 'Open record', icon: ChevronRight, onAction: () => rowMenu.open(rowMenu.record) },
        ]
        if (reWalkable) {
          items.push({
            key: 're-evaluate',
            label: 'Re-evaluate',
            icon: ClipboardCheck,
            onAction: () => handleReEvaluateRecord(rowMenu.record),
          })
        }
        items.push({
          key: 'delete',
          label: 'Delete record',
          icon: Trash2,
          destructive: true,
          onAction: () => setConfirmDeleteRow(rowMenu.record),
        })
        return (
          <AnchoredMenu
            isOpen
            anchorRect={rowMenu.rect}
            layout="list"
            align="right"
            items={items}
            onClose={() => setRowMenu(null)}
          />
        )
      })()}

      {/* The row delete's guard. Identical copy to the terminal's, because it is
          the identical act — only the surface it was ordered from differs. */}
      <ConfirmDialog
        visible={!!confirmDeleteRow}
        title="Delete this record?"
        subtitle={
          confirmDeleteRow?.completion.completionType === 'test'
            ? "The grade is voided and its events are purged. The soldier's coverage falls back to whatever else is on file."
            : 'The record is voided and its events are purged.'
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          const record = confirmDeleteRow
          setConfirmDeleteRow(null)
          if (record) void deleteRecord(record, false)
        }}
        onCancel={() => setConfirmDeleteRow(null)}
        zIndex={1300}
      />

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
