// ─── Tour Step & Definition Types ────────────────────────────────────────────

export interface TourStep {
  /** data-tour attribute value on the target element */
  target: string
  /** Short instruction text (1-2 sentences) */
  text: string
  /** Which edge of the target the tooltip appears on */
  placement: 'top' | 'bottom' | 'left' | 'right'
  /** Auto-play duration in ms before advancing (default 4000) */
  duration?: number
  /** If true, auto-play halts here until user taps Next */
  pausePoint?: boolean
  /** Action to execute before showing this step (e.g., open a drawer) */
  beforeStep?: string
  /** Action to execute after advancing past this step */
  afterStep?: string
  /** Delay in ms after beforeStep before showing tooltip */
  delay?: number
  /** Only show this step on mobile */
  mobileOnly?: boolean
  /** Only show this step on desktop */
  desktopOnly?: boolean
}

export type TourCategory = 'getting-started' | 'reference-network' | 'customization' | 'advanced'

export interface TourDefinition {
  id: string
  name: string
  /** Role gate — controls who can see this tour. Medics see only 'medic' tours unless they hold the higher role. */
  tier: 'medic' | 'supervisor' | 'provider'
  /** Functional grouping in the Guided Tours panel. Independent of role gating. */
  category: TourCategory
  description: string
  steps: TourStep[]
  /** Scene-based tours render their own mock UI instead of manipulating the live app */
  scene?: string
  /** If true, only visible to dev-role users (tour not yet production-ready) */
  devOnly?: boolean
  /** Suppress the per-step dot row in the tooltip (use for long tours where the dots would push nav off the card). Replaced with a compact `n / total` label. */
  hideStepperDots?: boolean
}

// ─── Action Keys ─────────────────────────────────────────────────────────────
// beforeStep/afterStep use string keys resolved by the tour orchestrator.
// This avoids storing functions in data (keeps it serializable for future use).
//
// Supported actions:
//   'open:sidenav'           — open the side nav
//   'close:sidenav'          — close the side nav
//   'open:knowledgebase'     — open KB drawer
//   'open:messages'          — open Messages drawer
//   'open:calendar'          — open Calendar drawer
//   'open:settings'          — open Settings drawer
//   'open:supervisor'        — open Supervisor drawer
//   'open:provider'          — open Provider drawer
//   'open:import'            — open NoteImport drawer
//   'open:writenote'         — open WriteNotePage (enables all note sections)
//   'open:symptom-info'      — open the symptom info drawer
//   'close:symptom-info'     — close the symptom info drawer
//   'setup:writenote-demo'   — programmatically navigate to A-1, reconstruct card states, open WriteNotePage
//   'scroll-to:<target>'     — scroll a data-tour element into view (smooth, centered)
//   'open:import-demo'       — generate demo barcode, open NoteImport with it
//   'inject:note-hpi'        — fill HPI with guided tour data
//   'inject:note-pe'         — fill PE with guided tour data
//   'inject:note-plan'       — fill Plan with guided tour data
//   'restore:note-sections'  — revert note section overrides
//   'return:guided-tours'    — close everything, open Settings → Guided Tours panel
//   'close:all'              — close all drawers + sidenav
//   'expander:demo:*'        — text expander tour demo actions (open-and-type, submit, build-*, accept, finish)
//   'messaging:open-self-chat' — dismiss provisional modal, open self-chat
//   'messaging:send-note'     — send a test note to self
//   'messaging:send-reply'    — send a threaded reply to the test note
//   'messaging:open-thread'   — open thread view on the test note
//   'messaging:cleanup'       — delete tour messages, return to guided tours
//   'calendar:setup'          — inject mock event, open calendar drawer on month view
//   'calendar:view:month'     — switch to month view
//   'calendar:view:day'       — switch to day view
//   'calendar:view:troops'    — switch to troops-to-task view
//   'calendar:view:huddle'    — switch to huddle view
//   'calendar:open-controls'   — open mobile controls drawer
//   'calendar:close-controls'  — close mobile controls drawer
//   'calendar:open-event-form' — click add button, wait for event form
//   'calendar:select-huddle-category' — set event category to 'huddle' so the huddle-task picker reveals
//   'calendar:open-export-import' — open the calendar export/import controls
//   'calendar:cleanup'         — delete mock event, return to guided tours
//   'note:open-ddx'            — open the differential diagnoses picker on WriteNotePage
//   'note:select-ddx-demo'     — select 1-2 demo differentials inside the DDX picker
//   'note:close-ddx'           — dismiss the differential picker overlay
//   'supervisor:open-first-area'  — navigate into first coverage area in supervisor panel
//   'supervisor:cleanup'          — reset to base state, close supervisor, return to guided tours
//   'clinic:open'                 — close all, open Settings → Clinic panel
//   'clinic:cleanup'              — reset clinic state, return to guided tours
//   'planorderset:setup'          — open Settings → Plan panel, enable edit mode
//   'planorderset:add-med-1'      — stage Tylenol 325mg tab tag
//   'planorderset:add-med-2'      — stage Mucinex 500mg tab tag
//   'planorderset:add-instruction' — stage instruction tag
//   'planorderset:add-followup'   — stage follow-up tag
//   'planorderset:start-compose'  — enter order set name and begin composing
//   'planorderset:select-tags'    — select all staged tags in compose mode
//   'planorderset:save-compose'   — save the composed order set
//   'planorderset:cleanup'        — cancel edit (discards staging), return to guided tours
//   'navigate:settings:overview-widgets' — open Settings → Mission Overview panel
//   'navigate:settings:theme-picker'     — open Settings → Appearance panel
//   'navigate:settings:back'             — slide back to main settings panel
//   'open:tc3'                    — enable TC3 mode (sets tc3Mode = true in authStore)
//   'tc3:advance-page'            — advance mobile wizard to MARCH page (mobile only)
//   'tc3:cleanup'                 — exit TC3 mode, reset wizard step, return to guided tours
//   'open:property'               — open the Property Book drawer
//   'property:cleanup'            — close property drawer, return to guided tours

