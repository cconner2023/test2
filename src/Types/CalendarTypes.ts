export type EventCategory =
  | 'training' | 'duty' | 'range' | 'appointment' | 'other'

export type EventStatus = 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

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
  created_by: string
  created_at: string
  updated_at: string
  /** Origin ID of the latest broadcast message — used for hard-delete on update/delete. */
  originId?: string
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
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string; color: string }[] = [
  { value: 'training', label: 'Training', color: 'bg-themeyellow/20' },
  { value: 'duty', label: 'Duty', color: 'bg-themeredred/20' },
  { value: 'range', label: 'Range', color: 'bg-themeblue2/20' },
  { value: 'appointment', label: 'Appointment', color: 'bg-themeblue1/20' },
  { value: 'other', label: 'Other', color: 'bg-tertiary/50' },
]

export const CATEGORY_BG_MAP: Record<EventCategory, string> = {
  training: 'bg-themeyellow/20 border-themeyellow/30 text-primary',
  duty: 'bg-themeredred/20 border-themeredred/30 text-primary',
  range: 'bg-themeblue2/20 border-themeblue2/30 text-primary',
  appointment: 'bg-themeblue1/20 border-themeblue1/30 text-primary',
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
