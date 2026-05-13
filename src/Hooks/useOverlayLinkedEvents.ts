import { useMemo } from 'react'
import { useCalendarStore } from '../stores/useCalendarStore'
import type { CalendarEvent } from '../Types/CalendarTypes'

/**
 * Inverse of CalendarEvent.structured_location.overlay_id — given an overlay id,
 * return every CalendarEvent in the store that references it. Empty array when
 * unlinked (or when the overlayId is null). Sorted by start_time ascending so
 * the next-upcoming event is at index 0.
 *
 * The forward link lives on the calendar event (see Types/MissionTypes.ts
 * StructuredLocation); this hook is the only thing other domains need to read
 * the relationship from the map side without coupling to the calendar's
 * internal layout.
 */
export function useOverlayLinkedEvents(overlayId: string | null | undefined): CalendarEvent[] {
  const events = useCalendarStore(s => s.events)
  return useMemo(() => {
    if (!overlayId) return []
    return events
      .filter(e => e.structured_location?.overlay_id === overlayId)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [events, overlayId])
}
