/**
 * TCCC training modules — self-contained Tactical Combat Casualty Care teaching units
 * (the "why" + the how-to steps + the module's check-on-learning). PROMOTED out of
 * ICTLContent.ts (was `IctlSkillSheet`): a TCCC module is now a first-class, independently
 * browsable/gradable artifact, NOT an appendage of one ICTL task.
 *
 * CONTAINMENT MODEL (TCCC ⊂ ICTL): an ICTL task references a TCCC module (or one of its
 * sections) via `tcccModuleRef`. Grading a TCCC module is a PARTIAL component of the ICTL's
 * grade; grading the full ICTL rolls up the complete TCCC component plus the ICTL's own
 * additional steps. A module may cover MORE than any one task needs (Module 17 = general +
 * open-abdominal + impaled-object + amputation; task 081-000-0127 references only two), so
 * steps live in named `sections` and a ref addresses one with `<key>#<section>`.
 *
 * ⚠️ PROVENANCE / FIDELITY. A module may be transcribed from the TCCC didactic (speaker notes +
 * slide checklists) rather than a JTS assessment checklist — a weaker fidelity class. Every
 * module carries `source` (the exact document) and sets `derived: true` when its steps were
 * synthesized from teaching prose. Derived content must NEVER migrate up into an ICTL task
 * packet's verbatim-from-MEDCoE fields.
 */

/** One step of a TCCC module section. Shape-compatible with PerformanceStepItem. */
export interface TcccStep {
  number: string
  text: string
  isSubStep?: boolean
  note?: string
  warning?: string
  caution?: string
}

/** One branch of a TCCC module — the unit an ICTL performance step references. */
export interface TcccSection {
  /** Stable key used in a `<module>#<section>` ref, e.g. "open-abdominal". */
  key: string
  /** Display title, e.g. "Open Abdominal Wound". */
  title: string
  steps: TcccStep[]
}

/**
 * Module teaching content — the "why" behind the steps. Lives on the MODULE (shared by every
 * ICTL task that references it), which is what keeps ICTL task packets verbatim.
 */
export interface TcccDidactic {
  /** Why this wound pattern kills — e.g. the four open-abdominal complications. */
  complications?: string[]
  /** Judgment calls and emphases the step list can't carry. */
  keyPoints?: string[]
  /** The module's check-on-learning questions. */
  checkOnLearning?: { q: string; a: string }[]
}

/** A self-contained TCCC training module. */
export interface TcccModule {
  /** Stable key used by IctlPerformanceStep.tcccModuleRef / IctlTaskData.tcccModuleRef. */
  key: string
  /** Display name, e.g. "JTS Wound Management Skill Sheet". */
  name: string
  /** TCCC module or source label, e.g. "TCCC Module 17: Wound Management". */
  module?: string
  /** True until the module's source is transcribed into `sections`. */
  pending: boolean
  /** Branch-scoped steps drawn from the source (empty while pending). */
  sections: TcccSection[]
  /** The exact document the steps came from — see the PROVENANCE note above. */
  source?: string
  /** True when steps were synthesized from didactic prose, not an assessment checklist. */
  derived?: boolean
  /** Module teaching content shared by every task referencing this module. */
  didactic?: TcccDidactic
}

/**
 * The TCCC training modules. Authored once from each module's source; a `pending` entry is
 * still awaiting that source, so any ICTL step referencing it shows the rolled-up measure only.
 */
