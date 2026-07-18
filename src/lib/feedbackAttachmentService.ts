/**
 * Encrypted attachment service for FEEDBACK images.
 *
 * Mirrors the messaging attachment model (src/lib/signal/attachmentService.ts)
 * but is deliberately OUTSIDE the security-critical signal/ wing and targets a
 * dedicated `feedback-attachments` bucket. It reuses the shared, non-signal
 * crypto primitives (aesGcm + base64Utils) rather than importing anything from
 * signal/*.
 *
 * Each image is encrypted client-side with a random AES-256-GCM key before
 * upload; the key is stored on the feedback row so a dev (the only role with
 * SELECT on feedback + this bucket) can decrypt it in the admin panel. Storage
 * breach alone yields ciphertext only.
 *
 * Blob format: IV (12 bytes) || ciphertext
 */

import { createLogger } from '../Utilities/Logger'
import { bytesToBase64, base64ToBytes } from './base64Utils'
import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm'
import { supabase } from './supabase'
import { ok, err, type Result } from './result'

const logger = createLogger('FeedbackAttachments')

const BUCKET = 'feedback-attachments'

/**
 * One stored image: storage path + its base64 AES-256-GCM key.
 * Declared as a `type` (not `interface`) so it stays assignable to the
 * generated `Json` column type when written to feedback.attachments.
 */
export type FeedbackAttachment = {
  /** Storage path: "{userId}/{uuid}.enc" */
  path: string
  /** Base64-encoded AES-256-GCM key for a dev to decrypt. */
  key: string
}

/**
 * Encrypt an image blob with a random AES-256-GCM key and upload to the
 * feedback bucket under the uploader's own {userId}/ prefix.
 */
export async function uploadEncryptedFeedbackImage(
  userId: string,
  imageBlob: Blob,
): Promise<Result<FeedbackAttachment>> {
  try {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )

    const plainBytes = new Uint8Array(await imageBlob.arrayBuffer())
    const combined = await aesGcmEncrypt(key, plainBytes)
    const encBlob = new Blob([combined as BlobPart], { type: 'application/octet-stream' })

    const path = `${userId}/${crypto.randomUUID()}.enc`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, encBlob, { contentType: 'application/octet-stream', upsert: false })

    if (uploadError) {
      logger.warn('Upload failed:', uploadError.message)
      return err(uploadError.message)
    }

    const rawKey = await crypto.subtle.exportKey('raw', key)
    const keyBase64 = bytesToBase64(new Uint8Array(rawKey))

    logger.info(`Uploaded encrypted feedback image: ${path} (${combined.byteLength} bytes)`)
    return ok({ path, key: keyBase64 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown upload error'
    logger.warn('uploadEncryptedFeedbackImage error:', msg)
    return err(msg)
  }
}

/**
 * Remove feedback image blobs from storage (dev-only via bucket RLS).
 * Best-effort: a failure is logged, not thrown — orphan cleanup must never
 * block the feedback delete it accompanies.
 */
export async function deleteFeedbackImages(paths: string[]): Promise<void> {
  if (!paths.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) logger.warn('Failed to remove feedback images:', error.message)
}

/**
 * Download an encrypted feedback image and decrypt it (dev-only via bucket RLS).
 * Returns a JPEG Blob.
 */
export async function downloadDecryptedFeedbackImage(
  path: string,
  keyBase64: string,
): Promise<Result<Blob>> {
  try {
    const { data, error: dlError } = await supabase.storage.from(BUCKET).download(path)
    if (dlError || !data) {
      const msg = dlError?.message ?? 'No data returned'
      logger.warn('Download failed:', msg)
      return err(msg)
    }

    const combined = new Uint8Array(await data.arrayBuffer())
    const rawKey = base64ToBytes(keyBase64)
    const key = await crypto.subtle.importKey(
      'raw',
      rawKey as BufferSource,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )

    const plainBuffer = await aesGcmDecrypt(key, combined)
    logger.info(`Decrypted feedback image: ${path} (${plainBuffer.byteLength} bytes)`)
    return ok(new Blob([plainBuffer as BlobPart], { type: 'image/jpeg' }))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown decrypt error'
    logger.warn('downloadDecryptedFeedbackImage error:', msg)
    return err(msg)
  }
}
