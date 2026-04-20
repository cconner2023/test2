export type EventCategory =
  | 'training' | 'duty' | 'range' | 'appointment' | 'mission' | 'medevac' | 'other'

export type EventStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

import type { ResourceAllocation, StructuredLocation } from './MissionTypes'
import type { MedevacRequest } from './MedevacTypes'

export interface CalendarEvent {
  id: string
  clinic_id: string
  title: string
  description: string | null
  category: EventCategory
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
  /** Structured geo-binding — links to a map overlay and optionally a primary waypoint. */
  structured_location?: StructuredLocation | null
  /** Resource allocations — items staged at specific waypoints with roles and responsible personnel. */
  resource_allocations?: ResourceAllocation[] | null
  created_by: string
  created_at: string
  updated_at: string
  /** Origin ID of the latest broadcast message — used for hard-delete on update/delete. */
  originId?: string
  /** Last-known field positions for mission participants — keyed by user_id. Updated via location publisher; rides the normal event edit fan-out. */
  field_positions?: Record<string, FieldPosition> | null
  /** 9-line MEDEVAC request data — present when category is 'medevac' or when a mission event includes a MEDEVAC request. */
  medevac_data?: MedevacRequest | null
}

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
  start_time: string
  end_time: string
  all_day: boolean
  location: string
  uniform: string
  report_time: string
  assigned_to: string[]
  property_item_ids: string[]
  /** Overlay link set from the overlay picker — undefined means no overlay selected. */
  structured_location?: StructuredLocation | null
  /** 9-line MEDEVAC request — populated when category is 'medevac'. */
  medevac_data?: MedevacRequest | null
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string; color: string }[] = [
  { value: 'training', label: 'Training', color: 'bg-themeyellow/20' },
  { value: 'duty', label: 'Duty', color: 'bg-themeredred/20' },
  { value: 'range', label: 'Range', color: 'bg-themeblue2/20' },
  { value: 'appointment', label: 'Appointment', color: 'bg-themeblue1/20' },
  { value: 'mission', label: 'Mission', color: 'bg-themegreen/20' },
  { value: 'medevac', label: 'MEDEVAC', color: 'bg-themeredred/20' },
  { value: 'other', label: 'Other', color: 'bg-tertiary/50' },
]

export const CATEGORY_BG_MAP: Record<EventCategory, string> = {
  training: 'bg-themeyellow/20 border-themeyellow/30 text-primary',
  duty: 'bg-themeredred/20 border-themeredred/30 text-primary',
  range: 'bg-themeblue2/20 border-themeblue2/30 text-primary',
  appointment: 'bg-themeblue1/20 border-themeblue1/30 text-primary',
  mission: 'bg-themegreen/20 border-themegreen/30 text-primary',
  medevac: 'bg-themeredred/20 border-themeredred/30 text-primary',
  other: 'bg-tertiary/20 border-tertiary/20 text-secondary',
}

export function getCategoryMeta(category: EventCategory) {
  return EVENT_CATEGORIES.find(c => c.value === category) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1]
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
    start_time: toLocalISOString(start),
    end_time: toLocalISOString(end),
    all_day: false,
    location: '',
    uniform: '',
    report_time: '',
    assigned_to: [],
    property_item_ids: [],
    structured_location: null,
    medevac_data: null,
  }
}

export function eventToFormData(event: CalendarEvent): EventFormData {
  return {
    title: event.title,
    description: event.description ?? '',
    category: event.category,
    start_time: event.start_time.slice(0, 16),
    end_time: event.end_time.slice(0, 16),
    all_day: event.all_day,
    location: event.location ?? '',
    uniform: event.uniform ?? '',
    report_time: event.report_time ?? '',
    assigned_to: event.assigned_to ?? [],
    property_item_ids: event.property_item_ids ?? [],
    structured_location: event.structured_location ?? null,
    medevac_data: event.medevac_data ?? null,
  }
}

export function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function eventFallsOnDate(event: CalendarEvent, dateKey: string): boolean {
  const start = event.start_time.slice(0, 10)
  const end = event.end_time.slice(0, 10)
  return dateKey >= start && dateKey <= end
}

export function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const DAY_START_HOUR = 0
export const DAY_END_HOUR = 24
export const HOUR_HEIGHT_PX = 60
