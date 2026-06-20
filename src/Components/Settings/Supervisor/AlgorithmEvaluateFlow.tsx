import { useMemo, useState } from 'react'
import { EvaluationStep } from './EvaluationStep'
import { formatMedicName } from './supervisorHelpers'
import { listAlgorithmEvalUnits } from '../../../Utilities/algorithmCompetency'
import type { ClinicMedic, StepResult } from '../../../Types/SupervisorTestTypes'

interface AlgorithmEvaluateFlowProps {
  soldier: ClinicMedic
  algorithmId: string
  algorithmName: string
  /**
   * Persist one unit's evaluation. Called once per unit as the supervisor
   * advances — STP units write real STP completions (the cascade), synthetic
   * units write `algo:<id>:<dim>` completions.
   */
  onSubmitUnit: (trainingItemId: string, stepResults: StepResult[], notes: string) => Promise<void> | void
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
  soldier,
  algorithmId,
  algorithmName,
  onSubmitUnit,
  onComplete,
}: AlgorithmEvaluateFlowProps) {
  const units = useMemo(() => listAlgorithmEvalUnits(algorithmId), [algorithmId])
  const [index, setIndex] = useState(0)
  const medicName = formatMedicName(soldier)

  if (units.length === 0) {
    return (
      <div className="text-center py-12 text-tertiary">
        No evaluable components for {algorithmId}.
      </div>
    )
  }

  const unit = units[index]

  const handleUnitSubmit = async (stepResults: StepResult[], notes: string) => {
    await onSubmitUnit(unit.trainingItemId, stepResults, notes)
    if (index + 1 < units.length) {
      setIndex(index + 1)
    } else {
      onComplete()
    }
  }

  return (
    <>
      {/* Cascade progress — which component of the algorithm we're grading */}
      <div className="px-1 pb-3 mb-2 border-b border-tertiary/10">
        <p className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary truncate">
          {algorithmId} · {algorithmName}
        </p>
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
        taskTitle={unit.title}
        medicName={medicName}
        onSubmit={handleUnitSubmit}
      />
    </>
  )
}
