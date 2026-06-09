import type { OverlayFeature } from '../Types/MapOverlayTypes'

/**
 * cloneFeatureForOverlay — produce an INDEPENDENT copy of an OverlayFeature
 * destined for a different overlay ("Copy to overlay" / "Add to overlay").
 *
 * Beacon's map model is containment: a feature belongs to exactly one overlay
 * (OverlayFeature.overlay_id). "Adding" a feature to another overlay therefore
 * DUPLICATES it — the copy is a brand-new feature with its own id and its own
 * home overlay. The two diverge from the moment of copy: editing or deleting
 * one never touches the other. This keeps the entire storage/sync substrate
 * (nested features[] IDB row, per-overlay_id route queue, two-envelope vault
 * fan-out, event-link composite keys) unchanged — a copy is indistinguishable
 * from a freshly-drawn feature in the target overlay.
 *
 * What the copy carries vs. resets:
 *  - id           → FRESH uuid. The id is the per-overlay routing/origin key
 *                   AND the event-link key {overlay_id, feature_id}; a fresh id
 *                   is what guarantees the copies are independent.
 *  - overlay_id   → the target overlay (the copy's new home).
 *  - created_at /
 *    updated_at   → `now` (the copy is new here).
 *  - geometry,
 *    style        → DEEP-copied so the copy never shares mutable array/object
 *                   refs with the source.
 *  - everything else (label, notes, waypoint_type, mgrs, recorded* flags,
 *    tc3_card_id) → carried verbatim.
 *
 * tc3_card_id is carried intentionally: it is an opaque, device-resolvable id
 * (no PHI on the wire — patient detail lives device-side in useTC3Store), so a
 * copied casualty pin legitimately points the same casualty at a second map.
 *
 * Pure-ish: id/now are injectable for tests; production callers omit them.
 */
export function cloneFeatureForOverlay(
  feature: OverlayFeature,
  targetOverlayId: string,
  opts?: { id?: string; now?: string },
): OverlayFeature {
  const id = opts?.id ?? crypto.randomUUID()
  const now = opts?.now ?? new Date().toISOString()
  return {
    ...feature,
    id,
    overlay_id: targetOverlayId,
    geometry: feature.geometry.map(([lat, lng]) => [lat, lng] as [number, number]),
    style: { ...feature.style },
    created_at: now,
    updated_at: now,
  }
}
