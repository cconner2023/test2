/**
 * Guided Tour Data Set
 *
 * Pre-defined data for the interactive guided tour. This data drives a scripted
 * walkthrough of the clinical algorithm (A-1 Sore Throat) and note-writing flow.
 * It is included in the build so users always have access to the tour.
 */

import type { TextExpander } from './User'
import type { TemplateNode } from './TemplateTypes'
import type { PlanOrderSet } from './User'
import { compressText } from '../Utilities/textCodec'

// ─── Calendar Tour Demo ─────────────────────────────────────────────────────

/** Stable ID prefix so the tour can find and clean up its mock event */
export const CALENDAR_TOUR_EVENT_PREFIX = 'tour_cal_'

/**
 * Build a mock all-day CalendarEvent for today, assigned to the current user.
 * The event is local-only (no Signal broadcast) and deleted at tour cleanup.
 */
export function createCalendarTourEvent(clinicId: string, userId: string): import('../Types/CalendarTypes').CalendarEvent {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const now = today.toISOString()

  return {
    id: `${CALENDAR_TOUR_EVENT_PREFIX}${Date.now()}`,
    clinic_id: clinicId,
    title: 'Table XII Support',
    description: 'Guided tour demo event.',
    category: 'training',
    status: 'pending',
    start_time: `${dateKey}T00:00`,
    end_time: `${dateKey}T23:59`,
    all_day: true,
    location: null,
    opord_notes: null,
    uniform: null,
    report_time: null,
    assigned_to: [userId],
    property_item_ids: [],
    created_by: userId,
    created_at: now,
    updated_at: now,
  }
}

// ─── Messaging Tour Demo ─────────────────────────────────────────────────────

export const MESSAGING_TOUR_NOTE = 'Test note from the guided tour — delete anytime.'
export const MESSAGING_TOUR_REPLY = 'Threaded reply. Threads keep related notes organized.'

// ─── Algorithm Path ──────────────────────────────────────────────────────────
// A-1 (Sore Throat/Hoarseness) — "No" chain to CAT III self-care

export const GUIDED_ALGORITHM = {
  /** Category ID in catData */
  categoryId: 1,
  /** Subcategory code (symptom icon) */
  symptomCode: 'A-1',
  /** Category name for display */
  categoryName: 'Ear, Nose, Throat',
  /** Subcategory name for display */
  symptomName: 'Sore Throat/Hoarseness',

  /**
   * Scripted answers — cardIndex → answerIndex.
   * Card 0 (rf): no interaction needed (red flags display only)
   * Card 1 (initial): answer index 1 = "No" (no red flags)
   * Card 2 (choice): answer index 1 = "No" (no complicating factors)
   * Card 3 (count): answer index 1 = "0-2 CENTOR" (no centor criteria met)
   * → Final disposition: CAT III "Treatment Protocol and RTD"
   */
  answers: [
    { cardIndex: 1, answerIndex: 1 },  // "No" to red flags
    { cardIndex: 2, answerIndex: 1 },  // "No" to complicating factors
    { cardIndex: 3, answerIndex: 1 },  // "0-2 CENTOR"
  ],
} as const

// ─── Text Expander ───────────────────────────────────────────────────────────
// HPI template with fill-in fields and choice branches

const hpiTemplate: TemplateNode[] = [
  { type: 'step', label: 'age' },
  { type: 'text', content: ' y/o ad' },
  { type: 'step', label: 'gender' },
  { type: 'text', content: ' c/o ' },
  { type: 'step', label: 'cc' },
  { type: 'text', content: ' x 24 hours. ' },
  { type: 'choice', label: 'travel', options: ['denies recent travel', 'endorses recent travel'] },
  { type: 'text', content: ', ' },
  { type: 'choice', label: 'exposure', options: ['denies sick contacts', 'endorses sick contacts'] },
  { type: 'text', content: '. Denies HA, fever/chills, runny nose, N/V, abdominal pain.' },
]

/** Default fill values for the guided tour demo */
export const GUIDED_HPI_DEFAULTS: Record<string, string> = {
  age: '20',
  gender: 'm',
  cc: 'sore throat and non-productive cough',
  travel: 'denies recent travel',
  exposure: 'denies sick contacts',
}

/** The fully expanded HPI note for the guided demo */
export const GUIDED_HPI_EXPANDED =
  '20 y/o adm c/o sore throat and non-productive cough x 24 hours. ' +
  'denies recent travel, denies sick contacts. ' +
  'Denies HA, fever/chills, runny nose, N/V, abdominal pain.'

export const GUIDED_TEXT_EXPANDER: TextExpander = {
  abbr: 'hpi',
  expansion: '',
  template: hpiTemplate,
}

// ─── Text Expander Tour Demo Build ──────────────────────────────────────────
// Progressive build steps for the interactive text expander tour.
// Each step adds content to the editor so the user sees the template assemble.

export const DEMO_EXPANDER_ABBR = 'ABCCD'

export const DEMO_EXPANDER_BUILDS: Record<string, {
  expansion: string
  fields: Record<string, { type: 'variable' | 'dropdown'; options?: string[] }>
}> = {
  age: {
    expansion: '[age]',
    fields: { age: { type: 'variable' } },
  },
  gender: {
    expansion: '[age] y/o ad[gender]',
    fields: {
      age: { type: 'variable' },
      gender: { type: 'dropdown', options: ['m', 'f'] },
    },
  },
  complete: {
    expansion: '[age] y/o ad[gender] c/o sore throat, HA x 24 hours. Denies sick contacts, Denies recent travel',
    fields: {
      age: { type: 'variable' },
      gender: { type: 'dropdown', options: ['m', 'f'] },
    },
  },
}

