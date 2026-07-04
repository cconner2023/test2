/**
 * echelonVault — child→parent readiness-summary fan-out via the Signal clinic
 * vault. Non-hook module (callable from the activity heartbeat). Mirrors
 * propertyVault.sendPropertyEvent / useCalendarVault.sendEvent: the summary is
 * sealed once per PARENT-clinic device (the vault peer + each parent member's
 * clinic device) using the parent's PUBLIC bundle — no membership in the parent
 * vault and no shared key, the same no-transport-barrier the cross-cluster
 * calendar/loan fan-out established.
 *
 * DOWNTRACE TRIGGER: the CHILD computes and fans on its own activity heartbeat.
 * recipient_id = the parent clinic id, so the parent reads it from its OWN vault
 * (parent clinic id ∈ the parent's auth_clinic_ids) — the parent never reads
 * another cluster's messages. One echelon hop per publish (child → its parent).
 *
 * NO PHI: the payload is EchelonReadinessSummary (percentages + counts only).
 * Signal fns are called IN A LOOP only — this is not a signal/* refactor.
 */

import { supabase } from './supabase'
import { useMessagingStore } from '../stores/useMessagingStore'
import { createLogger } from '../Utilities/Logger'
import { computeReadinessSummary } from './echelonService'
import { summaryValueKey, type EchelonReadinessSummary } from './echelonSummary'
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
import type { ReadinessSummaryContent } from './signal/messageContent'
import type { PeerDevice, FanOutMessageInput, PeerBundleRpcResult } from './signal/transportTypes'
import type { PublicKeyBundle } from './signal/types'

const logger = createLogger('echelonVault')

/** localStorage key holding the last-fanned summaryValueKey for a source clinic. */
const lastFanKey = (clinicId: string) => `adtmc_echelon_last_fan_${clinicId}`

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

/** Seal `serialized` for every device of the parent clinic (mirrors propertyVault). */
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
          logger.warn(`No bundle for parent clinic device ${clinicId}:${device.deviceId}, skipping`)
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
      logger.warn(`Failed to encrypt for parent clinic device ${clinicId}:${device.deviceId}:`, e instanceof Error ? e.message : e)
    }
  }
  return results
}

/**
 * Fan one readiness summary to the parent clinic vault. Returns true if any
 * envelope was sent. Best-effort: offline / no parent devices / no local clinic
 * device → returns false and the caller leaves the change-detect memo untouched
 * so the next tick retries.
 */
export async function fanReadinessSummary(
  userId: string,
  parentClinicId: string,
  summary: EchelonReadinessSummary,
): Promise<boolean> {
  const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
  if (!clinicDeviceId) return false

  const content: ReadinessSummaryContent = { type: 'readiness_summary', data: summary }
  const serialized = serializeContent(content)
  const originId = crypto.randomUUID()

  try {
    const devicesResult = await fetchPeerDevices(parentClinicId)
    if (!devicesResult.ok || devicesResult.data.length === 0) {
      logger.warn(`No clinic devices for echelon fan-out to parent ${parentClinicId}`)
      return false
    }
    await pruneClinicSessions(parentClinicId, new Set(devicesResult.data.map((d) => d.deviceId)))
    const targetDevices = devicesResult.data.filter((d) => d.deviceId !== clinicDeviceId)
    if (targetDevices.length === 0) return false
    const inputs = await encryptForAllClinicDevices(parentClinicId, targetDevices, serialized, userId)
    if (inputs.length === 0) return false
    await sendMessageFanOut(userId, clinicDeviceId, parentClinicId, inputs, parentClinicId, originId, true)
    return true
  } catch (e) {
    logger.warn(`Failed to fan readiness summary to parent ${parentClinicId}:`, e instanceof Error ? e.message : e)
    return false
  }
}

/**
 * Full publish path for a child clinic (the heartbeat entry point):
 *   1. look up the clinic's parent — none → skip (top of tree)
 *   2. computeReadinessSummary — null (no active users) → skip
 *   3. change-detect vs the last-fanned value key — unchanged → skip the fan
 *   4. fan to the parent vault; memo the value key only on a confirmed send
 *
 * Fire-and-forget; every failure path is a silent skip that retries next tick.
 */
export async function publishReadinessSummary(userId: string, ownClinicId: string): Promise<void> {
  try {
    const { data: clinicRow, error } = await supabase
      .from('clinics')
      .select('parent_clinic_id')
      .eq('id', ownClinicId)
      .single()
    if (error || !clinicRow?.parent_clinic_id) return
    const parentClinicId = clinicRow.parent_clinic_id as string

    const summary = await computeReadinessSummary(ownClinicId, parentClinicId)
    if (!summary) return

    const key = summaryValueKey(summary)
    if (localStorage.getItem(lastFanKey(ownClinicId)) === key) return

    const sent = await fanReadinessSummary(userId, parentClinicId, summary)
    if (sent) localStorage.setItem(lastFanKey(ownClinicId), key)
  } catch (e) {
    logger.warn('publishReadinessSummary threw:', e instanceof Error ? e.message : e)
  }
}
