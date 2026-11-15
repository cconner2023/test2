/**
 * Encrypted attachment service.
 *
 * Bytes are encrypted client-side with AES-256-GCM before upload; the key travels
 * inside the Signal-encrypted message (or the owning record), so storage only ever
 * holds ciphertext.
 *
 * Two stores:
 *   r2     Cloudflare R2 via presigned URLs from the attachment-sign edge function.
 *          Object keys are m/<hex> (message, 21-day lifecycle), p/<hex> (permanent),
 *          p/cert/<holder>/<certId> (deterministic, overwritten on replace).
 *   legacy Supabase Storage bucket message-attachments, path {userId}/{uuid}.enc.
 *          A ref without store:'r2' is legacy and must keep decrypting until the
 *          bucket is retired; no new writes go there once callers pass a class.
 *
 * Blob format: IV (12 bytes) || GCM ciphertext. For m/ and v/ objects the GCM
 * plaintext is padded: [u32 BE realLen][bytes][zeros] up to the next size bucket
 * (Signal's scheme), so stored size leaks only a coarse bucket. Padding is decided
 * by the key prefix on both sides, so the ref needs no padding flag.
 */

import { createLogger } from '../../Utilities/Logger'
import { bytesToBase64, base64ToBytes } from '../base64Utils'
import { aesGcmEncrypt, aesGcmDecrypt } from '../aesGcm'
import { supabase } from '../supabase'
import { ok, err, type Result } from '../result'
import { padAttachment, unpadAttachment, isPaddedKey } from '../attachmentPadding'
import { cacheKeyFor, getCachedCiphertext, putCachedCiphertext, deleteCachedCiphertext } from '../attachmentCache'

const logger = createLogger('Attachments')

const LEGACY_BUCKET = 'message-attachments'

/** Plaintext caps. attachment-sign enforces the same limits on the padded size. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const MAX_CERT_BYTES = 10 * 1024 * 1024

export type AttachmentClass = 'm' | 'p' | 'cert'
export type AttachmentStore = 'r2'

/** attachment-sign failure reasons, plus 'network' for a failed R2 transfer. */
export type AttachmentFailure = 'quota' | 'size' | 'forbidden' | 'not_found' | 'error' | 'network'

export interface UploadResult {
  /** Object key (r2) or storage path (legacy). */
  path: string
  /** Base64-encoded AES-256-GCM key for the recipient to decrypt. */
  key: string
  /** Absent for legacy Supabase uploads. */
  store?: AttachmentStore
  /** Plaintext byte length. */
  size: number
}

export interface UploadOptions {
  /** Omit for the legacy Supabase path. */
  class?: AttachmentClass
  /** cert only: the certificate holder and certification id that form the key. */
  holder?: string
  certId?: string
  /** Reuse an existing AES key (cert documents keep theirs in certifications.doc_key). */
  keyBase64?: string
  /** p only: the table whose *_ref column will point at this key, so the nightly sweep
   *  can delete it once nothing does. Omit for objects referenced from encrypted payloads. */
  refTable?: 'profiles' | 'property_locations' | 'property_items'
  /** r2 only: fraction (0..1) of the ciphertext PUT sent. Not called during encrypt/sign. */
  onProgress?: (fraction: number) => void
  /** Aborting resolves err('aborted'). An abort after the PUT finished does not undo it. */
  signal?: AbortSignal
}

/** User-facing text for an attachmentService failure reason. */
export function attachmentFailureMessage(reason: string): string {
  switch (reason) {
    case 'quota': return 'Attachment storage is full for now. Try again later or send a smaller file.'
    case 'size': return 'Files must be 25 MB or smaller.'
    case 'forbidden': return 'You don’t have permission to upload this file.'
    case 'network': return 'The upload was interrupted. Check your connection and try again.'
    default: return 'Something went wrong uploading the file. Try again.'
  }
}

// ---- attachment-sign ----

