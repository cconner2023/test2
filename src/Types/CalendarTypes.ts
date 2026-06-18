export type EventCategory =
  | 'training' | 'duty' | 'range' | 'appointment' | 'mission' | 'medevac' | 'huddle' | 'leave' | 'other' | 'templated'

export type EventStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

import type { LinkedFeatureRef, ResourceAllocation, StructuredLocation } from './MissionTypes'
import type { MedevacRequest } from './MedevacTypes'

export interface CalendarEvent {
  id: string
  clinic_id: string
  title: string
  description: string | null
  category: EventCategory
  /** Per-event color override (swatch id). Absent/null = use the clinic category default. */
  color?: CategorySwatchId | null
  status: EventStatus
  start_time: string
  end_time: string
  all_day: boolean
  location: string | null
  opord_notes: string | null
  uniform: string | null
  report_time: string | null
  assigned_to: string[]
  property_item_ids: string[]
  /** Stable reference to a structural property zone (property_locations.id). Resolved client-side. */
  room_id?: string | null
  /**
   * Stable reference to a supervisor-defined huddle task / station
   * (clinics.huddle_tasks[].id). Only meaningful when category === 'huddle'.
   * Present → event renders in that task's row in the huddle band.
   * Absent → event renders in the providers row (provider on left, paired medic(s) on right).
   */
  huddle_task_id?: string | null
  /** Structured geo-binding — links to a map overlay and optionally a primary waypoint. Drives presence/share. */
  structured_location?: StructuredLocation | null
  /**
   * Free-form N:N links to whole overlays (independent of structured_location).
   * Implies linkage to every feature inside the overlay. See src/lib/eventLinks.ts.
   */
  linked_overlays?: string[] | null
  /**
   * Free-form N:N links to individual features. overlay_id stored alongside so
   * feature resolution does not require scanning every overlay. A feature link
   * does NOT imply the parent overlay is fully linked — surface as "partial".
   */
  linked_features?: LinkedFeatureRef[] | null
  /** Resource allocations — items staged at specific waypoints with roles and responsible personnel. */
  resource_allocations?: ResourceAllocation[] | null
  created_by: string
  created_at: string
  updated_at: string
  /** Origin ID of the latest broadcast message — used for hard-delete on update/delete. */
  originId?: string
  /**
   * Clinics this event is distributed to = {clinic_id} ∪ each assignee's
   * [home, ...active loans]. Computed at send time (useCalendarVault
   * resolveTargetClinics) and stamped on the event so a single source drives
   * cross-cluster fan-out, the clinic-vault snapshot retain filter, and the
   * calendar visibility filter. Absent on legacy events → treated as
   * [clinic_id] (single-clinic, pre-cross-cluster behavior).
   */
  target_clinic_ids?: string[]
  /** Last-known field positions for mission participants — keyed by user_id. Updated via location publisher; rides the normal event edit fan-out. */
  field_positions?: Record<string, FieldPosition> | null
  /** 9-line MEDEVAC request data — present when category is 'medevac' or when a mission event includes a MEDEVAC request. */
  medevac_data?: MedevacRequest | null
  /**
   * Per-event to-do list. Optional. Items are either seeded from a clinic
   * Checklist template (source:'standardized', snapshot-copied on seed — template
   * edits do not retro-mutate) or added ad-hoc (source:'custom'). Editing
   * (add/remove/seed) is gated by isEventEditable; ticking is open to event
   * assignees. The whole list lives in the event envelope and rides the normal
   * event update path (IDB + Signal clinic-vault fanout). No PHI.
   */
  subtasks?: EventSubtask[] | null
  /**
   * Outside event-intake linkage. Present when this event was created via the
   * intake card's Approve action. Persisted for forensic traceability back to
   * event_intake_requests. Rides the Signal vault fanout like any other event field.
   */
  intake_id?: string
  /**
   * Set when this event was auto-logged from a completed clinical algorithm
   * (WriteNote "log to calendar"). Holds the algorithm id so supervisor surfaces
   * can roll up encounters per soldier. Presence of this field marks the event as
   * an encounter record. Operational vocabulary only (algorithm id) — never PHI.
   */
  encounter_algorithm_id?: string | null
}

