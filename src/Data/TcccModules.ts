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
 * ⚠️ PROVENANCE / FIDELITY. Two classes of source feed this file, and they are NOT interchangeable:
 *
 *   1. CMC SKILL INSTRUCTIONS (strong). "COMBAT MEDIC/CORPSMAN TACTICAL COMBAT CASUALTY CARE /
 *      SKILL INSTRUCTIONS" documents. Each is a stack of independently-headed skill sheets, and
 *      each sheet publishes its own TASK/CONDITION/STANDARD/EQUIPMENT block plus numbered
 *      PERFORMANCE MEASURES with NOTE/CAUTION/WARNING lines. This maps onto TcccSection with no
 *      interpretation, so `derived` stays unset.
 *   2. DIDACTIC / SLIDE DECKS (weak). Speaker notes and slide checklists, where the steps must be
 *      synthesized out of teaching prose. These set `derived: true`.
 *
 * Every module carries `source` naming the exact document. Derived content must NEVER migrate up
 * into an ICTL task packet's verbatim-from-MEDCoE fields.
 *
 * Note the CMC skill instruction control number `#TCCC-CMC-09-01` is IDENTICAL across modules 08,
 * 10 and 12 — it identifies the instruction series, not the module. Disambiguate a source by its
 * module number and date, never by that number alone.
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

/**
 * One branch of a TCCC module — the unit an ICTL performance step references.
 *
 * GRAIN: one section per SKILL SHEET, not per topic grouping. The skill instruction PDFs are
 * published as a stack of independently-headed sheets ("CHEST SEAL INSTRUCTION", "NEEDLE
 * DECOMPRESSION OF THE CHEST (NDC) INSTRUCTION", ...), and packet 081-000-0125 enumerates those
 * same sheets as its leaf substeps 2a(1)–2b(6). The sheet is what a grader grades, so the sheet
 * is what a ref addresses.
 *
 * The four header fields below are the sheet's own TASK/CONDITION/STANDARD/EQUIPMENT block. They
 * are the grading contract — STANDARD in particular carries the time limit ("Perform NDC in 3
 * minutes or less") that the step list cannot express. Optional because a `derived: true` module
 * transcribed from didactic prose has no such block.
 */
