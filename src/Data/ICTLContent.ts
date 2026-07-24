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
 * TCCC MODULE DEPENDENCY (containment): modern ICTL packets roll granular technique up into a
 * single measure like "Treated open wound IAW JTS Wound Management Skill Sheet" and defer the
 * actual step detail to a shared TCCC training module (see TcccModules.ts). Those steps are NOT
 * in the task PDF — they come from the module's source, authored once and referenced by many
 * tasks. A performance step that defers this way carries `tcccModuleRef` pointing at a module
 * (or one of its sections); the task itself carries a bare `tcccModuleRef` naming the complete
 * TCCC component it rolls up (the "View TCCC task" deep-link target). TCCC ⊂ ICTL: the module
 * is a partial gradable component of the ICTL total.
 *
 * ⚠️ PROVENANCE / FIDELITY. Task packets here are verbatim from the approved MEDCoE PDF; TCCC
 * module content is NOT necessarily (it may be transcribed from didactic prose — see
 * TcccModules.ts, which carries `source`/`derived`). Never let derived module content migrate
 * up into a task packet's verbatim fields — the packet stays verbatim.
 */

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
   * Ref into a TCCC module (TcccModules.ts) when this step's graded detail lives there.
   * Either a bare module key ("jts-wound-management") or a section-scoped ref
   * ("jts-wound-management#open-abdominal"). Resolve with `resolveTcccModuleRef`.
   */
  tcccModuleRef?: string
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

  /** Narrative performance steps (may defer graded detail to a TCCC module via tcccModuleRef). */
  performanceSteps: IctlPerformanceStep[]
  /** The GO/NO-GO performance measures actually scored during evaluation. */
  performanceMeasures: IctlPerformanceMeasure[]
  /** Measure numbers that are graded (mirrors TaskTrainingData.gradedSteps). */
  gradedMeasures: string[]

  /**
   * Bare TCCC module key this task rolls up as its complete TCCC component (the "View TCCC
   * task" deep-link target). Section-scoped detail is referenced per-step via
   * IctlPerformanceStep.tcccModuleRef; this task-level ref names the module as a whole.
   */
  tcccModuleRef?: string

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
        note: 'Detailed technique defers to the JTS Wound Management Skill Sheet (TCCC Module 17: Wound Management).',
      },
      { number: '2a', text: 'Manage an Open Abdominal Wound.', isSubStep: true, tcccModuleRef: 'jts-wound-management#open-abdominal' },
      { number: '2b', text: 'Manage an Impaled Object.', isSubStep: true, tcccModuleRef: 'jts-wound-management#impaled-object' },
      { number: '3', text: 'Document treatment on SF600, DD1380 (TCCC Card) or in the patients electronic medical record.' },
    ],
    performanceMeasures: [
      { number: '1', text: 'Identified patient has an open abdominal wound.' },
      { number: '2', text: 'Treated open wound IAW JTS Wound Management Skill Sheet.' },
      { number: '3', text: 'Documented treatment on SF600, DD1380 (TCCC Card) or in the patients electronic medical record.' },
    ],
    gradedMeasures: ['1', '2', '3'],
    tcccModuleRef: 'jts-wound-management',
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

export function getIctlTaskData(taskNumber: string): IctlTaskData | undefined {
  return ictlTaskData.find(t => t.taskNumber === taskNumber)
}
