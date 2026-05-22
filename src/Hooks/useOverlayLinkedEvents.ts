import { useMemo } from 'react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { explicitlyLinkedFeatureIds, resolveOverlayLink } from '../lib/eventLinks'
import type { CalendarEvent } from '../Types/CalendarTypes'

export interface PartiallyLinkedEvent {
  event: CalendarEvent
  /** Feature ids explicitly listed in event.linked_features for this overlay. */
  featureIds: string[]
}

export interface OverlayLinkedEvents {
  /** Events with the overlay in linked_overlays — every feature is implied linked. */
  full: CalendarEvent[]
  /** Events with at least one of the overlay's features in linked_features (but not fully linked). */
  partial: PartiallyLinkedEvent[]
}

const EMPTY: OverlayLinkedEvents = { full: [], partial: [] }

/**
 * Inverse lookup: every CalendarEvent in the store that links to `overlayId`,
 * partitioned by link strength. Sorted by start_time ascending within each bucket.
 *
 * Reads new N:N fields (linked_overlays / linked_features). Does NOT consult
 * structured_location — that field drives presence/share and is intentionally
 * orthogonal to free-form metadata links.
 */
export function useOverlayLinkedEvents(overlayId: string | null | undefined): OverlayLinkedEvents {
  const events = useCalendarStore(s => s.events)
  return useMemo(() => {
    if (!overlayId) return EMPTY
    const full: CalendarEvent[] = []
    const partial: PartiallyLinkedEvent[] = []
    for (const event of events) {
      const state = resolveOverlayLink(event, overlayId)
      if (state === 'full') full.push(event)
      else if (state === 'partial') partial.push({ event, featureIds: explicitlyLinkedFeatureIds(event, overlayId) })
    }
    const byStart = (a: CalendarEvent, b: CalendarEvent) => a.start_time.localeCompare(b.start_time)
    full.sort(byStart)
    partial.sort((a, b) => byStart(a.event, b.event))
    return { full, partial }
  }, [events, overlayId])
}