// ─── Tier 1: Medic Tours ─────────────────────────────────────────────────────

const gettingStarted: TourDefinition = {
  id: 'getting-started',
  name: 'Getting Started',
  tier: 'medic',
  category: 'getting-started',
  scene: 'getting-started',
  description: 'Learn the basics — navigation, menu, and core features.',
  steps: [
    {
      target: 'menu-button',
      text: 'Tap to open the side navigation menu.',
      placement: 'bottom',
      duration: 4000,
    },
    {
      target: 'sidenav-profile',
      text: 'This is your profile. Tap to view or edit your details.',
      placement: 'bottom',
      beforeStep: 'open:sidenav',
      delay: 350,
      pausePoint: true,
    },
    {
      target: 'sidenav-knowledgebase',
      text: 'The Knowledge Base gives you offline access to medications, training tasks, screeners, and calculators.',
      placement: 'bottom',
      mobileOnly: true,
    },
    {
      target: 'sidenav-calendar',
      text: 'Your unit calendar. Edit events, view troops to task, and project your tasks',
      placement: 'bottom',
    },
    {
      target: 'sidenav-property',
      text: 'Property Book — track clinic equipment, serialized gear, and consumables by location.',
      placement: 'bottom',
    },
    {
      target: 'sidenav-settings',
      text: 'Settings — theme, PIN lock, notifications, and your clinical preferences.',
      placement: 'top',
      pausePoint: true,
      afterStep: 'return:guided-tours',
    },
  ],
}

const algorithmNavTour: TourDefinition = {
  id: 'algorithm-nav',
  name: 'Algorithm Navigation',
  tier: 'medic',
  category: 'getting-started',
  description: 'Navigate categories, view symptom info, and walk through an algorithm.',
  steps: [
    {
      target: 'category-list',
      text: 'ADTMC categories are organized by body system. Tap one to see its complaints. Keep in mind there are miscellaneous categories as well as return categories',
      placement: 'bottom',
      duration: 6000,
    },
    {
      target: 'subcategory-item',
      text: "Each complaint maps to an ADTMC algorithm. We'll use A-1 Sore Throat for example. Always screen by symptom precidence to get life, limb, eyesight complaints",
      placement: 'right',
      beforeStep: 'navigate:category:1',
      delay: 400,
      duration: 5000,
    },
    // Mobile: info button is in the header
    {
      target: 'info-button',
      text: 'Before starting the algorithm, tap info to see general information, differential diagnoses, and training material for this algorithm.',
      placement: 'bottom',
      beforeStep: 'navigate:symptom:1:1',
      delay: 600,
      duration: 5000,
      mobileOnly: true,
    },
    // Desktop: symptom info is always visible in the left panel
    {
      target: 'guidelines-panel',
      text: 'differentials, training references, and guidelines are always visible here. You can view the training material by selecting an item from the STP',
      placement: 'left',
      beforeStep: 'navigate:symptom:1:1',
      delay: 600,
      duration: 5000,
      desktopOnly: true,
    },
    {
      target: 'symptom-info-content',
      text: 'Differentials, training references, and general information are available for review',
      placement: 'bottom',
      beforeStep: 'open:symptom-info',
      delay: 500,
      duration: 5000,
      mobileOnly: true,
    },
    {
      target: 'symptom-info-content',
      text: 'Review this before starting your assessment. Tap Next when ready.',
      placement: 'bottom',
      pausePoint: true,
      afterStep: 'close:symptom-info',
      mobileOnly: true,
    },
    {
      target: 'algorithm-cards',
      text: 'Each card is a clinical decision point. Select a symptom or choose an answer to auto-navigate to the next.',
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'algorithm-initial-card',
      text: "Card 1: Red flags — these trigger immediate CAT I 'Provider Now.'",
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'algorithm-card-2',
      text: 'Card 2: Complicating factors. Select any that apply.',
      beforeStep: 'answer:1:1',
      delay: 1200,
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'algorithm-card-2',
      text: "None apply. Answering 'No' to continue.",
      placement: 'bottom',
      beforeStep: 'answer:2:1',
      delay: 1200,
      duration: 4000,
    },
    {
      target: 'algorithm-card-3',
      text: 'Card 3: Centor criteria — 3+ gets a rapid strep test. 0-2 means likely viral.',
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'algorithm-card-3',
      text: '0 Centor criteria — viral picture.',
      placement: 'bottom',
      beforeStep: 'answer:3:1',
      delay: 1200,
      duration: 4000,
    },
    {
      target: 'algorithm-disposition',
      text: 'Disposition reached: CAT III — Treatment Protocol and RTD.',
      placement: 'top',
      delay: 800,
      pausePoint: true,
      afterStep: 'return:guided-tours',
    },
  ],
}