/** Origin of an event subtask. 'standardized' = seeded from a clinic Checklist template; 'custom' = added ad-hoc on the event. */
export type SubtaskSource = 'standardized' | 'custom'

interface SubtaskCommon {
  id: string
  source: SubtaskSource
  /** Checklist that seeded this item — label/orphan handling only, never retro-mutated. Null/absent for custom items. */
  template_id?: string | null
  /** Append order. Higher = later. */
  sort_order?: number
  done_by?: string | null
  done_at?: string | null
}

/**
 * A single to-do item on a calendar event. Snapshot — once on the event it is
 * independent of any source template. Kinds mirror the clinic Checklist item kinds.
 */
export type EventSubtask =
  | (SubtaskCommon & { kind: 'property_item';     ref: string; label_override?: string | null })
  | (SubtaskCommon & { kind: 'property_location'; ref: string })
  | (SubtaskCommon & { kind: 'task';              label: string })

/** A single user's last-known field position, stored on a CalendarEvent. */
export interface FieldPosition {
  lat: number
  lng: number
  /** MGRS at 1m precision — pre-computed on device to avoid server-side geo logic. */
  mgrs: string
  /** ISO timestamp of the fix. Used to compute staleness on render. */
  timestamp: string
}

export interface EventFormData {
  title: string
  description: string
  category: EventCategory
  /** Per-event color override (swatch id). null = use the clinic category default. */
  color: CategorySwatchId | null
  status: EventStatus
  start_time: string
  end_time: string
  all_day: boolean
  location: string
  uniform: string
  report_time: string
  assigned_to: string[]
  property_item_ids: string[]
  /** Selected property zone id (property_locations.id). Empty string = no zone. */
  room_id?: string | null
  /** Selected huddle task id (clinics.huddle_tasks[].id). Only meaningful when category === 'huddle'. */
  huddle_task_id?: string | null
  /** Overlay link set from the overlay picker — undefined means no overlay selected. */
  structured_location?: StructuredLocation | null
  /** Additional N:N overlay links (form mirror of CalendarEvent.linked_overlays). */
  linked_overlays?: string[] | null
  /** Per-feature N:N links (form mirror of CalendarEvent.linked_features). */
  linked_features?: LinkedFeatureRef[] | null
  /** 9-line MEDEVAC request — populated when category is 'medevac'. */
  medevac_data?: MedevacRequest | null
  /**
   * Target clinic for new events. Optional: only set on the create path when
   * the user has a surrogate (loan) and chose a clinic via the picker. On the
   * edit path we don't carry it (clinic_id is immutable on existing events).
   */
  clinic_id?: string | null
  /** Per-event to-do list (seeded from a Checklist and/or custom items). */
  subtasks?: EventSubtask[] | null
  /** ADTMC algorithm id (e.g. "A-1") when this event is an algorithm encounter/training. */
  encounter_algorithm_id?: string | null
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string; color: string; solidColor: string; hidden?: boolean; devOnly?: boolean }[] = [
  { value: 'training',    label: 'Training',    color: 'bg-themeblue3/20',  solidColor: 'bg-themeblue3' },
  { value: 'duty',        label: 'Duty',        color: 'bg-themeblue3/20',  solidColor: 'bg-themeblue3' },
  { value: 'range',       label: 'Range',       color: 'bg-themeblue3/20',  solidColor: 'bg-themeblue3' },
  { value: 'appointment', label: 'Appointment', color: 'bg-themeblue3/20',  solidColor: 'bg-themeblue3' },
  { value: 'mission',     label: 'Mission',     color: 'bg-tertiary/20',    solidColor: 'bg-tertiary' },
  { value: 'medevac',     label: 'MEDEVAC',     color: 'bg-tertiary/20',    solidColor: 'bg-tertiary' },
  { value: 'huddle',      label: 'Huddle',      color: 'bg-tertiary/20',    solidColor: 'bg-tertiary' },
  { value: 'leave',       label: 'Leave',       color: 'bg-tertiary/15',    solidColor: 'bg-tertiary' },
  { value: 'other',       label: 'Other',       color: 'bg-tertiary/20',    solidColor: 'bg-tertiary' },
  { value: 'templated',   label: 'Templated',   color: 'bg-themeblue3/15',  solidColor: 'bg-themeblue3', hidden: true },
]

