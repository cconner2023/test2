/**
 * useCalendarVault — Calendar-specific send/delete via Signal Protocol fan-out.
 *
 * Events are encrypted per-device via X3DH/Double Ratchet and fanned out to:
 * - The clinic vault device (canonical store, recipient_id = clinicId)
 * - Each clinic member's personal devices (recipient_id = member_user_id)
 *
 * This replaces the V1 symmetric AES approach with standard Signal infrastructure.
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
  hardDeleteByOriginId,
} from '../lib/signal/signalService'
import {
  createOutboundSession,
  encryptMessage,
  hasSession,
} from '../lib/signal/session'
import { serializeContent } from '../lib/signal/messageContent'
import type { CalendarEventContent, CalendarEventPayload } from '../lib/signal/messageContent'
import type { PeerDevice, FanOutMessageInput, PeerBundleRpcResult } from '../lib/signal/transportTypes'
import type { PublicKeyBundle } from '../lib/signal/types'
import { CLINIC_VAULT_DEVICE_ID } from '../lib/signal/clinicVaultDevice'
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

async function encryptForAllDevices(
  peerId: string,
  peerDevices: PeerDevice[],
  serialized: string,
  senderUuid: string,
): Promise<FanOutMessageInput[]> {
  const results: FanOutMessageInput[] = []
  for (const device of peerDevices) {
    try {
      const sessionExists = await hasSession(peerId, device.deviceId)
      if (!sessionExists) {
        const bundleResult = await fetchPeerBundleForDevice(peerId, device.deviceId)
        if (!bundleResult.ok) {
          logger.warn(`No bundle for ${peerId}:${device.deviceId}, skipping`)
          continue
        }
        const bundle = rpcResultToBundle(bundleResult.data)
        const sealedEnvelope = await createOutboundSession(peerId, device.deviceId, bundle, serialized, senderUuid)
        results.push({
          recipientDeviceId: device.deviceId,
          payload: sealedEnvelope as unknown as Record<string, unknown>,
          messageType: 'initial',
        })
      } else {
        const sealedEnvelope = await encryptMessage(peerId, device.deviceId, serialized, senderUuid)
        results.push({
          recipientDeviceId: device.deviceId,
          payload: sealedEnvelope as unknown as Record<string, unknown>,
          messageType: 'message',
        })
      }
    } catch (e) {
      logger.warn(`Failed to encrypt for ${peerId}:${device.deviceId}:`, e instanceof Error ? e.message : e)
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
    if (!localDeviceId) return null

    const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
    const content: CalendarEventContent = {
      type: 'calendar_event',
      action: actionMap[action],
      data: data as unknown as CalendarEventPayload,
    }
    const serialized = serializeContent(content)
    const originId = crypto.randomUUID()

    try {
      // 1. Encrypt for clinic vault device (canonical store)
      const vaultInputs = await encryptForAllDevices(
        clinicId,
        [{ deviceId: CLINIC_VAULT_DEVICE_ID } as PeerDevice],
        serialized,
        userId,
      )
      if (vaultInputs.length > 0) {
        await sendMessageFanOut(userId, localDeviceId, clinicId, vaultInputs, clinicId, originId, true)
      }

      // 2. Encrypt for each clinic member's personal devices
      const { data: members } = await supabase
        .from('profiles')
        .select('id')
        .eq('clinic_id', clinicId)

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.id === userId) continue // Skip self — we route locally
          const devicesResult = await fetchPeerDevices(member.id)
          if (!devicesResult.ok || devicesResult.data.length === 0) continue

          const memberInputs = await encryptForAllDevices(
            member.id,
            devicesResult.data,
            serialized,
            userId,
          )
          if (memberInputs.length > 0) {
            await sendMessageFanOut(userId, localDeviceId, member.id, memberInputs, clinicId, originId, true)
          }
        }
      }

      return originId
    } catch (e) {
      logger.warn('Failed to send calendar event:', e instanceof Error ? e.message : e)
      return null
    }
  }, [clinicId, userId])

  const deleteEvents = useCallback(async (originIds: string[]): Promise<void> => {
    if (originIds.length === 0) return
    try {
      await hardDeleteByOriginId(originIds)
    } catch (e) {
      logger.warn('Failed to delete vault messages:', e instanceof Error ? e.message : e)
    }
  }, [])

  return {
    ready: !!clinicId && !!userId,
    sendEvent,
    deleteEvents,
  }
}
