import { useMemo, useState } from 'react'
import { EvaluationStep } from './EvaluationStep'
import { listAlgorithmEvalUnits } from '../../../Utilities/algorithmCompetency'
import type { StepResult } from '../../../Types/SupervisorTestTypes'
import { ListGroupLabel } from '@/Components/primitives/Section'

/** No soldier and no algorithm NAME: the pane's header carries both, and this
 *  flow only needs the id to resolve its units. Taking them as props invited a
 *  second rendering of the same two facts. */
interface AlgorithmEvaluateFlowProps {
  algorithmId: string
  /**
   * Persist one unit's evaluation. Called once per unit as the supervisor
   * advances — STP units write real STP completions (the cascade), synthetic
   * units write `algo:<id>:<dim>` completions.
   *
   * Returns whether the unit was recorded. False HOLDS the walk on that unit
   * with its GO/NO_GOs intact: advancing past a refused write would carry the
   * supervisor to the end of a cascade that persisted nothing.
   */
  onSubmitUnit: (trainingItemId: string, stepResults: StepResult[], notes: string) => Promise<boolean>
  /** All units graded — refresh and leave the flow. */
  onComplete: () => void
}

/**
 * Evaluate a whole algorithm by walking its evaluable units in sequence
 * (red flags → differentials → run → each mapped STP), reusing the existing
 * single-task EvaluationStep for each. Each unit is persisted as it's submitted,
 * so grading the algorithm cascades into the underlying STP records.
 */
export function AlgorithmEvaluateFlow({
  algorithmId,
  onSubmitUnit,
  onComplete,
}: AlgorithmEvaluateFlowProps) {
  const units = useMemo(() => listAlgorithmEvalUnits(algorithmId), [algorithmId])
  const [index, setIndex] = useState(0)

  if (units.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-tertiary">
        No evaluable components for {algorithmId}.
      </div>
    )
  }

  const unit = units[index]

  const handleUnitSubmit = async (stepResults: StepResult[], notes: string) => {
    const recorded = await onSubmitUnit(unit.trainingItemId, stepResults, notes)
    if (!recorded) return
    if (index + 1 < units.length) {
      setIndex(index + 1)
    } else {
      onComplete()
    }
  }

  return (
    <>
      {/* Cascade progress. Names the UNIT, not the algorithm: the pane's header
          already carries the algorithm and the soldier, while the unit changes
          under it and is named nowhere else. Padded to match EvaluationStep's
          content below it — the host pane hands over bare edges. */}
      <div className="px-4 pt-4 pb-3 border-b border-tertiary/10">
        <ListGroupLabel inset={false}>{unit.title}</ListGroupLabel>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-themeblue3 transition-all"
              style={{ width: `${(index / units.length) * 100}%` }}
            />
          </div>
          <span className="text-[9pt] text-tertiary shrink-0 w-10 text-right">
            {index + 1}/{units.length}
          </span>
        </div>
      </div>

      <EvaluationStep
        key={unit.trainingItemId}
        taskNumber={unit.trainingItemId}
        hasNext={index + 1 < units.length}
        onSubmit={handleUnitSubmit}
      />
    </>
  )
}
