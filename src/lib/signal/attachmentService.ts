/**
 * Encrypted attachment service for image messages.
 *
 * Images are encrypted client-side with a random AES-256-GCM key before
 * upload to Supabase Storage. The decryption key travels inside the
 * Signal-encrypted message, so the server never sees plaintext images.
 *
 * Blob format: IV (12 bytes) || ciphertext
 */

import { createLogger } from '../../Utilities/Logger'
import { bytesToBase64, base64ToBytes } from '../base64Utils'
import { aesGcmEncrypt, aesGcmDecrypt } from '../aesGcm'
import { supabase } from '../supabase'
import { ok, err, type Result } from '../result'

const logger = createLogger('Attachments')

const BUCKET = 'message-attachments'

// ---- Upload (encrypt + store) ----

export interface UploadResult {
  /** Storage path: "{userId}/{uuid}.enc" */
  path: string
  /** Base64-encoded AES-256-GCM key for the recipient to decrypt. */
  key: string
}

/**
 * Encrypt an image blob with a random AES-256-GCM key and upload to Storage.
 * Returns the storage path and base64 key to include in the Signal message.
 */
export async function uploadEncryptedAttachment(
  userId: string,
  imageBlob: Blob,
): Promise<Result<UploadResult>> {
  try {
    // Generate random AES-256-GCM key
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )

    // Encrypt the image bytes (aesGcmEncrypt prepends the 12-byte IV)
    const plainBytes = new Uint8Array(await imageBlob.arrayBuffer())
    const combined = await aesGcmEncrypt(key, plainBytes)

    const encBlob = new Blob([combined as BlobPart], { type: 'application/octet-stream' })

    // Upload to Storage
    const fileName = `${userId}/${crypto.randomUUID()}.enc`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, encBlob, { contentType: 'application/octet-stream', upsert: false })

    if (uploadError) {
      logger.warn('Upload failed:', uploadError.message)
      return err(uploadError.message)
    }

    // Export key to base64
    const rawKey = await crypto.subtle.exportKey('raw', key)
    const keyBase64 = bytesToBase64(new Uint8Array(rawKey))

    logger.info(`Uploaded encrypted attachment: ${fileName} (${combined.byteLength} bytes)`)
    return ok({ path: fileName, key: keyBase64 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown upload error'
    logger.warn('uploadEncryptedAttachment error:', msg)
    return err(msg)
  }
}

// ---- Download (fetch + decrypt) ----

/**
 * Download an encrypted attachment from Storage and decrypt it.
 * Returns the decrypted image as a Blob.
 */
export async function downloadDecryptedAttachment(
  path: string,
  keyBase64: string,
): Promise<Result<Blob>> {
  try {
    // Download encrypted blob
    const { data, error: dlError } = await supabase.storage
      .from(BUCKET)
      .download(path)

    if (dlError || !data) {
      const msg = dlError?.message ?? 'No data returned'
      logger.warn('Download failed:', msg)
      return err(msg)
    }

    // Import the key and decrypt (aesGcmDecrypt splits IV + ciphertext)
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

    logger.info(`Decrypted attachment: ${path} (${plainBuffer.byteLength} bytes)`)
    return ok(new Blob([plainBuffer as BlobPart]))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown decrypt error'
    logger.warn('downloadDecryptedAttachment error:', msg)
    return err(msg)
  }
}
