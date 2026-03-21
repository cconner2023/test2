import { useState, useCallback, useMemo, useEffect } from 'react'
import { Ban, X, ClipboardCheck, Pencil } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { ContentWrapper } from './Settings/ContentWrapper'
import { HeaderPill, PillButton } from './HeaderPill'
import { MobileSearchBar } from './MobileSearchBar'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { UI_TIMING } from '../Utilities/constants'
import { useTrainingCompletions } from '../Hooks/useTrainingCompletions'
import { useSupervisorData } from './Settings/Supervisor/useSupervisorData'
import { PersonnelRoster } from './Settings/Supervisor/PersonnelRoster'
import { SoldierProfile } from './Settings/Supervisor/SoldierProfile'
import { SoldierCertsEditor } from './Settings/Supervisor/SoldierCertsEditor'
import { EvaluateFlow } from './Settings/Supervisor/EvaluateFlow'
import { TeamReporting } from './Settings/Supervisor/TeamReporting'
import { CoverageTasksView } from './Settings/Supervisor/CoverageTasksView'
import { SupervisorTree, type TreeSelection } from './Settings/Supervisor/SupervisorTree'
import { LoadingSpinner } from './LoadingSpinner'
import { useMinLoadTime } from '../Hooks/useMinLoadTime'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { StepResult } from '../Types/SupervisorTestTypes'

// ─── State Machine ───────────────────────────────────────────────────────────

type SupervisorView =
  | { screen: 'main' }
  | { screen: 'soldier-certs'; soldier: ClinicMedic }
  | { screen: 'evaluate-select-task'; soldier: ClinicMedic }
  | { screen: 'evaluate-go-nogo'; soldier: ClinicMedic; taskNumber: string; taskTitle: string }
  | { screen: 'coverage-tasks'; areaName: string }
  | { screen: 'coverage-task-evaluate'; areaName: string; soldier: ClinicMedic; taskNumber: string; taskTitle: string }

interface SupervisorDrawerProps {
  isVisible: boolean
  onClose: () => void
}

