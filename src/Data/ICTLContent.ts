/**
 * ICTL training content — the detailed, GO/NO-GO evaluable packet behind each task on the
 * 68W SL1 ICTL (see ICTL.ts for the task roster). SEPARATE from the STP content store
 * (TrainingData.ts) so the legacy STP tasks keep their authored content untouched while the
 * ICTL evaluation path reads the approved ICTL packets. Both stores key by task number.
 *
 * Source of truth = the MEDCoE ICTL task PDFs (Report Date on each). Content is transcribed
 * verbatim from the approved packet: conditions, standards, warnings/cautions, performance
 * steps, the graded GO/NO-GO performance measures, and the packet's Knowledges / Skills /
 * Supporting References tables.
 *
 * JTS SKILL-SHEET DEPENDENCY: modern ICTL packets roll granular technique up into a single
 * measure like "Treated open wound IAW JTS Wound Management Skill Sheet" and defer the actual
 * step detail to a shared JTS skill sheet (e.g. TCCC Module 17: Wound Management). Those steps
 * are NOT in the task PDF — they come from the skill-sheet source, which is authored once and
 * referenced by many tasks. A performance step that defers this way carries `skillSheetRef`
 * pointing at an entry in `ictlSkillSheets` (see bottom of file); an entry still awaiting its
 * source stays a `pending` stub.
 *
 * ⚠️ PROVENANCE / FIDELITY. Task packets above are verbatim from the approved MEDCoE PDF.
 * Skill sheets are NOT necessarily — a sheet may be transcribed from the TCCC didactic module
 * (speaker notes + slide checklists) rather than from a JTS assessment checklist. That is a
 * weaker fidelity class, so every sheet carries `source` (the exact document) and sets
 * `derived: true` when its steps were synthesized from teaching prose. Never let derived
 * content migrate up into a task packet's fields — the packet stays verbatim.
 *
 * ⚠️ SCOPE. A sheet covers everything its source module covers, which is usually MORE than any
 * one task needs (Module 17 = general + open abdominal + impaled object + amputation, while
 * task 081-000-0127 uses only two of those). So steps live in named `sections` and a
 * `skillSheetRef` addresses one with `<key>#<section>`. A bare `<key>` means the whole sheet.
 */

/** One branch of a skill sheet — the unit a performance step actually references. */
export interface IctlSkillSheetSection {
  /** Stable key used in a `<sheet>#<section>` ref, e.g. "open-abdominal". */
  key: string
  /** Display title, e.g. "Open Abdominal Wound". */
  title: string
  steps: IctlPerformanceStep[]
}

/**
 * Teaching content from the source module that has no home in a task packet — the "why"
 * behind the steps. Lives on the SHEET (module-scoped, shared by every referencing task)
 * rather than on any one task, which keeps packets verbatim.
 */
export interface IctlDidactic {
  /** Why this wound pattern kills — e.g. the four open-abdominal complications. */
  complications?: string[]
  /** Judgment calls and emphases the step list can't carry. */
  keyPoints?: string[]
  /** The module's check-on-learning questions. */
  checkOnLearning?: { q: string; a: string }[]
}

/** A referenced JTS/TCCC skill sheet whose steps expand a rolled-up performance measure. */
export interface IctlSkillSheet {
  /** Stable key used by IctlPerformanceStep.skillSheetRef. */
  key: string
  /** Display name, e.g. "JTS Wound Management Skill Sheet". */
  name: string
  /** TCCC module or source, e.g. "TCCC Module 17: Wound Management". */
  module?: string
  /** True until the sheet's source is transcribed into `sections`. */
  pending: boolean
  /** Branch-scoped steps drawn from the source (empty while pending). */
  sections: IctlSkillSheetSection[]
  /** The exact document the steps came from — see the PROVENANCE note above. */
  source?: string
  /** True when steps were synthesized from didactic prose, not an assessment checklist. */
  derived?: boolean
  /** Module teaching content shared by every task referencing this sheet. */
  didactic?: IctlDidactic
}

/** A packet "Supporting Reference" row (DD Form 1380, TCCC Guidelines, a TCCC module, etc.). */
export interface IctlReference {
  /** Reference ID column, e.g. "Module 17: Wound Management", "TCCC Guidelines 2024". */
  refId: string
  /** Reference Name column. */
  refName: string
  required: boolean
  primary: boolean
  /** Source Information column (URL or note) when present. */
  source?: string
}

