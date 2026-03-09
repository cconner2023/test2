import { useState, useCallback, useMemo, useEffect } from 'react'
import { Ban, X } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { ContentWrapper } from './Settings/ContentWrapper'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { UI_TIMING } from '../Utilities/constants'
import { useTrainingCompletions } from '../Hooks/useTrainingCompletions'
import { useSupervisorData } from './Settings/Supervisor/useSupervisorData'
import { PersonnelRoster } from './Settings/Supervisor/PersonnelRoster'
import { SoldierProfile } from './Settings/Supervisor/SoldierProfile'
import { SoldierCertsEditor } from './Settings/Supervisor/SoldierCertsEditor'
import { EvaluateFlow } from './Settings/Supervisor/EvaluateFlow'
import { TeamInsights } from './Settings/Supervisor/TeamInsights'
import { SupervisorTree, type TreeSelection } from './Settings/Supervisor/SupervisorTree'
import { LoadingSpinner } from './LoadingSpinner'
import { useMinLoadTime } from '../Hooks/useMinLoadTime'
import { BarChart3 } from 'lucide-react'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { StepResult } from '../Types/SupervisorTestTypes'

// ─── State Machine ───────────────────────────────────────────────────────────

type SupervisorView =
  | { screen: 'main' }
  | { screen: 'soldier-certs'; soldier: ClinicMedic }
  | { screen: 'evaluate-select-task'; soldier: ClinicMedic }
  | { screen: 'evaluate-go-nogo'; soldier: ClinicMedic; taskNumber: string; taskTitle: string }

interface SupervisorDrawerProps {
  isVisible: boolean
  onClose: () => void
}

