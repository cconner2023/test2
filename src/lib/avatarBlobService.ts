/**
 * Custom profile-photo persistence service.
 *
 * A user's custom avatar is operational, non-PHI imagery that ANY authenticated
 * viewer may render (rosters, chat headers, contact lists) — so, like the
 * voicemail greeting (see voicemailService.ts), it can't ride the per-recipient
 * Signal/attachment key path. It is AES-256-GCM encrypted with the app-wide
 * barcode key (getBarcodeKey), which every authenticated user already caches
 * locally, and stored inline on profiles.avatar_blob as { enc, mime }. avatar_id
 * stays the selector: the value 'custom' means "render avatar_blob".
 *
 * Inline storage is deliberate (the downscaled JPEG is a few KB). It is the seam
 * for a future move to Supabase Storage / S3: only the save/decrypt internals
 * change; the column name, ClinicMedic.avatarBlob, and UserAvatar stay put.
 *
 * Not security-critical (no src/lib/signal/* involvement).
 */

import { supabase } from './supabase'
import { getBarcodeKey } from './cryptoService'
import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm'
import { bytesToBase64, base64ToBytes } from './base64Utils'
import { createLogger } from '../Utilities/Logger'
import type { AvatarBlob } from '../Types/SupervisorTestTypes'
import type { Json } from '../Types/database.types.generated'

const logger = createLogger('AvatarBlob')

/** Decrypted data-URL cache keyed by the ciphertext (`enc`) string, so repeated
 *  renders of the same avatar never re-decrypt. Also keyed `user:<id>` for the
 *  signed-in user, whose plaintext data URL is already in hand (no decrypt). */
const urlCache = new Map<string, string>()

/** Synchronously read a cached decrypted data URL, or null. */
export function getCachedAvatarUrl(cacheKey: string): string | null {
  return urlCache.get(cacheKey) ?? null
}

/** Seed the cache with an already-known plaintext data URL (the signed-in user
 *  holds their own image locally — no need to decrypt it back). */
export function seedAvatarCache(cacheKey: string, dataUrl: string): void {
  urlCache.set(cacheKey, dataUrl)
}

/** Split a `data:<mime>;base64,<payload>` URL into its parts. */
function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!match) return null
  return { mime: match[1], bytes: base64ToBytes(match[2]) }
}

/** Encrypt + persist the signed-in user's custom photo and flip avatar_id to
 *  'custom'. `dataUrl` is the downscaled JPEG data URL from resizeImage().
 *  Returns false if the barcode key is unavailable (offline cold start) or the
 *  write fails. */
export async function saveOwnAvatarBlob(dataUrl: string): Promise<boolean> {
  try {
    const key = await getBarcodeKey()
    if (!key) {
      logger.warn('No barcode key available — cannot save avatar')
      return false
    }
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) {
      logger.warn('Unrecognized avatar data URL')
      return false
    }
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return false

    const combined = await aesGcmEncrypt(key, parsed.bytes)
    const blob: AvatarBlob = { enc: bytesToBase64(combined), mime: parsed.mime }

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_blob: blob as unknown as Json, avatar_id: 'custom' })
      .eq('id', userId)

    if (error) {
      logger.warn('Failed to save avatar:', error.message)
      return false
    }
    // Seed both cache keys: the signed-in user renders instantly everywhere.
    urlCache.set(blob.enc, dataUrl)
    urlCache.set(`user:${userId}`, dataUrl)
    return true
  } catch (e) {
    logger.warn('saveOwnAvatarBlob error:', e instanceof Error ? e.message : e)
    return false
  }
}

/** Clear the signed-in user's custom photo blob. The avatar_id reset is handled
 *  by the caller (useProfileAvatar.clearCustomImage falls back to 'initials'). */
export async function clearOwnAvatarBlob(): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return false
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_blob: null })
      .eq('id', userId)
    if (error) {
      logger.warn('Failed to clear avatar:', error.message)
      return false
    }
    urlCache.delete(`user:${userId}`)
    return true
  } catch (e) {
    logger.warn('clearOwnAvatarBlob error:', e instanceof Error ? e.message : e)
    return false
  }
}

/** Decrypt an avatar blob into a renderable base64 data URL (memoized by `enc`).
 *  Returns null if the barcode key is unavailable or decryption fails. */
export async function decryptAvatarToUrl(blob: AvatarBlob): Promise<string | null> {
  const cached = urlCache.get(blob.enc)
  if (cached) return cached
  try {
    const key = await getBarcodeKey()
    if (!key) return null
    const combined = base64ToBytes(blob.enc)
    const plain = await aesGcmDecrypt(key, combined)
    const dataUrl = `data:${blob.mime || 'image/jpeg'};base64,${bytesToBase64(plain)}`
    urlCache.set(blob.enc, dataUrl)
    return dataUrl
  } catch (e) {
    logger.warn('decryptAvatarToUrl error:', e instanceof Error ? e.message : e)
    return null
  }
}
