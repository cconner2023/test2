/**
 * Fitness visibility gate for calendar render surfaces (calendar grid, schedule
 * lists, mission board, search, supervisor/team views).
 *
 * - `workout` events: always hidden. Workouts live in their own surface
 *   (WorkoutDrawer / ProfilePage Fitness) and are never rendered on calendar.
 * - `aft_record` events: dev-only while the AFT feature is in incubation.
 *
 * Sync/write paths (useCalendarSync, useCalendarWrite, vault fanout) operate on
 * the unfiltered store — gating is render-only, not data-suppression.
 */

import type { CalendarEvent, EventCategory } from '../../Types/CalendarTypes'

const DEV_ONLY_CATEGORIES = new Set<EventCategory>(['aft_record'])
const ALWAYS_HIDDEN_CATEGORIES = new Set<EventCategory>(['workout'])

export function isFitnessEvent(e: Pick<CalendarEvent, 'category'>): boolean {
  return DEV_ONLY_CATEGORIES.has(e.category) || ALWAYS_HIDDEN_CATEGORIES.has(e.category)
}

export function visibleEventsForRole(events: CalendarEvent[], isDevRole: boolean): CalendarEvent[] {
  return events.filter(e => {
    if (ALWAYS_HIDDEN_CATEGORIES.has(e.category)) return false
    if (!isDevRole && DEV_ONLY_CATEGORIES.has(e.category)) return false
    return true
  })
}
