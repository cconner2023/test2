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
  avatarId: string | null
  /** Profile roles array — 'medic' | 'supervisor' | 'dev' | 'provider'. Used to identify providers in clinic-scoped UIs (e.g. Huddle view). */
  roles?: string[]
  clinicId?: string
  clinicName?: string
  /** Surrogate clinic id when the medic is loaned to another clinic (their second key ring). */
  surrogateClinicId?: string | null
  /** True when the medic's assigned clinic is outside the caller's reach but their surrogate matches one of the caller's clinics. */
  isLoanedIn?: boolean
}
