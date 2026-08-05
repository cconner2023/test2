/**
 * The scanned card behind a certification row — one PDF per cert, in the
 * `cert-documents` bucket.
 *
 * NO TABLE COLUMN, BY DESIGN. The path is DERIVED from the two ids the caller
 * already holds ("{userId}/{certId}.pdf"), so there is nothing on the row that
 * can disagree with what is in the bucket: a pointer column would need a write
 * to stay true, and a failed write would leave a row claiming a document that is
 * not there (or hiding one that is). Existence is asked of storage.
 *
 * NOT ENCRYPTED, unlike feedback attachments and messaging. A certification is
 * an operational credential — a title, a number and two dates, the same fields
 * that already ride the certifications table in plaintext — not PHI, and the
 * people who must read it (the holder, their supervisor) are exactly who the
 * bucket's policies admit. Encrypting it would need a key per cert on a row the
 * supervisor reads through RLS anyway, which buys nothing the bucket policy is
 * not already enforcing.
 *
 * ONLINE ONLY, and it says so rather than queueing. Every other write in this
 * app goes IDB -> sync queue -> Supabase, but the queue carries JSON events; a
 * multi-megabyte binary is not an event, and a "sent" card that is actually
 * sitting in a queue is worse than a refusal a supervisor can retry.
 */

import { createLogger } from '../Utilities/Logger'
import { supabase } from './supabase'
import { succeed, fail, type ServiceResult } from './result'

const logger = createLogger('CertDocuments')

const BUCKET = 'cert-documents'

/** Ten megabytes. A phone-scanned card is well under a megabyte; anything past
 *  this is a photo album, and the refusal is cheaper than the upload. */
export const CERT_DOC_MAX_BYTES = 10 * 1024 * 1024

/** "{userId}/{certId}.pdf" — the folder is the owner, which is what the bucket's
 *  policies are written against. */
export function certDocumentPath(userId: string, certId: string): string {
  return `${userId}/${certId}.pdf`
}

/**
 * Replace the cert's document. `upsert` because a cert has ONE card: re-uploading
 * is correcting the scan, not filing a second one, and a versioned path would
 * leave the old blob behind with nothing pointing at it.
 */
export async function uploadCertDocument(
  userId: string,
  certId: string,
  file: File,
): Promise<ServiceResult> {
  if (file.type !== 'application/pdf') {
    return fail('That file is not a PDF.')
  }
  if (file.size > CERT_DOC_MAX_BYTES) {
    return fail(`That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`)
  }
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(certDocumentPath(userId, certId), file, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (error) {
      logger.warn('Upload failed:', error.message)
      return fail(error.message)
    }
    return succeed()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown upload error'
    logger.warn('uploadCertDocument error:', msg)
    return fail(msg)
  }
}

/**
 * True when a document is on file. Asked of the bucket rather than the row —
 * see the header note. A network failure answers FALSE rather than throwing: the
 * surface then offers an upload, which is recoverable, instead of a broken view
 * link, which is not.
 */
export async function hasCertDocument(userId: string, certId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(userId, { search: `${certId}.pdf`, limit: 1 })
    if (error) return false
    return (data ?? []).some(f => f.name === `${certId}.pdf`)
  } catch {
    return false
  }
}

/**
 * A short-lived signed URL for viewing. SIGNED, not public: the bucket is
 * private, and a public URL for a credential card would be a link anyone who
 * ever saw it could keep.
 */
export async function certDocumentUrl(
  userId: string,
  certId: string,
  expiresInSeconds = 120,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(certDocumentPath(userId, certId), expiresInSeconds)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch {
    return null
  }
}

/** Remove the card. Best-effort on a cert delete — a refused cleanup must not
 *  hold the row it accompanies, and an orphan blob is a storage cost, not a
 *  correctness problem. */
export async function removeCertDocument(userId: string, certId: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([certDocumentPath(userId, certId)])
  if (error) logger.warn('Failed to remove cert document:', error.message)
}
