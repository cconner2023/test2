/**
 * Signal Protocol key initialization — called on sign-in.
 *
 * Idempotent: if keys already exist they are reused. Generates
 * missing keys and uploads the public bundle to Supabase.
 * Registers the local device with role classification (primary/linked/provisional).
 *
 * Fire-and-forget, non-fatal on failure — same pattern as
 * prefetchBarcodeKey() in cryptoService.ts.
 */

import { createLogger } from '../../Utilities/Logger'
import { isPWA } from '../supabase'
import { SIGNAL } from '../constants'
import {
  ensureLocalIdentity,
  generateSignedPreKey,
  generatePreKeys,
  getPreKeyCount,
  assemblePublicKeyBundle,
} from './keyManager'
import { loadLatestSignedPreKey, pruneOldSignedPreKeys } from './keyStore'
import { uploadKeyBundle, registerDeviceWithRole, getDeviceLabel, cleanupStaleDevices } from './signalService'
import type { DeviceRole } from './transportTypes'

const logger = createLogger('SignalInit')

export interface SignalInitResult {
  deviceId: string
  role: DeviceRole
  hasPrimary: boolean
}

/** Check whether a signed pre-key has exceeded its rotation period. */
function isSignedPreKeyExpired(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const maxAgeMs = SIGNAL.SIGNED_PREKEY_ROTATION_DAYS * 24 * 60 * 60 * 1000
  return ageMs >= maxAgeMs
}

async function retryUpload(bundle: NonNullable<Awaited<ReturnType<typeof assemblePublicKeyBundle>>>): Promise<boolean> {
  const backoffs = [500, 1500, 4500]
  for (let attempt = 0; attempt < backoffs.length; attempt++) {
    const result = await uploadKeyBundle(bundle)
    if (result.ok) return true
    logger.warn(`Bundle upload attempt ${attempt + 1} failed:`, result.error)
    if (attempt < backoffs.length - 1) {
      await new Promise(r => setTimeout(r, backoffs[attempt]))
    }
  }
  return false
}

/**
 * Initialize Signal Protocol key material and upload bundle.
 *
 * Steps:
 * 1. Ensure local identity exists (no-op if already generated)
 * 2. In parallel:
 *    a. Register device with role classification (primary/linked/provisional)
 *    b. Prepare key material (signed pre-key + one-time pre-keys)
 * 3. Fire-and-forget stale device cleanup (30 min threshold)
 * 4. Assemble public key bundle (needs identity + keys from 2b)
 * 5. Upload bundle with retry (up to 3 attempts, exponential backoff)
 * 6. Return { deviceId, role, hasPrimary }
 */
export async function initSignalBundle(userId: string): Promise<SignalInitResult | null> {
  logger.info('Initializing Signal key bundle')

  // 1. Identity — everything depends on this
  const identity = await ensureLocalIdentity()

  // 2. Parallel: device registration + key material preparation
  const [regOutcome] = await Promise.all([
    // 2a. Register device with role
    (async () => {
      let regResult = await registerDeviceWithRole(identity.deviceId, getDeviceLabel(), isPWA)

      // If registration was rejected (e.g., another device is already primary),
      // retry as a non-primary device so we still get registered in user_devices.
      if (regResult.ok && !regResult.data.registered && isPWA) {
        logger.info('Primary registration rejected — retrying as linked device')
        regResult = await registerDeviceWithRole(identity.deviceId, getDeviceLabel(), false)
      }

      if (!regResult.ok || !regResult.data.registered) {
        const reason = regResult.ok ? regResult.data.error : regResult.error
        logger.warn('Device registration failed:', reason)
      }

      return regResult
    })(),

    // 2b. Key material preparation
    (async () => {
      const existingSpk = await loadLatestSignedPreKey()
      if (!existingSpk || isSignedPreKeyExpired(existingSpk.createdAt)) {
        logger.info(existingSpk ? 'Signed pre-key expired, rotating' : 'No signed pre-key, generating')
        await generateSignedPreKey()
      }

      pruneOldSignedPreKeys(SIGNAL.SIGNED_PREKEY_MAX_AGE_DAYS).catch(() => {})

      const currentCount = await getPreKeyCount()
      const threshold = Math.floor(SIGNAL.PREKEY_BATCH_SIZE / 2)

      if (currentCount < threshold) {
        const needed = SIGNAL.PREKEY_BATCH_SIZE - currentCount
        logger.info(`Pre-key count ${currentCount} below threshold ${threshold}, generating ${needed}`)
        await generatePreKeys(needed)
      }
    })(),
  ])

  const role: DeviceRole = regOutcome.ok && regOutcome.data.role ? regOutcome.data.role : 'provisional'
  const hasPrimary = regOutcome.ok ? (regOutcome.data.hasPrimary ?? false) : false

  // 3. Fire-and-forget stale device cleanup on every login
  cleanupStaleDevices(30).catch(() => {})

  // 4. Assemble bundle (needs identity + keys from step 2b)
  const bundle = await assemblePublicKeyBundle(userId, identity.deviceId)
  if (!bundle) {
    logger.warn('Could not assemble bundle — skipping upload')
    return { deviceId: identity.deviceId, role, hasPrimary }
  }

  // 5. Upload with retry (3 attempts, exponential backoff)
  const uploaded = await retryUpload(bundle)
  if (!uploaded) {
    logger.warn('Bundle upload failed after all retry attempts')
    return { deviceId: identity.deviceId, role, hasPrimary }
  }

  logger.info(`Signal bundle initialized and uploaded (role=${role})`)
  return { deviceId: identity.deviceId, role, hasPrimary }
}
