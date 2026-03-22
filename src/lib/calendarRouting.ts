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

/** Returns true if the content is a calendar event message. */
export function isCalendarEvent(content: MessageContent | undefined | null): content is CalendarEventContent {
  return content?.type === 'calendar_event'
}

/**
 * Route a calendar event to the calendar store.
 * Safe to call from any context (hook, service, module scope) since it
 * uses getState() rather than requiring React rendering context.
 */
export function routeCalendarEvent(content: CalendarEventContent): void {
  const { action, data } = content
  const store = useCalendarStore.getState()

  if (action === 'create') {
    store.addEvent(data as CalendarEvent)
  } else if (action === 'update') {
    store.updateEvent(data.id, data as Partial<CalendarEvent>)
  } else if (action === 'delete') {
    store.removeEvent(data.id)
  }
}
