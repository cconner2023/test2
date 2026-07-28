import { useState, useCallback, useMemo, useEffect } from 'react'
import { Ban, X } from 'lucide-react'
import { BaseDrawer, ScrollPane } from '@/Components/primitives/BaseDrawer'
import { ContentWrapper } from '@/Components/primitives/ContentWrapper'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane'
import { PaneHeader } from '@/Components/primitives/PaneHeader'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useEscBackout } from '../Hooks/useEscBackout'
import { UI_TIMING } from '../Utilities/constants'
import { useTrainingCompletions } from '../Hooks/useTrainingCompletions'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useSupervisorData } from './Settings/Supervisor/useSupervisorData'
import { isEncounterEvent, buildAlgorithmCompetency } from './Settings/Supervisor/supervisorHelpers'
import { SoldierProfile } from './Settings/Supervisor/SoldierProfile'
import { TimelineFullView, useSubjectTimelineRows, buildTimelineCalendarEntries } from './Timeline/UserTimeline'
import { EvaluateFlow } from './Settings/Supervisor/EvaluateFlow'
import { AlgorithmEvaluateFlow } from './Settings/Supervisor/AlgorithmEvaluateFlow'
import { TeamReporting } from './Settings/Supervisor/TeamReporting'
import { SubordinateUnitsCards } from './Settings/Supervisor/SubordinateUnitsCards'
import { EncounterRollupCard } from './Settings/Supervisor/EncounterRollupCard'
import { ChildClinicRosterBody } from './Settings/Supervisor/ChildClinicRosterSheet'
import { CoverageTasksView } from './Settings/Supervisor/CoverageTasksView'
import { AlgorithmCoverageView } from './Settings/Supervisor/AlgorithmCoverageView'
import { AlgorithmGapList } from './Settings/Supervisor/AlgorithmGapList'
import { SoldierAlgorithmList } from './Settings/Supervisor/SoldierAlgorithmList'
import { SupervisorTree, type TreeSelection } from './Settings/Supervisor/SupervisorTree'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { useMinLoadTime } from '../Hooks/useMinLoadTime'
import { ClinicIdentityEditPopover } from './ClinicAdmin/ClinicIdentityEditPopover'
import { MemberEditPopover } from './ClinicAdmin/MemberEditPopover'
import { AddMemberPopover } from './ClinicAdmin/AddMemberPopover'
import { useClinicMedics } from '../Hooks/useClinicMedics'
import { getClinicDetails, removeSoldierFromClinic, endLoanFromClinic } from '../lib/supervisorService'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { invalidate } from '../stores/useInvalidationStore'
import { listLocations, type AdminLocation } from '../lib/adminService'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { StepResult } from '../Types/SupervisorTestTypes'

// ─── State Machine ───────────────────────────────────────────────────────────

type SupervisorView =
  | { screen: 'main' }
  | { screen: 'evaluate-select-task'; soldier: ClinicMedic }
  | { screen: 'evaluate-go-nogo'; soldier: ClinicMedic; taskNumber: string; taskTitle: string }
  | { screen: 'evaluate-algorithm'; soldier: ClinicMedic; algorithmId: string; algorithmName: string }
  | { screen: 'coverage-tasks'; areaName: string; soldier?: ClinicMedic }
  | { screen: 'coverage-task-evaluate'; areaName: string; soldier: ClinicMedic; taskNumber: string; taskTitle: string }
  | { screen: 'coverage-algorithm-list' }
  | { screen: 'coverage-algorithm'; algorithmId: string; algorithmName: string }
  | { screen: 'soldier-algorithm-list'; soldier: ClinicMedic }

interface SupervisorDrawerProps {
  isVisible: boolean
  onClose: () => void
}

