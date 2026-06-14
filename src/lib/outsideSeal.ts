/**
 * Standalone seal/open for the OUTSIDE-SESSION reply lane: ECDH P-256 → HKDF-
 * SHA256 → AES-256-GCM, built directly on WebCrypto. Used in BOTH bundles —
 * cluster-side (`outsideSessionService` seals a reply to the outside tab's public
 * key) and anon-side (`OutsideSessionView` opens it with the in-heap private
 * key).
 *
 * Imports ONLY anon-safe primitives (aesGcm, base64Utils) — NOTHING from
 * `src/lib/signal/*`. This is the deliberate replacement for the retired
 * `oncallSeal.ts` (whose ECDH lived in the signal core, off-limits to the anon
 * bundle). It is NOT signal-protocol crypto: single-shot ephemeral-static ECIES,
 * no ratchet, no identity — appropriate for a one-direction seal to an ephemeral
 * tab key. No-PHI-on-the-wire still applies to the plaintext (operational only).
 */

import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm'
import { base64ToBytes, bytesToBase64 } from './base64Utils'

/** Sealed envelope: ephemeral public key + IV‖ciphertext, both base64. */
export interface SealedPayload {
  /** base64 ephemeral P-256 SPKI public key (the static-side derives the shared secret from this). */
  epk: string
  /** base64 of (12-byte IV ‖ AES-256-GCM ciphertext). */
  ct: string
}

const HKDF_INFO = new TextEncoder().encode('beacon-outside-session-v1')

function importSpkiPub(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', base64ToBytes(b64) as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
}

/** ECDH(priv, pub) → 32-byte shared secret → HKDF → AES-256-GCM key. */
async function deriveAesKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0) as BufferSource, info: HKDF_INFO as BufferSource },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Cluster→outside: seal `plaintext` to the outside session's public key. A fresh
 * ephemeral keypair is generated per call (forward-secrecy per message); only its
 * public half ships, so the static recipient can derive the same AES key.
 */
export async function sealToOutsidePub(outsidePubB64: string, plaintext: string): Promise<SealedPayload> {
  const recipientPub = await importSpkiPub(outsidePubB64)
  const eph = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const aesKey = await deriveAesKey(eph.privateKey, recipientPub)
  const ct = await aesGcmEncrypt(aesKey, new TextEncoder().encode(plaintext))
  const epk = await crypto.subtle.exportKey('spki', eph.publicKey)
  return { epk: bytesToBase64(new Uint8Array(epk)), ct: bytesToBase64(ct) }
}

/**
 * Outside side: open a sealed payload with the tab's in-heap session private key.
 * Throws on tamper / wrong key (AES-GCM auth failure) — the caller drops it.
 */
export async function openSealed(privateKey: CryptoKey, sealed: SealedPayload): Promise<string> {
  const epk = await importSpkiPub(sealed.epk)
  const aesKey = await deriveAesKey(privateKey, epk)
  const pt = await aesGcmDecrypt(aesKey, base64ToBytes(sealed.ct))
  return new TextDecoder().decode(pt)
}
