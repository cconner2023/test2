/**
 * useMapOverlayVault — Map overlay send/delete via Signal Protocol fan-out.
 *
 * Mirrors useCalendarVault. Overlays are encrypted per-device via X3DH/
 * Double Ratchet and fanned out as a clinic self-message
 * (recipient_id = clinicId) to all clinic devices — the vault device plus
 * each member's clinic-scoped device — for EVERY target cluster: the owning
 * cluster, plus related clusters while the overlay carries tracking pins
 * (target_clinic_ids; see useMapOverlayWrite). Signal fns are called in a loop
 * only — not a signal/* refactor.
 */

import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { useMessagingStore } from '../stores/useMessagingStore'
import { useAuthStore } from '../stores/useAuthStore'
import { createLogger } from '../Utilities/Logger'
import { serializeContent } from '../lib/signal/messageContent'
import type { MapOverlayContent, MapOverlayPayload, MapFeatureContent, MapFeaturePayload } from '../lib/signal/messageContent'
import {
  loadPendingOverlaySends,
  clearPendingOverlaySend,
  patchPendingOverlaySend,
  queuePendingOverlaySend,
} from '../lib/mapOverlayEventStore'
import { getOverlayTombstones } from '../lib/mapOverlayRouting'
import { getLocalMapOverlay, saveLocalMapOverlay } from '../lib/offlineDb'
import { invalidate } from '../stores/useInvalidationStore'
import { fanOutToClinics, type FanOutOutcome } from '../lib/clinicFanOut'

const logger = createLogger('MapOverlayVault')

/**
 * Seal `serialized` into every target cluster's vault + member devices. One
 * originId is shared across every cluster batch (so the stored originId
 * resolves pair-clean in any cluster holding a copy). A failure in one
 * cluster doesn't abort the rest; succeeds if at least one batch landed.
 * Foreign clusters seal fine — encryption uses their PUBLIC bundles, no
 * membership needed (same as the calendar / property cross-cluster fan).
 */
async function fanOutDetailed(userId: string | null, targets: string[], serialized: string, what: string, originId?: string): Promise<{ originId: string; outcome: FanOutOutcome } | null> {
  if (targets.length === 0 || !userId) return null
  const localDeviceId = useMessagingStore.getState().localDeviceId
  const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
  if (!localDeviceId || !clinicDeviceId) return null
  const sharedOriginId = originId ?? crypto.randomUUID()
  const outcome = await fanOutToClinics(userId, clinicDeviceId, targets, serialized, sharedOriginId, what)
  return { originId: sharedOriginId, outcome }
}

async function fanOut(userId: string | null, targets: string[], serialized: string, what: string, originId?: string): Promise<string | null> {
  const r = await fanOutDetailed(userId, targets, serialized, what, originId)
  return r && r.outcome.landed.length > 0 ? r.originId : null
}

/**
 * Target set, in priority order: explicit `fanTo` (edits whose fan set is the
 * union of old + new targets) → the payload's `target_clinic_ids` → the
 * owning cluster → the active cluster.
 */
function resolveTargets(activeClinicId: string | null, fanTo: string[] | undefined, stamped: string[] | undefined, owner: string | undefined): string[] {
  if (fanTo && fanTo.length > 0) return Array.from(new Set(fanTo))
  if (stamped && stamped.length > 0) return Array.from(new Set(stamped))
  const one = owner ?? activeClinicId
  return one ? [one] : []
}

const actionMap = { c: 'create', u: 'update', d: 'delete' } as const

export async function sendOverlayVault(
  userId: string | null,
  activeClinicId: string | null,
  action: 'c' | 'u' | 'd',
  data: MapOverlayPayload,
  fanTo?: string[],
): Promise<string | null> {
  const content: MapOverlayContent = {
    type: 'map_overlay',
    action: actionMap[action],
    data,
  }
  const targets = resolveTargets(activeClinicId, fanTo, data.target_clinic_ids, data.clinic_id)
  const r = await fanOutDetailed(userId, targets, serializeContent(content), 'map overlay')
  if (!r || r.outcome.landed.length === 0) return null
  if (action === 'c') {
    if (r.outcome.failed.length > 0) {
      await queuePendingOverlaySend(data, { originId: r.originId, fanTargets: targets, remainingTargets: r.outcome.failed })
    } else {
      await clearPendingOverlaySend(data.id)
    }
  }
  return r.originId
}

export function sendFeatureVault(
  userId: string | null,
  activeClinicId: string | null,
  action: 'c' | 'u' | 'd',
  data: MapFeaturePayload,
  fanTo?: string[],
): Promise<string | null> {
  const content: MapFeatureContent = {
    type: 'map_feature',
    action: actionMap[action],
    data,
  }
  return fanOut(userId, resolveTargets(activeClinicId, fanTo, undefined, data.clinic_id), serializeContent(content), 'map feature')
}

let overlayDrainInflight: Promise<void> | null = null
let overlayDrainAgain = false