export function SupervisorDrawer({ isVisible, onClose }: SupervisorDrawerProps) {
  const [view, setView] = useState<SupervisorView>({ screen: 'main' })
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({ type: 'all-personnel' })

  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
  const [taskSearchQuery, setTaskSearchQuery] = useState('')
  // Desktop left-pane personnel filter (mobile has its own scroll-reveal search).
  const [treeSearch, setTreeSearch] = useState('')
  // Desktop third pane: the selected soldier's full timeline. Mobile uses the
  // timeline's own bottom Sheet instead (UserTimeline falls back when no host).
  const [timelinePaneOpen, setTimelinePaneOpen] = useState(false)
  // Desktop right pane: a subordinate (child) cluster's roster drill. Mobile keeps
  // the SubordinateUnitsCards local Sheet instead (routed by onSelectChild absence).
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string } | null>(null)

  // Clear search when navigating between views (e.g., clicking a search result)
  useEffect(() => { setTaskSearchQuery('') }, [view.screen])

  // Close the timeline pane whenever the selected person changes.
  useEffect(() => { setTimelinePaneOpen(false) }, [treeSelection])

  const isMobile = useIsMobile()

  // ── Data ───────────────────────────────────────────────────────────────────

  const { submitTestEvaluation } = useTrainingCompletions()
  // The supervisor toggle picks which clinic this drawer administers.
  // Defaults to the assigned clinic for single-clinic users.
  const clinicId = useAuthStore(s => s.supervisingClinicId ?? s.clinicId)
  // Viewer's own clinic scopes audit decryption — mirrors SoldierProfile's
  // UserTimeline clinicId so the third-pane timeline reads identically.
  const authClinicId = useAuthStore(s => s.clinicId)
  const clinicNameFromAuth = useAuthStore(s => s.profile.clinicName)
  const calendarEvents = useCalendarStore(s => s.events)
  const openCalendarEvent = useNavigationStore(s => s.openCalendarEvent)
  const requestNewCalendarEvent = useNavigationStore(s => s.requestNewCalendarEvent)
  const { refresh: refreshMedics } = useClinicMedics()

  // ── Clinic-admin popovers (shared with Settings/ClinicPanel) ──────────────
  const [clinicEditAnchor, setClinicEditAnchor] = useState<DOMRect | null>(null)
  const [clinicDetails, setClinicDetails] = useState<{ uics: string[]; location: string | null; location_id: string | null }>({ uics: [], location: null, location_id: null })
  const [locations, setLocations] = useState<AdminLocation[]>([])
  const [memberEdit, setMemberEdit] = useState<{ memberId: string; anchor: DOMRect } | null>(null)
  const [addMemberAnchor, setAddMemberAnchor] = useState<DOMRect | null>(null)
  // Swipe-to-remove target from the roster. Loaned-in → end the loan from this
  // clinic; otherwise remove from the cluster (mirrors MemberEditPopover).
  const [removeTarget, setRemoveTarget] = useState<ClinicMedic | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  // Associated clinics for the Loans multi-select. Derived from medics whose
  // home clinic is different (gives counts + names) plus any clinics we
  // discover via getClinicDetails for accepted associations missing from
  // the medic roster. Same shape as ClinicPanel's nearbyClinicMap.
  const [nearbyDetails, setNearbyDetails] = useState<Map<string, { name: string | null; uics: string[]; location: string | null }>>(new Map())

  // Fetch clinic UIC/location for the identity-edit popover seed
  useEffect(() => {
    if (!clinicId) return
    getClinicDetails(clinicId).then((d) => {
      setClinicDetails({ uics: d.uics, location: d.location, location_id: d.location_id })
    })
  }, [clinicId, isVisible])

  useEffect(() => { listLocations().then(setLocations) }, [])

  // Resolve the home clinic's associated peers so the MemberEditPopover Loans
  // overlay can show them as toggleable rows. Source of truth is
  // clinics.associated_clinic_ids — populated atomically by redeem_clinic_invite
  // (code paste/QR) and by admin direct edits.
  const [associatedClinicsList, setAssociatedClinicsList] = useState<{ clinicId: string; clinicName: string; uics: string[]; location: string | null }[]>([])
  useEffect(() => {
    if (!clinicId) { setAssociatedClinicsList([]); return }
    let cancelled = false
    ;(async () => {
      const home = await getClinicDetails(clinicId)
      if (cancelled) return
      const peerIds = (home.associatedClinicIds ?? []).filter((id) => id && id !== clinicId)
      const details = await Promise.all(peerIds.map(async (id) => {
        const d = nearbyDetails.get(id) ?? await getClinicDetails(id)
        return [id, d] as const
      }))
      if (cancelled) return
      setNearbyDetails((prev) => {
        const next = new Map(prev)
        for (const [id, d] of details) next.set(id, { name: d.name ?? null, uics: d.uics, location: d.location })
        return next
      })
      setAssociatedClinicsList(details.map(([id, d]) => ({
        clinicId: id,
        clinicName: d.name ?? 'Unknown',
        uics: d.uics,
        location: d.location,
      })))
    })()
    return () => { cancelled = true }
  }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    loading: _loading,
    isSupervisor,
    currentUserId,
    medics,
    clinicName,
    certsForSoldier,
    testsForSoldier,
    readsForSoldier,
    assignmentsForSoldier,
    resolveName,
    updateCert,
    removeTest,
    addCert,
    removeCert,
    refreshData,
    teamMetrics,
    encounterRollup,
    testableTaskMap,
  } = useSupervisorData()
  const loading = useMinLoadTime(_loading)

  const readinessForSoldier = useCallback((soldierId: string): number => {
    const entry = teamMetrics.soldierReadiness.find(s => s.soldierId === soldierId)
    return entry?.readinessPercent ?? 0
  }, [teamMetrics.soldierReadiness])

  const windowedEvents = useMemo(() => {
    const now = new Date()
    const past7 = new Date(now); past7.setDate(past7.getDate() - 7)
    const future14 = new Date(now); future14.setDate(future14.getDate() + 14)
    return calendarEvents
      .filter(e => {
        const start = new Date(e.start_time)
        const end = new Date(e.end_time)
        return end >= past7 && start <= future14 && e.status !== 'cancelled'
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [calendarEvents])

  // Encounter log: algorithm "log to calendar" records (tagged with
  // encounter_algorithm_id). Unlike the schedule, this is the full history held
  // in the store — encounters are past events, so the 7/14-day window would hide
  // them. Newest first.
  const encounterEvents = useMemo(() => {
    return calendarEvents
      .filter(e => isEncounterEvent(e) && e.status !== 'cancelled')
      .sort((a, b) => b.start_time.localeCompare(a.start_time))
  }, [calendarEvents])

  // ── Slide Animation ────────────────────────────────────────────────────────

  const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
    setSlideDirection(direction)
    setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleViewProfile = useCallback((soldier: ClinicMedic) => {
    setSelectedChild(null)
    if (!isMobile) {
      setTreeSelection({ type: 'soldier', soldierId: soldier.id })
    } else {
      setTreeSelection({ type: 'soldier', soldierId: soldier.id })
      handleSlideAnimation('left')
    }
  }, [isMobile, handleSlideAnimation])

  // Desktop: drill a subordinate cluster into the right pane. Clears any soldier
  // selection so the pane has a single occupant; the dashboard center persists.
  const handleSelectChild = useCallback((child: { id: string; name: string }) => {
    setTreeSelection({ type: 'all-personnel' })
    setView({ screen: 'main' })
    setSelectedChild(child)
  }, [])

  const handleEvaluate = useCallback((soldier: ClinicMedic) => {

    handleSlideAnimation('left')
    setView({ screen: 'evaluate-select-task', soldier })
  }, [handleSlideAnimation])

  const handleSelectTask = useCallback((taskNumber: string, taskTitle: string) => {
    if (view.screen !== 'evaluate-select-task') return
    setTaskSearchQuery('')
    handleSlideAnimation('left')
    setView({ screen: 'evaluate-go-nogo', soldier: view.soldier, taskNumber, taskTitle })
  }, [view, handleSlideAnimation])

  const handleNavigateToArea = useCallback((areaName: string) => {
    handleSlideAnimation('left')
    setView({ screen: 'coverage-tasks', areaName })
  }, [handleSlideAnimation])

  const handleNavigateToAlgorithmList = useCallback(() => {
    handleSlideAnimation('left')
    setView({ screen: 'coverage-algorithm-list' })
  }, [handleSlideAnimation])

  const handleNavigateToAlgorithm = useCallback((algorithmId: string, algorithmName: string) => {
    handleSlideAnimation('left')
    setView({ screen: 'coverage-algorithm', algorithmId, algorithmName })
  }, [handleSlideAnimation])

  const handleOpenSoldierAlgorithms = useCallback((soldier: ClinicMedic) => {
    handleSlideAnimation('left')
    setView({ screen: 'soldier-algorithm-list', soldier })
  }, [handleSlideAnimation])

  const handleCoverageEvaluate = useCallback((soldier: ClinicMedic, taskId: string, taskTitle: string) => {
    if (view.screen !== 'coverage-tasks') return
    handleSlideAnimation('left')
    setView({ screen: 'coverage-task-evaluate', areaName: view.areaName, soldier, taskNumber: taskId, taskTitle })
  }, [view, handleSlideAnimation])

  const handleSubmitEvaluation = useCallback(async (stepResults: StepResult[], notes: string) => {
    if (view.screen !== 'evaluate-go-nogo' && view.screen !== 'coverage-task-evaluate') return

    const hasNoGo = stepResults.some(s => s.result === 'NO_GO')
    await submitTestEvaluation({
      medicUserId: view.soldier.id,
      trainingItemId: view.taskNumber,
      result: hasNoGo ? 'NO_GO' : 'GO',
      stepResults,
      supervisorNotes: notes || undefined,
    })

    refreshData()
    if (view.screen === 'coverage-task-evaluate') {
      // Return to the coverage tasks view for the same area
      setView({ screen: 'coverage-tasks', areaName: view.areaName })
    } else {
      setView({ screen: 'main' })
      setTreeSelection({ type: 'all-personnel' })
    }
  }, [view, submitTestEvaluation, refreshData])

  // ── Algorithm competency: evaluate (cascades to STPs) + schedule ────────────

  const handleEvaluateAlgorithm = useCallback((soldier: ClinicMedic, algorithmId: string, algorithmName: string) => {
    handleSlideAnimation('left')
    setView({ screen: 'evaluate-algorithm', soldier, algorithmId, algorithmName })
  }, [handleSlideAnimation])

  /** Persist one unit of an algorithm evaluation — STP units write real STP
   *  completions (the cascade), synthetic units write algo:<id>:<dim> keys. */
  const handleSubmitAlgorithmUnit = useCallback(async (trainingItemId: string, stepResults: StepResult[], notes: string) => {
    if (view.screen !== 'evaluate-algorithm') return
    const hasNoGo = stepResults.some(s => s.result === 'NO_GO')
    await submitTestEvaluation({
      medicUserId: view.soldier.id,
      trainingItemId,
      result: hasNoGo ? 'NO_GO' : 'GO',
      stepResults,
      supervisorNotes: notes || undefined,
    })
  }, [view, submitTestEvaluation])

  const handleAlgorithmEvalComplete = useCallback(() => {
    if (view.screen !== 'evaluate-algorithm') return
    const soldierId = view.soldier.id
    refreshData()
    setView({ screen: 'main' })
    setTreeSelection({ type: 'soldier', soldierId })
  }, [view, refreshData])

  const handleBack = useCallback(() => {
    if (view.screen === 'evaluate-go-nogo') {
      handleSlideAnimation('right')
      setView({ screen: 'evaluate-select-task', soldier: view.soldier })
    } else if (view.screen === 'evaluate-algorithm') {
      handleSlideAnimation('right')
      const soldierId = view.soldier.id
      setView({ screen: 'main' })
      setTreeSelection({ type: 'soldier', soldierId })
    } else if (view.screen === 'coverage-task-evaluate') {
      handleSlideAnimation('right')
      setView({ screen: 'coverage-tasks', areaName: view.areaName })
    } else if (view.screen === 'coverage-algorithm') {
      handleSlideAnimation('right')
      setView({ screen: 'coverage-algorithm-list' })
    } else if (view.screen === 'soldier-algorithm-list') {
      handleSlideAnimation('right')
      const soldierId = view.soldier.id
      setView({ screen: 'main' })
      setTreeSelection({ type: 'soldier', soldierId })
    } else if (view.screen !== 'main') {
      handleSlideAnimation('right')
      setTaskSearchQuery('')
      setView({ screen: 'main' })
    } else if (selectedChild) {
      // Close the subordinate-cluster drill → right pane closes, rail returns.
      handleSlideAnimation('right')
      setSelectedChild(null)
    } else if (treeSelection.type !== 'all-personnel') {
      // Deselect the soldier → closes the right detail pane and (desktop) brings
      // the tree rail back. Slide animation is a no-op on desktop.
      handleSlideAnimation('right')
      setTreeSelection({ type: 'all-personnel' })
    }
  }, [view, treeSelection, selectedChild, handleSlideAnimation])

  const handleClose = useCallback(() => {
    setView({ screen: 'main' })
    setTreeSelection({ type: 'all-personnel' })
    setSlideDirection('')
    setClinicEditAnchor(null)
    setMemberEdit(null)
    setAddMemberAnchor(null)
    setTimelinePaneOpen(false)
    setSelectedChild(null)

    onClose()
  }, [onClose])

  const handleScheduleAlgorithm = useCallback((soldier: ClinicMedic, algorithmId: string, algorithmName: string) => {
    requestNewCalendarEvent({
      title: `Algorithm training — ${algorithmName}`,
      category: 'training',
      encounterAlgorithmId: algorithmId,
      assignedTo: [soldier.id],
    })
    handleClose()
  }, [requestNewCalendarEvent, handleClose])

  // Assigning a task opens the real calendar compose (same pathway as scheduling
  // an algorithm) with the soldier + STP task prefilled — no hand-rolled due-date
  // step. The calendar SAVE mints the linked training assignment (keyed by the
  // trainingItemId prefill), so desktop and mobile route identically.
  const handleCoverageAssign = useCallback((soldier: ClinicMedic, taskId: string, taskTitle: string) => {
    requestNewCalendarEvent({
      title: `Training: ${taskTitle}`,
      category: 'training',
      assignedTo: [soldier.id],
      trainingItemId: taskId,
    })
    handleClose()
  }, [requestNewCalendarEvent, handleClose])

  const handleOpenEvent = useCallback((eventId: string) => {
    handleClose()
    openCalendarEvent(eventId)
  }, [handleClose, openCalendarEvent])

  // ── Timeline data (shared) ─────────────────────────────────────────────────
  // Fetched ONCE per selected soldier (audit delta is already IDB-backed) and
  // shared by the soldier-card preview AND the timeline pane — no per-surface
  // re-fetch. A falsy subjectId skips the fetch (no soldier selected).
  const timelineSubjectId = treeSelection.type === 'soldier' ? treeSelection.soldierId : ''
  const timelineEntries = useMemo(() => (
    timelineSubjectId
      ? buildTimelineCalendarEntries(
          windowedEvents.filter(e => e.assigned_to.includes(timelineSubjectId)),
          encounterEvents.filter(e => e.assigned_to.includes(timelineSubjectId)),
        )
      : []
  ), [timelineSubjectId, windowedEvents, encounterEvents])
  const { allRows: timelineRows, loading: timelineLoading } = useSubjectTimelineRows({
    subjectId: timelineSubjectId,
    clinicId: authClinicId ?? '',
    calendarEntries: timelineEntries,
    onOpenEvent: handleOpenEvent,
  })
  // Desktop three-pane (Provider rail-collapse primitive): the right detail pane
  // is "active" whenever there's something to drill into — a selected soldier or
  // any task flow. When active, the left tree rail collapses; the center dashboard
  // persists. Mirrors ProviderDrawer's selectedTemplate → rail-collapse mechanic.
  const rightActive = view.screen !== 'main' || treeSelection.type === 'soldier' || !!selectedChild
  // Desktop Esc: back out one detail layer (handleBack steps through internal
  // screens, ending in soldier-deselect) before the drawer itself closes.
  useEscBackout(!isMobile && rightActive, handleBack)

  const handleTreeSelect = useCallback((selection: TreeSelection) => {
    setSelectedChild(null)
    setTreeSelection(selection)
    if (view.screen !== 'main') {
      setView({ screen: 'main' })
    }
  }, [view])

  // ── Swipe Back (mobile) ────────────────────────────────────────────────────

  const canSwipeBack = view.screen !== 'main' || (isMobile && treeSelection.type !== 'all-personnel')
  const swipeHandlers = useSwipeBack(
    useMemo(() => {
      if (canSwipeBack) return handleBack
      return undefined
    }, [canSwipeBack, handleBack]),
    canSwipeBack,
  )

  // ── Header Actions ─────────────────────────────────────────────────────────

  const mainHeaderActions = useMemo(() => {
    if (view.screen !== 'main') return undefined

    // Roster view (mobile): Close only — search is scroll-reveal
    if (isMobile && treeSelection.type === 'all-personnel') {
      return (
        <HeaderPill>
          <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
      )
    }

    // Default: single close pill (cert editing now happens in row-tap popover)
    return (
      <HeaderPill>
        <PillButton icon={X} onClick={handleClose} label="Close" />
      </HeaderPill>
    )
  }, [view, treeSelection, isMobile, handleClose])

  // ── Header Config ──────────────────────────────────────────────────────────

  const headerConfig = useMemo(() => {
    switch (view.screen) {
      case 'main': {
        // Soldier selected (either platform): show a back-to-roster affordance.
        // Mobile → full-screen profile; desktop → right pane is open + rail
        // collapsed, so the header back is how you deselect and restore the tree.
        if (treeSelection.type !== 'all-personnel') {
          const titleMap: Record<TreeSelection['type'], string> = {
            'all-personnel': 'Supervisor',
            'soldier': 'Soldier Profile',
          }
          return {
            title: titleMap[treeSelection.type] || 'Supervisor',
            showBack: true,
            onBack: handleBack,
            rightContent: mainHeaderActions,
            hideDefaultClose: !!mainHeaderActions,
          }
        }
        return {
          title: 'Supervisor',
          rightContent: mainHeaderActions,
          hideDefaultClose: !!mainHeaderActions,
        }
      }
      case 'evaluate-select-task':
        return {
          title: 'Select Task',
          showBack: true,
          onBack: handleBack,
          rightContent: (
            <HeaderPill>
              <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
          ),
          hideDefaultClose: true,
        }
      case 'evaluate-go-nogo':
        return {
          title: 'Evaluation',
          showBack: true,
          onBack: handleBack,
        }
      case 'evaluate-algorithm':
        return {
          title: 'Algorithm Evaluation',
          showBack: true,
          onBack: handleBack,
          rightContent: (
            <HeaderPill>
              <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
          ),
          hideDefaultClose: true,
        }
      case 'coverage-tasks':
        return {
          title: view.areaName,
          showBack: true,
          onBack: handleBack,
          rightContent: (
            <HeaderPill>
              <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
          ),
          hideDefaultClose: true,
        }
      case 'coverage-task-evaluate':
        return {
          title: 'Evaluation',
          showBack: true,
          onBack: handleBack,
        }
      case 'coverage-algorithm-list':
        return {
          title: 'Algorithms',
          showBack: true,
          onBack: handleBack,
          rightContent: (
            <HeaderPill>
              <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
          ),
          hideDefaultClose: true,
        }
      case 'coverage-algorithm':
        return {
          title: view.algorithmName,
          showBack: true,
          onBack: handleBack,
          rightContent: (
            <HeaderPill>
              <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
          ),
          hideDefaultClose: true,
        }
      case 'soldier-algorithm-list':
        return {
          title: 'Algorithms',
          showBack: true,
          onBack: handleBack,
          rightContent: (
            <HeaderPill>
              <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
          ),
          hideDefaultClose: true,
        }
    }
  }, [view, isMobile, treeSelection, handleBack, mainHeaderActions, handleClose])


  // ── Content Rendering ──────────────────────────────────────────────────────

  // The all-personnel team dashboard. On desktop this is the PERSISTENT center
  // pane (never swaps); on mobile it's the root view inside the scroll machine.
  const renderDashboard = () => (
    <div className={isMobile ? 'h-full overflow-y-auto px-4 pt-[calc(var(--drawer-header-h,3.5rem)+1.75rem)] pb-8' : 'px-5 py-5 pb-8'}>
      <TeamReporting
        metrics={teamMetrics}
        medics={medics}
        onViewSoldier={handleViewProfile}
        clinicName={clinicName}
        onNavigateToArea={handleNavigateToArea}
        onNavigateToAlgorithmList={handleNavigateToAlgorithmList}
        onEditClinic={isSupervisor && clinicId ? setClinicEditAnchor : undefined}
        onAddMember={isSupervisor && clinicId ? setAddMemberAnchor : undefined}
        onRemoveSoldier={isSupervisor && clinicId ? setRemoveTarget : undefined}
        currentUserId={currentUserId ?? undefined}
        showClusterSwitch={isMobile}
      />
      {/* Algorithm-encounter roll-up by body-system category (renders nothing
          if no encounters logged). */}
      <div className="mt-5">
        <EncounterRollupCard rollup={encounterRollup} />
      </div>
      {/* Echelon roll-up: direct child clusters (renders nothing if none).
          Desktop drills into the right pane; mobile keeps the local Sheet. */}
      <div className="mt-5">
        <SubordinateUnitsCards
          clinicId={clinicId}
          isSupervisor={isSupervisor}
          currentUserId={currentUserId}
          onSelectChild={isMobile ? undefined : handleSelectChild}
          activeChildId={selectedChild?.id}
        />
      </div>
    </div>
  )

  const renderTreeContent = () => {
    switch (treeSelection.type) {
      case 'all-personnel':
        return renderDashboard()

      case 'soldier': {
        const soldier = medics.find(m => m.id === treeSelection.soldierId)
        if (!soldier || !currentUserId) return null
        return (
          <SoldierProfile
            soldier={soldier}
            certs={certsForSoldier(soldier.id)}
            tests={testsForSoldier(soldier.id)}
            assignments={assignmentsForSoldier(soldier.id)}
            readinessPercent={readinessForSoldier(soldier.id)}
            compliancePercent={teamMetrics.soldierReadiness.find(s => s.soldierId === soldier.id)?.compliancePercent ?? 100}
            currentUserId={currentUserId}
            resolveName={resolveName}
            onUpdateCert={updateCert}
            onAddCert={addCert}
            onRemoveCert={removeCert}
            onRemoveTest={removeTest}
            testableTaskMap={testableTaskMap}
            onNavigateToArea={(areaName) => {
              handleSlideAnimation('left')
              setView({ screen: 'coverage-tasks', areaName, soldier })
            }}
            timelineRows={timelineRows}
            timelineLoading={timelineLoading}
            onEditMember={isSupervisor && clinicId
              ? (memberId, anchor) => setMemberEdit({ memberId, anchor })
              : undefined}
            onOpenAlgorithms={() => handleOpenSoldierAlgorithms(soldier)}
            onViewAllTimeline={!isMobile ? () => setTimelinePaneOpen(true) : undefined}
          />
        )
      }

    }
  }

  // Glass-header offset for mobile scroll panes — content scrolls up behind the
  // translucent header (var published by BaseDrawer). Desktop renders these in
  // the right pane below an in-flow header, so it keeps the prior className.
  const scrollPaneCls = isMobile
    ? 'px-4 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)] pb-8 min-h-full'
    : 'px-4 py-3 md:p-5 pb-8 min-h-full'

  const renderContent = () => {
    // Loading state
    if (loading) {
      return (
        <div className="relative h-full">
          <LoadingOverlay visible size={140} />
        </div>
      )
    }

    // Auth guard
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

    // Detail screens (overlay on top of any tree selection)
    switch (view.screen) {
      case 'evaluate-select-task':
        return (
          <div className="h-full flex flex-col">
            <div className={isMobile ? 'shrink-0 px-3 pt-[calc(var(--drawer-header-h,3.5rem)+0.5rem)] pb-2' : 'shrink-0 px-3 py-2'}>
              <SearchInput
                value={taskSearchQuery}
                onChange={setTaskSearchQuery}
                placeholder="Search STP tasks..."
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-4 py-3 md:p-5 pb-8 min-h-full">
                <EvaluateFlow
                  soldier={view.soldier}
                  taskNumber={null}
                  taskTitle={null}
                  searchQuery={taskSearchQuery}
                  onSelectTask={handleSelectTask}
                  onSubmit={handleSubmitEvaluation}
                />
              </div>
            </div>
          </div>
        )

      case 'evaluate-go-nogo':
        return (
          <ScrollPane className={scrollPaneCls}>
            <EvaluateFlow
              soldier={view.soldier}
              taskNumber={view.taskNumber}
              taskTitle={view.taskTitle}
              searchQuery={taskSearchQuery}
              onSelectTask={handleSelectTask}
              onSubmit={handleSubmitEvaluation}
            />
          </ScrollPane>
        )

      case 'evaluate-algorithm':
        return (
          <ScrollPane className={scrollPaneCls}>
            <AlgorithmEvaluateFlow
              soldier={view.soldier}
              algorithmId={view.algorithmId}
              algorithmName={view.algorithmName}
              onSubmitUnit={handleSubmitAlgorithmUnit}
              onComplete={handleAlgorithmEvalComplete}
            />
          </ScrollPane>
        )

      case 'coverage-tasks': {
        const areaTasks = testableTaskMap.get(view.areaName) ?? []
        return (
          <ScrollPane className={scrollPaneCls}>
            <CoverageTasksView
              areaName={view.areaName}
              tasks={areaTasks}
              medics={medics}
              testsForSoldier={testsForSoldier}
              onEvaluate={handleCoverageEvaluate}
              onAssign={handleCoverageAssign}
              preSelectedSoldier={view.soldier}
            />
          </ScrollPane>
        )
      }

      case 'coverage-task-evaluate':
        return (
          <ScrollPane className={scrollPaneCls}>
            <EvaluateFlow
              soldier={view.soldier}
              taskNumber={view.taskNumber}
              taskTitle={view.taskTitle}
              searchQuery=""
              onSelectTask={() => {}}
              onSubmit={handleSubmitEvaluation}
            />
          </ScrollPane>
        )

      case 'coverage-algorithm-list':
        return (
          <ScrollPane className={scrollPaneCls}>
            <AlgorithmGapList
              gaps={teamMetrics.algorithmGaps}
              onNavigateToAlgorithm={handleNavigateToAlgorithm}
            />
          </ScrollPane>
        )

      case 'coverage-algorithm':
        return (
          <ScrollPane className={scrollPaneCls}>
            <AlgorithmCoverageView
              algorithmId={view.algorithmId}
              algorithmName={view.algorithmName}
              medics={medics}
              testsForSoldier={testsForSoldier}
              onEvaluate={handleEvaluateAlgorithm}
              onSchedule={handleScheduleAlgorithm}
            />
          </ScrollPane>
        )

      case 'soldier-algorithm-list': {
        const soldier = view.soldier
        return (
          <ScrollPane className={scrollPaneCls}>
            <SoldierAlgorithmList
              competency={buildAlgorithmCompetency(testsForSoldier(soldier.id))}
              ranAlgorithmIds={new Set(readsForSoldier(soldier.id).map(r => r.trainingItemId))}
              onEvaluateAlgorithm={(algorithmId, algorithmName) => handleEvaluateAlgorithm(soldier, algorithmId, algorithmName)}
              onScheduleAlgorithm={(algorithmId, algorithmName) => handleScheduleAlgorithm(soldier, algorithmId, algorithmName)}
            />
          </ScrollPane>
        )
      }

      case 'main':
      default:
        // all-personnel manages its own scroll/layout
        if (treeSelection.type === 'all-personnel') return renderTreeContent()
        return <ScrollPane className={scrollPaneCls}>{renderTreeContent()}</ScrollPane>
    }
  }

  // Desktop right pane — the "active drill": the selected soldier's profile, any
  // task flow, or (on top of a soldier) the full timeline. renderContent() already
  // returns exactly this for every non-dashboard state, so we reuse it; rightActive
  // guarantees it never resolves to the all-personnel dashboard here.
  const renderRightDetail = () => {
    if (selectedChild) {
      // The body owns its own detail header (back + name + Add icon primitive).
      return (
        <ChildClinicRosterBody
          key={selectedChild.id}
          clinicId={selectedChild.id}
          currentUserId={currentUserId ?? null}
          title={selectedChild.name}
          onBack={() => setSelectedChild(null)}
        />
      )
    }
    if (timelinePaneOpen && view.screen === 'main' && treeSelection.type === 'soldier') {
      return (
        <>
          <PaneHeader
            title="Timeline"
            onBack={() => setTimelinePaneOpen(false)}
            backLabel="Back to profile"
          />
          <div className="flex-1 min-h-0 overflow-y-auto">
            <TimelineFullView rows={timelineRows} loading={timelineLoading} />
          </div>
        </>
      )
    }
    // Soldier profile + evaluate/coverage/algorithm flows scroll as one region
    // (mirrors the prior desktop center wrapper).
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        {renderContent()}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const memberFallback = useMemo(() => {
    if (!memberEdit) return undefined
    const m = medics.find(x => x.id === memberEdit.memberId)
    if (!m) return undefined
    return {
      firstName: m.firstName ?? null,
      lastName: m.lastName ?? null,
      middleInitial: m.middleInitial ?? null,
      credential: m.credential ?? null,
      component: null,
      rank: m.rank ?? null,
      uic: null,
      roles: ['medic'] as ('medic' | 'supervisor' | 'provider')[],
      homeClinicId: m.clinicId ?? null,
      homeClinicName: m.clinicName ?? null,
    }
  }, [memberEdit, medics])

  const handleMemberChanged = useCallback(() => {
    refreshMedics()
    refreshData()
  }, [refreshMedics, refreshData])

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveError(null)
    const r = removeTarget.isLoanedIn && clinicId
      ? await endLoanFromClinic(removeTarget.id, clinicId)
      : await removeSoldierFromClinic(removeTarget.id)
    setRemoving(false)
    if (!r.success) {
      setRemoveError(r.error)
      return
    }
    invalidate('users', 'clinics')
    setRemoveTarget(null)
    handleMemberChanged()
  }, [removeTarget, clinicId, handleMemberChanged])

  return (
    <>
      <BaseDrawer
        isVisible={isVisible}
        onClose={handleClose}
        fullHeight="90dvh"
        desktopPosition="left"
        desktopWidth="w-[90%]"
        header={headerConfig}
        scrollDisabled
        glassHeader={isMobile}
      >
        <ContentWrapper slideDirection={isMobile ? slideDirection : ''} swipeHandlers={isMobile && canSwipeBack ? swipeHandlers : undefined}>
          <div className="h-full relative">
            {/* Desktop: three-pane layout (Provider rail-collapse primitive) —
                tree rail | persistent dashboard | soldier/flow detail. */}
            {!isMobile && !loading && isSupervisor ? (
              <div className="flex h-full">
                {/* Left rail — personnel tree; collapses (slides out left) when the right pane is active. */}
                <SlideRevealPane
                  open={!rightActive}
                  side="left"
                  width={260}
                  keepMounted
                  className="border-r border-tertiary/10 bg-themewhite"
                >
                  <div className="shrink-0 px-3 py-2 border-b border-primary/10">
                    <SearchInput
                      value={treeSearch}
                      onChange={setTreeSearch}
                      placeholder="Search personnel..."
                    />
                  </div>
                  <div className="flex-1 min-h-0">
                    <SupervisorTree
                      medics={medics}
                      selection={treeSelection}
                      onSelect={handleTreeSelect}
                      searchQuery={treeSearch}
                    />
                  </div>
                </SlideRevealPane>
                {/* Center — persistent team dashboard (never swaps). */}
                <div className="flex-1 min-w-0 overflow-y-auto">
                  {renderDashboard()}
                </div>
                {/* Right pane — active drill (soldier profile / task flow / timeline);
                    slides in from the right as the left rail collapses. */}
                <SlideRevealPane
                  open={rightActive}
                  side="right"
                  width={380}
                  className="border-l border-primary/10 bg-themewhite"
                >
                  {rightActive && renderRightDetail()}
                </SlideRevealPane>
              </div>
            ) : (
              renderContent()
            )}
          </div>
        </ContentWrapper>
      </BaseDrawer>

      {/* Clinic-admin popovers — shared with Settings/ClinicPanel */}
      <ClinicIdentityEditPopover
        isOpen={!!clinicEditAnchor}
        anchorRect={clinicEditAnchor}
        clinicId={clinicId}
        initialName={clinicName ?? clinicNameFromAuth ?? ''}
        initialLocation={clinicDetails.location}
        initialLocationId={clinicDetails.location_id}
        initialUics={clinicDetails.uics}
        locations={locations}
        onClose={() => setClinicEditAnchor(null)}
        onSaved={(next) => {
          setClinicDetails({ uics: next.uics, location: next.location, location_id: next.location_id })
        }}
      />
      <MemberEditPopover
        isOpen={!!memberEdit}
        anchorRect={memberEdit?.anchor ?? null}
        memberId={memberEdit?.memberId ?? null}
        clinicId={clinicId}
        fallbackProfile={memberFallback}
        associatedClinics={associatedClinicsList}
        loanState={(() => {
          if (!memberEdit) return 'home'
          const m = medics.find(x => x.id === memberEdit.memberId)
          if (!m) return 'home'
          if (m.isLoanedIn) return 'loaned-in'
          if (m.surrogateClinicId) return 'loaned-out'
          return 'home'
        })()}
        onClose={() => setMemberEdit(null)}
        onChanged={handleMemberChanged}
      />
      <AddMemberPopover
        isOpen={!!addMemberAnchor}
        anchorRect={addMemberAnchor}
        clinicId={clinicId}
        onClose={() => setAddMemberAnchor(null)}
        onAdded={handleMemberChanged}
      />

      {/* Swipe-to-remove confirmation (roster rows). Loaned-in soldiers end the
          loan; everyone else is removed from the cluster. */}
      <ConfirmDialog
        visible={!!removeTarget}
        title={removeTarget?.isLoanedIn ? 'End loan?' : 'Remove from cluster?'}
        subtitle={
          removeError ??
          (removeTarget?.isLoanedIn
            ? 'Sends this soldier back to their home cluster.'
            : 'They will no longer be associated with this cluster.')
        }
        confirmLabel={removeTarget?.isLoanedIn ? 'End loan' : 'Remove'}
        variant="danger"
        processing={removing}
        onConfirm={handleConfirmRemove}
        onCancel={() => { if (!removing) { setRemoveTarget(null); setRemoveError(null) } }}
      />
    </>
  )
}
