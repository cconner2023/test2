/**
 * Encrypted attachment service for FEEDBACK images.
 *
 * New images go to R2 as p/ objects through the shared attachment pipeline
 * (attachmentService, class 'p'): encrypted client-side with a random AES-256-GCM key,
 * the key stored on the feedback row so a dev (the only role with SELECT on feedback)
 * can decrypt it in the admin panel. Attachment bytes never go to Supabase Storage.
 *
 * LEGACY. Images uploaded before the move sit in the `feedback-attachments` bucket
 * under "{userId}/{uuid}.enc" and stay there (not migrated); reads and deletes route by
 * key shape. R2 deletes are owner-only in attachment-sign, so a dev deleting someone
 * else's feedback leaves the p/ ciphertext behind (unreadable without the row's key).
 *
 * Blob format: IV (12 bytes) || ciphertext
 */

import { createLogger } from '../Utilities/Logger'
import { base64ToBytes } from './base64Utils'
import { aesGcmDecrypt } from './aesGcm'
import { supabase } from './supabase'
import { ok, err, type Result } from './result'
import { uploadEncryptedAttachment, downloadDecryptedAttachment, deleteAttachments } from './signal/attachmentService'

const logger = createLogger('FeedbackAttachments')

const LEGACY_BUCKET = 'feedback-attachments'
const isR2Key = (path: string) => /^p\/[0-9a-f]{32}$/.test(path)

/**
 * One stored image: storage path + its base64 AES-256-GCM key.
 * Declared as a `type` (not `interface`) so it stays assignable to the
 * generated `Json` column type when written to feedback.attachments.
 */
export type FeedbackAttachment = {
  /** R2 key "p/{hex}", or legacy storage path "{userId}/{uuid}.enc". */
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
  const up = await uploadEncryptedAttachment(userId, imageBlob, { class: 'p' })
  if (!up.ok) {
    logger.warn('Upload failed:', up.error)
    return err(up.error)
  }
  logger.info(`Uploaded encrypted feedback image: ${up.data.path}`)
  return ok({ path: up.data.path, key: up.data.key })
}

/**
 * Remove feedback image blobs from storage (dev-only via bucket RLS).
 * Best-effort: a failure is logged, not thrown — orphan cleanup must never
 * block the feedback delete it accompanies.
 */
export async function deleteFeedbackImages(paths: string[]): Promise<void> {
  if (!paths.length) return
  const r2 = paths.filter(isR2Key)
  const legacy = paths.filter((p) => !isR2Key(p))
  if (r2.length) {
    const res = await deleteAttachments(r2)
    if (!res.ok) logger.warn('Failed to remove feedback images:', res.error)
  }
  if (legacy.length) {
    const { error } = await supabase.storage.from(LEGACY_BUCKET).remove(legacy)
    if (error) logger.warn('Failed to remove feedback images:', error.message)
  }
}

/**
 * Download an encrypted feedback image and decrypt it (dev-only via bucket RLS).
 * Returns a JPEG Blob.
 */
export async function downloadDecryptedFeedbackImage(
  path: string,
  keyBase64: string,
): Promise<Result<Blob>> {
  if (isR2Key(path)) {
    const res = await downloadDecryptedAttachment(path, keyBase64, 'r2', 'image/jpeg')
    return res.ok ? ok(res.data) : err(res.error)
  }
  try {
    const { data, error: dlError } = await supabase.storage.from(LEGACY_BUCKET).download(path)
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
