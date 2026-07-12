/**
 * propertyVault — property fan-out via Signal Protocol clinic-vault.
 *
 * Non-hook module (callable from propertyService) mirroring useCalendarVault's
 * sendEvent / resolveTargetClinics. Property entities are encrypted per-device
 * via X3DH/Double Ratchet and fanned out to every device of each target clinic
 * (the vault peer + each member's clinic device), so a delete is a durable
 * per-device envelope consumed on drain, and the assignment follows the holder
 * across clusters.
 *
 * Device ids are read from useMessagingStore.getState() (no React needed);
 * userId is passed by the caller (propertyService already threads it).
 */

import { supabase } from './supabase'
import { useMessagingStore } from '../stores/useMessagingStore'
import { createLogger } from '../Utilities/Logger'
import {
  fetchPeerDevices,
  sendMessageFanOut,
  fetchPeerBundleForDevice,
} from './signal/signalService'
import {
  hasClinicSession,
  createClinicOutboundSession,
  encryptClinicMessage,
  deleteClinicSession,
  pruneClinicSessions,
} from './signal/clinicSession'
import { serializeContent } from './signal/messageContent'
import type { PropertyEventContent, PropertyEventPayload, PropertyEntity } from './signal/messageContent'
import type { PeerDevice, FanOutMessageInput, PeerBundleRpcResult } from './signal/transportTypes'
import type { PublicKeyBundle } from './signal/types'

const logger = createLogger('PropertyVault')

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
        results.push({ recipientDeviceId: device.deviceId, payload: sealedEnvelope as unknown as Record<string, unknown>, messageType: 'initial' })
      } else {
        const sealedEnvelope = await encryptClinicMessage(clinicId, device.deviceId, serialized, senderUuid)
        results.push({ recipientDeviceId: device.deviceId, payload: sealedEnvelope as unknown as Record<string, unknown>, messageType: 'message' })
      }
    } catch (e) {
      logger.warn(`Failed to encrypt for clinic device ${clinicId}:${device.deviceId}:`, e instanceof Error ? e.message : e)
    }
  }
  return results
}

/**
 * Resolve the set of clinics a property entity should be distributed to:
 * {authoringClinicId} ∪ (each holder's [home clinic, ...active loans]).
 *
 * holderIds come from current_holder_id (items) / from+to_holder_id (custody).
 * Membership sets resolve via get_user_clinic_sets (SECURITY DEFINER) so a
 * holder whose home/loan clinics fall outside the author's auth_clinic_ids()
 * still resolves. On failure falls back to [authoringClinicId].
 */
export async function resolvePropertyTargetClinics(
  authoringClinicId: string | null | undefined,
  holderIds: string[],
): Promise<string[]> {
  const set = new Set<string>()
  if (authoringClinicId) set.add(authoringClinicId)
  const ids = holderIds.filter(Boolean)
  if (ids.length > 0) {
    try {
      const { data, error } = await supabase.rpc('get_user_clinic_sets', { p_user_ids: ids })
      if (error) {
        logger.warn('get_user_clinic_sets failed, falling back to authoring clinic only:', error.message)
      } else if (Array.isArray(data)) {
        for (const row of data as Array<{ clinic_id: string | null }>) {
          if (row.clinic_id) set.add(row.clinic_id)
        }
      }
    } catch (e) {
      logger.warn('resolvePropertyTargetClinics threw, falling back to authoring clinic only:', e instanceof Error ? e.message : e)
    }
  }
  return Array.from(set)
}

/**
 * Encrypt and fan out a property entity via Signal clinic-vault fan-out.
 * Returns the originId on success (the same id stored on the local row + spine),
 * or null when nothing was sent (offline / no devices / no targets).
 *
 * Fan-out targets (priority): fanToClinics > data.target_clinic_ids > [data.clinic_id].
 * The originId is taken from data.originId (caller pre-stamps it so the local
 * projection, the spine row, and the envelope all carry the same id), else generated.
 */
export async function sendPropertyEvent(
  userId: string | null,
  action: 'c' | 'u' | 'd',
  entity: PropertyEntity,
  data: PropertyEventPayload,
  fanToClinics?: string[],
): Promise<string | null> {
  const targetClinics = (fanToClinics && fanToClinics.length > 0)
    ? Array.from(new Set(fanToClinics))
    : (data.target_clinic_ids && data.target_clinic_ids.length > 0)
      ? Array.from(new Set(data.target_clinic_ids))
      : (data.clinic_id ? [data.clinic_id] : [])
  if (targetClinics.length === 0 || !userId) return null

  const localDeviceId = useMessagingStore.getState().localDeviceId
  const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
  if (!localDeviceId || !clinicDeviceId) return null

  const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
  const content: PropertyEventContent = { type: 'property_event', action: actionMap[action], entity, data }
  const serialized = serializeContent(content)
  const originId = data.originId ?? crypto.randomUUID()

  let anySent = false
  for (const targetClinicId of targetClinics) {
    try {
      const devicesResult = await fetchPeerDevices(targetClinicId)
      if (!devicesResult.ok || devicesResult.data.length === 0) {
        logger.warn(`No clinic devices for property fan-out to ${targetClinicId}`)
        continue
      }
      await pruneClinicSessions(targetClinicId, new Set(devicesResult.data.map(d => d.deviceId)))
      const targetDevices = devicesResult.data.filter(d => d.deviceId !== clinicDeviceId)
      if (targetDevices.length === 0) continue
      const inputs = await encryptForAllClinicDevices(targetClinicId, targetDevices, serialized, userId)
      if (inputs.length > 0) {
        await sendMessageFanOut(userId, clinicDeviceId, targetClinicId, inputs, targetClinicId, originId, true)
        anySent = true
      }
    } catch (e) {
      logger.warn(`Failed to send property event to ${targetClinicId}:`, e instanceof Error ? e.message : e)
    }
  }
  return anySent ? originId : null
}