type SignResponse<T> = ({ ok: true } & T) | { ok: false; reason: AttachmentFailure }

async function sign<T>(body: Record<string, unknown>): Promise<Result<T, AttachmentFailure>> {
  const { data, error } = await supabase.functions.invoke<SignResponse<T>>('attachment-sign', { body })
  if (error || !data) {
    logger.warn('attachment-sign failed:', error?.message ?? 'no data')
    return err('error')
  }
  if (!data.ok) return err(data.reason)
  return ok(data as T)
}

/** Delete R2 objects the caller owns (or, for certs, may manage). Legacy paths are ignored. */
export async function deleteAttachments(keys: string[]): Promise<Result<string[], AttachmentFailure>> {
  const r2Keys = keys.filter(k => /^[mp]\//.test(k))
  if (r2Keys.length === 0) return ok([])
  const res = await sign<{ deleted: string[] }>({ action: 'delete', keys: r2Keys })
  if (!res.ok) return res
  await deleteCachedCiphertext(res.data.deleted)
  return ok(res.data.deleted)
}

/** Whether a cert document exists and the caller may read it. */
export async function certDocumentExists(key: string): Promise<Result<boolean, AttachmentFailure>> {
  const res = await sign<{ exists: Record<string, boolean> }>({ action: 'head', keys: [key] })
  return res.ok ? ok(res.data.exists[key] === true) : res
}

// ---- Upload (encrypt + store) ----

/**
 * XHR rather than fetch: fetch has no upload progress, and streaming request bodies
 * (the only fetch route to it) are unsupported on iOS Safari. Body length must equal
 * the signed Content-Length exactly or R2 rejects it; the browser sets that header
 * itself, so it is skipped here along with any other forbidden name.
 * Resolves the HTTP status, 0 on a network error, or 'aborted'.
 */
function putWithProgress(
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<number | 'aborted'> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [k, v] of Object.entries(headers)) {
      const name = k.toLowerCase()
      if (name === 'content-length' || name === 'host') continue
      xhr.setRequestHeader(k, v)
    }
    if (onProgress) {
      xhr.upload.onprogress = e => { if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total) }
    }
    const onAbort = () => xhr.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    const done = (v: number | 'aborted') => { signal?.removeEventListener('abort', onAbort); resolve(v) }
    xhr.onload = () => { onProgress?.(1); done(xhr.status) }
    xhr.onerror = () => done(0)
    xhr.ontimeout = () => done(0)
    xhr.onabort = () => done('aborted')
    xhr.send(body as XMLHttpRequestBodyInit)
  })
}

