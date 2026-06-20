/**
 * useMapOverlayVault — Map overlay send/delete via Signal Protocol fan-out.
 *
 * Mirrors useCalendarVault. Overlays are encrypted per-device via X3DH/
 * Double Ratchet and fanned out as a clinic self-message
 * (recipient_id = clinicId) to all clinic devices — the vault device plus
 * each member's clinic-scoped device.
 */

import { useCallback, useEffect } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { useMessagingStore } from '../stores/useMessagingStore'
import { createLogger } from '../Utilities/Logger'
import {
  fetchPeerDevices,
  sendMessageFanOut,
  fetchPeerBundleForDevice,
} from '../lib/signal/signalService'
import {
  hasClinicSession,
  createClinicOutboundSession,
  encryptClinicMessage,
  deleteClinicSession,
  pruneClinicSessions,
} from '../lib/signal/clinicSession'
import { serializeContent } from '../lib/signal/messageContent'
import type { MapOverlayContent, MapOverlayPayload, MapFeatureContent, MapFeaturePayload } from '../lib/signal/messageContent'
import type { PeerDevice, FanOutMessageInput, PeerBundleRpcResult } from '../lib/signal/transportTypes'
import type { PublicKeyBundle } from '../lib/signal/types'
import {
  loadPendingOverlaySends,
  clearPendingOverlaySend,
} from '../lib/mapOverlayEventStore'
import { getOverlayTombstones } from '../lib/mapOverlayRouting'

const logger = createLogger('MapOverlayVault')

// ---- Helpers (same pattern as useCalendarVault) ----

function rpcResultToBundle(rpc: PeerBundleRpcResult): PublicKeyBundle {
  return {
    userId: rpc.userId,
    deviceId: rpc.deviceId,
    identitySigningKey: rpc.identitySigningKey,
    identityDhKey: rpc.identityDhKey,
    signedPreKey: {
      keyId: rpc.signedPreKeyId,
      publicKey: rpc.signedPreKey,
      signature: rpc.signedPreKeySig,
    },
    oneTimePreKeys: rpc.oneTimePreKey ? [rpc.oneTimePreKey] : [],
  }
}

async function encryptForAllClinicDevices(
  clinicId: string,
  peerDevices: PeerDevice[],
  serialized: string,
  senderUuid: string,
): Promise<FanOutMessageInput[]> {
  const results: FanOutMessageInput[] = []
  for (const device of peerDevices) {
    try {
      // Force fresh X3DH for vault device — each vault message must be
      // independently decryptable so hard-deletes don't break session chains.
      if (device.deviceId === 'vault') {
        await deleteClinicSession(clinicId, 'vault')
      }
      const sessionExists = await hasClinicSession(clinicId, device.deviceId)
      if (!sessionExists) {
        const bundleResult = await fetchPeerBundleForDevice(clinicId, device.deviceId)
        if (!bundleResult.ok) {
          logger.warn(`No bundle for clinic device ${clinicId}:${device.deviceId}, skipping`)
          continue
        }
        const bundle = rpcResultToBundle(bundleResult.data)
        const sealedEnvelope = await createClinicOutboundSession(clinicId, device.deviceId, bundle, serialized, senderUuid)
        results.push({
          recipientDeviceId: device.deviceId,
          payload: sealedEnvelope as unknown as Record<string, unknown>,
          messageType: 'initial',
        })
      } else {
        const sealedEnvelope = await encryptClinicMessage(clinicId, device.deviceId, serialized, senderUuid)
        results.push({
          recipientDeviceId: device.deviceId,
          payload: sealedEnvelope as unknown as Record<string, unknown>,
          messageType: 'message',
        })
      }
    } catch (e) {
      logger.warn(`Failed to encrypt for clinic device ${clinicId}:${device.deviceId}:`, e instanceof Error ? e.message : e)
    }
  }
  return results
}

// ---- Hook ----

interface UseMapOverlayVaultResult {
  /** True when the hook has enough context to send (clinic + userId + deviceId). */
  ready: boolean
  /**
   * Encrypt and send a map overlay action via Signal fan-out. Returns the
   * originId on success.
   *
   * The fan-out target clinic is `data.clinic_id` when present; otherwise
   * falls back to the user's assigned `clinic_id`.
   */
  sendOverlay: (action: 'c' | 'u' | 'd', data: MapOverlayPayload) => Promise<string | null>
  /**
   * Per-feature sibling of sendOverlay — fans out a single OverlayFeature so
   * incremental edits don't re-encrypt the whole overlay for every recipient.
   * Returns the originId on success so callers can pair-clean a prior c/u for
   * the same feature when this one supersedes it.
   *
   * The fan-out target clinic is `data.clinic_id` when present; otherwise
   * falls back to the user's assigned (or supervising) clinic.
   */
  sendFeature: (action: 'c' | 'u' | 'd', data: MapFeaturePayload) => Promise<string | null>
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

