import type { CalendarEvent } from '../Types/CalendarTypes'

export type OverlayLinkState = 'full' | 'partial' | 'none'

/**
 * Resolves how a CalendarEvent links to an overlay:
 *   'full'    — overlay id is in linked_overlays (implies all features)
 *   'partial' — at least one of the overlay's features is in linked_features,
 *               but the overlay itself is not fully linked
 *   'none'    — no link
 *
 * structured_location is intentionally NOT considered here — it drives
 * presence/share and is orthogonal to the free-form link arrays.
 */
export function resolveOverlayLink(event: CalendarEvent, overlayId: string): OverlayLinkState {
  if (event.linked_overlays?.includes(overlayId)) return 'full'
  if (event.linked_features?.some(f => f.overlay_id === overlayId)) return 'partial'
  return 'none'
}

/**
 * A feature is linked to an event iff it is explicitly listed in
 * linked_features OR its parent overlay is fully linked via linked_overlays.
 */
export function isFeatureLinked(event: CalendarEvent, overlayId: string, featureId: string): boolean {
  if (event.linked_overlays?.includes(overlayId)) return true
  return event.linked_features?.some(f => f.overlay_id === overlayId && f.feature_id === featureId) ?? false
}

/** Feature ids within `overlayId` that are explicitly linked on this event (excludes overlay-implied). */
export function explicitlyLinkedFeatureIds(event: CalendarEvent, overlayId: string): string[] {
  return (event.linked_features ?? [])
    .filter(f => f.overlay_id === overlayId)
    .map(f => f.feature_id)
}

/** Immutable add — returns a new event with the overlay added to linked_overlays (no-op if already present). */
export function addOverlayLink(event: CalendarEvent, overlayId: string): CalendarEvent {
  const current = event.linked_overlays ?? []
  if (current.includes(overlayId)) return event
  return { ...event, linked_overlays: [...current, overlayId] }
}

/** Immutable remove — drops the overlay from linked_overlays. Does not touch linked_features. */
export function removeOverlayLink(event: CalendarEvent, overlayId: string): CalendarEvent {
  const current = event.linked_overlays ?? []
  if (!current.includes(overlayId)) return event
  return { ...event, linked_overlays: current.filter(id => id !== overlayId) }
}

/** Immutable add — returns a new event with the feature added (no-op if already present). */
export function addFeatureLink(event: CalendarEvent, overlayId: string, featureId: string): CalendarEvent {
  const current = event.linked_features ?? []
  if (current.some(f => f.overlay_id === overlayId && f.feature_id === featureId)) return event
  return { ...event, linked_features: [...current, { overlay_id: overlayId, feature_id: featureId }] }
}

/** Immutable remove — drops the feature anchor. */
export function removeFeatureLink(event: CalendarEvent, overlayId: string, featureId: string): CalendarEvent {
  const current = event.linked_features ?? []
  const next = current.filter(f => !(f.overlay_id === overlayId && f.feature_id === featureId))
  if (next.length === current.length) return event
  return { ...event, linked_features: next }
}