const noteLifecycleTour: TourDefinition = {
  id: 'note-lifecycle',
  name: 'Write Note & Export',
  tier: 'medic',
  category: 'getting-started',
  description: 'SOAP, preview, encode, and import.',
  hideStepperDots: true,
  steps: [
    // ── Section toggles ──
    {
      target: 'writenote-section-toggles',
      text: 'Full Note toggle — on for a complete SOAP note, off for a quick decision-only note as the situation calls for.',
      placement: 'bottom',
      beforeStep: 'setup:writenote-demo',
      delay: 600,
      duration: 5000,
    },
    {
      target: 'writenote-decision-toggle',
      text: 'Decision Making toggle — captures the algorithm path and disposition you walked through. Pair with Full Note, or send on its own.',
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'writenote-hpi',
      text: "The History of Present Illness (HPI) — Subjective information. This is what the patient TELLS you.",
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'writenote-hpi',
      text: 'We pre-filled a typical sore throat HPI. Text expanders speed this up — type a shortcut, and a template fills in.',
      placement: 'bottom',
      beforeStep: 'inject:note-hpi',
      delay: 200,
      duration: 6000,
    },
    {
      target: 'writenote-pe',
      text: 'Physical Exam — the Objective (O). Tap any body system to open its findings preview.',
      placement: 'bottom',
      beforeStep: 'scroll-to:writenote-pe',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'writenote-pe',
      text: 'This is the preview for GEN. Each row shows normal on the left and abnormal options on the right.',
      placement: 'bottom',
      beforeStep: 'pe:open-preview:gen',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'writenote-pe',
      text: 'Tap the check icon to mark everything normal in one tap.',
      placement: 'bottom',
      beforeStep: 'pe:mark-normal',
      delay: 300,
      duration: 4000,
    },
    {
      target: 'writenote-pe',
      text: 'If you need to start over, tap reset to clear all selections.',
      placement: 'bottom',
      beforeStep: 'pe:reset',
      delay: 300,
      duration: 4000,
    },
    {
      target: 'writenote-pe',
      text: 'You can also tap individual abnormal findings. Let\'s switch to the Nose block.',
      placement: 'bottom',
      beforeStep: 'pe:switch-preview:nose',
      delay: 500,
      duration: 5000,
    },
    {
      target: 'writenote-pe',
      text: 'Here we select clear rhinorrhea — the abnormal highlights and its corresponding normal deselects automatically.',
      placement: 'bottom',
      beforeStep: 'pe:toggle-abnormal:clearRhinorrhea',
      delay: 300,
      duration: 5000,
    },
    {
      target: 'writenote-pe',
      text: 'All findings compile into the exam note. Here\'s our full sore throat exam.',
      placement: 'bottom',
      beforeStep: 'pe:close-preview',
      delay: 400,
      duration: 5000,
      afterStep: 'inject:note-pe',
    },
    // ── Differential Diagnoses picker ──
    {
      target: 'writenote-ddx',
      text: 'Differentials — pick from the suggested list for this algorithm or add your own. Captures what else you considered, then ruled out.',
      placement: 'bottom',
      beforeStep: 'scroll-to:writenote-ddx',
      delay: 400,
      duration: 6000,
    },
    {
      target: 'writenote-ddx',
      text: 'Tap to open the picker. Suggestions come from the algorithm cards you walked through.',
      placement: 'bottom',
      beforeStep: 'note:open-ddx',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'writenote-ddx',
      text: 'Selected differentials roll up into the note. Tap done to commit.',
      placement: 'bottom',
      beforeStep: 'note:select-ddx-demo',
      delay: 400,
      duration: 5000,
      afterStep: 'note:close-ddx',
    },
    {
      target: 'writenote-plan',
      text: 'The Plan (P) — what\'s your treatment: medications, instructions, and follow-up. You can make order sets in your settings and apply common bundles in one tap.',
      placement: 'bottom',
      beforeStep: 'scroll-to:writenote-plan',
      delay: 400,
      duration: 6000,
    },
    {
      target: 'writenote-plan',
      text: 'We applied a custom URI order set — Cepacol lozenges, Mucinex, hydration instructions, 10-14 day follow-up, emergency precautions.',
      placement: 'bottom',
      beforeStep: 'inject:note-plan',
      delay: 200,
      duration: 5000,
    },
    {
      target: 'writenote-preview',
      text: 'Full note in SOAP format.',
      placement: 'bottom',
      beforeStep: 'click:writenote-next',
      delay: 400,
      duration: 6000,
    },
    {
      target: 'writenote-preview',
      text: 'Copy the note as plaintext; pastes with formatting.',
      placement: 'bottom',
      duration: 5000,
    },
    // ── Log to calendar (note → calendar bridge) ──
    {
      target: 'writenote-log-calendar',
      text: 'Log this encounter to the calendar — drops a timestamped entry on your day so the visit is tracked. No PHI is logged, just that an encounter occurred.',
      placement: 'bottom',
      duration: 6000,
    },
    // ── SF600 PDF export ──
    {
      target: 'writenote-export-sf600',
      text: 'Export the note as an SF600 PDF — the standard chronological record form. Useful when a printed copy needs to land in someone\'s record.',
      placement: 'bottom',
      duration: 6000,
    },
    {
      target: 'writenote-encoded',
      text: 'The encoded note compresses everything into a scannable barcode. A provider can import it instantly.',
      placement: 'top',
      duration: 6000,
    },
    {
      target: 'writenote-encoded',
      text: 'Share as a barcode image, or copy the encoded text',
      placement: 'top',
      duration: 5000,
    },
    // ── DD689 export ──
    {
      target: 'writenote-export-dd689',
      text: 'Export a DD689 sick slip alongside the encoded note — what the soldier carries when they go to a higher level of care.',
      placement: 'top',
      duration: 6000,
      pausePoint: true,
      afterStep: 'restore:note-sections',
    },
    {
      target: 'import-note-preview',
      text: "Here's the imported note — decoded from the barcode",
      placement: 'bottom',
      beforeStep: 'open:import-demo',
      delay: 600,
      duration: 6000,
    },
    {
      target: 'import-encoded-section',
      text: 'Keep in mind our servers don\'t save your notes or PII/PHI. You are ultimately responsible for any handling of sensitive information that gets generated',
      placement: 'bottom',
      duration: 5000,
      pausePoint: true,
      afterStep: 'return:guided-tours',
    },
  ],
}

