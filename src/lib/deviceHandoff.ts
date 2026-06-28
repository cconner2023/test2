/**
 * DEVICE-HANDOFF (Option A) — convenience-login history transfer.
 *
 * When a new device links from an existing logged-in one (the QR "Link This Device"
 * flow), the link is passwordless, so the new device has no backup key and would
 * otherwise show NO message history until the user enters their password (a session
 * only provisions a blank, forward-only Signal endpoint). This module lets the
 * existing device hand over its message history so the linked device shows it
 * immediately — purely a convenience for easy multi-device login.
 *
 * SCOPE: history only. Password recovery / vault re-keying is intentionally NOT a
 * concern here (linked devices are for easy login, not recovery). The vault on the
 * new device unlocks the normal way — via VaultUnlockBanner when the user enters
 * their (unchanged) password.
 *
 * ZERO-KNOWLEDGE: message history is E2E content the server must never read. The
 * device-link Realtime channel and the temp `device-handoff` bucket both route
 * through Supabase, so the bundle is sealed (ephemeral ECDH, deviceHandoffSeal.ts)
 * to the public key the linkee minted and shipped IN THE QR (physically scanned →
 * no relay MITM) BEFORE it touches storage. No-PHI-on-the-wire still applies.
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { sealToHandoffPub, openHandoffSealed, type HandoffSealed } from './deviceHandoffSeal'
import { exportHistoryForHandoff, applyHistoryFromHandoff } from './signal/backupService'

const logger = createLogger('DeviceHandoff')

export const HANDOFF_BUCKET = 'device-handoff'

/** Sealed bundle shape (plaintext, before deviceHandoffSeal). History only — type
 *  derived from the source export so no internal signal/* interfaces leak. */
export interface HandoffBundleV1 {
  v: 1
  history: Awaited<ReturnType<typeof exportHistoryForHandoff>>
}

/** Storage path for a handoff bundle. Both devices are the same user, so the
 *  own-folder RLS (<userId>/…) authorizes both the upload and the download. */
export function handoffPath(userId: string, channelId: string): string {
  return `${userId}/${channelId}.enc`
}

/**
 * LINKER: gather this device's history, seal it to the linkee's QR public key, and
 * upload to device-handoff/<userId>/<channelId>.enc. Returns the path on success
 * (the linker then hands over the session over Realtime), or null on any failure
 * (the linkee just links session-only, no history carryover). Never throws.
 */
export async function prepareAndUploadHandoff(
  userId: string,
  channelId: string,
  linkeePubB64: string,
): Promise<string | null> {
  try {
    const history = await exportHistoryForHandoff()
    const bundle: HandoffBundleV1 = { v: 1, history }
    const sealed = await sealToHandoffPub(linkeePubB64, JSON.stringify(bundle))

    const path = handoffPath(userId, channelId)
    const body = new Blob([JSON.stringify(sealed)], { type: 'application/octet-stream' })
    const { error } = await supabase.storage
      .from(HANDOFF_BUCKET)
      .upload(path, body, { upsert: true, contentType: 'application/octet-stream' })

    if (error) {
      logger.warn('Handoff upload failed:', error.message)
      return null
    }
    return path
  } catch (err) {
    logger.warn('prepareAndUploadHandoff failed:', err)
    return null
  }
}

/**
 * LINKEE: download the sealed bundle, open it with the in-heap handoff private key,
 * and apply the history into IDB. Best-effort: returns false on any failure (the
 * linked device just shows no carried-over history — no worse than before). Never
 * throws.
 *
 * @param privateKey the linkee's ephemeral handoff private key (from generateHandoffKeypair)
 */
export async function downloadAndApplyHandoff(
  userId: string,
  channelId: string,
  privateKey: CryptoKey,
): Promise<boolean> {
  try {
    const path = handoffPath(userId, channelId)
    const { data, error } = await supabase.storage.from(HANDOFF_BUCKET).download(path)
    if (error || !data) {
      logger.warn('Handoff download failed:', error?.message)
      return false
    }

    const sealed = JSON.parse(await data.text()) as HandoffSealed
    const bundle = JSON.parse(await openHandoffSealed(privateKey, sealed)) as HandoffBundleV1
    if (bundle.v !== 1) {
      logger.warn('Unknown handoff bundle version')
      return false
    }

    await applyHistoryFromHandoff(userId, bundle.history)

    // The temp ciphertext has served its purpose — remove it (the TTL cron is the backstop).
    void supabase.storage.from(HANDOFF_BUCKET).remove([path]).catch(() => {})
    return true
  } catch (err) {
    logger.warn('downloadAndApplyHandoff failed:', err)
    return false
  }
}
