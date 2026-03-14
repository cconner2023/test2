import { useState, useCallback, useMemo, useEffect } from 'react'
import { Ban, X, Search, ClipboardCheck, Pencil, Trash2, UserPlus, Check } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { ContentWrapper } from './Settings/ContentWrapper'
import { HeaderPill, PillButton } from './HeaderPill'
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
import { ClinicManagement } from './Settings/Supervisor/ClinicManagement'
import { ClinicDetail } from './Settings/Supervisor/ClinicDetail'
import { SupervisorAddMemberForm } from './Settings/Supervisor/SupervisorAddMemberForm'
import { SupervisorTree, type TreeSelection } from './Settings/Supervisor/SupervisorTree'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useClinicInvites } from '../Hooks/useClinicInvites'
import { getClinicDetails, type ClinicDetails } from '../lib/supervisorService'
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
  | { screen: 'clinic-management' }
  | { screen: 'clinic-detail'; clinicId: string }
  | { screen: 'add-member'; clinicId: string }

interface SupervisorDrawerProps {
  isVisible: boolean
  onClose: () => void
}

export function SupervisorDrawer({ isVisible, onClose }: SupervisorDrawerProps) {
  const [view, setView] = useState<SupervisorView>({ screen: 'main' })
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({ type: 'all-personnel' })
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<Set<string>>(new Set())
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
  const [showSearch, setShowSearch] = useState(false)
  const [focusCertId, setFocusCertId] = useState<string | null>(null)
  const [clinicEditing, setClinicEditing] = useState(false)
  const [clinicSaveRequested, setClinicSaveRequested] = useState(false)

  const isMobile = useIsMobile()
  const authClinicId = useAuthStore(s => s.clinicId)
  const { activeCode } = useClinicInvites()
  const [clinicDetails, setClinicDetails] = useState<ClinicDetails | null>(null)

  useEffect(() => {
    if (!authClinicId) return
    getClinicDetails(authClinicId).then(setClinicDetails)
  }, [authClinicId])

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
    setFocusCertId(null)
    setView({ screen: 'soldier-certs', soldier })
  }, [handleSlideAnimation])

  const handleNavigateToCert = useCallback((soldier: ClinicMedic, certId: string) => {
    setSelectedSoldierIds(new Set())
    handleSlideAnimation('left')
    setFocusCertId(certId)
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
    } else if (view.screen === 'add-member') {
      handleSlideAnimation('right')
      setView({ screen: 'clinic-detail', clinicId: view.clinicId })
    } else if (view.screen === 'clinic-detail') {
      handleSlideAnimation('right')
      setClinicEditing(false)
      if (isMobile) {
        setView({ screen: 'main' })
        setTreeSelection({ type: 'all-personnel' })
      } else {
        setView({ screen: 'clinic-management' })
      }
    } else if (view.screen === 'clinic-management') {
      handleSlideAnimation('right')
      setView({ screen: 'main' })
      if (isMobile) setTreeSelection({ type: 'all-personnel' })
    } else if (view.screen !== 'main') {
      handleSlideAnimation('right')
      setFocusCertId(null)
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
    setClinicEditing(false)
    onClose()
  }, [onClose])

  const handleTreeSelect = useCallback((selection: TreeSelection) => {
    setTreeSelection(selection)
    setSelectedSoldierIds(new Set())
    if (selection.type === 'clinic') {
      setView({ screen: 'clinic-detail', clinicId: selection.clinicId })
    } else if (selection.type === 'clinic-management') {
      setView({ screen: 'clinic-management' })
    } else if (view.screen === 'clinic-management' || view.screen === 'clinic-detail' || view.screen === 'add-member') {
      setView({ screen: 'main' })
    }
  }, [view])

  const handleSelectClinic = useCallback((clinicId: string) => {
    handleSlideAnimation('left')
    setView({ screen: 'clinic-detail', clinicId })
  }, [handleSlideAnimation])

  const refreshClinicDetails = useCallback(() => {
    if (authClinicId) getClinicDetails(authClinicId).then(setClinicDetails)
  }, [authClinicId])

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

    // Roster view (mobile): Search + Close
    if (isMobile && treeSelection.type === 'all-personnel') {
      return (
        <HeaderPill>
          <PillButton
            icon={Search}
            iconSize={20}
            onClick={() => setShowSearch(prev => !prev)}
            label="Search"
          />
          <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
      )
    }

    // Desktop soldier selected: Evaluate + Edit Certs + Close
    if (!isMobile && selectedSoldier) {
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
            'clinic-management': 'Clinics',
            'clinic': 'Clinic Detail',
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
      case 'clinic-management':
        return {
          title: 'Clinics',
          showBack: true,
          onBack: handleBack,
        }
      case 'clinic-detail': {
        const clinicDetailPills = (
          <HeaderPill>
            <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
              clinicEditing ? 'max-w-33 opacity-100' : 'max-w-0 opacity-0'
            }`}>
              <PillButton
                icon={Trash2}
                iconSize={18}
                onClick={() => {/* delete handled inline */}}
                label="Delete"
              />
              <PillButton
                icon={UserPlus}
                iconSize={18}
                onClick={() => {
                  handleSlideAnimation('left')
                  setView({ screen: 'add-member', clinicId: view.clinicId })
                }}
                label="Add"
              />
              <PillButton icon={X} iconSize={18} onClick={() => setClinicEditing(false)} label="Cancel" />
            </div>
            <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
              !clinicEditing ? 'max-w-11 opacity-100' : 'max-w-0 opacity-0'
            }`}>
              <PillButton
                icon={Pencil}
                iconSize={18}
                onClick={() => setClinicEditing(true)}
                label="Edit"
              />
            </div>
            {clinicEditing ? (
              <PillButton
                icon={Check}
                iconSize={18}
                circleBg="bg-themeblue3 text-white"
                onClick={() => setClinicSaveRequested(true)}
                label="Save"
              />
            ) : (
              <PillButton icon={X} onClick={handleClose} label="Close" />
            )}
          </HeaderPill>
        )
        return {
          title: clinicName ?? 'Clinic',
          showBack: true,
          onBack: handleBack,
          rightContent: clinicDetailPills,
          hideDefaultClose: true,
        }
      }
      case 'add-member':
        return {
          title: 'Add Personnel',
          showBack: true,
          onBack: handleBack,
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
  }, [view, isMobile, treeSelection, handleBack, mainHeaderActions, handleClose, clinicName, handleSlideAnimation, clinicEditing])

  // ── Subview Wrapper ────────────────────────────────────────────────────────

  const subViewWrapper = (children: React.ReactNode) => (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5 pb-8 min-h-full">
        {children}
      </div>
    </div>
  )

  // ── Clinic card data (for the card list) ─────────────────────────────────

  const clinicCards = useMemo(() => {
    if (!authClinicId) return []
    return [{
      id: authClinicId,
      name: clinicName ?? 'My Clinic',
      personnelCount: medics.length,
      uics: clinicDetails?.uics ?? [],
      location: clinicDetails?.location ?? null,
      activeCode,
    }]
  }, [authClinicId, clinicName, medics.length, clinicDetails, activeCode])

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
                onNavigateToTask={(taskId) => {
                  handleClose()
                  setTimeout(() => useNavigationStore.getState().setShowTrainingDrawer(taskId), 300)
                }}
              />
            </div>
          )
        }
        // Mobile: swipeable roster cards
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
            showSearch={showSearch}
            clinicName={clinicName}
            teamMetrics={teamMetrics}
            onViewInsights={() => {
              handleSlideAnimation('left')
              setTreeSelection({ type: 'team-insights' })
            }}
            onManageClinic={() => {
              handleSlideAnimation('left')
              if (authClinicId) {
                setView({ screen: 'clinic-detail', clinicId: authClinicId })
              } else {
                setView({ screen: 'clinic-management' })
              }
            }}
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
            readinessPercent={readinessForSoldier(soldier.id)}
            currentUserId={currentUserId}
            resolveName={resolveName}
            onNavigateToCert={(certId) => handleNavigateToCert(soldier, certId)}
            onRemoveTest={removeTest}
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
              onNavigateToTask={(taskId) => {
                handleClose()
                setTimeout(() => useNavigationStore.getState().setShowTrainingDrawer(taskId), 300)
              }}
            />
          </div>
        )

      case 'clinic-management':
        return (
          <div className="h-full overflow-y-auto px-4 py-3 md:px-5 md:py-5 pb-8">
            <ClinicManagement
              clinics={clinicCards}
              onSelect={handleSelectClinic}
            />
          </div>
        )

      case 'clinic': {
        const card = clinicCards.find(c => c.id === treeSelection.clinicId)
        return authClinicId ? subViewWrapper(
          <ClinicDetail
            clinicId={treeSelection.clinicId}
            clinicName={card?.name ?? 'Clinic'}
            clinicUics={card?.uics ?? []}
            clinicLocation={card?.location ?? null}
            activeCode={activeCode}
            medics={medics}
            editing={clinicEditing}
            onEditingChange={setClinicEditing}
            saveRequested={clinicSaveRequested}
            onSaveComplete={() => setClinicSaveRequested(false)}
            onAddMember={() => {
              handleSlideAnimation('left')
              setView({ screen: 'add-member', clinicId: treeSelection.clinicId })
            }}
            onClinicUpdated={refreshClinicDetails}
          />
        ) : null
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

      case 'clinic-management':
        return subViewWrapper(
          <ClinicManagement
            clinics={clinicCards}
            onSelect={handleSelectClinic}
          />
        )

      case 'clinic-detail':
        return authClinicId ? subViewWrapper(
          <ClinicDetail
            clinicId={view.clinicId}
            clinicName={clinicName ?? 'My Clinic'}
            clinicUics={clinicDetails?.uics ?? []}
            clinicLocation={clinicDetails?.location ?? null}
            activeCode={activeCode}
            medics={medics}
            editing={clinicEditing}
            onEditingChange={setClinicEditing}
            saveRequested={clinicSaveRequested}
            onSaveComplete={() => setClinicSaveRequested(false)}
            onAddMember={() => {
              handleSlideAnimation('left')
              setView({ screen: 'add-member', clinicId: view.clinicId })
            }}
            onClinicUpdated={refreshClinicDetails}
          />
        ) : null

      case 'add-member':
        return subViewWrapper(
          <SupervisorAddMemberForm
            clinicId={view.clinicId}
            onBack={handleBack}
            onSaved={() => {
              handleSlideAnimation('right')
              setView({ screen: 'clinic-detail', clinicId: view.clinicId })
              refreshData()
            }}
          />
        )

      case 'main':
      default:
        // team-insights, all-personnel, and clinic-management manage their own scroll/layout
        if (treeSelection.type === 'team-insights' || treeSelection.type === 'all-personnel' || treeSelection.type === 'clinic-management' || treeSelection.type === 'clinic') return renderTreeContent()
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
      <ContentWrapper slideDirection={isMobile ? slideDirection : ''} swipeHandlers={isMobile && canSwipeBack ? swipeHandlers : undefined}>
        <div className="h-full relative">
          {/* Desktop: split pane layout */}
          {!isMobile && !loading && isSupervisor ? (
            <div className="flex h-full">
              <div className="w-65 shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50">
                <div className="flex-1 min-h-0">
                  <SupervisorTree
                    medics={medics}
                    clinics={clinicCards}
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