const textExpanderTour: TourDefinition = {
  id: 'text-expanders',
  name: 'Text Expanders',
  tier: 'medic',
  category: 'customization',
  description: 'Build a reusable shortcut from scratch — fields, selections, and static text.',
  steps: [
    {
      target: 'settings-note-content',
      text: 'Text expanders live inside Note Content settings.',
      placement: 'bottom',
      beforeStep: 'open:settings',
      delay: 400,
    },
    {
      target: 'note-content-expanders',
      text: 'Expanders are shortcuts that expand abbreviations into full text. Tap here to manage them.',
      placement: 'bottom',
      beforeStep: 'navigate:settings:note-content',
      delay: 350,
      duration: 5000,
    },
    {
      target: 'expander-fab',
      text: "Tap the New Template button (top-right of the list) to open the editor for our shortcut 'ABCCD'.",
      placement: 'bottom',
      beforeStep: 'expander:demo:open-and-type',
      delay: 600,
      duration: 5000,
    },
    {
      target: 'expander-edit-card',
      text: 'A template mixes static text with fill-in fields (a variable or a selection menu). Fields become inputs when the shortcut expands.',
      placement: 'bottom',
      beforeStep: 'expander:demo:submit',
      delay: 500,
      duration: 5000,
    },
    {
      target: 'expander-insert-field',
      text: "Tap the [ ] button to add a field. We'll make a 'Variable' type, name it 'age', then tap confirm.",
      placement: 'top',
      duration: 5000,
    },
    {
      target: 'expander-edit-card',
      text: '[age] inserted. When ABCCD expands, the user will be prompted to type a value here.',
      placement: 'bottom',
      beforeStep: 'expander:demo:build-age',
      delay: 300,
      duration: 5000,
    },
    {
      target: 'expander-edit-card',
      text: "'y/o ad' typed, then [gender: m | f] — a selection with two options.",
      placement: 'bottom',
      beforeStep: 'expander:demo:build-gender',
      delay: 300,
      duration: 5000,
    },
    {
      target: 'expander-edit-card',
      text: 'Template complete',
      placement: 'bottom',
      beforeStep: 'expander:demo:build-complete',
      delay: 300,
      pausePoint: true,
    },
    {
      target: 'expander-edit-accept',
      text: 'Tap check to stage the shortcut.',
      placement: 'top',
      duration: 5000,
    },
    {
      target: 'expander-list',
      text: "ABCCD is staged. The final save button in the header will commit it to your shortcuts — type 'ABCCD' in any note field to use your shortcut.",
      placement: 'bottom',
      beforeStep: 'expander:demo:accept',
      delay: 400,
      pausePoint: true,
      afterStep: 'expander:demo:finish',
    },
  ],
}

const plansOrderSetsTour: TourDefinition = {
  id: 'plans-order-sets',
  name: 'Plans & Order Sets',
  tier: 'medic',
  category: 'customization',
  description: 'Build plan tags and compose a reusable order set from scratch.',
  steps: [
    {
      target: 'plan-settings-panel',
      text: 'The Plan panel manages your order tags and order sets — building blocks for treatment plans in your notes.',
      placement: 'bottom',
      beforeStep: 'planorderset:setup',
      delay: 600,
      duration: 5000,
    },
    {
      target: 'plan-tag-input',
      text: 'Edit mode is on. Add tags under any category — medications, instructions, follow-up, referrals, labs, or radiology.',
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'plan-tag-meds',
      text: 'Tylenol 325mg tab staged under Medications.',
      placement: 'bottom',
      beforeStep: 'planorderset:add-med-1',
      delay: 400,
      duration: 4000,
    },
    {
      target: 'plan-tag-meds',
      text: 'Mucinex 500mg tab added. Both medications staged with dashed borders — not saved yet.',
      placement: 'bottom',
      beforeStep: 'planorderset:add-med-2',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'plan-tag-instructions',
      text: 'Patient instructions staged — hand hygiene, hydration, and rest.',
      placement: 'bottom',
      beforeStep: 'planorderset:add-instruction',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'plan-tag-followUp',
      text: 'Follow-up instructions staged — 10-14 days, sooner if worsening.',
      placement: 'bottom',
      beforeStep: 'planorderset:add-followup',
      delay: 400,
      duration: 5000,
      pausePoint: true,
    },
    {
      target: 'plan-orderset-section',
      text: "Now we'll bundle these into a reusable order set. 'URI Basic' entered — confirm starts composition mode.",
      placement: 'bottom',
      beforeStep: 'planorderset:start-compose',
      delay: 500,
      duration: 6000,
    },
    {
      target: 'plan-tag-section',
      text: 'In composition mode, tags become selectable. All four selected — they highlight in blue.',
      placement: 'bottom',
      beforeStep: 'planorderset:select-tags',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'plan-orderset-footer',
      text: 'The compose footer shows your order set name and selected tag count. Tap the checkmark to stage.',
      placement: 'top',
      pausePoint: true,
    },
    {
      target: 'plan-orderset-staged',
      text: "URI Basic is staged. Save in the header to commit tags and order sets together. We'll cancel to discard the demo.",
      placement: 'bottom',
      beforeStep: 'planorderset:save-compose',
      delay: 400,
      pausePoint: true,
      afterStep: 'planorderset:cleanup',
    },
  ],
}