/** One entity to fan out in a coalesced batch. payload.originId is pre-stamped by the
 *  caller so the local row, spine, and envelope share the id (same contract as sendPropertyEvent). */
export interface PropertyBatchEvent {
  action: 'c' | 'u' | 'd'
  entity: PropertyEntity
  payload: PropertyEventPayload
}

/**
 * Coalesced fan-out for many property entities authored in ONE operation (CSV import).
 *
 * Same wire format as sendPropertyEvent — still N independent per-entity vault messages,
 * so the receiver drain / replay is unchanged — but the per-clinic device fetch + session
 * prune happen ONCE per clinic instead of once per entity, and the network sends run
 * concurrently. Encryption stays SEQUENTIAL per clinic: the Double Ratchet is stateful, so
 * two entities' encrypts against the same clinic session must not interleave. Only the
 * post-encrypt sendMessageFanOut inserts (pure DB writes) are parallelized.
 *
 * Returns the set of originIds that reached ≥1 device — the caller queues the rest for the
 * reconnect drain (mirrors fanProperty's queuePendingPropertySend fallback).
 */
export async function sendPropertyEventsBatch(
  userId: string | null,
  events: PropertyBatchEvent[],
): Promise<Set<string>> {
  const sentOriginIds = new Set<string>()
  if (!userId || events.length === 0) return sentOriginIds

  const localDeviceId = useMessagingStore.getState().localDeviceId
  const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
  if (!localDeviceId || !clinicDeviceId) return sentOriginIds

  const actionMap = { c: 'create', u: 'update', d: 'delete' } as const

  // Serialize + stamp originId once per event; resolve its target clinics (same priority as
  // sendPropertyEvent: target_clinic_ids > clinic_id).
  interface Prepared { originId: string; serialized: string; clinics: string[] }
  const prepared: Prepared[] = events.map(ev => {
    const content: PropertyEventContent = {
      type: 'property_event', action: actionMap[ev.action], entity: ev.entity, data: ev.payload,
    }
    const clinics = (ev.payload.target_clinic_ids && ev.payload.target_clinic_ids.length > 0)
      ? Array.from(new Set(ev.payload.target_clinic_ids))
      : (ev.payload.clinic_id ? [ev.payload.clinic_id] : [])
    return { originId: ev.payload.originId ?? crypto.randomUUID(), serialized: serializeContent(content), clinics }
  })

  // Group by clinic so the device fetch + prune are paid once per clinic, not once per event.
  const byClinic = new Map<string, Prepared[]>()
  for (const p of prepared) {
    for (const c of p.clinics) {
      const arr = byClinic.get(c)
      if (arr) arr.push(p)
      else byClinic.set(c, [p])
    }
  }

  for (const [targetClinicId, clinicEvents] of byClinic) {
    try {
      const devicesResult = await fetchPeerDevices(targetClinicId)
      if (!devicesResult.ok || devicesResult.data.length === 0) {
        logger.warn(`No clinic devices for property batch fan-out to ${targetClinicId}`)
        continue
      }
      await pruneClinicSessions(targetClinicId, new Set(devicesResult.data.map(d => d.deviceId)))
      const targetDevices = devicesResult.data.filter(d => d.deviceId !== clinicDeviceId)
      if (targetDevices.length === 0) continue

      // Encrypt SEQUENTIALLY (ratchet is stateful), collect the network sends, then await them
      // together — the sends only insert already-sealed envelopes, so they're safe to parallelize.
      const sends: Promise<{ originId: string; ok: boolean }>[] = []
      for (const p of clinicEvents) {
        const inputs = await encryptForAllClinicDevices(targetClinicId, targetDevices, p.serialized, userId)
        if (inputs.length === 0) continue
        sends.push(
          sendMessageFanOut(userId, clinicDeviceId, targetClinicId, inputs, targetClinicId, p.originId, true)
            .then(res => ({ originId: p.originId, ok: res.ok }))
            .catch(() => ({ originId: p.originId, ok: false })),
        )
      }
      for (const r of await Promise.all(sends)) if (r.ok) sentOriginIds.add(r.originId)
    } catch (e) {
      logger.warn(`Failed property batch fan-out to ${targetClinicId}:`, e instanceof Error ? e.message : e)
    }
  }
  return sentOriginIds
}

/** Hard-delete vault messages by origin id (used on retract to drop the old fan-out). */
export async function deletePropertyVaultMessages(originIds: string[], clinicId: string): Promise<void> {
  if (originIds.length === 0 || !clinicId) return
  try {
    await supabase.rpc('hard_delete_clinic_vault_messages', { p_clinic_id: clinicId, p_origin_ids: originIds })
  } catch (e) {
    logger.warn('Failed to delete property vault messages:', e instanceof Error ? e.message : e)
  }
}
