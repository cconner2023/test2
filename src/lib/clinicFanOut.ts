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
import type { PeerDevice, FanOutMessageInput, PeerBundleRpcResult } from './signal/transportTypes'
import type { PublicKeyBundle } from './signal/types'

const logger = createLogger('ClinicFanOut')

export function rpcResultToBundle(rpc: PeerBundleRpcResult): PublicKeyBundle {
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

export async function encryptForAllClinicDevices(
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

export interface FanOutOutcome {
  landed: string[]
  failed: string[]
}

export async function fanOutToClinics(
  userId: string,
  clinicDeviceId: string,
  targetClinics: string[],
  serialized: string,
  originId: string,
  what: string,
): Promise<FanOutOutcome> {
  const landed: string[] = []
  const failed: string[] = []
  for (const targetClinicId of targetClinics) {
    try {
      const devicesResult = await fetchPeerDevices(targetClinicId)
      if (!devicesResult.ok || devicesResult.data.length === 0) {
        logger.warn(`No clinic devices found for ${what} fan-out to ${targetClinicId}`)
        failed.push(targetClinicId)
        continue
      }
      await pruneClinicSessions(targetClinicId, new Set(devicesResult.data.map(d => d.deviceId)))
      const targetDevices = devicesResult.data.filter(d => d.deviceId !== clinicDeviceId)
      if (targetDevices.length === 0) continue
      const inputs = await encryptForAllClinicDevices(targetClinicId, targetDevices, serialized, userId)
      if (inputs.length === 0) {
        failed.push(targetClinicId)
        continue
      }
      const res = await sendMessageFanOut(userId, clinicDeviceId, targetClinicId, inputs, targetClinicId, originId, true)
      if (res.ok) {
        landed.push(targetClinicId)
      } else {
        logger.warn(`Fan-out of ${what} to ${targetClinicId} failed:`, res.error)
        failed.push(targetClinicId)
      }
    } catch (e) {
      logger.warn(`Failed to send ${what} to ${targetClinicId}:`, e instanceof Error ? e.message : e)
      failed.push(targetClinicId)
    }
  }
  return { landed, failed }
}