const tc3Tour: TourDefinition = {
  id: 'tc3',
  name: 'TC3 Casualty Card',
  tier: 'medic',
  category: 'getting-started',
  description: 'Digital DD Form 1380 — casualty tracking, MARCH interventions, and export.',
  steps: [
    {
      target: 'sidenav-tc3',
      text: 'TC3 is your digital DD Form 1380 — a field casualty card that works fully offline.',
      placement: 'bottom',
      beforeStep: 'open:sidenav',
      delay: 350,
      pausePoint: true,
    },
    {
      target: 'tc3-casualty-info',
      text: 'Start with casualty identity and EVAC priority — Urgent (U), Priority (P), or Routine (R).',
      placement: 'bottom',
      beforeStep: 'open:tc3',
      delay: 500,
      duration: 5000,
    },
    {
      target: 'tc3-body-diagram',
      text: 'Tap the body diagram to place markers — pinpoint injuries and treatment locations.',
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'tc3-vitals',
      text: 'Log serial vitals with AVPU and GCS. Each set is time-stamped for tracking trends.',
      placement: 'bottom',
      duration: 5000,
    },
    // Desktop: MARCH column is always visible
    {
      target: 'tc3-march',
      text: 'MARCH interventions — tourniquets, airway, IV access, medications, and fluid resuscitation.',
      placement: 'bottom',
      duration: 5000,
      desktopOnly: true,
    },
    // Mobile: advance to page 2 before showing MARCH
    {
      target: 'tc3-march',
      text: 'MARCH interventions — tourniquets, airway, IV access, medications, and fluid resuscitation.',
      placement: 'bottom',
      beforeStep: 'tc3:advance-page',
      delay: 400,
      duration: 5000,
      mobileOnly: true,
    },
    {
      target: 'tc3-notes',
      text: 'Add handoff notes — free text with your text expanders for quick documentation.',
      placement: 'top',
      pausePoint: true,
      afterStep: 'tc3:cleanup',
    },
  ],
}

const knowledgeBaseTour: TourDefinition = {
  id: 'knowledge-base',
  name: 'Knowledge Base',
  tier: 'medic',
  category: 'reference-network',
  description: 'Medications, STP tasks, screeners, calculators, and burn assessment.',
  steps: [
    {
      target: 'kb-category-grid',
      text: 'These are your reference categories — medications, STP tasks, screeners, and calculators.',
      placement: 'bottom',
      beforeStep: 'open:knowledgebase',
      delay: 400,
    },
    {
      target: 'kb-search',
      text: 'Search across all categories from here.',
      placement: 'bottom',
    },
    {
      target: 'kb-medications',
      text: 'Browse all medications listed in ADTMC with dosing, routes, and field notes.',
      placement: 'bottom',
    },
    {
      target: 'kb-stp',
      text: 'STP 68W training tasks — step-by-step instructions.',
      placement: 'bottom',
    },
    {
      target: 'kb-screener',
      text: 'Behavioral health screeners — GAD-7, PHQ-2, MACE-2, AUDIT-C. Auto-scored.',
      placement: 'bottom',
    },
    {
      target: 'kb-vitals',
      text: 'Vital signs calculator for quick field reference including unit conversion and BMI.',
      placement: 'bottom',
    },
    {
      target: 'kb-burn',
      text: 'Burn assessment calculator — tap body regions to calculate TBSA using the Rule of Nines, then enter weight to get Parkland formula fluid resuscitation rates.',
      placement: 'bottom',
    },
    {
      target: 'kb-pinned',
      text: 'Pin categories, medications, or training tasks for quick access. Pinned items stay at the top of your Knowledge Base.',
      placement: 'bottom',
      beforeStep: 'pin:burn',
      delay: 300,
    },
    {
      target: 'kb-category-grid',
      text: 'That\'s your Knowledge Base — medications, training, screeners, calculators, and burn assessment all in one place.',
      placement: 'bottom',
      beforeStep: 'unpin:burn',
      delay: 300,
      afterStep: 'return:guided-tours',
    },
  ],
}

const messagingTour: TourDefinition = {
  id: 'messaging',
  name: 'Messaging',
  tier: 'medic',
  category: 'reference-network',
  description: 'Self-notes, encrypted conversations, threaded replies, and message management.',
  steps: [
    {
      target: 'messages-self-notes',
      text: 'Your personal notes — private, encrypted, always available.',
      placement: 'bottom',
      beforeStep: 'open:messages',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'messages-roster',
      text: 'Everyone assigned to your group and nearby medical assets can be available for encrypted messaging.',
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'messages-input',
      text: 'Standard messaging, images, voice notes. Only the sender and recipient can read through the encryption keys.',
      placement: 'top',
      beforeStep: 'messaging:open-self-chat',
      delay: 600,
      duration: 5000,
    },
    {
      target: 'messages-latest-bubble',
      text: 'Messages sync across all your devices. Intentionally logging-out of a device will destroy the device\'s copy of the message.',
      placement: 'left',
      beforeStep: 'messaging:send-note',
      delay: 1000,
      duration: 5000,
    },
    {
      target: 'messages-thread-badge',
      text: 'We support threaded messages to keep your workspace clean. The badge shows the reply count — tap to view the thread.',
      placement: 'left',
      beforeStep: 'messaging:send-reply',
      delay: 1000,
      duration: 5000,
    },
    {
      target: 'messages-thread-overlay',
      text: 'Thread view — all replies grouped under the original message.',
      placement: 'bottom',
      beforeStep: 'messaging:open-thread',
      delay: 400,
      pausePoint: true,
      afterStep: 'messaging:cleanup',
    },
  ],
}