async function importKey(keyBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBytes(keyBase64) as BufferSource,
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

/**
 * Encrypt a blob and upload it. With opts.class the bytes go to R2; without it,
 * to the legacy Supabase bucket (kept only until every caller passes a class).
 */
export async function uploadEncryptedAttachment(
  userId: string,
  blob: Blob,
  opts: UploadOptions = {},
): Promise<Result<UploadResult, string>> {
  try {
    const cap = opts.class === 'cert' ? MAX_CERT_BYTES : MAX_ATTACHMENT_BYTES
    if (blob.size > cap) return err('size')

    const key = opts.keyBase64
      ? await importKey(opts.keyBase64)
      : await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const plainBytes = new Uint8Array(await blob.arrayBuffer())
    const keyBase64 = opts.keyBase64 ?? bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)))

    if (!opts.class) {
      const combined = await aesGcmEncrypt(key, plainBytes)
      const fileName = `${userId}/${crypto.randomUUID()}.enc`
      const { error: uploadError } = await supabase.storage
        .from(LEGACY_BUCKET)
        .upload(fileName, new Blob([combined as BlobPart], { type: 'application/octet-stream' }),
          { contentType: 'application/octet-stream', upsert: false })
      if (uploadError) {
        logger.warn('Upload failed:', uploadError.message)
        return err(uploadError.message)
      }
      return ok({ path: fileName, key: keyBase64, size: plainBytes.byteLength })
    }

    // m/ is padded; the server picks the key, so pad by class rather than key prefix here.
    const combined = await aesGcmEncrypt(key, opts.class === 'm' ? padAttachment(plainBytes) : plainBytes)

    const put = await sign<{ key: string; url: string; headers: Record<string, string> }>({
      action: 'put',
      class: opts.class,
      size: combined.byteLength,
      ...(opts.class === 'cert' ? { holder: opts.holder, certId: opts.certId } : {}),
      ...(opts.refTable ? { refTable: opts.refTable } : {}),
    })
    if (!put.ok) return err(put.error)

    if (opts.signal?.aborted) return err('aborted')
    const status = await putWithProgress(put.data.url, put.data.headers, combined, opts.onProgress, opts.signal)
    if (status === 'aborted') return err('aborted')
    if (status < 200 || status >= 300) {
      logger.warn('R2 upload failed:', status)
      return err('network')
    }

    logger.info(`Uploaded attachment ${put.data.key} (${combined.byteLength} bytes)`)
    return ok({ path: put.data.key, key: keyBase64, store: 'r2', size: plainBytes.byteLength })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown upload error'
    logger.warn('uploadEncryptedAttachment error:', msg)
    return err(msg)
  }
}

// ---- Download (fetch + decrypt) ----

/** Fetch the stored ciphertext for one object, cache first. */
async function fetchCiphertext(path: string, store?: AttachmentStore, version?: string): Promise<Result<Uint8Array, string>> {
  const cacheKey = cacheKeyFor(path, version)
  const cached = await getCachedCiphertext(cacheKey)
  if (cached) return ok(cached)
  const fetched = await fetchRemote(path, store)
  if (fetched.ok) void putCachedCiphertext(cacheKey, fetched.data)
  return fetched
}

async function fetchRemote(path: string, store?: AttachmentStore): Promise<Result<Uint8Array, string>> {
  if (store === 'r2') {
    const get = await sign<{ urls: Record<string, string | null> }>({ action: 'get', keys: [path] })
    if (!get.ok) return err(get.error)
    const url = get.data.urls[path]
    if (!url) return err('not_found')
    const res = await fetch(url)
    if (res.status === 404) return err('not_found')
    if (!res.ok) return err('network')
    return ok(new Uint8Array(await res.arrayBuffer()))
  }

  const { data, error: dlError } = await supabase.storage.from(LEGACY_BUCKET).download(path)
  if (dlError || !data) return err(dlError?.message ?? 'No data returned')
  return ok(new Uint8Array(await data.arrayBuffer()))
}

/**
 * Download an attachment and decrypt it. `store` comes from the ref; absent means
 * legacy Supabase. 'not_found' covers expired (21-day lifecycle) and deleted objects;
 * callers render that as "No longer available".
 */
export async function downloadDecryptedAttachment(
  path: string,
  keyBase64: string,
  store?: AttachmentStore,
  mime?: string,
  /** Required for cert documents (overwritten in place): certifications.updated_at. */
  version?: string,
): Promise<Result<Blob, string>> {
  try {
    const fetched = await fetchCiphertext(path, store, version)
    if (!fetched.ok) {
      logger.warn('Download failed:', fetched.error)
      return fetched
    }

    const key = await crypto.subtle.importKey('raw', base64ToBytes(keyBase64) as BufferSource,
      { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    let plain = await aesGcmDecrypt(key, fetched.data)
    if (store === 'r2' && isPaddedKey(path)) plain = unpadAttachment(plain)

    logger.info(`Decrypted attachment: ${path} (${plain.byteLength} bytes)`)
    return ok(new Blob([plain as BlobPart], mime ? { type: mime } : undefined))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown decrypt error'
    logger.warn('downloadDecryptedAttachment error:', msg)
    return err(msg)
  }
}
