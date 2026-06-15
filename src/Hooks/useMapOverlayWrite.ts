/**
 * useMapOverlayWrite — Consolidated map overlay write operations.
 *
 * Mirrors useCalendarWrite.
 *   writeOverlay  — awaits vault confirmation, persists to IDB with originId,
 *                   queues a pending send if the fan-out fails.
 *   deleteOverlay — tombstones immediately (resurrection guard before any
 *                   await), fans out 'd' to every clinic device including the
 *                   vault (pair-cleans 'c'/'d' on next replay), removes from
 *                   IDB and bumps the invalidation counter.
 */

import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useMapOverlayVault } from './useMapOverlayVault'
import {
  getLocalMapOverlay,
  saveLocalMapOverlay,
  deleteLocalMapOverlay,
} from '../lib/offlineDb'
import {
  addOverlayTombstone,
  queuePendingOverlaySend,
  clearPendingOverlaySend,
} from '../lib/mapOverlayEventStore'
import { getOverlayTombstones } from '../lib/mapOverlayRouting'
import { invalidate } from '../stores/useInvalidationStore'
import type { LocalMapOverlay, MapOverlay, OverlayFeature, OverlayFloor } from '../Types/MapOverlayTypes'
import type { MapOverlayPayload, MapFeaturePayload } from '../lib/signal/messageContent'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('MapOverlayWrite')

/**
 * Queue the overlay's current IDB state for bulk re-sync on next reconnect.
 * Shared fallback for any per-feature / metadata send that fails offline —
 * the existing vault drain in useMapOverlayVault picks pending sends up and
 * re-fans the full overlay envelope, whose features[] overwrites remote
 * projections and absorbs whatever local edits accumulated while offline.
 */
async function queueOverlayResync(overlayId: string): Promise<void> {
  const o = await getLocalMapOverlay(overlayId)
  if (!o) return
  await queuePendingOverlaySend({
    id: o.id,
    clinic_id: o.clinic_id,
    name: o.name,
    description: o.description,
    center: o.center,
    zoom: o.zoom,
    features: o.features,
    floors: o.floors,
    created_by: o.created_by,
    created_at: o.created_at,
    updated_at: o.updated_at,
  })
}

export interface WriteOverlayParams {
  overlayId: string
  clinicId: string
  name: string
  description?: string
  center: [number, number]
  zoom: number
  features: OverlayFeature[]
  floors?: OverlayFloor[]
}

export interface UpsertFeatureParams {
  overlayId: string
  clinicId: string
  feature: OverlayFeature
}

export interface RemoveFeatureParams {
  overlayId: string
  clinicId: string
  featureId: string
}

export interface WriteOverlayMetadataParams {
  overlayId: string
  clinicId: string
  name?: string
  description?: string
  center?: [number, number]
  zoom?: number
  floors?: OverlayFloor[]
}

export interface UseMapOverlayWriteResult {
  /**
   * Atomic write: persists optimistically to IDB, awaits vault fan-out, then
   * patches the IDB row with the resulting originId. If the fan-out fails,
   * the overlay is queued in pendingOverlaySends for retry on next online.
   *
   * Bulk path — sends the full features[] in a single overlay envelope.
   * Prefer upsertFeature / removeFeature for incremental edits; reach for
   * writeOverlay only on first-create-with-features (import) or rename.
   */
  writeOverlay: (params: WriteOverlayParams) => Promise<LocalMapOverlay | null>

  /**
   * Per-feature sibling of writeOverlay. Sends a single MapFeatureContent
   * envelope so a 100-point overlay edit doesn't re-encrypt the full feature
   * set for every recipient. Pair-cleans any prior vault row for the same
   * feature_id via the per-feature origin-id cache on LocalMapOverlay.
   */
  upsertFeature: (params: UpsertFeatureParams) => Promise<void>

  /** Per-feature delete via Signal fan-out. Cooperative pair-clean on next vault drain. */
  removeFeature: (params: RemoveFeatureParams) => Promise<void>

  /**
   * Metadata-only overlay 'u' (name / description / center / zoom). The
   * features[] field is intentionally omitted from the envelope — per-feature
   * envelopes carry feature state. Pair-cleans the prior overlay originId.
   */
  writeOverlayMetadata: (params: WriteOverlayMetadataParams) => Promise<void>

  /**
   * Tombstones immediately (resurrection guard), awaits vault fan-out 'd',
   * then removes from IDB. Idempotent — repeated calls for the same id no-op.
   */
  deleteOverlay: (id: string) => Promise<void>

  /** True while writeOverlay is in flight. */
  isWriting: boolean

  /** True while deleteOverlay is awaiting vault fan-out. */
  isDeleting: boolean
}

