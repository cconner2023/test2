/**
 * Shared calendar event routing — applies calendar event actions from any
 * message processing path (realtime, vault, backup restore) to the calendar
 * Zustand store. The store's persistence middleware handles IDB write-through.
 *
 * This centralises the routing logic so every path that decrypts a calendar
 * event message can call a single function instead of duplicating the
 * create/update/delete branching.
 */

import type { MessageContent, CalendarEventContent } from './signal/messageContent'
import type { CalendarEvent } from '../Types/CalendarTypes'
import { useCalendarStore } from '../stores/useCalendarStore'
import { loadCalendarTombstones, addCalendarTombstone } from './calendarEventStore'

/** Returns true if the content is a calendar event message. */
export function isCalendarEvent(content: MessageContent | undefined | null): content is CalendarEventContent {
  return content?.type === 'calendar_event'
}

// Module-level tombstone set for O(1) lookups — avoids IDB on every message.
let _tombstones: Set<string> = new Set()

/** Expose the in-memory tombstone set for hydration filtering. */
export function getTombstones(): Set<string> {
  return _tombstones
}

/**
 * Load persisted tombstones into the in-memory set.
 * Must be called once during hydration before replaying any message stream.
 */
export async function initCalendarTombstones(): Promise<void> {
  _tombstones = await loadCalendarTombstones()
}

/**
 * Route a calendar event to the calendar store.
 * Safe to call from any context (hook, service, module scope) since it
 * uses getState() rather than requiring React rendering context.
 *
 * Create/update actions are silently dropped for tombstoned event IDs so
 * vault replay and backup restore cannot resurrect deleted events.
 */
export function routeCalendarEvent(content: CalendarEventContent): void {
  const { action, data } = content
  const store = useCalendarStore.getState()

  if (action === 'delete') {
    _tombstones.add(data.id)
    addCalendarTombstone(data.id).catch(() => {})
    store.removeEvent(data.id)
    return
  }

  // Guard: skip create/update for any tombstoned event.
  if (_tombstones.has(data.id)) return

  if (action === 'create') {
    // Upsert: if the event already exists (replacement message after edit),
    // update it with the full new state; otherwise add as new.
    if (store.events.some(e => e.id === data.id)) {
      store.updateEvent(data.id, data as Partial<CalendarEvent>)
    } else {
      store.addEvent(data as CalendarEvent)
    }
  } else if (action === 'update') {
    // Legacy delta updates — kept for backward compat with in-flight messages
    if (store.events.some(e => e.id === data.id)) {
      store.updateEvent(data.id, data as Partial<CalendarEvent>)
    } else {
      store.addEvent(data as CalendarEvent)
    }
  }
}