async function runOverlayDrain(): Promise<void> {
  const { user, clinicId, supervisingClinicId } = useAuthStore.getState()
  const activeClinicId = supervisingClinicId ?? clinicId
  const userId = user?.id ?? null
  if (!activeClinicId || !userId) return
  const pendingSends = await loadPendingOverlaySends()
  for (const item of pendingSends) {
    if (useAuthStore.getState().user?.id !== userId) return
    const stableOriginId = item.originId ?? crypto.randomUUID()
    if (!item.originId) await patchPendingOverlaySend(item, { originId: stableOriginId })
    const targets = item.fanTargets?.length
      ? item.fanTargets
      : resolveTargets(activeClinicId, undefined, item.overlay.target_clinic_ids, item.overlay.clinic_id)
    const fanNow = item.remainingTargets?.length ? item.remainingTargets : targets
    const content: MapOverlayContent = { type: 'map_overlay', action: 'create', data: item.overlay }
    const result = await fanOutDetailed(userId, fanNow, serializeContent(content), 'map overlay', stableOriginId)
    if (!result || result.outcome.landed.length === 0) continue
    const { originId, outcome } = result
    // If the overlay was deleted while this send was in flight, fan-out
    // a matching 'd' so the vault pair-cleans the freshly sent 'c' on
    // the next replay pass.
    if (getOverlayTombstones().has(item.id)) {
      sendOverlayVault(userId, activeClinicId, 'd', {
        id: item.id,
        ...(item.overlay.clinic_id && { clinic_id: item.overlay.clinic_id }),
        ...(item.overlay.target_clinic_ids && { target_clinic_ids: item.overlay.target_clinic_ids }),
      }, targets).catch(() => {})
      await clearPendingOverlaySend(item.id, item.queuedAt)
      continue
    }
    const allLanded = outcome.failed.length === 0
    const local = await getLocalMapOverlay(item.id)
    if (local) {
      await saveLocalMapOverlay({ ...local, originId, _sync_status: allLanded ? 'synced' : 'pending' })
      invalidate('mapOverlays')
    }
    if (allLanded) {
      await clearPendingOverlaySend(item.id, item.queuedAt)
    } else {
      await patchPendingOverlaySend(item, { originId, fanTargets: targets, remainingTargets: outcome.failed })
    }
  }
}

export function drainPendingOverlaySends(): Promise<void> {
  if (overlayDrainInflight) {
    overlayDrainAgain = true
    return overlayDrainInflight
  }
  overlayDrainInflight = (async () => {
    try {
      do {
        overlayDrainAgain = false
        await runOverlayDrain()
      } while (overlayDrainAgain)
    } catch (e) {
      logger.warn('Overlay vault drain failed:', e instanceof Error ? e.message : e)
    } finally {
      overlayDrainInflight = null
    }
  })()
  return overlayDrainInflight
}

// ---- Hook ----

interface UseMapOverlayVaultResult {
  /** True when the hook has enough context to send (clinic + userId + deviceId). */
  ready: boolean
  /**
   * Encrypt and send a map overlay action via Signal fan-out. Returns the
   * originId on success.
   *
   * Fan-out targets: `fanTo` when given (union of old + new targets on an
   * edit), else `data.target_clinic_ids`, else `data.clinic_id`, else the
   * active clinic. One originId shared across every cluster batch.
   */
  sendOverlay: (action: 'c' | 'u' | 'd', data: MapOverlayPayload, fanTo?: string[]) => Promise<string | null>
  /**
   * Per-feature sibling of sendOverlay — fans out a single OverlayFeature so
   * incremental edits don't re-encrypt the whole overlay for every recipient.
   * Returns the originId on success so callers can pair-clean a prior c/u for
   * the same feature when this one supersedes it.
   *
   * Fan-out targets: `fanTo` when given (the overlay's target_clinic_ids), else
   * `data.clinic_id`, else the active clinic.
   */
  sendFeature: (action: 'c' | 'u' | 'd', data: MapFeaturePayload, fanTo?: string[]) => Promise<string | null>
  /** Hard-delete vault messages by origin ID. Caller passes the clinic that owns the vault. */
  deleteOverlayMessages: (originIds: string[], clinicId: string) => Promise<void>
}

export function useMapOverlayVault(): UseMapOverlayVaultResult {
  const { clinicId, supervisingClinicId, user } = useAuth()
  // Mirror the calendar / messaging convention: when a supervisor is
  // operating-as a loan clinic, the vault fan-out must land on THAT clinic's
  // vault, not the home clinic. Callers that pass `data.clinic_id` win;
  // unscoped callers fall back to the active clinic.
  const activeClinicId = supervisingClinicId ?? clinicId
  const userId = user?.id ?? null

  const sendOverlay = useCallback((
    action: 'c' | 'u' | 'd',
    data: MapOverlayPayload,
    fanTo?: string[],
  ): Promise<string | null> => sendOverlayVault(userId, activeClinicId, action, data, fanTo), [userId, activeClinicId])

  const sendFeature = useCallback((
    action: 'c' | 'u' | 'd',
    data: MapFeaturePayload,
    fanTo?: string[],
  ): Promise<string | null> => sendFeatureVault(userId, activeClinicId, action, data, fanTo), [userId, activeClinicId])

  const deleteOverlayMessages = useCallback(async (originIds: string[], clinicId: string): Promise<void> => {
    if (originIds.length === 0 || !clinicId) return
    try {
      await supabase.rpc('hard_delete_clinic_vault_messages', {
        p_clinic_id: clinicId,
        p_origin_ids: originIds,
      })
    } catch (e) {
      logger.warn('Failed to delete vault overlay messages:', e instanceof Error ? e.message : e)
    }
  }, [])

  return {
    ready: !!activeClinicId && !!userId,
    sendOverlay,
    sendFeature,
    deleteOverlayMessages,
  }
}
