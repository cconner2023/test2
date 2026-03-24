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

export interface TourDefinition {
  id: string
  name: string
  tier: 'medic' | 'supervisor' | 'provider'
  description: string
  steps: TourStep[]
  /** Scene-based tours render their own mock UI instead of manipulating the live app */
  scene?: string
  /** If true, only visible to dev-role users (tour not yet production-ready) */
  devOnly?: boolean
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
//   'calendar:open-controls'  — open mobile controls drawer
//   'calendar:close-controls' — close mobile controls drawer
//   'calendar:cleanup'        — delete mock event, return to guided tours

// ─── Tier 1: Medic Tours ─────────────────────────────────────────────────────

const gettingStarted: TourDefinition = {
  id: 'getting-started',
  name: 'Getting Started',
  tier: 'medic',
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
      target: 'algorithm-card-1',
      text: "Our patient has none. Answering 'No'.",
      placement: 'bottom',
      beforeStep: 'answer:1:1',
      delay: 1200,
      duration: 4000,
    },
    {
      target: 'algorithm-card-2',
      text: 'Card 2: Complicating factors. Select any that apply.',
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
  description: 'SOAP, preview, encode, and import.',
  steps: [
    {
      target: 'writenote-decision',
      text: 'The note writer opens on Decision Making — treatment guidance from the algorithm tied to the disposition.',
      placement: 'bottom',
      beforeStep: 'setup:writenote-demo',
      delay: 600,
      duration: 6000,
    },
    {
      target: 'writenote-decision',
      text: 'Toggle this on to include the decision-making rationale in your final note.',
      placement: 'bottom',
      duration: 5000,
    },
    {
      target: 'writenote-hpi',
      text: "The History of Present Illness (HPI) is part of Subjective (S) information. This is what the patient TELLS you.",
      placement: 'bottom',
      beforeStep: 'click:writenote-next',
      delay: 400,
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
      text: 'Physical Exam — This is the Objective (O) information. You can choose from structured templates matched to the algorithm in your settings. Normal findings are pre-selected for expedited documentation, and you toggle what you found that was abnormal.',
      placement: 'bottom',
      beforeStep: 'click:writenote-next',
      delay: 400,
      duration: 6000,
    },
    {
      target: 'writenote-pe',
      text: 'Clear rhinorrhea and pharyngeal erythema documented — the two abnormals we found from our hypothetical sore throat exam.',
      placement: 'bottom',
      beforeStep: 'inject:note-pe',
      delay: 200,
      duration: 5000,
    },
    {
      target: 'writenote-plan',
      text: 'The Plan (P) — what\'s yout treatment: medications, instructions, and follow-up. You can make order sets in your settings and apply common bundles in one tap.',
      placement: 'bottom',
      beforeStep: 'click:writenote-next',
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
      target: 'expander-input-bar',
      text: "Edit mode was turned on in the header. Our shortuct name is 'ABCCD' — confirm to open the editor.",
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

const knowledgeBaseTour: TourDefinition = {
  id: 'knowledge-base',
  name: 'Knowledge Base',
  tier: 'medic',
  devOnly: true,
  description: 'Medications, STP tasks, screeners, and calculators.',
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
      afterStep: 'return:guided-tours',
    },
  ],
}

const messagingTour: TourDefinition = {
  id: 'messaging',
  name: 'Messaging',
  tier: 'medic',
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
  devOnly: true,
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
      text: 'Switch between Month, Day, and Troops to Task here.',
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
      text: 'Tap the filter to open date picker and personnel controls.',
      placement: 'bottom',
      beforeStep: 'calendar:view:month',
      delay: 400,
      duration: 4000,
      mobileOnly: true,
    },
    {
      target: 'calendar-controls-drawer',
      text: 'Pick a date and filter by personnel — only their events show on the calendar.',
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
    // ── Add event hint ──
    {
      target: 'calendar-add-event',
      text: 'Create events here — training, duty, range days, appointments, or custom.',
      placement: 'top',
      duration: 4000,
      pausePoint: true,
      afterStep: 'calendar:cleanup',
    },
  ],
}

const settingsTour: TourDefinition = {
  id: 'settings',
  name: 'Settings & Security',
  tier: 'medic',
  devOnly: true,
  description: 'Theme, PIN lock, notifications, and profile.',
  steps: [
    {
      target: 'settings-theme',
      text: 'Switch between light and dark mode.',
      placement: 'bottom',
      beforeStep: 'open:settings',
      delay: 400,
    },
    {
      target: 'settings-pin',
      text: 'Set up a PIN for extra security — the app locks after inactivity.',
      placement: 'bottom',
    },
    {
      target: 'settings-notifications',
      text: 'Configure push notifications for messages and calendar events.',
      placement: 'bottom',
    },
    {
      target: 'settings-note-content',
      text: 'Customize your default note sections and templates.',
      placement: 'bottom',
    },
    {
      target: 'settings-profile',
      text: 'Edit your profile, avatar, rank, and credentials.',
      placement: 'bottom',
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
  devOnly: true,
  description: 'Team roster, readiness, evaluations, and task assignment.',
  steps: [
    {
      target: 'supervisor-roster',
      text: 'Your team roster with readiness percentages and compliance status.',
      placement: 'bottom',
      beforeStep: 'open:supervisor',
      delay: 400,
    },
    {
      target: 'supervisor-soldier',
      text: 'Tap a soldier to view their profile, certs, and training history.',
      placement: 'bottom',
      pausePoint: true,
    },
    {
      target: 'supervisor-readiness',
      text: 'Readiness score — based on completed training tasks and valid certifications.',
      placement: 'bottom',
    },
    {
      target: 'supervisor-evaluate',
      text: 'Evaluate a soldier on an STP task — GO / NO-GO with step-by-step grading.',
      placement: 'bottom',
    },
    {
      target: 'supervisor-assign',
      text: 'Assign a training task with a due date — creates a calendar event automatically.',
      placement: 'bottom',
    },
    {
      target: 'supervisor-certs',
      text: 'Manage a soldier\'s certifications — add, update, or remove.',
      placement: 'bottom',
    },
    {
      target: 'supervisor-coverage',
      text: 'Coverage Tasks — see which STP areas your team needs work on.',
      placement: 'bottom',
      pausePoint: true,
      afterStep: 'return:guided-tours',
    },
  ],
}

// ─── Tier 3: Provider Tours ──────────────────────────────────────────────────

const providerTour: TourDefinition = {
  id: 'provider-notes',
  name: 'Provider Notes',
  tier: 'provider',
  devOnly: true,
  description: 'Clinical documentation — import, SOAP sections, templates, output.',
  steps: [
    {
      target: 'provider-import',
      text: 'Import a medic\'s field note via barcode scan or paste.',
      placement: 'bottom',
      beforeStep: 'open:provider',
      delay: 400,
    },
    {
      target: 'provider-hpi',
      text: 'History of Present Illness — write or expand from the imported medic note.',
      placement: 'bottom',
    },
    {
      target: 'provider-pe',
      text: 'Physical Exam — structured exam with normal/abnormal toggles per system.',
      placement: 'top',
    },
    {
      target: 'provider-assessment',
      text: 'Assessment — your clinical impression and diagnosis.',
      placement: 'top',
    },
    {
      target: 'provider-plan',
      text: 'Plan — orders, follow-up, return-to-duty criteria.',
      placement: 'top',
    },
    {
      target: 'provider-templates',
      text: 'Apply a saved template to pre-fill sections — customize these in Settings.',
      placement: 'bottom',
    },
    {
      target: 'provider-generate',
      text: 'Generate the final formatted note for documentation.',
      placement: 'top',
      pausePoint: true,
      afterStep: 'return:guided-tours',
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
  knowledgeBaseTour,
  messagingTour,
  calendarTour,
  settingsTour,
  // Tier 2: Supervisor
  supervisorTour,
  // Tier 3: Provider
  providerTour,
]

export const DEFAULT_STEP_DURATION = 4000
