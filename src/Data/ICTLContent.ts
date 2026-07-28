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
 * PROVENANCE / FIDELITY. Task packets here are verbatim from the approved MEDCoE PDF; TCCC
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
  danger?: string
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
  {
    taskNumber: '081-000-1025',
    title: 'Administer Blood Products',
    status: 'Approved',
    reportDate: '2026-03-02',
    proponentMos: '68W',
    conditions:
      "You are a Soldier in a garrison or operational environment. A patient requires blood product administration after life-threatening hemorrhage has been controlled during MARCH assessment. The patient is displaying signs and symptoms of hemorrhagic shock requiring intervention. You have access to appropriate administration sets, clean gloves, constricting bands, antiseptic wipes, 450-500 mL blood collection bags, blood donation bag labels, permanent marking pens, 4x4 gauze, 3-inch tape, hemostats, personal protective equipment (PPE), donor bag measuring devices (digital scale or appropriate length of 550 cord), the patient's Department of Defense (DD) Form 1380 Tactical Combat Casualty Care (TCCC) Card or Electronic Medical Record (EMR), and Standard Form (SF) 518 Medical Record - Blood or Blood Component Transfusion. This task should not be trained in MOPP 4.",
    standards:
      'Administer blood products by first, performing blood typing (as situation allows), collecting blood from a donor (volunteer role player) and then transfusing the collected product to a patient (same volunteer role player) in accordance with (IAW) Tactical Combat Casualty Care (TCCC) Combat Medic Corpsman (CMC) Module 11 skill sheets per Joint Trauma System (JTS) Committee on Tactical Combat Casualty Care (CoTCCC). Autologous transfusion is the accepted standard, perform procedures safely and correctly within 30 minutes. Complete all steps in the proper sequence, adhering to all warnings and cautions, with 100% accuracy, using the task GO/NO-GO checklist.',
    specialConditions:
      'All live invasive procedures must be approved by the Medical Director (or delegated personnel and their medical directorship authorities) and supervised by a qualified and credentialed Evaluator. A comprehensive risk assessment will be conducted and an approved Deliberate Risk Assessment Worksheet (DRAW) recorded on the DD Form 2977, prior to this evaluation. Autologous transfusion is the accepted standard, simulation can be utilized as a last resort.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'None',
    remarks: 'None',
    notes:
      '68W, Combat Medic Specialist is the proponent for this task. It is shared with 68C Practical Nurse. This is a dual task consisting of Tactical Field Care Blood Typing, Conducting Donor Operations and Administering Blood Products. Please note that if fresh whole blood is not available another blood product may be used and the appropriate steps measured. This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    danger:
      'In the event of an adverse transfusion reaction including, but not limited to, suspected allergic reaction, anaphylaxis, acute hemolytic reaction, febrile nonhemolytic reactions, or transfusion related acute lung injury, the transfusion will be immediately stopped, and the OIC/NCOIC will activate the Emergency Medical System (EMS). If evidence of hemolysis occurs, donor/recipient will be transported by EMS to the nearest emergency department with the autologous FWB collection bag for laboratory testing.',
    warning:
      'All donor/recipients who participate in autologous FWB training are deferred from donating blood at a Food and Drug Administration (FDA) registered blood donation center for 3 months (or 7 days if the blood bank has an approved variance) if they do not receive their blood back.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    performanceSteps: [
      { number: '1', text: 'Confirm need for delivery of blood products.' },
      {
        number: '2',
        text: 'Perform tactical field care blood typing per TCCC and JTS TCCC CMC Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC skill sheets.',
        note: 'Performing blood typing to confirm pre-screened low-titer group O donor. This is important because only pre-screened group O, low-titer donors are recommended in the prehospital environment. Type-specific blood transfusions are not recommended pre-hospital. Therefore, the eldon card is only meant to be a confirmation of a pre-screened roster. It is not meant to be done at time of collection in the prehospital environment.',
        caution: 'Monitor patient for possible vagal response and treat accordingly.',
        tcccModuleRef: 'tccc-hemorrhagic-shock-resuscitation',
      },
      {
        number: '3',
        text: 'Perform donor blood collection per TCCC and JTS TCCC CMC Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC skill sheets.',
        tcccModuleRef: 'tccc-hemorrhagic-shock-resuscitation',
      },
      {
        number: '4',
        text: 'Perform administration of blood products per TCCC and JTS TCCC CMC Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC skill sheets.',
        caution:
          'Minimum vital sign monitoring includes systolic and diastolic blood pressure, heart rate, respiratory rate, and temperature IAW JTS CPG ID: 82 and TCCC guidelines. VS will be conducted at minimum prior to and every five minutes during transfusion.',
        note: 'Safety: Required medication on hand are: Epinephrine auto injector, albuterol meter dose inhaler, diphenhydramine IV/IM and crystalloid fluids.',
        tcccModuleRef: 'tccc-hemorrhagic-shock-resuscitation',
      },
      { number: '5', text: 'Perform blood collection and transfusion within 36 minutes.' },
      { number: '6', text: 'Monitor transfused patient for 20 minutes.' },
      {
        number: '7',
        text: 'Complete documentation per TCCC and JTS TCCC CMC Module 23: Documentation skill sheets.',
        tcccModuleRef: 'tccc-documentation',
      },
    ],
    performanceMeasures: [
      { number: '1', text: 'Confirmed need for delivery of blood products.' },
      { number: '2', text: 'Performed tactical field care blood typing per TCCC and JTS TCCC CMC Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC skill sheets.' },
      { number: '3', text: 'Performed donor blood collection per TCCC and JTS TCCC CMC Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC skill sheets.' },
      { number: '4', text: 'Performed administration of blood products per TCCC and JTS TCCC CMC Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC skill sheets.' },
      { number: '5', text: 'Performed blood collection and transfusion within 36 minutes.' },
      { number: '6', text: 'Monitored transfused patient for 20 minutes.' },
      { number: '7', text: 'Completed documentation per TCCC and JTS TCCC CMC Module 23: Documentation skill sheets.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7'],
    knowledges: [
      { id: 'K8125', name: "Update nursing care plan based on a patient's current health status." },
      { id: '081-NP-68C-0062', name: 'Knowledge of normal anatomy and physiology.' },
      { id: 'K8121', name: 'Use of chart forms.' },
      { id: '081-SR-WF2-K003', name: 'Knowledge of normal and abnormal complete blood count (CBC) findings' },
      { id: '081-C2-68W-0088', name: 'Describe sterile technique.' },
      { id: '081-NP-68C-0021', name: "Interpret a patient's CBC and platelet values." },
      { id: '081-NP-68C-0037', name: "Identify patients' rights." },
      { id: '081-NP-68C-0117', name: 'Blood Coagulation Process.' },
      { id: '081-NP-68C-0024', name: 'Maintain standard precautions.' },
    ],
    skills: [
      { id: '081-NP-68C-0004', name: 'Use of aseptic technique.' },
      { id: '081-NP-68C-0038', name: 'Patient education.' },
      { id: '081-NP-68C-0009', name: 'Standard precautions.' },
      { id: '081-C2-68W-0033', name: 'Demonstrate sterile technique.' },
    ],
    references: [
      { refId: 'Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 11', required: true, primary: true },
      { refId: 'CPG ID: 82', refName: 'Joint Trauma System Clinical Practice Guidelines on Prehospital Blood Transfusion', required: true, primary: false },
      { refId: 'JTS-CPGS', refName: 'Joint Trauma System Clinical Practice Guidelines', required: true, primary: false },
      { refId: 'Module 23: Documentation', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 23', required: true, primary: false },
      { refId: 'SF 518', refName: 'Medical Record - Blood or Blood Component Transfusion', required: true, primary: false },
      { refId: 'SF 600', refName: 'Chronological Record of Medical Care', required: true, primary: false },
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: false },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    taskNumber: '081-000-0118',
    title: 'Treat a Patient With Chemical Biological Radiation Nuclear Exposure',
    status: 'Approved',
    reportDate: '2026-03-05',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic assigned to a garrison or operational environment, and encounter a chemical, biological, radiological, and nuclear (CBRN) contaminated patient starting in the hot zone. The patient requires immediate care. You have access to an Improved First Aid Kit (IFAK), medical aid bag, decontamination supplies, and necessary medical equipment/supplies. You have access to current Joint Trauma System Clinical Practice Guidelines, current Tactical Combat Casualty Care (TCCC) guidelines and unit standard operating procedures (SOP). You may encounter hostile fire, low visibility, limited evacuation support, and high-stress conditions. This task is always performed in MOPP 4.',
    standards:
      'Treat a Patient with Chemical Biological Radiation Nuclear Exposure in accordance with (IAW) Joint Trauma System Clinical Practice Guidelines (JTS CPG ID: 69) and current TCCC guidelines, while adhering to all performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions: 'None',
    safetyRisk: 'Medium',
    mopp4: 'Always',
    cue: 'You encounter a patient with Chemical, Biological, Radiation, and/or Nuclear (CBRN) exposure who requires immediate treatment in the Hot Zone.',
    remarks: 'None',
    notes:
      'For non-Army Publishing Directorate (APD), contact your training non-commissioned officer (NCO) and / or check with the military occupational specialty (MOS) library.',
    danger: 'None',
    warning: 'None',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    performanceSteps: [
      { number: '1', text: 'Recognize signs and symptoms of CBRN exposure.' },
      {
        number: '2',
        text: 'Don protective mask (all contaminated parties).',
        note: "If the casualty is incapacitated, the provider must first don their own protective equipment and then ensure the casualty's protective gear is applied and functional.",
      },
      { number: '3', text: 'Perform point of injury (Hot Zone) care (IAW JTS CPG 69).' },
      { number: '3a', text: 'Treat massive hemorrhage (IAW TCCC guidelines).', isSubStep: true },
      { number: '3b', text: 'Perform rapid assessment of the airway and respirations.', isSubStep: true },
      { number: '3c', text: 'Move patient away from threat.', isSubStep: true },
      { number: '4', text: 'Perform initial CRESS assessment.' },
      { number: '4a', text: 'Administer antidotes, if tactically feasible.', isSubStep: true },
      { number: '4b', text: 'Perform rapid spot decontamination of skin or wounds (if indicated).', isSubStep: true },
      { number: '5', text: 'Move patient away from threat.' },
      { number: '6', text: 'Perform Warm Zone/Dirty CCP Tactical Field Care (IAW JTS CPG 69).' },
      { number: '6a', text: 'Verbalize prior interventions and changes in clinical status.', isSubStep: true },
      { number: '6b', text: 'Reassess immediate life-threats to the patient.', isSubStep: true },
      { number: '6b(1)', text: 'M.A.R. Reassessment (Massive hemorrhage, Airway, Respirations).', isSubStep: true },
      { number: '6b(2)', text: 'M.A.R. Reassessment (Mask, Antidote, CRESS, Rapid spot decon).', isSubStep: true },
      { number: '6c', text: 'Assess circulation.', isSubStep: true },
      { number: '6d', text: 'Protect from lethal triad.', isSubStep: true },
      { number: '6e', text: "Determine whether casualty's altered mental status is due to chemical agent or trauma.", isSubStep: true },
      { number: '6f', text: 'Identify patient evacuation priority.', isSubStep: true },
      { number: '7', text: 'Administer appropriate countermeasures.' },
      { number: '8', text: 'Document treatment performed in Hot and Warm Zone on TCCC card.' },
      {
        number: '9',
        text: 'Move patient for further decontamination or to evacuation platform.',
        note: 'The Dirty CCP may be far from the point of injury, necessitating exhausting casualty carries and exposing rescuers to heat injury from the burdens of PPE.',
        caution:
          'Communication is crucial to ensure receiving providers understand previous decontamination and care and exposures that may be suspected. This can prevent delays in patient care caused by unnecessary repetitive decontamination or redundant treatments.',
      },
      {
        number: '10',
        text: 'Perform Cold Zone care (IAW JTS CPG 69.)',
        note: 'Consider that receiving providers at all roles of care may have minimal to no experience with CBRN patients.',
      },
      { number: '10a', text: 'Perform re-triage and reassessment immediately.', isSubStep: true },
      { number: '10b', text: 'Perform secondary survey.', isSubStep: true },
      {
        number: '11',
        text: 'Complete documentation on CBRN casualty card (Appendix B).',
        note: 'In the absence of a CBRN casualty card, the TCCC casualty card is sufficient if duration of care before transfer is short and patient is relatively stable.',
      },
    ],
    performanceMeasures: [
      { number: '1', text: 'Recognized signs and symptoms of CBRN exposure.' },
      { number: '2', text: 'Donned protective mask (all contaminated parties).' },
      { number: '3', text: 'Performed point of injury (Hot Zone) care (IAW JTS CPG 69).' },
      { number: '4', text: 'Performed initial CRESS assessment.' },
      { number: '5', text: 'Moved patient away from threat.' },
      { number: '6', text: 'Performed Warm Zone/Dirty CCP Tactical Field Care (IAW JTS CPG 69).' },
      { number: '7', text: 'Administered appropriate countermeasures.' },
      { number: '8', text: 'Documented treatment performed in Hot and Warm Zone on TCCC card.' },
      { number: '9', text: 'Moved patient for further decontamination or to evacuation platform.' },
      { number: '10', text: 'Performed Cold Zone care (IAW JTS CPG 69.)' },
      { number: '11', text: 'Completed documentation on CBRN casualty card (Appendix B).' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    knowledges: [
      { id: 'K29744', name: 'Radiation Exposure Levels' },
      { id: '031-R-0006', name: 'identify radiation sources' },
      { id: '031-R-0013', name: 'Know biological effects of radiation' },
      { id: 'K28155', name: 'Know commercial and military sources of ionizing radiation' },
    ],
    skills: [
      { id: 'S4637', name: 'Be able to identify Radiation Sources' },
      { id: '031-R-0025', name: 'implement appropriate handling methods and exposure controls when using radiation' },
    ],
    references: [
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: true, source: 'https://jts.health.mil/assets/docs/cpgs/CBRN_Injury_Part1_Initial_Response_01_May_2018_ID69_v1.1.pdf' },
      { refId: '0-13-508579-9', refName: "Prehospital Emergency Care, Instructor's Wraparound Edition, 9th edition", required: true, primary: false },
      { refId: 'ATP 4-02.7', refName: 'Multi-Service Tactics, Techniques, and Procedures for Health Service Support in a Chemical, Biological, Radiological, and Nuclear Environment', required: true, primary: false },
      { refId: 'ATP 4-02.83', refName: 'Multiservice Tactics, Techniques, and Procedures for Treatment of Nuclear and Radiological Casualties', required: true, primary: false, source: 'http://armypubs.army.mil/doctrine/DR_pubs/dr_a/pdf/atp4_02x83.pdf' },
      { refId: 'ATP 4-02.85', refName: 'Multi-Service Tactics, Techniques, and Procedures for Treatment of Chemical Warfare Agent Casualties and Conventional Military Chemical Injuries', required: true, primary: false },
      { refId: 'DD FORM 1380', refName: 'Tactical Combat Casualty Care (TCCC) Card', required: true, primary: false },
      { refId: 'FM 3-11.5', refName: 'CBRN Decontamination, Multiservice Tactics, Techniques and Procedures for Chemical, Biological, Radiological, and Nuclear Decontamination', required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    taskNumber: '081-000-0108',
    title: 'Treat an Expectant Patient',
    status: 'Approved',
    reportDate: '2026-03-02',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic assigned to a combat or operational environment during a mass-casualty (MASCAL) situation. You have triaged an expectant patient, requiring end-of-life care. Equipment available includes an Individual First Aid Kit (IFAK), aid bag, and pain management supplies, sedation medications, DD Form 1380 TCCC Card, current TCCC Guidelines, Joint Trauma System Clinical Practice Guidelines (JTS CPGS) ID:61 (Analgesia and Sedation Management During Prolonged Field Care), TCCC CMC Module 22 (Cardiopulmonary Resuscitation in TFC), unit SOP, and access to telemedicine consultation if available. You may encounter hostile fire, low visibility, limited evacuation support, and high-stress conditions. This task should not be trained in MOPP 4.',
    standards:
      'Treat an expectant casualty IAW JTS CPG ID:61, Unit SOP, TCCC guidelines, TCCC CMC Module 22 (Cardiopulmonary Resuscitation in TFC), and DD Form 1380 by confirming expectant triage classification, ensuring casualty safety and dignity, consulting telemedicine if available, administering appropriate analgesia and sedation to achieve comfort, providing continuous comfort care, documenting all care. While adhering to all performance steps with 100% accuracy, utilizing GO/NO GO criteria.',
    specialConditions:
      'This task will be evaluated using high-fidelity simulators. Task requires access to TCCC CMC Module 22 (Cardiopulmonary Resuscitation in TFC), and medical equipment.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Casualty assessed as expectant during triage (life-threatening injuries with minimal or no chance of survival given available resources and tactical situation).',
    danger:
      'Monitor respiratory rate continuously. Incremental dosing is critical to prevent respiratory arrest and death. Misclassification can withhold life-saving care or waste resources. Reassess triage classifications as tactical situations and resources change. Combining opioids and benzodiazepines increases respiratory depression risk. Use only when necessary and monitor closely.',
    warning:
      'Monitor expectant casualties for changes in condition; improved resources may reclassify them as salvageable. Record all medications, doses, and times accurately for legal and care continuity. Maintain casualty dignity to uphold ethical standards and morale. Provide mental health resources to personnel to mitigate moral injury and stress. Secure medications properly to prevent diversion or accidental overdose.',
    caution:
      'Use gloves and eye protection to prevent exposure to infectious body fluids. Separate expectant casualties from salvageable ones to preserve morale and focus resources. Non-medical personnel may provide comfort care under medical oversight, with periodic reassessment. Offer spiritual care upon request to honor dignity.',
    remarks:
      'Expectant casualty care is a challenging task in combat medicine, performed during mass-casualty situations for patients with life-threatening injuries unlikely to survive given available resources. The focus is on providing comfort and dignity while preserving resources for salvageable casualties, following triage principles. Continuous monitoring and reassessment are essential, as conditions may allow reclassification. Pain management prioritizes respiratory rate control using opioids and benzodiazepines, with incremental dosing to avoid respiratory arrest. Telemedicine consultation is recommended for oversight and legal protection. Emotional and spiritual support should be offered, and time of death, personal effects, and remains must be handled respectfully per unit SOP. All care is documented on DD Form 1380 TCCC Card.',
    notes:
      'Training for expectant casualty care must address ethical, legal, psychological issues, and use high-fidelity simulators. Scenarios should include triage reassessment, medication administration, documentation, and spiritual and emotional support. Train personnel to delegate comfort care with oversight, handle personal effects respectfully, and coordinate with chaplains, behavioral health staff, and senior medical officers. Discuss risks of moral injury and provide mental health resources. Emphasize triage principles, not euthanasia or abandonment. 68W Combat Medic Specialist is the proponent for this task.',
    performanceSteps: [
      { number: '1', text: 'Confirm triage status as expectant.' },
      { number: '2', text: 'Move patient to safety.' },
      {
        number: '2a',
        text: 'Move the patient out of line of fire or environmental hazard if possible and into Expectant Area to ensure dignity and comfort.',
        isSubStep: true,
      },
      {
        number: '2a(1)',
        text: 'The area must be clearly marked, protected from environmental exposure, monitored by medical personnel.',
        isSubStep: true,
      },
      {
        number: '2a(2)',
        text: 'Positioned away from high-traffic treatment zones while still allowing for continuous reassessment.',
        isSubStep: true,
      },
      {
        number: '2b',
        text: 'Focused palliative care while preserving critical resources for salvageable casualties.',
        isSubStep: true,
      },
      { number: '3', text: 'Conduct telemedicine consultation for medical guidance and oversight.' },
      { number: '4', text: 'Administer analgesia and/or sedation as available and appropriate.' },
      { number: '4a', text: "Titrate analgesia and/or sedation until the patient's pain is relieved.", isSubStep: true },
      {
        number: '4b',
        text: 'For patients who are unable to communicate, titrate analgesia and/or sedation until the respiratory rate is less than 20/min.',
        isSubStep: true,
      },
      { number: '4c', text: 'Administer analgesia and/or sedation IAW TCCC guidelines, CPG 61, and local SOP.', isSubStep: true },
      {
        number: '4d',
        text: 'Despite having a respiratory rate less than 20/min, administer benzodiazepine if the patient complains of feeling anxious or agitated.',
        isSubStep: true,
      },
      { number: '5', text: 'Provide comfort care:' },
      { number: '5a', text: 'Provide hydration if tolerated.', isSubStep: true },
      {
        number: '5b',
        text: 'Offer spiritual support, if so, communicate with chaplain or other available services like Behavioral Health to offer spiritual and/or emotional support.',
        isSubStep: true,
      },
      { number: '6', text: 'Perform appropriate actions if the patient dies:' },
      {
        number: '6a',
        text: 'If patient has torso trauma or polytrauma, perform bilateral needle decompression of the chest IAW with JTS TCCC CMC Module 22: Cardiopulmonary Resuscitation in TFC.',
        isSubStep: true,
        tcccModuleRef: 'tccc-cpr-tfc',
      },
      { number: '6b', text: 'Annotate time of death.', isSubStep: true },
      { number: '6c', text: 'Secure personal effects.', isSubStep: true },
      { number: '6d', text: 'Cover remains in accordance with SOP.', isSubStep: true },
      { number: '7', text: 'Document care on DD 1380 (TCCC Card) or unit-approved documentation.' },
      { number: '7a', text: 'Record all finding and treatment.', isSubStep: true },
      { number: '7b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Confirmed triage status as expectant.' },
      { number: '2', text: 'Moved patient to safety.' },
      { number: '3', text: 'Conducted telemedicine consultation for medical guidance and oversight.' },
      { number: '4', text: 'Administered analgesia and/or sedation as available and appropriate.' },
      { number: '5', text: 'Provided comfort care.' },
      { number: '6', text: 'Performed appropriate actions if patient dies.' },
      { number: '7', text: 'Documented care on DD 1380 (TCCC Card) or unit-approved documentation.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7'],
    knowledges: [
      {
        id: 'K34050',
        name: 'Know the procedures for annotating treatment in the Electronic Health Record (EHR) and DD 1380 Tactical Combat Casualty Care (TCCC) card.',
      },
      { id: '081-TI-CMN-0015', name: 'Know what action to take during tactical field care (TCCC).' },
    ],
    skills: [
      { id: '081-VC-68T-SK0172', name: 'Monitor patient for sedation/anesthesia.' },
      { id: 'S8723', name: 'Complete a DD 1380 Tactical Combat Casualty Card' },
    ],
    references: [
      { refId: 'CPG ID: 61', refName: 'Analgesia and Sedation Management During Prolonged Field Care', required: true, primary: true },
      {
        refId: 'Module 22: Cardiopulmonary Resuscitation in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 22',
        required: true,
        primary: false,
      },
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: false },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    taskNumber: '081-000-0120',
    title: 'Perform a Simple (Finger) Thoracostomy',
    status: 'Approved',
    reportDate: '2026-03-12',
    proponentMos: '68W',
    conditions:
      'You are a combat medic in an operational environment. You have a patient that requires a simple (finger) thoracostomy. The patient is showing symptoms of respiratory distress. You have access to a vented chest seal, sterile gloves, disposable scalpel, forceps, large hemostat, betadine solution, lidocaine 1% for injection, needle, syringe, and Department of Defense (DD) Form 1380, Standard Form (SF) 600 or an Electronic Medical Record (EMR). This task should not be trained in MOPP 4.',
    standards:
      'Perform a simple (finger) thoracostomy without causing further injury to the patient in accordance with (IAW) Joint Trauma System Clinical Practice Guidelines (JTS CPGS), Tactical Combat Casualty Care (TCCC), DD Form 1380 (Tactical Combat Casualty Care) while adhering to all warnings and cautions, without error, using the task GO/NO GO checklist.',
    specialConditions: 'None',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You encounter a patient that requires a simple (finger) thoracostomy.',
    remarks: 'None.',
    notes:
      'This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    danger: 'None.',
    warning:
      'Risks associated with simple (finger) thoracostomy include malpositioning or bleeding, which can result in infection, recurrent pneumothorax, and tension pneumothorax.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation precautions by wearing gloves and eye protection as a minimal standard of protection.',
    performanceSteps: [
      { number: '1', text: 'Identify need for a Simple (Finger) Thoracostomy.' },
      {
        number: '2',
        text: 'Perform Simple (Finger) Thoracostomy IAW TCCC CPP Module 08: Respiration Assessment & Management in TFC, Finger Thoracostomy skill sheet.',
        warning:
          'The intercostal artery, vein, and nerve run on the underside of the rib, injury to these vessels can result in a significant amount of bleeding.',
        tcccModuleRef: 'tccc-respiration-assessment-management#finger-thoracostomy',
      },
      { number: '3', text: 'Document procedure, interventions, and all findings on a DD 1380 or EMR.' },
    ],
    performanceMeasures: [
      { number: '1', text: 'Identified need for a Simple (Finger) Thoracostomy.' },
      {
        number: '2',
        text: 'Performed Finger Thoracostomy IAW TCCC CPP Module 08: Respiration Assessment & Management in TFC, Finger Thoracostomy skill sheet.',
      },
      { number: '3', text: 'Documented procedure, interventions, and all findings on a DD 1380 or EMR.' },
    ],
    gradedMeasures: ['1', '2', '3'],
    tcccModuleRef: 'tccc-respiration-assessment-management',
    knowledges: [
      { id: 'AR 40-66', name: 'Complete a DD 1380 (Tactical Combat Casualty Card)' },
      { id: '011-1134K', name: 'Army medical/casualty evacuation' },
    ],
    skills: [
      { id: 'S8723', name: 'Complete a DD 1380 Tactical Combat Casualty Card' },
      { id: '081-C2-68W-0315', name: 'Demonstrate the ability to comply with body substance isolation guidelines.' },
      { id: '081-C2-68W-0334', name: 'Classify chest injury.' },
      { id: '081-C2-68W-0167', name: "Demonstrate the ability to measure and record a patient's vital signs" },
      { id: 'S8533', name: 'Perform procedures for a finger thoracotomy' },
    ],
    references: [
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'ISBN-13: 978-1284180589', refName: 'Prehospital Trauma Life Support, Military Edition, 9th Edition', required: true, primary: false },
      {
        refId: 'Module 8: Respiration Assessment and Management in TFC',
        refName: 'Combat Paramedic / Provider TCCC - Module 8',
        required: true,
        primary: true,
      },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
    ],
    prerequisiteTasks: [],
    supportingTasks: ['081-000-1030'],
  },
  {
    taskNumber: '081-68W-0125',
    title: 'Treat a Patient With Dermatological Complaint',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic Specialist assigned to a Battalion Aid Station or Medical Treatment Facility in a garrison or operational environment. You have completed task 081-68W-0250 (Treat a Patient with a General Medical Complaint) and the patient requires a dermatological exam. You have access to MEDCOM Pam 40-7-21 Algorithm-Directed Troop Medical Care (ADTMC), local SOPs, medications, IV fluids, Class VIII medical supplies, and electronic medical record documentation systems. This task should not be trained in MOPP 4.',
    standards:
      'Treat a patient with dermatological complaint IAW MEDCOM Pam 40-7-21 (ADTMC) and local SOPs. Focused examination is completed based on chief complaint. Appropriate ADTMC protocol is identified and applied. Treatment is provided based on assessment findings. Patient disposition is determined and return-to-duty instructions are provided. All care is properly documented in the electronic medical record.',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to ADTMC protocols and medical equipment. Task may be performed on pediatric, adult, or geriatric patients with varying chief complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You have completed task 081-68W-0250 (Treat a Patient With General Medical Complaint) and encounter a patient who presents with a dermatological complaint.',
    remarks: 'None',
    notes: 'None',
    danger: 'None',
    warning:
      'Failure to identify signs of sepsis, respiratory distress, or gangrene may result in serious patient harm or death. Immediately notify medical provider of any critical findings.',
    caution:
      'Ensure proper infection control procedures when examining patients with dermatological complaints. Monitor for signs of respiratory distress and sepsis.',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform focused assessment using appropriate ADTMC protocol for dermatological complaints.',
        note: 'Select and apply applicable protocol(s) from J1-J18 based on patient presentation.',
      },
      {
        number: '1a',
        text: "Identify and verbalize selected ADTMC protocol based on the patient's chief complaint.",
        isSubStep: true,
        note: 'Identify and verbalize for presence of a skin rash associated with medication, fever, or painful (not due to a sunburn) and anatomical location.',
      },
      { number: '1a(1)', text: 'J-1: Unknown Cause of Skin Disorder/Complaint.', isSubStep: true },
      { number: '1a(2)', text: 'J-2: Acne.', isSubStep: true },
      { number: '1a(3)', text: 'J-3: Shaving Problem-Pseudofolliculitis Barbae (Ingrown Hairs).', isSubStep: true },
      { number: '1a(4)', text: 'J-4: Dandruff (Scaling of the Scalp).', isSubStep: true },
      { number: '1a(5)', text: 'J-5: Hair Loss.', isSubStep: true },
      { number: '1a(6)', text: "J-6: Athlete's Foot (Tinea Pedis).", isSubStep: true },
      { number: '1a(7)', text: 'J-7: Jock Itch (Tinea Cruris).', isSubStep: true },
      { number: '1a(8)', text: 'J-8: Scaling, Depigmented Spots on Chest, Back, and Upper Arms (Tinea Versicolor).', isSubStep: true },
      { number: '1a(9)', text: 'J-9: Boils.', isSubStep: true },
      { number: '1a(10)', text: 'J-10: Fever Blisters (Cold Sores).', isSubStep: true },
      { number: '1a(11)', text: 'J-11: Skin Abrasion/Laceration.', isSubStep: true },
      { number: '1a(12)', text: 'J-12: Suture Removal.', isSubStep: true },
      { number: '1a(13)', text: 'J-13: Drug Rash, Contact Dermatitis.', isSubStep: true },
      { number: '1a(14)', text: 'J-14: Burns/Sunburn.', isSubStep: true },
      { number: '1a(15)', text: 'J-15: Friction Blisters on Feet.', isSubStep: true },
      { number: '1a(16)', text: 'J-16: Corns on Feet.', isSubStep: true },
      { number: '1a(17)', text: 'J-17: Plantar Warts.', isSubStep: true },
      { number: '1a(18)', text: 'J-18: Ingrown Toenail.', isSubStep: true },
      { number: '1b', text: "Apply correct ADTMC protocol based on the patient's chief complaint.", isSubStep: true },
      { number: '2', text: 'Provide dermatologically focused treatment.' },
      { number: '2a', text: 'Administer medications per ADTMC protocols.', isSubStep: true },
      { number: '2b', text: 'Provide symptomatic relief measures.', isSubStep: true },
      { number: '2c', text: 'Reassess vital signs, symptoms, and overall condition every 5 or 15 minutes per patient presentation.', isSubStep: true },
      { number: '3', text: 'Identify patient disposition and return to duty instructions.' },
      { number: '3a', text: 'Assess severity and need for provider evaluation.', isSubStep: true },
      { number: '3b', text: 'Determine if evacuation/higher care is needed.', isSubStep: true },
      { number: '3c', text: 'Provide return-to-duty instructions if appropriate.', isSubStep: true },
      { number: '3d', text: 'Ensure follow-up is communicated and scheduled as needed.', isSubStep: true },
      { number: '4', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '4a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '4b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused assessment using appropriate ADTMC protocol for dermatological complaints.' },
      { number: '2', text: 'Provided dermatological focused treatment.' },
      { number: '3', text: 'Identified patient disposition and return to duty instructions.' },
      { number: '4', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    knowledges: [
      { id: 'K31076', name: 'Identify procedures for closing minor lacerations.' },
      { id: 'K23542', name: 'Knowledge of the methods used to assess a lacerations to the scalp' },
      { id: 'K31078', name: 'Identify basic concept in the treatment of skin disorders.' },
      { id: 'K31109', name: 'Identify fundamental principles in the management of shock.' },
      { id: 'K31383', name: 'Interpret the signs of sepsis and septic shock' },
      { id: 'K1049', name: 'Signs and Symptoms of Anaphylactic Shock' },
      { id: 'K23272', name: 'Knowledge of a patient with shock, sepsis, or Multiple Organ Dysfunction Syndrome (MODS)' },
    ],
    skills: [
      { id: 'S8501', name: "Obtain a patient's vital signs." },
      { id: 'S8522', name: 'Administer medications.' },
      { id: '081-C2-68W-0304', name: 'Assess and treat skin infection.' },
      { id: 'S8699', name: 'Perform treatment for anaphylactic shock' },
      { id: 'S8448', name: 'Perform procedures in the treatment of skin disorders.' },
    ],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    taskNumber: '081-68W-0165',
    title: 'Treat a Patient with Gynecological Complaint',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic Specialist assigned to a Battalion Aid Station or Medical Treatment Facility in a garrison or operational environment. You have completed task 081-68W-0250 (Treat a Patient with a General Medical Complaint). A patient presents with a gynecological complaint and requires a gynecological examination. You have access to MEDCOM Pam 40-7-21 (ADTMC), local SOPs, medications, Class VIII medical supplies, and electronic medical record documentation systems. This task should not be trained in MOPP 4.',
    standards:
      'Treat a female patient with gynecological complaint IAW MEDCOM Pam 40-7-21 (Algorithm-Directed Troop Medical Care) and local SOPs. The correct ADTMC gynecological protocol is identified and applied based on chief complaint. Focused assessment identifies red flag conditions requiring immediate provider notification. Appropriate treatment and symptomatic relief measures are provided within scope of practice. Patient disposition is correctly determined, return-to-duty or follow-up instructions are provided, and all care is properly documented in the electronic medical record. All performance measures are met.',
    specialConditions:
      'This task is performed in a controlled medical facility environment with privacy measures in place. Task requires access to electronic medical record systems. Task should not be performed in MOPP 4 due to requirement for detailed physical examination, fine motor skills, and patient communication regarding sensitive medical issues. Task requires a female patient or high-fidelity female patient simulator. A female chaperone should be present during examination when medic and patient are of different genders, IAW local policy. Task may involve patients of childbearing age (12-55 years) with various gynecological complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient requires treatment for gynecological complaint.',
    danger: 'None',
    warning:
      'Failure to identify signs of sepsis, or pregnancy may result in serious patient harm or death. Immediately notify medical provider of any critical findings.',
    caution:
      'Ensure proper infection control procedures when examining patients with gynecological complaints. Monitor for signs of fever and pregnancy.',
    remarks:
      'This task requires application of ADTMC protocols specific to gynecological complaints. Proper abdominal examination technique is critical for identifying serious conditions requiring immediate provider evaluation or evacuation. Medics must maintain high index of suspicion for sexually transmitted disease or pregnancy.',
    notes:
      'Medics must be familiar with ADTMC algorithms for nausea/vomiting, discharge from breast or vagina, constipation, and pelvic pain. Document all pertinent positive and negative findings. Red flags include breast or vaginal pain associated with fever, non-midline pain, masses/lumps, or bloody nipple discharge.',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform focused assessment using appropriate ADTMC protocol for gynecological complaints.',
        note: 'Select and apply applicable protocol(s) from I1-I6 based on patient presentation.',
      },
      {
        number: '1a',
        text: 'Identify and verbalize selected ADTMC protocol based on patients chief complaint.',
        isSubStep: true,
        note: 'Identify and verbalize for presence of red flags including: breast or vaginal pain associated with fever, non-midline pain, masses/lumps, or bloody nipple discharge.',
      },
      { number: '1a(1)', text: 'I-1: Breast Problems.', isSubStep: true },
      { number: '1a(2)', text: 'I-2: Suspected Pregnancy.', isSubStep: true },
      { number: '1a(3)', text: 'I-3: Menstrual Problems, Vaginal Bleeding.', isSubStep: true },
      { number: '1a(4)', text: 'I-4: Vaginal Discharge, Itching, Irritation, or Pain.', isSubStep: true },
      { number: '1a(5)', text: 'I-5: Request for PAP or Routine Pelvic Examination.', isSubStep: true },
      { number: '1a(6)', text: 'I-6: Request for Information on Contraception.', isSubStep: true },
      { number: '1b', text: "Apply correct ADTMC protocol based on the patient's chief complaint.", isSubStep: true },
      { number: '2', text: 'Provide gynecological focused treatment.' },
      { number: '2a', text: 'Administer medications per ADTMC protocols.', isSubStep: true },
      { number: '2b', text: 'Provide symptomatic relief measures.', isSubStep: true },
      { number: '2c', text: 'Reassess vital signs, symptoms, and overall condition per patient presentation.', isSubStep: true },
      { number: '3', text: 'Identify patient disposition and return to duty instructions.' },
      { number: '3a', text: 'Assess severity and need for provider evaluation.', isSubStep: true },
      { number: '3b', text: 'Determine if evacuation/higher care needed.', isSubStep: true },
      { number: '3c', text: 'Provide return-to-duty instructions if appropriate.', isSubStep: true },
      { number: '3d', text: 'Ensure follow-up is communicated and scheduled as needed.', isSubStep: true },
      { number: '4', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '4a', text: 'Record all finding and treatment.', isSubStep: true },
      { number: '4b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused assessment using appropriate ADTMC protocol for gynecological complaints.' },
      { number: '2', text: 'Provided gynecological focused treatment.' },
      { number: '3', text: 'Identified patient disposition and return to duty instructions.' },
      { number: '4', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    knowledges: [
      { id: 'K31012', name: 'Understand the anatomy and physiology of the reproductive system.' },
      { id: '081-SA-CYT-0007', name: 'Understand the concepts and methods for obtaining a specimen from the female genital tract' },
      { id: 'K23346', name: 'Knowledge of the female reproductive system, including conception, gestation, and the safety of medications for the fetus' },
      { id: '331-3K5-6583', name: 'Sexually Transmitted Diseases' },
      { id: 'K23548', name: 'Knowledge of pathophysiology, assessment, and management of injuries to female genitalia' },
      { id: '081-C2-68W-0672', name: 'Knowledge of how to assess a casualty with a gynecological complaint.' },
      { id: '081-C2-68W-0673', name: 'Knowledge of how to recognize a gynecological emergency.' },
      { id: '081-C2-68W-0674', name: 'Knowledge of the general care for any casualty experiencing a gynecological emergency.' },
      { id: '081-TI-CMN-0157', name: 'Know how to protect against sexually transmitted diseases (STDs).' },
      { id: 'K32212', name: 'Basic knowledge of normal human anatomy and physiology: Reproductive systems' },
    ],
    skills: [
      { id: '081-C2-68W-0185', name: 'Demonstrate how to assess a casualty with a gynecological complaint.' },
      { id: 'S8685', name: 'Perform appropriate patient assessment' },
      { id: 'S8522', name: 'Administer medications.' },
    ],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    taskNumber: '081-000-0238',
    title: 'Place an Intraosseous Device',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic assigned to a combat or operational environment. Your assessment reveals a patient requiring emergency vascular access via IO placement. You have access to an Individual First Aid Kit (IFAK), combat medic aid bag, IO device, and necessary medical equipment/supplies. You have completed a general medical assessment and have donned the appropriate BSI. You have access to TCCC guidelines and unit SOP. This task should not be trained in MOPP 4.',
    standards:
      'Place an intraosseous device in accordance with (IAW) Joint Trauma Systems Intraosseous (IO) skill sheets while adhering to all warnings and cautions, with 100% accuracy, using the task GO/NO-GO checklist.',
    specialConditions:
      'This task may be performed during limited visibility conditions. This task may be performed under direct or indirect fire. This task requires hands-on training with approved IO training devices before performing on actual casualties.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient requires emergency vascular access and peripheral IV access cannot be quickly obtained.',
    remarks: 'None',
    notes: 'None',
    danger:
      'Improper IO insertion technique can result in bone fracture, compartment syndrome, or vascular injury. Failure to identify contraindications can result in serious complications. Use of excessive force during insertion can cause needle penetration through the opposite cortex, resulting in extravasation and failed vascular access.',
    warning:
      'It is contraindicated for fracture of bones such as the tibia, femur or sternum. Including previous orthopedic procedures, i.e. knee replacement, any infection over the insertion site, the inability to locate the anatomical landmarks, IO placement at the same site with the past 24 hours, excessive tissue over the insertion site, and prosthetic limb or joint.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    performanceSteps: [
      {
        number: '1',
        text: 'Identify the need for emergency intraosseous (IO) vascular access.',
        note: 'When rapid vascular access is required and peripheral IV access cannot be quickly obtained (examples include, but are not limited to, the following: polytrauma, hemorrhagic shock, severe burns, hypothermic casualties).',
      },
      {
        number: '2',
        text: 'Perform intraosseous (IO) access IAW with appropriate JTS skill sheet.',
        note: 'Complete at least one of the following JTS skill sheets.',
      },
      { number: '2a', text: 'STERNAL INTRAOSSEOUS DEVICE.', isSubStep: true, tcccModuleRef: 'tccc-shock-recognition-management#sternal' },
      { number: '2b', text: '(HUMERUS) INTRAOSSEOUS (IO) DEVICE.', isSubStep: true, tcccModuleRef: 'tccc-shock-recognition-management#humerus' },
      {
        number: '2c',
        text: '(PROXIMAL/ANTERIOR TIBIA) INTRAOSSEOUS (IO) DEVICE.',
        isSubStep: true,
        tcccModuleRef: 'tccc-shock-recognition-management#proximal-tibia',
      },
      { number: '2d', text: '(DISTAL TIBIA) INTRAOSSEOUS (IO) DEVICE.', isSubStep: true, tcccModuleRef: 'tccc-shock-recognition-management#distal-tibia' },
      { number: '3', text: "Document the procedure on SF 600, DD 1380 or in the patient's electronic medical record (EMR)." },
    ],
    performanceMeasures: [
      { number: '1', text: 'Identified the need for emergency intraosseous (IO) vascular access.' },
      { number: '2', text: 'Performed intraosseous (IO) access IAW with appropriate JTS skill sheet.' },
      { number: '3', text: "Documented the procedure on SF 600, DD 1380 or in the patient's electronic medical record (EMR)." },
    ],
    gradedMeasures: ['1', '2', '3'],
    tcccModuleRef: 'tccc-shock-recognition-management',
    knowledges: [
      { id: '081-C2-68W-0983', name: 'Explain the indications for, and the initiation of, intravenous therapy.' },
      { id: '081-C2-68W-0985', name: 'Identify the common complications of intravenous therapy.' },
      { id: '081-C2-68W-0986', name: 'Describe the process of preventing or correction of intravenous therapy complications.' },
      { id: '081-C2-68W-0701', name: 'Knowledge of the structure and function of the circulatory system.' },
      { id: 'K1219', name: 'Basic anatomy of the human body' },
      { id: '081-TI-CMN-0309', name: 'Know how to adjust intravenous infusion flow.' },
      { id: '081-TI-CMN-0310', name: 'Know how to secure intravenous infusion tubing.' },
      { id: 'K785', name: 'Identify basic facts about the Clinical Applications of Infusion Devices' },
      { id: '081-VC-68T-KN0006', name: 'Know how to calculate intravenous fluid amounts.' },
      { id: '805P-K-0100', name: 'Human Skeletal Anatomy' },
    ],
    skills: [
      { id: '081-NP-68C-0038', name: 'Patient education.' },
      { id: '081-VC-68T-SK0243', name: 'Place an intravenous fluid catheter.' },
      { id: 'S3061', name: 'Administer medication via the intraosseous route' },
      { id: 'S6400', name: 'Perform palpation' },
    ],
    references: [
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: true, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'LOCAL SOP', refName: 'LOCAL SOP', required: true, primary: false },
      {
        refId: 'Module 10: Shock Recognition & Management',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 10',
        required: true,
        primary: false,
      },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // The duplicated "This task should not be trained in MOPP 4" closing Conditions is PRINTED
    // that way on page 2 of the packet, so it is reproduced. See the verbatim note on 081-000-0125.
    taskNumber: '081-000-1653',
    title: 'Perform K9 Tactical Combat Casualty Care',
    status: 'Approved',
    reportDate: '2026-02-26',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic Specialist in a combat environment with limited medical resources. A Military Working Dog (MWD) has sustained life-threatening injuries during combat and is exhibiting signs/symptoms of distress requiring immediate treatment from the 68W at point of injury. The MWD handler is unavailable/incapacitated to physically restrain the animal. CLS providers are available to assist. You have access to muzzle, dog collar, leash, warming blanket, medic kit, K9TCCC Guidelines, and unit SOP. This task should not be trained in MOPP 4 This task should not be trained in MOPP 4.',
    standards:
      'Assess and treat a Military Working Dog with life-threatening injuries IAW K9TCCC Guidelines. Care under fire is performed with hemorrhage control if tactically feasible. Tactical field care is performed using M3ARCH PAWS methodology. Muzzle is applied for provider safety. Massive hemorrhage is controlled. Airway is managed as indicated. Respiration is assessed and treated. Circulation is maintained with vascular access and fluid resuscitation if needed. Hypothermia prevention is implemented. All injuries are assessed and treated. All care is documented on DD Form 3073. MWD is prepared for evacuation.',
    specialConditions: 'None',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Military Working Dog sustains life-threatening injuries during combat operations requiring immediate tactical combat casualty care.',
    danger:
      'Injured Military Working Dogs may bite without warning even if normally docile. Approach with extreme caution. Do not place hands near mouth unless muzzle is properly applied. Bites can cause severe injury requiring medical treatment.',
    warning:
      'Improper assessment may delay recognition of serious injury. Failure to identify red-flag symptoms (neurological deficit, severe deformity, inability to bear weight, loss of circulation) and failure to refer to the patient promptly can result in permanent disability. Medication errors can cause patient harm. Administer only medications authorized by standing orders or provider direction. Incorrect dosage or unauthorized use can cause adverse drug reactions.',
    caution:
      'All body fluids should be considered potentially infectious. Always observe body substance isolation (BSI) precautions by wearing gloves and eye protection. Reassess MWD continuously for changes in condition. Improper medication dosing can be fatal - verify weight-based calculations. Do not bandage penetrating eye injuries. Prolonged application of ice or heat can cause tissue damage. Ensure complete and accurate documentation on DD Form 3073 for continuity of care.',
    remarks:
      'This task is critical for preserving the life of Military Working Dogs, which are valuable military assets and force multipliers. Combat medics may be required to provide emergency care when veterinary personnel are not immediately available. K9TCCC follows similar principles to human TCCC but with species-specific modifications.',
    notes:
      'MWDs may bite when injured or in pain. Always apply muzzle when possible unless respiratory distress precludes its use. Dosing calculations for medications are weight-based and species-specific - follow K9TCCC Guidelines carefully. Document all treatments for veterinary follow-up care. 68W Combat Medic Specialist is the proponent for this task.',
    performanceSteps: [
      { number: '1', text: 'Perform Care Under Fire.' },
      {
        number: '1a',
        text: 'Apply a muzzle to protect care providers unless respiratory distress or the tactical situation precludes its use.',
        isSubStep: true,
      },
      { number: '1b', text: 'Stop life-threatening external hemorrhage if tactically feasible.', isSubStep: true },
      { number: '2', text: 'Perform tactical field care using M3ARCH algorithm.' },
      { number: '2a', text: 'Muzzle (M).', isSubStep: true },
      {
        number: '2b',
        text: 'Massive Hemorrhage (M).',
        isSubStep: true,
        note: 'Human-designed tourniquets (like the C-A-T) are generally ineffective. The SWAT-T is the only tourniquet that should be considered for massive extremity hemorrhage in an MWD.',
      },
      { number: '2b(1)', text: 'Assess for unrecognized hemorrhage.', isSubStep: true },
      { number: '2b(2)', text: 'Control all sources of bleeding.', isSubStep: true },
      { number: '2c', text: 'Medication (M) consideration.', isSubStep: true },
      { number: '2c(1)', text: 'Analgesia as indicated IAW local SOPs or K9TCCC guidelines.', isSubStep: true },
      { number: '2c(2)', text: 'Consider sedation or pain management to provide treatment.', isSubStep: true },
      {
        number: '2d',
        text: 'Airway Management (A).',
        isSubStep: true,
        caution:
          "Consider using a mouth gag to keep the MWDs mouth open to prevent damage to the endotracheal tube. Examples may include: 1-2 inch roll of medical tape; 2 inch roll of self adhesive bandage, or use of a portion of a Kong between the MWDs teeth to keep the airway open.",
      },
      { number: '2d(1)', text: 'For conscious MWD with compromised airway.', isSubStep: true },
      { number: '2d(1)(a)', text: 'Sedate the MWD, achieving appropriate sedation to facilitate intervention.', isSubStep: true },
      {
        number: '2d(1)(b)',
        text: 'Insert orotracheal intubation (OTI)/endotracheal intubation (ETI) airway or place a surgical airway.',
        isSubStep: true,
      },
      { number: '2d(1)(c)', text: 'Assess patency of intervention.', isSubStep: true },
      { number: '2d(1)(d)', text: 'Plan for maintenance of intervention.', isSubStep: true },
      { number: '2d(2)', text: 'For unconscious MWD.', isSubStep: true },
      {
        number: '2d(2)(a)',
        text: 'Perform basic airway maneuver and place in recovery position.',
        isSubStep: true,
        note: 'Clear the mouth of obstructions and grasp the tongue, gently extend out of the mouth, and pull it down over the lower jaw.',
      },
      { number: '2d(2)(b)', text: 'Consider OTI/ETI or surgical airway as needed.', isSubStep: true },
      { number: '2e', text: 'Respiration (R).', isSubStep: true },
      { number: '2e(1)', text: 'Assess for and treat penetrating chest wounds with a chest seal.', isSubStep: true },
      { number: '2e(2)', text: 'Assess for signs of bloat (GDV).', isSubStep: true },
      { number: '2e(3)', text: 'Assess for tension pneumothorax and treat IAW K9TCCC guidelines.', isSubStep: true },
      { number: '2f', text: 'Circulation (C).', isSubStep: true },
      { number: '2f(1)', text: 'Reassess sites of major hemorrhage and hemostatic interventions.', isSubStep: true },
      { number: '2f(2)', text: 'Clearly mark all tourniquets with the time of tourniquet application.', isSubStep: true },
      {
        number: '2f(3)',
        text: 'Assess for femoral pulse; if absent, obtain access.',
        isSubStep: true,
        note: 'If the pulse is absent, administer a 10-20 mL/kg bolus of crystalloid fluid and reassess. Repeat until a pulse is palpable.',
      },
      {
        number: '2f(4)',
        text: 'Obtain vascular access.',
        isSubStep: true,
        warning: 'DO NOT administer human blood products to a canine.',
      },
      { number: '2f(4)(a)', text: 'An 18-gauge IV or saline lock is preferred.', isSubStep: true },
      { number: '2f(4)(b)', text: 'If vascular access is needed but not quickly obtainable via the IV route, use the IO route.', isSubStep: true },
      {
        number: '2f(5)',
        text: 'Administer appropriate fluid/drug(s) and doses, if required within time limit.',
        isSubStep: true,
        note: 'The fluid resuscitation priority: Canine Blood Products > Crystalloids.',
      },
      { number: '2f(6)', text: 'Consider refractory shock and treat, if required.', isSubStep: true },
      { number: '2f(7)', text: 'If resuscitation is not indicated:', isSubStep: true },
      { number: '2f(7)(a)', text: 'Do not administer IV fluids immediately.', isSubStep: true },
      { number: '2f(7)(b)', text: 'Permit fluids by mouth if the casualty is conscious and can swallow.', isSubStep: true },
      { number: '2g', text: 'Hypothermia (H).', isSubStep: true },
      { number: '2g(1)', text: 'Assess for hypothermia and minimize exposure.', isSubStep: true },
      { number: '2g(2)', text: 'Employ passive/active warming measures.', isSubStep: true },
      { number: '3', text: 'Perform the PAWS algorithm.' },
      {
        number: '3a',
        text: 'Penetrating Eye Trauma (P).',
        isSubStep: true,
        caution: 'Do NOT attempt to bandage or cover the eye. Make every effort to prevent K9 from scratching at the eye. Consider sedation.',
      },
      { number: '3a(1)', text: 'Place muzzle if practical before examining the eye.', isSubStep: true },
      { number: '3a(2)', text: 'If possible, gently rinse the eye with clean water.', isSubStep: true },
      { number: '3a(3)', text: 'Ensure that oral or IV/IM antibiotics are given.', isSubStep: true },
      {
        number: '3b',
        text: 'Analgesia and Sedation/Chemical Restraint (A).',
        isSubStep: true,
        note: 'The goal of sedation/chemical restraint is to stop awareness of painful procedures and prevent injury to medical personnel while protecting K9 airway and mentation.',
        warning:
          'Medication errors can cause patient harm. Administer only medications authorized by standing orders or provider direction. Incorrect dosage or unauthorized use can cause adverse drug reactions.',
        caution: 'Improper medication dosing can be fatal - verify weight-based calculations.',
      },
      { number: '3b(1)', text: 'Mild Pain: Opioid alone (if the K9 is not irritable).', isSubStep: true },
      { number: '3b(2)', text: 'Moderate to Severe Pain.', isSubStep: true },
      { number: '3b(2)(a)', text: 'Ketamine IV/IM/IO + Opioid.', isSubStep: true },
      { number: '3b(2)(b)', text: 'Ketamine IV/IM/IO + Midazolam IV/IO/IM + Opioid.', isSubStep: true },
      { number: '3b(3)', text: 'Chemical Restraint/Sedation:', isSubStep: true },
      { number: '3b(3)(a)', text: 'Ketamine IV/IM/IO + Midazolam IV/IO/IM.', isSubStep: true },
      { number: '3b(3)(b)', text: 'Ketamine IV/IM/IO + Opioid.', isSubStep: true },
      { number: '3c', text: 'Antibiotics (A).', isSubStep: true },
      { number: '3c(1)', text: 'Recommended for all open combat wounds.', isSubStep: true },
      { number: '3c(2)', text: 'Give recommended antibiotics IAW current JTS K9 TCCC guidelines.', isSubStep: true },
      { number: '3d', text: 'Wounds (W).', isSubStep: true },
      { number: '3d(1)', text: 'Inspect and dress all wounds.', isSubStep: true },
      {
        number: '3d(2)',
        text: 'Abdominal evisceration.',
        isSubStep: true,
        danger: 'Do not attempt if there is evidence of ruptured bowel (gastric/intestinal fluid or stool leakage) or active bleeding.',
      },
      { number: '3d(2)(a)', text: 'Control bleeding: rinse with clean (and warm if possible) fluid.', isSubStep: true },
      { number: '3d(2)(b)', text: 'Hemorrhage control: combat gauze or CoTCCC recommended hemostatic dressing.', isSubStep: true },
      {
        number: '3d(3)',
        text: 'Treat for burns.',
        isSubStep: true,
        note: 'Assess and treat as a K9 trauma casualty with burns and not a burn casualty with injuries.',
      },
      {
        number: '3d(3)(a)',
        text: 'Estimate total body surface area to the nearest 10%.',
        isSubStep: true,
        note: 'K9 burn percentages (04/2025): head 14%, neck 9%, thorax 18%, abdomen 14%, thoracic limb 9% each, pelvic limb 11% each, tail and pelvis 5%.',
      },
      {
        number: '3d(3)(b)',
        text: 'Administer appropriate fluid/drug(s) and doses, if required.',
        isSubStep: true,
        caution: 'Prolonged application of ice or heat can cause tissue damage.',
      },
      { number: '3d(3)(c)', text: 'Initial aggressive hypothermia prevention.', isSubStep: true },
      {
        number: '3d(4)',
        text: 'Splint fractures and re-check distal pulses.',
        isSubStep: true,
        warning:
          'Improper assessment may delay recognition of serious injury. Failure to identify red-flag symptoms (neurological deficit, severe deformity, inability to bear weight, loss of circulation) and failure to refer to the patient promptly can result in permanent disability.',
      },
      { number: '4', text: 'Perform ongoing assessment and reassess MWD continuously for changes in condition.' },
      { number: '5', text: 'Prepare MWD for evacuation.' },
      { number: '6', text: 'Document all findings and medical care on the DD Form 3073 or electronic medical record.' },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed Care Under Fire.' },
      { number: '2', text: 'Performed tactical field care using M3ARCH algorithm.' },
      { number: '3', text: 'Performed the PAWS algorithm.' },
      { number: '4', text: 'Performed ongoing assessment and reassess MWD continuously for changes in condition.' },
      { number: '5', text: 'Prepared MWD for evacuation.' },
      { number: '6', text: 'Documented all findings and medical care on the DD Form 3073 or electronic medical record.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6'],
    knowledges: [
      { id: '081-VC-68T-KN0149', name: 'Normal canine temperature.' },
      { id: '081-VC-68T-KN0052', name: 'Know the anatomy, appearance and behavior of the species of which they are working.' },
      { id: '081-VC-68T-KN0063', name: 'Animal behavior symptoms.' },
      { id: '081-VC-68T-KN0064', name: 'Animal positioning.' },
      { id: '081-VC-68T-KN0023', name: 'Know which restraint method to apply.' },
    ],
    skills: [
      { id: '081-VC-68T-SK0155', name: 'Locate anatomical features.' },
      { id: '081-VC-68T-SK0318', name: 'Transport an animal.' },
      { id: '081-VC-68T-SK0031', name: 'How to apply a muzzle and Elizabethan collar.' },
      { id: '081-VC-68T-SK0169', name: 'Monitor an animal.' },
    ],
    references: [
      {
        refId: 'PMID: 32203614',
        refName:
          'Canine Tactical Combat Casualty Care (K9TCCC) Guidelines. Edwards TH, Palmer LE, Baxter RL, Sager TC, Coisman JG, Brown JC, George C, McGraw AC',
        required: true,
        primary: true,
      },
      { refId: 'LOCAL SOP', refName: 'LOCAL SOP', required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // VERBATIM, INCLUDING THE SOURCE'S OWN TYPOS: "hemmorhage" and "the the following" in
    // Standards, "inventions" (for interventions) in step 3 and measure 3. Left as published —
    // the packet is the approved artifact and a medic comparing this screen to the PDF must find
    // them identical. Only PDF text-layer damage is repaired (run-together words such as
    // "TacticalCombatCasualtyCare ( TCCC)"), which restores the printed page rather than editing
    // it. Title normalization stays a ROSTER-only concern (see ICTL.ts's "Cricothyriodotomy").
    taskNumber: '081-000-0125',
    title: 'Treat Massive Hemorrhage',
    status: 'Approved',
    reportDate: '2026-03-04',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic assigned to a combat or operational environment, provided with a casualty with massive hemorrhage from polytrauma, an Individual First Aid Kit (IFAK), combat medic aid bag, tourniquets, hemostatic agents, pressure dressings, necessary medical equipment and supplies. You have access to Tactical Combat Casualty Care (TCCC) guidelines and unit standard operating procedure (SOP). You may encounter hostile fire, low visibility, limited evacuation support, and high-stress conditions. This task should not be trained in MOPP 4.',
    standards:
      'Treat a massive hemmorhage in accordance with (IAW) Joint Trauma System Clinical Practice Guidelines (JTS CPGS), TCCC guidelines, unit SOP and the the following JTS skill sheets: Two-handed (windlass) tourniquet application in tactical field care (TFC), Two-handed (ratchet) tourniquet application in TFC, Improvised limb tourniquet, Wound packing and Pressure bandage, Injectable Hemostatic Sponges, Neck junctional hemorrhage control, Axillary junctional hemorrhage control, Inguinal hemorrhage control with improvised junctional pressure delivery device (PDD), junctional tourniquet, Inguinal clamp, and junctional tourniquet while adhering to all performance steps with 100% accuracy, utilizing GO/NO GO criteria.',
    specialConditions: 'None',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'None',
    remarks: 'None',
    notes:
      'This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    danger: 'None',
    warning: 'None',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    performanceSteps: [
      {
        number: '1',
        text: 'Identify massive hemorrhage during your MARCH assessment of task 081-000-0049, Perform Tactical Combat Casualty Care, while in the tactical field care phase.',
      },
      { number: '2', text: 'Control massive hemorrhage IAW with all TCCC CMC Module 06 skill sheet.' },
      { number: '2a', text: 'Extremity.', isSubStep: true },
      {
        number: '2a(1)',
        text: 'Two-handed (windlass) tourniquet application in tactical field care (TFC).',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#windlass-tourniquet',
      },
      {
        number: '2a(2)',
        text: 'Two-handed (ratchet) tourniquet application in TFC.',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#ratchet-tourniquet',
      },
      {
        number: '2a(3)',
        text: 'Improvised limb tourniquet.',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#improvised-limb-tourniquet',
      },
      {
        number: '2a(4)',
        text: 'Wound packing and pressure bandage.',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#wound-packing-pressure-bandage',
      },
      { number: '2b', text: 'Junctional.', isSubStep: true },
      {
        number: '2b(1)',
        text: 'Injectable Hemostatic Sponges.',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#injectable-hemostatic-sponges',
      },
      {
        number: '2b(2)',
        text: 'Neck junctional hemorrhage control.',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#neck-junctional',
      },
      {
        number: '2b(3)',
        text: 'Axillary junctional hemorrhage control.',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#axillary-junctional',
      },
      {
        number: '2b(4)',
        text: 'Inguinal hemorrhage control with improvised junctional pressure delivery device (PDD).',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#inguinal-pdd',
      },
      {
        number: '2b(5)',
        text: 'Inguinal combat clamp.',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#inguinal-combat-clamp',
      },
      {
        number: '2b(6)',
        text: 'Junctional tourniquet.',
        isSubStep: true,
        tcccModuleRef: 'tccc-massive-hemorrhage-control#junctional-tourniquet',
      },
      { number: '3', text: 'Reassess inventions, as needed.' },
      { number: '4', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
    ],
    performanceMeasures: [
      {
        number: '1',
        text: 'Identified massive hemorrhage during your MARCH assessment of task 081-000-0049, Perform Tactical Combat Casualty Care, while in the tactical field care phase.',
      },
      { number: '2', text: 'Controlled massive hemorrhage IAW with all TCCC CMC Module 06 skill sheet.' },
      { number: '3', text: 'Reassessed inventions as needed.' },
      { number: '4', text: 'Documented all findings and treatments on a DD Form 1380 TCCC Casualty Card and attached it to the casualty.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    tcccModuleRef: 'tccc-massive-hemorrhage-control',
    knowledges: [
      { id: '081-C2-68W-0365', name: 'Knowledge of control bleeding.' },
      { id: '081-TI-CMN-0009', name: 'Know how to check for bleeding.' },
      { id: '081-TI-CMN-0213', name: 'Know what to do if there are multiple bleeding wounds.' },
      { id: '081-TI-CMN-0061', name: 'Know how to apply manual pressure to control bleeding.' },
      { id: 'AR 40-66', name: 'Complete a DD 1380 (Tactical Combat Casualty Card)' },
      { id: '081-TI-CMN-0062', name: 'Know how to elevate an extremity to control bleeding.' },
      { id: '081-TI-CMN-0063', name: 'Know when not to elevate an extremity to control bleeding.' },
      { id: '011-1134K', name: 'Army medical/casualty evacuation' },
      { id: '081-C2-68W-0756', name: 'Knowledge of methods of emergency medical care of external bleeding.' },
      { id: '081-SR-68P-R240', name: 'Knowledge of bleeding and shock' },
    ],
    skills: [
      { id: 'S8723', name: 'Complete a DD 1380 Tactical Combat Casualty Card' },
      { id: 'S8483', name: 'Perform techniques and procedures to control casualty bleeding.' },
      { id: '081-C2-68W-0266', name: 'Demonstrate direct pressure as a method of emergency medical care of external bleeding.' },
      { id: '081-C2-68W-0315', name: 'Demonstrate the ability to comply with body substance isolation guidelines.' },
      { id: '081-C2-68W-0268', name: 'Demonstrate pressure points / tourniquets as a method of emergency care of external bleeding.' },
      { id: '081-C2-68W-0269', name: 'Demonstrate elevation techniques to control bleeding.' },
      { id: '081-C2-68W-0357', name: 'Demonstrate the techniques for assessing the casualty for external bleeding.' },
    ],
    references: [
      {
        refId: 'Module 06: Massive Hemorrhage Control in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 6',
        required: true,
        primary: true,
      },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
      { refId: 'TC 8-800', refName: 'Medical Education and Demonstration of Individual Competence (MEDIC)', required: true, primary: false },
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: false },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // Steps 3a/3a(2)/3b(1) cross-reference three OTHER ICTL tasks by number (0125, 1025, 0037)
    // rather than TCCC modules. Left as packet text — the schema has no step-level task ref.
    taskNumber: '081-000-0231',
    title: 'Treat a Patient Suspected of Shock',
    status: 'Approved',
    reportDate: '2026-03-02',
    proponentMos: '68W',
    conditions:
      'You are a medic in an operational or garrison environment. You have a patient exhibiting signs of shock while conducting your MARCH PAWS assessment. You are provided with personal protective equipment, hemorrhage control equipment, IV or IO supplies, IV fluids (crystalloids), blood products (whole blood, packed red blood cells, plasma) if available, tranexamic acid (TXA), needle decompression equipment, hypothermia prevention equipment, pulse oximeter, blood pressure cuff, stethoscope, ammonia inhalants and a DD Form 1380 TCCC Card, TCCC Guidelines, Combat Medic Specialist Fieldcraft and unit medical protocols. This task should not be trained in MOPP 4.',
    standards:
      'Treat a patient suspected of shock in accordance with current TCCC Guidelines and Combat Medic Specialist Fieldcraft by identifying the type of shock, implementing appropriate interventions for the identified shock type, maintaining permissive hypotension (palpable radial pulse or systolic for patients with or without TBI), preventing hypothermia, reassessing patient status, and documenting all assessments and interventions on DD Form 1380 TCCC Card, and performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions:
      'This task may be performed during limited visibility conditions. This task may be performed as a single-patient or multiple-patient scenario. This task requires integration of multiple TCCC skill sheets. Task performance in MOPP 4 is not authorized. Trainers must ensure current TCCC guidelines from Joint Trauma System are used.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient exhibiting signs of shock following trauma and requires immediate medical intervention.',
    danger:
      'Uncontrolled hemorrhage results in death from hemorrhagic shock within minutes. Failure to control massive bleeding is the leading cause of preventable battlefield death. Tension pneumothorax causes cardiovascular collapse and death if not immediately decompressed. Delayed recognition or treatment is fatal. Over-resuscitation with IV fluids causes dilutional coagulopathy, hypothermia, and increased bleeding leading to death. Follow permissive hypotension guidelines strictly. Failure to prevent and treat hypothermia in shock patients significantly increases mortality.',
    warning:
      'Improper shock management worsens patient condition or causes death. Do not delay hemorrhage control to establish IV access. Bleeding control is the priority in hemorrhagic shock. Reassess tourniquet effectiveness continuously. Loosening or ineffective tourniquets result in continued blood loss and shock progression. Continuously monitor for tension pneumothorax progression as it may require immediate needle decompression. Deteriorating mental status indicates inadequate resuscitation or evolving complications. All trauma patients in shock are at risk for hypothermia regardless of ambient temperature. Aggressively prevent and treat as it significantly impacts survival.',
    caution:
      'All body fluids should be considered potentially infectious. Observe body substance isolation precautions by wearing gloves and eye protection as minimum standard. Do not apply active warming blankets directly to skin. Place barrier between warming device and patient to prevent burns. Saline lock IV access is preferred over continuous infusion. This prevents accidental fluid over-resuscitation. Follow proper aseptic technique for IO access. Contaminated insertion causes osteomyelitis. Monitor IV/IO insertion sites for infiltration and extravasation. This causes tissue damage and ineffective resuscitation. Document exact times of all interventions. This is critical for receiving facility continuity of care and medication timing. Ensure blood products are properly typed and cross-matched when available. Transfusion reactions worsen shock. Keep patient dry and shielded from wind and cold. Environmental exposure accelerates hypothermia.',
    remarks:
      'Shock is a life-threatening condition characterized by inadequate tissue perfusion and oxygenation. Hemorrhagic shock from uncontrolled bleeding is the leading cause of preventable death on the battlefield. Early recognition and aggressive treatment of shock significantly improves survival. The three primary types of shock encountered in tactical environments are hemorrhagic, obstructive, and neurogenic.',
    notes:
      'Training must be conducted on high-fidelity patient simulators capable of presenting realistic shock physiology including vital sign changes, skin signs, and mental status alterations. Practice under various conditions including limited visibility, and simulated combat stress. Include scenarios with multiple shock types and patients requiring triage. Emphasize proper hemorrhage control before fluid resuscitation. Teach recognition of tension pneumothorax and needle decompression indications. Practice permissive hypotension principles and appropriate blood pressure target ranges for TBI patients. This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    performanceSteps: [
      { number: '1', text: 'Assess the patient for signs of shock.' },
      { number: '1a', text: 'Evaluate mental status using AVPU scale.', isSubStep: true },
      { number: '1b', text: 'Check pulse quality, rate, and skin signs.', isSubStep: true },
      { number: '1c', text: 'Identify respiratory distress or abnormal breathing patterns.', isSubStep: true },
      { number: '1d', text: 'Monitor for obvious bleeding, penetrating trauma, or spinal injury indicators.', isSubStep: true },
      { number: '2', text: 'Identify the likely type of shock based on mechanism of injury and signs/symptoms.' },
      { number: '2a', text: 'Hemorrhagic Shock.', isSubStep: true },
      { number: '2a(1)', text: 'History of trauma with blood loss.', isSubStep: true },
      { number: '2a(2)', text: 'Tachycardia, weak or absent radial pulse.', isSubStep: true },
      { number: '2a(3)', text: 'Altered mental status not due to TBI.', isSubStep: true },
      { number: '2a(4)', text: 'Cool, pale, clammy skin.', isSubStep: true },
      { number: '2b', text: 'Obstructive Shock.', isSubStep: true },
      { number: '2b(1)', text: 'Tension pneumothorax.', isSubStep: true },
      { number: '2b(1)(a)', text: 'Severe respiratory distress.', isSubStep: true },
      { number: '2b(1)(b)', text: 'Unilateral breath sounds.', isSubStep: true },
      { number: '2b(1)(c)', text: 'Tracheal deviation (late)', isSubStep: true },
      { number: '2b(1)(d)', text: 'Jugular venous distention (may be absent in hypovolemia).', isSubStep: true },
      { number: '2b(2)', text: 'Cardiac tamponade (recognition only).', isSubStep: true },
      { number: '2b(2)(a)', text: 'Penetrating chest trauma.', isSubStep: true },
      { number: '2b(2)(b)', text: 'Muffled heart tones (if detectable).', isSubStep: true },
      { number: '2b(2)(c)', text: 'Hypotension.', isSubStep: true },
      { number: '2b(2)(d)', text: 'Distended neck veins.', isSubStep: true },
      { number: '2c', text: 'Neurogenic Shock.', isSubStep: true },
      { number: '2c(1)', text: 'Suspected spinal injury.', isSubStep: true },
      { number: '2c(2)', text: 'Hypotension with bradycardia.', isSubStep: true },
      { number: '2c(3)', text: 'Warm, dry skin below injury level.', isSubStep: true },
      { number: '3', text: 'Treat the identified shock type according to TCCC guidelines and Combat Medic Specialist Fieldcraft Book.' },
      { number: '3a', text: 'Hemorrhagic Shock IAW TCCC Guidelines with Treat Massive Hemorrhage Task ID:081-000-0125.', isSubStep: true },
      { number: '3a(1)', text: 'Control all external bleeding.', isSubStep: true },
      {
        number: '3a(2)',
        text: 'Initiate fluid resuscitation IAW with Administer Blood Products Task ID 081-000-1025.',
        isSubStep: true,
        note: 'Whole blood is preferred.',
      },
      { number: '3a(3)', text: 'Maintain permissive hypotension IAW TCCC guidelines.', isSubStep: true },
      { number: '3b', text: 'Obstructive Shock IAW TCCC Guideline.', isSubStep: true },
      { number: '3b(1)', text: 'Tension pneumothorax: treat IAW with Treat a Patient With Chest Injury task ID 081-000-0037.', isSubStep: true },
      { number: '3b(2)', text: 'Reassess for improvement in breathing and perfusion.', isSubStep: true },
      { number: '3b(3)', text: 'Cardiac tamponade: recognize and expedite evacuation; supportive care only.', isSubStep: true },
      { number: '3c', text: 'Neurogenic Shock IAW JTS CPG 63.', isSubStep: true },
      { number: '3c(1)', text: 'Maintain spinal precautions.', isSubStep: true },
      { number: '3c(2)', text: 'Support airway and breathing.', isSubStep: true },
      { number: '3c(3)', text: 'Monitor perfusion and prepare for evacuation.', isSubStep: true },
      {
        number: '4',
        text: 'Prevent hypothermia IAW JTS TCCC CMC Module 12: Hypothermia Prevention and Treatment skill sheets.',
        tcccModuleRef: 'tccc-hypothermia-prevention-treatment',
      },
      { number: '4a', text: 'Use a hypothermia prevention system or improvised insulation.', isSubStep: true },
      {
        number: '4b',
        text: 'Keep the casualty dry and shielded from wind and cold.',
        isSubStep: true,
        note: 'ALL trauma casualties in shock are at risk for hypothermia regardless of ambient temperature. Aggressively treat hypothermia as it significantly impacts survival.',
      },
      { number: '5', text: 'Perform continuous reassessment and monitoring.' },
      { number: '5a', text: 'Monitor mental status, pulse, respirations, and bleeding control.', isSubStep: true },
      { number: '5b', text: 'Reassess interventions (tourniquets, decompression, fluids).', isSubStep: true },
      { number: '6', text: 'Document care on DD 1380 (TCCC Card) or unit-approved documentation.' },
      { number: '6a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '6b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Assessed the patient for signs of shock.' },
      { number: '2', text: 'Identified the likely type of shock based on mechanism of injury and signs/symptoms.' },
      { number: '3', text: 'Treated the identified shock type according to TCCC guidelines and Combat Medic Specialist Fieldcraft Book.' },
      { number: '4', text: 'Prevented hypothermia IAW JTS TCCC CMC Module 12: Hypothermia Prevention and Treatment skill sheets.' },
      { number: '5', text: 'Performed continuous reassessment and monitoring.' },
      { number: '6', text: 'Documented care on DD 1380 (TCCC Card) or unit-approved documentation.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6'],
    knowledges: [
      { id: '081-TI-CMN-0226', name: 'Know how to insert a nasopharyngeal airway (NPA).' },
      { id: '081-VC-68T-KN0085', name: 'Causes of hypovolemic shock.' },
      { id: '081-VC-68T-KN0215', name: 'Signs/symptoms of hypovolemic shock.' },
    ],
    skills: [{ id: '081-VC-68T-SK0284', name: 'Recognize the clinical signs of hypovolemic shock.' }],
    references: [
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: true },
      { refId: 'ATP 4-02.5', refName: 'CASUALTY CARE', required: true, primary: false },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'ISBN: 9781737131113', refName: 'Combat Medic Specialist Fieldcraft', required: true, primary: false },
      {
        refId: 'Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 11',
        required: true,
        primary: false,
      },
      {
        refId: 'Module 12: Hypothermia Prevention & Treatment',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 12',
        required: true,
        primary: false,
      },
    ],
    prerequisiteTasks: ['081-000-0238'],
    supportingTasks: [],
  },
  {
    // Verbatim per the 081-000-0125 note, so the source's own typos stand: "Bouige-Aided" in
    // Standards, "This procedures is a contraindicated" in Special Conditions, and the trailing
    // comma on step 6b. Title is the packet's — the roster in ICTL.ts carries "Perform a Surgical
    // Cricothyroidotomy" with its own spelling fix, which is a roster-only concern.
    taskNumber: '081-000-0122',
    title: 'Perform Surgical Cricothyroidotomy',
    status: 'Approved',
    reportDate: '2026-03-04',
    proponentMos: '68W',
    conditions:
      'You are treating a trauma patient in an operational or garrison environment, during the Airway assessment of MARCH PAWS. You determined your patient requires a surgical cricothyroidotomy due to complete airway obstruction that cannot be managed by other means. You have access to surgical cricothyroidotomy equipment including: scalpel or Cric-Knife, tracheal hook, bougie, endotracheal tubes (6.0-7.0mm) or tracheostomy tubes, tube securing device (commercial or improvised), capnography equipment (colorimetric device, EMMA capnograph, or waveform capnography), bag-valve-mask (BVM), stethoscope, pulse oximeter, 10cc syringe for cuff inflation, alcohol swabs or antiseptic, sterile gauze (2x2 and 4x4), medical tape, personal protective equipment (gloves, eye protection), and a light source. You have access to TCCC CMC Module 07: Airway Management in TFC - Cricothyrotomy skill sheets. This task should not be trained in MOPP 4.',
    standards:
      'Perform a surgical cricothyroidotomy in accordance with (IAW) TCCC CMC Module 07: Airway Management in TFC - Cricothyroidotomy Skill Sheets (Bouige-Aided, Open Surgical or Cric-key) and current Joint Trauma System (JTS) Committee on Tactical Combat Casualty Care (CoTCCC) guidelines. Perform all steps with 100% accuracy using the task GO/NO-GO criteria without causing additional injury to the patient. This task will be evaluated on airway manikins.',
    specialConditions:
      'Task requires prior training, demonstrated proficiency on high-fidelity airway manikins. Task performed only when all other airway management techniques have failed and casualty will die without immediate surgical airway. This procedures is a contraindicated in children under 12 years old.',
    safetyRisk: 'Medium',
    mopp4: 'Never',
    cue: 'Patient with complete airway obstruction who cannot be ventilated by other means.',
    danger:
      'Incorrect identification of the cricothyroid membrane can sever major neck vessels causing massive hemorrhage and death. Cutting too deep or lateral can sever carotid arteries or jugular veins resulting in rapid exsanguination and death. Inserting the tube into a false passage or through the posterior tracheal wall results in airway obstruction and death. Failure to confirm proper tube placement can result in unrecognized esophageal intubation causing death from hypoxia.',
    warning:
      'Maintain inline stabilization in suspected cervical spine injury. Do not hyperextend the neck. Control vertical skin incision depth, excessive depth damages underlying structures. Cutting too high damages vocal cords. Cutting too low damages tracheal rings. Reassess tube placement every time the patient is moved, as dislodgement can result in a loss of airway and rapid deterioration. Procedure has significant complications including hemorrhage, subcutaneous emphysema, pneumothorax, infection, and tracheal stenosis.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection. Use tracheal hook to stabilize opening - prevents loss of airway access during tube insertion. Inadequate tube securement can result in dislodgement during patient movement.',
    remarks:
      'Correct identification of the cricothyroid membrane is critical to avoid damaging vocal cords, tracheal rings, or major blood vessels. Confirm tube placement using multiple methods. Common complications include hemorrhage, subcutaneous emphysema, pneumothorax, tube misplacement, and infection. Extensive training on manikins is required before performing the procedure on patients.',
    notes:
      'Training must be conducted on high-fidelity airway manikins specifically designed for cricothyroidotomy practice. Practice under various conditions including limited visibility, simulated combat stress, full PPE, and difficult anatomy scenarios (obese patients, short necks, anatomical variations). Teach recognition of complications and corrective actions. Maintain strict accountability of training equipment including scalpels and blades.',
    performanceSteps: [
      {
        number: '1',
        text: 'Assess need for surgical cricothyroidotomy during Airway management.',
        note: 'Cricothyroidotomy is indicated for maxillofacial injuries that include partial or complete airway obstruction and after verifying the failure of other airway management techniques (e.g., basic airway maneuvers, supraglottic airways, endotracheal intubation).',
      },
      { number: '2', text: 'Confirm complete airway obstruction or impending obstruction.' },
      {
        number: '3',
        text: 'Select Cricothyroidotomy technique IAW TCCC CMC Module 7: Airway Management in TFC Skill Sheet.',
        note: 'Complete at least one of the following Cricothyroidotomy skill sheets.',
      },
      { number: '3a', text: 'Cricothyroidotomy - Bougie-Aided', isSubStep: true, tcccModuleRef: 'tccc-airway-management-tfc#bougie-aided' },
      { number: '3b', text: 'Cricothyroidotomy - Open Surgical', isSubStep: true, tcccModuleRef: 'tccc-airway-management-tfc#open-surgical' },
      { number: '3c', text: 'Cricothyroidotomy', isSubStep: true, tcccModuleRef: 'tccc-airway-management-tfc#cric-key' },
      { number: '4', text: 'Perform cricothyroidotomy IAW TCCC CMC Module 7 skill sheets.' },
      { number: '5', text: 'Perform reassessment of airway status.' },
      { number: '5a', text: 'Reassess SpO2, EtCO2, and airway patency.', isSubStep: true },
      { number: '5b', text: 'Provide interventions based on vital sign ranges.', isSubStep: true },
      { number: '6', text: 'Document care on DD 1380 (TCCC Card) or unit-approved documentation.' },
      { number: '6a', text: 'Record all finding and treatment.', isSubStep: true },
      { number: '6b', text: 'Ensure documentation is complete, accurate, and timely,', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Assessed need for surgical cricothyroidotomy during Airway management.' },
      { number: '2', text: 'Confirmed complete airway obstruction or impending obstruction.' },
      { number: '3', text: 'Selected Cricothyroidotomy technique IAW TCCC CMC Module 7: Airway Management in TFC Skill Sheet.' },
      { number: '4', text: 'Performed cricothyroidotomy IAW TCCC CMC Module 7 skill sheets.' },
      { number: '5', text: 'Performed reassessment of airway status.' },
      { number: '6', text: 'Documented care on DD 1380 (TCCC Card) or unit-approved documentation.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6'],
    tcccModuleRef: 'tccc-airway-management-tfc',
    knowledges: [
      { id: '081-C2-68W-0350', name: 'Describe equipment and technique for performing an open cricothyrotomy.' },
      { id: 'K23740', name: 'Knowledge of advanced airway management devices and techniques' },
      { id: '081-C2-68W-0323', name: 'Describe indications for a needle/surgical cricothyroidotomy.' },
      { id: '081-VC-68T-KN0017', name: 'Know how to calculate pulse and respiration readings' },
      { id: '081-C2-68W-0294', name: 'Describe modified forms of respiration.' },
      { id: '081-C2-68W-0358', name: 'Defend the need to oxygenate and ventilate a patient.' },
      { id: '081-C2-68W-0105', name: 'Describe proper positioning of the patient.' },
    ],
    skills: [
      { id: '081-VC-68T-SK0259', name: 'Put on surgical gloves.' },
      { id: '081-C2-68W-0416', name: 'Demonstrate the ability to provide respiratory support.' },
      { id: '081-C2-68W-0098', name: 'Perform a needle/surgical cricothyroidotomy.' },
      { id: '081-C2-68W-0165', name: 'Assess and treat a casualty with respiratory problems.' },
      { id: '081-C2-68W-0181', name: 'Use proper equipment to assess a casualty complaining of respiratory problems.' },
      { id: 'S3144', name: 'Performing an open cricothyrotomy' },
    ],
    references: [
      {
        refId: 'Module 07: Airway Management in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 7',
        required: true,
        primary: true,
      },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'Deployed Medicine', refName: 'Standardized TCCC Training Across The Entire U.S. Military', required: true, primary: false },
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // Verbatim per the 081-000-0125 note: "causalities" and "Guidelines guidelines" in Conditions
    // are the packet's own. TAB C of the JTS memo records TCCC-CMC skills met = N/A for this ICT
    // ("does not include casualty collection point measures"), which is why it has no module ref.
    taskNumber: '081-000-0055',
    title: 'Perform Casualty Triage',
    status: 'Approved',
    reportDate: '2026-03-02',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic assigned to a combat or operational environment. You encounter an incident resulting in multiple causalities requiring immediate casualty triage for maximum patient survivability. You have access to multiple Individual First Aid Kits (IFAK), combat medic aid bag, triage tags, and necessary medical equipment/supplies. You have access to Tactical Combat Casualty Care (TCCC) Guidelines guidelines and unit SOP. You may encounter hostile fire, low visibility, limited evacuation support, and high-stress conditions. This task should not be trained in MOPP 4. This task should be trained under IED Threat conditions.',
    standards:
      'Perform casualty triage in accordance with TCCC Guidelines, while adhering to all performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions: 'None',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'None',
    danger: 'None.',
    warning: 'None.',
    caution:
      'All body fluids should be considered potentially infectious. Always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    remarks:
      'This task should be performed under all environmental conditions. Four or more operational variables of political, military, economic, social, information, infrastructure, physical environment, time should be present. All authorized equipment is on hand and operational. All personnel are available to provide support during operations. Some iterations of this task should be performed with degraded mission command networks, degraded conditions in the electromagnetic spectrum, and/or with degraded, denied, and disrupted space operations environment (D3SOE).',
    notes:
      'This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform first-pass triage.',
        note: 'Rapidly assess all casualties to identify those requiring immediate lifesaving interventions and sort casualties into two categories.',
      },
      {
        number: '1a',
        text: 'Urgent.',
        isSubStep: true,
        note: 'Casualties who are dying now and require immediate lifesaving interventions to survive. Examples: massive hemorrhage, airway obstruction, tension pneumothorax, severe shock.',
      },
      {
        number: '1b',
        text: 'Nonurgent.',
        isSubStep: true,
        note: 'Casualties who do not require immediate lifesaving interventions, but still need medical care. Examples: controlled bleeding, minor wounds, stable fractures.',
      },
      {
        number: '1c',
        text: 'Move casualties identified as expectant during first pass triage to the designated expectant area for comfort focused care; see task 081-000-0108, Treat an Expectant Patient.',
        isSubStep: true,
      },
      {
        number: '2',
        text: 'Perform second-pass triage.',
        note: 'After initial lifesaving care and once the tactical situation allows, conduct more detailed triage and sort casualties into urgent, priority, and routine evacuation categories.',
      },
      {
        number: '2a',
        text: 'Urgent.',
        isSubStep: true,
        note: 'High-priority casualties with severe or critical life-threatening injuries. Survival depends on immediate surgery, rapid damage control resuscitation, or advanced medical treatment.',
      },
      {
        number: '2b',
        text: 'Priority.',
        isSubStep: true,
        note: 'Medium-priority casualties with serious injuries or illness requiring surgery or advanced treatment at a delayed time. Includes limb-threatening or vision-threatening injuries.',
      },
      {
        number: '2c',
        text: 'Routine.',
        isSubStep: true,
        note: 'Low-priority casualties with minimal injuries or illness. Includes expectant casualties for whom lifesaving interventions will be minimized due to resource limitations. See task 081-000-0108 for expectant patient care.',
      },
      { number: '3', text: 'Establish casualty count.' },
      { number: '3a', text: 'Track casualties by:', isSubStep: true },
      { number: '3a(1)', text: 'Precedence category (urgent, priority, routine).', isSubStep: true },
      { number: '3a(2)', text: 'Patient type (ambulatory, litter, expectant, etc.).', isSubStep: true },
      { number: '3b', text: 'Use this information to:', isSubStep: true },
      { number: '3b(1)', text: 'Determine resource allocation.', isSubStep: true },
      { number: '3b(2)', text: 'Support evacuation planning.', isSubStep: true },
      { number: '3b(3)', text: 'Maintain accountability.', isSubStep: true },
      { number: '4', text: 'Communicate casualty status.' },
      { number: '4a', text: 'Provide timely and accurate updates to:', isSubStep: true },
      { number: '4a(1)', text: 'Leaders.', isSubStep: true },
      { number: '4a(2)', text: 'Medical personnel.', isSubStep: true },
      { number: '4a(3)', text: 'Responders.', isSubStep: true },
      { number: '4b', text: 'Communicate:', isSubStep: true },
      { number: '4b(1)', text: 'Casualty categories.', isSubStep: true },
      { number: '4b(2)', text: 'Treatments rendered.', isSubStep: true },
      { number: '4b(3)', text: 'Evacuation requirements.', isSubStep: true },
      { number: '4b(4)', text: 'Changes in condition.', isSubStep: true },
      {
        number: '4c',
        text: 'These reports support tactical, logistical, and medical decision-making throughout all phases of TCCC.',
        isSubStep: true,
      },
      { number: '5', text: 'Manage weapons and communications equipment.' },
      { number: '5a', text: 'For casualties with altered mental status due to injury, illness, or analgesia:', isSubStep: true },
      { number: '5a(1)', text: 'Disable or remove weapons.', isSubStep: true },
      { number: '5a(2)', text: 'Secure communication equipment.', isSubStep: true },
      { number: '5b', text: 'Prevent accidental discharge or compromise of sensitive information.', isSubStep: true },
      {
        number: '6',
        text: 'Continually reassess casualty and situation.',
        note: 'Triage and TCCC phases are fluid. A casualty may shift between categories or phases as conditions change, so reassessment is constant.',
      },
      { number: '6a', text: 'Reassess casualties frequently during:', isSubStep: true },
      { number: '6a(1)', text: 'Care under fire.', isSubStep: true },
      { number: '6a(2)', text: 'Tactical field care.', isSubStep: true },
      { number: '6a(3)', text: 'Tactical evacuation care.', isSubStep: true },
      { number: '6b', text: 'Update triage categories as conditions change.', isSubStep: true },
      { number: '6c', text: 'Adjust evacuation priorities as assets become available or the tactical situation shifts.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed first-pass triage.' },
      { number: '2', text: 'Performed second-pass triage.' },
      { number: '3', text: 'Established casualty count.' },
      { number: '4', text: 'Communicated casualty status.' },
      { number: '5', text: 'Managed weapons and communications equipment.' },
      { number: '6', text: 'Continually reassessed casualty and situation.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6'],
    knowledges: [
      { id: 'K22778', name: 'Knowledge of problems caused by inadequate triage of a patient prior to air transport' },
      { id: '081-ZG-CMM-1013', name: 'Identify MASCAL triage codes' },
      { id: 'K31162', name: 'Identify requirements for setting up a trauma triage area.' },
      { id: '081-C2-68W-0722', name: 'Knowledge of triage category priority' },
      { id: '081-C2-68W-0363', name: 'Knowledge of triage.' },
    ],
    skills: [
      { id: '081-C2-68W-0442', name: 'Given a scenario of a mass casualty incident, perform triage.' },
      { id: '081-C2-68W-0443', name: 'Fill out and attach triage tags. (Field Medical Cards)' },
      { id: '081-C2-68W-0404', name: 'Demonstrate the ability to triage casualties.' },
    ],
    references: [
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: true, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
      { refId: 'ATP 4-02.2', refName: 'Medical Evacuation', required: true, primary: false },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'ISBN-13: 978-1284180589', refName: 'Prehospital Trauma Life Support, Military Edition, 9th Edition', required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: ['081-000-0108'],
  },
  {
    // Verbatim per the 081-000-0125 note: measure 6 reads "Refered", step 5's note reads "authorized
    // Health personal", and step 6's note closes with a stray quotation mark. All as published.
    taskNumber: '081-68W-0246',
    title: 'Manage a Patient with a Behavioral Health Emergency',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a medic in a garrison or operational environment and have completed Task# 081-68W-0250 (Treat a Patient with a General Medical Complaint) during which you have identified a patient with a suspected behavioral health (BH) emergency that requires examination. The patient presents as a risk for suicide, homicide, or domestic violence. All immediate life threats are addressed. You are equipped with, JTS CPGs including: Guideline for Forward Management of Acute Behavioral Health Conditions by Non-Specialty Medical Personnel, a pen, an SF 600 form, communication tools (radio or telephone), unit SOPs, and restraint equipment if authorized by local policy. This task should not be trained in MOPP 4.',
    standards:
      'Manage a patient with behavioral health emergency IAW JTS CPGs, clinical guidelines and unit protocols. Behavioral emergency is recognized. Factors altering patient behavior are identified. Patient history is obtained including risk assessment. Scene and personal safety are maintained. Patient is managed using de-escalation techniques. Family/domestic violence risk assessment is completed if indicated. All findings are documented on SF 600. Patient is referred to medical provider or behavioral health services as appropriate',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task may involve patients presenting suicidal/homicidal ideation, severe agitation, or psychosis across all age groups. Task requires access to JTS CPG for behavioral health management, communication equipment, and restraint equipment per local policy. Task involves potential for violence requiring scene safety assessment, buddy system, and weapon removal. Task requires coordination with behavioral health providers, chaplain, command, and law enforcement as appropriate.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You have completed task 081-68W-0250 (Treat a Patient With General Medical Complaint) and encounter a patient who presents with a behavioral health emergency requiring immediate management and safety assessment.',
    danger:
      'Patients with behavioral health emergencies may become violent without warning. Maintain safe distance and clear exit route. Never turn your back on agitated patients. Do not attempt to restrain violent patients alone.',
    warning:
      'Be alert for personal safety or scene safety problems while providing treatment for a behavioral emergency. Do not isolate yourself from other sources of help.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    remarks:
      'This task is critical for identifying and managing behavioral health emergencies that may pose risk to patient or others. Medics must maintain scene safety while providing compassionate care. Early recognition and appropriate referral improves outcomes.',
    notes:
      'Behavioral health emergencies may have medical causes that must be ruled out. Maintain patient dignity and confidentiality. Document all risk assessments thoroughly. Never leave high-risk patients unattended. Coordinate with behavioral health providers and command as appropriate.',
    performanceSteps: [
      { number: '1', text: 'Perform scene size up.' },
      { number: '1a', text: 'Remove weapons.', isSubStep: true },
      { number: '1b', text: 'Keep buddy with patient.', isSubStep: true },
      { number: '2', text: 'Recognize a BH emergency.' },
      { number: '2a', text: 'Consider medical, psychological and situational contributors to altered behavior.', isSubStep: true },
      { number: '2a(1)', text: 'Operational stress.', isSubStep: true },
      {
        number: '2a(1)(a)',
        text: 'Intense or prolonged operational tempo (including minimal sleep, long-duration missions, repeated exposure to threats).',
        isSubStep: true,
      },
      {
        number: '2a(1)(b)',
        text: 'Exposure to traumatic events (witnessing casualties, handing remains, involvement in MASCAL events).',
        isSubStep: true,
      },
      { number: '2a(2)', text: 'Loss, separation, or disruption of unit cohesion.', isSubStep: true },
      { number: '2b', text: 'Signs and symptoms of physiological causes of behavioral emergencies.', isSubStep: true },
      { number: '3', text: 'Manage the behavioral emergency' },
      { number: '3a', text: 'Perform iCOVER steps for acute stress reaction.', isSubStep: true },
      { number: '3b', text: 'Use Psychological First Aid principles to promote calm, safety, and connectedness.', isSubStep: true },
      { number: '3c', text: 'Do not argue with delusions or hallucinations.', isSubStep: true },
      { number: '3d', text: 'Do not leave high-risk patients alone.', isSubStep: true },
      {
        number: '3e',
        text: 'Refer to medical provider or ancillary services as soon as possible.',
        isSubStep: true,
        note: 'Resources include: Chaplain, Behavioral Health Services (ie BH Technician (68X), Unit Behavioral Health Officer, Combat Operational Stress Control element at role 2 or role 3, etc, psych NP, psychiatrist, psych PA, and/or OT/OTAs.)',
      },
      { number: '4', text: 'Obtain a patient history.' },
      { number: '4a', text: 'Perform BH focused primary survey.', isSubStep: true },
      { number: '4a(1)', text: 'Observe appearance and behavior.', isSubStep: true },
      { number: '4a(2)', text: 'Perform Columbia Suicide Severity Scale (C-SSRS).', isSubStep: true },
      { number: '4b', text: 'Perform BH focused secondary survey.', isSubStep: true },
      { number: '4b(1)', text: 'Observe appearance and behavior.', isSubStep: true },
      { number: '4b(2)', text: 'Hx of BH treatment.', isSubStep: true },
      { number: '4b(3)', text: 'Prior suicide attempts/ hospitalizations.', isSubStep: true },
      { number: '4b(4)', text: 'Access to weapons/ means of achieving suicidal/homicidal intent.', isSubStep: true },
      { number: '4c', text: 'Identify if speech and thought are organized or disorganized.', isSubStep: true },
      {
        number: '5',
        text: 'Perform BH risk assessment.',
        note: 'If patient answers yes to any of the questions below notify authorized Health personal immediately',
      },
      { number: '5a', text: 'Assess for suicidal ideations.', isSubStep: true },
      { number: '5b', text: 'Assess for homicidal ideations.', isSubStep: true },
      { number: '5c', text: 'Assess for harm of self or others.', isSubStep: true },
      { number: '5d', text: 'Assess for hallucinations.', isSubStep: true },
      { number: '5e', text: 'Assess for delusions.', isSubStep: true },
      {
        number: '6',
        text: 'Refer patient to higher level of care, as needed.',
        note: 'Refer patient to a higher level of care or supervising medical provider as soon as possible, in accordance with unit SOP. For emergencies involving suicidal ideation, homicidal ideation, hallucinations, delusions, or severe agitation, notify provider and CoC immediately and arrange for evacuation to higher level of care if indicated.”',
      },
      { number: '7', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '7a', text: 'Record all findings, referrals, and treatment.', isSubStep: true },
      { number: '7b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed scene size up.' },
      { number: '2', text: 'Recognized a BH emergency.' },
      { number: '3', text: 'Managed the behavioral emergency' },
      { number: '4', text: 'Obtained a patient history.' },
      { number: '5', text: 'Performed BH risk assessment.' },
      { number: '6', text: 'Refered patient to higher level of care, as needed.' },
      { number: '7', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7'],
    knowledges: [
      { id: 'K23484', name: 'Knowledge of the signs and symptoms of behavioral disorders' },
      { id: 'K22076', name: 'Know how to assist command with behavioral health concerns' },
      { id: 'K22061', name: 'Knowledge of barriers to behavioral health care' },
      { id: '081-C2-68W-0276', name: 'Discuss considerations for assessing a casualty with behavioral problems.' },
      { id: 'K23482', name: 'Knowledge of assessment and management of common behavioral disorders' },
      {
        id: 'K23948',
        name: 'Combat and Operational Stress Control (COSC) Focus Groups and Panel Discussion (Behavioral Health and Unit Ministry Team)',
      },
    ],
    skills: [
      { id: '081-C2-68W-0090', name: 'Assess and provide emergency medical care to a casualty with a behavioral emergency.' },
      { id: 'S8487', name: 'Perform procedures for treating a behavioral emergency.' },
    ],
    references: [
      {
        refId: 'ISBN-13: 978-1496379948',
        refName: 'Lippincott Manual of Nursing Practice Eleventh, North American Edition',
        required: true,
        primary: true,
      },
      { refId: 'AR 600-63', refName: 'Army Health Promotion', required: true, primary: false },
      { refId: 'CLINIC SOP', refName: 'Clinic SOP', required: true, primary: false },
      { refId: 'PAM 600-24', refName: 'Health Promotion, Risk Reduction, and Suicide Prevention', required: true, primary: false },
      {
        refId: 'RTO WRAIR',
        refName: 'Behavioral Health (MEDCOM) Resources for download',
        required: true,
        primary: false,
        source: 'https://www.rto.wrair.army.mil/bhr.html',
      },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    taskNumber: '081-68W-0245',
    title: 'Treat a Patient With Cardiorespiratory Complaint',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a Combat Medic (68W) in an operational or garrison environment providing patient care. A patient presents with a cardiorespiratory complaint of shortness of breath or chest pain. You have completed task 081-68W-0250 (Treat a Patient with a General Medical Complaint). You have access to a stethoscope, sphygmomanometer, airway adjuncts, oxygen delivery equipment, cardiac monitoring equipment, medications per ADTMC protocols, and documentation materials. This task should not be trained in MOPP 4.',
    standards:
      'Treat a patient with cardiorespiratory complaint using appropriate ADTMC protocol (D-1 Shortness of Breath or D-2 Chest Pain). Determine appropriate patient disposition. Complete documentation IAW MEDCOM Pam 40-7-21 and local SOP. All critical steps performed correctly as measured by GO/NO-GO performance measures. Patient condition stabilized or appropriately evacuated for higher level of care.',
    specialConditions:
      'Task may be performed in field or clinical environment. Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to ADTMC protocols and medical equipment. This task is not trained in MOPP4 due to requirement for fine motor skills and patient assessment procedures that cannot be effectively performed in full MOPP.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You have completed task 081-68W-0250 (Treat a Patient With General Medical Complaint) and encounter a patient who presents with cardiorespiratory complaints requiring assessment and treatment.',
    remarks: 'None',
    notes: 'None',
    danger:
      'Failure to recognize and treat acute myocardial infarction can result in patient death. Immediate recognition and treatment per ADTMC protocol is critical. Administering medications without verifying patient allergies, current medications, and contraindications can result in serious harm or death. Failure to maintain airway, breathing, and circulation in deteriorating cardiorespiratory patients can result in death. Continuously monitor patient status and be prepared to initiate advanced life support',
    warning:
      'Chest pain may indicate life-threatening conditions. Treat all chest pain as potentially life-threatening. Shortness of breath may rapidly progress to respiratory failure. Continuously monitor respiratory status. Obtain baseline vital signs before administering cardiac medications to avoid masking deterioration. Maintain body substance isolation precautions. Cardiorespiratory patients may have infectious etiologies',
    caution:
      'Document exact time of symptom onset for chest pain patients. This information is critical for treatment decisions at higher echelons of care. Reassess vital signs and patient condition after each intervention. Failure to reassess may result in missed deterioration. Ensure oxygen delivery equipment is functioning properly before application. Verify oxygen flow rate matches prescribed delivery method. Ensure proper skin preparation and electrode placement when applying cardiac monitoring equipment for accurate readings.',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform focused assessment using appropriate ADTMC protocol for cardiorespiratory complaints.',
        note: 'Select and apply applicable protocol(s) from D1-D2 based on patient presentation.',
      },
      { number: '1a', text: "Identify and verbalize selected ADTMC protocol based on patient's chief complaint.", isSubStep: true },
      { number: '1a(1)', text: 'D-1: Shortness of Breath.', isSubStep: true },
      { number: '1a(2)', text: 'D-2: Chest Pain.', isSubStep: true },
      { number: '1b', text: "Apply correct ADTMC protocol based on the patient's chief complaint.", isSubStep: true },
      {
        number: '2',
        text: 'Provide cardiorespiratory focused treatment.',
        note: 'Treatment and care for a viral upper respiratory infection is symptomatic.',
      },
      { number: '2a', text: 'Administer medications per ADTMC protocols.', isSubStep: true },
      { number: '2b', text: 'Provide symptomatic relief measures.', isSubStep: true },
      { number: '2c', text: 'Reassess vital signs, symptoms, and overall condition per patient presentation.', isSubStep: true },
      { number: '3', text: 'Identify patient disposition and return to duty instructions.' },
      { number: '3a', text: 'Assess severity and need for provider evaluation.', isSubStep: true },
      { number: '3b', text: 'Determine if evacuation/higher care needed.', isSubStep: true },
      { number: '3c', text: 'Provide return-to-duty instructions if appropriate.', isSubStep: true },
      { number: '3d', text: 'Ensure follow-up is communicated and scheduled as needed.', isSubStep: true },
      { number: '4', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '4a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '4b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused assessment using appropriate ADTMC protocol for cardiorespiratory complaints.' },
      { number: '2', text: 'Provided cardiorespiratory focused treatment.' },
      { number: '3', text: 'Identified patient disposition and return to duty instructions.' },
      { number: '4', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    knowledges: [
      { id: 'K23375', name: 'Knowledge of the anatomy and physiology of a pediatric patient' },
      { id: '081-SR-68P-B019', name: 'Knowledge of patient relations' },
      { id: '081-C2-68W-0144', name: 'Knowledge of classifications of patients.' },
      { id: '081-CL-MED-0010', name: 'PATIENT SAFETY' },
      { id: '081-PAD-68G-KN053', name: 'How to obtain patient identification' },
      { id: '081-NP-WM6-0007', name: 'Conduct a patient interview.' },
      { id: '081-VC-68T-KN0236', name: 'Use a patient monitor.' },
      { id: '081-PAD-68G-KN062', name: 'Know how to obtain patient information found in appropriate inpatient computer databases.' },
      { id: 'K23467', name: 'Knowledge of considerations for transporting a comatose patient' },
      { id: 'K22774', name: 'Knowledge of aircraft safety versus patient safety' },
      { id: 'K23318', name: 'Knowledge of optimal interventions for a patient with heat exhaustion' },
      { id: 'K23319', name: 'Knowledge of optimal interventions for a patient with hypothermia' },
      { id: 'K27794', name: 'Factors that influence Patient Movement' },
      { id: '081-C2-68W-0654', name: 'Review the pharmacological preparations that Medics use for management of respiratory diseases a' },
      { id: '081-C2-68W-0656', name: 'Describe the epidemiology, pathophysiology, assessment, and management of respiratory diseases/' },
      { id: 'K23479', name: 'Knowledge of the management of a patient with a drug overdose' },
      { id: '081-SR-68P-H110', name: 'Knowledge of body mechanics and patient handling' },
      { id: 'K22676', name: 'Knowledge of conventional patient positioning' },
      { id: 'K23324', name: 'Knowledge of the treatment and transport of a patient with an infectious or communicable disease' },
      { id: 'K23602', name: 'Knowledge of cardiac conditions associated with geriatric patients' },
      { id: '081-NI-66E-0012', name: 'EAR, NOSE, AND THROAT PATIENT' },
      { id: 'K23295', name: 'Knowledge of assessing a burn patient' },
      { id: '081-NP-WM6-0037', name: "Identify patients' rights." },
      { id: '081-C2-68W-0802', name: 'Knowledge of common diseases that effect the ears, nose and throat.' },
      { id: 'K23241', name: 'Knowledge of the anatomy and physiology of the respiratory system' },
      { id: '081-C2-68W-0803', name: 'Knowledge of signs and symptoms of a cough, sore throat, and common cold.' },
      { id: '081-SR-68P-R254', name: 'Knowledge to perform patient care handwash' },
      { id: 'K23243', name: 'Knowledge of respiratory patient assessment' },
      { id: '081-C2-68W-0869', name: 'Knowledge of proper patient lifting and carrying techniques.' },
      { id: '081-C2-68W-0806', name: "Knowledge of how to take a patient's temperature." },
      { id: 'K23245', name: 'Knowledge of respiratory and ventilation abnormalities' },
      { id: '081-PAD-68G-KN029', name: 'How to identify forms used for documenting patient care' },
      { id: 'K1052', name: 'Principles of a Medical Patient Assessment' },
      { id: '081-IBAM-0009', name: 'Recognize a Seizing Patient' },
      { id: 'K22695', name: 'Knowledge of assessment and management of cardiac conditions of pediatric patients' },
      { id: '081-UE-FMC-5748', name: 'IDENTIFY MEDICAL EMERGENCIES IN A PEDIATRIC PATIENT' },
      { id: 'K22698', name: 'Knowledge of assessment and management of meningococcal infections in pediatric patients' },
      { id: 'K22697', name: 'Knowledge of assessment and management of trauma conditions of pediatric patients' },
      { id: 'K23382', name: 'Knowledge of cardiac considerations associated with pediatric patients' },
      { id: 'K23378', name: 'Knowledge of assessment methods for a pediatric patient' },
      { id: 'K22703', name: 'Knowledge of steps to prepare a patient for a FAST exam' },
      { id: '081-C2-68W-0136', name: 'Knowledge of patient priorities for evacuation.' },
    ],
    skills: [
      { id: '081-C2-68W-0200', name: 'Patient assessment and care for musculoskeletal injury.' },
      { id: '081-C2-68W-0106', name: 'Properly position the patient for the procedure.' },
      { id: 'S2780', name: 'Monitor a patient during a blood transfusion' },
      { id: '081-VC-68T-SK0113', name: 'Evaluate the breathing of the patient.' },
      { id: '081-VC-68T-SK0114', name: 'Evaluate the mental status of the patient.' },
      { id: '081-C2-68W-0272', name: 'Demonstrate the care of the patient exhibiting signs and symptoms of internal bleeding.' },
      { id: '081-C2-68W-0146', name: 'Assess and treat a casualty with a throat injury.' },
      { id: '081-C2-68W-0181', name: 'Use proper equipment to assess a casualty complaining of respiratory problems.' },
      { id: '081-C2-68W-0213', name: 'Demonstrate ventilating a patient using a variety of ventilator techniques.' },
      { id: 'S2769', name: 'Provide care to a military working dog (MWD) in shock' },
      { id: '081-C2-68W-0187', name: 'Ability to interview patients.' },
      { id: '081-C2-68W-0189', name: 'Ability to screen patients.' },
      { id: '081-VC-68T-SK0046', name: 'Ability to recognize symptoms of Shock' },
      { id: '081-C2-68W-0035', name: 'Demonstrate positioning of the patient for the procedure.' },
      { id: '081-VC-68T-SK0070', name: "Assess the patient's pulse." },
      { id: '081-VC-68T-SK0233', name: 'Perform first aid for shock.' },
      { id: '081-C2-68W-0101', name: 'Perform manual airway maneuvers for pediatric patients.' },
      { id: '081-C2-68W-0165', name: 'Assess and treat a casualty with respiratory problems.' },
    ],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      { refId: 'JTS-CPGS', refName: 'Joint Trauma System Clinical Practice Guidelines', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    // Standards cites "FM 4-02.19" while the reference table lists the same document as ATP 4-02.19;
    // both are reproduced as published. Step 4 has no terminal period, its measure does. Verbatim.
    taskNumber: '081-68W-0168',
    title: 'Treat Dental Emergencies',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a medic in an operational environment treating a patient with a general medical complaint. You have been tasked by a medical supervisor to treat a patient who requires care for a dental emergency. You are provided with irrigating syringe, examination gloves, catch basin, sterile gauze sponge, and Standard Form 600, Electronic Medical Records (EMR) or Tactical Combat Casualty Care (TCCC) Card. This task should not be trained in MOPP 4.',
    standards:
      'Treat dental emergencies in accordance with (IAW) Dental Service Support In a Theater of Operations FM 4-02.19, and local Standard Operating Procedures (SOP), while adhering to all performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions:
      'Task may be performed in garrison, field, or combat environments during any visibility conditions. Task may be performed on pediatric, adult, or geriatric patients with simulated or actual patients under qualified medical supervision. Task requires access to dental emergency protocols, basic dental equipment, analgesics, and antibiotics per local protocols. Task may involve patients with facial trauma requiring airway management readiness. Task provides temporary stabilization pending evacuation for definitive dental care.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient presenting with dental pain, oral bleeding, facial trauma, or dental injury requiring emergency treatment.',
    danger:
      'Jaw fractures and dislocations can cause sudden airway obstruction resulting in death. Maintain constant airway monitoring and be prepared for emergency airway intervention. Uncontrolled oral hemorrhage can result in airway compromise and death; control bleeding immediately before addressing other dental issues.',
    warning:
      'Patients with jaw fractures, dislocations, or significant facial trauma require continuous airway monitoring. Manage airway compromise from oropharyngeal bleeding, displaced dental appliances, or aspiration of avulsed/fractured teeth. Dental infections can rapidly progress to life-threatening. Evacuate patients with severe facial swelling immediately. Do not attempt to replant avulsed teeth in combat or field environments due to high infection risk - store teeth properly for transport to dental provider.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection. Do not attempt to replant avulsed teeth in combat environments due to infection risk. Store avulsed teeth in milk or saline for transport to dental provider.',
    remarks:
      'This task provides temporary stabilization and pain management for dental emergencies until definitive dental care is available. Combat medics are not trained for comprehensive dental procedures but must recognize and manage life-threatening complications (airway compromise, hemorrhage, severe infections). Prioritize life-threatening conditions before addressing dental-specific complaints. Coordination with dental personnel or higher echelon medical facilities is essential for patient disposition. This task is critical for maintaining force readiness by managing dental emergencies that could incapacitate Soldiers in operational environments.',
    notes:
      'Dental emergencies are common in military operations and significantly impact mission readiness. Prioritize life-threatening conditions (airway, breathing, circulation) before dental-specific complaints. When uncertain about treatment or disposition, consult senior medical personnel or dental providers via telemedicine. Document time of injury and all treatments for continuity of care. Training should emphasize scope limitations—medics provide temporary stabilization, not definitive dental treatment. Use simulated patients or dental models for training. Coordinate with dental personnel to provide realistic scenarios and feedback.',
    performanceSteps: [
      { number: '1', text: 'Control life-threatening oral conditions such as hemorrhage, cellulitis, and respiratory difficulty.' },
      { number: '1a', text: 'Assess bleeding.', isSubStep: true },
      { number: '1b', text: 'Assist with infection control.', isSubStep: true },
      { number: '1c', text: 'Assess airway.', isSubStep: true },
      { number: '2', text: 'Identify nature of dental emergency.' },
      { number: '2a', text: 'Infection.', isSubStep: true },
      { number: '2a(1)', text: 'Abscess wisdom tooth.', isSubStep: true },
      { number: '2a(2)', text: 'Abscess non-wisdom tooth.', isSubStep: true },
      { number: '2b', text: 'Loss of filling.', isSubStep: true },
      { number: '2c', text: 'Dental fracture.', isSubStep: true },
      { number: '2d', text: 'Avulsed tooth.', isSubStep: true },
      { number: '2e', text: 'Displaced/dislocated mandible.', isSubStep: true },
      { number: '2f', text: 'Fractured jaw.', isSubStep: true },
      { number: '2g', text: 'Intraoral laceration.', isSubStep: true },
      { number: '3', text: 'Provide treatment for relief of oral pain or infections IAW local protocols.' },
      { number: '3a', text: 'Administer analgesics.', isSubStep: true },
      { number: '3b', text: 'Administer antibiotics IAW local protocols.', isSubStep: true },
      { number: '4', text: 'Provide temporary filling as indicated IAW local protocols' },
      { number: '5', text: 'Evacuate for definitive care.' },
      { number: '6', text: 'Complete documentation of medical encounter IAW local SOPs or using DD form 1380.' },
      { number: '6a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '6b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Controlled life-threatening oral conditions such as hemorrhage, cellulitis, and respiratory difficulty.' },
      { number: '2', text: 'Identified nature of dental emergency.' },
      { number: '3', text: 'Provided treatment for relief of oral pain or infections IAW local protocols.' },
      { number: '4', text: 'Provided temporary filling as indicated IAW local protocols.' },
      { number: '5', text: 'Evacuated for definitive care.' },
      { number: '6', text: 'Completed documentation of medical encounter IAW local SOPs or using DD form 1380.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6'],
    knowledges: [
      { id: '081-C2-68W-0301', name: 'Describe causes of upper airway obstruction.' },
      { id: '081-C2-68W-0479', name: 'Knowledge of facial anatomy and related physiology to facial injuries.' },
      { id: '081-C2-68W-0323', name: 'Describe indications for a needle/surgical cricothyroidotomy.' },
    ],
    references: [
      { refId: 'ATP 4-02.19', refName: 'Dental Services', required: true, primary: true },
      { refId: 'ATP 4-02.8', refName: 'Force Health Protection', required: true, primary: false },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'FM 4-02', refName: 'ARMY HEALTH SYSTEM', required: true, primary: false },
      { refId: 'LOCAL SOP', refName: 'LOCAL SOP', required: true, primary: false },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
      { refId: 'TB MED 250', refName: 'Dental Record Administration, Recording and Appointment Control', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    // ⚠️⚠️ THE ONE DELIBERATE DEVIATION FROM VERBATIM IN THIS ENTIRE STORE. USR-directed,
    // 2026-07-27, on clinical authority: "remove the duplicate legacy codes for HEENT — B1-2 eyes
    // are not a thing."
    //
    // The approved packet lists ELEVEN protocols at step 1a: A1-A5, B1, B2, H1-H4, and step 1's
    // note names the same three ranges. But B is MUSCULOSKELETAL in the live ADTMC (CatData
    // `icon: "B."` = MUSCULOSKELETAL; EYE is `H.`). The packet's "B1: Eye Pain/Redness/Discharge"
    // and "B2: Vision Problems/Eye Trauma" are eye protocols under a superseded edition's
    // lettering, and their content is republished in this same packet as H-1 and H-3.
    // Left in place they are actively harmful: they route an eye complaint to the Back Pain and
    // Neck Pain algorithms, and a category-level traversal inherits Apply a Cervical Collar,
    // Manage a Suspected Spinal Injury and Treat Common Musculoskeletal Disorders into an EENT
    // task. USR judged a wrong protocol code on a clinical surface worse than a fidelity gap.
    //
    // WHAT CHANGED, so it can be reverted or reported upstream: substeps 1a(6) and 1a(7) deleted,
    // and step 1's note narrowed from "A1-A5, B1-B2, H1-H4" to "A1-A5, H1-H4". Nothing else.
    // Substep numbering deliberately KEEPS the gap at (6)/(7) rather than renumbering — the gap is
    // the evidence that something was removed. Nine real protocols remain.
    // This is a discrepancy FINDING, not a transcription error; it stays on the standing list.
    taskNumber: '081-68W-0240',
    title: 'Treat a Patient With Eye, Ear, Nose, Throat Complaint',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a medic in an operational or garrison environment. You have been directed to provide sick call services and have completed Task 081-68W-0250 (Treat a patient with general medical complaint). You have a patient requiring an Ear, Eye, Nose and Throat (EENT) examination. You are provided with MEDCOM Pam 40-7-21, (ADTMC), local SOPs, and a fully operational clinic/ battalion aid station with access to standard medical equipment sets (Tactical Combat Medical Care, vital signs monitor, stethoscope, blood pressure cuff, pulse oximeter, thermometer, otoscope, disposable speculum attachments, tongue blades, pen light, pen, Snellen chart, oxygen delivery systems, defibrillator/monitor, and authorized medications), as well as computer access to electronic medical record documentation systems. You will be provided with a Standard Form (SF) 600, Medical Record -Chronological Record of Medical Care or electronic medical record. This task should not be trained in MOPP 4.',
    standards:
      'Treat a patient with eye, ear, nose, throat complaint by performing a focused assessment using appropriate ADTMC protocols, providing appropriate treatment, determining patient disposition, and documenting the encounter with 100% accuracy according to MEDCOM PAM 40-7-21 and local SOPs',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to ADTMC protocols and medical equipment. Task may be performed on pediatric, adult, or geriatric patients with varying chief complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You have completed task 081-68W-0250 (Treat a Patient With General Medical Complaint) and encounter a patient who presents with complaints related to the eye, ear, nose, or throat requiring assessment and treatment.',
    danger: 'Chemical exposure to eyes requires immediate irrigation. Delay in treatment may result in permanent vision loss.',
    warning:
      'Foreign bodies in the eye, ear, or airway may cause serious injury if improperly managed. Do not attempt removal of impaled objects.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    remarks:
      'This task requires application of ADTMC protocols specific to EENT complaints. Proper assessment and treatment can prevent complications and preserve sensory function.',
    notes:
      'Some EENT conditions may be contagious. Follow infection control procedures. Certain eye and ear injuries require urgent referral to prevent permanent damage.',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform focused assessment using appropriate ADTMC protocol for ear, nose, and throat complaints.',
        note: 'Select and apply applicable protocol(s) from A1-A5, H1-H4 based on patient presentation.',
      },
      { number: '1a', text: 'Identify and verbalize selected ADTMC protocol based on patients chief complaint:', isSubStep: true },
      { number: '1a(1)', text: 'A1: Sore Throat/Hoarseness.', isSubStep: true },
      { number: '1a(2)', text: 'A2: Ear Pain/Drainage/Trauma.', isSubStep: true },
      { number: '1a(3)', text: 'A3: Cold Symptoms/Allergies/Cough.', isSubStep: true },
      { number: '1a(4)', text: 'A4: Ringing in the Ears/Hearing Problem.', isSubStep: true },
      { number: '1a(5)', text: 'A5: Nosebleed/Nose Trauma.', isSubStep: true },
      // 1a(6) and 1a(7) — the packet's "B1: Eye Pain/Redness/Discharge" and "B2: Vision
      // Problems/Eye Trauma" — are REMOVED. See the deviation note in the packet header.
      { number: '1a(8)', text: 'H-1: Eye Pain/Redness/Discharge/Itching/Injury.', isSubStep: true },
      { number: '1a(9)', text: 'H-2: Eyelid Problem.', isSubStep: true },
      { number: '1a(10)', text: 'H-3: Decreased Vision, Seeing Spots, Request for Glasses.', isSubStep: true },
      { number: '1a(11)', text: 'H-4: Seeing Double (Diplopia).', isSubStep: true },
      { number: '1b', text: "Apply correct ADTMC protocol based on the patient's chief complaint.", isSubStep: true },
      { number: '2', text: 'Provide treatment based on assessment findings IAW ADTMC protocols.' },
      { number: '2a', text: 'Implement appropriate interventions for specific complaints.', isSubStep: true },
      { number: '2b', text: 'Provide symptomatic relief measures.', isSubStep: true },
      { number: '2c', text: 'Apply patient isolation precautions as needed.', isSubStep: true },
      { number: '3', text: 'Identify patient disposition and return to duty instructions.' },
      {
        number: '3a',
        text: 'Assess severity and need for provider evaluation.',
        isSubStep: true,
        note: 'IAW ADTMC protocols, conditions such as penetrating eye injuries, chemical burns to the eye, sudden vision loss, severe ear pain with neurological symptoms, and airway compromise require immediate provider evaluation.',
      },
      { number: '3b', text: 'Determine if evacuation/higher care is needed.', isSubStep: true },
      { number: '3c', text: 'Provide return-to-duty instructions if appropriate.', isSubStep: true },
      { number: '3d', text: 'Ensure follow-up is communicated and scheduled as needed.', isSubStep: true },
      { number: '4', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '4a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '4b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused assessment using appropriate ADTMC protocol for ear, nose, and throat complaints.' },
      { number: '2', text: 'Provided treatment based on assessment findings IAW ADTMC protocols.' },
      { number: '3', text: 'Identified patient disposition and return to duty instructions.' },
      { number: '4', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    knowledges: [
      { id: 'K23540', name: 'Knowledge of the methods used to assess a head injury' },
      { id: '081-VC-68T-KN0107', name: 'Eye anatomy.' },
      { id: '081-C2-68W-0955', name: 'Normal assessment findings of the skin, feet, nails, eyes, ears, and nose.' },
      { id: 'K24253', name: 'Components of the human eye and their functions' },
      { id: '081-UE-FMC-5632', name: 'Identify the Anatomy of the Head' },
      { id: '081-C2-68W-0817', name: 'Knowledge of signs and symptoms of Conjunctivitis (Pink eye).' },
      { id: '081-C2-68W-0200', name: 'Basic rules for emergency medical care for eye injuries.' },
      { id: '081-C2-68W-0802', name: 'Knowledge of common diseases that effect the ears, nose and throat.' },
      { id: '081-C2-68W-0818', name: 'Knowledge of care for the patient with Conjunctivitis (Pink eye).' },
      { id: '081-C2-68W-0201', name: 'Common eye injuries and describe their appropriate emergency medical care' },
    ],
    skills: [
      { id: '081-VC-68T-SK0139', name: 'Identify clinical signs and symptoms of eye injuries.' },
      { id: '081-C2-68W-0142', name: 'Assess and treat a casualty with a ear injury.' },
      { id: '081-C2-68W-0081', name: 'Demonstrate the ability to perform a general assessment for eye injuries' },
      { id: '081-C2-68W-0146', name: 'Assess and treat a casualty with a throat injury.' },
    ],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      {
        refId: 'ISBN 978-0071794763',
        refName: "Tintinalli's Emergency Medicine A Comprehensive Study Guide 8th Edition",
        required: true,
        primary: false,
      },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    // Task-level DANGER/WARNING/CAUTION are all "None" here, but the packet carries a step-scoped
    // CAUTION above step 1 and a step-scoped WARNING above step 2 — attached to those steps.
    // "Cyno-kit" (for Cyanokit) in step 4c(1) is the packet's own spelling. Verbatim.
    taskNumber: '081-68W-0248',
    title: 'Treat a Patient With a Toxicological Emergency',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic in an operational or garrison environment. You encounter a patient with signs and symptoms of toxicological emergency. You have taken body substance isolation (BSI) precautions and have access to normal saline IV supplies, airway management equipment, suction equipment, activated charcoal, antidotes (EpiPen, Naloxone, Cyanokit), vital signs equipment, decontamination supplies, and Joint Trauma System Clinical Practice Guideline ID:25 (Inhalation Injury and Toxic Industrial Chemical Exposure). You have completed prerequisite task 081-68W-0250 (Treat a Patient With General Medical Complaint). This task should not be trained in MOPP 4.',
    standards:
      'Provide treatment to a patient with indications of a toxicological emergency. Provide appropriate supportive treatment based on patient presentation and toxicological syndrome identified. Remove patient from source of toxin when safe and applicable. Contact poison control center or medical control for guidance on unknown toxins. Document all findings, treatments, and patient responses IAW local SOP. All actions comply with current Joint Trauma System Clinical Practice Guidelines. Do not perform this task in CBRN contaminated environments',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to current JTS Clinical Practice Guidelines and poison control center contact information. You have communication capability to contact poison control center or medical control. Task may be performed on pediatric, adult, or geriatric patients with varying chief complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient presents with signs and symptoms of poisoning, overdose, or toxic exposure; OR directed by medical control to treat suspected toxicological emergency; OR responding to emergency call for patient with known or suspected toxic exposure.',
    danger: 'None',
    warning: 'None',
    caution: 'None',
    remarks:
      'This task is critical for preventing death or permanent injury from toxicological emergencies. Medics must recognize toxidromes and provide appropriate supportive care and antidotes. Coordination with poison control centers is essential for optimal outcomes. This task does not cover CBRN agent exposure - refer to CBRN medical tasks.',
    notes:
      'Emphasize scene safety assessment before approaching patients with suspected toxic exposure. Training scenarios should include common military toxicological emergencies. Simulated patients should present realistic toxidrome signs and symptoms. Ensure access to current JTS Clinical Practice Guidelines. Incorporate a simulated consultation with poison control center into scenarios. Integrate with other emergency medical tasks for comprehensive training.',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform focused exam for toxicological emergency / poisoning / overdose / exposure.',
        caution: 'Reassessment should be conducted at least every 5 minutes, as toxic exposures can rapidly compromise these functions.',
        note: 'Red flags include: dizziness, headache, nausea, anxiety, altered mental status, seizures, respiratory irritation, mucosal irritation, burning to eyes and throat, lacrimation, and loss of consciousness.',
      },
      { number: '1a', text: 'Reassess Airway, Breathing, Circulation every 5 minutes', isSubStep: true },
      { number: '1b', text: 'Assess for exposure signs (e.g. burns, rashes, altered mental status).', isSubStep: true },
      {
        number: '2',
        text: 'Perform supportive treatments.',
        warning:
          'Some toxic pulmonary agents already cause oxidative injury to the lungs. Giving too much supplemental oxygen can worsen that damage. Provide only the amount of oxygen needed to keep the patient adequately oxygenated (typically a pulse oximetry reading between 90% and 96%).',
      },
      { number: '2a', text: 'Administer appropriate supportive interventions based on symptoms.', isSubStep: true },
      { number: '2b', text: 'Monitor patient response to interventions.', isSubStep: true },
      {
        number: '3',
        text: 'Gather information about the exposure.',
        note: 'The evaluator will assume the role of “poison control” for evaluation purposes only.',
      },
      { number: '3a', text: 'Interview the patient and/or bystanders to determine:', isSubStep: true },
      { number: '3a(1)', text: 'Type of toxin', isSubStep: true },
      { number: '3a(2)', text: 'Route of exposure', isSubStep: true },
      { number: '3a(3)', text: 'Time of exposure', isSubStep: true },
      { number: '3b', text: 'Verbalize differential diagnosis.', isSubStep: true },
      { number: '4', text: 'Provide ongoing treatment to stabilize the casualty.' },
      { number: '4a', text: 'Reassess vitals every 5 or 15 minutes based on patient presentation.', isSubStep: true },
      { number: '4b', text: 'Reassess supportive interventions.', isSubStep: true },
      { number: '4c', text: 'Provide antidote, if applicable.', isSubStep: true },
      { number: '4c(1)', text: 'Cyno-kit.', isSubStep: true },
      { number: '4c(2)', text: 'Naloxone.', isSubStep: true },
      { number: '5', text: 'Complete documentation of encounter IAW ADTMC or local SOPs.' },
      { number: '5a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '5b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused exam for toxicological emergency / poisoning / overdose / exposure.' },
      { number: '2', text: 'Performed supportive treatments.' },
      { number: '3', text: 'Gathered information about the exposure.' },
      { number: '4', text: 'Provided ongoing treatment to stabilize the casualty.' },
      { number: '5', text: 'Completed documentation of encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5'],
    knowledges: [
      { id: 'K26101', name: 'Knowledge of Toxic Industrial Materials (TIM) and concerns' },
      { id: 'K23335', name: 'Knowledge of the management of Toxicologic emergencies' },
      { id: 'K23339', name: "Knowledge of managing a toxicological patient's airway, breathing, and circulation" },
      { id: 'K28143', name: 'Know what a toxic industrial biological (TIB) is' },
      {
        id: 'K23336',
        name: 'Knowledge of Assess a patient for the presence and severity of a toxic event, including vital signs and blood chemistry values during transport',
      },
      { id: 'K23338', name: 'Knowledge of the signs and symptoms of toxic syndromes and medication reaction syndromes' },
      { id: 'K23366', name: 'Knowledge of the causes and methods of treating the neonate for toxic exposure' },
      { id: 'K26014', name: 'Knowledge of basic toxicological and chemical terminology' },
      { id: 'K23344', name: 'Knowledge of treatment considerations for toxic exposure patients' },
      { id: 'K23341', name: 'Knowledge optimal interventions for treating toxicological emergencies' },
    ],
    skills: [
      { id: 'S8468', name: 'Perform procedures for patient suctioning.' },
      { id: 'S9242', name: 'Ability to apply technical maneuvers that improve visual identification of the airway during laryngoscopy' },
      { id: '081-VC-68T-SK0173', name: 'Monitor vital signs.' },
      { id: 'S3141', name: 'Laryngeal mask airway (LMA) insertion' },
      { id: 'S3915', name: 'Ability to Recognize the Signs and Symptoms of Hyperventilation' },
      { id: 'S8412', name: "Maintain a casualty's airway." },
      { id: 'S8499', name: 'Perform procedures in the treatment of respiratory emergencies.' },
      { id: 'S8501', name: "Obtain a patient's vital signs." },
      { id: 'S0918', name: 'Proper operation of respiratory protection equipment' },
      { id: 'S3142', name: 'Inserting a King LT airway' },
      { id: 'S9243', name: 'Ability to use airway adjuncts/alternative airway tools' },
    ],
    references: [
      { refId: 'JTS-CPGS', refName: 'Joint Trauma System Clinical Practice Guidelines', required: true, primary: true },
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    // Packet title is "Treat a Patient with an Infectious Disease"; the roster in ICTL.ts lists the
    // same number as "Treat Infectious Diseases". Packet title wins here — see 081-000-0122.
    // Reference "Joint Trama System (JTS)" is the packet's own misspelling. Verbatim.
    taskNumber: '081-68W-0251',
    title: 'Treat a Patient with an Infectious Disease',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'As a 68W Combat Medic in an operational or garrison environment, you have completed task 081-68W-0250 (Treat a Patient with a General Medical Complaint). A patient presents with signs and symptoms of a highly contagious disease and requires an examination. You have donned appropriate body substance isolation (BSI) precautions. You have access to MEDCOM Pam 40-7-21 Algorithm-Directed Troop Medical Care (ADTMC), local SOPs, medications, IV fluids, Class VIII medical supplies, and electronic medical record documentation systems. This task should not be trained in MOPP 4.',
    standards:
      'Assess and treat a patient with an infectious disease in accordance with current clinical practice guidelines (MEDCOM Pam 40-7-21 or successor), infection control protocols, and unit SOP. Correctly identify signs and symptoms consistent with infectious disease. Initiate appropriate treatment within established timelines per clinical guidelines. Implement infection control measures to prevent disease transmission to medical personnel and other patients. Determine correct patient disposition (return to duty, evacuation, or referral). Document all assessment findings, treatments provided, and patient disposition on DD Form 1380, SF 600, or electronic health record within required timeframe. All performance steps are completed without error.',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to ADTMC protocols and medical equipment. Task may be performed on pediatric, adult, or geriatric patients with varying chief complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient presents with symptoms consistent with infectious disease requiring assessment and treatment.',
    danger:
      'Exposure to infectious diseases without proper personal protective equipment can result in serious illness or death. Highly contagious diseases such as viral hemorrhagic fevers, novel pathogens, or drug-resistant organisms require immediate isolation and notification to higher headquarters - failure to isolate can result in widespread outbreak. Failure to implement proper infection control measures can result in disease transmission to medical personnel, other patients, and unit personnel. Needlestick injuries or exposure to blood/body fluids from patients with bloodborne pathogens (HIV, Hepatitis B/C) can result in life-threatening infection.',
    warning:
      'Failure to properly identify infectious diseases can result in delayed treatment, increased morbidity and mortality, and disease spread. Improper disposal of infectious waste can contaminate the environment and spread disease to personnel and local populations. Some infectious diseases are reportable to public health authorities. Failure to report can result in widespread outbreaks and regulatory violations. Cerebral malaria, sepsis, and other severe complications require immediate evacuation, as delays can be fatal. Reassess patients frequently for changes in condition, because infectious diseases can deteriorate rapidly. Verify proper medication dosing, especially for pediatric or geriatric patients, as dosing errors can result in treatment failure or toxicity.',
    caution:
      'All body fluids should be considered potentially infectious regardless of patient presentation. Always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection. Ensure proper hand hygiene before and after all patient contacts, even when gloves are worn. Decontaminate all equipment, surfaces, and medical devices after treating patients with suspected infectious diseases. Monitor yourself for symptoms during the incubation period after exposure to infectious patients. Ensure adequate ventilation when treating patients with suspected airborne diseases. Use proper technique when collecting specimens to avoid contamination and ensure accurate results. Document all exposures to infectious diseases and report to your supervisor and medical personnel immediately.',
    remarks:
      'This task is critical for identifying and treating infectious diseases in operational environments where disease outbreaks can significantly impact unit readiness. Early identification and appropriate treatment prevent disease transmission and maintain force health protection.',
    notes:
      'Infectious disease assessment requires knowledge of endemic diseases in the area of operations. Medics must maintain current immunization records for all personnel and coordinate with preventive medicine personnel for disease surveillance.',
    performanceSteps: [
      { number: '1', text: 'Assess infectious disease risk and implement additional infection control measures as needed.' },
      {
        number: '1a',
        text: 'Assess patient presentation for signs of highly contagious disease requiring enhanced precautions beyond standard BSI.',
        isSubStep: true,
      },
      { number: '1b', text: 'Upgrade PPE if indicated based on suspected disease.', isSubStep: true },
      { number: '1c', text: 'Isolate patient from other personnel if highly contagious disease is suspected.', isSubStep: true },
      { number: '1d', text: 'Establish infection control zone if treating multiple patients.', isSubStep: true },
      {
        number: '1e',
        text: 'Notify higher headquarters immediately if highly contagious disease (e.g., viral hemorrhagic fever) is suspected.',
        isSubStep: true,
      },
      { number: '2', text: 'Conduct focused infectious disease assessment using ADTMC algorithm.' },
      { number: '2a', text: "Identify and verbalize selected ADTMC protocol based on patient's chief complaint.", isSubStep: true },
      {
        number: '2a(1)',
        text: 'Gastrointestinal (GI) Complaints (C1- C7)(See: 081-68W-0239, Treat a Patient with Gastrointestinal Complaint)',
        isSubStep: true,
      },
      { number: '2a(2)', text: 'Genitourinary Complaints (E1-E4)', isSubStep: true },
      { number: '2a(3)', text: 'Constitutional Complaints (G1, G2)', isSubStep: true },
      { number: '2a(4)', text: 'Other relevant algorithm pathways as indicated', isSubStep: true },
      { number: '2b', text: 'Assess for fever, chills, and duration of symptoms.', isSubStep: true },
      { number: '2c', text: 'Collect diagnostic specimens if applicable per clinical protocols.', isSubStep: true },
      { number: '3', text: 'Obtain additional infectious disease-specific history per ADTMC guidelines.' },
      { number: '3a', text: 'Conduct case contact interviews.', isSubStep: true },
      { number: '3b', text: 'Identify recent exposures (sick contacts, travel history, food/water sources).', isSubStep: true },
      { number: '3c', text: 'Identify mode of transmission.', isSubStep: true },
      { number: '4', text: 'Identify countermeasures to break the chain of infection.' },
      {
        number: '4a',
        text: 'Provide personal hygiene education (hand washing, respiratory etiquette, safe food/water practices).',
        isSubStep: true,
      },
      { number: '4b', text: 'Recommend isolation of infected personnel as necessary.', isSubStep: true },
      {
        number: '4c',
        text: 'Coordinate with preventive medicine personnel for disease surveillance and outbreak investigation per ADTMC protocol or local SOP.',
        isSubStep: true,
      },
      { number: '5', text: 'Provide treatment per ADTMC clinical practice guidelines.' },
      { number: '5a', text: 'Administer medications per ADTMC protocols.', isSubStep: true },
      {
        number: '5a(1)',
        text: 'Select appropriate ADTMC protocol based on specific chief complaint (E1-4, G1-G2, or other relevant complaints).',
        isSubStep: true,
        note: 'Refer to the applicable ADTMC complaint protocols.',
      },
      { number: '5a(2)', text: 'Verify correct medication, dosage, route, and timing per clinical guidelines.', isSubStep: true },
      { number: '5a(3)', text: 'Administer oral or intravenous medications as prescribed.', isSubStep: true },
      {
        number: '5b',
        text: 'Reassess vital signs, symptoms, and overall condition every 5 or 15 minutes based on patient presentation.',
        isSubStep: true,
      },
      { number: '5c', text: 'Document all treatment provided and patient response.', isSubStep: true },
      { number: '6', text: 'Identify patient disposition and return to duty instructions.' },
      { number: '6a', text: 'Assess severity and need for provider evaluation.', isSubStep: true },
      {
        number: '6b',
        text: 'Evacuate Urgent category for significant complications (e.g. cerebral, pulmonary, unstable vital signs).',
        isSubStep: true,
      },
      {
        number: '6c',
        text: 'Provide return-to-duty instructions if appropriate, including activity restrictions and contagious period.',
        isSubStep: true,
      },
      { number: '6d', text: 'Ensure follow-up is communicated and scheduled as needed.', isSubStep: true },
      { number: '7', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '7a', text: 'Record all finding and treatment.', isSubStep: true },
      { number: '7b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Assessed infectious disease risk and implement additional infection control measures as needed.' },
      { number: '2', text: 'Conducted focused infectious disease assessment using ADTMC algorithm.' },
      { number: '3', text: 'Obtained additional infectious disease-specific history per ADTMC guidelines.' },
      { number: '4', text: 'Identified countermeasures to break the chain of infection.' },
      { number: '5', text: 'Provided treatment per ADTMC clinical practice guidelines.' },
      { number: '6', text: 'Identified patient disposition and return to duty instructions.' },
      { number: '7', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7'],
    knowledges: [
      { id: '081-NP-68C-0009', name: 'Determine appropriate disposal of infectious waste.' },
      { id: '081-C2-68W-0794', name: 'Discuss public health principles relevant to infectious/ communicable disease.' },
      {
        id: 'K23329',
        name: 'Knowledge of the signs and symptoms of common infectious diseases, including pneumonia, influenza, hepatitis, and HIV',
      },
      { id: '081-C2-68W-0801', name: 'Describe the assessment of a casualty suspected of an infectious/ communicable disease.' },
      { id: 'K23324', name: 'Knowledge of the treatment and transport of a patient with an infectious or communicable disease' },
      { id: 'K23331', name: 'Knowledge of treatment strategies for infectious disease, including antibiotics, antivirals, and antifungals' },
    ],
    skills: [
      { id: '301-S-170', name: 'Conduct an assessment.' },
      { id: '081-C2-68W-0298', name: 'Perform an assessment of a casualty with an infectious/ communicable disease.' },
      { id: 'S4572', name: 'Be able to treat for casualties and seek medical help' },
      { id: 'S4836', name: 'Extract Medical Information' },
    ],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      { refId: 'AR 40-562', refName: 'Immunizations and Chemoprophylaxis for the Prevention of Infectious Diseases', required: true, primary: false },
      { refId: 'Joint Trama System (JTS)', refName: 'Clinical Practice Guidelines', required: true, primary: false },
      { refId: 'LOCAL SOP', refName: 'LOCAL SOP', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    // Task-level DANGER/WARNING/CAUTION are all "None", but the packet hangs four statements off
    // individual treatment branches instead — attached to steps 2a, 2b, 2c and 2f. Packet title is
    // "...With Environmental Injury"; the roster says "...Casualty With Environmental Injury".
    taskNumber: '081-000-0003',
    title: 'Treat a Patient With Environmental Injury',
    status: 'Approved',
    reportDate: '2026-03-04',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic assigned to an operational or garrison environment. You identify your patient is suffering from an environmental injury (heat injury, cold injury, insect bite, snake bite, or high-altitude illness). You are provided with an Improved First Aid Kit (IFAK), combat medic aid bag, hypothermia prevention kit, medical equipment and supplies, DD Form 1380 (TCCC Card), and communication equipment. You have access to Tactical Combat Casualty Care (TCCC) guidelines (current edition), Joint Trauma System Clinical Practice Guidelines (JTS CPGs ID: 23, 81, 84 and 95), MEDCOM Pam 40-7-21 (ADTMC), and unit Standard Operating Procedures (SOP). The operational environment may include hostile fire, limited visibility, limited evacuation support, extreme environmental conditions, and high-stress conditions. This task should not be trained in MOPP 4.',
    standards:
      'Treat a Patient with Environmental Injury IAW JTS CPG ID: 23 (Environmental Injuries), JTS CPG ID: 95 (High Altitude Illness), JTS CPG ID: 81 (Global Snake Envenomation Management ), JTS CPG ID: 84 (Global Spider and Scorpion Envenomation Management ), TCCC guidelines (current edition), MEDCOM Pam 40-7-21 (ADTMC), and unit SOP. Complete all performance steps with 100% accuracy, utilizing GO/NO GO criteria. Ensure proper documentation of treatment using DD Form 1380 TCCC Card or electronic medical records.',
    specialConditions: 'None.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You have completed task 081-000-0049 (Perform Tactical Combat Casualty Care) and 081-68W-0250 (Treat a Patient With General Medical Complaint). You suspect or have confirmed and environmental injury requiring immediate treatment, as indicated.',
    danger: 'None',
    warning: 'None',
    caution: 'None',
    remarks:
      'The Soldier will either utilize the Perform Tactical Combat Casualty Care or Treat a Patient with General Medical Complaint as framework for assessment based on clinical environment.',
    notes:
      'For non-Army Publishing Directorate (APD), contact your training non-commissioned officer (NCO) and / or check with the military occupational specialty (MOS) library. CPG guidelines can be found for reference at Joint Trauma System Clinical Practice Guidelines (CPG) website. https://jts.health.mil/index.cfm/CPGs/cpgs This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOS’s may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    performanceSteps: [
      { number: '1', text: 'Perform focused assessment to correctly identify environmental injury/illness.' },
      {
        number: '1a',
        text: 'Identify and verbalize additional, relevant questions to help identify the nature and severity of the injury.',
        isSubStep: true,
      },
      { number: '1b', text: 'Verbalize differential diagnosis.', isSubStep: true },
      { number: '1c', text: "Apply correct protocol based on the patient's chief complaint", isSubStep: true },
      { number: '2', text: 'Administer interventions for environmental injury/illness.' },
      {
        number: '2a',
        text: 'Treat for Heat Injury, IAW ADMTC Heat Injury/Hyperthermia K-1 protocol.',
        isSubStep: true,
        caution: 'Stop active cooling when core temperature reaches 101-102°F to prevent rebound hypothermia.',
        note: 'Do not give oral fluids to patients with altered mental status - aspiration risk.',
      },
      {
        number: '2b',
        text: 'Treat for Cold Injury/Hypothermia (IAW JTS CPG ID 23).',
        isSubStep: true,
        danger:
          'Do not attempt rapid rewarming of frostbitten extremities if refreezing is possible - tissue damage will be significantly worse. Hypothermia with core temperature <82°F is often fatal without advanced medical intervention.',
        note: 'Handle hypothermic patients gently - rough handling can precipitate dysrhythmia. Do not allow patients to walk or exert themselves.',
      },
      {
        number: '2c',
        text: 'Treat for Snake Bites IAW Global Snake Envenomation Management (CPG ID: 81).',
        isSubStep: true,
        warning:
          'Do not apply tourniquet to snake bite - causes severe tissue damage and may result in limb loss. Do not cut bite wound or attempt to suck venom.',
        note: 'Venomous snake bites can cause respiratory failure, shock, and death within hours - immediate evacuation is critical.',
      },
      {
        number: '2d',
        text: 'Treat for all other suspected envenomation IAW Global Spider and Scorpion Envenomation Management (CPG ID: 84).',
        isSubStep: true,
        note: 'Some spider and scorpion envenomation can cause severe systemic reactions including respiratory failure and cardiovascular collapse.',
      },
      {
        number: '2e',
        text: 'Treat for allergic reaction.',
        isSubStep: true,
        note: 'Monitor continuously for 4-6 hours after allergic reaction - delayed anaphylaxis can occur. Be prepared to perform cricothyroidotomy if airway obstruction occurs.',
      },
      { number: '2e(1)', text: 'Administer Epinephrine Autoinjector if indicated and anaphylaxis is suspected.', isSubStep: true },
      { number: '2e(2)', text: 'Manage airway as indicated if swelling, stridor or respiratory failure is present.', isSubStep: true },
      { number: '2e(3)', text: 'Administer high flow oxygen via non-rebreather mask.', isSubStep: true },
      { number: '2e(4)', text: 'Place patient supine unless contraindicated.', isSubStep: true },
      {
        number: '2f',
        text: 'Treat for Altitude Emergencies (IAW JTS CPG ID 95).',
        isSubStep: true,
        caution: 'Do not allow patients with HACE to descend unassisted - ataxia and altered mental status create fall risk.',
      },
      { number: '2f(1)', text: 'Descend rapidly, rapid descent is the definitive treatment for altitude illness.', isSubStep: true },
      { number: '2f(2)', text: 'HAPE can rapidly progress to respiratory failure.', isSubStep: true },
      { number: '2f(3)', text: 'HACE can cause permanent brain injury or death within hours.', isSubStep: true },
      { number: '3', text: 'Prepare patient for evacuation if necessary.' },
      { number: '3a', text: 'Document the treatment DD Form 1380 TCCC Card or electronic medical record.', isSubStep: true },
      { number: '3b', text: 'Package the patient for transport.', isSubStep: true },
      { number: '3c', text: 'Communicate with higher echelon or receiving facility.', isSubStep: true },
      { number: '4', text: 'Evacuate the patient.' },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused assessment to correctly identify environmental injury/illness.' },
      { number: '2', text: 'Administered interventions for environmental injury/illness.' },
      { number: '3', text: 'Prepared patient for evacuation if necessary.' },
      { number: '4', text: 'Evacuated the patient.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    knowledges: [
      { id: '081-C2-68W-0366', name: 'Knowledge of treating a casualty for shock.' },
      { id: 'K31037', name: 'Identify fundamental principles of environmental injuries.' },
      { id: 'K31028', name: 'Identify techniques and procedures to control casualty bleeding.' },
      { id: 'K31455', name: 'Know how to interpret the information in a DD Form 1380 Tactical Combat Casualty Care Card' },
      { id: 'AR 40-66', name: 'Complete a DD 1380 (Tactical Combat Casualty Card)' },
      { id: 'K27459', name: 'Elements of Tactical Combat Casualty Care (TC3)' },
      { id: '011-1134K', name: 'Army medical/casualty evacuation' },
    ],
    skills: [
      { id: 'S4739', name: 'Be able to perform casualty transport techniques' },
      { id: '081-VC-68T-SK0283', name: 'Recognize the clinical signs of anaphylactic shock.' },
      { id: 'S8723', name: 'Complete a DD 1380 Tactical Combat Casualty Card' },
      { id: '081-C2-68W-0124', name: 'Obtain a SAMPLE history.' },
      { id: 'S6577', name: 'Ability to perform first aid for shock' },
      { id: 'S8492', name: 'Perform procedures in the treatment of snake bites.' },
      { id: '081-LD-CMN-0006', name: 'Perform first aid for cold injuries.' },
      { id: '081-LD-CMN-0007', name: 'Perform first aid for heat injuries.' },
      { id: '081-VC-68T-SK0046', name: 'Ability to recognize symptoms of Shock' },
      { id: '081-VC-68T-SK0067', name: 'Assess for hypothermia.' },
      { id: 'S8477', name: 'Perform procedures in the management of shock..' },
      { id: 'S8490', name: 'Perform procedures in the treatment of cold injuries.' },
      { id: 'S8493', name: 'Perform procedures in the treatment of altitude illness.' },
    ],
    references: [
      { refId: 'JTS-CPGS', refName: 'Joint Trauma System Clinical Practice Guidelines', required: true, primary: true },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: false },
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-000-0231', '081-68W-0250'],
    supportingTasks: ['081-COM-1001'],
  },
  {
    // Standards reads "(JST CPG)" for JTS — the packet's own transposition. Verbatim.
    taskNumber: '081-68W-0167',
    title: 'Employ Telemedicine',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      "You are a medic in an operational or field environment treating a patient with a medical or trauma condition that is outside your scope of practice to diagnose and/or treat. You are required to employ telemedicine based on the patient's category to determine what modality is needed to communicate with the senior medical professional. You have Joint Trauma System Clinical Practice Guidelines (JTS CPGs) and approved equipment. This task should not be trained in MOPP 4.",
    standards:
      'Employ Telemedicine in accordance with (IAW) Joint Trauma System Clinical Practice Guidelines (JST CPG) Telemedicine (TM) for the Deployed Environment, while adhering to all performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions:
      'Task requires operational communication systems, telemedicine equipment, and secure network connectivity (SIPR/NIPR). May be performed in garrison, deployed, or austere environments with degraded communications. Requires JTS CPG 94 framework. Involves Protected Health Information requiring HIPAA and OPSEC compliance. May be performed during limited visibility, time-sensitive conditions, or with coalition/host nation coordination. Requires prior training on telemedicine equipment and communication security.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient presents with a medical or trauma condition that is outside your scope of practice to diagnose and/or treat; OR directed by senior medical provider to initiate telemedicine consultation; OR patient condition requires diagnostic or treatment guidance from remote medical expert; OR unit SOP requires telemedicine consultation for specific medical conditions.',
    danger: 'None',
    warning: 'None',
    caution: 'None',
    remarks:
      'Telemedicine extends specialist expertise to forward-deployed medics. Requires proper equipment, reliable communications, and trained personnel. All transmissions must use secure, encrypted systems for HIPAA and OPSEC compliance. Supplements but does not replace hands-on assessment. Unit PACE plans must be developed. Consultation quality depends on information quality: develop strong patient presentation skills.',
    notes:
      'Train with actual unit equipment using realistic scenarios for both asynchronous and synchronous consultations. Emphasize complete patient assessment before consultation. Include communication security training (HIPAA, OPSEC, encryption). Practice PACE planning, use role-playing for patient presentations. Include equipment failure scenarios. Integrate with prolonged field care training.',
    performanceSteps: [
      { number: '1', text: "Identify patient's priority requiring telemedicine consultation." },
      {
        number: '2',
        text: 'Implement unit PACE plan.',
        note: 'The PACE plan is uniquely developed by the unit prior to arriving in an area of operations. Example can be found in CPG ID:94 (Telemedicine Guidance in the Deployed Setting).',
      },
      { number: '2a', text: 'Attempt Primary, Alternate, Contingency, then Emergency communication methods in sequence.', isSubStep: true },
      { number: '2b', text: 'Verify secure, encrypted system before transmitting patient information.', isSubStep: true },
      {
        number: '3',
        text: 'Select appropriate communication modality.',
        note: 'Factors that determine modality are equipment available and precedence of the injury.',
      },
      { number: '3a', text: 'Assess urgency and complexity of patient condition.', isSubStep: true },
      {
        number: '3b',
        text: 'For routine/non-urgent conditions: Use asynchronous methods (email, text, photos, GTP at https://gtp.health.mil/).',
        isSubStep: true,
      },
      {
        number: '3c',
        text: 'For urgent/emergent or complex conditions: Use synchronous methods (phone, video, ADVISOR at 833-ADVSRLN or DSN 312-429-9089).',
        isSubStep: true,
      },
      { number: '3d', text: 'Consider available equipment and bandwidth when selecting modality.', isSubStep: true },
      {
        number: '4',
        text: 'Conduct telemedicine consultation.',
        note: 'See CPG ID :94 for guide on virtual critical care consultation (V3) for detailed procedures.',
      },
      {
        number: '4a',
        text: 'Provide complete patient information: demographics, chief complaint, history, assessment findings, vital signs, treatments provided, available resources, and evacuation timeline.',
        isSubStep: true,
      },
      { number: '4b', text: 'Transmit high-quality photographs/video as appropriate.', isSubStep: true },
      { number: '4c', text: 'Maintain OPSEC and HIPAA compliance, use only secure systems.', isSubStep: true },
      { number: '4d', text: 'Receive consultant recommendations and clarify understanding.', isSubStep: true },
      { number: '4e', text: 'Discuss any limitations in implementing recommendations.', isSubStep: true },
      { number: '5', text: 'Implement consultant recommendations.' },
      { number: '5a', text: 'Provide treatments/interventions within scope of practice and available resources.', isSubStep: true },
      { number: '5b', text: 'Communicate limitations to consultant for alternative recommendations if needed.', isSubStep: true },
      { number: '5c', text: 'Continue monitoring and provide follow-up reports as directed.', isSubStep: true },
      { number: '6', text: 'Complete documentation of the encounter with an SF 600, DD form 1380 or electronic medical record (EMR).' },
      { number: '6a', text: 'Record all findings, treatment, and consultations.', isSubStep: true },
      { number: '6b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: "Identified patient's priority requiring telemedicine consultation." },
      { number: '2', text: 'Implemented unit PACE plan.' },
      { number: '3', text: 'Selected appropriate communication modality.' },
      { number: '4', text: 'Conducted telemedicine consultation.' },
      { number: '5', text: 'Implemented consultant recommendations.' },
      { number: '6', text: 'Completed documentation of the encounter with a SF 600, DD form 1380 or electronic medical record (EMR).' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6'],
    knowledges: [
      { id: 'K23525', name: 'Knowledge of the HIPAA documentation requirements' },
      { id: 'K27791', name: 'Roles and responsibilities of the MEDEVAC Consultant' },
      { id: 'K32388', name: 'Health Insurance Portability and Accountability (HIPAA) privacy rules and regulations' },
      { id: 'RLIM01', name: 'Knowledge of telemedicine principles' },
      { id: 'K27517', name: 'Intermediate Understanding of How to Implement Primary, Alternate, Contingency, and Emergency (PACE)' },
      { id: 'K25041', name: 'Know the duties and responsibilities of the Clinical Consultant' },
      {
        id: 'K729',
        name: 'Identify Basic Facts about Health Insurance Portability and Accountability Act (HIPAA) Medical Device Compliance',
      },
    ],
    skills: [
      { id: 'S0555', name: 'Utilize communication procedures' },
      { id: '805C-S-0822', name: 'Ability to apply effective communication skills' },
      { id: 'S3582', name: 'Determine if a communication is confidential' },
      { id: '052-S-00014', name: 'Possess Effective Communication Skills' },
      { id: 'S8812', name: 'Maintain the Medical Digital Imaging Network Picture Archiving and Communication System' },
    ],
    references: [
      {
        refId: 'CPG ID: 94',
        refName: 'Joint Trauma System Clinical Practice Guidelines on Telemedicine Guidance in the Deployed Setting',
        required: true,
        primary: true,
      },
      { refId: 'JTS-CPGS', refName: 'Joint Trauma System Clinical Practice Guidelines', required: true, primary: false },
      {
        refId: 'TEXTDERM',
        refName: 'The Electronic Textbook of Dermatology,',
        required: true,
        primary: false,
        source: 'http://telemedicine.org/stamford.htm',
      },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // Verbatim per the 081-000-0125 note: "thorughout", "evaculation", "Solider" (twice), "when
    // indicates", and the lower-case sentence fragment "while adhering to..." in Standards are the
    // packet's own. Measures 1/3 are also published in present tense against past-tense steps.
    taskNumber: '081-68W-0283',
    title: 'Conduct Patient Transfer',
    status: 'Approved',
    reportDate: '2026-03-12',
    proponentMos: '68W',
    conditions:
      'You are a 68W in an operational environment. You must conduct patient movement thorughout the TCCC task: 081-000-0049 , Perform Tactical Combat Casualty Care. The tactical situation requires the patient is transferred until an evaculation platform arrives, handoff, and patient transfer is completed. You are directed, by leadership, to move this patient until you and your team are able to meet up with the evacuation platform. Given a casualty requiring evacuation or relocation during Role 1 care; a tactical environment (day or night, all weather); individual protective equipment; a litter or improvised carry device; available evacuation platforms (ground or air); a team of rescuers when required; and a requirement to provide a patient handoff to a receiving medical provider or evacuation crew. This task should not be trained in MOPP 4.',
    standards:
      'Conduct Patient Transfer in accordance with (IAW) ATP 4-02.13, Casualty Evacuation. The Soldier safely moves the casualty using the appropriate carry or litter technique, prevents further injury, maintains spinal precautions when indicates. The Solider will secure the casualty for evacuation, loads and unloads the casualty correctly onto evacuation platforms. The Solider will also provide a complete, accurate patient handoff report to the receiving medical personnel. All actions will be performed without compromising casualty safety or mission requirements. while adhering to all performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions: 'None',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'None',
    danger: 'None',
    warning: 'None',
    caution: 'None',
    remarks: 'None',
    notes:
      'Please be advised: ATP 4-02.13 Casualty Evacuation (June 2021) will be rescinded upon the publishing of ATP 3-08.13 Casualty Evacuation Tactics, Techniques, and Procedures (currently in initial draft).',
    performanceSteps: [
      { number: '1', text: 'Assess the Situation and Prepare for Movement.' },
      { number: '1a', text: 'Determine the need for casualty movement (danger, cover, evacuation timeline, PCC requirements).', isSubStep: true },
      { number: '1b', text: 'Identify the safest and most tactically appropriate route.', isSubStep: true },
      {
        number: '1c',
        text: 'Select the appropriate movement technique based on casualty condition, distance, terrain, personnel, and threat.',
        isSubStep: true,
      },
      { number: '1d', text: 'Communicate the movement plan to assisting personnel.', isSubStep: true },
      {
        number: '2',
        text: 'Perform Manual Carries (as appropriate).',
        note: 'Use only when a litter is not available or when rapid movement is required.',
      },
      { number: '2a', text: 'Execute the appropriate manual carry technique.', isSubStep: true },
      { number: '2a(1)', text: 'Fireman’s Carry.', isSubStep: true },
      { number: '2a(2)', text: 'Pack Strap Carry.', isSubStep: true },
      { number: '2a(3)', text: 'Neck Drag.', isSubStep: true },
      { number: '2a(4)', text: 'Cradle Drop Drag.', isSubStep: true },
      { number: '2a(5)', text: 'Two Person Support Carry.', isSubStep: true },
      { number: '2a(6)', text: 'Two Person Fore and Aft Carry.', isSubStep: true },
      { number: '2a(7)', text: 'Two person Modified Fore and AFT Carry.', isSubStep: true },
      { number: '2a(8)', text: 'Two Person Litter less Carry.', isSubStep: true },
      { number: '2a(9)', text: 'Three-Person Carry.', isSubStep: true },
      { number: '2a(10)', text: 'Four-Person Rapid Carry.', isSubStep: true },
      { number: '2a(11)', text: 'Four-Person Carry.', isSubStep: true },
      { number: '2b', text: 'Maintain airway protection throughout movement.', isSubStep: true },
      { number: '2c', text: 'Avoid exacerbating injuries during movement.', isSubStep: true },
      { number: '2d', text: 'Move with deliberate, controlled motion.', isSubStep: true },
      { number: '3', text: 'Prepare and Use a Litter.' },
      { number: '3a', text: 'Select appropriate litter (standard, Talon, poleless, improvised).', isSubStep: true },
      { number: '3b', text: 'Inspect litter for serviceability.', isSubStep: true },
      { number: '3c', text: 'Position litter on stable ground.', isSubStep: true },
      { number: '3d', text: 'Prepare casualty for litter movement:', isSubStep: true },
      { number: '3d(1)', text: 'Secure airway adjuncts, lines, tubes, splints, and dressings.', isSubStep: true },
      { number: '3d(2)', text: 'Apply hypothermia prevention measures.', isSubStep: true },
      { number: '3d(3)', text: 'Maintain spinal precautions if indicated.', isSubStep: true },
      { number: '3e', text: 'Execute coordinated lift (“Prepare to lift… LIFT”).', isSubStep: true },
      { number: '3f', text: 'Place casualty onto litter using log roll or scoop technique as appropriate.', isSubStep: true },
      { number: '3g', text: 'Secure casualty with straps (chest, pelvis, lower extremities, head/spine as required).', isSubStep: true },
      { number: '4', text: 'Move the Casualty Using a Litter.' },
      { number: '4a', text: 'Assign bearer positions.', isSubStep: true },
      { number: '4b', text: 'Maintain litter level and stable.', isSubStep: true },
      { number: '4c', text: 'Move at appropriate pace for terrain and casualty condition.', isSubStep: true },
      { number: '4d', text: 'Use proper lifting mechanics.', isSubStep: true },
      { number: '4e', text: 'Rotate bearers as needed.', isSubStep: true },
      { number: '5', text: 'Load Casualty onto Ground Evacuation Platform.' },
      { number: '5a', text: 'Coordinate with vehicle crew.', isSubStep: true },
      { number: '5b', text: 'Approach from safest direction.', isSubStep: true },
      { number: '5c', text: 'Maintain litter level during loading.', isSubStep: true },
      { number: '5d', text: 'Load casualty per platform SOP.', isSubStep: true },
      { number: '5e', text: 'Secure litter to platform attachment points.', isSubStep: true },
      { number: '5f', text: 'Reassess casualty after loading.', isSubStep: true },
      { number: '6', text: 'Load Casualty onto Air Evacuation Platform.' },
      { number: '6a', text: 'Secure all loose equipment and medical items prior to approaching equipment.', isSubStep: true },
      { number: '6b', text: 'Do not approach aircraft unless directed to by air crew, maintain rotor wash awareness.', isSubStep: true },
      { number: '6c', text: 'Approach the aircraft IAW aircrew instructions.', isSubStep: true },
      { number: '6d', text: 'Maintain low silhouette.', isSubStep: true },
      { number: '6e', text: 'Load casualty as directed (typically feetfirst).', isSubStep: true },
      { number: '6f', text: 'Secure the litter to the aircraft litter handling system.', isSubStep: true },
      { number: '7', text: 'Unload Casualty from Evacuation Platform.' },
      { number: '7a', text: 'Coordinate with crew.', isSubStep: true },
      { number: '7b', text: 'Maintain litter stability during unloading.', isSubStep: true },
      { number: '7c', text: 'Move casualty to designated receiving area.', isSubStep: true },
      { number: '7d', text: 'Reassess casualty after unloading.', isSubStep: true },
      { number: '8', text: 'Conduct Patient Handoff to Receiving Medical Personnel.' },
      { number: '8a', text: 'Provide a complete, concise handoff using MIST plus PCC considerations.', isSubStep: true },
      { number: '8b', text: 'Transfer all documentation (DD1380, blood product tags, medication logs).', isSubStep: true },
      { number: '8c', text: 'Ensure receiving provider acknowledges transfer of responsibility.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Assessed the Situation and Prepare for Movement.' },
      { number: '2', text: 'Performed Manual Carries (as appropriate).' },
      { number: '3', text: 'Prepared and Use a Litter.' },
      { number: '4', text: 'Moved the Casualty Using a Litter.' },
      { number: '5', text: 'Loaded Casualty onto Ground Evacuation Platform.' },
      { number: '6', text: 'Loaded Casualty onto Air Evacuation Platform.' },
      { number: '7', text: 'Unloaded Casualty from Evacuation Platform.' },
      { number: '8', text: 'Conducted Patient Handoff to Receiving Medical Personnel.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7', '8'],
    knowledges: [
      { id: '081-PAD-68G-KN140', name: 'Knowledge of patient movement classifications.' },
      { id: '081-C2-68W-0096', name: 'Describe positioning the patient.' },
      { id: 'K25965', name: 'Know how to transport a casualty' },
      { id: 'K25961', name: 'Know how to read and understand the calibration date' },
      { id: '081-FD-70E-1089', name: 'Knowledge of contingency patient movement' },
    ],
    skills: [
      { id: '081-PAD-68G-SK114', name: 'Identify patient movement classification.' },
      { id: 'S0243', name: 'Ability to apply required steps of the battle analysis methodology in determining battle strategy' },
      { id: '081-C2-68W-0251', name: 'Demonstrate carrying a casualty.' },
      { id: 'S6541', name: 'Ability to interpret a vehicle loading plan' },
      { id: '081-C2-68W-0244', name: 'Demonstrate carrying a casualty.' },
    ],
    references: [{ refId: 'ATP 4-02.13', refName: 'Casualty Evacuation', required: true, primary: true }],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // Conditions reads "foodborn, and wate born" where Standards reads "foodborne, and wasteborne".
    // Both as published. The only non-clinical task on the roster — it grades a medic advising a
    // commander and running a Field Sanitation Team, not treating a patient.
    taskNumber: '081-68W-0005',
    title: 'Conduct Unit Field Sanitation Measures',
    status: 'Approved',
    reportDate: '2026-03-07',
    proponentMos: '68W',
    conditions:
      'You are a medic in an operational environment tasked by the commander to enforce field sanitation measures. You will be provided with a Field Sanitation Team (FST) and the required supplies to ensure that threats from waterborne, foodborn, and wate born illnesses are mitigated. This task should not be trained in MOPP 4.',
    standards:
      'Conduct unit field sanitation measures ensuring effective preventive measures are in place to mitigate threats from waterborne, foodborne, and wasteborne illnesses to include environmental threats in accordance with (IAW) TC 4-02.3, Field Hygiene and Sanitation, while adhering to all warnings and cautions, without error, using the GO/NO-GO checklist.',
    specialConditions: 'None',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'The 68W is directed, to perform field sanitation functions at the company level in the operational environment.',
    danger: 'None',
    warning: 'None',
    caution: 'None',
    remarks: 'None',
    notes: 'None',
    performanceSteps: [
      { number: '1', text: 'Brief the commander on preventive medicine and field sanitation requirements.' },
      { number: '1a', text: 'Identify DNBI risks associated with mission, terrain, climate, and operational conditions.', isSubStep: true },
      {
        number: '1b',
        text: 'Recommend preventive measures for water safety, waste disposal, food sanitation, vector control, and personal hygiene.',
        isSubStep: true,
      },
      { number: '1c', text: 'Provide technical input during planning, site selection, and sustainment operations.', isSubStep: true },
      { number: '1d', text: 'Communicate emerging health threats and environmental hazards promptly.', isSubStep: true },
      { number: '2', text: 'Conduct training for the FST.' },
      { number: '2a', text: 'Ensure FST members understand duties outlined in ATP 4-25.12.', isSubStep: true },
      { number: '2b', text: 'Train or reinforce skills in:', isSubStep: true },
      { number: '2b(1)', text: 'Water testing and disinfection procedures.', isSubStep: true },
      { number: '2b(2)', text: 'Waste disposal methods (cat holes, burn-out latrines, soakage pits, etc.).', isSubStep: true },
      { number: '2b(3)', text: 'Food service sanitation and temperature control.', isSubStep: true },
      { number: '2b(4)', text: 'Vector and rodent control measures.', isSubStep: true },
      { number: '2b(5)', text: 'Personal hygiene enforcement and troop education.', isSubStep: true },
      { number: '2c', text: 'Verify FST equipment is present, functional, and used correctly.', isSubStep: true },
      { number: '2d', text: 'Review FST inspection findings and provide technical corrections.', isSubStep: true },
      { number: '3', text: 'Manage the FST during inspections.' },
      { number: '3a', text: 'Inspect water points for proper chlorination, layout, and protection.', isSubStep: true },
      {
        number: '3b',
        text: 'Inspect food service operations for cleanliness, temperature control, cross contamination risks, and waste handling.',
        isSubStep: true,
      },
      { number: '3c', text: 'Inspect latrines, waste disposal sites, and gray water systems for compliance with TC 4-02.3.', isSubStep: true },
      { number: '3d', text: 'Inspect troop billeting areas for overcrowding, ventilation, cleanliness, and hygiene compliance.', isSubStep: true },
      { number: '3e', text: 'Inspect shower and laundry facilities for proper drainage, spacing, and sanitation.', isSubStep: true },
      { number: '3f', text: 'Document deficiencies, categorize hazards, and recommend corrective actions to leadership.', isSubStep: true },
      { number: '4', text: 'Monitor DNBI trends.' },
      { number: '4a', text: 'Track sick call patterns and identify sanitation related illnesses.', isSubStep: true },
      {
        number: '4b',
        text: 'Identify clusters of heat injuries, gastrointestinal illness, dermatological issues, respiratory illness, or vector borne disease indicators.',
        isSubStep: true,
      },
      { number: '4c', text: 'Compare DNBI rates to historical or expected baselines.', isSubStep: true },
      { number: '5', text: 'Report DNBI trends.' },
      { number: '5a', text: 'Report trends to the commander and medical leadership.', isSubStep: true },
      { number: '5b', text: 'Recommend preventive measures to reduce DNBI rates.', isSubStep: true },
      { number: '6', text: 'Ensure individual preventive medicine measures.' },
      { number: '6a', text: 'Educate soldiers on hygiene, hydration, foot care, and uniform wear for climate injury prevention.', isSubStep: true },
      { number: '6b', text: 'Reinforce proper use of insect repellent, permethrin treated uniforms, and bed nets.', isSubStep: true },
      { number: '6c', text: 'Support leaders in enforcing compliance with hygiene and sanitation standards.', isSubStep: true },
      { number: '6d', text: 'Provide corrective instruction when deficiencies are observed.', isSubStep: true },
      { number: '7', text: 'Coordinate with higher medical and preventive medicine assets.' },
      {
        number: '7a',
        text: 'Request technical support when hazards exceed unit capability (e.g., water testing beyond FST capability, vector identification, environmental sampling).',
        isSubStep: true,
      },
      { number: '7b', text: 'Share inspection findings, DNBI data, and environmental concerns with supporting PM detachments.', isSubStep: true },
      { number: '7c', text: 'Implement recommendations from higher medical authorities.', isSubStep: true },
      { number: '8', text: 'Provide a command report on the unit’s preventive medicine status.' },
      {
        number: '8a',
        text: 'Summarize current sanitation conditions across water, waste, food service, billeting, and hygiene areas.',
        isSubStep: true,
      },
      { number: '8b', text: 'Report DNBI trends, including any increases in sanitation related illness.', isSubStep: true },
      {
        number: '8c',
        text: 'Ensure the report is clear, concise, accurate, and actionable to support command decision making.',
        isSubStep: true,
      },
    ],
    performanceMeasures: [
      { number: '1', text: 'Briefed the commander on preventive medicine and field sanitation requirements.' },
      { number: '2', text: 'Conducted training for the FST.' },
      { number: '3', text: 'Managed the FST during inspections.' },
      { number: '4', text: 'Monitored DNBI trends.' },
      { number: '5', text: 'Reported DNBI trends.' },
      { number: '6', text: 'Ensured individual preventive medicine measures.' },
      { number: '7', text: 'Coordinated with higher medical and preventive medicine assets.' },
      { number: '8', text: 'Provided a command report on the unit’s preventive medicine status.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7', '8'],
    knowledges: [
      { id: '081-TI-CMN-0188', name: 'Know proper PMMs for protection against non-NBC chemical hazards.' },
      { id: '081-TI-CMN-0189', name: 'Know proper PMMs for protection against noise hazard injuries.' },
      { id: '081-TI-CMN-0148', name: 'Know proper PMMs for protection against diseases from contaminated food and water.' },
      { id: '081-TI-CMN-0186', name: 'Know proper PMMs for protection against arthropod (insect) bites and arthropod-borne diseases.' },
      { id: '052-K-00095', name: 'Knowledge of Environmental Threats' },
      { id: '081-TI-CMN-0150', name: 'Know proper PMMs for protection against diseases from human waste.' },
      { id: 'K8111', name: 'Water Disinfection' },
      { id: '081-TI-CMN-0199', name: 'Know the tasks/responsibilities of a field sanitation team.' },
    ],
    skills: [
      { id: '101-S-0001', name: 'Ability to Identify Potential Environmental Hazards' },
      { id: '011-1045S', name: 'How to choose water and food in a tropic environment.' },
      { id: '011-1046S', name: 'How to purify water.' },
      { id: '011-1047S', name: 'How to use the canteen in the purification of water.' },
    ],
    references: [
      { refId: 'TC 4-02.3', refName: 'FIELD HYGIENE AND SANITATION', required: true, primary: true },
      {
        refId: 'ATP 4-25.12',
        refName: 'Unit Field Sanitation Teams',
        required: true,
        primary: false,
        source: 'http://armypubs.army.mil/doctrine/DR_pubs/dr_a/pdf/atp4_25x12.pdf',
      },
    ],
    prerequisiteTasks: [],
    supportingTasks: ['081-68M-1100', '081-COM-1053'],
  },
  {
    // NO tcccModuleRef, deliberately, despite listing 25 TCCC modules in its reference table — the
    // whole point of PCC is that it spans the entire curriculum, so no single module is "the"
    // rolled-up component. Same reasoning as 0108 and 0231. Note those references are the Combat
    // PARAMEDIC/Provider series, a different track from the Combat Medic/Corpsman modules the
    // trauma packets cite, which is why they are not mapped to entries in TcccModules.ts.
    taskNumber: '081-000-1020',
    title: 'Perform Prolonged Casualty Care',
    status: 'Approved',
    reportDate: '2026-03-12',
    proponentMos: '68W',
    conditions:
      "You are a 68W Combat Medic Specialist assigned to a maneuver platoon conducting decisive action operations in a contested environment. You have completed a Tactical Combat Casualty Care (TCCC) assessment (Task 081-000-0049) on a casualty who requires continued medical care. You are notified by your chain of command that medical evacuation is delayed, and you must provide prolonged casualty care for an undetermined period of time. You are provided with Prolonged Casualty Care (PCC) guidelines (CPG ID: 91, when applicable), Unit SOP's and non-medical responders available to assist, tactical communications equipment to communicate with higher medical authority, and an Individual First Aid Kit (IFAK), aid bag, task-specific medical equipment/supplies. You may encounter hostile fire, low visibility, limited medical evacuation support, and high-stress conditions. This task should not be trained in MOPP 4.",
    standards:
      'Perform prolonged casualty care in accordance with (IAW) JTS-CPGS Joint Trauma System Clinical Practice Guidelines (CPG ID: 91). Continuous monitoring and reassessment of the casualty s condition, management of life-threatening conditions and preventable death, administering nursing treatments within scope of practice and documenting all findings, while adhering to all performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions: 'None',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You receive guidance that evacuation will be delayed and must provide prolonged care to the casualty/casualties under your care.',
    danger: 'None',
    warning: 'None',
    caution: 'None',
    remarks: 'None',
    notes: 'None',
    performanceSteps: [
      { number: '1', text: 'Perform re-assessment and re-apply MARCH interventions according to patient presentation and unit movement.' },
      {
        number: '1a',
        text: 'Continuously monitor assisted ventilations, if applicable.',
        isSubStep: true,
        note: 'It is highly recommended that 68W get both experience and training from their Medical Director.',
      },
      { number: '1b', text: 'Suction mouth/airway, as often as required.', isSubStep: true },
      {
        number: '2',
        text: 'Perform comprehensive physical exam and detailed history with problem list and care plan.',
        note: 'Perform initial lifesaving care using TCCC guidelines / Treat a Combat Casualty Task id: 081-000-0049.',
      },
      { number: '3', text: 'Record and trend vital signs.' },
      { number: '4', text: 'Perform a teleconsultation, if needed. (See Employ Telemedicine Task: 081-68W-0167)' },
      { number: '5', text: 'Create nursing care plan IAW JTS CPG 91.' },
      { number: '6', text: 'Implement a nursing care plan IAW JTS CPG 91.' },
      { number: '6a', text: 'Perform lip care.', isSubStep: true },
      { number: '6b', text: 'Perform oral care.', isSubStep: true },
      { number: '6c', text: 'Perform Cough/Deep Breathing.', isSubStep: true },
      { number: '6d', text: 'Perform Repositioning/ Check Padding.', isSubStep: true },
      { number: '6e', text: 'Perform splint care.', isSubStep: true },
      { number: '6f', text: 'Perform continuous thermoregulation management.', isSubStep: true },
      { number: '6g', text: 'Perform continuous head injury/TBI management.', isSubStep: true },
      { number: '6h', text: 'Perform pain management.', isSubStep: true },
      { number: '6i', text: 'Perform antibiotic delivery.', isSubStep: true },
      { number: '6j', text: 'Perform sepsis management, as need.', isSubStep: true },
      { number: '6j(1)', text: 'Perform wound irrigation.', isSubStep: true },
      { number: '6j(2)', text: 'Perform dressing change.', isSubStep: true },
      { number: '6j(3)', text: 'Reassess IV/IO and perform necessary site care.', isSubStep: true },
      { number: '7', text: 'Perform non-medical interventions IAW CPG 91.' },
      { number: '7a', text: 'Implement psycho-social needs, continuously.', isSubStep: true },
      { number: '7b', text: 'Implement patient nutrition plan.', isSubStep: true },
      { number: '7c', text: 'Implement patient hygiene plan.', isSubStep: true },
      { number: '7d', text: 'Perform patient bowel management assistance.', isSubStep: true },
      { number: '8', text: 'Anticipate resupply and electrical issues.' },
      { number: '9', text: 'Perform periodic mini rounds assessments.' },
      { number: '9a', text: 'Consider the following:', isSubStep: true },
      { number: '9a(1)', text: 'Is the patient stable or unstable?', isSubStep: true },
      { number: '9a(2)', text: 'Is the patient sick or not sick?', isSubStep: true },
      { number: '9a(3)', text: 'Is the patient getting better or getting worse?', isSubStep: true },
      { number: '9a(4)', text: 'How is this assessment different from the last assessment?', isSubStep: true },
      {
        number: '9b',
        text: 'Review of systems can allow the medic to recognize changes in the condition of the patient and reprioritize interventions.',
        isSubStep: true,
      },
      {
        number: '9c',
        text: 'Report identified significant clinical improvements or declines to medical chain of command and any telemedicine consultant involved, if tactically available and secure.',
        isSubStep: true,
      },
      { number: '10', text: 'Prepare for transportation or evacuation care.' },
      {
        number: '11',
        text: 'Complete documentation on the current Prolonged Field Care Casualty Card (current version per JTS) and/or electronic health record.',
      },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed re-assessment and re-apply MARCH interventions according to patient presentation and unit movement.' },
      { number: '2', text: 'Performed comprehensive physical exam and detailed history with problem list and care plan.' },
      { number: '3', text: 'Recorded and trend vital signs.' },
      { number: '4', text: 'Performed a teleconsultation (See Employ Telemedicine Task: 081-68W-0167)' },
      { number: '5', text: 'Created nursing care plan IAW JTS CPG 91.' },
      { number: '6', text: 'Implemented a nursing care plan IAW JTS CPG 91.' },
      { number: '7', text: 'Performed non-medical interventions IAW CPG 91.' },
      { number: '8', text: 'Anticipated resupply and electrical issues.' },
      { number: '9', text: 'Performed periodic mini rounds assessments.' },
      { number: '10', text: 'Prepared for transportation or evacuation care.' },
      { number: '11', text: 'Completed documentation on the current Prolonged Field Care Casualty Card (DD 1380) and/or electronic health record.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    knowledges: [
      { id: 'K31116', name: 'Identify fundamental principles of prolonged casualty care.' },
      { id: 'K31115', name: 'Understand principles of prolonged casualty care.' },
      { id: 'K31118', name: 'Understand airway management principles for prolonged casualty care.' },
      { id: 'K31117', name: 'Understand damage control resuscitation principles for prolonged casualty care.' },
    ],
    references: [
      { refId: 'JTS-CPGS', refName: 'Joint Trauma System Clinical Practice Guidelines', required: true, primary: true },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'Module 1: Principles and Application of Tactical Combat Casualty Care (TCCC)', refName: 'Combat Paramedic / Provider TCCC - Module 1', required: true, primary: false },
      { refId: 'Module 2: Medical Equipment', refName: 'Combat Paramedic / Provider TCCC - Module 2', required: true, primary: false },
      { refId: 'Module 3: Care Under Fire/Threat', refName: 'Combat Paramedic / Provider TCCC - Module 3', required: true, primary: false },
      { refId: 'Module 4: Principles and Application of Tactical Field Care (TFC)', refName: 'Combat Paramedic / Provider TCCC - Module 4', required: true, primary: false },
      { refId: 'Module 5: Tactical Trauma Assessment', refName: 'Combat Paramedic / Provider TCCC - Module 5', required: true, primary: false },
      { refId: 'Module 6: Massive Hemorrhage Control', refName: 'Combat Paramedic / Provider TCCC - Module 6', required: true, primary: false },
      { refId: 'Module 7: Airway Management in TFC', refName: 'Combat Paramedic / Provider TCCC - Module 7', required: true, primary: false },
      {
        refId: 'Module 08: Respiration Assessment and Management in Tactical Field Care',
        refName: 'TCCC Combat Paramedic / Provider - Skills Assessment: Module 08',
        required: true,
        primary: false,
      },
      { refId: 'Module 8: Respiration Assessment and Management in TFC', refName: 'Combat Paramedic / Provider TCCC - Module 8', required: true, primary: false },
      { refId: 'Module 9: Circulation Hemorrhage Control in TFC', refName: 'Combat Paramedic / Provider TCCC - Module 9', required: true, primary: false },
      { refId: 'Module 10: Shock Recognition and Management', refName: 'Combat Paramedic / Provider TCCC - Module 10', required: true, primary: false },
      { refId: 'Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC', refName: 'Combat Paramedic / Provider TCCC - Module 11', required: true, primary: false },
      { refId: 'Module 12: Hypothermia Prevention and Treatment', refName: 'Combat Paramedic / Provider TCCC - Module 12', required: true, primary: false },
      { refId: 'Module 13: Head Injuries', refName: 'Combat Paramedic / Provider TCCC - Module 13', required: true, primary: false },
      { refId: 'Module 14: Eye Injuries', refName: 'Combat Paramedic / Provider TCCC - Module 14', required: true, primary: false },
      { refId: 'Module 15: Pain Medications (Analgesia)', refName: 'Combat Paramedic / Provider TCCC - Module 15', required: true, primary: false },
      { refId: 'Module 16: Antibiotic Administration', refName: 'Combat Paramedic / Provider TCCC - Module 16', required: true, primary: false },
      { refId: 'Module 17: Wound Management', refName: 'Combat Paramedic / Provider TCCC - Module 17', required: true, primary: false },
      { refId: 'Module 18: Burns', refName: 'Combat Paramedic / Provider TCCC - Module 18', required: true, primary: false },
      { refId: 'Module 19: Fractures', refName: 'Combat Paramedic / Provider TCCC - Module 19', required: true, primary: false },
      { refId: 'Module 20: Casualty Monitoring', refName: 'Combat Paramedic / Provider TCCC - Module 20', required: true, primary: false },
      { refId: 'Module 21: Communication Procedures', refName: 'Combat Paramedic / Provider TCCC - Module 21', required: true, primary: false },
      {
        refId: 'Module 22: Cardiopulmonary Resuscitation in Tactical Field Care',
        refName: 'Combat Paramedic / Provider TCCC - Module 22',
        required: true,
        primary: false,
      },
      { refId: 'Module 24: Prepare for Evacuation', refName: 'Combat Paramedic / Provider TCCC - Module 24', required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // ⚠️ MEASURE 4 GRADES TIGHTER THAN STEP 4 TEACHES. Step 4's note says estimate TBSA "to the
    // nearest 10% using the Rule of Nines"; measure 4 scores it "within 5% of the correct amount."
    // That is an internal inconsistency in the approved packet, reproduced as published — do not
    // reconcile it here. Flag it to the proponent, not to this file.
    taskNumber: '081-000-0044',
    title: 'Treat a Patient With Burn Injuries',
    status: 'Approved',
    reportDate: '2026-03-04',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic assigned to a combat or operational environment, and while on patrol you are provided with a patient with burn injuries. Your patient requires a burn examination and interventions. You have access to an Individual First Aid Kit (IFAK), combat medic aid bag, burn dressings, and necessary medical equipment/supplies. You have access to Tactical Combat Casualty Care Card ( TCCC) guidelines and unit SOP. You may encounter hostile fire, low visibility, limited evacuation support, and high-stress conditions. This task should not be trained in MOPP 4. This task should be trained under IED Threat conditions.',
    standards:
      'Treat a patient with burns in accordance with TCCC CMC Module 18 Burns while adhering to all warnings and cautions, without error or causing further harm to the patient, using the GO/NO-GO checklist',
    specialConditions: 'None',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'None',
    danger: 'None',
    warning: 'None',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection. Do not remove clothing that is stuck to the burned area. If the clothing and skin are still hot, irrigate with copious amounts of room-temperature water or cover with a wet dressing, if available. The swelling of burns on extremities can cause a tourniquet-like effect, and the swelling of a burned throat can impair breathing. Do not remove clothing that is stuck to the burned area.',
    remarks: 'None',
    notes:
      'This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    performanceSteps: [
      { number: '1', text: 'Stop the burning process.' },
      {
        number: '2',
        text: 'Monitor airway status.',
        warning:
          '30 to 40 minutes may elapse before edema obstructs the airway and respiratory distress is noted. Always suspect an inhalation injury with a closed-space fire.',
      },
      { number: '2a', text: 'Frequently reassess, especially with facial burns or burns in enclosed spaces.', isSubStep: true },
      { number: '2b', text: 'Consider surgical airway for respiratory distress associated with inhalation injury.', isSubStep: true },
      {
        number: '3',
        text: 'Remove clothing around the burned area.',
        note: 'Consider lifting clothing gently away from the burned area, to preserve the clothing for hypothermia prevention.',
      },
      {
        number: '4',
        text: 'Estimate total body surface area (TBSA).',
        note: 'Estimate burned area should be to the nearest 10% using the Rule of Nines.',
      },
      {
        number: '5',
        text: 'Remove jewelry.',
        note: '(i.e., rings, watches) from burned extremities and place them securely in casualty’s pockets.',
      },
      { number: '6', text: 'Apply sterile, dry dressings to burned skin areas.' },
      {
        number: '7',
        text: 'Prevent hypothermia.',
        note: 'Use insulated hypothermia enclosure system if burns >20%. Consider barrier heat-loss prevention due to burn patients’ high hypothermia risk.',
      },
      {
        number: '8',
        text: 'Initiate fluid resuscitation.',
        note: 'Deliver fluids IAW CPG 20 soon as IV/IO access was established (if burns >20% TBSA) or using oral fluids for burns equal to or less than 30% TBSA if patient is conscious and able to swallow.',
      },
      { number: '8a', text: 'Select appropriate burn resuscitation fluid IAW CoTCCC Guidelines and CPG ID:20.', isSubStep: true },
      { number: '8b', text: 'Calculate fluid administration rate using USAISR Rule of Ten:', isSubStep: true },
      { number: '8b(1)', text: 'Adults 40–80 kg: %TBSA × 10 mL/hr.', isSubStep: true },
      { number: '8b(2)', text: 'Add 100 mL/hr for every 10 kg above 80 kg.', isSubStep: true },
      { number: '9', text: 'Administer analgesia IAW CPG 20.' },
      { number: '10', text: 'Administer antibiotics IAW CPG 20.' },
      {
        number: '11',
        text: 'Monitor patient for life-threatening conditions.',
        note: 'Assess for additional injuries, and treat for shock if applicable.',
      },
      { number: '12', text: 'Record time and volume of fluids administered during first 24 hours.' },
      { number: '13', text: 'Document all findings and treatments on DD Form 1380 and attached it to the casualty.' },
    ],
    performanceMeasures: [
      { number: '1', text: 'Stopped the burning process.' },
      { number: '2', text: 'Monitored airway status.' },
      { number: '3', text: 'Removed clothing around the burned area.' },
      { number: '4', text: 'Estimated total body surface area (TBSA) within 5% of the correct amount.' },
      { number: '5', text: 'Removed jewelry.' },
      { number: '6', text: 'Applied sterile, dry dressings to burned skin areas.' },
      { number: '7', text: 'Prevented hypothermia.' },
      { number: '8', text: 'Initiated fluid resuscitation.' },
      { number: '9', text: 'Administered analgesia IAW CPG 20.' },
      { number: '10', text: 'Administered antibiotics IAW CPG 20.' },
      { number: '11', text: 'Monitored patient for life-threatening conditions.' },
      { number: '12', text: 'Recorded time and volume of fluids administered during first 24 hours.' },
      { number: '13', text: 'Documented all findings and treatments on DD Form 1380 and attached it to the casualty.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
    tcccModuleRef: 'tccc-burns',
    knowledges: [
      { id: 'K31030', name: 'Identify fundamental principles for treating burn casualties.' },
      { id: '081-C2-68W-0032', name: 'Describe the differences between first, second and third degree burns.' },
      { id: '081-SR-68P-R245', name: 'Knowledge of burns' },
      { id: '081-UE-FMC-5648', name: 'Identify the Complications of Thermal Burns' },
      { id: '081-UE-FMC-5650', name: 'Identify the Complications of Electrical Burns' },
      { id: '081-C2-68W-0472', name: 'Knowledge of the relationship between airway management and chest, burns, blunt and penetrating' },
      { id: '081-C2-68W-0457', name: 'Knowledge of the classifications of burns.' },
      { id: 'K23299', name: 'Knowledge of the physiology of burns' },
      { id: '081-UE-FMC-5655', name: 'Identify the Complications of Chemical Burns/Trauma/Contamination' },
    ],
    skills: [
      { id: '081-C2-68W-0135', name: 'Assess and treat a casualty with a burn injury.' },
      { id: '081-C2-68W-0137', name: 'Determine burn severity classifications described by local protocol.' },
      { id: 'S8415', name: 'Perform procedures in the treatment of burns.' },
      { id: '081-C2-68W-0138', name: 'Determine critical burn area.' },
      { id: '081-C2-68W-0139', name: 'Determine degree of burn.' },
      { id: '081-C2-68W-0141', name: 'Use the "rules of nines" to determine percentage of body surface area of a burn injury.' },
    ],
    references: [
      { refId: 'Module 18: Burns', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 18', required: true, primary: true },
      { refId: 'CPG ID: 20', refName: 'Burn Care', required: true, primary: false },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'Deployed Medicine', refName: 'Standardized TCCC Training Across The Entire U.S. Military', required: true, primary: false },
      { refId: 'ISBN-13: 978-1284180589', refName: 'Prehospital Trauma Life Support, Military Edition, 9th Edition', required: true, primary: false },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
      { refId: 'UNIT SOP', refName: "Unit / Unit's Standard Operating Procedure SOP", required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // ⚠️ STEPS 3/4 CITE THE *STP* NUMBER FOR ADMINISTER BLOOD PRODUCTS, NOT THE ICTL ONE.
    // They read "task ID: 081-000-3054". That number is real — it is Administer Blood Products on
    // the STP roster (TrainingTaskList.ts, Skill Level 1 / Fluid Management, no authored content).
    // The ICTL's own number for the same task is 081-000-1025, authored above. So this is a
    // cross-roster reference, not a phantom: the packet was drafted against STP numbering and the
    // citation was never renumbered. Reproduced as published; it still will not resolve if
    // anything links ICTL task numbers programmatically. Proponent question.
    taskNumber: '081-000-0037',
    title: 'Treat a Patient With Chest Injury',
    status: 'Approved',
    reportDate: '2026-03-02',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic assigned to a garrison or operational environment, during the Respiration assessment of MARCH PAWS you identify a patient with a chest injury. The patient is exhibiting symptoms of respiratory distress and requires your intervention. You have an Individual First Aid Kit (IFAK), aid bag, occlusive/vented chest seals, needle decompression kit, and necessary medical equipment/supplies. You have access to DD Form 1380 TCCC Card, current TCCC Guidelines, JTS TCCC CMC Module 8 Respiration Assessment & Management in TFC skill sheets, and unit SOP. You may encounter hostile fire, low visibility, limited evacuation support, and high-stress conditions. This task should not be trained in MOPP 4. This task should be trained under IED Threat conditions.',
    standards:
      'Treat a patient with chest injury in accordance with (IAW) JTS TCCC CMC Module 8 Respiration Assessment & Management in TFC skill sheets , identifying type of chest injury, applying appropriate treatment (occlusive chest seal for open pneumothorax, and needle decompression for tension pneumothorax if indicated), reassessing the patient, and documenting all findings and treatments on DD Form 1380 TCCC Card, while adhering to all performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions:
      'Task may be performed during limited visibility conditions. Task may be performed under direct or indirect fire. Task should include training scenarios with IED blast injuries causing chest trauma. Task requires integration with other TCCC interventions including hemorrhage control and airway management. Task may involve multiple simultaneous chest injuries requiring prioritization.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient with chest injury exhibiting respiratory distress, penetrating chest wound, or signs of tension pneumothorax during Respiration assessment of MARCH PAWS.',
    danger:
      'Tension pneumothorax causes rapid cardiovascular collapse and death if not decompressed immediately. Use correct anatomical landmarks for needle insertion and avoid vascular or organ injury. Open pneumothorax requires immediate occlusive chest seal application to prevent respiratory failure. Bilateral tension pneumothorax demands decompression of both sides to prevent death.',
    warning:
      'Check for exit wounds and seal them to prevent air leaks. Reassess breath sounds after chest seal application to detect tension pneumothorax. Monitor for signs of tension pneumothorax and decompress immediately if needed.',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    remarks:
      'Chest injuries are a leading cause of preventable battlefield deaths, primarily due to open pneumothorax, tension pneumothorax, and massive hemothorax. Open pneumothorax results from penetrating trauma and is treated with an immediate occlusive chest seal application. If signs of respiratory distress are present, perform needle decompression. Check all penetrating chest wounds for exit wounds requiring separate seals. Reassess patients after interventions, as conditions can rapidly deteriorate. This task is part of Respiration assessment in MARCH PAWS and integrates with other TCCC interventions.',
    notes: '68W Combat Medic Specialist is the proponent for this task.',
    performanceSteps: [
      { number: '1', text: 'Identify chest injury/injuries.' },
      { number: '2', text: 'Treat chest injury or injuries IAW JTS TCCC CMC Module 8: Respiration Assessment and Management in TFC.' },
      {
        number: '2a',
        text: 'For open and/or sucking chest wound, treat with chest seal IAW JTS skill sheet.',
        isSubStep: true,
        tcccModuleRef: 'tccc-respiration-assessment-management#chest-seal',
      },
      {
        number: '2b',
        text: 'For suspected tension pneumothorax, treat with NDC IAW with JTS Needle Decompression of the Chest (NDC) skill sheet.',
        isSubStep: true,
        tcccModuleRef: 'tccc-respiration-assessment-management#needle-decompression',
      },
      { number: '3', text: 'Assess patient for resuscitation need IAW Administer Blood Products task ID: 081-000-3054.' },
      { number: '4', text: 'Provide patient with resuscitation interventions IAW Administer Blood Products task ID: 081-000-3054.' },
      { number: '5', text: 'Monitor and reassess your patient.' },
      { number: '6', text: 'Document care on DD 1380 (TCCC Card) or unit-approved documentation.' },
      { number: '6a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '6b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Identified chest injury/injuries.' },
      { number: '2', text: 'Treated chest injuries IAW JTS TCCC CMC Module 8: Respiration Assessment and Management in TFC.' },
      { number: '3', text: 'Assessed patient for resuscitation need IAW Administer Blood Products task ID: 081-000-3054.' },
      { number: '4', text: 'Provided patient with resuscitation interventions IAW Administer Blood Products task ID: 081-000-3054.' },
      { number: '5', text: 'Monitored and reassess your patient.' },
      { number: '6', text: 'Documented care on DD 1380 (TCCC Card) or unit-approved documentation.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6'],
    tcccModuleRef: 'tccc-respiration-assessment-management',
    knowledges: [
      { id: '081-C2-68W-0875', name: 'Discuss the anatomy and physiology of the organs and structures related to thoracic injuries.' },
      { id: '081-C2-68W-0917', name: 'Differentiate between thoracic injuries based on the assessment and history.' },
    ],
    skills: [
      { id: '081-C2-68W-0346', name: 'Demonstrate oxygenation and ventilation for management for thoracic injuries.' },
      { id: '081-C2-68W-0337', name: 'Demonstrate a clinical assessment for a casualty with suspected thoracic trauma.' },
    ],
    references: [
      {
        refId: 'Module 08: Respiration Assessment & Management in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 8',
        required: true,
        primary: true,
      },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'ISBN: 9781737131113', refName: 'Combat Medic Specialist Fieldcraft', required: true, primary: false },
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // NO tcccModuleRef, despite Module 13 being the primary reference. TAB C of the JTS memo
    // records TCCC-CMC skill(s) met = N/A for this ICT, so there is no gradable TCCC component to
    // roll up — a task-level ref would falsely claim one. Module 13 is captured as a reference row
    // instead, and no TcccModules stub was added because nothing would point at it.
    // Verbatim notes: Conditions cites 081-000-0049 as "Treat a combat casualty" where the roster
    // titles it "Perform Tactical Combat Casualty Care"; the reference table lists JTS CPGs twice,
    // once correctly and once as "Joint Trama System (JTS)"; "CEntral" and "Beterans" as published.
    taskNumber: '081-000-0040',
    title: 'Treat a Patient with Head Injury',
    status: 'Approved',
    reportDate: '2026-03-03',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic Specialist operating in a field or operational environment treating a patient with a head injury. You have completed task 081-000-0049 (Treat a combat casualty) and immediate life-threatening injuries have been addressed. You have IFAK, Aid bag, cervical collar, hypertonic saline, current MACE card, TCCC Guidelines, documentation capability (DD Form 1380, TCCC card, SF 600, or EMR), and unit SOP. This task should not be trained in MOPP 4.',
    standards:
      "Treat a patient with head injury IAW TCCC Guidelines. Casualty's head and cervical spine are manually stabilized. Type and severity of head injury are identified. Level of consciousness is assessed using AVPU method. Signs and symptoms of head injury are assessed including mechanism of injury and visual examination. Current MACE screening is performed if indicated. Head injury is managed with appropriate interventions. Moderate to severe TBI or unstable casualties are monitored with findings documented. Cerebral herniation is managed if present and en route to surgical care. All treatment is recorded on DD Form 1380, TCCC card, or EMR. Patient is prepared for evacuation as appropriate.",
    specialConditions: 'Task may be performed in low light or limited visibility conditions.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient presents with suspected or confirmed head injury requiring immediate assessment and treatment.',
    danger:
      'Improper movement of patients with suspected spinal injuries may result in permanent paralysis or death. Maintain manual stabilization of head and neck until casualty is properly immobilized.',
    warning:
      'Treat patients with any type of traumatic head injury or loss of consciousness as if they have a spinal injury. Brain injury leading to loss of function or death often occurs without evidence of skull fracture. Swelling or fluid collection can compress and destroy brain tissue. Failure to recognize signs of increased intracranial pressure may result in brain herniation and death. Monitor level of consciousness, pupil response, and vital signs continuously.',
    caution:
      'All body fluids should be considered potentially infectious. Always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as minimal standard of protection. Do not apply pressure to depressed skull fractures or exposed brain tissue. Do not remove impaled objects from the skull. Maintain airway without hyperextending neck.',
    remarks:
      'This task is critical for preventing secondary brain injury in combat patients. Proper assessment and monitoring of neurological status is essential for determining evacuation priority. Task should be performed under various environmental and tactical conditions.',
    notes:
      'Current MACE screening should be performed as soon as tactically feasible. Patients with suspected TBI require evacuation to Role 2 or higher medical facility. Maintain detailed documentation of neurological assessments for continuity of care. This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    performanceSteps: [
      {
        number: '1',
        text: "Confirm manual in-line stabilization of the patient's head and cervical spine.",
        note: 'Maintain stabilization until casualty is properly immobilized.',
      },
      {
        number: '2',
        text: 'Assess the patient for a suspected head injury.',
        note: 'Assessment must occur before determining the type and severity of the traumatic brain injury.',
      },
      { number: '2a', text: 'Identify mechanism of injury.', isSubStep: true },
      { number: '2a(1)', text: 'Blunt /closed TBI.', isSubStep: true },
      { number: '2a(2)', text: 'Penetrating /open TBI.', isSubStep: true },
      { number: '2b', text: 'Perform a visual assessment of scalp and skull trauma.', isSubStep: true },
      { number: '2c', text: 'Assess level of consciousness (LOC) using AVPU method.', isSubStep: true },
      { number: '2d', text: 'Perform Glasgow Coma Scale assessment.', isSubStep: true },
      { number: '2e', text: 'Signs of cerebral herniation.', isSubStep: true },
      {
        number: '2f',
        text: 'Identify any associated injuries that may cause altered mental status (hypoxia, hypovolemia, etc.).',
        isSubStep: true,
      },
      { number: '3', text: 'Manage suspected head injury IAW TCCC Guidelines.' },
      { number: '3a', text: 'Control hemorrhage from head and other injuries.', isSubStep: true },
      { number: '3b', text: 'Administer tranexamic acid if indicated.', isSubStep: true },
      { number: '3c', text: 'Secure airway as indicated.', isSubStep: true },
      { number: '3d', text: 'Provide supplemental oxygen if available.', isSubStep: true },
      { number: '3e', text: 'Resuscitate as indicated.', isSubStep: true },
      {
        number: '3f',
        text: 'Treat other immediately life-threatening injuries to prevent hypoxia and hypotension (secondary brain injury).',
        isSubStep: true,
      },
      { number: '3g', text: 'Prevent/treat hypothermia.', isSubStep: true },
      { number: '3h', text: 'Administer antibiotics for all open wounds per TCCC guidelines.', isSubStep: true },
      { number: '3i', text: 'Manage pain per TCCC guidelines.', isSubStep: true },
      {
        number: '4',
        text: 'Perform a Military Acute Concussion Evaluation Screening for Traumatic Brain Injury (MACE) IAW current guidance.',
        note: 'Stop the MACE assessment if any RED flag are observed and defer for urgent evacuation consideration.',
      },
      { number: '4a', text: 'Administer MACE assessment.', isSubStep: true },
      { number: '4b', text: 'Report results to medical provider or higher medical authority.', isSubStep: true },
      { number: '4c', text: 'Provide patient with post-concussion guidance per TCCC protocols.', isSubStep: true },
      { number: '5', text: 'Monitor moderate to severe TBI or unstable patients.' },
      { number: '5a', text: 'Decreases in level of consciousness.', isSubStep: true },
      { number: '5b', text: 'Prevent hypoxemia, maintain an oxygen saturation of >90%.', isSubStep: true },
      { number: '5c', text: 'Prevent hypotension, maintain a systolic blood pressure (SBP) between 100-110 mmHg.', isSubStep: true },
      {
        number: '6',
        text: 'Manage cerebral herniation if en route to surgical care.',
        note: 'Only perform for up to 20 minutes while evacuating to surgical capability.',
      },
      { number: '6a', text: 'Administer hypertonic saline IAW TCCC guidelines.', isSubStep: true },
      { number: '6b', text: 'Elevate head 30 degrees if not in shock.', isSubStep: true },
      { number: '6c', text: 'Hyperventilate to the targeted EtCO2 IAW TCCC guidelines.', isSubStep: true },
      { number: '7', text: 'Prepare patient for evacuation IAW TCCC guidelines and unit SOP.' },
      {
        number: '8',
        text: 'Record the treatment on the DD Form 1380, Tactical Combat Casualty Care (TCCC) or Electronic Medical Record (EMR).',
      },
    ],
    performanceMeasures: [
      { number: '1', text: "Confirmed manual in-line stabilization of the patient's head and cervical spine." },
      { number: '2', text: 'Assessed the patient for a suspected head injury.' },
      { number: '3', text: 'Managed suspected head injury IAW TCCC Guidelines.' },
      {
        number: '4',
        text: 'Performed a Military Acute Concussion Evaluation Screening for Traumatic Brain Injury (MACE) IAW current guidance.',
      },
      { number: '5', text: 'Monitored moderate to severe TBI or unstable patients.' },
      { number: '6', text: 'Managed cerebral herniation if en route to surgical care.' },
      { number: '7', text: 'Prepared patient for evacuation IAW TCCC guidelines and unit SOP.' },
      {
        number: '8',
        text: 'Recorded the treatment on the DD Form 1380, Tactical Combat Casualty Care (TCCC) or Electronic Medical Record (EMR).',
      },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7', '8'],
    knowledges: [
      { id: '081-C2-68W-0508', name: 'Knowledge of the anatomy and relate physiology of the CEntral Nervous System to head injuries.' },
      { id: '081-C2-68W-0365', name: 'Knowledge of control bleeding.' },
      { id: '081-C2-68W-0509', name: 'Knowledge of head injuries based on mechanism of injury.' },
      { id: '081-C2-68W-0511', name: 'Knowledge of the pathophysiology of head/ brain injuries.' },
      { id: '081-C2-68W-0515', name: 'Knowledge of pathophysiologic process with a head/ brain injury.' },
      { id: '081-C2-68W-0388', name: 'Discuss methods of assessing altered mental status.' },
      { id: '081-C2-68W-0516', name: 'Knowledge of head injury classifications (mild, moderate, severe).' },
      { id: '081-TI-CMN-0014', name: 'Know signs/symptoms of head injury.' },
      { id: '081-C2-68W-0517', name: 'Knowledge of rapid intervention/transport of the patient with a head/ brain injury.' },
      {
        id: '081-C2-68W-0518',
        name: 'Knowledge of management of the head/ brain injury patient (pharmacological and non-pharmacologic',
      },
      { id: '081-C2-68W-0343', name: 'Describe indications/contraindications for inserting an oropharyngeal/nasopharyngeal airway.' },
      { id: '081-C2-68W-0136', name: 'Knowledge of patient priorities for evacuation.' },
    ],
    skills: [
      { id: '081-C2-68W-0231', name: 'Ability to plan a patient evacuation' },
      { id: '081-C2-68W-0396', name: 'Demonstrate the ability to use personal protective equipment.' },
      { id: '081-C2-68W-0303', name: 'Assess and treat headache.' },
      { id: '081-C2-68W-0353', name: 'Demonstrate the techniques for assessing mental status.' },
      { id: '081-C2-68W-0147', name: 'Assess and treatment skull and brain injuries.' },
      { id: '081-C2-68W-0371', name: 'Demonstrate ability to perform an IV insertion.' },
      { id: '081-C2-68W-0372', name: 'Demonstrate ability to administer various types of drugs.' },
      { id: '081-C2-68W-0134', name: 'Comply with Body Substance Isolation (BSI) guidelines.' },
    ],
    references: [
      { refId: 'Module 13: Head Injuries', refName: 'Combat Medic / Corpsman TCCC; Module 13 Head Trauma', required: true, primary: true },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'ISBN: 9781737131113', refName: 'Combat Medic Specialist Fieldcraft', required: true, primary: false },
      { refId: 'JTS-CPGS', refName: 'Joint Trauma System Clinical Practice Guidelines', required: true, primary: false },
      { refId: 'Joint Trama System (JTS)', refName: 'Clinical Practice Guidelines', required: true, primary: false },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
      { refId: 'TCCC Guidelines 2024', refName: 'Tactical Combat Casualty Care (TCCC) Guidelines', required: true, primary: false },
      { refId: 'UNIT SOP', refName: "Unit / Unit's Standard Operating Procedure SOP", required: true, primary: false },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // THE MASTER TASK. Fifteen measures, one per TCCC phase/MARCH-PAWS letter, each deferring to a
    // different CMC module — twenty-one modules cited in all.
    //
    // ONE task-level tcccModuleRef (Module 05) and NO step-level refs, deliberately. Module 05 is
    // the only primary reference; the Evaluation Guidance names its skill sheet as the instrument
    // the evaluator scores this task with; and TAB C lists the ICT's single skill met as "Tactical
    // Trauma Assessment". Wiring a ref per step would mean minting a dozen more empty stubs and
    // would misrepresent twenty reference rows as twenty rolled-up components. Same call as 1020.
    //
    // Verbatim: steps 7 and its measure read "JST TCCC CMC Module 12"; step 14b reads "task if:"
    // for "task id:"; measure 12 says "Wound Dressings" where step 12 says "Wound management";
    // measure 13 appends ": Fractures in TFC" that the step lacks. Step 1f's trailing line is
    // labelled "Cue:" in the packet, not "Note:" — the schema has no per-step cue, so it is
    // carried as the step's note.
    taskNumber: '081-000-0049',
    title: 'Perform Tactical Combat Casualty Care',
    status: 'Approved',
    reportDate: '2026-03-04',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic in a simulated combat or operational environment. You encounter a patient (or multiple patients) with polytrauma requiring tactical combat casualty care. You have an Individual First Aid Kit (IFAK), Combat Medic Aid Bag with all organic supplies, access to Tactical Combat Casualty Care (TCCC) guidelines, and unit SOP. You may encounter hostile fire, low visibility, limited evacuation support, and high-stress conditions. This task should not be trained in MOPP 4. This task should be trained under IED Threat conditions.',
    standards:
      'Perform Tactical Combat Casualty Care in accordance with current TCCC guidelines and unit SOP. Care Under Fire actions control life-threatening hemorrhage and move casualty to cover. Tactical Field Care actions to address all injuries systematically. All interventions are reassessed continuously. Ensure the patient is prepared for evacuation with complete documentation on DD Form 1380. Performance meets all GO criteria using the evaluation checklist.',
    specialConditions:
      'This task may be performed during limited visibility conditions. This task may be performed as a single-casualty or multiple-casualty scenario. This task requires integration of multiple TCCC skill sheets. Task performance in MOPP 4 is not authorized. Trainers must ensure current TCCC guidelines and patient from Joint Trauma System are used for evaluation of this task.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Casualty or casualties sustain combat-related injuries requiring immediate medical intervention.',
    danger:
      'Failure to maintain tactical awareness during casualty care can result in additional casualties. Exposure to hostile fire without proper cover can result in serious injury or death to the medic and casualty. Improper tourniquet application can result in loss of limb or death from continued hemorrhage. Failure to establish and maintain an airway can result in death within minutes.',
    warning:
      'Failure to follow proper sequence of TCCC interventions can result in preventable death. Improper fluid resuscitation can worsen traumatic brain injury or cause pulmonary complications. Delays in hemorrhage control increase mortality risk. Movement of casualties with suspected spinal injuries without proper stabilization can result in permanent paralysis. Failure to recognize and treat tension pneumothorax can result in death.',
    caution:
      'All body fluids should be considered potentially infectious. Always observe body substance isolation (BSI) precautions. Reassess all interventions continuously - casualty condition can deteriorate rapidly. Document all care on DD Form 1380 for continuity of care. Ensure proper communication with evacuation assets to prevent delays in definitive care.',
    remarks:
      'This task is the foundational skill for 68W Combat Medics and encompasses the three phases of TCCC: Care Under Fire, Tactical Field Care, and Tactical Evacuation Care. Proficiency in TCCC is critical for saving lives on the battlefield and is the standard of care for combat casualty management across all U.S. military services.',
    notes:
      'This task integrates multiple TCCC skill sheets and subordinate tasks. Trainers should reference current TCCC guidelines from the Joint Trauma System (JTS) and ensure all skill sheets are current. TCCC is divided into three phases: Care Under Fire (CUF), Tactical Field Care (TFC), and Tactical Evacuation Care (TACEVAC). This task may be performed as a single-casualty or multiple-casualty scenario. This task is proponent-owned by MOS 68W (Combat Medic Specialist). Other medical MOSs may perform this task but must coordinate with the 68W proponent for task modifications or updates.',
    performanceSteps: [
      { number: '1', text: 'Perform Actions for Care Under Fire/Threat per TCCC and JTS TCCC CMC Module 03: Care Under Fire.' },
      { number: '1a', text: 'Return fire and take cover.', isSubStep: true },
      { number: '1b', text: 'Direct the casualty to remain engaged as a combatant if appropriate.', isSubStep: true },
      { number: '1c', text: 'Direct the casualty to move to cover and apply self-aid if able.', isSubStep: true },
      { number: '1d', text: 'Stop life-threatening external hemorrhage if tactically feasible.', isSubStep: true },
      { number: '1e', text: 'Try to keep the casualty from sustaining additional wounds.', isSubStep: true },
      {
        number: '1f',
        text: 'Move the casualty to cover, if the casualty is unable to move.',
        isSubStep: true,
        note: 'Cue: You have moved the patient under cover and concealment and security is established.',
      },
      {
        number: '2',
        text: 'Conduct casualty collection point (CCP) measures per TCCC and JTS TCCC CMC Module 04.',
        note: 'Module 20: Casualty Monitoring will be assessed throughout the entire task.',
        caution:
          'If patient has torso trauma or polytrauma then dies, perform bilateral needle decompression of the chest IAW with JTS TCCC CMC Module 22.',
      },
      { number: '3', text: 'Perform M - Massive Hemorrhage per TCCC and JTS TCCC CMC Module 06.' },
      { number: '4', text: 'Perform A - Airway Management per TCCC and JTS TCCC CMC Module 07.' },
      { number: '5', text: 'Perform R - Respiration/Breathing per TCCC and JTS TCCC CMC Module 08.' },
      { number: '6', text: 'Perform C- Circulation Management per TCCC and JTS TCCC CMC Module 09, Module 10 and Module 11.' },
      { number: '7', text: 'Perform H- Hypothermia Prevention per TCCC and JST TCCC CMC Module 12.' },
      { number: '8', text: 'Perform H- Head Injury per TCCC and JTS TCCC CMC.' },
      { number: '8a', text: 'Perform steps IAW task id: 081-000-0040 - Treat a Patient With Head Injury', isSubStep: true },
      { number: '8b', text: 'Module 13: Head Injury', isSubStep: true },
      { number: '8c', text: 'Module 14: Penetrating Eye Trauma', isSubStep: true },
      { number: '9', text: 'Perform Relevant Communications per TCCC and JTS TCCC CMC Module 21.' },
      { number: '10', text: 'Perform P- Pain Management per TCCC and JTS TCCC CMC Module 15.' },
      { number: '11', text: 'Perform A- Antibiotics per TCCC and JTS TCCC CMC Module 16.' },
      { number: '12', text: 'Perform W- Wound management per TCCC and JTS TCCC CMC Module 17 and Module 18.' },
      { number: '13', text: 'Perform S- Splinting per TCCC and JTS TCCC CMC Module 19.' },
      {
        number: '14',
        text: 'Prepare for Evacuation per TCCC and JTS TCCC CMC Module 24.',
        note: 'Prepare patient evacuation measures. (See task 081-68W-0283).',
      },
      { number: '14a', text: 'Module 24: Prepare for Evacuation', isSubStep: true },
      { number: '14b', text: 'Perform steps IAW task if: 081-68W-0283 - Conduct Patient Transfer.', isSubStep: true },
      { number: '15', text: 'Complete documentation of medical encounter per TCCC and JTS TCCC CMC Module 23: Documentation.' },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed Actions for Care Under Fire/Threat per TCCC and JTS TCCC CMC Module 03: Care Under Fire.' },
      { number: '2', text: 'Conducted casualty collection point (CCP) measures per TCCC and JTS TCCC CMC Module 04.' },
      { number: '3', text: 'Performed M - Massive Hemorrhage per TCCC and JTS TCCC CMC Module 06.' },
      { number: '4', text: 'Performed A - Airway Management per TCCC and JTS TCCC CMC Module 07.' },
      { number: '5', text: 'Performed R - Respiration/Breathing per TCCC and JTS TCCC CMC Module 08.' },
      { number: '6', text: 'Performed C- Circulation Management per TCCC and JTS TCCC CMC Module 09, Module 10 and Module 11.' },
      { number: '7', text: 'Performed H- Hypothermia Prevention per TCCC and JST TCCC CMC Module 12.' },
      { number: '8', text: 'Performed H- Head Injury per TCCC and JTS TCCC CMC.' },
      { number: '9', text: 'Performed Relevant Communications per TCCC and JTS TCCC CMC Module 21.' },
      { number: '10', text: 'Performed P- Pain Management per TCCC and JTS TCCC CMC Module 15.' },
      { number: '11', text: 'Performed A- Antibiotics per TCCC and JTS TCCC CMC Module 16.' },
      {
        number: '12',
        text: 'Performed W- Wound Dressings per TCCC and JTS TCCC CMC Module 17: Wound Management and Module 18: Burns.',
      },
      { number: '13', text: 'Performed S- Splinting per TCCC and JTS TCCC CMC Module 19: Fractures in TFC.' },
      { number: '14', text: 'Prepared for Evacuation per TCCC and JTS TCCC CMC Module 24.' },
      { number: '15', text: 'Completed documentation of medical encounter per TCCC and JTS TCCC CMC Module 23: Documentation.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
    tcccModuleRef: 'tccc-tactical-trauma-assessment',
    knowledges: [
      { id: '081-NP-68C-0137', name: 'Knowledge of medication dose calculation formulas.' },
      { id: '081-C2-68W-0954', name: 'Explain the value of performing an initial assessment.' },
      { id: 'K8133', name: 'Understanding of vascular anatomy and physiology' },
      { id: '081-C2-68W-0476', name: 'Knowledge of the difference between the airway anatomy in the infant, child, and the adult.' },
      { id: '081-C2-68W-0479', name: 'Knowledge of facial anatomy and related physiology to facial injuries.' },
      { id: '081-C2-68W-0777', name: 'Describe the anatomy and physiology of organs and structures related to abdominal injuries.' },
      { id: '081-C2-68W-0449', name: 'Describe components of the on-going assessment.' },
      { id: '081-C2-68W-0875', name: 'Discuss the anatomy and physiology of the organs and structures related to thoracic injuries.' },
      { id: 'K1050', name: 'Uses of Common Medications' },
      { id: 'K23251', name: 'Knowledge of selecting the appropriate medication for a patient' },
      { id: 'K1219', name: 'Basic anatomy of the human body' },
      { id: 'K0597', name: 'Know how to perform an assessment' },
      { id: '081-C2-68W-0686', name: 'Knowledge of anatomy and physiology.' },
      { id: 'k23253', name: 'Knowledge of medication administration, including factors to consider before administering medications' },
      { id: '081-C2-68W-0975', name: 'Identify the indications and contraindications for the medications used.' },
      { id: '081-C2-68W-0584', name: 'Based on assessment findings, formulate field impression of a soft tissue trauma casualty.' },
      { id: '081-C2-68W-0977', name: 'Understand the mechanism of the medication.' },
      {
        id: 'K23254',
        name: 'Knowledge of the factors affecting the action of medications within the body, including absorption, distribution, biotransformation, and elimination',
      },
      {
        id: 'K23255',
        name: 'Knowledge of the ways a medication produces the intended response, including the drug-response relationship and factors such as age and weight',
      },
      { id: 'K23258', name: 'Knowledge of the specific medications used in critical care transport and their uses' },
    ],
    skills: [
      { id: '081-C2-68W-0200', name: 'Patient assessment and care for musculoskeletal injury.' },
      { id: '081-C2-68W-0298', name: 'Perform an assessment of a casualty with an infectious/ communicable disease.' },
      { id: '081-C2-68W-0394', name: 'Perform a pain assessment.' },
      { id: '081-C2-68W-0347', name: 'Demonstrate the assessment and emergency medical care of a casualty with exposure to heat.' },
      { id: '081-C2-68W-0126', name: 'Perform an on-going assessment.' },
      { id: '081-C2-68W-0352', name: 'Demonstrate the assessment and emergency medical care of a casualty with exposure to cold.' },
      { id: '081-C2-68W-0081', name: 'Demonstrate the ability to perform a general assessment for eye injuries' },
      { id: '081-C2-68W-0337', name: 'Demonstrate a clinical assessment for a casualty with suspected thoracic trauma.' },
      { id: '081-C2-68W-0130', name: 'Perform a rapid trauma assessment for a casualty based on mechanism of injury.' },
      { id: '081-C2-68W-0131', name: 'Perform an assessment of a responsive casualty with no known history.' },
      { id: '081-C2-68W-0132', name: 'Perform an assessment of an unresponsive casualty with an altered metal status.' },
    ],
    references: [
      {
        refId: 'Module 05: Tactical Trauma Assessment',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 5',
        required: true,
        primary: true,
      },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'Deployed Medicine', refName: 'Standardized TCCC Training Across The Entire U.S. Military', required: true, primary: false },
      { refId: 'Module 03: Care Under Fire (CUF)', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 3', required: true, primary: false },
      {
        refId: 'Module 04: Principles and Applications of Tactical Field Care (TFC)',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 4',
        required: true,
        primary: false,
      },
      {
        refId: 'Module 06: Massive Hemorrhage Control in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 6',
        required: true,
        primary: false,
      },
      { refId: 'Module 07: Airway Management in TFC', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 7', required: true, primary: false },
      {
        refId: 'Module 08: Respiration Assessment & Management in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 8',
        required: true,
        primary: false,
      },
      {
        refId: 'Module 09: Circulation/Hemorrhage Control in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 9',
        required: true,
        primary: false,
      },
      {
        refId: 'Module 10: Shock Recognition & Management',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 10',
        required: true,
        primary: false,
      },
      {
        refId: 'Module 11: Hemorrhagic Shock Fluid Resuscitation in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 11',
        required: true,
        primary: false,
      },
      {
        refId: 'Module 12: Hypothermia Prevention & Treatment',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 12',
        required: true,
        primary: false,
      },
      { refId: 'Module 13: Head Injuries', refName: 'Combat Medic / Corpsman TCCC; Module 13 Head Trauma', required: true, primary: false },
      { refId: 'Module 14: Eye Injuries', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 14', required: true, primary: false },
      { refId: 'Module 15: Pain Medication (Analgesia)', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 15', required: true, primary: false },
      { refId: 'Module 17: Wound Management', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 17', required: true, primary: false },
      { refId: 'Module 18: Burns', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 18', required: true, primary: false },
      { refId: 'Module 19: Fractures', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 19', required: true, primary: false },
      { refId: 'Module 20: Casualty Monitoring', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 20', required: true, primary: false },
      { refId: 'Module 21: Communication Procedures', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 21', required: true, primary: false },
      {
        refId: 'Module 22: Cardiopulmonary Resuscitation in TFC',
        refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 22',
        required: true,
        primary: false,
      },
      { refId: 'Module 23: Documentation', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 23', required: true, primary: false },
      { refId: 'Module 24: Prepare for Evacuation', refName: 'TCCC Combat Medic / Corpsman - Skills Assessment Mod 24', required: true, primary: false },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
    ],
    prerequisiteTasks: [],
    supportingTasks: [
      '081-000-0037',
      '081-000-0003',
      '081-000-0040',
      '081-000-0108',
      '081-000-0044',
      '081-000-0231',
      '081-000-0055',
      '081-000-1025',
      '081-000-0125',
    ],
  },
  {
    // THE ADTMC ROOT TASK. Stated prerequisite of nine other authored packets (0165, 0168, 0239,
    // 0240, 0245, 0246, 0248, 0249, 0251) — it is the general screening pass those all branch off.
    //
    // ⚠️ ONLY PACKET ON THE ROSTER WITH SUB-LETTERED PERFORMANCE MEASURES. Measures 1, 5 and 6
    // carry their own a/b/c rows in the GO/NO-GO table. They are reproduced as measure rows
    // numbered '1a', '5a', ... but gradedMeasures stays the seven top-level numbers, mirroring how
    // performanceSteps carries substeps that gradedMeasures does not.
    //
    // Verbatim: Conditions reads "in a operational or garrison environment"; Notes reads "All
    // obstacle to care must be documented"; the reference table lists MEDCOM Pam 40-7-21 twice,
    // the second row tagged with Step Number "2." and primary:No. All as published.
    taskNumber: '081-68W-0250',
    title: 'Treat a Patient With General Medical Complaint',
    status: 'Approved',
    reportDate: '2026-02-12',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic Specialist assigned to a Battalion Aid Station or Medical Treatment Facility in a operational or garrison environment. You have been tasked by a medical provider to conduct a medical assessment of a conscious patient presenting for sick call with general medical complaints. You have access to MEDCOM Pam 40-7-21 (Algorithm-Directed Troop Medical Care), local SOPs, standard medical equipment sets (TCMC equipment set, vital signs monitoring equipment, stethoscope, blood pressure cuff, pulse oximeter, thermometer, oxygen delivery systems, defibrillator/monitor, authorized medications), and electronic medical record (EMR) documentation systems or an SF 600. This task should not be trained in MOPP 4.',
    standards:
      'Treat a patient with a general medical complaint IAW MEDCOM Pam 40-7-21 (Algorithm-Directed Troop Medical Care) and local SOPs. All vital signs, patient history, and physical examination findings are accurately obtained and documented in the electronic medical record. Patient priority and disposition are correctly determined based on ADTMC algorithms, appropriate interventions are initiated, and critical findings requiring immediate provider notification are identified and reported. All performance measures are met.',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to ADTMC protocols and medical equipment. Task may be performed on pediatric, adult, or geriatric patients with varying chief complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient presents for sick call with general medical complaint requiring screening assessment.',
    danger: 'None',
    warning:
      'Failure to identify life-threatening conditions during primary screening may result in patient death. Immediately notify medical provider of any critical findings.',
    caution:
      'Ensure proper infection control procedures and use of personal protective equipment when conducting patient assessments. Maintain patient privacy and confidentiality IAW HIPAA regulations.',
    remarks:
      'This task is critical for initial patient screening in garrison medical facilities. Proper assessment and documentation supports continuity of care and medical readiness.',
    notes:
      'This task requires close coordination with medical providers. All obstacle to care must be documented. Maintain continuous communication with supervising provider for critical findings.',
    performanceSteps: [
      {
        number: '1',
        text: 'Conduct primary screening to identify critically sick patients.',
        note: 'Identify patients requiring immediate provider evaluation.',
      },
      { number: '1a', text: 'Assess general impression of patient.', isSubStep: true },
      { number: '1b', text: 'Identify life-threatening conditions.', isSubStep: true },
      { number: '1b(1)', text: 'Airway', isSubStep: true },
      { number: '1b(2)', text: 'Breathing', isSubStep: true },
      { number: '1b(3)', text: 'Circulation', isSubStep: true },
      { number: '1c', text: 'Identify chief complaint', isSubStep: true },
      { number: '1d', text: 'Identify if immediate provider intervention is required.', isSubStep: true },
      {
        number: '2',
        text: 'Obtain and record vital signs.',
        caution: 'Any Soldier that is found to have abnormal vital signs will be referred to the supervising medical provider.',
      },
      {
        number: '3',
        text: 'Complete history of present illness (HPI).',
        note: 'Use mnemonic OPQRST (Onset, Provocation/Palliation, Quality, Region/Radiation, Severity, Time) format to systematically document history of present illness.',
      },
      {
        number: '4',
        text: 'Obtain past medical history (PMH).',
        note: "Use mnemonic SAMPLE (Signs/Symptoms, Allergies, Medications, Past medical history, Last oral intake, Events leading to illness) format to systematically document patient's medical history. For female patients of childbearing age, obtain date of last menstrual period (LMP). If LMP is >28 days ago, notify provider immediately",
      },
      { number: '5', text: 'Conduct focused physical examination based on chief complaint.' },
      { number: '5a', text: "Review and apply the appropriate ADTMC algorithm for the patient's chief complaint.", isSubStep: true },
      { number: '5b', text: 'Perform all physical examination components specified in the algorithm.', isSubStep: true },
      { number: '5c', text: 'Document physical examination findings in the electronic medical record.', isSubStep: true },
      { number: '6', text: 'Establish patient priority, disposition, and initiate appropriate interventions IAW ADTMC protocols.' },
      { number: '6a', text: 'Apply ADTMC algorithm to determine patient priority level (immediate, urgent, routine).', isSubStep: true },
      { number: '6b', text: 'Determine appropriate disposition (provider evaluation, self-care, return if worse).', isSubStep: true },
      { number: '6c', text: 'Initiate interventions authorized within ADTMC protocols.', isSubStep: true },
      { number: '6d', text: 'Notify provider of patients requiring immediate or urgent evaluation.', isSubStep: true },
      { number: '6e', text: 'Provide patient education appropriate to condition and disposition.', isSubStep: true },
      { number: '7', text: 'Complete documentation of medical encounter IAW ADTMC or local protocols.' },
      { number: '7a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '7b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Conducted primary screening to identify critically sick patients.' },
      { number: '1a', text: 'Assessed general impression, airway, breathing, and circulation.' },
      { number: '1b', text: 'Identified chief complaint.' },
      { number: '1c', text: 'Determined if immediate provider intervention was required.' },
      { number: '2', text: 'Obtained and recorded vital signs.' },
      { number: '3', text: 'Completed history of present illness (HPI).' },
      { number: '4', text: 'Obtained past medical history (PMH).' },
      { number: '5', text: 'Conducted focused physical examination based on chief complaint.' },
      { number: '5a', text: 'Reviewed and applied appropriate ADTMC algorithm.' },
      { number: '5b', text: 'Performed all examination components specified in the algorithm.' },
      { number: '5c', text: 'Documented findings in EMR.' },
      { number: '6', text: 'Established patient priority, disposition, and initiated appropriate interventions IAW ADTMC protocols.' },
      { number: '6a', text: 'Applied correct ADTMC algorithm to determine patient priority level.' },
      { number: '6b', text: 'Determined appropriate disposition.' },
      { number: '6c', text: 'Initiated authorized interventions per ADTMC protocols.' },
      { number: '6d', text: 'Notified provider for immediate/urgent cases.' },
      { number: '7', text: 'Completed documentation of medical encounter IAW ADTMC or local protocols.' },
    ],
    gradedMeasures: ['1', '2', '3', '4', '5', '6', '7'],
    knowledges: [
      { id: 'K23375', name: 'Knowledge of the anatomy and physiology of a pediatric patient' },
      { id: '081-SR-68P-B019', name: 'Knowledge of patient relations' },
      { id: '081-C2-68W-0144', name: 'Knowledge of classifications of patients.' },
      { id: '081-CL-MED-0010', name: 'PATIENT SAFETY' },
      { id: '081-PAD-68G-KN053', name: 'How to obtain patient identification' },
      { id: '081-NP-WM6-0007', name: 'Conduct a patient interview.' },
      { id: '081-VC-68T-KN0236', name: 'Use a patient monitor.' },
      { id: 'K23467', name: 'Knowledge of considerations for transporting a comatose patient' },
      { id: '081-PAD-68G-KN062', name: 'Know how to obtain patient information found in appropriate inpatient computer databases.' },
      { id: 'K23318', name: 'Knowledge of optimal interventions for a patient with heat exhaustion' },
      { id: 'K23319', name: 'Knowledge of optimal interventions for a patient with hypothermia' },
      { id: 'K27794', name: 'Factors that influence Patient Movement' },
      { id: 'K23479', name: 'Knowledge of the management of a patient with a drug overdose' },
      { id: '081-SR-68P-H110', name: 'Knowledge of body mechanics and patient handling' },
      { id: 'K22676', name: 'Knowledge of conventional patient positioning' },
      { id: 'K23324', name: 'Knowledge of the treatment and transport of a patient with an infectious or communicable disease' },
      { id: 'K23602', name: 'Knowledge of cardiac conditions associated with geriatric patients' },
      { id: 'K23295', name: 'Knowledge of assessing a burn patient' },
      { id: '081-NP-68C-0037', name: "Identify patients' rights." },
      { id: '081-SR-68P-R254', name: 'Knowledge to perform patient care handwash' },
      { id: '081-C2-68W-0806', name: "Knowledge of how to take a patient's temperature." },
      { id: '081-PAD-68G-KN029', name: 'How to identify forms used for documenting patient care' },
      { id: 'K1052', name: 'Principles of a Medical Patient Assessment' },
      { id: '081-IBAM-0009', name: 'Recognize a Seizing Patient' },
      { id: 'K22695', name: 'Knowledge of assessment and management of cardiac conditions of pediatric patients' },
      { id: '081-UE-FMC-5748', name: 'IDENTIFY MEDICAL EMERGENCIES IN A PEDIATRIC PATIENT' },
      { id: 'K22698', name: 'Knowledge of assessment and management of meningococcal infections in pediatric patients' },
      { id: 'K22697', name: 'Knowledge of assessment and management of trauma conditions of pediatric patients' },
      { id: 'K23382', name: 'Knowledge of cardiac considerations associated with pediatric patients' },
      { id: 'K22703', name: 'Knowledge of steps to prepare a patient for a FAST exam' },
      { id: '081-C2-68W-0136', name: 'Knowledge of patient priorities for evacuation.' },
    ],
    skills: [
      { id: '081-C2-68W-0106', name: 'Properly position the patient for the procedure.' },
      { id: '081-C2-68W-0394', name: 'Perform a pain assessment.' },
      { id: '081-VC-68T-SK0114', name: 'Evaluate the mental status of the patient.' },
      { id: '081-C2-68W-0272', name: 'Demonstrate the care of the patient exhibiting signs and symptoms of internal bleeding.' },
      { id: '081-C2-68W-0304', name: 'Assess and treat skin infection.' },
      { id: 'S8505', name: 'Complete medical documentation for a patient.' },
      { id: '081-C2-68W-0372', name: 'Demonstrate ability to administer various types of drugs.' },
      { id: 'S8481', name: 'Perform procedures for obtaining a blood specimen.' },
      { id: '081-C2-68W-0187', name: 'Ability to interview patients.' },
      { id: '081-C2-68W-0123', name: "Obtain a casualty's blood pressure." },
      { id: '081-C2-68W-0189', name: 'Ability to screen patients.' },
      { id: '081-C2-68W-0035', name: 'Demonstrate positioning of the patient for the procedure.' },
      { id: '081-VC-68T-SK0070', name: "Assess the patient's pulse." },
      { id: '081-VC-68T-SK0233', name: 'Perform first aid for shock.' },
      { id: '081-C2-68W-0166', name: 'Assess vital signs.' },
    ],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      { refId: 'CLINIC SOP', refName: 'Clinic SOP', required: true, primary: false },
      { refId: 'FM 4-02', refName: 'ARMY HEALTH SYSTEM', required: true, primary: false },
      { refId: 'ISBN: 9781737131113', refName: 'Combat Medic Specialist Fieldcraft', required: true, primary: false },
      { refId: 'LOCAL SOP', refName: 'LOCAL SOP', required: true, primary: false },
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: false },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
    ],
    prerequisiteTasks: [],
    supportingTasks: [],
  },
  {
    // Standards reads "in accordance with IAW MEDCOM Pam 40-7-21" — the redundancy is the packet's.
    taskNumber: '081-68W-0249',
    title: 'Treat a Patient With Musculoskeletal Complaint',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a medic in an operational or garrison environment. You have been directed to provide sick call services and have completed Task 081-68W-0250 (Treat a patient with a General Medical Complaint). You have a patient requiring musculoskeletal examination. You are provided with MEDCOM Pamphlet 40-7-21, (ADTMC), local SOPs, and a fully operational clinic/ battalion aid station with access to standard medical equipment sets (Tactical Combat Medical Care, vital signs monitor, stethoscope, blood pressure cuff, pulse oximeter, thermometer, shoulder sling, splint, ace wrap, crutches, anti-inflammatory drugs, icepacks, oxygen delivery systems, defibrillator/monitor, and authorized medications), as well as computer access to electronic medical record documentation systems. You will be also provided with a Standard Form (SF) 600, Medical Record, Chronological Record of Medical Care or electronic medical record. This task should not be trained in MOPP 4.',
    standards:
      'Treat a patient with musculoskeletal complaint in accordance with IAW MEDCOM Pam 40-7-21 (ADTMC), and local SOPs, while adhering to all performance steps with 100% accuracy, utilizing GO/NO-GO criteria.',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to ADTMC protocols and medical equipment. Task may be performed on pediatric, adult, or geriatric patients with varying chief complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You have completed task 081-68W-0250 (Treat a Patient With General Medical Complaint) and encounter a patient who presents with a musculoskeletal complaint.',
    danger: 'None',
    warning: 'None',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    remarks: 'None',
    notes: '68W Combat Medic Specialist is the proponent for this task.',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform focused assessment using appropriate ADTMC protocol for musculoskeletal complaints.',
        note: 'Select and apply applicable protocol(s) from B1-B11 based on patient presentation.',
      },
      { number: '1a', text: 'Identify and verbalize selected ADTMC protocol based on patients chief complaint.', isSubStep: true },
      { number: '1a(1)', text: 'B-1 Back Pain.', isSubStep: true },
      { number: '1a(2)', text: 'B-2 Neck Pain.', isSubStep: true },
      { number: '1a(3)', text: 'B-3 Shoulder Pain.', isSubStep: true },
      { number: '1a(4)', text: 'B-4 Elbow Pain.', isSubStep: true },
      { number: '1a(5)', text: 'B-5 Wrist Pain.', isSubStep: true },
      { number: '1a(6)', text: 'B-6 Hand Pain.', isSubStep: true },
      { number: '1a(7)', text: 'B-7 Hip Pain.', isSubStep: true },
      { number: '1a(8)', text: 'B-8 Knee Pain.', isSubStep: true },
      { number: '1a(9)', text: 'B-9 Ankle Pain.', isSubStep: true },
      { number: '1a(10)', text: 'B-10 Foot Pain.', isSubStep: true },
      { number: '1a(11)', text: 'B-11 Extremity, Non-Joint Pain.', isSubStep: true },
      { number: '1b', text: "Apply correct ADTMC protocol based on the patient's chief complaint.", isSubStep: true },
      { number: '2', text: 'Provide musculoskeletal focused treatment.' },
      { number: '2a', text: 'Administer medications per ADTMC protocols.', isSubStep: true },
      { number: '2b', text: 'Provide symptomatic relief measures.', isSubStep: true },
      { number: '2c', text: 'Reassess vital signs, symptoms, and overall condition per patient presentation.', isSubStep: true },
      { number: '3', text: 'Identify patient disposition and return to duty instructions.' },
      { number: '3a', text: 'Assess severity and need for provider evaluation.', isSubStep: true },
      { number: '3b', text: 'Determine if evacuation/higher care needed.', isSubStep: true },
      { number: '3c', text: 'Provide return-to-duty instructions if appropriate.', isSubStep: true },
      { number: '3d', text: 'Ensure follow-up is communicated and scheduled as needed.', isSubStep: true },
      { number: '4', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '4a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '4b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused assessment using appropriate ADTMC protocol for musculoskeletal complaints.' },
      { number: '2', text: 'Provided musculoskeletal focused treatment.' },
      { number: '3', text: 'Identified patient disposition and return to duty instructions.' },
      { number: '4', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    knowledges: [
      { id: '081-C2-68W-0694', name: 'Knowledge of the reasons for splinting.' },
      { id: '081-C2-68W-0695', name: 'Knowledge of the general rules of splinting.' },
      { id: 'K23576', name: 'Knowledge of how to assess a patient with a musculoskeletal injury' },
      { id: 'K23577', name: 'Knowledge of emergency care principles use for managing a musculoskeletal injury' },
      { id: '081-C2-68W-0686', name: 'Knowledge of anatomy and physiology.' },
      { id: 'K23579', name: 'Knowledge of nontraumatic musculoskeletal disorders' },
      { id: '081-C2-68W-0692', name: 'Knowledge of types of musculoskeletal injuries.' },
    ],
    skills: [{ id: '081-C2-68W-0200', name: 'Patient assessment and care for musculoskeletal injury.' }],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      { refId: 'DD FORM 1380', refName: 'TACTICAL COMBAT CASUALTY CARE (TCCC) CARD', required: true, primary: false },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
      { refId: 'TCCC Web', refName: 'Joint Trauma System', required: true, primary: false, source: 'https://jts.health.mil/index.cfm/PI_CPGs/cpgs' },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    // Step 1 reads "Perform focus assessment" where its measure reads "Performed focused
    // assessment"; protocol labels C2 and C4 are printed without a space after the colon. Verbatim.
    taskNumber: '081-68W-0239',
    title: 'Treat a Patient with Gastrointestinal Complaint',
    status: 'Approved',
    reportDate: '2026-02-27',
    proponentMos: '68W',
    conditions:
      'You are a 68W Combat Medic Specialist assigned to a Battalion Aid Station or Medical Treatment Facility in a garrison or operational environment. You have completed task 081-68W-0250 (Treat a Patient with a General Medical Complaint) and identified a patient with gastrointestinal complaints requiring treatment. You have access to MEDCOM Pam 40-7-21 (ADTMC), local SOPs, medications, IV fluids, Class VIII medical supplies, and electronic medical record documentation systems. This task should not be trained in MOPP 4.',
    standards:
      'Treat a patient with gastrointestinal complaint, IAW MEDCOM Pam 40-7-21 (ADTMC) and local SOPs. A focused abdominal examination is completed based on chief complaint. Appropriate ADTMC protocol is identified and applied. Treatment is provided based on assessment findings. Patient disposition is determined and return-to-duty instructions are provided. All care is properly documented in the electronic medical record.',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to ADTMC protocols and medical equipment. Task may be performed on pediatric, adult, or geriatric patients with varying chief complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'Patient requires treatment for gastrointestinal complaint.',
    danger: 'None',
    warning:
      'Failure to identify signs of acute abdomen, gastrointestinal bleeding, or dehydration may result in serious patient harm or death. Immediately notify medical provider of any critical findings.',
    caution:
      'Ensure proper infection control procedures when examining patients with gastrointestinal complaints. Monitor for signs of dehydration and electrolyte imbalance.',
    remarks:
      'This task requires application of ADTMC protocols specific to gastrointestinal complaints. Proper abdominal examination technique is critical for identifying serious conditions requiring immediate provider evaluation or evacuation. Medics must maintain high index of suspicion for acute abdomen.',
    notes:
      'Medics must be familiar with ADTMC algorithms for nausea/vomiting, diarrhea, constipation, and abdominal pain. Document all pertinent positive and negative findings. Red flags include rigid abdomen, rebound tenderness, absent bowel sounds, hematemesis, melena, severe dehydration.',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform focus assessment using appropriate ADTMC protocol for gastrointestinal complaints.',
        note: 'Select and apply applicable protocol(s) from C1-C7 based on patient presentation.',
      },
      { number: '1a', text: "Identify and verbalize selected ADTMC protocol based on patient's chief complaint.", isSubStep: true },
      { number: '1a(1)', text: 'C1: Nausea/Vomiting.', isSubStep: true },
      { number: '1a(2)', text: 'C2:Diarrhea.', isSubStep: true },
      { number: '1a(3)', text: 'C3: Abdominal and Flank Pain.', isSubStep: true },
      { number: '1a(4)', text: 'C4:Rectal Pain/Itching/Bleeding.', isSubStep: true },
      { number: '1a(5)', text: 'C5: Constipation.', isSubStep: true },
      { number: '1a(6)', text: 'C6: Difficulty Swallowing.', isSubStep: true },
      { number: '1a(7)', text: 'C7: Heartburn.', isSubStep: true },
      { number: '1b', text: "Apply correct ADTMC protocol based on the patient's chief complaint.", isSubStep: true },
      { number: '2', text: 'Provide gastrointestinal focused treatment.' },
      { number: '2a', text: 'Administer medications per ADTMC protocols.', isSubStep: true },
      { number: '2b', text: 'Initiate IV fluid therapy based on dehydration severity and electrolyte imbalance if indicated.', isSubStep: true },
      { number: '2c', text: 'Provide symptomatic relief measures.', isSubStep: true },
      {
        number: '2d',
        text: 'Reassess vital signs, symptoms, and overall condition every 5 or 15 minutes based on patient presentation.',
        isSubStep: true,
      },
      { number: '3', text: 'Identify patient disposition and return to duty instructions.' },
      { number: '3a', text: 'Assess severity and need for provider evaluation.', isSubStep: true },
      { number: '3b', text: 'Use triage protocols to prioritize evacuation if needed.', isSubStep: true },
      { number: '3c', text: 'Provide return-to-duty instructions if appropriate.', isSubStep: true },
      { number: '3d', text: 'Ensure follow-up is communicated and scheduled as needed.', isSubStep: true },
      { number: '4', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '4a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '4b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused assessment using appropriate ADTMC protocol for gastrointestinal complaints.' },
      { number: '2', text: 'Provided gastrointestinal focused treatment.' },
      { number: '3', text: 'Identified patient disposition and return to duty instructions.' },
      { number: '4', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    knowledges: [
      { id: '081-2C-91W-1113', name: 'Discuss the pathophysiology of inflammation and its relationship to acute abdominal pain.' },
      { id: '081-2C-91W-1114', name: 'Define somatic pain as it relates to gastroenterology.' },
      { id: '081-2C-91W-1115', name: 'Define visceral pain as it relates to gastroenterology.' },
      { id: '081-2C-91W-1116', name: 'Define referred pain as it relates to gastroenterology.' },
      { id: '081-2C-91W-1117', name: 'Differentiate between hemorrhagic and non-hemorrhagic abdominal pain.' },
      { id: '081-2C-91W-1118', name: 'Describe the technique for physical exam on a casualty complaining of abdominal pain.' },
      { id: '081-2C-91W-1119', name: 'Define upper gastrointestinal bleeding.' },
      { id: '081-2C-91W-1120', name: 'Describe the management for upper gastrointestinal bleeding.' },
      { id: '081-2C-91W-1121', name: 'Define lower gastrointestinal bleeding.' },
      { id: '081-2C-91W-1122', name: 'Describe the management for lower gastrointestinal bleeding.' },
      { id: '081-2C-91W-1123', name: 'Define gastroenteritis/acute gastroenteritis.' },
      { id: '081-2C-91W-1124', name: 'Describe the management for gastroenteritis / acute gastroenteritis.' },
      { id: '081-2C-91W-1125', name: 'Describe the management for appendicitis.' },
      { id: '081-2C-91W-1126', name: 'Define peptic ulcer disease.' },
      { id: '081-2C-91W-1127', name: 'Describe the management for peptic ulcer disease.' },
      { id: '081-2C-91W-1128', name: 'Define bowel obstruction.' },
      { id: '081-2C-91W-1129', name: 'Describe the management for bowel obstruction.' },
      { id: '081-2C-91W-1130', name: "Define Crohn's disease." },
      { id: '081-2C-91W-1131', name: "Describe the management for Crohn's disease." },
      { id: '081-2C-91W-1132', name: 'Define pancreatitis.' },
      { id: '081-2C-91W-1133', name: 'Describe the management for pancreatitis.' },
      { id: '081-2C-91W-1134', name: 'Define esophageal varices.' },
      { id: '081-2C-91W-1135', name: 'Describe the management for esophageal varices.' },
      { id: '081-2C-91W-1136', name: 'Define hemorrhoids.' },
      { id: '081-2C-91W-1137', name: 'Define cholecystitis.' },
      { id: '081-2C-91W-1138', name: 'Describe the management for cholecystitis.' },
      { id: '081-2C-91W-1139', name: 'Define acute hepatitis.' },
      { id: '081-2C-91W-1140', name: 'Describe the management for acute hepatitis.' },
      { id: '081-2C-91W-1141', name: 'Define colitis.' },
      { id: '081-2C-91W-1142', name: 'Describe the management for colitis.' },
      { id: 'K31376', name: 'Assess vital signs' },
      { id: 'K31386', name: 'Recognize vital sign norms and abnormalities' },
    ],
    skills: [
      { id: '081-C2-68W-0441', name: 'Assess and treat specific gastrointestinal injury, illness, or diseases.' },
      { id: '081-C2-68W-0300', name: 'Assess and treat gastrointestinal complaints.' },
      { id: 'S5410', name: 'Understand how to conduct assessment/evaluation' },
      { id: '081-C2-68W-0429', name: 'Perform a comprehensive physical examination on a casualty complaining of abdominal pain.' },
    ],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      { refId: 'CLINIC SOP', refName: 'Clinic SOP', required: true, primary: false },
      { refId: 'LOCAL SOP', refName: 'LOCAL SOP', required: true, primary: false },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
  {
    // Step 3a's red-flag note is word-for-word the one at 081-68W-0240 step 3a, and that is
    // CORRECT, not a copy-paste slip: the eye and ear are neurologic end organs, so the findings
    // overlap both complaint families. Sudden vision loss is a stroke/raised-ICP presentation;
    // "severe ear pain WITH neurological symptoms" is named as neurologic on its face; airway
    // compromise is the emergency in an F-4 (drowsiness/confusion) or F-6 (minor TBI) patient; and
    // penetrating orbital trauma is a route to intracranial injury. Shared disposition criteria
    // across ADTMC families are the design, not a defect — do not "scope" this note to neuro.
    // (The sentence is truncated relative to 0240, which closes "...require immediate provider
    // evaluation." Reproduced as published either way.)
    //
    // Packet title spells it "Neuropsychiatric"; the ICTL.ts roster spells it "Neuropsychatric".
    // Packet wins here, roster keeps its own — same split as 0122 and 0251.
    taskNumber: '081-68W-1059',
    title: 'Treat a Patient with Neuropsychiatric Complaint',
    status: 'Approved',
    reportDate: '2026-03-02',
    proponentMos: '68W',
    conditions:
      'You are a medic in an operational or garrison environment. You have been directed to provide sick call services and have completed Task 081-68W-0250 (Treat a patient with general medical complaint). You have a patient requiring a neuropsychiatric examination. You are provided with MEDCOM Pam 40-7-21, (ADTMC), local SOPs, and a fully operational clinic/ battalion aid station with access to standard medical equipment sets (Tactical Combat Medical Care, vital signs monitor, stethoscope, blood pressure cuff, pulse oximeter, thermometer, glucometer, glucose test strips, pen light, pen, oxygen delivery systems, defibrillator/monitor, and authorized medications), as well as computer access to electronic medical record documentation systems. You will be provided with a Standard Form (SF) 600, Medical Record -Chronological Record of Medical Care or electronic medical record. This task should not be trained in MOPP 4.',
    standards:
      'Treat a patient with neuropsychiatric complaint by performing a focused assessment using appropriate ADTMC protocols, providing appropriate treatment, determining patient disposition, and documenting the encounter with 100% accuracy according to MEDCOM PAM 40-7-21 and local SOPs without error, using the task GO/NO-GO checklist.',
    specialConditions:
      'Task may be performed during limited visibility. Task may be performed with simulated patients or actual patients under supervision. Task requires access to ADTMC protocols and medical equipment. Task may be performed on pediatric, adult, or geriatric patients with varying chief complaints.',
    safetyRisk: 'Low',
    mopp4: 'Never',
    cue: 'You have completed task 081-68W-0250 (Treat a Patient With General Medical Complaint) and encounter a patient who presents with a neuropsychiatric complaint.',
    danger: 'None',
    warning: 'None',
    caution:
      'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
    remarks: 'None',
    notes: 'None',
    performanceSteps: [
      {
        number: '1',
        text: 'Perform focused assessment using appropriate ADTMC protocol for neuropsychiatric complaints.',
        note: 'Select and apply applicable protocol(s) from F-1/F-6 based on patient presentation.',
      },
      { number: '1a', text: "Identify and verbalize selected ADTMC protocol based on patient's chief complaint:", isSubStep: true },
      { number: '1a(1)', text: 'F-1: Dizziness/Faintness/Blackout', isSubStep: true },
      { number: '1a(2)', text: 'F-2: Headache', isSubStep: true },
      { number: '1a(3)', text: 'F-3: Numbness/Tingling/Paralysis/Weakness', isSubStep: true },
      { number: '1a(4)', text: 'F-4: Drowsiness/Confusion', isSubStep: true },
      { number: '1a(5)', text: 'F-5: Depression/Nervousness/Anxiety/Tension', isSubStep: true },
      { number: '1a(6)', text: 'F-6: Minor Traumatic Brain Injury', isSubStep: true },
      { number: '1b', text: "Apply correct ADTMC protocol based on the patient's chief complaint", isSubStep: true },
      { number: '2', text: 'Provide neuropsychiatric focused treatment.' },
      { number: '2a', text: 'Implement appropriate interventions for specific complaints', isSubStep: true },
      { number: '2b', text: 'Provide symptomatic relief measures.', isSubStep: true },
      { number: '2c', text: 'Apply patient isolation precautions as needed.', isSubStep: true },
      { number: '3', text: 'Identify patient disposition and return to duty instructions.' },
      {
        number: '3a',
        text: 'Assess severity and need for provider evaluation.',
        isSubStep: true,
        note: 'IAW ADTMC protocols, Penetrating eye injuries, chemical burns to the eye, sudden vision loss, severe ear pain with neurological symptoms, and airway compromise',
      },
      { number: '3b', text: 'Determine if evacuation/higher care needed.', isSubStep: true },
      { number: '3c', text: 'Provide return-to-duty instructions if appropriate.', isSubStep: true },
      { number: '3d', text: 'Ensure follow-up is communicated and scheduled as needed.', isSubStep: true },
      { number: '4', text: 'Complete documentation of medical encounter IAW ADTMC or local SOPs.' },
      { number: '4a', text: 'Record all findings and treatment.', isSubStep: true },
      { number: '4b', text: 'Ensure documentation is complete, accurate, and timely.', isSubStep: true },
    ],
    performanceMeasures: [
      { number: '1', text: 'Performed focused assessment using appropriate ADTMC protocol for neuropsychiatric complaints.' },
      { number: '2', text: 'Provided neuropsychiatric focused treatment.' },
      { number: '3', text: 'Identified patient disposition and return to duty instructions.' },
      { number: '4', text: 'Completed documentation of medical encounter IAW ADTMC or local SOPs.' },
    ],
    gradedMeasures: ['1', '2', '3', '4'],
    knowledges: [
      { id: 'K23540', name: 'Knowledge of the methods used to assess a head injury' },
      { id: 'K31386', name: 'Recognize vital sign norms and abnormalities' },
      { id: 'K31376', name: 'Assess vital signs' },
      { id: 'K31027', name: 'Identify procedures and methods in the management of head and traumatic brain injuries.' },
      { id: 'K31119', name: "Identify the fundamental principles and procedures for obtaining a patient's blood pressure." },
      { id: 'K31026', name: 'Identify procedures in the treatment of head injuries.' },
    ],
    references: [
      { refId: 'MEDCOM Pam 40-7-21', refName: 'ALGORITHM-DIRECTED TROOP MEDICAL CARE (ADTMC)', required: true, primary: true },
      {
        refId: 'ISBN 978-0071794763',
        refName: "Tintinalli's Emergency Medicine A Comprehensive Study Guide 8th Edition",
        required: true,
        primary: false,
      },
      { refId: 'SF 600', refName: 'CHRONOLOGICAL RECORD OF MEDICAL CARE', required: true, primary: false },
    ],
    prerequisiteTasks: ['081-68W-0250'],
    supportingTasks: [],
  },
]

export function getIctlTaskData(taskNumber: string): IctlTaskData | undefined {
  return ictlTaskData.find(t => t.taskNumber === taskNumber)
}
