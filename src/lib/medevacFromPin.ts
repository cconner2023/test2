/**
 * Phase 4.2 — Build a MEDEVAC request seeded from a map pin.
 *
 * Pure helper: takes an OverlayFeature (typically a PZ waypoint) and the
 * containing overlayId, returns a MedevacRequest with line 1 (pickup grid)
 * pre-populated from the pin's coordinates and the cross-domain link
 * fields (featureId, overlayId, tc3CardId) populated. Caller hands the
 * result to useMedevacStore.setReq and opens the editor.
 */

import { latLngToMgrs } from './mgrsFormat'
import type { OverlayFeature } from '../Types/MapOverlayTypes'
import type { MedevacRequest } from '../Types/MedevacTypes'
import { emptyMedevacRequest } from '../Types/MedevacTypes'

export interface BuildMedevacOptions {
  /** Overlay containing the feature (used as the cross-domain link). */
  overlayId: string
  /** Optional starting template — defaults to emptyMedevacRequest(). */
  base?: MedevacRequest
  /** MGRS precision digits (1..5). Default 5 = 1m. Most ground-element
   *  pickup grids use 8-digit (=4 here), but a PZ pin in Beacon is GPS-
   *  derived so 1m precision is honest. */
  mgrsPrecision?: number
}

export interface BuildMedevacResult {
  req: MedevacRequest
  /** Filled when MGRS conversion succeeded. */
  mgrs?: string
  error?: string
}

export function buildMedevacFromPin(
  feature: OverlayFeature,
  opts: BuildMedevacOptions,
): BuildMedevacResult {
  const { overlayId, base = emptyMedevacRequest(), mgrsPrecision = 5 } = opts
  if (feature.type !== 'waypoint' || feature.geometry.length === 0) {
    return { req: base, error: 'Feature has no waypoint coordinate' }
  }
  const [lat, lng] = feature.geometry[0]
  const mgrs = latLngToMgrs(lat, lng, mgrsPrecision)
  if (!mgrs) {
    return { req: base, error: 'MGRS conversion failed' }
  }
  const req: MedevacRequest = {
    ...base,
    l1: mgrs,
    l1d: base.l1d || (feature.label ? feature.label : undefined),
    featureId: feature.id,
    overlayId,
    tc3CardId: feature.tc3_card_id ?? base.tc3CardId,
  }
  return { req, mgrs }
}
