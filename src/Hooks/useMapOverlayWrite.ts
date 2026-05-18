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
import type { LocalMapOverlay, MapOverlay, OverlayFeature } from '../Types/MapOverlayTypes'
import type { MapOverlayPayload } from '../lib/signal/messageContent'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('MapOverlayWrite')

export interface WriteOverlayParams {
  overlayId: string
  clinicId: string
  name: string
  description?: string
  center: [number, number]
  zoom: number
  features: OverlayFeature[]
}

export interface UseMapOverlayWriteResult {
  /**
   * Atomic write: persists optimistically to IDB, awaits vault fan-out, then
   * patches the IDB row with the resulting originId. If the fan-out fails,
   * the overlay is queued in pendingOverlaySends for retry on next online.
   */
  writeOverlay: (params: WriteOverlayParams) => Promise<LocalMapOverlay | null>

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
  const { sendOverlay, deleteOverlayMessages } = useMapOverlayVault()
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

  return { writeOverlay, deleteOverlay, isWriting, isDeleting }
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
  }
}