const calendarTour: TourDefinition = {
  id: 'calendar',
  name: 'Calendar',
  tier: 'medic',
  category: 'reference-network',
  description: 'Events, views, personnel filters, and troops-to-task.',
  steps: [
    // ── Setup: inject mock event, open calendar, land on month view ──
    {
      target: 'calendar-month-grid',
      text: 'Month view — your unit schedule at a glance. We added a training event for today.',
      placement: 'bottom',
      beforeStep: 'calendar:setup',
      delay: 600,
      duration: 5000,
    },
    {
      target: 'calendar-view-switcher',
      text: 'Switch between Month, Day, Troops to Task, and Huddle here.',
      placement: 'top',
      duration: 4000,
    },
    // ── Day view ──
    {
      target: 'calendar-day-view',
      text: 'Day view — hour-by-hour timeline. Drag events to reschedule on a 15-minute grid.',
      placement: 'bottom',
      beforeStep: 'calendar:view:day',
      delay: 400,
      duration: 5000,
    },
    // ── Troops to Task ──
    {
      target: 'calendar-troops-view',
      text: 'Troops to Task — each row is a medic, events plotted across a 24-hour timeline.',
      placement: 'bottom',
      beforeStep: 'calendar:view:troops',
      delay: 400,
      duration: 5000,
    },
    // ── Huddle band (inline above medic timeline rows) ──
    {
      target: 'calendar-huddle-band',
      text: 'Huddle band — provider/medic pairings sit above the medic rows, anchored to each day. Pan horizontally to see other days; manage rooms in clinic settings.',
      placement: 'bottom',
      beforeStep: 'calendar:view:troops',
      delay: 400,
      duration: 6000,
    },
    // ── Filter: desktop sidebar ──
    {
      target: 'calendar-desktop-sidebar',
      text: 'Desktop sidebar — mini calendar, personnel filter, and roster. Filter events by who\'s assigned.',
      placement: 'right',
      beforeStep: 'calendar:view:month',
      delay: 400,
      duration: 5000,
      desktopOnly: true,
    },
    // ── Filter: mobile ──
    {
      target: 'calendar-mobile-filter',
      text: 'Tap the filter to open personnel controls.',
      placement: 'bottom',
      beforeStep: 'calendar:view:month',
      delay: 400,
      duration: 4000,
      mobileOnly: true,
    },
    {
      target: 'calendar-controls-drawer',
      text: 'Filter by personnel — only their events show on the calendar.',
      placement: 'top',
      beforeStep: 'calendar:open-controls',
      delay: 500,
      duration: 5000,
      mobileOnly: true,
    },
    {
      target: 'calendar-personnel-filter',
      text: 'Toggle personnel to scope the view. All Personnel resets the filter.',
      placement: 'top',
      duration: 5000,
      pausePoint: true,
      afterStep: 'calendar:close-controls',
      mobileOnly: true,
    },
    {
      target: 'calendar-personnel-filter',
      text: 'Toggle personnel to scope the view. All Personnel resets the filter.',
      placement: 'right',
      duration: 5000,
      pausePoint: true,
      desktopOnly: true,
    },
    // ── Event form ──
    {
      target: 'event-form-title',
      text: 'New event form — give it a title and pick a category: Training, Duty, Range, Appointment, Mission, MEDEVAC, or Huddle.',
      placement: 'bottom',
      beforeStep: 'calendar:open-event-form',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'event-form-datetime',
      text: 'Set start and end date/time. Toggle All Day for full-day events — times collapse automatically.',
      placement: 'top',
      duration: 5000,
    },
    // ── Room picker ──
    {
      target: 'event-form-room',
      text: 'Tag a clinic room so the event shows on that room\'s schedule. Rooms are managed in clinic settings.',
      placement: 'top',
      duration: 5000,
    },
    // ── Huddle category → huddle task picker ──
    {
      target: 'event-form-category',
      text: 'Pick the Huddle category to assign someone to a huddle station — like Front Desk or an on-shift provider block.',
      placement: 'bottom',
      beforeStep: 'calendar:select-huddle-category',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'event-form-huddle-task',
      text: 'Leave blank for a generic provider block, or pick a station task to assign someone there for that window.',
      placement: 'top',
      duration: 5000,
      pausePoint: true,
      afterStep: 'calendar:cleanup',
    },
    // ── Export / Import ──
    {
      target: 'calendar-export-import',
      text: 'Export your calendar to share with another medic, or import one from a teammate. Useful for offline handoffs and pre-op planning.',
      placement: 'bottom',
      beforeStep: 'calendar:open-export-import',
      delay: 400,
      duration: 5000,
      pausePoint: true,
      afterStep: 'calendar:cleanup',
    },
  ],
}

