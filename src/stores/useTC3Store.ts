/**
 * Zustand store for TC3 Card (DD Form 1380) state management.
 *
 * Manages the active TC3 casualty card: form data across all sections,
 * selected section for navigation, and CRUD operations for list items
 * (injuries, tourniquets, medications, vitals, IV access).
 */

import { create } from 'zustand'
import type {
  TC3Card,
  TC3Section,
  TC3Injury,
  TC3Tourniquet,
  TC3Hemostatic,
  TC3IVAccess,
  TC3Medication,
  TC3VitalSet,
  TC3InjuryTreatmentLink,
  MechanismType,
  AVPU,
  EvacPriority,
  NeedleDecompSide,
} from '../Types/TC3Types'
import { getBodyRegion } from '../Utilities/bodyRegionMap'

function createEmptyCard(): TC3Card {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    casualty: {
      battleRosterNo: '',
      lastName: '',
      firstName: '',
      last4: '',
      unit: '',
      dateTimeOfInjury: '',
      dateTimeOfTreatment: '',
    },
    mechanism: {
      types: [],
      otherDescription: '',
    },
    injuries: [],
    march: {
      massiveHemorrhage: {
        tourniquets: [],
        hemostatics: [],
      },
      airway: {
        intact: false,
        npa: false,
        cric: false,
        ett: false,
        supraglottic: false,
        chinLift: false,
      },
      respiration: {
        needleDecomp: { performed: false, side: 'none' },
        chestSeal: { applied: false, side: 'none' },
        o2: false,
        o2Method: '',
      },
      circulation: {
        ivAccess: [],
        fluids: [],
        bloodProducts: [],
      },
      hypothermia: {
        prevention: false,
        method: '',
      },
    },
    medications: [],
    vitals: [],
    avpu: '',
    gcs: null,
    evacuation: {
      priority: '',
    },
    notes: '',
  }
}

interface TC3State {
  card: TC3Card
  selectedSection: TC3Section
  wizardStep: number
}

interface TC3Actions {
  // Section navigation
  setSelectedSection: (section: TC3Section) => void

  // Wizard navigation
  nextWizardStep: () => void
  prevWizardStep: () => void
  setWizardStep: (step: number) => void

  // Card lifecycle
  resetCard: () => void

  // Casualty info
  updateCasualty: (fields: Partial<TC3Card['casualty']>) => void

  // Mechanism of injury
  toggleMechanism: (type: MechanismType) => void
  setMechanismOther: (description: string) => void

  // Injuries
  addInjury: (injury: Omit<TC3Injury, 'bodyRegion' | 'treatmentLinks'> & { bodyRegion?: TC3Injury['bodyRegion']; treatmentLinks?: TC3Injury['treatmentLinks'] }) => void
  updateInjury: (id: string, fields: Partial<TC3Injury>) => void
  removeInjury: (id: string) => void

  // Injury-treatment linking
  linkTreatmentToInjury: (injuryId: string, link: TC3InjuryTreatmentLink) => void
  unlinkTreatmentFromInjury: (injuryId: string, treatmentId: string) => void

  // MARCH — Massive Hemorrhage
  addTourniquet: (tq: TC3Tourniquet) => void
  updateTourniquet: (id: string, fields: Partial<TC3Tourniquet>) => void
  removeTourniquet: (id: string) => void
  addHemostatic: (h: TC3Hemostatic) => void
  updateHemostatic: (id: string, fields: Partial<TC3Hemostatic>) => void
  removeHemostatic: (id: string) => void

  // MARCH — Airway
  updateAirway: (fields: Partial<TC3Card['march']['airway']>) => void

  // MARCH — Respiration
  updateNeedleDecomp: (fields: { performed?: boolean; side?: NeedleDecompSide }) => void
  updateChestSeal: (fields: { applied?: boolean; side?: NeedleDecompSide }) => void
  updateRespirationO2: (o2: boolean, method?: string) => void

  // MARCH — Circulation
  addIVAccess: (iv: TC3IVAccess) => void
  removeIVAccess: (id: string) => void
  addFluid: (fluid: { type: string; volume: string }) => void
  removeFluid: (index: number) => void
  addBloodProduct: (product: { type: string; volume: string }) => void
  removeBloodProduct: (index: number) => void

  // MARCH — Hypothermia
  updateHypothermia: (fields: Partial<TC3Card['march']['hypothermia']>) => void

  // Medications
  addMedication: (med: TC3Medication) => void
  updateMedication: (id: string, fields: Partial<TC3Medication>) => void
  removeMedication: (id: string) => void

  // Vitals
  addVitalSet: (vitals: TC3VitalSet) => void
  updateVitalSet: (id: string, fields: Partial<TC3VitalSet>) => void
  removeVitalSet: (id: string) => void

