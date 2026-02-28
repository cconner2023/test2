/**
 * Signal Protocol key initialization — called on sign-in.
 *
 * Idempotent: if keys already exist they are reused. Generates
 * missing keys and uploads the public bundle to Supabase.
 * Registers the local device in the user_devices table.
 *
 * Fire-and-forget, non-fatal on failure — same pattern as
 * prefetchBarcodeKey() in cryptoService.ts.
 */

import { createLogger } from '../../Utilities/Logger'
import { SIGNAL } from '../constants'
import {
  ensureLocalIdentity,
  generateSignedPreKey,
  generatePreKeys,
  getPreKeyCount,
  assemblePublicKeyBundle,
} from './keyManager'
import { uploadKeyBundle, registerDevice } from './signalService'

const logger = createLogger('SignalInit')

/**
 * Initialize Signal Protocol key material and upload bundle.
 *
 * Steps:
 * 1. Ensure local identity exists (no-op if already generated)
 * 2. Register device in user_devices table
 * 3. Generate signed pre-key if needed
 * 4. Top up one-time pre-keys if below half batch size
 * 5. Assemble and upload public key bundle to Supabase (with deviceId)
 */
export async function initSignalBundle(userId: string): Promise<void> {
  logger.info('Initializing Signal key bundle')

  // 1. Identity
  const identity = await ensureLocalIdentity()

  // 2. Register device
  const regResult = await registerDevice(userId, identity.deviceId)
  if (!regResult.ok) {
    logger.warn('Device registration failed:', regResult.error)
    // Non-fatal — continue with bundle upload
  }

  // 3. Signed pre-key (generates if none exists)
  await generateSignedPreKey()

  // 4. Top up OTP keys if running low
  const currentCount = await getPreKeyCount()
  const threshold = Math.floor(SIGNAL.PREKEY_BATCH_SIZE / 2)

  if (currentCount < threshold) {
    const needed = SIGNAL.PREKEY_BATCH_SIZE - currentCount
    logger.info(`Pre-key count ${currentCount} below threshold ${threshold}, generating ${needed}`)
    await generatePreKeys(needed)
  }

  // 5. Assemble and upload (with deviceId)
  const bundle = await assemblePublicKeyBundle(userId, identity.deviceId)
  if (!bundle) {
    logger.warn('Could not assemble bundle — skipping upload')
    return
  }

  const result = await uploadKeyBundle(bundle)
  if (!result.ok) {
    logger.warn('Bundle upload failed:', result.error)
    return
  }

  logger.info('Signal bundle initialized and uploaded')
}
