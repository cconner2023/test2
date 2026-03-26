/**
 * Clinic device bundle initialization — called on sign-in for clinic members.
 *
 * Generates clinic device identity, pre-keys, signed pre-key, uploads the
 * public bundle, and registers the device under the clinic's user_id.
 */

import { createLogger } from '../../Utilities/Logger'
import { SIGNAL } from '../constants'
import {
  ensureClinicDeviceIdentity,
  generateClinicPreKeys,
  generateClinicSignedPreKey,
  assembleClinicBundle,
  getClinicPreKeyCount,
  makeClinicDeviceId,
} from './clinicKeyManager'
import { loadLatestSignedPreKey } from './clinicKeyStore'
import { uploadKeyBundle, registerDevice, fetchPeerDevices, unregisterDevice, deleteKeyBundle } from './signalService'
import { supabase } from '../supabase'

const logger = createLogger('ClinicDeviceInit')

export interface ClinicDeviceInitResult {
  clinicDeviceId: string
}

/**
 * Initialize the clinic device bundle for a clinic member.
 *
 * Idempotent: reuses existing identity/keys if present,
 * generates missing ones, and ensures server registration.
 */
export async function initClinicDeviceBundle(
  userId: string,
  clinicId: string,
  personalDeviceId: string,
): Promise<ClinicDeviceInitResult> {
  const clinicDeviceId = makeClinicDeviceId(userId, personalDeviceId)

  logger.info(`Initializing clinic device bundle: ${clinicDeviceId}`)

  // 1. Ensure clinic device identity exists
  await ensureClinicDeviceIdentity(userId, clinicId, personalDeviceId)

  // 2. Generate/check signed pre-key
  const existingSpk = await loadLatestSignedPreKey()
  if (!existingSpk) {
    await generateClinicSignedPreKey()
  } else {
    // Rotate if expired
    const ageMs = Date.now() - new Date(existingSpk.createdAt).getTime()
    const maxAgeMs = SIGNAL.SIGNED_PREKEY_ROTATION_DAYS * 24 * 60 * 60 * 1000
    if (ageMs >= maxAgeMs) {
      await generateClinicSignedPreKey()
    }
  }

  // 3. Generate pre-keys if needed
  const preKeyCount = await getClinicPreKeyCount()
  if (preKeyCount < Math.floor(SIGNAL.PREKEY_BATCH_SIZE / 2)) {
    const needed = SIGNAL.PREKEY_BATCH_SIZE - preKeyCount
    await generateClinicPreKeys(needed)
  }

  // 4. Assemble and upload public bundle
  const bundle = await assembleClinicBundle(clinicId, userId, personalDeviceId)
  if (bundle) {
    const uploadResult = await uploadKeyBundle(bundle)
    if (!uploadResult.ok) {
      logger.warn('Failed to upload clinic device bundle:', uploadResult.error)
    }
  }

  // 5. Register device under clinic's user_id (direct upsert, not RPC)
  const registerResult = await registerDevice(clinicId, clinicDeviceId, 'Clinic Device')
  if (!registerResult.ok) {
    logger.warn('Failed to register clinic device:', registerResult.error)
  }

  logger.info(`Clinic device bundle initialized: ${clinicDeviceId}`)
  return { clinicDeviceId }
}

/**
 * Prune stale clinic device registrations, key bundles, and orphaned messages.
 *
 * Each login cycle generates a new personal device ID → new clinic device ID.
 * Without cleanup, dead devices accumulate and the send path wastes time
 * trying to encrypt for devices whose keys no longer exist.
 *
 * Keeps the vault device and the caller's own clinic device.
 * Deletes everything else: device registration, key bundle, and any
 * undeliverable messages targeting the dead device.
 */
export async function pruneStaleClinicDevices(
  clinicId: string,
  ownClinicDeviceId: string,
): Promise<void> {
  try {
    const devicesResult = await fetchPeerDevices(clinicId)
    if (!devicesResult.ok) return

    const staleDevices = devicesResult.data.filter(d =>
      d.deviceId !== 'vault' && d.deviceId !== ownClinicDeviceId
    )

    if (staleDevices.length === 0) return

    logger.info(`Pruning ${staleDevices.length} stale clinic device(s)`)

    for (const device of staleDevices) {
      await Promise.allSettled([
        unregisterDevice(clinicId, device.deviceId),
        deleteKeyBundle(clinicId, device.deviceId),
        // Purge undeliverable messages for this dead device
        supabase
          .from('signal_messages')
          .delete()
          .eq('recipient_id', clinicId)
          .eq('recipient_device_id', device.deviceId),
      ])
    }

    logger.info(`Pruned ${staleDevices.length} stale clinic device(s)`)
  } catch (e) {
    logger.warn('Failed to prune stale clinic devices:', e instanceof Error ? e.message : e)
  }
}