export function useMapOverlayWrite(): UseMapOverlayWriteResult {
  const [isWriting, setIsWriting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { sendOverlay, sendFeature, deleteOverlayMessages } = useMapOverlayVault()
  const { user } = useAuth()
  const userId = user?.id ?? null

  const writeOverlay = useCallback(async (params: WriteOverlayParams): Promise<LocalMapOverlay | null> => {
    if (!userId) return null
    if (getOverlayTombstones().has(params.overlayId)) {
      logger.warn(`Refusing to write tombstoned overlay ${params.overlayId}`)
      return null
    }

    const existing = await getLocalMapOverlay(params.overlayId)
    const now = new Date().toISOString()
    const oldOriginId = existing?.originId ?? null

    const overlay: LocalMapOverlay = {
      id: params.overlayId,
      clinic_id: params.clinicId,
      name: params.name,
      description: params.description,
      center: params.center,
      zoom: params.zoom,
      features: params.features,
      floors: params.floors,
      created_by: existing?.created_by ?? userId,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      _sync_status: 'pending',
      _sync_retry_count: 0,
      _last_sync_error: null,
      _last_sync_error_message: null,
    }

    // Optimistic local persist so the UI reflects the change immediately.
    await saveLocalMapOverlay(overlay)
    invalidate('mapOverlays')

    setIsWriting(true)
    try {
      // Vault pair-clean: replace any prior vault message for this overlay so
      // the inbox doesn't grow with stale 'c' replays.
      if (oldOriginId) deleteOverlayMessages([oldOriginId], overlay.clinic_id)

      const payload: MapOverlayPayload = {
        id: overlay.id,
        clinic_id: overlay.clinic_id,
        name: overlay.name,
        description: overlay.description,
        center: overlay.center,
        zoom: overlay.zoom,
        features: overlay.features,
        floors: overlay.floors,
        created_by: overlay.created_by,
        created_at: overlay.created_at,
        updated_at: overlay.updated_at,
      }

      const originId = await sendOverlay('c', payload)
      const committed: LocalMapOverlay = {
        ...overlay,
        ...(originId && { originId }),
        _sync_status: originId ? 'synced' : 'pending',
      }
      await saveLocalMapOverlay(committed)

      if (!originId) {
        // Fan-out failed — queue for retry on next online.
        await queuePendingOverlaySend(payload)
      } else {
        await clearPendingOverlaySend(overlay.id)
      }

      invalidate('mapOverlays')
      return committed
    } catch (e) {
      logger.warn('writeOverlay failed; overlay persisted locally without originId:', e)
      return overlay
    } finally {
      setIsWriting(false)
    }
  }, [sendOverlay, deleteOverlayMessages, userId])

  const upsertFeature = useCallback(async (params: UpsertFeatureParams): Promise<void> => {
    const { overlayId, clinicId, feature } = params
    if (!userId) return
    if (getOverlayTombstones().has(overlayId)) return

    const existing = await getLocalMapOverlay(overlayId)
    if (!existing) {
      logger.warn(`upsertFeature: unknown overlay ${overlayId}`)
      return
    }

    const now = new Date().toISOString()
    const idx = existing.features.findIndex(f => f.id === feature.id)
    const isNew = idx === -1
    const prevOriginId = existing._feature_origin_ids?.[feature.id]

    // Optimistic IDB write — UI reflects the change immediately.
    const nextFeatures = isNew
      ? [...existing.features, feature]
      : existing.features.map((f, i) => i === idx ? feature : f)
    await saveLocalMapOverlay({
      ...existing,
      features: nextFeatures,
      updated_at: now,
    })
    invalidate('mapOverlays')

    // Pair-clean any prior c/u for this feature so the vault doesn't
    // accumulate stale rows across repeated edits. Fire-and-forget.
    if (prevOriginId) deleteOverlayMessages([prevOriginId], clinicId).catch(() => {})

    const originId = await sendFeature(isNew ? 'c' : 'u', {
      overlay_id: overlayId,
      clinic_id: clinicId,
      feature,
    })

    if (originId) {
      const refreshed = await getLocalMapOverlay(overlayId)
      if (refreshed) {
        const nextOriginIds = { ...(refreshed._feature_origin_ids ?? {}), [feature.id]: originId }
        await saveLocalMapOverlay({ ...refreshed, _feature_origin_ids: nextOriginIds })
      }
    } else {
      // Send failed (offline / fan-out error) — queue the overlay for a bulk
      // re-sync on reconnect. The drain in useMapOverlayVault re-sends the
      // overlay envelope with the current features[], which overwrites the
      // remote projection and includes the change we just made.
      await queueOverlayResync(overlayId)
    }
  }, [userId, sendFeature, deleteOverlayMessages])

  const removeFeature = useCallback(async (params: RemoveFeatureParams): Promise<void> => {
    const { overlayId, clinicId, featureId } = params
    if (!userId) return

    const existing = await getLocalMapOverlay(overlayId)
    if (!existing) return

    const now = new Date().toISOString()
    const nextOriginIds = existing._feature_origin_ids
      ? Object.fromEntries(Object.entries(existing._feature_origin_ids).filter(([k]) => k !== featureId))
      : undefined

    await saveLocalMapOverlay({
      ...existing,
      features: existing.features.filter(f => f.id !== featureId),
      updated_at: now,
      _feature_origin_ids: nextOriginIds,
    })
    invalidate('mapOverlays')

    // Cooperative pair-clean: send 'd' and let the next vault drain pair it
    // with any prior c/u for the same (overlay_id, feature_id) batch — same
    // pattern as overlay deletes. Do NOT pre-clean the prior origin or the
    // 'd' becomes an orphan with nothing to pair against.
    const originId = await sendFeature('d', {
      overlay_id: overlayId,
      clinic_id: clinicId,
      feature: { id: featureId },
    })
    if (!originId) {
      // Offline — fall back to bulk resync so the deletion still reaches
      // peers when connectivity returns. Bulk overlay payload overwrites
      // remote features[], picking up the local splice.
      await queueOverlayResync(overlayId)
    }
  }, [userId, sendFeature])

  const writeOverlayMetadata = useCallback(async (params: WriteOverlayMetadataParams): Promise<void> => {
    const { overlayId, clinicId } = params
    if (!userId) return
    if (getOverlayTombstones().has(overlayId)) return

    const existing = await getLocalMapOverlay(overlayId)
    if (!existing) return

    const now = new Date().toISOString()
    await saveLocalMapOverlay({
      ...existing,
      ...(params.name !== undefined && { name: params.name }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.center !== undefined && { center: params.center }),
      ...(params.zoom !== undefined && { zoom: params.zoom }),
      ...(params.floors !== undefined && { floors: params.floors }),
      updated_at: now,
    })
    invalidate('mapOverlays')

    const prevOriginId = existing.originId ?? null
    if (prevOriginId) deleteOverlayMessages([prevOriginId], clinicId).catch(() => {})

    // Metadata-only envelope — features intentionally omitted; per-feature
    // envelopes carry feature state on this path.
    const payload: MapOverlayPayload = {
      id: overlayId,
      clinic_id: clinicId,
      ...(params.name !== undefined && { name: params.name }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.center !== undefined && { center: params.center }),
      ...(params.zoom !== undefined && { zoom: params.zoom }),
      ...(params.floors !== undefined && { floors: params.floors }),
      created_by: existing.created_by,
      created_at: existing.created_at,
      updated_at: now,
    }
    const originId = await sendOverlay('u', payload)
    if (originId) {
      const refreshed = await getLocalMapOverlay(overlayId)
      if (refreshed) await saveLocalMapOverlay({ ...refreshed, originId })
    } else {
      await queueOverlayResync(overlayId)
    }
  }, [userId, sendOverlay, deleteOverlayMessages])

  const deleteOverlay = useCallback(async (id: string): Promise<void> => {
    // Short-circuit if already tombstoned.
    if (getOverlayTombstones().has(id)) {
      await deleteLocalMapOverlay(id)
      invalidate('mapOverlays')
      return
    }

    const existing = await getLocalMapOverlay(id)
    const originId = existing?.originId ?? null
    const overlayClinicId = existing?.clinic_id

    // Tombstone first (sync set + async IDB write) — resurrection guard before any await.
    getOverlayTombstones().add(id)
    addOverlayTombstone(id).catch(() => {})

    // Cancel any pending offline vault send for this overlay so it never fires.
    clearPendingOverlaySend(id).catch(() => {})

    setIsDeleting(true)
    try {
      // Fan-out 'd' to every clinic device including the vault. The vault
      // pair-cleans its own 'c'/'d' rows on next processClinicVaultMessages.
      await sendOverlay('d', { id, ...(overlayClinicId && { clinic_id: overlayClinicId }) })

      // Belt-and-suspenders: if we still know the originId of the prior 'c',
      // ask the vault to hard-delete it now rather than wait for the next
      // pair-clean pass on another device.
      if (originId && overlayClinicId) {
        deleteOverlayMessages([originId], overlayClinicId).catch(() => {})
      }
    } finally {
      setIsDeleting(false)
      await deleteLocalMapOverlay(id)
      invalidate('mapOverlays')
    }
  }, [sendOverlay, deleteOverlayMessages])

  return { writeOverlay, upsertFeature, removeFeature, writeOverlayMetadata, deleteOverlay, isWriting, isDeleting }
}

/** Helper for callers that hold a MapOverlay-shaped object. */
export function toWriteParams(o: MapOverlay): WriteOverlayParams {
  return {
    overlayId: o.id,
    clinicId: o.clinic_id,
    name: o.name,
    description: o.description,
    center: o.center,
    zoom: o.zoom,
    features: o.features,
    floors: o.floors,
  }
}
