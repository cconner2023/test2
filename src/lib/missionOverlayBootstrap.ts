/**
 * Phase 4.3a — Auto-spawn a map overlay for a mission/training/range event
 * that hasn't been bound to one yet.
 *
 * Why this exists: CalendarEvent has had `structured_location.overlay_id`
 * since the calendar/mission integration landed, plus `field_positions`
 * for live presence. The infrastructure for "live mission overlay" is
 * already in place — the missing bit is a one-tap path from the event to
 * a freshly-named overlay so participants don't need to manually attach a
 * map first.
 *
 * The helper is idempotent: if the event already carries an overlay_id,
 * the existing id flows through unchanged.
 */

import type { CalendarEvent } from '../Types/CalendarTypes'
import { saveOverlay } from './mapOverlayService'

export type FieldEventCategory = 'mission' | 'training' | 'range'

/** Categories that ought to spawn a map overlay automatically. Excludes
 *  'medevac' (the MEDEVAC form already has its own location workflow) and
 *  non-field categories (huddle, leave, appointment, etc.). */
const FIELD_EVENT_CATEGORIES: ReadonlySet<string> = new Set<FieldEventCategory>([
  'mission',
  'training',
  'range',
])

export function isFieldEvent(event: Pick<CalendarEvent, 'category'>): boolean {
  return FIELD_EVENT_CATEGORIES.has(event.category)
}

export interface EnsureOverlayArgs {
  event: CalendarEvent
  userId: string
  /** Fallback center when no event location can be resolved. Typically the
   *  active clinic's known location. Caller's responsibility. */
  fallbackCenter: [number, number]
  defaultZoom?: number
}

export interface EnsureOverlayResult {
  overlayId: string
  /** True when this call created a new overlay (caller probably wants to
   *  patch the event's structured_location to persist the binding). */
  created: boolean
  error?: string
}

/**
 * Ensure a CalendarEvent has a backing map overlay.
 *
 * - If event.structured_location.overlay_id exists → returns it (no writes).
 * - Else, creates an empty overlay named after the event and returns its id.
 *   Caller MUST patch the event with `structured_location: { overlay_id }`
 *   so future loads find the binding. (We don't mutate the event here to
 *   keep this helper testable without the calendar store.)
 */
export async function ensureMissionOverlay(args: EnsureOverlayArgs): Promise<EnsureOverlayResult> {
  const { event, userId, fallbackCenter, defaultZoom = 13 } = args

  if (!isFieldEvent(event)) {
    return { overlayId: '', created: false, error: 'Event is not a field-type category' }
  }

  const existing = event.structured_location?.overlay_id
  if (existing) return { overlayId: existing, created: false }

  const overlayId = crypto.randomUUID()
  const name = overlayName(event)

  const result = await saveOverlay({
    overlayId,
    clinicId: event.clinic_id,
    userId,
    name,
    center: fallbackCenter,
    zoom: defaultZoom,
    features: [],
  })

  if (!result.ok) {
    return { overlayId: '', created: false, error: result.error }
  }
  return { overlayId, created: true }
}

/** Compose a sensible overlay name from the event. Intent: scannable in the
 *  overlay tree without scrolling — title-first, dated when title repeats. */
function overlayName(event: CalendarEvent): string {
  const date = event.start_time.slice(0, 10)
  const trimmed = (event.title || '').trim()
  if (!trimmed) return `${event.category[0].toUpperCase() + event.category.slice(1)} · ${date}`
  return `${trimmed} · ${date}`
}
