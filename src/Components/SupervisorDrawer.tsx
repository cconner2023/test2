import { useState, useCallback, useMemo, useEffect } from 'react'
import { Ban, X } from 'lucide-react'
import { BaseDrawer, ScrollPane } from './BaseDrawer'
import { ContentWrapper } from './ContentWrapper'
import { HeaderPill, PillButton } from './HeaderPill'
import { MobileSearchBar } from './MobileSearchBar'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { UI_TIMING } from '../Utilities/constants'
import { useTrainingCompletions } from '../Hooks/useTrainingCompletions'
import { useCalendarWrite } from '../Hooks/useCalendarWrite'
import { useCalendarStore } from '../stores/useCalendarStore'
import { updateAssignmentCalendarOriginId } from '../lib/trainingService'
import { useAuthStore } from '../stores/useAuthStore'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useSupervisorData } from './Settings/Supervisor/useSupervisorData'
import { SoldierProfile } from './Settings/Supervisor/SoldierProfile'
import { EvaluateFlow } from './Settings/Supervisor/EvaluateFlow'
import { AssignTaskFlow } from './Settings/Supervisor/AssignTaskFlow'
import { TeamReporting } from './Settings/Supervisor/TeamReporting'
import { CoverageTasksView } from './Settings/Supervisor/CoverageTasksView'
import { SupervisorTree, type TreeSelection } from './Settings/Supervisor/SupervisorTree'
import { LoadingSpinner } from './LoadingSpinner'
import { useMinLoadTime } from '../Hooks/useMinLoadTime'
import { ClinicIdentityEditPopover } from './ClinicAdmin/ClinicIdentityEditPopover'
import { MemberEditPopover } from './ClinicAdmin/MemberEditPopover'
import { AddMemberPopover } from './ClinicAdmin/AddMemberPopover'
import { useClinicMedics } from '../Hooks/useClinicMedics'
import { getClinicDetails } from '../lib/supervisorService'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { StepResult } from '../Types/SupervisorTestTypes'
import type { CalendarEvent } from '../Types/CalendarTypes'

// ─── State Machine ───────────────────────────────────────────────────────────

type SupervisorView =
  | { screen: 'main' }
  | { screen: 'evaluate-select-task'; soldier: ClinicMedic }
  | { screen: 'evaluate-go-nogo'; soldier: ClinicMedic; taskNumber: string; taskTitle: string }
  | { screen: 'coverage-tasks'; areaName: string; soldier?: ClinicMedic }
  | { screen: 'coverage-task-evaluate'; areaName: string; soldier: ClinicMedic; taskNumber: string; taskTitle: string }
  | { screen: 'assign-task'; soldier: ClinicMedic; preSelectedTask?: { id: string; title: string } }

interface SupervisorDrawerProps {
  isVisible: boolean
  onClose: () => void
}

