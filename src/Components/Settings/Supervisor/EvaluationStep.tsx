import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { getTaskData, type PerformanceStep } from '../../../Data/TrainingData'
import type { StepResult } from '../../../Types/SupervisorTestTypes'
import { StepCallout, SectionHeader } from '../../TrainingStepComponents'

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
        <div className="mb-5">
          <p className="text-[8pt] text-tertiary/50 font-mono">{taskNumber}</p>
          <h3 className="text-lg font-semibold text-primary/90">{taskTitle}</h3>
          <p className="text-xs text-tertiary/60 mt-1">Evaluating: <span className="font-medium text-primary/90">{medicName}</span></p>
        </div>

        {/* Task-level caution */}
        {taskData.caution && (
          <div className="mb-4">
            <StepCallout type="caution" text={taskData.caution} />
          </div>
        )}

        {/* Standards */}
        <div className="mb-5">
          <SectionHeader>Standards</SectionHeader>
          <p className="text-sm text-primary/80 leading-relaxed">{taskData.standards}</p>
        </div>

        {/* Performance Steps with inline GO/NO GO */}
        <div className="mb-5">
          <SectionHeader>Performance Steps</SectionHeader>
          {(() => {
            // Group steps into card segments, breaking when a step has a callout
            const segments: { steps: PerformanceStep[]; trailingCallouts: { type: 'warning' | 'caution' | 'note'; text: string }[] }[] = []
            let current: PerformanceStep[] = []

            for (const step of taskData.performanceSteps) {
              const callouts: { type: 'warning' | 'caution' | 'note'; text: string }[] = []
              if (step.warning) callouts.push({ type: 'warning', text: step.warning })
              if (step.caution) callouts.push({ type: 'caution', text: step.caution })
              if (step.note) callouts.push({ type: 'note', text: step.note })

              current.push(step)

              if (callouts.length > 0) {
                segments.push({ steps: current, trailingCallouts: callouts })
                current = []
              }
            }
            if (current.length > 0) {
              segments.push({ steps: current, trailingCallouts: [] })
            }

            return segments.map((segment, segIdx) => (
              <div key={segIdx}>
                <div className={`bg-themewhite2 ${segIdx === 0 ? 'rounded-t-lg' : ''} ${segment.trailingCallouts.length === 0 && segIdx === segments.length - 1 ? 'rounded-b-lg' : ''} px-3 py-1`}>
                  {segment.steps.map((step, stepIdx) => {
                    const isGraded = gradedSet.has(step.number)
                    const currentResult = results.get(step.number)
                    // Check if this substep's parent is graded — align right edge with parent text
                    const parentIsGraded = step.isSubStep && (() => {
                      const parentNum = step.number.replace(/[a-z]+$/i, '')
                      return gradedSet.has(parentNum)
                    })()
                    return (
                      <div key={step.number} className={`flex items-center gap-2 py-2 ${step.isSubStep ? 'ml-6' : ''} ${parentIsGraded && !isGraded ? 'pr-[4.5rem]' : ''}`}>
                        <span className="text-[9pt] text-tertiary/50 font-mono w-6 shrink-0 text-right">
                          {step.number}
                        </span>
                        <p className={`text-sm flex-1 min-w-0 ${isGraded ? 'text-primary/90' : 'text-tertiary/50'}`}>{step.text}</p>
                        {isGraded && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => toggleResult(step.number, 'NO_GO')}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90
                                ${currentResult === 'NO_GO'
                                  ? 'bg-themeredred text-white'
                                  : 'bg-themewhite3 text-tertiary/25 hover:text-themeredred hover:bg-themeredred/10'
                                }`}
                              aria-label={`NO GO step ${step.number}`}
                            >
                              <X size={15} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => toggleResult(step.number, 'GO')}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90
                                ${currentResult === 'GO'
                                  ? 'bg-themegreen text-white'
                                  : 'bg-themewhite3 text-tertiary/25 hover:text-themegreen hover:bg-themegreen/10'
                                }`}
                              aria-label={`GO step ${step.number}`}
                            >
                              <Check size={15} strokeWidth={2.5} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {segment.trailingCallouts.map((c, ci) => (
                  <div key={ci} className="px-1 py-1">
                    <StepCallout type={c.type} text={c.text} />
                  </div>
                ))}
              </div>
            ))
          })()}
        </div>

        {/* Supervisor Notes */}
        <div className="mb-5">
          <SectionHeader>Supervisor Notes (Optional)</SectionHeader>
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
