import { SelectTaskStep } from './SelectTaskStep'
import { EvaluationStep } from './EvaluationStep'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { StepResult } from '../../../Types/SupervisorTestTypes'

interface EvaluateFlowProps {
  soldier: ClinicMedic
  /** When set, we're in GO/NO GO evaluation mode for this specific task */
  taskNumber: string | null
  taskTitle: string | null
  searchQuery?: string
  onSelectTask: (taskNumber: string, taskTitle: string) => void
  onSubmit: (stepResults: StepResult[], notes: string) => void
}

export function EvaluateFlow({
  soldier,
  taskNumber,
  taskTitle,
  searchQuery,
  onSelectTask,
  onSubmit,
}: EvaluateFlowProps) {
  const medicName = formatMedicName(soldier)

  if (taskNumber && taskTitle) {
    return (
      <EvaluationStep
        taskNumber={taskNumber}
        taskTitle={taskTitle}
        medicName={medicName}
        onSubmit={onSubmit}
      />
    )
  }

  return (
    <SelectTaskStep
      onSelectTask={onSelectTask}
      medicName={medicName}
      searchQuery={searchQuery}
    />
  )
}
