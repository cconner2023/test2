/**
 * Custom profile-photo persistence service.
 *
 * A user's custom avatar is operational, non-PHI imagery that ANY authenticated
 * viewer may render (rosters, chat headers, contact lists), so it can't ride the
 * per-recipient Signal key path. The 160px JPEG is encrypted with a random per-object
 * AES key and stored on R2 p/; profiles.avatar_ref = {store:'r2', k, ak, mime} carries
 * the key, so roster reads ship ~150 bytes instead of the image. avatar_id stays the
 * selector: 'custom' means "render the avatar ref".
 *
 * Legacy rows hold the image inline on profiles.avatar_blob, encrypted with the
 * app-wide barcode key. They still decrypt; the owner's next sign-in re-uploads to R2
 * (useProfileAvatar) and nulls avatar_blob, and the RPCs stop returning avatar_blob as
 * soon as avatar_ref is set.
 *
 * Not security-critical (no src/lib/signal/* involvement beyond the shared
 * attachmentService upload/download).
 */

import { supabase } from './supabase'
import { getBarcodeKey } from './cryptoService'
import { aesGcmDecrypt } from './aesGcm'
import { uploadEncryptedAttachment, downloadDecryptedAttachment, deleteAttachments } from './signal/attachmentService'
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

function dataUrlToBlob(parsed: { mime: string; bytes: Uint8Array }): Blob {
  return new Blob([parsed.bytes as BlobPart], { type: parsed.mime })
}

/** Cache key for a stored avatar: the R2 object key, or the legacy ciphertext. */
export function avatarCacheKey(blob: AvatarBlob): string {
  return blob.store === 'r2' ? blob.k : blob.enc
}

async function currentAvatarKey(userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('avatar_ref').eq('id', userId).single()
  const ref = (data as { avatar_ref?: AvatarBlob | null } | null)?.avatar_ref
  return ref?.store === 'r2' ? ref.k : null
}

/** Upload the signed-in user's custom photo to R2 and flip avatar_id to 'custom'.
 *  `dataUrl` is the downscaled JPEG data URL from resizeImage(). The previous R2
 *  object is deleted after the row points at the new one; if that delete fails the
 *  nightly orphan sweep collects it. Returns false when offline or the write fails. */
export async function saveOwnAvatarBlob(dataUrl: string): Promise<boolean> {
  try {
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) {
      logger.warn('Unrecognized avatar data URL')
      return false
    }
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return false

    const previous = await currentAvatarKey(userId)
    const up = await uploadEncryptedAttachment(userId, dataUrlToBlob(parsed), { class: 'p', refTable: 'profiles' })
    if (!up.ok) {
      logger.warn('Avatar upload failed:', up.error)
      return false
    }
    const ref: AvatarBlob = { store: 'r2', k: up.data.path, ak: up.data.key, mime: parsed.mime }

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_ref: ref as unknown as Json, avatar_blob: null, avatar_id: 'custom' })
      .eq('id', userId)
    if (error) {
      logger.warn('Failed to save avatar:', error.message)
      void deleteAttachments([up.data.path])
      return false
    }
    if (previous && previous !== up.data.path) void deleteAttachments([previous])

    urlCache.set(ref.k, dataUrl)
    urlCache.set(`user:${userId}`, dataUrl)
    return true
  } catch (e) {
    logger.warn('saveOwnAvatarBlob error:', e instanceof Error ? e.message : e)
    return false
  }
}

/** Clear the signed-in user's custom photo (R2 object and both columns). The avatar_id
 *  reset is handled by the caller (useProfileAvatar.clearCustomImage falls back to 'initials'). */
export async function clearOwnAvatarBlob(): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return false
    const previous = await currentAvatarKey(userId)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_blob: null, avatar_ref: null })
      .eq('id', userId)
    if (error) {
      logger.warn('Failed to clear avatar:', error.message)
      return false
    }
    if (previous) void deleteAttachments([previous])
    urlCache.delete(`user:${userId}`)
    return true
  } catch (e) {
    logger.warn('clearOwnAvatarBlob error:', e instanceof Error ? e.message : e)
    return false
  }
}

/** Decrypt an avatar (R2 ref or legacy inline blob) into a renderable data URL,
 *  memoized by object key / ciphertext. R2 bytes also sit in the ciphertext IDB cache,
 *  so a seen avatar renders offline. Returns null on any failure. */
export async function decryptAvatarToUrl(blob: AvatarBlob): Promise<string | null> {
  const cacheKey = avatarCacheKey(blob)
  const cached = urlCache.get(cacheKey)
  if (cached) return cached
  try {
    let plain: Uint8Array
    if (blob.store === 'r2') {
      const res = await downloadDecryptedAttachment(blob.k, blob.ak, 'r2', blob.mime)
      if (!res.ok) return null
      plain = new Uint8Array(await res.data.arrayBuffer())
    } else {
      const key = await getBarcodeKey()
      if (!key) return null
      plain = await aesGcmDecrypt(key, base64ToBytes(blob.enc))
    }
    const dataUrl = `data:${blob.mime || 'image/jpeg'};base64,${bytesToBase64(plain)}`
    urlCache.set(cacheKey, dataUrl)
    return dataUrl
  } catch (e) {
    logger.warn('decryptAvatarToUrl error:', e instanceof Error ? e.message : e)
    return null
  }
}
