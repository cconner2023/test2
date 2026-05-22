import { useMemo } from 'react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { isFeatureLinked } from '../lib/eventLinks'
import type { CalendarEvent } from '../Types/CalendarTypes'

/**
 * Inverse lookup: every CalendarEvent linked to a specific OverlayFeature,
 * either explicitly via linked_features OR implicitly via a parent-overlay
 * link in linked_overlays. Sorted by start_time ascending.
 */
export function useFeatureLinkedEvents(
  overlayId: string | null | undefined,
  featureId: string | null | undefined,
): CalendarEvent[] {
  const events = useCalendarStore(s => s.events)
  return useMemo(() => {
    if (!overlayId || !featureId) return []
    return events
      .filter(e => isFeatureLinked(e, overlayId, featureId))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [events, overlayId, featureId])
}
