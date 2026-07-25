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
]

export function getIctlTaskData(taskNumber: string): IctlTaskData | undefined {
  return ictlTaskData.find(t => t.taskNumber === taskNumber)
}
