// Types/TC3Types.ts
// TypeScript interfaces for TC3 Card (DD Form 1380, Jul 2025) — Tactical Combat Casualty Care

export type MechanismType = 'Artillery' | 'Blunt' | 'Burn' | 'Fall' | 'Grenade' | 'GSW' | 'IED' | 'Landmine' | 'MVC' | 'RPG' | 'Other'
export type InjuryType = 'GSW' | 'blast' | 'burn' | 'laceration' | 'fracture' | 'amputation' | 'other'
export type TourniquetType = 'CAT' | 'SOFT-T' | 'other'
export type TQCategory = 'Extremity' | 'Junctional' | 'Truncal'
export type DressingType = 'Hemostatic' | 'Pressure' | 'Other'
export type MedRoute = 'IV' | 'IM' | 'IO' | 'PO' | 'IN' | 'PR' | 'topical'
export type MedCategory = 'Analgesic' | 'Antibiotic' | 'Other'
export type IVType = 'IV' | 'IO'
export type ProcedureType = 'IV' | 'IO'
export type AVPU = 'A' | 'V' | 'P' | 'U'
export type NeedleDecompSide = 'left' | 'right' | 'bilateral' | 'none'
export type EvacPriority = '' | 'Urgent' | 'Priority' | 'Routine'
export type TriagePriority = 'U' | 'P' | 'R' | 'E' | ''

export type BodyRegion =
  | 'head-front' | 'head-back'
  | 'neck-front' | 'neck-back'
  | 'chest-left' | 'chest-right' | 'abdomen' | 'genitalia'
  | 'back-upper' | 'back-lower'
  | 'upper-arm-left-front' | 'upper-arm-right-front'
  | 'upper-arm-left-back' | 'upper-arm-right-back'
  | 'forearm-left-front' | 'forearm-right-front'
  | 'forearm-left-back' | 'forearm-right-back'
  | 'hand-left-front' | 'hand-right-front'
  | 'hand-left-back' | 'hand-right-back'
  | 'upper-leg-left-front' | 'upper-leg-right-front'
  | 'upper-leg-left-back' | 'upper-leg-right-back'
  | 'lower-leg-left-front' | 'lower-leg-right-front'
  | 'lower-leg-left-back' | 'lower-leg-right-back'
  | 'foot-left-front' | 'foot-right-front'
  | 'foot-left-back' | 'foot-right-back'

export type TreatmentCategory = 'tourniquet' | 'hemostatic' | 'chestSeal' | 'needleDecomp' | 'other'

export interface TC3InjuryTreatmentLink {
  treatmentCategory: TreatmentCategory
  treatmentId: string
  description: string
}

export interface TC3Injury {
  id: string
  x: number        // % position on combined body diagram (1040×909 viewBox)
  y: number
  type: InjuryType
  description: string
  bodyRegion: BodyRegion | ''
  treatmentLinks: TC3InjuryTreatmentLink[]
}

export interface TC3Tourniquet {
  id: string
  location: string
  time: string      // time applied
  type: TourniquetType
  tqCategory: TQCategory
  injuryId?: string
}

export interface TC3Hemostatic {
  id: string
  applied: boolean
  type: string
  location: string
  dressingType: DressingType
  injuryId?: string
}

export interface TC3IVAccess {
  id: string
  type: IVType
  site: string
  gauge: string
  time: string      // time established (HH:MM)
}

export interface TC3Procedure {
  id: string
  x: number          // % position on body diagram
  y: number
  bodyRegion: BodyRegion | ''
  type: ProcedureType // 'IV' | 'IO'
  gauge: string       // e.g. '18g'
  time: string        // time established (HH:MM)
}

/** Unified body diagram marker — consolidates injuries, treatments, and IV/IO procedures */
export interface TC3Marker {
  id: string
  x: number               // % position on body diagram
  y: number
  bodyRegion: BodyRegion | ''

  // Multi-select from checklist
  injuries: InjuryType[]
  treatments: TreatmentCategory[]
  procedures: ProcedureType[]

  // Conditional detail fields
  gauge: string            // IV/IO gauge (e.g. '18g')
  tqType: TourniquetType
  tqCategory: TQCategory
  dressingType: DressingType