export function SupervisorDrawer({ isVisible, onClose }: SupervisorDrawerProps) {
  const [view, setView] = useState<SupervisorView>({ screen: 'main' })
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({ type: 'all-personnel' })
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<Set<string>>(new Set())
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // ── Data ───────────────────────────────────────────────────────────────────

  const { submitTestEvaluation } = useTrainingCompletions()

  const {
    loading: _loading,
    isSupervisor,
    currentUserId,
    medics,
    certs,
    tests,
    certsForSoldier,
    testsForSoldier,
    overdueItems,
    resolveName,
    updateCert,
    removeTest,
    refreshData,
    competencyMatrix,
    teamMetrics,
    computeTrendsForPeriod,
    testableTaskMap,
  } = useSupervisorData()
  const loading = useMinLoadTime(_loading)

  // ── Slide Animation ────────────────────────────────────────────────────────

  const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
    setSlideDirection(direction)
    setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleViewProfile = useCallback((soldier: ClinicMedic) => {
    setSelectedSoldierIds(new Set())
    if (!isMobile) {
      setTreeSelection({ type: 'soldier', soldierId: soldier.id })
    } else {
      setTreeSelection({ type: 'soldier', soldierId: soldier.id })
      handleSlideAnimation('left')
    }
  }, [isMobile, handleSlideAnimation])

  const handleEvaluate = useCallback((soldier: ClinicMedic) => {
    setSelectedSoldierIds(new Set())
    handleSlideAnimation('left')
    setView({ screen: 'evaluate-select-task', soldier })
  }, [handleSlideAnimation])

  const handleModifyCerts = useCallback((soldier: ClinicMedic) => {
    setSelectedSoldierIds(new Set())
    handleSlideAnimation('left')
    setView({ screen: 'soldier-certs', soldier })
  }, [handleSlideAnimation])

  const handleSelectTask = useCallback((taskNumber: string, taskTitle: string) => {
    if (view.screen !== 'evaluate-select-task') return
    handleSlideAnimation('left')
    setView({ screen: 'evaluate-go-nogo', soldier: view.soldier, taskNumber, taskTitle })
  }, [view, handleSlideAnimation])

  const handleSubmitEvaluation = useCallback(async (stepResults: StepResult[], notes: string) => {
    if (view.screen !== 'evaluate-go-nogo') return

    const hasNoGo = stepResults.some(s => s.result === 'NO_GO')
    await submitTestEvaluation({
      medicUserId: view.soldier.id,
      trainingItemId: view.taskNumber,
      result: hasNoGo ? 'NO_GO' : 'GO',
      stepResults,
      supervisorNotes: notes || undefined,
    })

    refreshData()
    setView({ screen: 'main' })
    setTreeSelection({ type: 'all-personnel' })
  }, [view, submitTestEvaluation, refreshData])

  const handleBack = useCallback(() => {
    if (view.screen === 'evaluate-go-nogo') {
      handleSlideAnimation('right')
      setView({ screen: 'evaluate-select-task', soldier: view.soldier })
    } else if (view.screen !== 'main') {
      handleSlideAnimation('right')
      setView({ screen: 'main' })
    } else if (isMobile && treeSelection.type !== 'all-personnel') {
      handleSlideAnimation('right')
      setTreeSelection({ type: 'all-personnel' })
    }
  }, [view, isMobile, treeSelection, handleSlideAnimation])

  const handleClose = useCallback(() => {
    setView({ screen: 'main' })
    setTreeSelection({ type: 'all-personnel' })
    setSelectedSoldierIds(new Set())
    setSlideDirection('')
    onClose()
  }, [onClose])

  const handleTreeSelect = useCallback((selection: TreeSelection) => {
    setTreeSelection(selection)
    setSelectedSoldierIds(new Set())
  }, [])

  const getOverdueCount = useCallback((userId: string) => {
    const { expiredCerts, failedTests } = overdueItems(userId)
    return expiredCerts.length + failedTests.length
  }, [overdueItems])

  // ── Swipe Back (mobile) ────────────────────────────────────────────────────

  const swipeHandlers = useSwipeBack(
    useMemo(() => {
      if (view.screen !== 'main') return handleBack
      if (isMobile && treeSelection.type !== 'all-personnel') return handleBack
      return undefined
    }, [view, isMobile, treeSelection, handleBack]),
    view.screen !== 'main' || (isMobile && treeSelection.type !== 'all-personnel'),
  )

  // ── Header Actions ─────────────────────────────────────────────────────────

  const mainHeaderActions = useMemo(() => {
    if (view.screen !== 'main') return undefined

    // Mobile on roster: double-pill with Team Insights + Close
    if (isMobile && treeSelection.type === 'all-personnel') {
      return (
        <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
          <button
            onClick={() => {
              handleSlideAnimation('left')
              setTreeSelection({ type: 'team-insights' })
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200"
            aria-label="Team Insights"
          >
            <BarChart3 className="w-5 h-5 stroke-current" />
          </button>
          <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>
      )
    }

    // Default: single close pill
    return (
      <div className="rounded-full bg-themewhite border border-tertiary/20 flex items-center p-0.5">
        <button onClick={handleClose} className="w-11 h-11 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all duration-200" aria-label="Close">
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>
    )
  }, [view, isMobile, treeSelection, handleClose, handleSlideAnimation])

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
        }
      case 'evaluate-go-nogo':
        return {
          title: 'Evaluation',
          showBack: true,
          onBack: handleBack,
        }
    }
  }, [view, isMobile, treeSelection, handleBack, mainHeaderActions])

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
        return (
          <PersonnelRoster
            medics={medics}
            certsForSoldier={certsForSoldier}
            overdueCount={getOverdueCount}
            selectedSoldierIds={selectedSoldierIds}
            onSelectSoldiers={setSelectedSoldierIds}
            onEvaluate={handleEvaluate}
            onView={handleViewProfile}
            onModify={handleModifyCerts}
          />
        )

      case 'soldier': {
        const soldier = medics.find(m => m.id === treeSelection.soldierId)
        if (!soldier || !currentUserId) return null
        return (
          <SoldierProfile
            soldier={soldier}
            certs={certsForSoldier(soldier.id)}
            tests={testsForSoldier(soldier.id)}
            overdueItems={overdueItems(soldier.id)}
            currentUserId={currentUserId}
            resolveName={resolveName}
            onUpdateCert={updateCert}
            onRemoveTest={removeTest}
          />
        )
      }

      case 'team-insights':
        return (
          <TeamInsights
            medics={medics}
            teamMetrics={teamMetrics}
            computeTrends={computeTrendsForPeriod}
            resolveName={resolveName}
            onViewSoldier={handleViewProfile}
          />
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
            resolveName={resolveName}
            onUpdateCert={updateCert}
          />
        ) : null

      case 'evaluate-select-task':
      case 'evaluate-go-nogo':
        return subViewWrapper(
          <EvaluateFlow
            soldier={view.screen === 'evaluate-select-task' ? view.soldier : view.soldier}
            taskNumber={view.screen === 'evaluate-go-nogo' ? view.taskNumber : null}
            taskTitle={view.screen === 'evaluate-go-nogo' ? view.taskTitle : null}
            onSelectTask={handleSelectTask}
            onSubmit={handleSubmitEvaluation}
          />
        )

      case 'main':
      default:
        // team-insights & all-personnel manage their own scroll/layout (action bar pinned outside scroll, like admin lists)
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
    >
      <ContentWrapper slideDirection={isMobile ? slideDirection : ''} swipeHandlers={isMobile && (view.screen !== 'main' || treeSelection.type !== 'all-personnel') ? swipeHandlers : undefined}>
        <div className="h-full relative">
          {/* Desktop: split pane layout */}
          {!isMobile && view.screen === 'main' && !loading && isSupervisor ? (
            <div className="flex h-full">
              <div className="w-[260px] shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50">
                <div className="flex-1 overflow-y-auto">
                  <SupervisorTree
                    medics={medics}
                    selection={treeSelection}
                    onSelect={handleTreeSelect}
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