export const CATEGORY_BG_MAP: Record<EventCategory, string> = {
  training: 'bg-themeblue3/20 border-themeblue3/30 text-primary',
  duty: 'bg-themeblue3/20 border-themeblue3/30 text-primary',
  range: 'bg-themeblue3/20 border-themeblue3/30 text-primary',
  appointment: 'bg-themeblue3/20 border-themeblue3/30 text-primary',
  mission: 'bg-tertiary/20 border-tertiary/20 text-secondary',
  medevac: 'bg-tertiary/20 border-tertiary/20 text-secondary',
  huddle: 'bg-tertiary/20 border-tertiary/20 text-secondary',
  leave: 'bg-tertiary/10 border-tertiary/20 text-tertiary',
  other: 'bg-tertiary/20 border-tertiary/20 text-secondary',
  templated: 'bg-themeblue3/10 border-themeblue3/25 text-primary',
}

export function getCategoryMeta(category: EventCategory) {
  // Fallback to 'other' so any legacy/unknown category (e.g. retired 'task') renders neutrally.
  return EVENT_CATEGORIES.find(c => c.value === category) ?? EVENT_CATEGORIES.find(c => c.value === 'other')!
}

/**
 * Per-category calendar color palette. One quiet default ('blue') plus four opt-in
 * accents. Tokens are theme CSS-var-backed Tailwind classes (defined in App.css for
 * every theme) so swatches recolor automatically with the active theme. Class strings
 * are written LITERALLY so Tailwind's JIT keeps them. All usage is background-only.
 *
 * Layers resolve a swatch: per-event override (CalendarEvent.color) > clinic
 * category default > 'blue'. See src/Hooks/useCategoryColors.ts (resolver),
 * useClinicCategoryColorsSync (clinic default → store), CategoryColorSettings
 * (supervisor editor), and the per-event picker in EventForm.
 */
export type CategorySwatchId = 'blue' | 'green' | 'amber' | 'red' | 'purple'

export const DEFAULT_SWATCH: CategorySwatchId = 'blue'

export interface CategorySwatch {
  id: CategorySwatchId
  label: string
  /** Tinted dot / soft fill — replaces the legacy `EVENT_CATEGORIES.color`. */
  dot: string
  /** Solid stripe / bar fill — replaces the legacy `EVENT_CATEGORIES.solidColor`. */
  solid: string
  /** Card background (tint + border + safe text) — replaces `CATEGORY_BG_MAP`. */
  bg: string
}

export const CATEGORY_SWATCHES: Record<CategorySwatchId, CategorySwatch> = {
  blue:   { id: 'blue',   label: 'Blue',   dot: 'bg-themeblue3/20',  solid: 'bg-themeblue3',  bg: 'bg-themeblue3/20 border-themeblue3/30 text-primary' },
  green:  { id: 'green',  label: 'Green',  dot: 'bg-themegreen/20',  solid: 'bg-themegreen',  bg: 'bg-themegreen/20 border-themegreen/30 text-primary' },
  amber:  { id: 'amber',  label: 'Amber',  dot: 'bg-themeyellow/20', solid: 'bg-themeyellow', bg: 'bg-themeyellow/20 border-themeyellow/30 text-primary' },
  red:    { id: 'red',    label: 'Red',    dot: 'bg-themered/20',    solid: 'bg-themered',    bg: 'bg-themered/20 border-themered/30 text-primary' },
  purple: { id: 'purple', label: 'Purple', dot: 'bg-themepurple/20', solid: 'bg-themepurple', bg: 'bg-themepurple/20 border-themepurple/30 text-primary' },
}

export const CATEGORY_SWATCH_IDS: CategorySwatchId[] = ['blue', 'green', 'amber', 'red', 'purple']

/** Map of category → clinic/personal-chosen swatch. Partial — absent = fall back. */
export type CategoryColorMap = Partial<Record<EventCategory, CategorySwatchId>>

/**
 * Edit/move gate. Templated events are open to all auth users (medics schedule into slots
 * by editing the title and may reschedule via drag). Delete is gated separately via
 * isTemplateStructureMutable so the underlying template grid stays intact.
 */
export function isEventEditable(_event: Pick<CalendarEvent, 'category'>, _isSupervisor: boolean): boolean {
  return true
}