  // Triage + datetime
  priority: TriagePriority
  dateTime: string         // ISO "YYYY-MM-DDTHH:MM", auto-populated from current

  // Free text (custom text via onAdd)
  description: string
}

export interface TC3Medication {
  id: string
  name: string
  dose: string
  route: MedRoute
  time: string
  category: MedCategory
}

export interface TC3VitalSet {
  id: string
  time: string
  pulse: string
  pulseLocation: string
  bp: string
  rr: string
  spo2: string
  avpu: AVPU
  painScale: string
}

export interface TC3Card {
  id: string
  createdAt: string

  // Section 1: Casualty Info
  casualty: {
    battleRosterNo: string
    lastName: string
    firstName: string
    last4: string       // last 4 of SSN/DoD ID
    unit: string
    sex: 'M' | 'F' | ''
    service: string
    allergies: string
    dateTimeOfInjury: string
    dateTimeOfTreatment: string
  }

  // Section 2: Mechanism of Injury
  mechanism: {
    types: MechanismType[]
    otherDescription: string
  }

  // Section 3: Unified body diagram markers (injuries + treatments + procedures)
  markers: TC3Marker[]

  // Legacy arrays — kept for codec backward compatibility, empty for new cards
  injuries: TC3Injury[]
  procedures: TC3Procedure[]

  // Section 4: Treatments (MARCH)
  march: {
    massiveHemorrhage: {
      tourniquets: TC3Tourniquet[]
      hemostatics: TC3Hemostatic[]
    }
    airway: {
      intact: boolean
      npa: boolean
      cric: boolean
      ett: boolean
      supraglottic: boolean
      chinLift: boolean
      airwayType: string
    }
    respiration: {
      needleDecomp: { performed: boolean; side: NeedleDecompSide }
      chestSeal: { applied: boolean; side: NeedleDecompSide }
      chestTube: boolean
      o2: boolean
      o2Method: string
    }
    circulation: {
      ivAccess: TC3IVAccess[]
      fluids: { type: string; volume: string; route: MedRoute; time: string }[]
      bloodProducts: { type: string; volume: string; route: MedRoute; time: string }[]
    }
  }

  // Section 5: Medications Administered
  medications: TC3Medication[]

  // Section 6: Vital Signs (time-series)
  vitals: TC3VitalSet[]

  // Section 7: Mental Status
  avpu: AVPU | ''
  gcs: { eye: number; verbal: number; motor: number } | null

  // Section 8: Evacuation
  evacuation: {
    priority: EvacPriority
  }

  // OTHER section (DD 1380)
  other: {
    combatPillPack: boolean
    eyeShield: { applied: boolean; side: 'R' | 'L' | 'both' | '' }
    splint: boolean
    hypothermiaPrevention: { applied: boolean; type: string }
  }

  // First Responder
  firstResponder: {
    lastName: string
    firstName: string
    last4: string
  }

  // Free-text notes
  notes: string
}

/** TC3 card section identifiers for navigation */
export type TC3Section =
  | 'casualty'
  | 'mechanism'
  | 'injuries'
  | 'treatments'
  | 'medications'
  | 'vitals'
  | 'evacuation'

export const TC3_SECTIONS: { id: TC3Section; label: string; icon: string }[] = [
  { id: 'casualty', label: 'Casualty Info', icon: 'user' },
  { id: 'mechanism', label: 'Mechanism of Injury', icon: 'zap' },
  { id: 'injuries', label: 'Injuries', icon: 'target' },
  { id: 'treatments', label: 'Treatments', icon: 'activity' },
  { id: 'medications', label: 'Medications', icon: 'pill' },
  { id: 'vitals', label: 'Vital Signs', icon: 'heart-pulse' },
  { id: 'evacuation', label: 'Evacuation', icon: 'truck' },
]

/** Mobile wizard page order */
export const TC3_WIZARD_PAGES: { id: string; label: string }[] = [
  { id: 'front', label: 'TC3 Card (Front)' },
  { id: 'back', label: 'TC3 Card (Back)' },
]