const settingsTour: TourDefinition = {
  id: 'settings',
  name: 'Settings & Preferences',
  tier: 'medic',
  category: 'customization',
  description: 'Profile, security, notifications, and where to find tours.',
  steps: [
    {
      target: 'settings-profile',
      text: 'Your profile card — tap to share your comms card, or view and edit your information.',
      placement: 'bottom',
      beforeStep: 'open:settings',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'settings-theme',
      text: 'Appearance — six named themes, each with a light and dark variant. Tap to browse.',
      placement: 'bottom',
      duration: 4000,
      afterStep: 'navigate:settings:theme-picker',
    },
    {
      target: 'theme-picker-grid',
      text: 'Each card previews your actual app colors. Select a light or dark toggle to switch themes without leaving the gallery.',
      placement: 'bottom',
      duration: 5000,
      delay: 400,
      afterStep: 'navigate:settings:back',
    },
    {
      target: 'settings-pin',
      text: 'Set a log-in PIN, biometric authentication, log in with a QR, or edit your current devices.',
      placement: 'bottom',
      pausePoint: true,
    },
    {
      target: 'settings-notifications',
      text: 'Enable push notifications for messages.',
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'settings-release-notes',
      text: "Release notes — a running log of what's new in each version, and an update check to make sure you're running the most current software.",
      placement: 'bottom',
      duration: 4000,
    },
    {
      target: 'settings-feedback',
      text: 'Report bugs, suggest features, or ask the developer team questions.',
      placement: 'bottom',
      duration: 4000,
    },
    {
      target: 'settings-privacy',
      text: 'Our data handling policy — how your information is stored, synced, and protected.',
      placement: 'bottom',
      duration: 4000,
    },
    // Mobile: guided tours item is further below fold — tooltip on top keeps it visible above the spotlight
    {
      target: 'settings-guided-tours',
      text: 'All interactive walkthroughs live here — replay any tour or pick up where you left off.',
      placement: 'top',
      pausePoint: true,
      afterStep: 'return:guided-tours',
      mobileOnly: true,
    },
    // Desktop: more vertical room — tooltip below the item
    {
      target: 'settings-guided-tours',
      text: 'All interactive walkthroughs live here — replay any tour or pick up where you left off.',
      placement: 'bottom',
      pausePoint: true,
      afterStep: 'return:guided-tours',
      desktopOnly: true,
    },
  ],
}

const missionOverviewTour: TourDefinition = {
  id: 'mission-overview',
  name: 'Mission Overview',
  tier: 'medic',
  category: 'getting-started',
  description: 'Your home screen dashboard — widgets, visibility, and customization.',
  steps: [
    {
      target: 'settings-mission-overview',
      text: 'Mission Overview is your home screen dashboard — a quick view of your daily schedule, messages, and map.',
      placement: 'bottom',
      beforeStep: 'open:settings',
      delay: 400,
      duration: 5000,
    },
    {
      target: 'mission-overview-toggle',
      text: 'Toggle to show or hide the overview panel on your home screen.',
      placement: 'bottom',
      beforeStep: 'navigate:settings:overview-widgets',
      delay: 350,
      duration: 4000,
    },
    {
      target: 'mission-overview-widget-list',
      text: 'Choose up to 3 widgets. Gantt shows your day timeline, Messages surfaces recent conversations, Map shows your mission area.',
      placement: 'bottom',
      duration: 5000,
      pausePoint: true,
      afterStep: 'return:guided-tours',
    },
  ],
}

// ─── Tier 2: Supervisor Tours ────────────────────────────────────────────────

const supervisorTour: TourDefinition = {
  id: 'supervisor-panel',
  name: 'Supervisor Panel',
  tier: 'supervisor',
  category: 'advanced',
  description: 'Clinic stats, soldier readiness, coverage gaps, and task evaluation.',
  steps: [
    // ── Overview: clinic stats card ──
    {
      target: 'supervisor-clinic-stats',
      text: 'Clinic overview — team readiness and cert compliance at a glance. These aggregate across all assigned personnel.',
      placement: 'bottom',
      beforeStep: 'open:supervisor',
      delay: 400,
      duration: 5000,
    },
    // ── Soldier Readiness section ──
    {
      target: 'supervisor-soldier-readiness',
      text: 'Soldier readiness — each medic sorted by readiness percentage. Overdue certs and failed evaluations are flagged.',
      placement: 'bottom',
      duration: 5000,
    },
    // ── Highlight first soldier ──
    {
      target: 'supervisor-first-soldier',
      text: 'Tap any soldier to drill into their profile, certifications, and training history.',
      placement: 'bottom',
      pausePoint: true,
    },
    // ── Coverage Gaps section ──
    {
      target: 'supervisor-coverage-gaps',
      text: 'Coverage gaps by STP subject area. Low percentages mean your team has training deficiencies in that category.',
      placement: 'top',
      duration: 5000,
    },
    // ── Drill into a category ──
    {
      target: 'supervisor-first-area',
      text: 'Tap a category to see which tasks your team needs evaluated — and who needs work.',
      placement: 'bottom',
      pausePoint: true,
    },
    // ── Task list (after navigating into a coverage area) ──
    {
      target: 'supervisor-task-list',
      text: 'Tasks in this area. Select a task to see which soldiers are deficient, then evaluate or assign it directly. From a soldier profile you can evaluate with GO/NO-GO grading, or assign a task with a due date.',
      placement: 'bottom',
      beforeStep: 'supervisor:open-first-area',
      delay: 500,
      pausePoint: true,
      afterStep: 'supervisor:cleanup',
    },
  ],
}

