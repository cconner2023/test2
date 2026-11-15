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

/** A user's custom profile photo, ~160px JPEG. Two shapes:
 *  - R2 ref {store:'r2', k, ak, mime}: bytes at R2 p/<k> encrypted with the per-object
 *    key `ak`; profiles.avatar_ref. Current write path.
 *  - legacy inline {enc, mime}: base64(IV + ciphertext) under the app-wide barcode key on
 *    profiles.avatar_blob. Read-only; the owner's next sign-in re-uploads it to R2.
 *  Readers coalesce avatar_ref ?? avatar_blob into this one field. Not PHI. */
export type AvatarBlob =
  | { store: 'r2'; k: string; ak: string; mime: string }
  | { store?: undefined; enc: string; mime: string }

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
  /** Intra-clinic sub-cluster (platoon/squad). null/undefined = HQ bucket. Render-only grouping. */
  subClusterId?: string | null
  /** True when the medic's assigned clinic is outside the caller's reach but their surrogate matches one of the caller's clinics. */
  isLoanedIn?: boolean
  /** Set ONLY on the synthetic peer for an outbound outside-contact (email) channel.
   *  Holds the cluster name the outside recipient sees as the sender. Its presence
   *  marks this peer as an outside-entity channel; the conversation header (list
   *  row stays the recipient email) uses it, and it renders via
   *  OutsideEntityConversation rather than the standard 1:1 ChatDetail. */
  outsideFromLabel?: string | null
}
