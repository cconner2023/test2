/**
 * Map overlay service — offline-first CRUD for tactical map overlays.
 *
 * Pattern: IDB write → sync queue → immediate sync attempt.
 * Sync will fail silently until the Supabase `map_overlays` table exists —
 * correct offline-first behavior.
 */

import {
  getLocalMapOverlays,
  getLocalMapOverlay,
  saveLocalMapOverlay,
  deleteLocalMapOverlay,
  addToSyncQueue,
  stripLocalFields,
} from './offlineDb'
import type { LocalMapOverlay } from '../Types/MapOverlayTypes'
import type { OverlayFeature } from '../Types/MapOverlayTypes'
import { type Result, ok, err } from './result'
import { createLogger } from '../Utilities/Logger'
import { processSyncQueue, isOnline } from './syncService'

const logger = createLogger('MapOverlayService')

// ── Helpers ──────────────────────────────────────────────────

async function immediateSync(userId: string): Promise<void> {
  if (!isOnline()) return
  try {
    await processSyncQueue(userId)
  } catch (e) {
    logger.warn('Immediate sync attempt failed (will retry):', e)
  }
}

// ============================================================
// Public API
// ============================================================

export async function getOverlays(clinicId: string): Promise<Result<LocalMapOverlay[]>> {
  try {
    const overlays = await getLocalMapOverlays(clinicId)
    return ok(overlays)
  } catch (e) {
    logger.error('Failed to load overlays from IDB', e)
    return err('Failed to load overlays')
  }
}

export async function getOverlay(overlayId: string): Promise<Result<LocalMapOverlay | undefined>> {
  try {
    const overlay = await getLocalMapOverlay(overlayId)
    return ok(overlay)
  } catch (e) {
    logger.error('Failed to load overlay from IDB', e)
    return err('Failed to load overlay')
  }
}

interface SaveOverlayParams {
  overlayId: string
  clinicId: string
  userId: string
  name: string
  center: [number, number]
  zoom: number
  features: OverlayFeature[]
}

export async function saveOverlay(params: SaveOverlayParams): Promise<Result<LocalMapOverlay>> {
  try {
    const existing = await getLocalMapOverlay(params.overlayId)
    const now = new Date().toISOString()

    const overlay: LocalMapOverlay = {
      id: params.overlayId,
      clinic_id: params.clinicId,
      name: params.name,
      center: params.center,
      zoom: params.zoom,
      features: params.features,
      created_by: params.userId,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      _sync_status: 'pending',
      _sync_retry_count: 0,
      _last_sync_error: null,
      _last_sync_error_message: null,
    }

    await saveLocalMapOverlay(overlay)

    const action = existing ? 'update' : 'create'
    await addToSyncQueue({
      user_id: params.userId,
      action,
      table_name: 'map_overlays',
      record_id: params.overlayId,
      payload: stripLocalFields(overlay as unknown as Record<string, unknown>),
    })

    immediateSync(params.userId)

    return ok(overlay)
  } catch (e) {
    logger.error('Failed to save overlay', e)
    return err('Failed to save overlay')
  }
}

export async function deleteOverlay(overlayId: string, userId: string): Promise<Result<void>> {
  try {
    await deleteLocalMapOverlay(overlayId)

    await addToSyncQueue({
      user_id: userId,
      action: 'delete',
      table_name: 'map_overlays',
      record_id: overlayId,
      payload: { id: overlayId },
    })

    immediateSync(userId)

    return ok(undefined)
  } catch (e) {
    logger.error('Failed to delete overlay', e)
    return err('Failed to delete overlay')
  }
}
