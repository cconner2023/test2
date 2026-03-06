// Types/TC3Types.ts
// TypeScript interfaces for TC3 Card (DD Form 1380) — Tactical Combat Casualty Care

export type MechanismType = 'blast' | 'gunshot' | 'vehicle' | 'fall' | 'burn' | 'other'
export type InjuryType = 'GSW' | 'blast' | 'burn' | 'laceration' | 'fracture' | 'amputation' | 'other'
export type TourniquetType = 'CAT' | 'SOFT-T' | 'other'
export type MedRoute = 'IV' | 'IM' | 'IO' | 'PO' | 'IN' | 'PR' | 'topical'
export type IVType = 'IV' | 'IO'
export type AVPU = 'A' | 'V' | 'P' | 'U'
export type BodySide = 'front' | 'back'
export type NeedleDecompSide = 'left' | 'right' | 'bilateral' | 'none'
export type EvacPriority = '' | 'Urgent' | 'Urgent-Surgical' | 'Priority' | 'Routine' | 'Convenience'

export type BodyRegion =
  | 'head' | 'neck'
  | 'chest-left' | 'chest-right' | 'abdomen'
  | 'upper-arm-left' | 'upper-arm-right'
  | 'forearm-left' | 'forearm-right'
  | 'hand-left' | 'hand-right'
  | 'upper-leg-left' | 'upper-leg-right'
  | 'lower-leg-left' | 'lower-leg-right'
  | 'foot-left' | 'foot-right'
  | 'back-upper' | 'back-lower'

export type TreatmentCategory = 'tourniquet' | 'hemostatic' | 'chestSeal' | 'needleDecomp' | 'other'

export interface TC3InjuryTreatmentLink {
  treatmentCategory: TreatmentCategory
  treatmentId: string
  description: string
}

export interface TC3Injury {
  id: string
  x: number        // % position on body diagram
  y: number
  side: BodySide
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
  injuryId?: string
}

export interface TC3Hemostatic {
  id: string
  applied: boolean
  type: string
  location: string
  injuryId?: string
}

export interface TC3IVAccess {
  id: string
  type: IVType
  site: string
  gauge: string
}

export interface TC3Medication {
  id: string
  name: string
  dose: string
  route: MedRoute
  time: string
}

export interface TC3VitalSet {
  id: string
  time: string
  pulse: string
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
    dateTimeOfInjury: string
    dateTimeOfTreatment: string
  }

  // Section 2: Mechanism of Injury
  mechanism: {
    types: MechanismType[]
    otherDescription: string
  }

  // Section 3: Injury Locations (body diagram markers)
  injuries: TC3Injury[]

  // Section 4: MARCH Protocol
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
    }
    respiration: {
      needleDecomp: { performed: boolean; side: NeedleDecompSide }
      chestSeal: { applied: boolean; side: NeedleDecompSide }
      o2: boolean
      o2Method: string
    }
    circulation: {
      ivAccess: TC3IVAccess[]
      fluids: { type: string; volume: string }[]
      bloodProducts: { type: string; volume: string }[]
    }
    hypothermia: {
      prevention: boolean
      method: string // blanket, HPMK, etc.
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

  // Free-text notes
  notes: string
}

/** TC3 card section identifiers for navigation */
export type TC3Section =
  | 'casualty'
  | 'mechanism'
  | 'injuries'
  | 'march'
  | 'medications'
  | 'vitals'
  | 'evacuation'

export const TC3_SECTIONS: { id: TC3Section; label: string; icon: string }[] = [
  { id: 'casualty', label: 'Casualty Info', icon: 'user' },
  { id: 'mechanism', label: 'Mechanism of Injury', icon: 'zap' },
  { id: 'injuries', label: 'Injuries', icon: 'target' },
  { id: 'march', label: 'MARCH Protocol', icon: 'activity' },
  { id: 'medications', label: 'Medications', icon: 'pill' },
  { id: 'vitals', label: 'Vital Signs', icon: 'heart-pulse' },
  { id: 'evacuation', label: 'Evacuation', icon: 'truck' },
]

/** Mobile wizard page order */
export const TC3_WIZARD_PAGES: { id: string; label: string }[] = [
  { id: 'casualty', label: 'Casualty Info' },
  { id: 'mechanism', label: 'Mechanism of Injury' },
  { id: 'injuries', label: 'Injuries' },
  { id: 'vitals', label: 'Signs & Symptoms' },
  { id: 'march', label: 'Treatments' },
  { id: 'medications', label: 'Medications' },
  { id: 'evacuation', label: 'Evacuation' },
]
