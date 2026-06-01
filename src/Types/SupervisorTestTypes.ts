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

/** A user's custom voicemail greeting. `enc` is base64(IV + AES-GCM ciphertext)
 *  of the audio blob, encrypted with the app-wide barcode key (getBarcodeKey)
 *  so any authenticated caller can decrypt it. Operational audio only — no PHI. */
export interface VoicemailGreeting {
  enc: string
  mime: string
  dur: number
}

/** A user's custom profile photo. `enc` is base64(IV + AES-GCM ciphertext) of the
 *  (already downscaled, ~160px JPEG) image bytes, encrypted with the app-wide
 *  barcode key (getBarcodeKey) so any authenticated viewer can decrypt it.
 *  Mirrors VoicemailGreeting; rides the same profiles row / fetch_profiles_by_ids
 *  resolution path. Not PHI. Inline today — the seam for a future S3/storage move. */
export interface AvatarBlob {
  enc: string
  mime: string
}

export interface ClinicMedic {
  id: string
  firstName: string | null
  lastName: string | null
  middleInitial: string | null
  rank: string | null
  credential: string | null
  avatarId: string | null
  /** Encrypted custom profile photo when avatarId === 'custom'. Resolved via
   *  useResolvedAvatar / avatarBlobService. Absent on light roster shapes. */
  avatarBlob?: AvatarBlob | null
  voicemailGreeting?: VoicemailGreeting | null
  /** Profile roles array — 'medic' | 'supervisor' | 'dev' | 'provider'. Used to identify providers in clinic-scoped UIs (e.g. Huddle view). */
  roles?: string[]
  clinicId?: string
  clinicName?: string
  /** Surrogate clinic id when the medic is loaned to another clinic (their second key ring). */
  surrogateClinicId?: string | null
  /** True when the medic's assigned clinic is outside the caller's reach but their surrogate matches one of the caller's clinics. */
  isLoanedIn?: boolean
}
