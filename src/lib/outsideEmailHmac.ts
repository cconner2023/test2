/**
 * Deterministic keyed hash of a recipient email for the OUTBOUND outside-entity
 * channel, stored as `outside_entities.email_hmac`. Used for DEDUPE LOOKUP ONLY
 * (so a medic can be warned they already have an open channel to an address) —
 * never for authentication, never reversed.
 *
 *   pepper     = HKDF-SHA256(ikm=clinic_encryption_key, salt='…email-pepper', info='v1')
 *   email_hmac = HMAC-SHA256(normalize(email), pepper)  → hex
 *
 * The pepper lives in the clinic's shared E2E key material (clinics.encryption_key),
 * so the SERVER — which stores only the HMAC — can neither reverse it nor mount an
 * offline dictionary attack over candidate addresses. The plaintext email lives
 * only in the medic's E2E card (see OutsideEntityContent) and transiently in the
 * invite edge fn.
 *
 * Imports NOTHING from `src/lib/signal/*`. NOTE (accepted): the pepper is derived
 * from clinics.encryption_key, which is rotatable (cryptoService.rotateClinicKey).
 * A rotation changes the pepper, so pre-rotation email_hmac values stop matching —
 * dedupe is best-effort, which is fine given outside_entities are hard-purged at
 * 24h anyway.
 */

import { base64ToBytes } from './base64Utils'

const enc = (s: string) => new TextEncoder().encode(s)

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

/**
 * Compute the dedupe HMAC for `email` under the clinic's key material. Pass the
 * raw base64 clinic key from `cryptoService.getClinicRawKeyBase64(clinicId)`.
 */
export async function computeEmailHmac(email: string, clinicRawKeyBase64: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const ikm = base64ToBytes(clinicRawKeyBase64)
  const base = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  const pepperBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc('beacon-outside-entity-email-pepper') as BufferSource,
      info: enc('v1') as BufferSource,
    },
    base,
    256,
  )
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    pepperBits,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', hmacKey, enc(normalized) as BufferSource)
  return bytesToHex(new Uint8Array(sig))
}
