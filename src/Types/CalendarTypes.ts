export type EventCategory =
  | 'training' | 'sick_call' | 'duty' | 'ftx'
  | 'equipment_draw' | 'formation' | 'appointment' | 'other'

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
  created_by: string
  created_at: string
  updated_at: string
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
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string; color: string }[] = [
  { value: 'formation', label: 'Formation', color: 'bg-themeblue3' },
  { value: 'sick_call', label: 'Sick Call', color: 'bg-themegreen' },
  { value: 'training', label: 'Training', color: 'bg-themeyellow' },
  { value: 'duty', label: 'Duty', color: 'bg-themeredred' },
  { value: 'ftx', label: 'FTX', color: 'bg-themeblue2' },
  { value: 'equipment_draw', label: 'Equipment Draw', color: 'bg-tertiary' },
  { value: 'appointment', label: 'Appointment', color: 'bg-themeblue1' },
  { value: 'other', label: 'Other', color: 'bg-tertiary/50' },
]

export const CATEGORY_BG_MAP: Record<EventCategory, string> = {
  formation: 'bg-themeblue3/15 border-themeblue3/30 text-themeblue3',
  sick_call: 'bg-themegreen/15 border-themegreen/30 text-themegreen',
  training: 'bg-themeyellow/15 border-themeyellow/30 text-themeyellow',
  duty: 'bg-themeredred/15 border-themeredred/30 text-themeredred',
  ftx: 'bg-themeblue2/15 border-themeblue2/30 text-themeblue2',
  equipment_draw: 'bg-tertiary/10 border-tertiary/20 text-tertiary',
  appointment: 'bg-themeblue1/15 border-themeblue1/30 text-themeblue1',
  other: 'bg-tertiary/10 border-tertiary/20 text-tertiary',
}

export function getCategoryMeta(category: EventCategory) {
  return EVENT_CATEGORIES.find(c => c.value === category) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1]
}

export function createEmptyFormData(): EventFormData {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
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

export const DAY_START_HOUR = 6
export const DAY_END_HOUR = 22
export const HOUR_HEIGHT_PX = 60
