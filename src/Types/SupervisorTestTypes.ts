export interface StepResult {
  stepNumber: string       // matches PerformanceStep.number
  result: 'GO' | 'NO_GO' | null
}

export interface SupervisorTestRecord {
  id: string               // crypto.randomUUID()
  supervisorId: string
  supervisorName: string   // denormalized for offline display
  medicId: string
  medicName: string        // denormalized for offline display
  taskNumber: string
  taskTitle: string
  stepResults: StepResult[]
  overallResult: 'PASS' | 'FAIL'  // PASS = all GO, FAIL = any NO_GO
  testDate: string         // ISO 8601
  notes?: string           // optional supervisor comments
}

export interface ClinicMedic {
  id: string
  firstName: string | null
  lastName: string | null
  middleInitial: string | null
  rank: string | null
  credential: string | null
}
