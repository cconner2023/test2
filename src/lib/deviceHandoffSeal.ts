/**
 * Standalone seal/open for the DEVICE-HANDOFF lane (Option A — "bootstrap a new
 * device's vault + history from an existing unlocked device, no password").
 * ECDH P-256 → HKDF-SHA256 → AES-256-GCM, built directly on WebCrypto.
 *
 * WHY THIS EXISTS / THE INVARIANT IT PROTECTS: the device-link Realtime channel
 * and the temp `device-handoff` storage bucket both route THROUGH Supabase. The
 * vault contents we hand off (decrypted vault key-material + message history) must
 * NEVER be readable by the server (no BAA, zero-knowledge). So the bundle is
 * sealed to an EPHEMERAL public key the linkee mints locally and ships in the QR;
 * the linker encrypts to that scanned key; only the linkee's in-heap private key
 * can open it. Supabase sees opaque ciphertext + a public key it can't use. The
 * QR (physically scanned) is what authenticates the key — a malicious relay can't
 * substitute its own pubkey for a relayed one.
 *
 * Mirrors `outsideSeal.ts` (single-shot ephemeral-static ECIES). Imports ONLY
 * anon-safe primitives (aesGcm, base64Utils) — NOTHING from `src/lib/signal/*`.
 * NOT signal-protocol crypto: no ratchet, no identity, no forward secrecy beyond
 * the per-handoff ephemeral pair. The plaintext is the user's OWN data moving
 * device→device, but no-PHI-on-the-wire still applies to anything sealed here.
 */

import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm'
import { base64ToBytes, bytesToBase64 } from './base64Utils'

/** Sealed bundle: linker's ephemeral public key + IV‖ciphertext, both base64. */
export interface HandoffSealed {
  /** base64 ephemeral P-256 SPKI public key (linkee derives the shared secret from this). */
  epk: string
  /** base64 of (12-byte IV ‖ AES-256-GCM ciphertext). */
  ct: string
}

/** The linkee's per-handoff keypair: public half goes in the QR, private stays in heap. */
export interface HandoffKeypair {
  /** base64 SPKI public key — encode into the QR for the linker to seal against. */
  publicKeyB64: string
  /** Non-extractable ECDH private key — held only in the linkee's heap for the handoff window. */
  privateKey: CryptoKey
}

const HKDF_INFO = new TextEncoder().encode('beacon-device-handoff-v1')

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
 * Linkee (new device): mint the per-handoff keypair. The private key is
 * non-extractable and never leaves the heap; only `publicKeyB64` is shared (in
 * the QR). Public-key export works regardless of the non-extractable flag.
 */
export async function generateHandoffKeypair(): Promise<HandoffKeypair> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )) as CryptoKeyPair
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
  return { publicKeyB64: bytesToBase64(new Uint8Array(spki)), privateKey: pair.privateKey }
}

/**
 * Linker (existing unlocked device): seal `plaintext` to the linkee's QR public
 * key. A fresh ephemeral keypair is generated per call; only its public half
 * ships, so the linkee derives the same AES key. `plaintext` may be large
 * (~hundreds of KB of vault JWKs + history) — the sealed bundle goes to the temp
 * `device-handoff` bucket, never over Realtime.
 */
export async function sealToHandoffPub(linkeePubB64: string, plaintext: string): Promise<HandoffSealed> {
  const recipientPub = await importSpkiPub(linkeePubB64)
  const eph = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const aesKey = await deriveAesKey(eph.privateKey, recipientPub)
  const ct = await aesGcmEncrypt(aesKey, new TextEncoder().encode(plaintext))
  const epk = await crypto.subtle.exportKey('spki', eph.publicKey)
  return { epk: bytesToBase64(new Uint8Array(epk)), ct: bytesToBase64(ct) }
}

/**
 * Linkee: open a sealed bundle with the in-heap handoff private key. Throws on
 * tamper / wrong key (AES-GCM auth failure) — the caller drops it.
 */
export async function openHandoffSealed(privateKey: CryptoKey, sealed: HandoffSealed): Promise<string> {
  const epk = await importSpkiPub(sealed.epk)
  const aesKey = await deriveAesKey(privateKey, epk)
  const pt = await aesGcmDecrypt(aesKey, base64ToBytes(sealed.ct))
  return new TextDecoder().decode(pt)
}