// ─── Vital Signs ─────────────────────────────────────────────────────────────

export const GUIDED_VITALS = {
  hr: '67',
  rr: '16',
  bpSys: '128',
  bpDia: '80',
  temp: '98.9',
  height: '67',
  weight: '155',
} as const

export const GUIDED_VITALS_TEXT =
  'VS: HR 67, RR 16, BP 128/80, Temp 98.9°F, Ht 67in, Wt 155lbs'

// ─── Physical Exam ───────────────────────────────────────────────────────────
// Standard A-1 focused exam, abnormals: clear rhinorrhea, pharyngeal erythema

/** PE blocks for the guided tour demo (baseline + category A) */
export const GUIDED_PE_BLOCKS = [
  'gen',           // General
  'head',          // Head
  'nose',          // Nose
  'oral_throat',   // Oral/Throat
  'neck',          // Neck
] as const

/**
 * Abnormal selections — maps blockKey:findingKey to abnormal option keys.
 * Everything not listed here is normal.
 */
export const GUIDED_PE_ABNORMALS: Record<string, string[]> = {
  // Nose block: clear rhinorrhea
  'nose:noNasalDischarge': ['clearRhinorrhea'],
  // Oral/Throat block: pharyngeal erythema
  'oral_throat:noErythemaPharynx': ['pharyngealErythema'],
}

export const GUIDED_PE_TEXT =
  'GENERAL: Appears stated age, WNWD, No acute distress\n' +
  'HEAD: NCAT\n' +
  'NOSE: No nasal discharge. Clear rhinorrhea\n' +
  'ORAL/THROAT: No erythema. Pharyngeal erythema\n' +
  'NECK: Supple, Non-tender, No lymphadenopathy'

// ─── Plan ────────────────────────────────────────────────────────────────────
// Custom order set for URI

export const GUIDED_PLAN_ORDER_SET: PlanOrderSet = {
  id: 'os-guided-uri',
  name: 'URI',
  presets: {
    meds: ['Cepacol lozenge', 'Mucinex 500mg tab'],
    instructions: ['Adequate hydration and hand hygiene discussed'],
    followUp: ['F/U in 10-14 days if persists; sooner if worsens or changes significantly'],
  },
}

export const GUIDED_PLAN_TEXT =
  'Medications: Cepacol lozenge, Mucinex 500mg tab. ' +
  'Instructions: Adequate hydration and hand hygiene discussed. ' +
  'Follow-up: F/U in 10-14 days if persists; sooner if worsens or changes significantly.'

// ─── Assessment ──────────────────────────────────────────────────────────────

export const GUIDED_ASSESSMENT = 'Acute pharyngitis, viral etiology most likely. 0/4 Centor criteria.'

// ─── Anonymous User for Demo Import ──────────────────────────────────────────

export const GUIDED_ANONYMOUS_USER = {
  firstName: 'Jane',
  lastName: 'Doe',
  middleInitial: '',
  rank: 'SPC',
  credential: 'EMT-B' as const,
  component: 'USA' as const,
  uic: '',
}

// ─── Provider Tour Demo Template ─────────────────────────────────────────────

/** Stable ID prefix so the tour can find and clean up its demo template */
export const PROVIDER_TOUR_TEMPLATE_PREFIX = 'tour_provider_'

/** Demo ProviderNoteTemplate injected during the provider tour */
export const GUIDED_PROVIDER_TEMPLATE = {
  id: `${PROVIDER_TOUR_TEMPLATE_PREFIX}demo`,
  name: 'URI Encounter',
  peBlockKeys: [...GUIDED_PE_BLOCKS] as string[],
  assessmentText: GUIDED_ASSESSMENT,
  planText: GUIDED_PLAN_TEXT,
} as const

// ─── Plan & Order Sets Tour Demo ─────────────────────────────────────────────

export const PLAN_TOUR_PREFIX = 'tour_plan_'

export const PLAN_TOUR_TAGS = {
  meds: ['Tylenol 325mg tab', 'Mucinex 500mg tab'],
  instructions: ['Encouraged adequate hand hygiene and hydration, rest.'],
  followUp: ['F/U in 10-14 days if persists; sooner if worsens or changes significantly.'],
} as const

export const PLAN_TOUR_ORDER_SET_NAME = 'URI Basic'

// ─── Encoded Note Generator ──────────────────────────────────────────────────
// Generates a plain (unencrypted) barcode string from the guided tour data.
// Called at tour time so pako compression runs in the browser.

export function generateGuidedBarcode(): string {
  // User indices: ranks[3]=SPC, credentials[0]=EMT-B, components[0]=USA
  const nameStr = `${GUIDED_ANONYMOUS_USER.firstName}|${GUIDED_ANONYMOUS_USER.lastName}|${GUIDED_ANONYMOUS_USER.middleInitial}|${GUIDED_ANONYMOUS_USER.uic}`
  const userEncoded = `3.0.0.${compressText(nameStr)}`

  const parts: string[] = [
    'A-1',       // symptomCode
    'R0',        // no red flags
    '1.0.1',     // card 1: no selections, answer index 1 ("No")
    '2.0.1',     // card 2: no selections, answer index 1 ("No")
    '3.0.1',     // card 3: no selections, answer index 1 ("0-2 CENTOR")
    `H${compressText(GUIDED_HPI_EXPANDED)}`,
    `P${compressText(GUIDED_PE_TEXT)}`,
    `N${compressText(GUIDED_PLAN_TEXT)}`,
    'F31',       // all flags: algorithm(1) + decision(2) + hpi(4) + pe(8) + plan(16)
    `U${userEncoded}`,
  ]
  return parts.join('|')
}