/** A packet "Knowledges" row. */
export interface IctlKnowledge {
  /** e.g. "081-TI-CMN-0207". */
  id: string
  name: string
}

/** A packet "Skills" row. */
export interface IctlSkill {
  /** e.g. "081-C2-68W-0289". */
  id: string
  name: string
}

export interface IctlPerformanceStep {
  number: string
  text: string
  isSubStep?: boolean
  note?: string
  warning?: string
  caution?: string
  /**
   * Key into `ictlSkillSheets` when this step's detail lives in a shared JTS skill sheet.
   * Either a bare sheet key ("jts-wound-management" — the whole sheet) or a section-scoped
   * ref ("jts-wound-management#open-abdominal"). Resolve with `resolveSkillSheetRef`.
   */
  skillSheetRef?: string
}

/** A graded GO/NO-GO performance measure — scoring iterates these, not the narrative steps. */
export interface IctlPerformanceMeasure {
  number: string
  text: string
}

export interface IctlTaskData {
  taskNumber: string
  title: string
  status: string
  /** Packet "Report Date" as ISO (YYYY-MM-DD). */
  reportDate: string
  /** Proponent MOS from the packet Remarks, e.g. "68W". */
  proponentMos?: string

  conditions: string
  standards: string
  specialConditions?: string
  safetyRisk?: string
  mopp4?: string
  cue?: string
  remarks?: string
  notes?: string

  danger?: string
  warning?: string
  caution?: string

  /** Narrative performance steps (may defer detail to a skill sheet via skillSheetRef). */
  performanceSteps: IctlPerformanceStep[]
  /** The GO/NO-GO performance measures actually scored during evaluation. */
  performanceMeasures: IctlPerformanceMeasure[]
  /** Measure numbers that are graded (mirrors TaskTrainingData.gradedSteps). */
  gradedMeasures: string[]

  knowledges?: IctlKnowledge[]
  skills?: IctlSkill[]
  references?: IctlReference[]

  prerequisiteTasks?: string[]
  supportingTasks?: string[]
}