export function SupervisorDrawer({ isVisible, onClose }: SupervisorDrawerProps) {
  const [view, setView] = useState<SupervisorView>({ screen: 'main' })
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({ type: 'all-personnel' })

  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
  const [taskSearchQuery, setTaskSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  // Clear search when navigating between views (e.g., clicking a search result)
  useEffect(() => { setTaskSearchQuery(''); setSearchFocused(false) }, [view.screen])

  // Tour: guided tour navigation events
  useEffect(() => {
    const handleBack = () => {
      setView({ screen: 'main' })
      setTreeSelection({ type: 'all-personnel' })
    }
    window.addEventListener('tour:supervisor-back', handleBack)
    return () => window.removeEventListener('tour:supervisor-back', handleBack)
  }, [])

  const isMobile = useIsMobile()

  // ── Data ───────────────────────────────────────────────────────────────────

  const { submitTestEvaluation, assignTask } = useTrainingCompletions()
  const { writeEvent } = useCalendarWrite()
  const user = useAuthStore(s => s.user)
  // The supervisor toggle picks which clinic this drawer administers.
  // Defaults to the assigned clinic for single-clinic users.
  const clinicId = useAuthStore(s => s.supervisingClinicId ?? s.clinicId)
  const clinicNameFromAuth = useAuthStore(s => s.profile.clinicName)
  const calendarEvents = useCalendarStore(s => s.events)
  const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer)
  const { refresh: refreshMedics } = useClinicMedics()

  // ── Clinic-admin popovers (shared with Settings/ClinicPanel) ──────────────
  const [clinicEditAnchor, setClinicEditAnchor] = useState<DOMRect | null>(null)
  const [clinicDetails, setClinicDetails] = useState<{ uics: string[]; location: string | null }>({ uics: [], location: null })
  const [memberEdit, setMemberEdit] = useState<{ memberId: string; anchor: DOMRect } | null>(null)
  const [addMemberAnchor, setAddMemberAnchor] = useState<DOMRect | null>(null)

  // Fetch clinic UIC/location for the identity-edit popover seed
  useEffect(() => {
    if (!clinicId) return
    getClinicDetails(clinicId).then((d) => {
      setClinicDetails({ uics: d.uics, location: d.location })
    })
  }, [clinicId, isVisible])

  const {
    loading: _loading,
    isSupervisor,
    currentUserId,
    medics,
    clinicName,
    certsForSoldier,
    testsForSoldier,
    assignmentsForSoldier,
    resolveName,
    updateCert,
    removeTest,
    addCert,
    removeCert,
    addAssignment,
    refreshData,
    teamMetrics,
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

  // Tour: navigate into first coverage area programmatically
  useEffect(() => {
    const handleOpenFirstArea = () => {
      const firstGap = teamMetrics.subjectAreaGaps
        .slice()
        .sort((a, b) => a.coveragePercent - b.coveragePercent)[0]
      if (firstGap) {
        setView({ screen: 'coverage-tasks', areaName: firstGap.areaName })
      }
    }
    window.addEventListener('tour:supervisor-open-first-area', handleOpenFirstArea)
    return () => {
      window.removeEventListener('tour:supervisor-open-first-area', handleOpenFirstArea)
    }
  }, [teamMetrics])

  // ── Slide Animation ────────────────────────────────────────────────────────

  const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
    setSlideDirection(direction)
    setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleViewProfile = useCallback((soldier: ClinicMedic) => {

    if (!isMobile) {
      setTreeSelection({ type: 'soldier', soldierId: soldier.id })
    } else {
      setTreeSelection({ type: 'soldier', soldierId: soldier.id })
      handleSlideAnimation('left')
    }
  }, [isMobile, handleSlideAnimation])

  const handleEvaluate = useCallback((soldier: ClinicMedic) => {

    handleSlideAnimation('left')
    setView({ screen: 'evaluate-select-task', soldier })
  }, [handleSlideAnimation])

  const handleAssign = useCallback((soldier: ClinicMedic) => {
    handleSlideAnimation('left')
    setView({ screen: 'assign-task', soldier })
  }, [handleSlideAnimation])

  const handleSubmitAssignment = useCallback(async (taskId: string, taskTitle: string, dueDate: string, notes: string) => {
    if (view.screen !== 'assign-task') return

    const saved = await assignTask({
      medicUserId: view.soldier.id,
      trainingItemId: taskId,
      dueDate,
      notes: notes || undefined,
    })

    // Create calendar event for the assignment
    if (user) {
      const now = new Date().toISOString()
      const calendarEvent = {
        id: crypto.randomUUID(),
        clinic_id: view.soldier.clinicId || '',
        title: `Training: ${taskTitle}`,
        description: notes || '',
        category: 'training' as const,
        status: 'pending' as const,
        start_time: `${dueDate}T00:00`,
        end_time: `${dueDate}T23:59`,
        all_day: true,
        location: '',
        opord_notes: '',
        uniform: '',
        report_time: '',
        assigned_to: [view.soldier.id],
        property_item_ids: [],
        created_by: user.id,
        created_at: now,
        updated_at: now,
      }

      await writeEvent(calendarEvent as CalendarEvent)
      // Link vault originId back to the assignment after write completes
      const storedEvent = useCalendarStore.getState().events.find(e => e.id === calendarEvent.id)
      if (saved && storedEvent?.originId) {
        updateAssignmentCalendarOriginId(saved.id, user.id, storedEvent.originId).catch(() => {})
      }
    }

    if (saved) {
      addAssignment(saved)
    }
    refreshData()
    setView({ screen: 'main' })
    setTreeSelection({ type: 'soldier', soldierId: view.soldier.id })
  }, [view, assignTask, addAssignment, refreshData, writeEvent, user])

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

  const handleCoverageEvaluate = useCallback((soldier: ClinicMedic, taskId: string, taskTitle: string) => {
    if (view.screen !== 'coverage-tasks') return
    handleSlideAnimation('left')
    setView({ screen: 'coverage-task-evaluate', areaName: view.areaName, soldier, taskNumber: taskId, taskTitle })
  }, [view, handleSlideAnimation])

  const handleCoverageAssign = useCallback((soldier: ClinicMedic, taskId: string, taskTitle: string) => {
    handleSlideAnimation('left')
    setView({ screen: 'assign-task', soldier, preSelectedTask: { id: taskId, title: taskTitle } })
  }, [handleSlideAnimation])

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

  const handleBack = useCallback(() => {
    if (view.screen === 'evaluate-go-nogo') {
      handleSlideAnimation('right')
      setView({ screen: 'evaluate-select-task', soldier: view.soldier })
    } else if (view.screen === 'coverage-task-evaluate') {
      handleSlideAnimation('right')
      setView({ screen: 'coverage-tasks', areaName: view.areaName })
    } else if (view.screen === 'assign-task') {
      handleSlideAnimation('right')
      setTaskSearchQuery('')
      setView({ screen: 'main' })
      setTreeSelection({ type: 'soldier', soldierId: view.soldier.id })
    } else if (view.screen !== 'main') {
      handleSlideAnimation('right')
      setTaskSearchQuery('')
      setView({ screen: 'main' })
    } else if (isMobile && treeSelection.type !== 'all-personnel') {
      handleSlideAnimation('right')
      setTreeSelection({ type: 'all-personnel' })
    }
  }, [view, isMobile, treeSelection, handleSlideAnimation])

  const handleClose = useCallback(() => {
    setView({ screen: 'main' })
    setTreeSelection({ type: 'all-personnel' })
    setSlideDirection('')
    setClinicEditAnchor(null)
    setMemberEdit(null)
    setAddMemberAnchor(null)

    onClose()
  }, [onClose])

  const handleOpenCalendar = useCallback(() => {
    handleClose()
    setShowCalendarDrawer(true)
  }, [handleClose, setShowCalendarDrawer])

  const handleTreeSelect = useCallback((selection: TreeSelection) => {
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
        // On mobile, show back for non-default tree selections
        if (isMobile && treeSelection.type !== 'all-personnel') {
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
      case 'assign-task':
        return {
          title: 'Assign Training',
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

  const renderTreeContent = () => {
    switch (treeSelection.type) {
      case 'all-personnel':
        return (
          <div className={isMobile ? 'h-full overflow-y-auto px-4 py-3 pb-8' : 'px-5 py-5 pb-8'}>
            <TeamReporting
              metrics={teamMetrics}
              medics={medics}
              resolveName={resolveName}
              onViewSoldier={handleViewProfile}
              testableTaskMap={testableTaskMap}
              clinicName={clinicName}
              onNavigateToArea={handleNavigateToArea}
              teamEvents={windowedEvents}
              onOpenCalendar={handleOpenCalendar}
              onEditClinic={isSupervisor && clinicId ? setClinicEditAnchor : undefined}
              onAddMember={isSupervisor && clinicId ? setAddMemberAnchor : undefined}
            />
          </div>
        )

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
            calendarEvents={windowedEvents.filter(e => e.assigned_to.includes(soldier.id))}
            onOpenCalendar={handleOpenCalendar}
            onEditMember={isSupervisor && clinicId
              ? (memberId, anchor) => setMemberEdit({ memberId, anchor })
              : undefined}
          />
        )
      }

    }
  }

  const renderContent = () => {
    // Loading state
    if (loading) {
      return <LoadingSpinner className="h-full text-tertiary" />
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
          <MobileSearchBar variant="supervisor"
            value={taskSearchQuery}
            onChange={setTaskSearchQuery}
            placeholder="Search STP tasks..."
            onFocusChange={setSearchFocused}
          >
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
          </MobileSearchBar>
        )

      case 'evaluate-go-nogo':
        return (
          <ScrollPane className="px-4 py-3 md:p-5 pb-8 min-h-full">
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

      case 'coverage-tasks': {
        const areaTasks = testableTaskMap.get(view.areaName) ?? []
        return (
          <ScrollPane className="px-4 py-3 md:p-5 pb-8 min-h-full">
            <CoverageTasksView
              areaName={view.areaName}
              tasks={areaTasks}
              medics={medics}
              testsForSoldier={testsForSoldier}
              onEvaluate={handleCoverageEvaluate}
              onAssign={handleCoverageAssign}
              onBack={handleBack}
              preSelectedSoldier={view.soldier}
            />
          </ScrollPane>
        )
      }

      case 'coverage-task-evaluate':
        return (
          <ScrollPane className="px-4 py-3 md:p-5 pb-8 min-h-full">
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

      case 'assign-task':
        return (
          <MobileSearchBar variant="supervisor"
            value={taskSearchQuery}
            onChange={setTaskSearchQuery}
            placeholder="Search tasks to assign..."
            onFocusChange={setSearchFocused}
          >
            <div className="px-4 py-3 md:p-5 pb-8 min-h-full">
              <AssignTaskFlow
                soldier={view.soldier}
                searchQuery={taskSearchQuery}
                preSelectedTask={view.preSelectedTask}
                onSubmit={handleSubmitAssignment}
              />
            </div>
          </MobileSearchBar>
        )

      case 'main':
      default:
        // all-personnel manages its own scroll/layout
        if (treeSelection.type === 'all-personnel') return renderTreeContent()
        return <ScrollPane className="px-4 py-3 md:p-5 pb-8 min-h-full">{renderTreeContent()}</ScrollPane>
    }
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
    }
  }, [memberEdit, medics])

  const handleMemberChanged = useCallback(() => {
    refreshMedics()
    refreshData()
  }, [refreshMedics, refreshData])

  return (
    <>
      <BaseDrawer
        isVisible={isVisible}
        onClose={handleClose}
        fullHeight="90dvh"
        desktopPosition="left"
        desktopWidth="w-[90%]"
        header={headerConfig}
        headerFaded={searchFocused}
        scrollDisabled
      >
        <ContentWrapper slideDirection={isMobile ? slideDirection : ''} swipeHandlers={isMobile && canSwipeBack ? swipeHandlers : undefined}>
          <div className="h-full relative">
            {/* Desktop: split pane layout */}
            {!isMobile && !loading && isSupervisor ? (
              <div className="flex h-full">
                <div className="w-65 shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50">
                  <div className="flex-1 min-h-0">
                    <SupervisorTree
                      medics={medics}
                      selection={treeSelection}
                      onSelect={handleTreeSelect}
                      readinessForSoldier={readinessForSoldier}
                      onAddMember={isSupervisor && clinicId ? setAddMemberAnchor : undefined}
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0 overflow-y-auto">
                  {renderContent()}
                </div>
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
        initialName={clinicNameFromAuth ?? clinicName ?? ''}
        initialLocation={clinicDetails.location}
        initialUics={clinicDetails.uics}
        onClose={() => setClinicEditAnchor(null)}
        onSaved={(next) => {
          setClinicDetails({ uics: next.uics, location: next.location })
        }}
      />
      <MemberEditPopover
        isOpen={!!memberEdit}
        anchorRect={memberEdit?.anchor ?? null}
        memberId={memberEdit?.memberId ?? null}
        clinicId={clinicId}
        fallbackProfile={memberFallback}
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
    </>
  )
}