const clinicManagementTour: TourDefinition = {
  id: 'clinic-management',
  name: 'Clinic Management',
  tier: 'supervisor',
  category: 'advanced',
  description: 'Edit clinic details, manage associations, rooms, huddle tasks, and personnel.',
  steps: [
    // ── Navigate to Settings → Clinic ──
    {
      target: 'clinic-identity-card',
      text: 'Your clinic identity — name, location, UICs, and invite code. The QR code lets nearby clinics request association.',
      placement: 'bottom',
      beforeStep: 'clinic:open',
      delay: 600,
      duration: 5500,
    },
    // ── Tap-to-edit hint on identity card ──
    {
      target: 'clinic-identity-card',
      text: 'Tap the card to edit name, location, and UICs. Each section below has its own "+" button — every change saves immediately, no batch save.',
      placement: 'bottom',
      duration: 6000,
    },
    // ── Associated Clinics section ──
    {
      target: 'clinic-associated',
      text: 'Associated clinics share personnel visibility across nearby teams. Tap "+" to scan a QR code, upload an image, or type an 8-character invite code.',
      placement: 'bottom',
      duration: 6000,
    },
    // ── Rooms section ──
    {
      target: 'clinic-rooms',
      text: 'Rooms are the physical spaces in your clinic — exam rooms, triage bays, the SCA. They tag calendar events and notes so the team knows where care happens. Tap "+" to add one.',
      placement: 'top',
      duration: 7000,
    },
    // ── Huddle Tasks section ──
    {
      target: 'clinic-huddle-tasks',
      text: 'Huddle tasks are the recurring stations on your daily shift — sick call, immunizations, walk-ins. They appear as rows in the calendar\'s huddle band so you can drag medics onto each station every morning. Tap "+" to add one.',
      placement: 'top',
      duration: 8000,
    },
    // ── Personnel section ──
    {
      target: 'clinic-personnel',
      text: 'Your assigned personnel. Tap a member to edit their rank and roles (medic / supervisor / provider) or remove them from the clinic.',
      placement: 'top',
      duration: 6000,
    },
    // ── Add member overlay ──
    {
      target: 'clinic-add-member',
      text: 'Tap "+" to add a member. Enter their email — if an account exists, they\'re added immediately. If not, the panel falls through to a create-user form so you can onboard them in one step.',
      placement: 'top',
      pausePoint: true,
      afterStep: 'clinic:cleanup',
    },
  ],
}

// ─── Tier 3: Provider Tours ──────────────────────────────────────────────────

const providerTour: TourDefinition = {
  id: 'provider-notes',
  name: 'Provider Notes',
  tier: 'provider',
  category: 'advanced',
  description: 'Quick note templates and clinical documentation — import, template apply, export.',
  steps: [
    {
      target: 'settings-provider-templates',
      text: 'Note templates live here. Each one pre-fills SOAP sections using your text shortcuts and order sets.',
      placement: 'bottom',
      beforeStep: 'provider:setup',
      delay: 600,
    },
    {
      target: 'provider-demo-template',
      text: 'A demo template — URI encounter with PE exam blocks, assessment, and plan.',
      placement: 'bottom',
      pausePoint: true,
    },
    {
      target: 'provider-medic-context',
      text: 'Medic notes arrive as encoded barcodes. This one decoded — the field assessment shows inline.',
      placement: 'bottom',
      beforeStep: 'provider:open-and-import',
      delay: 800,
    },
    {
      target: 'provider-hpi',
      text: 'History of Present Illness — write freehand, use text shortcuts, or reference the medic note above.',
      placement: 'bottom',
    },
    {
      target: 'provider-template-apply',
      text: 'Apply a saved template to pre-fill all empty sections at once.',
      placement: 'right',
      desktopOnly: true,
    },
    {
      target: 'provider-pe',
      text: 'Physical Exam — normal/abnormal toggles for each system, pre-filled by the template.',
      placement: 'top',
      beforeStep: 'provider:apply-template',
      delay: 400,
    },
    {
      target: 'provider-assessment',
      text: 'Assessment — clinical impression and diagnosis, filled from the template.',
      placement: 'top',
    },
    {
      target: 'provider-plan',
      text: 'Plan — select order sets or individual blocks for medications, instructions, and follow-up.',
      placement: 'top',
    },
    {
      target: 'provider-output',
      text: 'Generate the final formatted note — barcode, SF600 export, share, or copy.',
      placement: 'top',
      beforeStep: 'provider:go-to-output',
      delay: 400,
      pausePoint: true,
      afterStep: 'provider:cleanup',
    },
  ],
}

const propertyTour: TourDefinition = {
  id: 'property-book',
  name: 'Property Book',
  tier: 'medic',
  category: 'reference-network',
  description: 'Track clinic equipment, supplies, and serialized gear by location.',
  steps: [
    {
      target: 'sidenav-property',
      text: 'Property Book tracks your clinic\'s equipment — serialized gear, medications, and consumables.',
      placement: 'bottom',
      beforeStep: 'open:sidenav',
      delay: 350,
      pausePoint: true,
    },
    {
      target: 'property-locations',
      text: 'Inventory is organized by location. Tap a location to drill in and see its items.',
      placement: 'bottom',
      beforeStep: 'open:property',
      delay: 300,
      duration: 5000,
    },
    {
      target: 'property-view-toggle',
      text: 'Switch between list, barcode scanner, and map view. The scanner lets you expend consumables by scanning their barcode.',
      placement: 'top',
      duration: 5000,
    },
    {
      target: 'property-add-fab',
      text: 'Add items or create locations. Each item tracks NSN, serial number, quantity, and expiration date.',
      placement: 'top',
      pausePoint: true,
      afterStep: 'property:cleanup',
    },
  ],
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const allTours: TourDefinition[] = [
  // Tier 1: Medic
  gettingStarted,
  algorithmNavTour,
  noteLifecycleTour,
  textExpanderTour,
  plansOrderSetsTour,
  tc3Tour,
  knowledgeBaseTour,
  messagingTour,
  calendarTour,
  propertyTour,
  missionOverviewTour,
  settingsTour,
  // Tier 2: Supervisor
  supervisorTour,
  clinicManagementTour,
  // Tier 3: Provider
  providerTour,
]

export const DEFAULT_STEP_DURATION = 4000
