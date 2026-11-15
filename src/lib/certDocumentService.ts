/**
 * The scanned card behind a certification row: one PDF per cert, on R2 at
 * p/cert/{userId}/{certId}, encrypted client-side.
 *
 * DERIVED KEY, NO POINTER COLUMN. The object key comes from the two ids the caller
 * already holds, so nothing on the row can disagree with what is stored; existence is
 * asked of attachment-sign (head), which reproduces the old bucket policy: holder,
 * is_dev(), is_supervisor_of(holder).
 *
 * ENCRYPTED, unlike the old cert-documents bucket. There, Supabase RLS was the
 * confidentiality boundary and a plaintext PDF was acceptable. On R2 nothing but
 * encryption keeps Cloudflare from reading the card, so the PDF is AES-GCM encrypted
 * with certifications.doc_key: generated on first upload, never rotated, readable by
 * exactly the people the certifications RLS admits (the same set as the doc authz).
 * Replacing the card overwrites the same object with a fresh IV and bumps
 * certifications.updated_at, which versions the local ciphertext cache.
 *
 * LEGACY. Cards uploaded before the move are still in the cert-documents bucket,
 * plaintext. Reads fall back to it when R2 has nothing; the next upload moves the cert
 * to R2.
 *
 * ONLINE ONLY, and it says so rather than queueing: a "sent" card that is actually
 * sitting in a queue is worse than a refusal a supervisor can retry.
 */

import { createLogger } from '../Utilities/Logger'
import { supabase } from './supabase'
import { succeed, fail, type ServiceResult } from './result'
import { bytesToBase64 } from './base64Utils'
import {
  uploadEncryptedAttachment,
  downloadDecryptedAttachment,
  deleteAttachments,
  certDocumentExists,
  attachmentFailureMessage,
  type UploadOptions,
} from './signal/attachmentService'

const logger = createLogger('CertDocuments')

const LEGACY_BUCKET = 'cert-documents'

/** Ten megabytes. A phone-scanned card is well under a megabyte; anything past
 *  this is a photo album, and the refusal is cheaper than the upload. */
export const CERT_DOC_MAX_BYTES = 10 * 1024 * 1024

export function certDocumentKey(userId: string, certId: string): string {
  return `p/cert/${userId.toLowerCase()}/${certId.toLowerCase()}`
}

/** Legacy bucket path. */
export function certDocumentPath(userId: string, certId: string): string {
  return `${userId}/${certId}.pdf`
}

async function readCertRow(certId: string): Promise<{ doc_key: string | null; updated_at: string } | null> {
  const { data } = await supabase.from('certifications').select('doc_key, updated_at').eq('id', certId).single()
  return (data as { doc_key: string | null; updated_at: string } | null) ?? null
}

/** Replace the cert's document. One card per cert: re-uploading corrects the scan. */
export async function uploadCertDocument(
  userId: string,
  certId: string,
  file: File,
  transfer: Pick<UploadOptions, 'onProgress' | 'signal'> = {},
): Promise<ServiceResult> {
  if (file.type !== 'application/pdf') {
    return fail('That file is not a PDF.')
  }
  if (file.size > CERT_DOC_MAX_BYTES) {
    return fail(`That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`)
  }
  try {
    const { data: auth } = await supabase.auth.getUser()
    const uploader = auth.user?.id
    if (!uploader) return fail('Sign in again to upload.')

    const row = await readCertRow(certId)
    if (!row) return fail('Could not find that certification.')
    let docKey = row.doc_key
    if (!docKey) {
      const raw = crypto.getRandomValues(new Uint8Array(32))
      docKey = bytesToBase64(raw)
      // Key lands before the bytes: a failed upload leaves an unused key, never bytes
      // nobody can decrypt.
      const { error } = await supabase.from('certifications').update({ doc_key: docKey }).eq('id', certId)
      if (error) return fail(error.message)
    }

    const up = await uploadEncryptedAttachment(uploader, file, {
      class: 'cert', holder: userId, certId, keyBase64: docKey, ...transfer,
    })
    if (!up.ok) return fail(attachmentFailureMessage(up.error))

    // Version bump for every viewer's ciphertext cache (the object key is reused).
    const { error: bumpErr } = await supabase.from('certifications')
      .update({ updated_at: new Date().toISOString() }).eq('id', certId)
    if (bumpErr) logger.warn('updated_at bump failed:', bumpErr.message)
    return succeed()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown upload error'
    logger.warn('uploadCertDocument error:', msg)
    return fail(msg)
  }
}

async function hasLegacyDocument(userId: string, certId: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(LEGACY_BUCKET)
    .list(userId, { search: `${certId}.pdf`, limit: 1 })
  if (error) return false
  return (data ?? []).some(f => f.name === `${certId}.pdf`)
}

/**
 * True when a document is on file (R2, else legacy bucket). A network failure answers
 * FALSE rather than throwing: the surface then offers an upload, which is recoverable,
 * instead of a broken view link, which is not.
 */
export async function hasCertDocument(userId: string, certId: string): Promise<boolean> {
  try {
    const r2 = await certDocumentExists(certDocumentKey(userId, certId))
    if (r2.ok && r2.data) return true
    return await hasLegacyDocument(userId, certId)
  } catch {
    return false
  }
}

/**
 * A URL for viewing: an object URL of the decrypted PDF (R2), or a short-lived signed
 * URL for a legacy card. The caller revokes object URLs it no longer needs.
 */
export async function certDocumentUrl(
  userId: string,
  certId: string,
  expiresInSeconds = 120,
): Promise<string | null> {
  try {
    const row = await readCertRow(certId)
    if (row?.doc_key) {
      const res = await downloadDecryptedAttachment(
        certDocumentKey(userId, certId), row.doc_key, 'r2', 'application/pdf', row.updated_at,
      )
      if (res.ok) return URL.createObjectURL(res.data)
      if (res.error !== 'not_found') return null
    }
    const { data, error } = await supabase.storage
      .from(LEGACY_BUCKET)
      .createSignedUrl(certDocumentPath(userId, certId), expiresInSeconds)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch {
    return null
  }
}

/** Remove the card. Best-effort on a cert delete: a refused cleanup must not hold the
 *  row it accompanies, and the orphan sweep collects whatever is left. */
export async function removeCertDocument(userId: string, certId: string): Promise<void> {
  const res = await deleteAttachments([certDocumentKey(userId, certId)])
  if (!res.ok) logger.warn('Failed to remove cert document:', res.error)
  const { error } = await supabase.storage
    .from(LEGACY_BUCKET)
    .remove([certDocumentPath(userId, certId)])
  if (error) logger.warn('Failed to remove legacy cert document:', error.message)
}
