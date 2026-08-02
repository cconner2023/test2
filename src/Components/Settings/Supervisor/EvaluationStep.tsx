import { useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { type PerformanceStep } from '../../../Data/TrainingData'
import { getEvaluableTaskData } from '../../../Utilities/algorithmCompetency'
import type { StepResult } from '../../../Types/SupervisorTestTypes'
import { StepCallout } from '../../TrainingStepComponents'
import { SectionHeader } from '@/Components/primitives/Section'
import { AddFab } from '@/Components/primitives/AddFab'
import { TextArea } from '@/Components/primitives/FormInputs'

// ─── EvaluationStep ──────────────────────────────────────────────────────────

export function EvaluationStep({
  taskNumber,
  hasNext = false,
  onSubmit,
}: {
  taskNumber: string
  /** Another unit follows in a cascade, so the commit ADVANCES rather than
   *  finishes — Next rather than Submit. The walk is the same either way; only
   *  what happens after it differs, which is the caller's knowledge, not this
   *  component's. */
  hasNext?: boolean
  onSubmit: (stepResults: StepResult[], notes: string) => void
}) {
  const taskData = getEvaluableTaskData(taskNumber)
  const [results, setResults] = useState<Map<string, 'GO' | 'NO_GO'>>(new Map())
  const [notes, setNotes] = useState('')

  if (!taskData) {
    return <div className="px-4 py-12 text-center text-tertiary">Task data not available</div>
  }

  const gradedSet = new Set(taskData.gradedSteps ?? [])
  const gradedStepNumbers = taskData.performanceSteps
    .filter(s => gradedSet.has(s.number))
    .map(s => s.number)
  const totalSteps = gradedStepNumbers.length
  const evaluatedCount = gradedStepNumbers.filter(n => results.has(n)).length
  const allEvaluated = evaluatedCount === totalSteps

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
    // Plain flow, no height and no scroller of its own. The host's pane owns the
    // scroll — on mobile that host is a Sheet, whose card clips a nested capped
    // scroller, and on desktop a second scrollport inside the pane's would split
    // one list of measures across two drags.
    <div>
      {/* Content pads itself and the bar below does not, so the bar spans the
          full pane. Neither host pads its scroll region — the desktop pane and
          the Sheet's fit body both hand over bare edges. */}
      <div className="px-4 pt-4">
        {/* No header. The number, the title and who is being graded are the pane's
            chrome — PaneHeader on desktop, the sheet's title node on mobile — and
            restating all three an inch below them is the same three facts twice. */}

        {/* Task-level caution */}
        {taskData.caution && (
          <div className="mb-4">
            <StepCallout type="caution" text={taskData.caution} />
          </div>
        )}

        {/* Standards */}
        <div className="mb-5">
          <SectionHeader>Standards</SectionHeader>
          <p className="text-sm text-primary leading-relaxed">{taskData.standards}</p>
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
                        <span className="text-[9pt] text-tertiary font-mono w-6 shrink-0 text-right">
                          {step.number}
                        </span>
                        <p className={`text-sm flex-1 min-w-0 ${isGraded ? 'text-primary' : 'text-tertiary'}`}>{step.text}</p>
                        {isGraded && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => toggleResult(step.number, 'NO_GO')}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90
                                ${currentResult === 'NO_GO'
                                  ? 'bg-themeredred text-white'
                                  : 'bg-themewhite3 text-tertiary hover:text-themeredred hover:bg-themeredred/10'
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
                                  : 'bg-themewhite3 text-tertiary hover:text-themegreen hover:bg-themegreen/10'
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

        {/* The primitive's own row is the whole field — placeholder-is-the-label,
            iOS-zoom-safe sizing, its own hairline. A card around one row draws a
            container for a list that isn't there. */}
        <div className="mb-5">
          <TextArea
            label="Supervisor notes"
            value={notes}
            onChange={setNotes}
            rows={3}
          />
        </div>
      </div>

      {/* Advance on the FAB, and NOTHING else down here. A running count and a
          PASS/FAIL preview restated what the rows above already show one GO/NO-GO
          pair at a time, and they only ever resolved the instant the FAB appeared
          — which is the same signal, without the sentence.

          Sticky rather than absolute: this body is plain flow inside the host's
          scrollport (see the note at the top), so there is no positioned ancestor
          to hang a FAB off, and sticky keeps its space instead of covering the
          last measure. */}
      {allEvaluated && (
        <div className="sticky bottom-4 z-10 flex justify-end px-4 pb-2 pointer-events-none">
          <AddFab
            icon={hasNext ? ChevronRight : Check}
            label={hasNext ? 'Next' : 'Submit evaluation'}
            onClick={handleSubmit}
          />
        </div>
      )}
    </div>
  )
}
