import { useState } from 'react'
import { Check, X, AlertTriangle, Info } from 'lucide-react'
import { getTaskData, type PerformanceStep } from '../../../Data/TrainingData'
import type { StepResult } from '../../../Types/SupervisorTestTypes'

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

// ─── EvaluationStep ──────────────────────────────────────────────────────────

export function EvaluationStep({
  taskNumber,
  taskTitle,
  medicName,
  onSubmit,
}: {
  taskNumber: string
  taskTitle: string
  medicName: string
  onSubmit: (stepResults: StepResult[], notes: string) => void
}) {
  const taskData = getTaskData(taskNumber)
  const [results, setResults] = useState<Map<string, 'GO' | 'NO_GO'>>(new Map())
  const [notes, setNotes] = useState('')

  if (!taskData) {
    return <div className="text-center py-12 text-tertiary/60">Task data not available</div>
  }

  const gradedSet = new Set(taskData.gradedSteps ?? [])
  const gradedStepNumbers = taskData.performanceSteps
    .filter(s => gradedSet.has(s.number))
    .map(s => s.number)
  const totalSteps = gradedStepNumbers.length
  const evaluatedCount = gradedStepNumbers.filter(n => results.has(n)).length
  const allEvaluated = evaluatedCount === totalSteps
  const hasNoGo = gradedStepNumbers.some(n => results.get(n) === 'NO_GO')
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
    const stepResults: StepResult[] = taskData.performanceSteps
      .filter(step => gradedSet.has(step.number))
      .map(step => ({
        stepNumber: step.number,
        result: results.get(step.number) ?? null,
      }))
    onSubmit(stepResults, notes)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-36">
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
              const isGraded = gradedSet.has(step.number)
              const currentResult = results.get(step.number)
              return (
                <div key={step.number} className={`bg-themewhite2 rounded-lg px-3 py-2.5 ${step.isSubStep ? 'ml-5' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-[9pt] text-tertiary/50 font-mono w-6 shrink-0 text-right mt-1">
                      {step.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isGraded ? 'text-primary' : 'text-tertiary/50'}`}>{step.text}</p>
                      {step.warning && <StepCallout type="warning" text={step.warning} />}
                      {step.caution && <StepCallout type="caution" text={step.caution} />}
                      {step.note && <StepCallout type="note" text={step.note} />}
                    </div>
                  </div>
                  {/* GO / NO GO buttons — only for graded steps */}
                  {isGraded && (
                    <div className="flex gap-2 mt-2 ml-8">
                      <button
                        onClick={() => toggleResult(step.number, 'GO')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]
                          ${currentResult === 'GO'
                            ? 'bg-themegreen text-white'
                            : 'bg-themegreen/10 text-themegreen border border-themegreen/20 hover:bg-themegreen/20'
                          }`}
                      >
                        <Check size={14} /> GO
                      </button>
                      <button
                        onClick={() => toggleResult(step.number, 'NO_GO')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]
                          ${currentResult === 'NO_GO'
                            ? 'bg-themeredred text-white'
                            : 'bg-themeredred/10 text-themeredred border border-themeredred/20 hover:bg-themeredred/20'
                          }`}
                      >
                        <X size={14} /> NO GO
                      </button>
                    </div>
                  )}
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
              overallPreview === 'PASS' ? 'bg-themegreen/15 text-themegreen' : 'bg-themeredred/15 text-themeredred'
            }`}>
              {overallPreview}
            </span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!allEvaluated}
          className="w-full py-3 rounded-lg bg-themeblue3 text-white text-sm font-semibold
                     hover:bg-themeblue3/90 active:scale-95 transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Evaluation
        </button>
      </div>
    </div>
  )
}
