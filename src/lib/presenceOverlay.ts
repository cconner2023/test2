import type { OverlayFeature } from '../Types/MapOverlayTypes'
import { DEFAULT_FEATURE_STYLE } from '../Types/MapOverlayTypes'
import type { WriteOverlayParams } from '../Hooks/useMapOverlayWrite'
import { latLngToMgrs } from './mgrsFormat'

/**
 * TEAM PRESENCE — opt-in self-location, decoupled from mission events.
 *
 * Each clinic has one standing "Team Presence" overlay with a deterministic id.
 * Every member owns exactly ONE person-marker feature in it, keyed by a
 * deterministic feature id (`presence:<userId>`), so "Update your location"
 * re-targets the same feature (upsert = move) and "Remove" deletes it.
 *
 * Transport reuses the ordinary map-overlay vault fan-out (per-feature
 * upsertFeature / removeFeature through the per-overlay route queue), so no new
 * Signal content type is required. There is NO continuous publisher: a position
 * only ever leaves the device on a deliberate Add/Update tap — the browser
 * geolocation prompt is acquire-consent, the tap is transmit-consent.
 */

const OVERLAY_PREFIX = 'presence-'
const FEATURE_PREFIX = 'presence:'

/** Deterministic per-clinic presence overlay id. Every member converges here. */
export function presenceOverlayId(clinicId: string): string {
  return `${OVERLAY_PREFIX}${clinicId}`
}

export function isPresenceOverlayId(overlayId: string): boolean {
  return overlayId.startsWith(OVERLAY_PREFIX)
}

/** Deterministic per-user feature id inside the presence overlay. */
export function presenceFeatureId(userId: string): string {
  return `${FEATURE_PREFIX}${userId}`
}

/** Recover the owning userId from a presence feature id, or null if not one. */
export function parsePresenceUserId(featureId: string): string | null {
  return featureId.startsWith(FEATURE_PREFIX) ? featureId.slice(FEATURE_PREFIX.length) : null
}

/**
 * Params for the standing presence overlay — created EMPTY and idempotently.
 * Racing empty-creates across devices converge (same id, no features), then
 * each member's marker lands as an independent per-feature upsert.
 */
export function buildPresenceOverlayParams(
  clinicId: string,
  center: [number, number],
  zoom: number,
): WriteOverlayParams {
  return {
    overlayId: presenceOverlayId(clinicId),
    clinicId,
    name: 'Team Presence',
    center,
    zoom,
    features: [],
  }
}

/** Build the current user's person-marker feature (waypoint at their fix). */
export function buildPresenceFeature(params: {
  clinicId: string
  userId: string
  label: string
  lat: number
  lng: number
  now: string
}): OverlayFeature {
  const { clinicId, userId, label, lat, lng, now } = params
  return {
    id: presenceFeatureId(userId),
    overlay_id: presenceOverlayId(clinicId),
    type: 'waypoint',
    geometry: [[lat, lng]],
    label,
    style: { ...DEFAULT_FEATURE_STYLE },
    waypoint_type: 'friendly',
    mgrs: latLngToMgrs(lat, lng, 5),
    created_at: now,
    updated_at: now,
  }
}