  // Mental Status
  setAVPU: (avpu: AVPU | '') => void
  setGCS: (gcs: TC3Card['gcs']) => void

  // Evacuation
  updateEvacuation: (fields: Partial<TC3Card['evacuation']>) => void

  // Notes
  setNotes: (notes: string) => void
}

export type TC3Store = TC3State & TC3Actions

const WIZARD_PAGE_COUNT = 8 // matches TC3_WIZARD_PAGES length

export const useTC3Store = create<TC3Store>()((set) => ({
  card: createEmptyCard(),
  selectedSection: 'casualty',
  wizardStep: 0,

  // Section navigation
  setSelectedSection: (section) => set({ selectedSection: section }),

  // Wizard navigation
  nextWizardStep: () => set((s) => ({ wizardStep: Math.min(s.wizardStep + 1, WIZARD_PAGE_COUNT - 1) })),
  prevWizardStep: () => set((s) => ({ wizardStep: Math.max(s.wizardStep - 1, 0) })),
  setWizardStep: (step) => set({ wizardStep: step }),

  // Card lifecycle
  resetCard: () => set({ card: createEmptyCard(), selectedSection: 'casualty', wizardStep: 0 }),

  // Casualty info
  updateCasualty: (fields) => set((s) => ({
    card: { ...s.card, casualty: { ...s.card.casualty, ...fields } },
  })),

  // Mechanism of injury
  toggleMechanism: (type) => set((s) => {
    const types = s.card.mechanism.types.includes(type)
      ? s.card.mechanism.types.filter(t => t !== type)
      : [...s.card.mechanism.types, type]
    return { card: { ...s.card, mechanism: { ...s.card.mechanism, types } } }
  }),
  setMechanismOther: (description) => set((s) => ({
    card: { ...s.card, mechanism: { ...s.card.mechanism, otherDescription: description } },
  })),

  // Injuries — auto-detect bodyRegion from coordinates
  addInjury: (injury) => set((s) => {
    const fullInjury: TC3Injury = {
      ...injury,
      bodyRegion: injury.bodyRegion ?? getBodyRegion(injury.x, injury.y, injury.side),
      treatmentLinks: injury.treatmentLinks ?? [],
    }
    return { card: { ...s.card, injuries: [...s.card.injuries, fullInjury] } }
  }),
  updateInjury: (id, fields) => set((s) => ({
    card: {
      ...s.card,
      injuries: s.card.injuries.map(inj => inj.id === id ? { ...inj, ...fields } : inj),
    },
  })),
  removeInjury: (id) => set((s) => {
    // Clean up treatment injuryId references pointing to this injury
    const tourniquets = s.card.march.massiveHemorrhage.tourniquets.map(tq =>
      tq.injuryId === id ? { ...tq, injuryId: undefined } : tq
    )
    const hemostatics = s.card.march.massiveHemorrhage.hemostatics.map(h =>
      h.injuryId === id ? { ...h, injuryId: undefined } : h
    )
    return {
      card: {
        ...s.card,
        injuries: s.card.injuries.filter(inj => inj.id !== id),
        march: {
          ...s.card.march,
          massiveHemorrhage: { ...s.card.march.massiveHemorrhage, tourniquets, hemostatics },
        },
      },
    }
  }),

  // Injury-treatment linking
  linkTreatmentToInjury: (injuryId, link) => set((s) => ({
    card: {
      ...s.card,
      injuries: s.card.injuries.map(inj =>
        inj.id === injuryId
          ? { ...inj, treatmentLinks: [...inj.treatmentLinks, link] }
          : inj
      ),
    },
  })),
  unlinkTreatmentFromInjury: (injuryId, treatmentId) => set((s) => ({
    card: {
      ...s.card,
      injuries: s.card.injuries.map(inj =>
        inj.id === injuryId
          ? { ...inj, treatmentLinks: inj.treatmentLinks.filter(l => l.treatmentId !== treatmentId) }
          : inj
      ),
    },
  })),

  // MARCH — Massive Hemorrhage
  addTourniquet: (tq) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        massiveHemorrhage: {
          ...s.card.march.massiveHemorrhage,
          tourniquets: [...s.card.march.massiveHemorrhage.tourniquets, tq],
        },
      },
    },
  })),
  updateTourniquet: (id, fields) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        massiveHemorrhage: {
          ...s.card.march.massiveHemorrhage,
          tourniquets: s.card.march.massiveHemorrhage.tourniquets.map(
            tq => tq.id === id ? { ...tq, ...fields } : tq,
          ),
        },
      },
    },
  })),
  removeTourniquet: (id) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        massiveHemorrhage: {
          ...s.card.march.massiveHemorrhage,
          tourniquets: s.card.march.massiveHemorrhage.tourniquets.filter(tq => tq.id !== id),
        },
      },
    },
  })),
  addHemostatic: (h) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        massiveHemorrhage: {
          ...s.card.march.massiveHemorrhage,
          hemostatics: [...s.card.march.massiveHemorrhage.hemostatics, h],
        },
      },
    },
  })),
  updateHemostatic: (id, fields) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        massiveHemorrhage: {
          ...s.card.march.massiveHemorrhage,
          hemostatics: s.card.march.massiveHemorrhage.hemostatics.map(
            h => h.id === id ? { ...h, ...fields } : h,
          ),
        },
      },
    },
  })),
  removeHemostatic: (id) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        massiveHemorrhage: {
          ...s.card.march.massiveHemorrhage,
          hemostatics: s.card.march.massiveHemorrhage.hemostatics.filter(h => h.id !== id),
        },
      },
    },
  })),

  // MARCH — Airway
  updateAirway: (fields) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        airway: { ...s.card.march.airway, ...fields },
      },
    },
  })),

  // MARCH — Respiration
  updateNeedleDecomp: (fields) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        respiration: {
          ...s.card.march.respiration,
          needleDecomp: { ...s.card.march.respiration.needleDecomp, ...fields },
        },
      },
    },
  })),
  updateChestSeal: (fields) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        respiration: {
          ...s.card.march.respiration,
          chestSeal: { ...s.card.march.respiration.chestSeal, ...fields },
        },
      },
    },
  })),
  updateRespirationO2: (o2, method) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        respiration: {
          ...s.card.march.respiration,
          o2,
          ...(method !== undefined ? { o2Method: method } : {}),
        },
      },
    },
  })),

  // MARCH — Circulation
  addIVAccess: (iv) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        circulation: {
          ...s.card.march.circulation,
          ivAccess: [...s.card.march.circulation.ivAccess, iv],
        },
      },
    },
  })),
  removeIVAccess: (id) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        circulation: {
          ...s.card.march.circulation,
          ivAccess: s.card.march.circulation.ivAccess.filter(iv => iv.id !== id),
        },
      },
    },
  })),
  addFluid: (fluid) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        circulation: {
          ...s.card.march.circulation,
          fluids: [...s.card.march.circulation.fluids, fluid],
        },
      },
    },
  })),
  removeFluid: (index) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        circulation: {
          ...s.card.march.circulation,
          fluids: s.card.march.circulation.fluids.filter((_, i) => i !== index),
        },
      },
    },
  })),
  addBloodProduct: (product) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        circulation: {
          ...s.card.march.circulation,
          bloodProducts: [...s.card.march.circulation.bloodProducts, product],
        },
      },
    },
  })),
  removeBloodProduct: (index) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        circulation: {
          ...s.card.march.circulation,
          bloodProducts: s.card.march.circulation.bloodProducts.filter((_, i) => i !== index),
        },
      },
    },
  })),

  // MARCH — Hypothermia
  updateHypothermia: (fields) => set((s) => ({
    card: {
      ...s.card,
      march: {
        ...s.card.march,
        hypothermia: { ...s.card.march.hypothermia, ...fields },
      },
    },
  })),

  // Medications
  addMedication: (med) => set((s) => ({
    card: { ...s.card, medications: [...s.card.medications, med] },
  })),
  updateMedication: (id, fields) => set((s) => ({
    card: {
      ...s.card,
      medications: s.card.medications.map(m => m.id === id ? { ...m, ...fields } : m),
    },
  })),
  removeMedication: (id) => set((s) => ({
    card: { ...s.card, medications: s.card.medications.filter(m => m.id !== id) },
  })),

  // Vitals
  addVitalSet: (vitals) => set((s) => ({
    card: { ...s.card, vitals: [...s.card.vitals, vitals] },
  })),
  updateVitalSet: (id, fields) => set((s) => ({
    card: {
      ...s.card,
      vitals: s.card.vitals.map(v => v.id === id ? { ...v, ...fields } : v),
    },
  })),
  removeVitalSet: (id) => set((s) => ({
    card: { ...s.card, vitals: s.card.vitals.filter(v => v.id !== id) },
  })),

  // Mental Status
  setAVPU: (avpu) => set((s) => ({ card: { ...s.card, avpu } })),
  setGCS: (gcs) => set((s) => ({ card: { ...s.card, gcs } })),

  // Evacuation
  updateEvacuation: (fields) => set((s) => ({
    card: { ...s.card, evacuation: { ...s.card.evacuation, ...fields } },
  })),

  // Notes
  setNotes: (notes) => set((s) => ({ card: { ...s.card, notes } })),
}))