export interface TcccSection {
  /** Stable key used in a `<module>#<section>` ref, e.g. "open-abdominal". */
  key: string
  /** Display title, e.g. "Open Abdominal Wound". */
  title: string
  /** The sheet's TASK line — the action being evaluated. */
  task?: string
  /** The sheet's CONDITION line — the scenario the sheet is graded under. */
  condition?: string
  /** The sheet's STANDARD line — the pass bar, including any time limit. */
  standard?: string
  /** The sheet's EQUIPMENT line — what the sheet assumes is on hand. */
  equipment?: string
  /** Sheet-level NOTEs printed above step 01, which scope the whole sheet rather than one step. */
  notes?: string[]
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
    // Referenced by 081-000-0120 (Perform a Simple (Finger) Thoracostomy) step 2 and by
    // 081-000-0037 (Treat a Patient With Chest Injury) substeps 2a/2b.
    //
    // ⚠️ 'finger-thoracostomy' IS STILL UNSOURCED. The 23 JAN 21 skill instructions carry exactly
    // two sheets — Chest Seal and NDC — so 0120's `#finger-thoracostomy` ref resolves the module
    // but no section. That is deliberate, not an oversight: the module is no longer `pending`, so
    // IctlPanel's per-sheet fallback is what covers the ref. Do NOT invent the sheet from the NDC
    // steps; a thoracostomy is a different procedure with its own graded standard.
    key: 'tccc-respiration-assessment-management',
    name: 'JTS Respiration Assessment and Management Skill Sheet',
    module: 'TCCC Module 8: Respiration Assessment and Management in TFC',
    pending: false,
    source: 'TCCC Combat Medic/Corpsman Skill Instructions #TCCC-CMC-09-01, 23 JAN 21 — Module 08: Respiration Assessment and Management in TFC',
    sections: [
      {
        key: 'chest-seal',
        title: 'Chest Seal',
        task: 'Apply an occlusive dressing/vented chest seal to an open/sucking chest wound.',
        condition:
          "Given a scenario where casualty and responder are in combat gear in the Tactical Field Care phases and the casualty has an open chest injury and you have a vented chest seal (preferred) or a non-vented chest seal to cover the defect, and the casualty's Joint First Aid Kit (JFAK).",
        standard:
          'Demonstrate proper application of a vented chest seal following all steps and meeting performance measures without causing further injury to the casualty.',
        equipment: "Casualty's JFAK with a vented chest seal.",
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          {
            number: '1',
            text: 'Expose and uncover any anterior, posterior, or axillary chest wounds.',
            note: 'If multiple wounds are found, treat them in the order in which you found them.',
          },
          {
            number: '2',
            text: 'Check for signs of an open and/or sucking chest wound.',
            note: 'If you are not sure whether the wound has penetrated the chest wall completely, treat the wound as though it were an open chest wound.',
          },
          { number: '3', text: 'Place hand or back of hand over the open chest wound to create a temporary seal.' },
          {
            number: '4',
            text: "Fully open the outer wrapper of the commercial vented chest seal or other airtight material from the casualty's JFAK.",
            note: 'If a vented chest seal is not available, use a non-vented chest seal.',
          },
          { number: '5', text: 'Remove and use the 4x4 gauze from the commercial vented chest seal package (or other gauze) to wipe away any dirt, blood, or other fluid.' },
          { number: '6', text: 'Peel off the protective liner, exposing the adhesive portion of the vented chest seal.' },
          {
            number: '7',
            text: 'As the casualty exhales, place the adhesive side directly over the open/sucking chest wound, while pressing firmly to create a seal.',
            note: 'Ensure edges of the chest seal extend 2 inches beyond the edges of the wound.',
          },
          {
            number: '8',
            text: 'Ensure that the adhesive surface of the chest seal is adhering to the skin.',
            note: 'Tape may be used to secure the edges of the vented chest seal if needed.',
          },
          {
            number: '9',
            text: 'Assess the effectiveness of the vented chest seal when the casualty breathes.',
            note: 'When the casualty inhales, the plastic should be sucked against the wound, preventing air entry. When the casualty exhales, trapped air should be able to escape from the wound and out the commercial chest seal valve.',
          },
          { number: '10', text: 'Check/feel for additional open/sucking chest wounds (anterior, axillary, and posterior) by using a raking motion and treat them the same way with additional vented chest seals (repeat steps 3-9), if needed.' },
          { number: '11', text: 'Place a conscious casualty in a sitting position or a position of comfort that best allows the casualty to breathe; place an unconscious casualty with their injured side down in the recovery position.' },
          {
            number: '12',
            text: 'Monitor for signs of a tension pneumothorax.',
            note: 'Signs include significant torso trauma or primary blast injury followed by severe/progressive respiratory distress (a respiratory rate less than 8 or greater than 20 breaths per minute, or an oxygen saturation <90%).',
          },
          {
            number: '13',
            text: 'If signs of a tension pneumothorax develop, lift one edge of the vented chest seal and allow the tension pneumothorax to decompress ("burping" the seal).',
            note: 'Alternatively, remove the chest seal for a few seconds to decompress and then reapply or replace it with a new commercial vented chest seal.',
          },
          { number: '14', text: 'If the signs of a tension pneumothorax persist despite burping the vented chest seal, perform a Needle Decompression of the Chest (see Needle Decompression of the Chest Instruction).' },
          { number: '15', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'needle-decompression',
        title: 'Needle Decompression of the Chest (NDC)',
        task: 'Perform NDC.',
        condition:
          'Given a scenario where the casualty and responder are in combat gear in the Tactical Field Care phase and the casualty has significant torso trauma followed by severe/progressive respiratory distress, and you have NDC equipment in your Combat Lifesaver (CLS) or medic aid bag.',
        standard: 'Perform NDC in 3 minutes or less.',
        equipment: 'CLS/medic aid bag, exam gloves, 14- or 10-gauge, 3.25 in needle/catheter unit, and a sharps container.',
        notes: ['Consider body substance isolation.', 'If a CLS is available, direct them to assist.'],
        steps: [
          {
            number: '1',
            text: 'Assess the casualty for signs of suspected tension pneumothorax.',
            note: 'Signs of a tension pneumothorax include significant torso trauma or primary blast injury followed by severe/progressive respiratory distress (respiratory rate of less than 8 or greater than 20 breaths per minute, or an oxygen saturation <90%).',
          },
          { number: '2', text: 'If a vented chest seal has been previously applied, burp or remove the vented chest seal (if improperly applied, replace the vented chest seal) and reassess the casualty (see Chest Seal Instruction).' },
          { number: '3', text: 'Identify site placement for needle insertion on the side of the injury. Either of two sites can be used, whichever one is more accessible.' },
          { number: '3a', text: 'Fifth intercostal space (ICS) in the anterior axillary line on the side of the injury or decreased breath sounds.', isSubStep: true },
          {
            number: '3b',
            text: 'Second ICS at the midclavicular line on the side of the injury or decreased breath sounds.',
            isSubStep: true,
            note: 'Do not insert the needle medial to the nipple line.',
          },
          {
            number: '4',
            text: 'Secure a 14-gauge or a 10-gauge, 3.25 in needle/catheter unit.',
            note: 'Remove the Luer lock cap from the needle catheter (if applicable).',
          },
          { number: '5', text: 'If available, use an antiseptic solution or a pad to clean the site.' },
          { number: '6', text: 'Insert the needle/catheter just over the top of the lower rib at the insertion site, at a 90-degree angle (perpendicular) to the chest wall, advancing it to the hub.' },
          { number: '7', text: 'Leave the needle/catheter unit in place for 5-10 seconds to allow decompression to occur; then remove the needle, leaving the catheter in place.' },
          { number: '8', text: 'Assess for successful needle decompression.' },
          { number: '8a', text: 'Respiratory distress improves.', isSubStep: true },
          {
            number: '8b',
            text: 'There is an obvious hissing sound as air escapes from the chest when NDC is performed.',
            isSubStep: true,
            note: 'This may be difficult to appreciate in high-noise environments.',
          },
          {
            number: '8c',
            text: 'Hemoglobin oxygen saturation increases to 90% or greater (respiratory distress should improve).',
            isSubStep: true,
            note: 'This may take several minutes and may not happen at altitude.',
          },
          {
            number: '9',
            text: "If the first NDC fails to improve the casualty's signs/symptoms, then perform a second NDC on the same side of the chest at whichever of the two recommended sites was not previously used.",
            note: 'Use a new needle/catheter unit for the second decompression attempt.',
          },
          { number: '10', text: 'Place the casualty in a position of comfort or recovery position with the injured side down.' },
          { number: '11', text: 'Continue reassessing the casualty for the reoccurrence of progressive respiratory distress.' },
          { number: '12', text: 'If the initial NDC was successful, but symptoms later recur, then perform another NDC at the same site that was used previously. Use a new needle/catheter unit for the repeat NDC.' },
          { number: '13', text: 'If the second NDC is also not successful, then continue onto the Circulation section of the Massive bleeding, Airway, Respiration, Circulation, Hypothermia/Head injury sequence.' },
          { number: '14', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
    ],
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
  {
    // Referenced by 081-000-0125 (Treat Massive Hemorrhage) at its TEN LEAF substeps, 2a(1)–2b(6).
    // Per the sheet-grain rule on TcccSection: 'extremity' and 'junctional' are the packet's topic
    // headings (2a and 2b), NOT skill sheets, so they are not section keys — each leaf below them
    // is a separately-headed sheet and gets its own. Keys fixed forward:
    //   extremity  — 'windlass-tourniquet', 'ratchet-tourniquet', 'improvised-limb-tourniquet',
    //                'wound-packing-pressure-bandage'
    //   junctional — 'injectable-hemostatic-sponges', 'neck-junctional', 'axillary-junctional',
    //                'inguinal-pdd', 'inguinal-combat-clamp', 'junctional-tourniquet'
    // Source sheets not yet transcribed — every ref degrades to the module-level render until then.
    key: 'tccc-massive-hemorrhage-control',
    name: 'JTS Massive Hemorrhage Control Skill Sheets',
    module: 'TCCC Module 06: Massive Hemorrhage Control in TFC',
    pending: true,
    sections: [],
  },
  {
    // Referenced by 081-000-0238 (Place an Intraosseous Device) substeps 2a–2d. The four IO skill
    // sheets sit under Module 10 per the JTS TCCC-CMC minimum required skills list (TAB B of the
    // JTS memo), which is why an IO task hangs off the shock module. The four keys fixed forward
    // — 'sternal', 'humerus', 'proximal-tibia', 'distal-tibia' — all landed on real sheets.
    //
    // The module carries three MORE sheets than 0238 needs (saline lock, TXA, IV/IO fluids). That
    // is the containment model working as designed, not surplus to prune: 'iv-io-fluids' in
    // particular is cross-referenced by step 2 of all four IO sheets.
    key: 'tccc-shock-recognition-management',
    name: 'JTS Shock Recognition and Management Skill Sheets',
    module: 'TCCC Module 10: Shock Recognition & Management',
    pending: false,
    source: 'TCCC Combat Medic/Corpsman Skill Instructions #TCCC-CMC-09-01, 09 FEB 22 — Module 10: Shock Recognition and Management',
    sections: [
      {
        key: 'saline-lock',
        title: 'Saline Lock (Field-Ruggedized)',
        task: 'Insert a saline lock (field-ruggedized).',
        condition: 'Given a scenario in the Tactical Field Care phase where you encounter a casualty with radial pulses and significant injuries.',
        standard: 'Obtain intravenous (IV) access for the casualty in 5 minutes or less.',
        equipment:
          'IV set with saline lock, needle/catheter, tape and/or transparent film dressing, an IV constricting band, alcohol or povidone-iodine pad(s), syringe, saline, and a sharps container.',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '1', text: 'Gather, prepare, and inspect equipment.' },
          { number: '2', text: 'Explain the procedure to the casualty and determine known allergies by checking medical tag or asking the casualty (if conscious).' },
          { number: '3', text: 'Apply an IV constricting band at least 2 inches above the probable venipuncture site.' },
          { number: '4', text: 'Select a desirable vein for IV placement.' },
          { number: '5', text: 'Clean the site with alcohol or a povidone-iodine pad.' },
          { number: '6', text: 'Open 18-gauge needle/catheter and inspect; or if using blood products, use at least a 16-gauge needle/catheter.' },
          { number: '7', text: 'Hold the needle/catheter at a 20- to 30-degree angle, bevel up, over the top of the chosen vein.' },
          { number: '8', text: 'Pierce the skin and advance the needle/catheter until blood is visualized in the flash chamber.' },
          { number: '9', text: 'Decrease the angle of the needle/catheter to 10-15 degrees and advance it 1/8 of an inch.' },
          { number: '10', text: 'Advance the catheter over the needle until the hub touches the skin or until significant resistance is felt.' },
          { number: '11', text: 'Place a finger (nondominant hand) over the vein at the catheter tip by palpating from the bottom of the hub and advancing to the tip; occlude the vein, preventing blood from flowing out of the catheter.' },
          { number: '12', text: 'Remove the needle and secure it in a sharps container.' },
          { number: '13', text: 'Attach the saline lock connector (with your dominant hand) to the catheter hub. If using a Luer lock-type saline lock, attach a syringe with sterile fluid (twisting syringe until seated).' },
          { number: '14', text: 'Release the tamponade from the occluded vein.' },
          { number: '15', text: 'Remove the IV constricting band.' },
          { number: '16', text: 'Clean the surface of the saline lock with alcohol or a povidone-iodine pad.' },
          {
            number: '17',
            text: 'If using a Luer lock-type saline lock, aspirate to confirm patency, and flush the catheter with 5 ml of sterile fluid. OR, if using a standard saline lock, insert a syringe with its attached needle, aspirate, and flush the catheter with 5 ml of sterile IV fluid.',
          },
          { number: '18', text: 'Remove the syringe and secure it in a sharps container. If using a Luer lock-type saline lock, remove and dispose of the syringe.' },
          { number: '19', text: 'Observe the site for signs of infiltration.' },
          {
            number: '20',
            text: 'Apply a transparent film dressing, covering the catheter and the saline lock connector.',
            note: 'Transparent film can be applied before flush, if necessary, to maintain control of the saline lock; exact order of these steps may vary depending on tactical situation and other factors.',
          },
          { number: '21', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'sternal',
        title: 'FAST1® Sternal Intraosseous (IO) Device',
        task: 'Insert a FAST1 IO device.',
        condition:
          'Given a scenario in the Tactical Field Care phase where you encounter a casualty with significant injuries, altered mental status, absent radial pulses, or significant risk of shock that requires fluid resuscitation; you have made two peripheral vascular access attempts that have failed; and you are required to administer a sternal IO.',
        standard: 'Initiate sternal IO access to the casualty within 3 minutes.',
        equipment: 'A FAST1 IO infusion system, alcohol or povidone-iodine pad(s), saline/syringe, and sharps container.',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '1', text: 'Gather, inspect, and prepare equipment.' },
          { number: '2', text: 'Spike intravenous (IV) bag and properly prepare IV tubing (see Administration of Intravenous (IV) and Intraosseous (IO) Fluids Instruction, steps 1-8).' },
          { number: '3', text: 'Locate suprasternal notch landmark.' },
          { number: '4', text: 'Clean site with alcohol or povidone-iodine pad.' },
          { number: '5', text: 'Remove the top half of the target patch backing first, place the target patch at the landmark, and remove the bottom half of the target patch backing.' },
          { number: '6', text: 'Recheck the location of the target patch by verifying that the target zone is on the midline over the manubrium.' },
          { number: '7', text: 'Remove the cap from the FAST1 device and place the bone needle cluster into the target zone of the target patch.' },
          { number: '8', text: 'Maintain the introducer perpendicular to the sternal surface.' },
          { number: '9', text: 'Apply increasing pressure along the introducer axis until release is felt and heard.' },
          { number: '10', text: 'Gently remove the introducer by pulling straight back.' },
          { number: '11', text: 'Push the needles of the introducer into the accompanying sharps foam plug, reattach the sharps protection cap to secure the needles, and dispose of in a sharps container.' },
          { number: '12', text: 'Connect the infusion tube to the right-angle connector on the target patch.' },
          {
            number: '13',
            text: 'Connect the syringe, aspirate to confirm needle is in the marrow (should see flash of blood-tinged material) and flush the infusion tube with 5 ml of sterile IV solution.',
            note: 'This is necessary to flush the bone plug or any obstructing tissue.',
          },
          { number: '14', text: 'Connect the IV infusion tubing and initiate flow of fluids.' },
          { number: '15', text: 'Attach the protective dome to the target patch and secure with tape.' },
          { number: '16', text: 'Administer IV fluids and/or medications as needed.' },
          { number: '17', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'humerus',
        title: 'EZ-IO® (Humerus) Intraosseous (IO) Device',
        task: 'Insert an EZ-IO access device (manually or mechanically) into the humerus.',
        condition:
          'Given a scenario in the Tactical Field Care phase where you encounter a casualty with significant injuries, altered mental status, absent radial pulses, or significant risk of shock that requires fluid resuscitation; and two peripheral vascular access attempts have failed and you are required to establish IO access.',
        standard: "Initiate IO access with an EZ-IO device to the casualty's humerus within 3 minutes.",
        equipment: 'EZ-IO vascular access system, alcohol or povidone-iodine pad(s), 5-10 ml saline/syringe, and sharps container.',
        notes: [
          'This skill instruction is specific to the humeral insertion site.',
          'Consider body substance isolation.',
          'If a Combat Lifesaver is available, direct them to assist.',
        ],
        steps: [
          { number: '1', text: 'Gather, prepare, and inspect equipment.' },
          { number: '2', text: 'Spike intravenous (IV) bag and properly prepare IV tubing (see Administration of Intravenous (IV) and Intraosseous (IO) Fluids Instruction, steps 1-8).' },
          { number: '3', text: 'Prime the IO extension tubing with saline using aseptic technique.' },
          {
            number: '4',
            text: "Have the casualty place their hand over their umbilicus and adduct the casualty's arm.",
            note: 'This causes medial rotation of elbow and humerus and provides greater prominence of the insertion site.',
          },
          {
            number: '5',
            text: 'Palpate the greater tubercle of the proximal humerus and then the surgical neck below that landmark. The ideal insertion site is 1 cm above the surgical neck.',
            note: 'The surgical neck of the humerus is just below the greater tubercle of the proximal tubercle (and should feel like a golf ball on a tee).',
          },
          { number: '6', text: 'Clean site with alcohol or povidone-iodine pad.' },
          {
            number: '7',
            text: 'Locate the proper EZ-IO cartridge. If using a mechanical driver, open the EZ-IO cartridge and attach the needle set to the driver; you should feel a "snap" as the small magnet connects.',
            note: 'The typical size cartridge is colored yellow.',
          },
          {
            number: '8',
            text: 'Prepare the manual EZ-IO needle by removing the needle safety cap. If using the mechanical driver, remove the cap by momentarily powering the driver while holding the cap.',
            caution: 'Keep hands and fingers away from the needle.',
          },
          { number: '9', text: 'While holding the driver or the needle set in your dominant hand, stabilize the arm near the insertion site with your nondominant hand.' },
          { number: '10', text: 'IO driver of the needle set should be placed at a 45-degree angle to the plane of the arm.' },
          { number: '11', text: 'Gently pierce the skin and power or manually advance the needle set until the needle tip touches the bone.' },
          {
            number: '12',
            text: "With consistent steady downward pressure, twist the needle set back and forth (or squeeze the driver's trigger) until you penetrate the bone cortex.",
            note: 'An obvious give or pop is felt when the desired depth is obtained.',
          },
          { number: '13', text: 'Unscrew the stylet counterclockwise and remove stylet from catheter. If using a mechanical driver, gently remove the drill from the needle.' },
          { number: '14', text: 'Place the stylet in a sharps container.' },
          {
            number: '15',
            text: 'Secure the site with an EZ-IO stabilizer, if available.',
            note: 'If a stabilizer is unavailable, secure with bulky dressing and tape to prevent elevated extension tubing from becoming dislodged during casualty care or movement.',
          },
          { number: '16', text: 'Connect primed extension set through the 90-degree IO tubing to the Luer lock EZ-IO hub.' },
          { number: '17', text: 'Connect the 5-10 ml syringe, aspirate to confirm needle is in the marrow (should see flash of blood-tinged material) and flush the infusion tube with 5-10 ml of sterile IV solution.' },
          { number: '18', text: 'Assess for signs of infiltration or complications.' },
          { number: '19', text: 'Prepare for fluid or medication administration.' },
          { number: '20', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'proximal-tibia',
        title: 'EZ-IO® (Proximal/Anterior Tibia) Intraosseous (IO) Device',
        task: 'Insert an EZ-IO access device (manually or mechanically) into the proximal tibia.',
        condition:
          'Given a scenario in the Tactical Field Care phase where you encounter a casualty with significant injuries, altered mental status, absent radial pulses, or significant risk of shock that requires fluid resuscitation; and two peripheral vascular access attempts have failed and you are required to establish IO access.',
        standard: "Initiate IO access with an EZ-IO device to the casualty's proximal tibia within 3 minutes.",
        equipment: 'EZ-IO vascular access system, alcohol or povidone-iodine pad(s), saline, a 5-10 ml saline/syringe, and a sharps container.',
        notes: [
          'This skill instruction is specific to the proximal/anterior tibial insertion site.',
          'Consider body substance isolation.',
          'If a Combat Lifesaver is available, direct them to assist.',
        ],
        steps: [
          { number: '1', text: 'Gather, prepare, and inspect equipment.' },
          { number: '2', text: 'Spike intravenous (IV) bag and properly prepare IV tubing (see Administration of Intravenous (IV) and Intraosseous (IO) Fluids Instruction, steps 1-8).' },
          { number: '3', text: 'Prime the IO extension tubing with saline using aseptic technique.' },
          { number: '4', text: 'Locate the proper site for EZ-IO insertion, one finger width medial to the proximal tibial tuberosity (usually found 3 cm below the patella).' },
          { number: '5', text: 'Clean the site with alcohol or povidone-iodine pad.' },
          {
            number: '6',
            text: 'Locate the proper EZ-IO cartridge. If using a mechanical driver, open the EZ-IO cartridge and attach the needle set to the driver; you should feel a "snap" as the small magnet connects.',
            note: 'The typical size cartridge is colored blue.',
          },
          {
            number: '7',
            text: 'Prepare the manual EZ-IO needle by removing the needle safety cap. If using the mechanical driver, remove the cap by momentarily powering the driver while holding the cap.',
            caution: 'Keep hands and fingers away from the needle.',
          },
          { number: '8', text: 'While holding the driver or the needle set in your dominant hand, stabilize the leg near the insertion site with your nondominant hand.' },
          { number: '9', text: 'Position the driver or the needle set at the insertion site with the needle at a 90-degree angle to the surface of the bone.' },
          { number: '10', text: 'Gently pierce the skin and power or manually advance the needle set until the needle tip touches the bone.' },
          {
            number: '11',
            text: "With consistent steady downward pressure, twist the needle set back and forth (or squeeze the driver's trigger) until you penetrate the bone cortex.",
            note: 'An obvious give or pop is felt when the desired depth is obtained.',
          },
          { number: '12', text: 'Unscrew the stylet counterclockwise and remove it from the catheter. If using a mechanical driver, gently remove the drill from the needle.' },
          { number: '13', text: 'Place the stylet in a sharps container, if available.' },
          {
            number: '14',
            text: 'Secure the site with an EZ-IO stabilizer, if available.',
            note: 'If a stabilizer is unavailable, secure with bulky dressing and tape to prevent elevated extension tubing from becoming dislodged during casualty care or movement.',
          },
          { number: '15', text: 'Connect the primed extension set through the 90-degree IO tubing to the Luer lock EZ-IO hub.' },
          { number: '16', text: 'Connect the 5-10 ml syringe, aspirate to confirm needle is in the marrow (should see flash of blood-tinged material) and flush the infusion tube with 5-10 ml of sterile IV solution.' },
          { number: '17', text: 'Assess for signs of infiltration or complications.' },
          { number: '18', text: 'Prepare for fluid or medication administration.' },
          { number: '19', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'distal-tibia',
        title: 'EZ-IO® (Distal Tibia) Intraosseous (IO) Device',
        task: 'Insert an EZ-IO access device (manually or mechanically) into the distal tibia.',
        condition:
          'Given a scenario in the Tactical Field Care phase where you encounter a casualty with significant injuries, altered mental status, absent radial pulses, or significant risk of shock that requires fluid resuscitation; and two peripheral vascular access attempts have failed and you are required to establish IO access.',
        standard: "Initiate IO access with an EZ-IO device to the casualty's distal tibia within 3 minutes.",
        equipment: 'EZ-IO vascular access system, alcohol or povidone-iodine pad(s), saline, a 5-10 ml syringe, and a sharps container.',
        notes: [
          'This skill instruction is specific to the distal tibial insertion site.',
          'Consider body substance isolation.',
          'If a Combat Lifesaver is available, direct them to assist.',
        ],
        steps: [
          { number: '1', text: 'Gather, prepare, and inspect equipment.' },
          { number: '2', text: 'Spike intravenous (IV) bag and properly prepare IV tubing (see Administration of Intravenous (IV) and Intraosseous (IO) Fluids Instruction, steps 1-8).' },
          { number: '3', text: 'Prime the IO extension tubing with saline using aseptic technique.' },
          { number: '4', text: 'Locate proper site for EZ-IO insertion, two finger widths proximal to the medial malleolus on the distal tibia.' },
          { number: '5', text: 'Clean site with alcohol or povidone-iodine pad.' },
          {
            number: '6',
            text: 'Locate the proper EZ-IO cartridge. If using a mechanical driver, open the EZ-IO cartridge and attach the needle set to the driver; you should feel a "snap" as the small magnet connects.',
            note: 'The typical size cartridge is colored blue.',
          },
          {
            number: '7',
            text: 'Prepare the manual EZ-IO needle by removing the needle safety cap. If using the mechanical driver, remove the cap by momentarily powering the driver while holding the cap.',
            caution: 'Keep hands and fingers away from the needle.',
          },
          { number: '8', text: 'While holding the driver or the needle set in your dominant hand, stabilize the leg near the insertion site with your nondominant hand.' },
          { number: '9', text: 'Position the driver or the needle set at the insertion site with the needle at a 90-degree angle to the surface of the bone.' },
          { number: '10', text: 'Gently pierce the skin and power or manually advance the needle set until the needle tip touches the bone.' },
          {
            number: '11',
            text: "With consistent steady downward pressure, twist the needle set back and forth (or squeeze the driver's trigger) until you penetrate the bone cortex.",
            note: 'An obvious give or pop is felt when the desired depth is obtained.',
          },
          { number: '12', text: 'Unscrew the stylet counterclockwise and remove it from the catheter. If using a mechanical driver, gently remove the drill from the needle.' },
          { number: '13', text: 'Place the stylet in a sharps container, if available.' },
          {
            number: '14',
            text: 'Secure the site with an EZ-IO stabilizer, if available.',
            note: 'If a stabilizer is unavailable, secure with bulky dressing and tape to prevent elevated extension tubing from becoming dislodged during casualty care or movement.',
          },
          { number: '15', text: 'Connect the primed extension set through the 90-degree IO tubing to the Luer lock EZ-IO hub.' },
          { number: '16', text: 'Connect the 5-10 ml syringe, aspirate to confirm needle is in the marrow (should see flash of blood-tinged material) and flush the infusion tube with 5-10 ml of sterile IV solution.' },
          { number: '17', text: 'Assess for signs of infiltration or complications.' },
          { number: '18', text: 'Prepare for fluid or medication administration.' },
          { number: '19', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'txa',
        title: 'Tranexamic Acid (TXA) — Administration',
        task: 'Administer TXA.',
        condition:
          'Given a scenario in the Tactical Field Care phase where you encounter a casualty with significant injuries who will likely need a blood transfusion (for example, presents with hemorrhagic shock, elevated lactate, one or more major amputations, penetrating torso trauma, or evidence of severe bleeding); OR if the casualty has signs or symptoms of significant traumatic brain injury or has altered mental status associated with blast injury or blunt trauma.',
        standard: 'Administer 2 gm of TXA through slow intravenous (IV) or intraosseous (IO) push as soon as possible but not later than 3 hours after injury.',
        equipment: 'TXA and established IV or IO access, syringe, needle measuring at least 1 inch, alcohol or povidone-iodine pad(s), and sharps container.',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '1', text: 'Gather, prepare, and inspect equipment.' },
          { number: '2', text: 'Explain the procedure to the casualty and determine known allergies by checking medical tag or asking the casualty (if conscious).' },
          {
            number: '3',
            text: 'Verify the five rights of medication administration: right patient, right medication, right dose and concentration, right time, right route.',
          },
          { number: '4', text: 'Check the IV line for patency.' },
          {
            number: '5',
            text: 'Assess the IV/IO insertion site for redness, swelling, increased or decreased temperature, or bleeding.',
            note: 'If any of these conditions are present, do not use this IV/IO for administering the IV/IO push medication and establish a new IV/IO access point.',
          },
          { number: '6', text: 'Select a needle measuring at least 1 inch.' },
          { number: '7', text: 'Select an appropriate size syringe for 2 gm of TXA.' },
          {
            number: '8',
            text: 'Connect the needle to the syringe.',
            note: 'Inspect the needle and syringe for any defects.',
          },
          { number: '9', text: 'Draw up an equivalent amount of air for the size of the TXA vial into the syringe.' },
          { number: '10', text: 'Confirm the correct dose of TXA (2 gm).' },
          { number: '11', text: 'Pop off the plastic cap on the top of the TXA vial.' },
          { number: '12', text: 'Clean the top of the TXA vial with an alcohol or povidone-iodine pad.' },
          {
            number: '13',
            text: 'With your nondominant hand, hold the TXA vial and insert the needle into the soft rubber portion of the vial: start at a 45-degree angle with the needle bevel up, then change to a 90-degree angle as the needle pushes through the rubber.',
            caution: 'Take special care not to contaminate the syringe tip and the needle.',
          },
          { number: '14', text: 'While holding the vial and the syringe together, invert them and bring them to eye level.' },
          { number: '15', text: 'Inject the appropriate amount of air into the vial of TXA.' },
          {
            number: '16',
            text: 'Withdraw the appropriate amount of TXA from the vial by drawing back slowly on the syringe plunger until the right medication volume is obtained, making sure that the needle tip is below the solution level at all times to prevent drawing air into the syringe.',
            note: 'The volume to be withdrawn is calculated based on medication dosage and the concentration in the vial.',
          },
          { number: '17', text: 'Assess the syringe for air bubbles and the appropriate volume without withdrawing the needle from the vial.' },
          {
            number: '17a',
            text: 'If air bubbles are present, invert the syringe and needle and tap/flick the syringe with your finger to release the air bubbles. Allow the bubbles to rise to the hub of the needle or tip of the syringe, and then eject the air.',
            isSubStep: true,
          },
          { number: '17b', text: 'Adjust the needle tip to below the level of the fluid and withdraw more TXA until the correct dose is reached, if necessary.', isSubStep: true },
          { number: '18', text: 'Confirm that 2 gm of TXA is now in the syringe.' },
          { number: '19', text: 'Withdraw the needle from the TXA vial.' },
          { number: '20', text: 'Clean the IV/IO injection port with an alcohol or povidone-iodine pad.' },
          { number: '21', text: 'If fluids are being infused, pinch the IV/IO line to stop the flow of fluid.' },
          { number: '22', text: 'Insert the needle into the IV/IO injection port.' },
          { number: '23', text: 'Administer 2 gm of TXA through slow IV/IO push over approximately 1 minute.' },
          { number: '24', text: 'Withdraw the needle.' },
          { number: '25', text: 'Detach the needle from the syringe and discard it into the sharps container.' },
          { number: '26', text: 'Either open the IV/IO line to flush the line or flush with 10 ml of an appropriate fluid if infusing through an IV/IO lock.' },
          { number: '27', text: 'Monitor the casualty for signs and/or symptoms of allergic reactions or other unusual reactions.' },
          { number: '28', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'iv-io-fluids',
        title: 'Administration of Intravenous (IV) and Intraosseous (IO) Fluids',
        task: 'Administer fluids through an IV and/or IO route.',
        condition:
          'Given a scenario in Tactical Field Care where a trauma casualty requires administration of fluids or lifesaving medications and already has established IV or IO access.',
        standard: 'Successfully administer fluids using an IV or IO route, completing steps 1-11 within 5 minutes, without causing further injury to the casualty.',
        equipment: 'IV or IO access, IV/IO fluids, IV/IO or blood tubing, 18-gauge needle/catheter (or 16-gauge if giving blood), and alcohol or povidone-iodine pad(s).',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '1', text: 'Gather all needed supplies.' },
          { number: '2', text: 'Open the infusion set tubing and prepare the fluids to be infused.' },
          {
            number: '3',
            text: 'Close the clamp on the tubing.',
            note: 'The clamp could be a roller clamp or a snap clamp, depending on the tubing set.',
          },
          { number: '4', text: 'Remove the cover from the spike of the tubing and the cover from the spike port of the fluid bag.' },
          { number: '5', text: 'Spike the fluid bag with the tubing spike.' },
          { number: '6', text: 'Hang the fluid bag or place it in a pressure bag.' },
          { number: '7', text: 'Squeeze the drip chamber until it is about 1/2 full.' },
          { number: '8', text: 'Open the tubing clamp to prime the tubing. Once the entire tube is visibly full of fluid, close the clamp.' },
          { number: '9', text: 'Clean the IV saline lock or IO tubing extension with an alcohol or povidone-iodine pad.' },
          { number: '10', text: 'Attach an 18-gauge needle/catheter, or if using blood products, use at least a 16-gauge needle/catheter.' },
          { number: '11', text: 'Insert the needle into the IV saline lock or IO extension set and secure it in place.' },
          { number: '12', text: 'Initiate the flow of fluids.' },
          { number: '13', text: 'Check for signs and/or symptoms of infiltration at the infusion site.' },
          { number: '14', text: 'Monitor the casualty for signs and/or symptoms of allergic reactions or other unusual reactions.' },
          { number: '15', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
    ],
  },
  {
    // Referenced by 081-000-0122 (Perform Surgical Cricothyroidotomy) substeps 3a–3c, which are the
    // module's three cricothyroidotomy skill sheets. Section keys fixed here: 'bougie-aided',
    // 'open-surgical', 'cric-key'. The packet's step 3c reads only "Cricothyroidotomy" with no
    // qualifier — TAB C of the JTS memo resolves it as the Cric-Key sheet, which is why the third
    // key is not a literal transcription of the step text. Not yet transcribed — pending.
    key: 'tccc-airway-management-tfc',
    name: 'JTS Airway Management in TFC Skill Sheets',
    module: 'TCCC Module 07: Airway Management in TFC',
    pending: true,
    sections: [],
  },
  {
    // Referenced by 081-000-0231 (Treat a Patient Suspected of Shock) step 4 with a BARE ref —
    // the module is one sheet, so "the whole module" and "the sheet" are the same thing here.
    key: 'tccc-hypothermia-prevention-treatment',
    name: 'JTS Hypothermia Prevention and Treatment Skill Sheets',
    module: 'TCCC Module 12: Hypothermia Prevention & Treatment',
    pending: false,
    source: 'TCCC Combat Medic/Corpsman Skill Instructions #TCCC-CMC-09-01, 24 JAN 21 — Module 12: Hypothermia Prevention and Treatment',
    sections: [
      {
        key: 'hypothermia-prevention-treatment',
        title: 'Hypothermia Prevention and Treatment',
        task: 'Prevent and/or treat hypothermia.',
        condition:
          'Given a Tactical Field Care scenario where the trauma casualty has signs and symptoms of hypothermia or is at risk of hypothermia.',
        standard:
          'Prevent and/or treat hypothermia following all steps and meeting performance measures without causing further harm to the casualty.',
        equipment:
          'Active warming devices (commercially available) and/or passive warming materials (e.g., poncho, wool blanket, dry wrap, Mylar or space blanket).',
        notes: [
          'Aggressive steps should be taken early to prevent further loss of body heat and, when possible, actively warm (by adding external heat) trauma and burn casualties.',
          'Consider body substance isolation.',
          'If a Combat Lifesaver is available, direct them to assist.',
          'Ensure hemostasis, assess, and treat for hemorrhagic shock (see Shock Recognition and Management Instructions).',
        ],
        steps: [
          { number: '1', text: "Minimize casualty's exposure to cold ground, wind, and cool ambient air temperatures as soon as possible." },
          { number: '2', text: 'Place insulation material between the casualty and any cold surface (ground, vehicle, etc.) as soon as possible.' },
          { number: '3', text: 'Keep dry clothing and protective gear on or with the casualty, if feasible; expose the casualty only to the extent necessary for assessment and treatment.' },
          { number: '4', text: 'Remove any wet clothes and replace them with dry clothes/other dry materials, if possible.' },
          { number: '5', text: 'If using a hypothermia kit, remove the vapor barrier shell, open completely, and place the casualty centered on the shell.' },
          { number: '6', text: 'If a commercially available vapor barrier shell is not available, place the casualty centered on an impermeable vapor barrier (space blanket, survival blanket, plastic tarp, poncho liner, waterproof sleeping bag shell, body bag, etc.).' },
          { number: '7', text: "If an active warming device is available, open the active warming device package, remove the device, and expose to air (per manufacturer's guidance)." },
          {
            number: '8',
            text: "Apply the active warming device on the casualty's anterior torso and under the arms in the axillae.",
            caution: 'Do not place the active warming device directly on the skin to prevent burns.',
          },
          {
            number: '9',
            text: 'If an active warming device is not available, wrap passive warming materials (blanket, etc.) under and around the casualty, including the head.',
            caution: 'Passive hypothermia prevention does not reverse the hypothermic process.',
          },
          {
            number: '10',
            text: 'Wrap the entire vapor barrier shell (or other improvised impermeable vapor barrier materials) completely around the casualty, including the head, and secure using tape if necessary.',
            note: "Do not cover up the casualty's face. As soon as possible, upgrade any improvised vapor barrier to a well-insulated enclosure system as additional materials become available. As a planning factor, pre-stage an insulated hypothermia enclosure system with external active heating for transition from non-insulated hypothermia enclosure systems.",
          },
          { number: '11', text: 'Protect the casualty from further exposure to wind and precipitation while awaiting evacuation.' },
          { number: '12', text: 'Monitor the casualty closely for life-threatening conditions.' },
          { number: '13', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
    ],
  },
  {
    // NOT referenced by any ICTL packet — nothing in ICTLContent.ts mentions an eye shield or
    // visual acuity, so this module is browsable on its own and rolls up into no task's grade.
    // That is the containment model tolerating a module with zero refs, not a missing wiring job:
    // do NOT invent a tcccModuleRef to justify it. The nearest ICTL neighbours are 081-68W-0240
    // (EENT complaint), which has no packet yet, and jts-wound-management#general step 2, which
    // says only "shield any unshielded eye injury" without naming a sheet.
    //
    // Source is the TIER 2 Combat Lifesaver deck, not a CMC skill instruction — the weak fidelity
    // class. There is no TASK/CONDITION/STANDARD/EQUIPMENT block to transcribe because a slide
    // deck does not publish one; the section header fields are deliberately left empty rather than
    // reconstructed from the learning objectives.
    key: 'tccc-eye-injuries',
    name: 'JTS Eye Injuries Skill Sheets',
    module: 'TCCC Module 14: Eye Injuries',
    pending: false,
    source: 'TCCC Combat Lifesaver Didactic Slides #TCCC-CLS-PPT-14, 15 MAY 25 — Module 14: Eye Injuries',
    derived: true,
    sections: [
      {
        // The deck's SKILL STATION slide names exactly two skills; these are the first.
        key: 'rapid-visual-acuity',
        title: 'Rapid Field Visual Acuity Testing',
        notes: [
          'Rapid visual acuity testing is NOT a formal vision screening with a Snellen Eye Chart.',
          'This is the FIRST action when a penetrating eye injury is noted or suspected — test before covering the eye, because a rigid eye shield makes the test impossible afterward.',
        ],
        steps: [
          {
            number: '1',
            text: "Test the casualty's ability to read print.",
            caution: 'DO NOT force open a swollen eye to conduct a field visual acuity test.',
          },
          { number: '2', text: "Test the casualty's ability to count fingers." },
          { number: '3', text: "Test the casualty's ability to identify hand motion." },
          { number: '4', text: "Test the casualty's ability to differentiate light from dark." },
          {
            number: '5',
            text: 'Document the findings on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.',
            note: 'Document visual acuity for BOTH eyes, not only the injured one.',
          },
        ],
      },
      {
        key: 'rigid-eye-shield',
        title: 'Application of a Rigid Eye Shield',
        notes: ['Perform and document a rapid field test of visual acuity BEFORE covering the eye.'],
        steps: [
          {
            number: '1',
            text: "Retrieve the rigid eye shield from the casualty's Joint First Aid Kit (JFAK).",
            note: 'If a rigid eye shield is not available, use an improvised shield — a styrofoam or plastic cup — or unit-issued tactical protective eyewear.',
          },
          {
            number: '2',
            text: 'Cover the affected eye with the rigid eye shield.',
            warning:
              'Use a rigid eye shield, NOT a pressure patch. DO NOT apply pressure to or manipulate the injured eye — pressure could force the interior contents of the eye out of the eyeball through a cut or laceration.',
          },
          {
            number: '3',
            text: 'Secure the rigid eye shield with tape at 45-degree angles across the forehead and cheek.',
            caution: 'Do NOT cover both eyes unless both eyes are injured.',
          },
          {
            number: '4',
            text: "If the casualty is conscious and able to swallow, administer the casualty's complete Combat Wound Medication Pack (CWMP). If they are unable to swallow, administer IV/IM antibiotics.",
          },
          {
            number: '5',
            text: 'Document all assessments and treatments on the DD Form 1380 TCCC Casualty Card and attach it to the casualty.',
            note: 'Include the results of the rapid visual acuity test, and any medications administered with the time administered.',
          },
        ],
      },
    ],
    didactic: {
      keyPoints: [
        'Prevention comes first: using tactical eyewear in the field will generally prevent the eye injury from happening at all.',
        'Suspect a penetrating eye injury on any of: bleeding surrounding the eye, inside the globe, or coming from the globe; obvious penetration of shrapnel or foreign bodies into the globe or eye socket; objects protruding from the globe; swelling or lacerations of the globe; protrusion of the globe from the socket; reduced vision with swelling of the eye area; or misshapen or distorted parts of the eye.',
        'When a penetrating eye injury is noted or suspected the sequence is fixed: test visual acuity and document it, cover the affected eye with a rigid eye shield (not a pressure patch), then administer the complete CWMP or IV/IM antibiotics if the casualty cannot swallow.',
        'Eye injuries are addressed under WOUNDS in MARCH PAWS — after the life-threatening MARCH sequence, never before it.',
      ],
      checkOnLearning: [
        {
          q: 'What kind of dressing should be used on penetrating eye trauma with an impaled object?',
          a: 'A rigid eye shield — or an improvised shield such as a styrofoam or plastic cup, or tactical protective eyewear. Never a pressure patch, and never anything that presses on or manipulates the eye.',
        },
        {
          q: 'When should a pressure dressing be used in treating traumatic eye injuries?',
          a: 'Never. Pressure on the eye could force the interior contents of the eye out of the eyeball through a cut or laceration.',
        },
        {
          q: 'True or False: The Snellen Eye Chart is used for performing a rapid field visual acuity test.',
          a: 'False. A rapid field test checks the ability to read print, count fingers, identify hand motion, and differentiate light from dark. It is not a formal vision screening with a Snellen Eye Chart.',
        },
        {
          q: 'True or False: Only the injured eye should be covered with an eye shield.',
          a: 'True. Do not cover both eyes unless both eyes are injured — though visual acuity is documented for both eyes regardless.',
        },
      ],
    },
  },
  {
    // Referenced by 081-000-0044 (Treat a Patient With Burn Injuries) at TASK level only — Module
    // 18 is that packet's primary reference and its Standards defer wholesale ("IAW TCCC CMC
    // Module 18 Burns"), but no individual step names a separate skill sheet, so there is nothing
    // to address with a section ref. TAB C maps the ICT to "Burn Treatment" + "Fluid Resuscitation
    // for Burns"; those are the section keys to use when the sheet is transcribed.
    key: 'tccc-burns',
    name: 'JTS Burns Skill Sheets',
    module: 'TCCC Module 18: Burns',
    pending: true,
    sections: [],
  },
  {
    // Referenced by 081-000-0049 (Perform Tactical Combat Casualty Care) at task level. Module 05
    // is THE culminating sheet: 0049's Evaluation Guidance says the evaluator "needs to utilize
    // current JTS TCCC culminating Module 05: Tactical Trauma Assessment skill sheet to evaluate
    // the Perform Tactical Combat Casualty Care task", it is the packet's only primary reference,
    // and TAB C records the ICT's single skill met as "Tactical Trauma Assessment". Every other
    // module 0049 names (03, 04, 06-24) is a reference row, not the component it rolls up.
    key: 'tccc-tactical-trauma-assessment',
    name: 'JTS Tactical Trauma Assessment Skill Sheet',
    module: 'TCCC Module 05: Tactical Trauma Assessment',
    pending: true,
    sections: [],
  },
  {
    // Transcribed from the Skill Instructions PDF, ten independently-headed sheets. NOT referenced
    // by any ICTL packet's tcccModuleRef — Module 20 is named only in 0049's reference table and
    // in its step 2 note ("Module 20: Casualty Monitoring will be assessed throughout the entire
    // task"). It is authored here because it is the doctrinal home of two STP tasks that otherwise
    // screen as extraneous-but-graded: 081-000-1001 Assess Patient Vital Signs (AVPU + the five
    // pulse sheets + respiratory rate) and 081-68W-2036 Perform End Tidal Carbon Dioxide
    // Monitoring (the etco2-colorimetric sheet). Author-once/reference-many: the sheets stand
    // whether or not a packet points at them yet.
    // ⚠️ Doc id #TCCC-CMC-09-01 is NOT module-specific — the Module 12 hypothermia instructions
    // carry the same id with a different date. Do not use the id to identify a module.
    key: 'tccc-casualty-monitoring',
    name: 'JTS Casualty Monitoring Skill Instructions',
    module: 'TCCC Module 20: Casualty Monitoring',
    pending: false,
    source: 'TCCC Combat Medic/Corpsman Skill Instructions #TCCC-CMC-09-01, 18 AUG 21 — Module 20: Casualty Monitoring',
    sections: [
      {
        key: 'avpu',
        title: 'AVPU Assessment',
        task: "Conduct an AVPU assessment to determine a casualty's level of responsiveness",
        condition:
          "Given a Tactical Field Care scenario where the casualty and responder are in combat gear and an evaluation of a casualty's responsiveness is required",
        standard: "Determine the casualty's level of responsiveness using the AVPU scale, following all steps and meeting all performance measures properly",
        equipment: 'N/A',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '01', text: 'Check for responsiveness using the following steps:' },
          {
            number: '02',
            text: 'Ask in a loud, but calm, voice, “Are you okay?”',
            note: 'If the casualty answers coherently, then they are an A = Alert on the AVPU scale and you do not need to follow steps 3–4. If the casualty does not answer or mumbles, proceed to step 3.',
          },
          {
            number: '03',
            text: 'Repeat in a loud, but calm, voice, “Are you okay?” If the answer is not clear, ask the casualty to squeeze your finger or to move an arm or leg.',
            note: 'If the casualty "mumbles" or is responding to voice commands such as "Squeeze my finger," they are a V = Responds to Verbal and you do not need to follow step 4. If the casualty does not respond to voice commands, proceed to step 4.',
          },
          {
            number: '04',
            text: 'Rub the breastbone briskly with a knuckle or squeeze the first or second toe over the toenail, or if the casualty is wearing individual body armor, pinch their nose or earlobe.',
            note: 'Do not try to elicit pain from any injured areas of the casualty. Observe for reaction to your maneuver. If the casualty responds in any way to painful stimuli, they are a P = Responds to Pain.',
          },
          { number: '05', text: 'If the casualty does not respond to any of these three attempts, they are a U = Unresponsive.' },
          { number: '06', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'radial-pulse',
        title: 'Radial Pulse Assessment',
        task: 'Measure a radial pulse',
        condition:
          'Given a casualty in a Tactical Field Care scenario where the casualty and responder are in combat gear and a pulse assessment is needed',
        standard: 'Measure a radial pulse following all steps and meeting all performance measures',
        equipment: 'A watch or device that can display seconds',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          {
            number: '01',
            text: "Position the casualty's hand with the palm facing up.",
            note: 'In this position, you should see a ligament elevated underneath the skin.',
          },
          { number: '02', text: 'Align the middle and index fingers of your dominant hand.' },
          {
            number: '03',
            text: "Place your fingers next to the ligament on the same side as the casualty's thumb.",
            note: 'If your fingers are on the hard surface of the wrist bones, move them down and along the ligament until they reach a softer area.',
          },
          {
            number: '04',
            text: 'Press your fingers into the hollow space to feel the radial artery beneath the skin.',
            note: 'If you cannot feel the pulse, press a little harder, being careful not to hurt the casualty. If you are still having trouble locating the radial artery, slide your fingers up and along the ligament until you reach the bottom of the wrist bones. At the point where the hollow space meets the wrist bones, the pulse is easier to feel.',
          },
          { number: '05', text: 'With a timing device, count the beats of the pulse for 15 seconds.' },
          { number: '06', text: "Multiply that number by four and you will have the casualty's pulse rate (in beats/minute)." },
          { number: '07', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'carotid-pulse',
        title: 'Carotid Pulse Assessment',
        task: 'Measure a carotid pulse',
        condition:
          'Given a casualty in a Tactical Field Care scenario where the casualty and responder are in combat gear and a pulse assessment is needed',
        standard: 'Measure a carotid pulse following all steps and meeting all performance measures',
        equipment: 'A watch or device that can display seconds',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '01', text: 'Align the middle and index fingers of your dominant hand.' },
          {
            number: '02',
            text: "Place your middle and index finger on the side of the casualty's neck, to the side of the trachea, to find the carotid artery.",
          },
          {
            number: '03',
            text: 'Press your fingers into the hollow space to feel the carotid artery beneath the skin.',
            note: 'If you cannot feel the pulse, press a little harder, being careful not to hurt the casualty.',
            caution: 'Be careful not to press too hard over the carotid artery, as this can cause the casualty to become lightheaded.',
          },
          { number: '04', text: 'With a timing device, count the beats of the pulse for 15 seconds.' },
          { number: '05', text: "Multiply that number by four, and you will have the casualty's pulse rate (in beats/minute)." },
          { number: '06', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'posterior-tibial-pulse',
        title: 'Posterior Tibial Pulse Assessment',
        task: 'Measure a posterior tibial pulse',
        condition:
          'Given a casualty in a Tactical Field Care scenario where the casualty and responder are in combat gear and the casualty has suspected injuries to the lower limbs that need treatment or have been treated',
        standard: 'Measure a posterior tibial pulse following all steps and meeting all performance measures',
        equipment: 'A watch or device that can display seconds',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '01', text: 'Align the middle and index fingers of your dominant hand.' },
          {
            number: '02',
            text: "Slide your fingers down the inside of the casualty's boot behind the bony part of the ankle or remove the boot to expose the ankle.",
          },
          { number: '03', text: 'Place your fingers, on the inside of the foot, between the bony part of the ankle bone and the Achilles tendon.' },
          {
            number: '04',
            text: 'Press your fingers into the hollow space to feel the posterior tibial artery beneath the skin.',
            note: 'If you cannot feel the pulse, press a little harder, being careful not to hurt the casualty.',
          },
          { number: '05', text: 'With a timing device, count the beats of the pulse for 15 seconds.' },
          { number: '06', text: "Multiply that number by four and you will have the casualty's pulse rate (in beats/minute)." },
          { number: '07', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'dorsalis-pedis-pulse',
        title: 'Dorsalis Pedis Pulse Assessment',
        task: 'Measure a dorsalis pedis pulse',
        condition:
          'Given a casualty in a Tactical Field Care scenario where the casualty and responder are in combat gear and the casualty has suspected injuries to the lower limbs that need treatment or have been treated',
        standard: 'Measure a dorsalis pedis pulse following all steps and meeting all performance measures',
        equipment: 'A watch or device that can display seconds',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '01', text: "Remove the casualty's boot and sock." },
          { number: '02', text: 'Align the middle and index fingers of your dominant hand.' },
          {
            number: '03',
            text: "Have the top of the casualty's foot facing up.",
            note: 'In this position, you should see an elevated arch underneath the skin on the top of the foot.',
          },
          {
            number: '04',
            text: 'Place fingers just lateral to the extensor tendon (the firm ridge formed by the extensor tendon) of the great toe.',
            note: 'A hollow soft spot should be felt. If you cannot feel a pulse, move fingers more laterally until they reach a softer area.',
          },
          {
            number: '05',
            text: 'Press your fingers into the hollow space to feel the dorsalis pedis artery beneath the skin.',
            note: '(a) If you cannot feel the pulse, press a little harder, being careful not to hurt the casualty. (b) If you are still having trouble locating the dorsalis pedis artery, slide your fingers up and along the ligament until you reach the base of the ankle. (c) At the point where the hollow space meets the foot bones, the pulse is easier to feel. (d) Press your fingers into the hollow space to feel the dorsalis pedis artery beneath the skin.',
          },
          { number: '06', text: 'With a timing device, count the beats of the pulse for 15 seconds.' },
          { number: '07', text: "Multiply that number by four and you will have the casualty's pulse rate (in beats/minute)." },
          { number: '08', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'femoral-pulse',
        title: 'Femoral Pulse Assessment',
        task: 'Measure a femoral pulse',
        condition:
          'Given a casualty in a Tactical Field Care scenario where the casualty and responder are in combat gear and the casualty has suspected injuries to the lower limbs that need treatment or have been treated',
        standard: 'Measure a femoral pulse following all steps and meeting all performance measures',
        equipment: 'A watch or device that can display seconds',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '01', text: 'Position the casualty in the supine position.' },
          { number: '02', text: 'Align the middle and index fingers of your dominant hand.' },
          { number: '03', text: 'Draw an imaginary line from the anterior aspect of the pelvic crest to the pubic bone.' },
          {
            number: '04',
            text: 'Place your fingers halfway between the pubis symphysis and the anterior iliac spine (or slightly medial to that) and press in and up toward the head (just past the inguinal gutter).',
            note: 'The inguinal gutter is the crevice between the top of the thigh and the lower abdomen where heavy blood flow structures are located; it is halfway between the bone above the genitals (pubic bone) and the top of the thigh.',
          },
          {
            number: '05',
            text: 'Press on the artery gently with your two fingers to feel a pulse.',
            note: "You should be able to feel a fairly strong pulse since the femoral artery is so large. (a) If you are unable to feel the pulse, reposition the casualty (ensure they are lying flat on their back with legs outstretched). (b) If you are still unable to find the pulse, rotate the casualty's leg externally, opening up the inner thigh region. (c) If you are still unsuccessful, reposition the leg in external rotation with a slight bend to the knee.",
          },
          { number: '06', text: 'With a timing device, count the beats of the pulse for 15 seconds.' },
          { number: '07', text: "Multiply that number by four and you will have the casualty's pulse rate (in beats/minute)." },
          { number: '08', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'respiratory-rate',
        title: 'Respiratory Rate Measurement',
        task: "Measure a casualty's respiratory rate",
        condition: 'Given a Tactical Field Care scenario where the casualty and responder are in combat gear and a timing device is available',
        standard: "Measure the casualty's respiratory rate following all steps and measures correctly",
        equipment: 'A watch or device that can display seconds',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '01', text: 'Have the casualty assume whatever position is comfortable.' },
          {
            number: '02',
            text: "While using a timing device to time 15 seconds, count the number of times the casualty's chest rises and falls.",
            note: 'Do not tell the casualty that you are going to measure their breathing, because they are likely to change their breathing rate without realizing it.',
          },
          {
            number: '03',
            text: "Multiply the number you counted by four. The resulting number is the casualty's respiratory rate (in breaths/minute).",
            note: 'A respiratory rate greater than 20 breaths per minute indicates respiratory distress.',
          },
          { number: '04', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'pulse-oximetry',
        title: 'Pulse Oximetry (SpO2) Monitoring and Assessment',
        task: 'Monitor and assess SpO2',
        condition: 'Given a scenario in the Tactical Field Care phase where you encounter a casualty who needs a measurement of their SpO2',
        standard: "Measure the casualty's SpO2 using the correct equipment and following the proper steps",
        equipment: 'Pulse oximetry sensor',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          {
            number: '01',
            text: 'Select the appropriate sensing probe location for the casualty. (a) For adults, sensing probes can be placed on the index, middle, or ring finger. (b) Sensing probes can also be placed on the toe unless the casualty has decreased circulation to the lower extremities. (c) Earlobe clips and neonate sensing probes for the foot are available for infants and newborns.',
          },
          { number: '02', text: 'Ensure the site is clean and dry.' },
          {
            number: '03',
            text: 'Apply the sensor so that the emitting light is directly opposite to the detector.',
            note: 'Normal pulse oximetry values will be greater than 95% on room air, with most being between 98% and 100%. Factors that may provide falsely high readings include carbon monoxide poisoning and certain types of toxins. Hypothermia, hypovolemia, and nail polish may make readings difficult or inaccurate.',
          },
          {
            number: '04',
            text: 'Document the oximeter reading, the location of the sensor, the time taken, and the amount of oxygen being delivered (if applicable).',
            caution: "The pulse oximeter is just a tool; do not rely on it solely for indications of the casualty's condition. Treat the casualty, not the machine.",
          },
          { number: '05', text: 'Move sensing probe locations every 2 hours.' },
          { number: '06', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'electronic-monitoring',
        title: 'Electronic Monitoring',
        task: 'Demonstrate electronic vital sign monitoring in Tactical Field Care (TFC)',
        condition:
          'Given a scenario where a casualty is injured and requires electronic monitoring in the TFC phase, and you have an electronic vital sign monitoring device',
        standard: "Demonstrate the application of an electronic vital sign monitoring device and document the casualty's pulse oximetry, blood pressure, and heart rate",
        equipment: 'Electronic vital signs monitoring device',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '01', text: 'Check equipment to ensure that all cables are connected, and all wires and leads are intact and in working order.' },
          {
            number: '02',
            text: 'If the casualty is conscious, explain the procedure to the casualty and have the casualty expose areas in which the monitoring devices will be placed; if the casualty is unconscious, expose those areas for the casualty.',
          },
          { number: '03', text: 'Turn the device on; if electricity is available, plug the unit in to save battery life.' },
          { number: '04', text: "Remove the backing from each electrode and place them on the casualty in accordance with the manufacturer's guidance." },
          { number: '05', text: 'Attach the lead wires to the electrodes.' },
          {
            number: '06',
            text: "Select the desired lead to monitor; feel the casualty's pulse and compare it to the heart rate indicator on the monitor to ensure it is picking up the casualty's rate and rhythm.",
          },
          { number: '07', text: "Attach the blood pressure cuff to the casualty according to manufacturer's guidelines." },
          { number: '08', text: 'Press the start button to measure the blood pressure; consider setting for automated pressure readings, if appropriate.' },
          { number: '09', text: "Attach the pulse oximetry monitoring device to the casualty according to manufacturer's guidelines." },
          { number: '10', text: 'Continue to reassess the casualty as needed.' },
          { number: '11', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
      {
        key: 'etco2-colorimetric',
        title: 'End-Tidal Carbon Dioxide (ETCO2) Monitoring — Colorimetric Detector',
        task: 'Demonstrate use of a colorimetric ETCO2 detector to verify proper placement of an advanced airway',
        condition:
          'While in the Tactical Field Care phase, you encounter a casualty who requires verification of an advanced airway using ETCO2 colorimetric device',
        standard: 'Verify proper advanced airway placement using an ETCO2 detector following the correct sequence of steps',
        equipment:
          'Colorimetric ETCO2 detector, advanced airway (endotracheal tube, supraglottic airway, tracheostomy tube, etc.), and bag valve mask (BVM)',
        notes: ['Consider body substance isolation.', 'If a Combat Lifesaver is available, direct them to assist.'],
        steps: [
          { number: '01', text: 'Remove the ETCO2 detection device from its package.' },
          {
            number: '02',
            text: 'Check the color of the indicator; if it is not similar to the “check” color on the reference scale (usually purple, with the exception of devices with a pull tab, which is usually a specific shade of blue), discard the unit and use a new one.',
          },
          {
            number: '03',
            text: 'Following the establishment of an advanced airway, attach the ETCO2 detector to the advanced airway by sliding the tapered end (15mm internal diameter connector) of the monitoring device onto the airway device.',
          },
          {
            number: '04',
            text: 'Connect the distal end of the device (15mm outer diameter connector), which is identical to an advanced airway connector, to the standard oxygen delivery equipment.',
          },
          { number: '05', text: 'If the device has a pull tab, pull the red tab from the device to activate the ETCO2 detection function.' },
          {
            number: '06',
            text: 'To assess proper airway placement, attach a BVM to the ETCO2 detector, deliver six breaths, and compare the color change in the center indicator of the detector to the color ranges on the detector cover.',
            note: 'Carbon dioxide detectors contain a chemical indicator that is sensitive to CO2. When the detector is attached to a correctly positioned airway, the color of the indicator changes from the baseline “check” color (usually purple or a specific shade of blue) to a numbered or lettered color range (usually yellow) in response to elevated carbon dioxide concentrations. When the detector is attached to an incorrectly positioned airway (in the esophagus, for example), the color of the indicator will not change or there will be an inadequate color change. In devices with a pull tab, a green or yellow/green color change indicates low levels of exhaled CO2.',
            caution: 'ETCO2 detectors can be difficult to read in low-light or night vision conditions.',
          },
          {
            number: '07',
            text: 'If there is no color change or an inadequate color change in the ETCO2 detector, the advanced airway should be repositioned and placement should be reassessed with the ETCO2 detector and a BVM.',
            caution:
              'With very low cardiac output during cardiopulmonary resuscitation, there may be no color change in the ETCO2 detector, even though the airway is properly positioned.',
          },
          { number: '08', text: 'Once the color change is seen, signifying proper airway placement, secure the airway.' },
          {
            number: '09',
            text: 'Continue to monitor the casualty and the ETCO2 detector for the proper color change, reassessing the casualty and repositioning the airway device if the detector reverts to its baseline “check” color or stops changing color with respirations.',
            note: 'While in use, the detector will continuously change colors with inspiration and expiration. If the detector becomes permanently yellow, discard and replace as needed.',
          },
          {
            number: '10',
            text: 'Replace the ETCO2 detector after 2 hours or if exposed to fluids, unless using a device with a pull tab, in which case it can be used for up to 24 hours.',
          },
          { number: '11', text: 'Document all findings and treatments on a DD Form 1380 TCCC Casualty Card and attach it to the casualty.' },
        ],
      },
    ],
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
