/**
 * Fitness visibility gate. AFT and Workout calendar events are dev-only while
 * the feature is in incubation — non-dev users must not see them on ANY surface
 * (calendar, schedule lists, mission board, search). Apply this filter at every
 * render-point that iterates calendar events for display.
 *
 * Sync/write paths (useCalendarSync, useCalendarWrite, vault fanout) operate on
 * the unfiltered store — gating is render-only, not data-suppression.
 */

import type { CalendarEvent, EventCategory } from '../../Types/CalendarTypes'

const FITNESS_CATEGORIES = new Set<EventCategory>(['aft_record', 'workout'])

export function isFitnessEvent(e: Pick<CalendarEvent, 'category'>): boolean {
  return FITNESS_CATEGORIES.has(e.category)
}

export function visibleEventsForRole(events: CalendarEvent[], isDevRole: boolean): CalendarEvent[] {
  if (isDevRole) return events
  return events.filter(e => !isFitnessEvent(e))
}
