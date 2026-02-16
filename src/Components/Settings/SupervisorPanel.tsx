import { useState, useMemo, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Check, X, Ban, AlertTriangle, Info, Clock, FileText, Users } from 'lucide-react'
import { stp68wTraining } from '../../Data/TrainingTaskList'
import { getTaskData } from '../../Data/TrainingData'
import type { PerformanceStep } from '../../Data/TrainingData'
import type { subjectAreaArray, subjectAreaArrayOptions } from '../../Types/CatTypes'
import type { StepResult, ClinicMedic } from '../../Types/SupervisorTestTypes'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useTrainingCompletions } from '../../Hooks/useTrainingCompletions'
import type { TrainingCompletionUI } from '../../Hooks/useTrainingCompletions'
import { supabase } from '../../lib/supabase'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMedicName(medic: ClinicMedic): string {
  const parts: string[] = []
  if (medic.rank) parts.push(medic.rank)
  if (medic.lastName) {
    let name = medic.lastName
    if (medic.firstName) name += ', ' + medic.firstName.charAt(0) + '.'
    if (medic.middleInitial) name += medic.middleInitial + '.'
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}

function toSubjectAreaArrays(skillLevelIdx: number): subjectAreaArray[] {
  const level = stp68wTraining[skillLevelIdx]
  if (!level) return []
  return level.subjectArea.map((area, areaIdx) => ({
    id: areaIdx,
    icon: level.skillLevel,
    text: area.name,
    isParent: true,
    options: area.tasks.map((task, taskIdx) => ({
      id: taskIdx,
      icon: task.id,
      text: task.title,
      isParent: false,
      parentId: areaIdx,
    })),
  }))
}

// ─── Step Callout (reused pattern from TrainingPanel) ────────────────────────

function StepCallout({ type, text }: { type: 'warning' | 'caution' | 'note'; text: string }) {
  const styles = {
    warning: { bg: 'bg-themeyellow/10', border: 'border-themeyellow/30', icon: <AlertTriangle size={13} className="text-themeyellow shrink-0 mt-0.5" />, label: 'WARNING' },
    caution: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />, label: 'CAUTION' },
    note: { bg: 'bg-themeblue2/10', border: 'border-themeblue2/30', icon: <Info size={13} className="text-themeblue2 shrink-0 mt-0.5" />, label: 'NOTE' },
  }
  const s = styles[type]
  return (
    <div className={`${s.bg} border ${s.border} rounded-md px-3 py-2 mt-1.5 flex items-start gap-2`}>
      {s.icon}
      <div>
        <p className="text-[7pt] font-bold tracking-wider opacity-60">{s.label}</p>
        <p className="text-xs text-primary/80">{text}</p>
      </div>
    </div>
  )
}

// ─── Step 1: Select Medic ────────────────────────────────────────────────────

function SelectMedicStep({
  onSelect,
}: {
  onSelect: (medic: ClinicMedic) => void
}) {
  const { medics, loading, error } = useClinicMedics()

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="text-tertiary/60">Loading medics...</div></div>
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Users size={48} className="mx-auto mb-4 text-tertiary/40" />
        <p className="text-sm text-tertiary/60">{error}</p>
      </div>
    )
  }

  if (medics.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size={48} className="mx-auto mb-4 text-tertiary/40" />
        <p className="text-sm text-tertiary/60">No medics found in your clinic</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-tertiary/60 mb-3">Select the medic to evaluate:</p>
      {medics.map((medic) => (
        <button
          key={medic.id}
          onClick={() => onSelect(medic)}
          className="flex items-center w-full px-4 py-3 rounded-xl text-left
                     hover:bg-themewhite2 active:scale-[0.98] transition-all"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">{formatMedicName(medic)}</p>
            {medic.credential && (
              <p className="text-[9pt] text-tertiary/50">{medic.credential}</p>
            )}
          </div>
          <ChevronRight size={16} className="text-tertiary/40 shrink-0 ml-2" />
        </button>
      ))}
    </div>
  )
}

// ─── Step 2: Select Task ─────────────────────────────────────────────────────

