/**
 * useCalendarVault — Calendar-specific send/delete via Signal Protocol fan-out.
 *
 * Events are encrypted per-device via X3DH/Double Ratchet and fanned out as a
 * clinic self-message (recipient_id = clinicId) to all clinic devices: the vault
 * device plus each member's clinic-scoped device.
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
import type { CalendarEventContent, CalendarEventPayload } from '../lib/signal/messageContent'
import type { PeerDevice, FanOutMessageInput, PeerBundleRpcResult } from '../lib/signal/transportTypes'
import type { PublicKeyBundle } from '../lib/signal/types'
import type { CalendarEvent } from '../Types/CalendarTypes'
import { loadPendingVaultSends, clearPendingVaultSend } from '../lib/calendarEventStore'
import { getTombstones } from '../lib/calendarRouting'
import { useCalendarStore } from '../stores/useCalendarStore'

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

/**
 * Resolve the set of clinics an event should be distributed to:
 * {authoringClinicId} ∪ (each assignee's [home clinic, ...active loans]).
 *
 * The assignee membership sets come from get_user_clinic_sets (SECURITY DEFINER)
 * so co-assignees whose home/loan clinics fall outside the author's own
 * auth_clinic_ids() still resolve — a plain client-side join would hit RLS and
 * silently under-fan. The authoring clinic is always seeded so the author keeps
 * their own copy even when no assignee is a member of it.
 *
 * On failure (offline / RPC error) falls back to [authoringClinicId] — i.e. the
 * pre-cross-cluster single-clinic behavior — rather than dropping the send.
 */
export async function resolveTargetClinics(
  authoringClinicId: string | null | undefined,
  assignedTo: string[],
): Promise<string[]> {
  const set = new Set<string>()
  if (authoringClinicId) set.add(authoringClinicId)
  if (assignedTo.length > 0) {
    try {
      const { data, error } = await supabase.rpc('get_user_clinic_sets', { p_user_ids: assignedTo })
      if (error) {
        logger.warn('get_user_clinic_sets failed, falling back to authoring clinic only:', error.message)
      } else if (Array.isArray(data)) {
        for (const row of data as Array<{ clinic_id: string | null }>) {
          if (row.clinic_id) set.add(row.clinic_id)
        }
      }
    } catch (e) {
      logger.warn('resolveTargetClinics threw, falling back to authoring clinic only:', e instanceof Error ? e.message : e)
    }
  }
  return Array.from(set)
}

// ---- Hook ----

interface UseCalendarVaultResult {
  /** True when the hook has enough context to send (clinic + userId + deviceId). */
  ready: boolean
  /**
   * Encrypt and send a calendar event via Signal fan-out. Returns the originId on success.
   *
   * Fan-out targets (in priority order):
   *   1. `fanToClinics` when provided — the explicit clinic list to fan to.
   *      Used for edits/retracts where the fan set (union of old+new targets)
   *      differs from the payload's stamped `target_clinic_ids` (new targets).
   *   2. else `data.target_clinic_ids` when non-empty — the cross-cluster set.
   *   3. else `[data.clinic_id ?? clinicId]` — legacy single-clinic fallback.
   * The same originId is shared across every clinic batch.
   */
  sendEvent: (action: 'c' | 'u' | 'd', data: Partial<CalendarEvent> & { id: string }, fanToClinics?: string[]) => Promise<string | null>
  /** Hard-delete messages by origin ID. Caller passes the clinic that owns the vault. */
  deleteEvents: (originIds: string[], clinicId: string) => Promise<void>
}