export const ictlTaskData: IctlTaskData[] = [
  {
    taskNumber: '081-000-0127',
    title: 'Treat a Patient with an Open Abdominal Wound',
    status: 'Approved',
    reportDate: '2026-03-02',
    proponentMos: '68W',
    conditions:
      'You are in a field or garrison environment treating a patient with an open abdominal wound. You have completed task 081-000-0049 (Perform Tactical Combat Casualty Care) and have encountered a patient with open abdominal wound requiring immediate treatment. You have taken body substance isolation (BSI) precautions. You have field dressings, sterile abdominal dressings, hemostatic dressings, cravats, scissors, gauze, sterile saline or water (warm if available), water-impermeable non-adhesive covering material, intravenous (IV) equipment, and DD Form 1380 (TCCC Card) or electronic medical record (EMR). This task should not be trained in MOPP 4. This task should be trained under IED Threat conditions.',
    standards:
      'Treat a patient with an open abdominal wound in accordance with (IAW) Joint Trauma System (JTS) Wound Management Skill Sheet. Document treatment on DD Form 1380 or EMR. All critical steps performed correctly as measured by GO/NO-GO performance measures.',
    specialConditions:
      'Task may be performed during any visibility conditions with high-fidelity manikin or standardized patient simulating open abdominal wounds with/without evisceration. Task may be performed under simulated combat conditions including IED blast scenarios. Requires access to TCCC guidelines. May involve casualties with multiple traumatic injuries requiring continued monitoring.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You have encountered a patient with open abdominal wound requiring immediate treatment.',
    danger: 'None',
    warning:
      'Abdominal trauma may involve internal organ damage not visible externally. Monitor patient continuously for signs of shock and internal bleeding. Do not give patient anything by mouth (NPO). Oral intake increases risk of aspiration and complicates surgical intervention. Exposed abdominal organs must be kept moist to prevent tissue death. Use sterile saline or water to moisten dressings. Hypothermia significantly increases mortality in abdominal trauma casualties. Use warm fluids when available and prevent heat loss during treatment.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection. Do not remove impaled objects from abdominal wounds. Stabilize in place and evacuate immediately.',
    remarks:
      'Open abdominal wounds are life-threatening injuries requiring immediate treatment and rapid evacuation. Proper management of eviscerated organs and hemorrhage control are critical for patient survival. This task must be performed after addressing immediate life-threatening conditions (massive hemorrhage, airway compromise). Soldier must maintain sterile technique to the extent possible while working rapidly in tactical environments. Coordination with evacuation assets and surgical teams is essential. This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    notes:
      'Abdominal trauma may result from penetrating injuries (gunshot, shrapnel, stab wounds) or blunt force trauma. Internal injuries may be more severe than external presentation suggests. Do not attempt to clean inside the wound or remove debris from eviscerated organs. Keep the patient warm as hypothermia significantly increases mortality. If eviscerated organs cannot be reduced, do not force, cover and protect for surgical intervention. Document mechanism of injury as this guides surgical treatment decisions.',
    performanceSteps: [
      { number: '1', text: 'Identify patient has an open abdominal wound.' },
      {
        number: '2',
        text: 'Treat open wound IAW JTS Wound Management Skill Sheet.',
        skillSheetRef: 'jts-wound-management',
        note: 'Detailed technique defers to the JTS Wound Management Skill Sheet (TCCC Module 17: Wound Management).',
      },
      { number: '2a', text: 'Manage an Open Abdominal Wound.', isSubStep: true, skillSheetRef: 'jts-wound-management#open-abdominal' },
      { number: '2b', text: 'Manage an Impaled Object.', isSubStep: true, skillSheetRef: 'jts-wound-management#impaled-object' },
      { number: '3', text: 'Document treatment on SF600, DD1380 (TCCC Card) or in the patients electronic medical record.' },
    ],
    performanceMeasures: [
      { number: '1', text: 'Identified patient has an open abdominal wound.' },
      { number: '2', text: 'Treated open wound IAW JTS Wound Management Skill Sheet.' },
      { number: '3', text: 'Documented treatment on SF600, DD1380 (TCCC Card) or in the patients electronic medical record.' },
    ],
    gradedMeasures: ['1', '2', '3'],
    knowledges: [
      { id: '081-TI-CMN-0207', name: 'Know how to position a casualty with an open abdominal wound.' },
      { id: '081-TI-CMN-0208', name: 'Know how to handle protruding organs with an open abdominal wound.' },
      { id: '081-TI-CMN-0209', name: 'Know where to place protruding organs with an open abdominal wound.' },
      { id: '081-TI-CMN-0210', name: 'Know how to improvise a dressing if an abdominal wound is very large.' },
      { id: '081-TI-CMN-0211', name: 'Know how to improvise support bandages for an open abdominal wound.' },
      { id: '081-TI-CMN-0212', name: 'Know precautions to take when treating an open abdominal wound.' },
    ],
    skills: [
      { id: '081-C2-68W-0289', name: 'Demonstrate the steps in the emergency medical care of a casualty with open abdominal wounds.' },
      { id: '081-UE-FMC-5638', name: 'Differentiate Between Blunt and Penetrating Abdominal Trauma' },
    ],
    references: [
      { refId: 'DD FORM 1380', refName: 'Tactical Combat Casualty Care (TCCC) Card', required: true, primary: false },
      { refId: 'LOCAL SOP', refName: 'Local SOP', required: true, primary: false },
      { refId: 'Module 17: Wound Management', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 17', required: true, primary: true },
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: true },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
]

/**
 * Shared JTS/TCCC skill sheets referenced by performance steps across multiple ICTL tasks.
 * Authored once from the sheet's source; a `pending` entry is still awaiting that source, so
 * any step referencing it shows the rolled-up measure only.
 */
export const ictlSkillSheets: IctlSkillSheet[] = [
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
]

export function getIctlTaskData(taskNumber: string): IctlTaskData | undefined {
  return ictlTaskData.find(t => t.taskNumber === taskNumber)
}

/**
 * Resolve a `skillSheetRef` to its sheet and, when the ref is section-scoped
 * (`<key>#<section>`), the addressed section. A bare `<key>` resolves the whole sheet with
 * no section — that's how a parent step shows sheet identity while its substeps each show
 * one branch. Returns undefined for an unknown sheet; an unknown section still resolves the
 * sheet so the caller can degrade to the sheet-level render.
 */
export function resolveSkillSheetRef(
  ref: string,
): { sheet: IctlSkillSheet; section?: IctlSkillSheetSection } | undefined {
  const [key, sectionKey] = ref.split('#')
  const sheet = getIctlSkillSheet(key)
  if (!sheet) return undefined
  if (!sectionKey) return { sheet }
  return { sheet, section: sheet.sections.find(s => s.key === sectionKey) }
}

export function getIctlSkillSheet(key: string): IctlSkillSheet | undefined {
  return ictlSkillSheets.find(s => s.key === key)
}