/** Delete/structural-mutation gate. Templated events are supervisor-only here. */
export function isTemplateStructureMutable(event: Pick<CalendarEvent, 'category'>, isSupervisor: boolean): boolean {
  if (event.category === 'templated') return isSupervisor
  return true
}

/**
 * A templated event is "unscheduled" (an open slot) when its title still matches one of the
 * clinic's appointment-type names. Once a user edits the title (typically to a patient
 * identifier), the slot is considered "scheduled".
 */
export function isUnscheduledTemplate(
  event: Pick<CalendarEvent, 'category' | 'title'>,
  apptTypeNames: readonly string[],
): boolean {
  return event.category === 'templated' && apptTypeNames.includes(event.title)
}

export function createEmptyFormData(forDateKey?: string): EventFormData {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)

  // If a specific date is requested and it differs from today, pin to 08:00–09:00 on that date
  if (forDateKey && forDateKey !== toDateKey(now)) {
    const [y, m, d] = forDateKey.split('-').map(Number)
    start.setFullYear(y, m - 1, d)
    start.setHours(8, 0, 0, 0)
  }

  const end = new Date(start)
  end.setHours(end.getHours() + 1)

  return {
    title: '',
    description: '',
    category: 'other',
    color: null,
    status: 'pending',
    start_time: toLocalISOString(start),
    end_time: toLocalISOString(end),
    all_day: false,
    location: '',
    uniform: '',
    report_time: '',
    assigned_to: [],
    property_item_ids: [],
    room_id: null,
    huddle_task_id: null,
    structured_location: null,
    linked_overlays: null,
    linked_features: null,
    medevac_data: null,
    subtasks: [],
    encounter_algorithm_id: null,
  }
}

export function eventToFormData(event: CalendarEvent): EventFormData {
  return {
    title: event.title,
    description: event.description ?? '',
    category: event.category,
    color: event.color ?? null,
    status: event.status,
    start_time: event.start_time.slice(0, 16),
    end_time: event.end_time.slice(0, 16),
    all_day: event.all_day,
    location: event.location ?? '',
    uniform: event.uniform ?? '',
    report_time: event.report_time ?? '',
    assigned_to: event.assigned_to ?? [],
    property_item_ids: event.property_item_ids ?? [],
    room_id: event.room_id ?? null,
    huddle_task_id: event.huddle_task_id ?? null,
    structured_location: event.structured_location ?? null,
    linked_overlays: event.linked_overlays ?? null,
    linked_features: event.linked_features ?? null,
    medevac_data: event.medevac_data ?? null,
    subtasks: event.subtasks ?? [],
    encounter_algorithm_id: event.encounter_algorithm_id ?? null,
  }
}

export function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "0630" → "06:30" — military to datetime-local time string */
export function militaryToHHMM(mil: string): string {
  return `${mil.slice(0, 2)}:${mil.slice(2)}`
}

/** "06:30" → "0630" — datetime-local time to military display */
export function hhmmToMilitary(hhmm: string): string {
  return hhmm.replace(':', '')
}

/** 30-min military options: "0000", "0030", … "2330" */
export const MILITARY_TIME_OPTIONS: readonly string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}${m}`
})

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Mon, Mar 22" — short weekday + short month + day, en-US. */
export function formatShortDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function eventFallsOnDate(event: CalendarEvent, dateKey: string): boolean {
  const start = event.start_time.slice(0, 10)
  const end = event.end_time.slice(0, 10)
  return dateKey >= start && dateKey <= end
}

export function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const STATUS_META: Record<EventStatus, { opacity: string; pulse: boolean; strikethrough: boolean }> = {
  pending:     { opacity: '',            pulse: false, strikethrough: false },
  in_progress: { opacity: '',            pulse: true,  strikethrough: false },
  completed:   { opacity: 'opacity-50',  pulse: false, strikethrough: true  },
  cancelled:   { opacity: 'opacity-40',  pulse: false, strikethrough: true  },
}

/**
 * Sentinel huddle_task_id reserved for provider-pairing huddle events.
 * Cannot collide with real task ids (those are uuid/random strings).
 */
export const PROVIDER_HUDDLE_TASK_ID = '0'

export const DAY_START_HOUR = 0
export const DAY_END_HOUR = 24
export const HOUR_HEIGHT_PX = 60
