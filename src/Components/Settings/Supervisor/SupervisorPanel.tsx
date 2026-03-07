import { useState, useEffect, useCallback, type MutableRefObject } from 'react'
import { Ban } from 'lucide-react'
import { useTrainingCompletions } from '../../../Hooks/useTrainingCompletions'
import { useSupervisorData } from './useSupervisorData'
import { PersonnelRoster } from './PersonnelRoster'
import { SoldierProfile } from './SoldierProfile'
import { SoldierCertsEditor } from './SoldierCertsEditor'
import { EvaluateFlow } from './EvaluateFlow'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import { LoadingSpinner } from '../../LoadingSpinner'
import { useMinLoadTime } from '../../../Hooks/useMinLoadTime'
import type { StepResult } from '../../../Types/SupervisorTestTypes'

// ─── State Machine ───────────────────────────────────────────────────────────

type SupervisorView =
  | { screen: 'roster' }
  | { screen: 'soldier-profile'; soldier: ClinicMedic }
  | { screen: 'soldier-certs'; soldier: ClinicMedic }
  | { screen: 'evaluate-select-task'; soldier: ClinicMedic }
  | { screen: 'evaluate-go-nogo'; soldier: ClinicMedic; taskNumber: string; taskTitle: string }

// ─── Component ───────────────────────────────────────────────────────────────

export function SupervisorPanel({
  backRef,
  onBackToMain,
}: {
  backRef?: MutableRefObject<(() => void) | null>
  onBackToMain?: () => void
}) {
  const [view, setView] = useState<SupervisorView>({ screen: 'roster' })
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<Set<string>>(new Set())
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
  } = useSupervisorData()
  const loading = useMinLoadTime(_loading)

  // ─── Back Navigation (backRef sync) ─────────────────────────────────────

  useEffect(() => {
    if (!backRef) return

    switch (view.screen) {
      case 'roster':
        backRef.current = onBackToMain ?? null
        break
      case 'soldier-profile':
      case 'soldier-certs':
      case 'evaluate-select-task':
        backRef.current = () => setView({ screen: 'roster' })
        break
      case 'evaluate-go-nogo':
        backRef.current = () =>
          setView({ screen: 'evaluate-select-task', soldier: view.soldier })
        break
    }
  }, [backRef, onBackToMain, view])

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleEvaluate = useCallback((soldier: ClinicMedic) => {
    setSelectedSoldierIds(new Set())
    setView({ screen: 'evaluate-select-task', soldier })
  }, [])

  const handleViewProfile = useCallback((soldier: ClinicMedic) => {
    setSelectedSoldierIds(new Set())
    setView({ screen: 'soldier-profile', soldier })
  }, [])

  const handleModifyCerts = useCallback((soldier: ClinicMedic) => {
    setSelectedSoldierIds(new Set())
    setView({ screen: 'soldier-certs', soldier })
  }, [])

  const handleSelectTask = useCallback((taskNumber: string, taskTitle: string) => {
    if (view.screen !== 'evaluate-select-task') return
    setView({ screen: 'evaluate-go-nogo', soldier: view.soldier, taskNumber, taskTitle })
  }, [view])

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

    // Refresh data and return to roster
    refreshData()
    setView({ screen: 'roster' })
  }, [view, submitTestEvaluation, refreshData])

  const getOverdueCount = useCallback((userId: string) => {
    const { expiredCerts, failedTests } = overdueItems(userId)
    return expiredCerts.length + failedTests.length
  }, [overdueItems])

  // ─── Loading / Auth Guard ───────────────────────────────────────────────

  if (loading) {
    return (
      <LoadingSpinner className="h-full text-tertiary" />
    )
  }

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

  // ─── Screen Routing ─────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        {view.screen === 'roster' && (
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
        )}

        {view.screen === 'soldier-profile' && currentUserId && (
          <SoldierProfile
            soldier={view.soldier}
            certs={certsForSoldier(view.soldier.id)}
            tests={testsForSoldier(view.soldier.id)}
            overdueItems={overdueItems(view.soldier.id)}
            currentUserId={currentUserId}
            resolveName={resolveName}
            onUpdateCert={updateCert}
            onRemoveTest={removeTest}
          />
        )}

        {view.screen === 'soldier-certs' && currentUserId && (
          <SoldierCertsEditor
            soldier={view.soldier}
            certs={certsForSoldier(view.soldier.id)}
            currentUserId={currentUserId}
            resolveName={resolveName}
            onUpdateCert={updateCert}
          />
        )}

        {(view.screen === 'evaluate-select-task' || view.screen === 'evaluate-go-nogo') && (
          <EvaluateFlow
            soldier={view.screen === 'evaluate-select-task' ? view.soldier : view.soldier}
            taskNumber={view.screen === 'evaluate-go-nogo' ? view.taskNumber : null}
            taskTitle={view.screen === 'evaluate-go-nogo' ? view.taskTitle : null}
            onSelectTask={handleSelectTask}
            onSubmit={handleSubmitEvaluation}
          />
        )}
      </div>
    </div>
  )
}