export function SupervisorDrawer({ isVisible, onClose }: SupervisorDrawerProps) {
  const [view, setView] = useState<SupervisorView>({ screen: 'main' })
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({ type: 'all-personnel' })

  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
  const [rosterSearchQuery, setRosterSearchQuery] = useState('')
  const [taskSearchQuery, setTaskSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [focusCertId, setFocusCertId] = useState<string | null>(null)

  // Clear search when navigating between views (e.g., clicking a search result)
  useEffect(() => { setRosterSearchQuery(''); setTaskSearchQuery(''); setSearchFocused(false) }, [view.screen])

  const isMobile = useIsMobile()

  // ── Data ───────────────────────────────────────────────────────────────────

  const { submitTestEvaluation } = useTrainingCompletions()

  const {
    loading: _loading,
    isSupervisor,
    currentUserId,
    medics,
    clinicName,
    certsForSoldier,
    testsForSoldier,
    overdueItems,
    resolveName,
    updateCert,
    removeTest,
    addCert,
    removeCert,
    refreshData,
    teamMetrics,
    testableTaskMap,
  } = useSupervisorData()
  const loading = useMinLoadTime(_loading)

  const readinessForSoldier = useCallback((soldierId: string): number => {
    const entry = teamMetrics.soldierReadiness.find(s => s.soldierId === soldierId)
    return entry?.readinessPercent ?? 0
  }, [teamMetrics.soldierReadiness])

  const getOverdueCount = useCallback((userId: string) => {
    const { expiredCerts, failedTests } = overdueItems(userId)
    return expiredCerts.length + failedTests.length
  }, [overdueItems])

  // ── Slide Animation ────────────────────────────────────────────────────────

  const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
    setSlideDirection(direction)
    setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleViewProfile = useCallback((soldier: ClinicMedic) => {
    setRosterSearchQuery('')
    if (!isMobile) {
      setTreeSelection({ type: 'soldier', soldierId: soldier.id })
    } else {
      setTreeSelection({ type: 'soldier', soldierId: soldier.id })
      handleSlideAnimation('left')
    }
  }, [isMobile, handleSlideAnimation])

  const handleEvaluate = useCallback((soldier: ClinicMedic) => {
    setRosterSearchQuery('')
    handleSlideAnimation('left')
    setView({ screen: 'evaluate-select-task', soldier })
  }, [handleSlideAnimation])

  const handleModifyCerts = useCallback((soldier: ClinicMedic) => {
    setRosterSearchQuery('')
    handleSlideAnimation('left')
    setFocusCertId(null)
    setView({ screen: 'soldier-certs', soldier })
  }, [handleSlideAnimation])

  const handleNavigateToCert = useCallback((soldier: ClinicMedic, certId: string) => {
    handleSlideAnimation('left')
    setFocusCertId(certId)
    setView({ screen: 'soldier-certs', soldier })
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

  const handleBack = useCallback(() => {
    if (view.screen === 'evaluate-go-nogo') {
      handleSlideAnimation('right')
      setView({ screen: 'evaluate-select-task', soldier: view.soldier })
    } else if (view.screen === 'coverage-task-evaluate') {
      handleSlideAnimation('right')
      setView({ screen: 'coverage-tasks', areaName: view.areaName })
    } else if (view.screen !== 'main') {
      handleSlideAnimation('right')
      setFocusCertId(null)
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
    setRosterSearchQuery('')
    onClose()
  }, [onClose])

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

  const selectedSoldier = useMemo(() => {
    if (view.screen === 'main' && treeSelection.type === 'soldier') {
      return medics.find(m => m.id === treeSelection.soldierId) ?? null
    }
    return null
  }, [view, treeSelection, medics])

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

    // Soldier selected: Evaluate + Edit Certs + Close
    if (selectedSoldier) {
      return (
        <HeaderPill>
          <PillButton icon={ClipboardCheck} iconSize={20} onClick={() => handleEvaluate(selectedSoldier)} label="Evaluate" />
          <PillButton icon={Pencil} iconSize={20} onClick={() => handleModifyCerts(selectedSoldier)} label="Edit Certs" />
          <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
      )
    }

    // Default: single close pill
    return (
      <HeaderPill>
        <PillButton icon={X} onClick={handleClose} label="Close" />
      </HeaderPill>
    )
  }, [view, treeSelection, isMobile, handleClose, selectedSoldier, handleEvaluate, handleModifyCerts])

  // ── Header Config ──────────────────────────────────────────────────────────

  const headerConfig = useMemo(() => {
    switch (view.screen) {
      case 'main': {
        // On mobile, show back for non-default tree selections
        if (isMobile && treeSelection.type !== 'all-personnel') {
          const titleMap: Record<TreeSelection['type'], string> = {
            'all-personnel': 'Supervisor',
            'soldier': 'Soldier Profile',
            'team-insights': 'Team Insights',
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
      case 'soldier-certs':
        return {
          title: 'Certifications',
          showBack: true,
          onBack: handleBack,
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
    }
  }, [view, isMobile, treeSelection, handleBack, mainHeaderActions, handleClose])

  // ── Subview Wrapper ────────────────────────────────────────────────────────

  const subViewWrapper = (children: React.ReactNode) => (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5 pb-8 min-h-full">
        {children}
      </div>
    </div>
  )

  // ── Content Rendering ──────────────────────────────────────────────────────

  const renderTreeContent = () => {
    switch (treeSelection.type) {
      case 'all-personnel':
        // Desktop: tree handles navigation, show team dashboard in right pane
        if (!isMobile) {
          return (
            <div className="px-5 py-5 pb-8">
              <TeamReporting
                metrics={teamMetrics}
                medics={medics}
                resolveName={resolveName}
                onViewSoldier={handleViewProfile}
                testableTaskMap={testableTaskMap}
                clinicName={clinicName}
                onNavigateToArea={handleNavigateToArea}
              />
            </div>
          )
        }
        // Mobile: scroll-reveal search wrapping roster cards
        return (
          <MobileSearchBar variant="supervisor"
            value={rosterSearchQuery}
            onChange={setRosterSearchQuery}
            placeholder="Search personnel..."
            onFocusChange={setSearchFocused}
          >
            <PersonnelRoster
              medics={medics}
              certsForSoldier={certsForSoldier}
              overdueCount={getOverdueCount}
              onEvaluate={handleEvaluate}
              onView={handleViewProfile}
              onModify={handleModifyCerts}
              searchQuery={rosterSearchQuery}
              clinicName={clinicName}
              teamMetrics={teamMetrics}
              onViewInsights={() => {
                handleSlideAnimation('left')
                setTreeSelection({ type: 'team-insights' })
              }}
            />
          </MobileSearchBar>
        )

      case 'soldier': {
        const soldier = medics.find(m => m.id === treeSelection.soldierId)
        if (!soldier || !currentUserId) return null
        return (
          <SoldierProfile
            soldier={soldier}
            certs={certsForSoldier(soldier.id)}
            tests={testsForSoldier(soldier.id)}
            readinessPercent={readinessForSoldier(soldier.id)}
            compliancePercent={teamMetrics.soldierReadiness.find(s => s.soldierId === soldier.id)?.compliancePercent ?? 100}
            currentUserId={currentUserId}
            resolveName={resolveName}
            onNavigateToCert={(certId) => handleNavigateToCert(soldier, certId)}
            onRemoveTest={removeTest}
            testableTaskMap={testableTaskMap}
            onNavigateToArea={(areaName) => {
              handleSlideAnimation('left')
              setView({ screen: 'evaluate-select-task', soldier })
              setTaskSearchQuery(areaName)
            }}
          />
        )
      }

      case 'team-insights':
        return (
          <div className="h-full overflow-y-auto px-4 py-3 md:px-5 md:py-5 pb-8">
            <TeamReporting
              metrics={teamMetrics}
              medics={medics}
              resolveName={resolveName}
              onViewSoldier={handleViewProfile}
              testableTaskMap={testableTaskMap}
              clinicName={clinicName}
              onNavigateToArea={handleNavigateToArea}
            />
          </div>
        )
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
            <Ban size={28} className="mx-auto mb-3 text-tertiary/30" />
            <h3 className="text-base font-semibold text-primary mb-1">Access Denied</h3>
            <p className="text-sm text-tertiary/60">You need the supervisor role to access this panel.</p>
          </div>
        </div>
      )
    }

    // Detail screens (overlay on top of any tree selection)
    switch (view.screen) {
      case 'soldier-certs':
        return currentUserId ? subViewWrapper(
          <SoldierCertsEditor
            soldier={view.soldier}
            certs={certsForSoldier(view.soldier.id)}
            currentUserId={currentUserId}
            onUpdateCert={updateCert}
            onAddCert={addCert}
            onRemoveCert={removeCert}
            initialEditCertId={focusCertId}
          />
        ) : null

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
        return subViewWrapper(
          <EvaluateFlow
            soldier={view.soldier}
            taskNumber={view.taskNumber}
            taskTitle={view.taskTitle}
            searchQuery={taskSearchQuery}
            onSelectTask={handleSelectTask}
            onSubmit={handleSubmitEvaluation}
          />
        )

      case 'coverage-tasks': {
        const areaTasks = testableTaskMap.get(view.areaName) ?? []
        return subViewWrapper(
          <CoverageTasksView
            areaName={view.areaName}
            tasks={areaTasks}
            medics={medics}
            testsForSoldier={testsForSoldier}
            onEvaluate={handleCoverageEvaluate}
            onBack={handleBack}
          />
        )
      }

      case 'coverage-task-evaluate':
        return subViewWrapper(
          <EvaluateFlow
            soldier={view.soldier}
            taskNumber={view.taskNumber}
            taskTitle={view.taskTitle}
            searchQuery=""
            onSelectTask={() => {}}
            onSubmit={handleSubmitEvaluation}
          />
        )

      case 'main':
      default:
        // team-insights and all-personnel manage their own scroll/layout
        if (treeSelection.type === 'team-insights' || treeSelection.type === 'all-personnel') return renderTreeContent()
        return subViewWrapper(renderTreeContent())
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={handleClose}
      fullHeight="90dvh"
      desktopPosition="left"
      desktopWidth="w-[90%]"
      header={headerConfig}
      headerFaded={searchFocused}
      blurHeader
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
  )
}