export const tcccModules: TcccModule[] = [
  {
    key: 'jts-wound-management',
    name: 'JTS Wound Management Skill Sheet',
    module: 'TCCC Module 17: Wound Management',
    pending: false,
    // Transcribed from the CMC didactic module, NOT from a JTS assessment checklist — the
    // narrative is the speaker-note script and the numbered steps are lifted from the slide
    // MANAGEMENT STEPS graphics. See the PROVENANCE note at the top of this file.
    source: 'TCCC Combat Medic/Corpsman Speaker Notes #TCCC-CMC-17-02, 30 MAY 26 — Module 17: Wound Management',
    derived: true,
    sections: [
      {
        key: 'general',
        title: 'General Wound Management',
        steps: [
          {
            number: '1',
            text: 'Reassess previously addressed wounds before treating any new non-life-threatening wound. Recheck tourniquets for hemorrhage control and absent distal pulses; recheck packings, pressure dressings, and junctional tourniquets for ongoing bleeding.',
            warning: 'NEVER apply an intervention and then forget it. Reassessment is continuous, not a single step in the sequence.',
          },
          {
            number: '2',
            text: 'If bleeding has recurred or persisted: retighten or add a tourniquet, add or replace packing and pressure dressings, shield any unshielded eye injury, and address any open chest wound that is not properly sealed.',
            note: 'A repeated intervention follows the same process as a newly found life-threatening wound — e.g. repacking still requires a full 3 minutes of pressure before checking hemorrhage control.',
          },
          {
            number: '3',
            text: 'Only after confirming no life-threatening wound has been missed, address minor wounds such as lacerations and abrasions. Apply direct pressure as needed to stop minor bleeding.',
            caution: 'Hemostatic dressings and pressure bandages are NOT normally indicated for minor bleeding — conserve them for serious hemorrhage.',
          },
          {
            number: '4',
            text: 'Irrigate and clean the wound with sterile water, or clean water if supplies are limited. Remove obvious foreign debris. Irrigation should be thorough but not excessive.',
            note: 'The goal is to clean the wound, not to sterilize it.',
          },
          {
            number: '5',
            text: 'Dress the wound with sterile dressings and/or gauze secured with bandages or tape. If supplies must be conserved, clean dry cloth tied in place or secured with tape is acceptable.',
          },
          {
            number: '6',
            text: 'Administer early antibiotics — all open wounds warrant them. If the casualty is conscious and able to swallow, have them take the oral antibiotic from their Combat Wound Medication Pack. If they cannot take oral medications, are unconscious, or are in shock, administer parenteral antibiotics.',
            note: 'Oral: cefadroxil preferred, cephalexin alternative, moxifloxacin legacy depending on supply. Parenteral: ceftriaxone preferred, replacing ertapenem during this transition.',
          },
        ],
      },
      {
        key: 'open-abdominal',
        title: 'Open Abdominal Wound',
        steps: [
          { number: '1', text: 'Place the casualty in the supine position, with knees flexed.' },
          { number: '2', text: 'Expose the wound, inspecting for DCAP-BLS and TIC-P.' },
          { number: '3', text: 'Rinse the wound with clean and warm (if possible) fluid to reduce gross contamination.' },
          { number: '4', text: 'Apply a CoTCCC-recommended hemostatic dressing or hemostatic agent to any uncontrolled bleeding.' },
          {
            number: '5',
            text: 'Consider a single brief attempt (under 60 seconds) to reduce or replace eviscerated abdominal contents.',
            caution: 'DO NOT attempt if there is evidence of ruptured bowel (gastric/intestinal fluid or stool leakage) or active bleeding. DO NOT FORCE contents into the abdomen, do not reduce actively bleeding viscera, and do not remove foreign objects.',
            note: 'If the casualty presents late, a single reduction attempt is still appropriate but the odds of success are lower. If evacuation to surgical care is uncertain, you may decide not to attempt reduction at all.',
          },
          {
            number: '6',
            text: 'If the reduction attempt is successful, re-approximate the skin — preferably with an adhesive dressing (chest seal), or with staples, sutures, or a wound closure device.',
          },
          { number: '7', text: 'Stabilize any protruding objects.' },
          {
            number: '8',
            text: 'Cover exposed bowel with moist, sterile abdominal dressings and keep them wet.',
            caution: 'Protruding organs must be kept moist. Cover the entire mass of protruding organs or the area of the wound. Using the sterile side of the dressing or other clean damp material, gather or keep protruding organs near the wound and cover it. Do NOT place exposed organs with bare hands. If using a dressing with tabs, tie them loosely and NOT directly over the wound.',
          },
          {
            number: '9',
            text: 'Cover the dressed, eviscerated organs with water-impermeable non-adhesive material — preferably transparent, such as a plastic wrapper, IV bag, or clear food wrap.',
            warning: 'DO NOT apply pressure on the wound or further expose internal organs.',
          },
          {
            number: '10',
            text: 'Secure the impermeable dressing to the patient using an adhesive bandage such as medical tape or a chest seal.',
            note: 'If an adhesive bandage is not available, loosely cover the dressing with cravats and tie them on the side of the casualty opposite the dressing ties. Use multiple dressings and cravats for a large wound, ensuring the tails are not tied over each other.',
          },
          {
            number: '11',
            text: 'Assess and treat the casualty for shock, and continue to reassess periodically.',
            warning: 'Shock is the most important concern in the initial management of abdominal injuries. It may be present initially or may develop later.',
          },
          { number: '12', text: 'Prevent hypothermia — exposed abdominal contents result in more rapid heat loss.' },
          { number: '13', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'impaled-object',
        title: 'Impaled Object',
        steps: [
          {
            number: '1',
            text: 'Expose the object by cutting the clothing around the site free. If material is pinned in by the object, cut the rest of the clothing free around it.',
            warning: 'DO NOT remove an impaled object. It may be tamponading internal bleeding, and internal structures at its base may be damaged on removal. Leave it in place and evacuate to a facility able to manage impalements.',
          },
          {
            number: '2',
            text: 'Control bleeding with direct pressure at the base of the object; apply hemostatic dressings and pressure bandages if applicable. Consider a tourniquet early if bleeding persists and good direct pressure cannot be maintained.',
            note: 'If the impalement is on an extremity, check the distal pulse to determine whether vascular compromise is probable — this informs treatment after evacuation.',
          },
          {
            number: '3',
            text: 'Stabilize the object, ideally with an assistant: one person holds the object in position while the other works around its base.',
          },
          {
            number: '4',
            text: 'Build up bulky materials around the object, starting at the wound edges, until the base is appropriate for the length of the object. Use gauze, kerlix, pads, dressings, or clean dry cloth and flexible padding.',
            caution: 'Do not exert pressure on the tissues around the object while building the base, except as needed to control bleeding — particularly for an object impaled in the eye.',
          },
          {
            number: '5',
            text: 'Secure the base materials against the object with adhesive seals such as tape, or with cloth strips, cravats, or bandages tied in place.',
          },
          {
            number: '6',
            text: 'Splint if indicated. For an extremity impalement, treat it like a fracture and stabilize the joints above and below the object, then reassess distal pulses.',
            note: 'Reassess to confirm bleeding is controlled, the casualty is not in shock, and the object is secured. Do NOT shorten the object for convenience of transport — only if it would otherwise prevent evacuation, and then with extreme caution to prevent movement of the impaled portion.',
          },
        ],
      },
      {
        key: 'amputation',
        title: 'Amputation',
        steps: [
          {
            number: '1',
            text: 'Confirm bleeding is controlled at the tourniquet, not by direct pressure at the stump. Resolve any persistent bleeding by further tightening the tourniquet or applying a second tourniquet proximal to the first.',
            warning: 'Hemorrhage must be controlled BEFORE dressing an amputation wound.',
          },
          {
            number: '2',
            text: 'Wrap the open areas with sterile gauze or clean, dry cloth. An irregular amputation may take a significant amount of dressing.',
            caution: 'Exercise caution — protruding sharp bones may injure responders.',
          },
          {
            number: '3',
            text: 'Secure the dressing with bandages or cravats, extending up 4 inches proximal to the edges of the stump.',
            caution: 'Do NOT cover the tourniquets — they may need to be accessed quickly.',
          },
          { number: '4', text: 'Wrap the amputated body part loosely with moistened gauze.' },
          { number: '5', text: 'Place the wrapped part in a plastic bag; if none is available, wrap it with cravats to cover all of the gauze.' },
          {
            number: '6',
            text: 'Transport the bagged or cravat-covered part in a container with ice, preferably with the casualty, and maintain cooling throughout transport.',
            caution: 'Do NOT place the body part directly on ice or submerse it in water. Do NOT delay evacuation to locate or care for an amputated body part.',
            note: 'The body part should accompany the casualty for potential reimplantation or use for skin grafting.',
          },
        ],
      },
    ],
    didactic: {
      complications: [
        'Increased risk of hypothermia — insensible heat losses from the evaporative process from the open abdomen.',
        'Fluid loss — dehydration from the evaporative processes.',
        'Internal hemorrhage — a significant volume of pooled blood or ongoing hemorrhage may not be visible at the surface.',
        'Infection — both from the nature of the injury and from potential bowel perforation.',
      ],
      keyPoints: [
        'Shock is the most important concern in the initial management of abdominal injuries. It may be present initially or may develop later, so reassess continuously.',
        'Oral antibiotics may be given as long as the casualty is conscious, able to swallow, and not in shock — gastrointestinal absorption has not been compromised.',
        'If the casualty presents late, a single reduction attempt is still appropriate, but the odds of success are lower.',
        'If potential evacuation to surgical care is uncertain, you may decide not to attempt a reduction.',
        'Closed abdominal injury from blast exposure may be as frequent as pulmonary blast injury. It presents as unexplained nausea, vomiting, and/or abdominal pain, with complications including ruptured bowel, internal bleeding, and solid organ damage. Nothing in the field diagnoses or manages it — but communicating the possibility to the receiving medical team may save the casualty.',
        'If the casualty returns to the fight rather than being evacuated, you must address debridement, tetanus boosters, and antibiotic changes yourself over the following days at reassessment.',
      ],
      checkOnLearning: [
        {
          q: 'After applying pressure to stop bleeding, if necessary, what is the next step in treating a minor wound?',
          a: 'Irrigate and clean the wound with sterile water if available, or clean water if supplies are limited or sterile water is unavailable.',
        },
        {
          q: 'Name three of the four complications of open abdominal wounds.',
          a: 'Increased risk of hypothermia from insensible evaporative heat loss; fluid loss and dehydration from evaporation; internal hemorrhage that may not be visible at the surface; and infection from the injury itself and from potential bowel perforation.',
        },
        {
          q: 'If an impaled object is on an extremity, what do you need to do in addition to stabilizing the object?',
          a: 'Treat it like a fracture — stabilize the joints above and below the location of the object with splints, then reassess distal pulses.',
        },
        {
          q: 'How do you care for an amputated body part?',
          a: 'Wrap it loosely with moistened gauze. Place it in a plastic bag; if none is available, wrap it with cravats to cover all of the gauze. Then place the bag or cravat-covered part in a container with ice, if available.',
        },
      ],
    },
  },
  {
    // Referenced by 081-000-1025 (Administer Blood Products) steps 2–4. Source skill sheet not
    // yet transcribed — pending, so referencing steps show the rolled-up measure + "coming soon".
    key: 'tccc-hemorrhagic-shock-resuscitation',
    name: 'JTS Hemorrhagic Shock Fluid Resuscitation Skill Sheet',
    module: 'TCCC Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC',
    pending: true,
    sections: [],
  },
  {
    // Referenced by 081-000-1025 (Administer Blood Products) step 7. Source skill sheet not yet
    // transcribed — pending.
    key: 'tccc-documentation',
    name: 'JTS Documentation Skill Sheet',
    module: 'TCCC Module 23: Documentation',
    pending: true,
    sections: [],
  },
  {
    // Referenced by 081-000-0120 (Perform a Simple (Finger) Thoracostomy) step 2, which addresses
    // the module's `finger-thoracostomy` section. Source skill sheet not yet transcribed — until
    // it is, the section-scoped ref degrades to the module-level render.
    key: 'tccc-respiration-assessment-management',
    name: 'JTS Respiration Assessment and Management Skill Sheet',
    module: 'TCCC Module 8: Respiration Assessment and Management in TFC',
    pending: true,
    sections: [],
  },
  {
    // Referenced by 081-000-0108 (Treat an Expectant Patient) step 6a — bilateral needle
    // decompression after death. Source skill sheet not yet transcribed — pending.
    key: 'tccc-cpr-tfc',
    name: 'JTS Cardiopulmonary Resuscitation in TFC Skill Sheet',
    module: 'TCCC Module 22: Cardiopulmonary Resuscitation in TFC',
    pending: true,
    sections: [],
  },
]

export function getTcccModule(key: string): TcccModule | undefined {
  return tcccModules.find(m => m.key === key)
}

/**
 * Resolve a `tcccModuleRef` to its module and, when the ref is section-scoped
 * (`<key>#<section>`), the addressed section. A bare `<key>` resolves the whole module with
 * no section. Returns undefined for an unknown module; an unknown section still resolves the
 * module so the caller can degrade to the module-level render.
 */
export function resolveTcccModuleRef(
  ref: string,
): { module: TcccModule; section?: TcccSection } | undefined {
  const [key, sectionKey] = ref.split('#')
  const module = getTcccModule(key)
  if (!module) return undefined
  if (!sectionKey) return { module }
  return { module, section: module.sections.find(s => s.key === sectionKey) }
}