function SelectTaskStep({
  onSelectTask,
  onBack,
  medicName,
}: {
  onSelectTask: (taskNumber: string, taskTitle: string) => void
  onBack: () => void
  medicName: string
}) {
  const [selectedLevel, setSelectedLevel] = useState(0)
  const [selectedArea, setSelectedArea] = useState<subjectAreaArray | null>(null)
  const areas = useMemo(() => toSubjectAreaArrays(selectedLevel), [selectedLevel])

  if (selectedArea) {
    return (
      <div>
        <button onClick={() => setSelectedArea(null)} className="flex items-center gap-1 text-sm text-themeblue2 mb-3 hover:underline">
          <ChevronLeft size={16} /> Back to subjects
        </button>
        <p className="text-xs text-tertiary/60 mb-3">
          Testing <span className="font-medium text-primary">{medicName}</span> &mdash; select a task:
        </p>
        <div className="space-y-1">
          {selectedArea.options.map((task: subjectAreaArrayOptions) => {
            const hasData = !!getTaskData(task.icon)
            return (
              <button
                key={task.id}
                onClick={() => hasData && onSelectTask(task.icon, task.text)}
                disabled={!hasData}
                className={`flex items-center w-full px-4 py-3 rounded-xl text-left transition-all
                  ${hasData ? 'hover:bg-themewhite2 active:scale-[0.98] cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[8pt] text-tertiary/50 font-mono">{task.icon}</p>
                  <p className={`text-sm font-medium truncate ${hasData ? 'text-primary' : 'text-tertiary'}`}>{task.text}</p>
                </div>
                {hasData && <ChevronRight size={16} className="text-tertiary/30 shrink-0 ml-2" />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-themeblue2 mb-3 hover:underline">
        <ChevronLeft size={16} /> Back to medic list
      </button>
      <p className="text-xs text-tertiary/60 mb-3">
        Testing <span className="font-medium text-primary">{medicName}</span> &mdash; select a subject area:
      </p>

      {/* Skill Level Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {stp68wTraining.map((level, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedLevel(idx)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97]
              ${idx === selectedLevel ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-tertiary/70 hover:text-primary'}`}
          >
            {level.skillLevel}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {areas.map((area) => (
          <button
            key={area.id}
            onClick={() => setSelectedArea(area)}
            className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                       transition-all rounded-xl text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[9pt] text-tertiary/50 font-medium uppercase tracking-wider">{area.icon}</p>
              <p className="text-base text-primary font-medium truncate">{area.text}</p>
            </div>
            <ChevronRight size={16} className="text-tertiary/40 shrink-0 ml-2" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Step 3: GO/NO GO Evaluation ─────────────────────────────────────────────

function EvaluationStep({
  taskNumber,
  taskTitle,
  medicName,
  onBack,
  onSubmit,
}: {
  taskNumber: string
  taskTitle: string
  medicName: string
  onBack: () => void
  onSubmit: (stepResults: StepResult[], notes: string) => void
}) {
  const taskData = getTaskData(taskNumber)
  const [results, setResults] = useState<Map<string, 'GO' | 'NO_GO'>>(new Map())
  const [notes, setNotes] = useState('')

  if (!taskData) {
    return <div className="text-center py-12 text-tertiary/60">Task data not available</div>
  }

  const totalSteps = taskData.performanceSteps.length
  const evaluatedCount = results.size
  const allEvaluated = evaluatedCount === totalSteps
  const hasNoGo = Array.from(results.values()).some(v => v === 'NO_GO')
  const overallPreview = !allEvaluated ? null : hasNoGo ? 'FAIL' : 'PASS'

  const toggleResult = (stepNumber: string, value: 'GO' | 'NO_GO') => {
    setResults(prev => {
      const next = new Map(prev)
      if (next.get(stepNumber) === value) {
        next.delete(stepNumber)
      } else {
        next.set(stepNumber, value)
      }
      return next
    })
  }

  const handleSubmit = () => {
    const stepResults: StepResult[] = taskData.performanceSteps.map(step => ({
      stepNumber: step.number,
      result: results.get(step.number) ?? null,
    }))
    onSubmit(stepResults, notes)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-36">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-themeblue2 mb-3 hover:underline">
          <ChevronLeft size={16} /> Back to task selection
        </button>

        {/* Header */}
        <div className="mb-4">
          <p className="text-[8pt] text-tertiary/50 font-mono">{taskNumber}</p>
          <h3 className="text-lg font-semibold text-primary">{taskTitle}</h3>
          <p className="text-xs text-tertiary/60 mt-1">Evaluating: <span className="font-medium text-primary">{medicName}</span></p>
        </div>

        {/* Task-level caution */}
        {taskData.caution && (
          <div className="mb-4">
            <StepCallout type="caution" text={taskData.caution} />
          </div>
        )}

        {/* Standards */}
        <div className="mb-4">
          <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Standards</p>
          <div className="bg-themewhite2 rounded-lg px-3.5 py-3">
            <p className="text-sm text-primary/80 leading-relaxed">{taskData.standards}</p>
          </div>
        </div>

        {/* Performance Steps with GO/NO GO */}
        <div className="mb-4">
          <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Performance Steps</p>
          <div className="space-y-1">
            {taskData.performanceSteps.map((step: PerformanceStep) => {
              const currentResult = results.get(step.number)
              return (
                <div key={step.number} className={`bg-themewhite2 rounded-lg px-3 py-2.5 ${step.isSubStep ? 'ml-5' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-[9pt] text-tertiary/50 font-mono w-6 shrink-0 text-right mt-1">
                      {step.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary">{step.text}</p>
                      {step.warning && <StepCallout type="warning" text={step.warning} />}
                      {step.caution && <StepCallout type="caution" text={step.caution} />}
                      {step.note && <StepCallout type="note" text={step.note} />}
                    </div>
                  </div>
                  {/* GO / NO GO buttons */}
                  <div className="flex gap-2 mt-2 ml-8">
                    <button
                      onClick={() => toggleResult(step.number, 'GO')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]
                        ${currentResult === 'GO'
                          ? 'bg-green-600 text-white'
                          : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                        }`}
                    >
                      <Check size={14} /> GO
                    </button>
                    <button
                      onClick={() => toggleResult(step.number, 'NO_GO')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]
                        ${currentResult === 'NO_GO'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                        }`}
                    >
                      <X size={14} /> NO GO
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Supervisor Notes */}
        <div className="mb-4">
          <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Supervisor Notes (Optional)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional comments or observations..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-sm
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                       transition-colors placeholder:text-tertiary/30 resize-none"
          />
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 left-0 right-0 bg-themewhite border-t border-tertiary/10 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-tertiary/60">
            {evaluatedCount}/{totalSteps} steps evaluated
          </span>
          {overallPreview && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              overallPreview === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {overallPreview}
            </span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!allEvaluated}
          className="w-full py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold
                     hover:bg-amber-600 active:scale-[0.98] transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Evaluation
        </button>
      </div>
    </div>
  )
}

// ─── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab() {
  const { completions, deleteCompletion } = useTrainingCompletions()
  const tests = completions.filter((c) => c.completionType === 'test')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (tests.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={48} className="mx-auto mb-4 text-tertiary/40" />
        <p className="text-sm text-tertiary/60">No test records yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tests.map((record: TrainingCompletionUI) => {
        const isExpanded = expandedId === record.id
        const taskTitle = getTaskData(record.trainingItemId)?.title ?? record.trainingItemId
        const overallResult = record.result === 'GO' ? 'PASS' : 'FAIL'

        return (
          <div key={record.id} className="rounded-lg border border-tertiary/10 bg-themewhite2 overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : record.id)}
              className="flex items-center w-full px-4 py-3 text-left hover:bg-themewhite2/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">{record.userId}</p>
                <p className="text-xs text-tertiary/60 truncate">{taskTitle}</p>
                <p className="text-[9pt] text-tertiary/40 mt-0.5">
                  {new Date(record.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`shrink-0 ml-2 px-3 py-1 rounded-full text-xs font-bold ${
                overallResult === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {overallResult}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-3 border-t border-tertiary/10">
                <div className="mt-3 mb-2">
                  <p className="text-[8pt] text-tertiary/50 font-mono">{record.trainingItemId}</p>
                  <p className="text-xs text-tertiary/60 mt-1">
                    Supervisor: {record.supervisorId ?? 'Supervisor'} &middot; {new Date(record.updatedAt).toLocaleString()}
                  </p>
                </div>

                {record.stepResults && (
                  <div className="space-y-1">
                    {record.stepResults.map((sr) => (
                      <div key={sr.stepNumber} className="flex items-center gap-2 py-1">
                        <span className="text-[9pt] text-tertiary/50 font-mono w-6 text-right">{sr.stepNumber}</span>
                        {sr.result === 'GO' ? (
                          <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-green-100 text-green-700">GO</span>
                        ) : sr.result === 'NO_GO' ? (
                          <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-red-100 text-red-700">NO GO</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9pt] bg-gray-100 text-gray-500">--</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {record.supervisorNotes && (
                  <div className="mt-3 p-2 bg-themewhite rounded text-sm">
                    <span className="text-tertiary/60">Notes:</span> <span className="text-primary">{record.supervisorNotes}</span>
                  </div>
                )}

                {deletingId === record.id ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => { deleteCompletion(record.id); setDeletingId(null); setExpandedId(null) }}
                      className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-4 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(record.id)}
                    className="mt-3 text-xs text-red-500 hover:underline"
                  >
                    Delete record
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main SupervisorPanel ────────────────────────────────────────────────────

type WizardStep = 'select-medic' | 'select-task' | 'evaluate'

export function SupervisorPanel() {
  const [isSupervisor, setIsSupervisor] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'new-test' | 'history'>('new-test')
  const { submitTestEvaluation } = useTrainingCompletions()

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('select-medic')
  const [selectedMedic, setSelectedMedic] = useState<ClinicMedic | null>(null)
  const [selectedTaskNumber, setSelectedTaskNumber] = useState<string | null>(null)
  const [selectedTaskTitle, setSelectedTaskTitle] = useState<string | null>(null)

  // Check supervisor role
  useState(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('roles')
          .eq('id', user.id)
          .single()
        const roles = data?.roles as string[] | null
        setIsSupervisor(roles?.includes('supervisor') ?? false)
      }
      setLoading(false)
    })()
  })

  const resetWizard = useCallback(() => {
    setWizardStep('select-medic')
    setSelectedMedic(null)
    setSelectedTaskNumber(null)
    setSelectedTaskTitle(null)
  }, [])

  const handleSelectMedic = useCallback((medic: ClinicMedic) => {
    setSelectedMedic(medic)
    setWizardStep('select-task')
  }, [])

  const handleSelectTask = useCallback((taskNumber: string, taskTitle: string) => {
    setSelectedTaskNumber(taskNumber)
    setSelectedTaskTitle(taskTitle)
    setWizardStep('evaluate')
  }, [])

  const handleSubmitEvaluation = useCallback(async (stepResults: StepResult[], notes: string) => {
    if (!selectedMedic || !selectedTaskNumber) return

    const hasNoGo = stepResults.some(s => s.result === 'NO_GO')
    await submitTestEvaluation({
      medicUserId: selectedMedic.id,
      trainingItemId: selectedTaskNumber,
      result: hasNoGo ? 'NO_GO' : 'GO',
      stepResults,
      supervisorNotes: notes || undefined,
    })

    resetWizard()
    setActiveTab('history')
  }, [selectedMedic, selectedTaskNumber, submitTestEvaluation, resetWizard])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-tertiary/60">Loading...</div>
      </div>
    )
  }

  if (!isSupervisor) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center">
          <Ban size={48} className="mx-auto mb-4 text-tertiary/40" />
          <h3 className="text-lg font-semibold text-primary mb-2">Access Denied</h3>
          <p className="text-sm text-tertiary/60">You need the supervisor role to access this panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        {/* Tab bar */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setActiveTab('new-test'); resetWizard() }}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors
              ${activeTab === 'new-test' ? 'bg-amber-500 text-white' : 'bg-themewhite2 text-tertiary/70 hover:bg-themewhite2/80'}`}
          >
            <FileText size={14} /> New Test
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-colors
              ${activeTab === 'history' ? 'bg-amber-500 text-white' : 'bg-themewhite2 text-tertiary/70 hover:bg-themewhite2/80'}`}
          >
            <Clock size={14} /> History
          </button>
        </div>

        {activeTab === 'history' ? (
          <HistoryTab />
        ) : wizardStep === 'select-medic' ? (
          <SelectMedicStep onSelect={handleSelectMedic} />
        ) : wizardStep === 'select-task' && selectedMedic ? (
          <SelectTaskStep
            onSelectTask={handleSelectTask}
            onBack={() => setWizardStep('select-medic')}
            medicName={formatMedicName(selectedMedic)}
          />
        ) : wizardStep === 'evaluate' && selectedMedic && selectedTaskNumber && selectedTaskTitle ? (
          <EvaluationStep
            taskNumber={selectedTaskNumber}
            taskTitle={selectedTaskTitle}
            medicName={formatMedicName(selectedMedic)}
            onBack={() => setWizardStep('select-task')}
            onSubmit={handleSubmitEvaluation}
          />
        ) : null}
      </div>
    </div>
  )
}