  const sendOverlay = useCallback(async (
    action: 'c' | 'u' | 'd',
    data: MapOverlayPayload,
  ): Promise<string | null> => {
    const targetClinicId = data.clinic_id ?? activeClinicId
    if (!targetClinicId || !userId) return null
    const localDeviceId = useMessagingStore.getState().localDeviceId
    const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
    if (!localDeviceId || !clinicDeviceId) return null

    const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
    const content: MapOverlayContent = {
      type: 'map_overlay',
      action: actionMap[action],
      data,
    }
    const serialized = serializeContent(content)
    const originId = crypto.randomUUID()

    try {
      const devicesResult = await fetchPeerDevices(targetClinicId)
      if (!devicesResult.ok || devicesResult.data.length === 0) {
        logger.warn('No clinic devices found for fan-out')
        return null
      }

      // Never chain a ratchet to a dead device — drop sessions to any device
      // that has left the registry before fanning out (fetch already succeeded
      // and is non-empty, guarded above).
      await pruneClinicSessions(targetClinicId, new Set(devicesResult.data.map(d => d.deviceId)))

      // Filter out our own clinic device — we don't send to ourselves.
      // The vault is a peer device that receives every action, including 'd':
      // cooperative cleanup during processClinicVaultMessages pairs 'c'/'d'
      // by overlay_id and hard-deletes the pair from signal_messages.
      const targetDevices = devicesResult.data.filter(d => d.deviceId !== clinicDeviceId)
      if (targetDevices.length === 0) {
        logger.warn('No target clinic devices for fan-out (only self)')
        return null
      }

      const inputs = await encryptForAllClinicDevices(targetClinicId, targetDevices, serialized, userId)
      if (inputs.length > 0) {
        await sendMessageFanOut(userId, clinicDeviceId, targetClinicId, inputs, targetClinicId, originId, true)
      }

      return originId
    } catch (e) {
      logger.warn('Failed to send map overlay:', e instanceof Error ? e.message : e)
      return null
    }
  }, [activeClinicId, userId])

  const sendFeature = useCallback(async (
    action: 'c' | 'u' | 'd',
    data: MapFeaturePayload,
  ): Promise<string | null> => {
    const targetClinicId = data.clinic_id ?? activeClinicId
    if (!targetClinicId || !userId) return null
    const localDeviceId = useMessagingStore.getState().localDeviceId
    const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
    if (!localDeviceId || !clinicDeviceId) return null

    const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
    const content: MapFeatureContent = {
      type: 'map_feature',
      action: actionMap[action],
      data,
    }
    const serialized = serializeContent(content)
    const originId = crypto.randomUUID()

    try {
      const devicesResult = await fetchPeerDevices(targetClinicId)
      if (!devicesResult.ok || devicesResult.data.length === 0) {
        logger.warn('No clinic devices found for feature fan-out')
        return null
      }

      // Drop sessions to deregistered devices, then self-filter (as sendOverlay).
      await pruneClinicSessions(targetClinicId, new Set(devicesResult.data.map(d => d.deviceId)))
      const targetDevices = devicesResult.data.filter(d => d.deviceId !== clinicDeviceId)
      if (targetDevices.length === 0) {
        logger.warn('No target clinic devices for feature fan-out (only self)')
        return null
      }

      const inputs = await encryptForAllClinicDevices(targetClinicId, targetDevices, serialized, userId)
      if (inputs.length > 0) {
        await sendMessageFanOut(userId, clinicDeviceId, targetClinicId, inputs, targetClinicId, originId, true)
      }

      return originId
    } catch (e) {
      logger.warn('Failed to send map feature:', e instanceof Error ? e.message : e)
      return null
    }
  }, [activeClinicId, userId])

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

  // Drain pending vault sends on mount and whenever connectivity returns.
  // Overlays queued offline are re-sent here.
  useEffect(() => {
    if (!activeClinicId || !userId) return
    const drain = async () => {
      const pendingSends = await loadPendingOverlaySends()
      for (const item of pendingSends) {
        const originId = await sendOverlay('c', item.overlay)
        if (originId) {
          // If the overlay was deleted while this send was in flight, fan-out
          // a matching 'd' so the vault pair-cleans the freshly sent 'c' on
          // the next replay pass.
          if (getOverlayTombstones().has(item.id)) {
            sendOverlay('d', { id: item.id, ...(item.overlay.clinic_id && { clinic_id: item.overlay.clinic_id }) }).catch(() => {})
          }
          await clearPendingOverlaySend(item.id)
        }
      }
    }
    drain()
    window.addEventListener('online', drain)
    return () => window.removeEventListener('online', drain)
  }, [sendOverlay, activeClinicId, userId])

  return {
    ready: !!activeClinicId && !!userId,
    sendOverlay,
    sendFeature,
    deleteOverlayMessages,
  }
}
