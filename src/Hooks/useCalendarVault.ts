/**
 * useCalendarVault — Calendar-specific send/delete via Signal Protocol fan-out.
 *
 * Events are encrypted per-device via X3DH/Double Ratchet and fanned out as a
 * clinic self-message (recipient_id = clinicId) to all clinic devices: the vault
 * device plus each member's clinic-scoped device.
 */

import { useCallback } from 'react'
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
} from '../lib/signal/clinicSession'
import { serializeContent } from '../lib/signal/messageContent'
import type { CalendarEventContent, CalendarEventPayload } from '../lib/signal/messageContent'
import type { PeerDevice, FanOutMessageInput, PeerBundleRpcResult } from '../lib/signal/transportTypes'
import type { PublicKeyBundle } from '../lib/signal/types'
import type { CalendarEvent } from '../Types/CalendarTypes'

const logger = createLogger('CalendarVault')

// ---- Helpers (same pattern as useMessages.ts) ----

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

interface UseCalendarVaultResult {
  /** True when the hook has enough context to send (clinicId + userId + deviceId). */
  ready: boolean
  /** Encrypt and send a calendar event via Signal fan-out. Returns the originId on success. */
  sendEvent: (action: 'c' | 'u' | 'd', data: Partial<CalendarEvent> & { id: string }) => Promise<string | null>
  /** Hard-delete messages by origin ID. */
  deleteEvents: (originIds: string[]) => Promise<void>
}

export function useCalendarVault(): UseCalendarVaultResult {
  const { clinicId, user } = useAuth()
  const userId = user?.id ?? null

  const sendEvent = useCallback(async (
    action: 'c' | 'u' | 'd',
    data: Partial<CalendarEvent> & { id: string },
  ): Promise<string | null> => {
    if (!clinicId || !userId) return null
    const localDeviceId = useMessagingStore.getState().localDeviceId
    const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
    if (!localDeviceId || !clinicDeviceId) return null

    const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
    const content: CalendarEventContent = {
      type: 'calendar_event',
      action: actionMap[action],
      data: data as unknown as CalendarEventPayload,
    }
    const serialized = serializeContent(content)
    const originId = crypto.randomUUID()

    try {
      // Fetch all clinic devices (vault + member clinic devices)
      const devicesResult = await fetchPeerDevices(clinicId)
      if (!devicesResult.ok || devicesResult.data.length === 0) {
        logger.warn('No clinic devices found for fan-out')
        return null
      }

      // Filter out our own clinic device — we don't send to ourselves.
      // Also skip the vault for delete actions: the original create/update is already
      // hard-deleted from Supabase, so the vault has nothing to replay and needs no tombstone.
      const targetDevices = devicesResult.data.filter(d => {
        if (d.deviceId === clinicDeviceId) return false
        if (action === 'd' && d.deviceId === 'vault') return false
        return true
      })
      if (targetDevices.length === 0) {
        logger.warn('No target clinic devices for fan-out (only self)')
        return null
      }

      // Encrypt for all clinic devices using clinic session context
      const inputs = await encryptForAllClinicDevices(clinicId, targetDevices, serialized, userId)
      if (inputs.length > 0) {
        await sendMessageFanOut(userId, clinicDeviceId, clinicId, inputs, clinicId, originId, true)
      }

      return originId
    } catch (e) {
      logger.warn('Failed to send calendar event:', e instanceof Error ? e.message : e)
      return null
    }
  }, [clinicId, userId])

  const deleteEvents = useCallback(async (originIds: string[]): Promise<void> => {
    if (originIds.length === 0 || !clinicId) return
    try {
      // All copies are under recipient_id = clinicId
      await supabase.rpc('hard_delete_clinic_vault_messages', {
        p_clinic_id: clinicId,
        p_origin_ids: originIds,
      })
    } catch (e) {
      logger.warn('Failed to delete vault messages:', e instanceof Error ? e.message : e)
    }
  }, [clinicId])

  return {
    ready: !!clinicId && !!userId,
    sendEvent,
    deleteEvents,
  }
}
