/**
 * Map overlay service — local read helpers.
 *
 * Overlays propagate over the clinic Signal vault now (see useMapOverlayWrite
 * / useMapOverlayVault); the offline sync queue is no longer used. This file
 * keeps the read helpers UI components already depend on.
 */

import { getLocalMapOverlays, getLocalMapOverlay } from './offlineDb'
import type { LocalMapOverlay } from '../Types/MapOverlayTypes'
import { type Result, ok, err } from './result'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('MapOverlayService')

export async function getOverlays(clinicId: string): Promise<Result<LocalMapOverlay[]>> {
  try {
    return ok(await getLocalMapOverlays(clinicId))
  } catch (e) {
    logger.error('Failed to load overlays from IDB', e)
    return err('Failed to load overlays')
  }
}

export async function getOverlay(overlayId: string): Promise<Result<LocalMapOverlay | undefined>> {
  try {
    return ok(await getLocalMapOverlay(overlayId))
  } catch (e) {
    logger.error('Failed to load overlay from IDB', e)
    return err('Failed to load overlay')
  }
}