export function useCalendarVault(): UseCalendarVaultResult {
  const { clinicId, user } = useAuth()
  const userId = user?.id ?? null

  const sendEvent = useCallback(async (
    action: 'c' | 'u' | 'd',
    data: Partial<CalendarEvent> & { id: string },
    fanToClinics?: string[],
  ): Promise<string | null> => {
    // Resolve the clinic set to fan to (see interface doc for priority order).
    const authoringClinic = (data.clinic_id as string | undefined) ?? clinicId
    const targetClinics = (fanToClinics && fanToClinics.length > 0)
      ? Array.from(new Set(fanToClinics))
      : (data.target_clinic_ids && data.target_clinic_ids.length > 0)
        ? Array.from(new Set(data.target_clinic_ids))
        : (authoringClinic ? [authoringClinic] : [])
    if (targetClinics.length === 0 || !userId) return null
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
    // ONE originId shared across every clinic batch, so the event's single
    // stored originId resolves hard-delete in any clinic that holds a copy.
    const originId = crypto.randomUUID()

    // Fan a self-contained batch into each target clinic's vault + member
    // devices. A failure in one clinic must not abort the rest, so each clinic
    // is tried independently; the send succeeds if at least one batch landed.
    let anySent = false
    for (const targetClinicId of targetClinics) {
      try {
        // Fetch all clinic devices (vault + member clinic devices)
        const devicesResult = await fetchPeerDevices(targetClinicId)
        if (!devicesResult.ok || devicesResult.data.length === 0) {
          logger.warn(`No clinic devices found for fan-out to ${targetClinicId}`)
          continue
        }

        // Drop any local session to a device that has left the registry, so we
        // never chain a ratchet to a dead device (its packets would be
        // undecryptable forever on the gone recipient). Safe: this fetch already
        // succeeded and is non-empty (guarded above).
        await pruneClinicSessions(targetClinicId, new Set(devicesResult.data.map(d => d.deviceId)))

        // Filter out our own clinic device — we don't send to ourselves.
        // The vault is a peer device that receives every action, including 'd':
        // a later snapshot pass materializes resolution and the watermark reap
        // removes the covered rows wholesale.
        const targetDevices = devicesResult.data.filter(d => d.deviceId !== clinicDeviceId)
        if (targetDevices.length === 0) continue

        // Encrypt for all clinic devices using clinic session context. Foreign
        // clinics (the author isn't a member of) seal fine — encryption uses
        // the recipients' public bundles, no membership/key needed by sender.
        const inputs = await encryptForAllClinicDevices(targetClinicId, targetDevices, serialized, userId)
        if (inputs.length > 0) {
          await sendMessageFanOut(userId, clinicDeviceId, targetClinicId, inputs, targetClinicId, originId, true)
          anySent = true
        }
      } catch (e) {
        logger.warn(`Failed to send calendar event to ${targetClinicId}:`, e instanceof Error ? e.message : e)
      }
    }

    return anySent ? originId : null
  }, [clinicId, userId])

  const deleteEvents = useCallback(async (originIds: string[], clinicId: string): Promise<void> => {
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
  }, [])

  // Drain pending vault sends on mount and whenever connectivity returns.
  // Events queued offline (e.g. algorithm metrics) are re-sent here.
  // Each pending event carries its own clinic_id, so sendEvent fans out to
  // the right vault.
  useEffect(() => {
    if (!clinicId || !userId) return
    const drain = async () => {
      const pendingSends = await loadPendingVaultSends()
      for (const item of pendingSends) {
        // Re-resolve cross-cluster targets here: the event may have been
        // enqueued offline, where resolveTargetClinics fell back to the
        // authoring clinic only. Now that we're online (drain runs on mount /
        // 'online'), resolve the full set so loaned-assignee events reach
        // every relevant clinic vault. Falls back to the event's own clinic
        // on RPC failure.
        const targets = await resolveTargetClinics(item.event.clinic_id, item.event.assigned_to ?? [])
        const stamped = { ...item.event, target_clinic_ids: targets }
        const originId = await sendEvent('c', stamped)
        if (originId) {
          // If the event was deleted while this send was in flight, fan-out
          // a matching 'd' to every target so each clinic tombstones it.
          if (getTombstones().has(item.id)) {
            sendEvent('d', { id: item.id, clinic_id: item.event.clinic_id, target_clinic_ids: targets }).catch(() => {})
            await clearPendingVaultSend(item.id)
          } else {
            await clearPendingVaultSend(item.id)
            useCalendarStore.getState().updateEvent(item.id, { originId, target_clinic_ids: targets })
          }
        }
      }
    }
    // Drain immediately — covers the case where app restarts while already online.
    drain()
    window.addEventListener('online', drain)
    return () => window.removeEventListener('online', drain)
  }, [sendEvent, clinicId, userId])

  return {
    ready: !!clinicId && !!userId,
    sendEvent,
    deleteEvents,
  }
}
