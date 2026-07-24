/**
 * Key-wrap for the OUTBOUND outside-entity channel ("reverse Doximity, over
 * email"). Distinct from the inbound outside-SESSION lane: there the outside
 * party generates an ephemeral key that dies on reload; here the medic generates
 * the outside keypair up front, wraps the PRIVATE half under a password-derived
 * key, and the server stores the wrapped blob so the outside party can re-open
 * the same channel across reloads for the 24h window — WITHOUT the outside side
 * ever touching IndexedDB.
 *
 * The wrap key W = HKDF(fragment_secret, salt=code):
 *   • fragment_secret rides in the invite URL `#k=` — never sent to the server
 *     by the outside browser at open time (fragments aren't transmitted).
 *   • code is emailed separately and is an INDEPENDENT bcrypt authenticator
 *     server-side (open_outside_entity gates on code_hash). The server stores
 *     neither the fragment nor the code, only bcrypt(code) — so it can neither
 *     unwrap the key nor brute the wrap offline.
 *
 * Used in BOTH bundles: the cluster/medic side (compose) WRAPS at create time;
 * the anon intake bundle UNWRAPS after the code prompt. Imports ONLY anon-safe
 * primitives — NOTHING from `src/lib/signal/*` (bundle firewall). This is not
 * signal-protocol crypto; message sealing itself is the sibling `outsideSeal.ts`
 * ephemeral-static ECIES. No-PHI-on-the-wire still governs the plaintext.
 */

import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm'
import { base64ToBytes, bytesToBase64 } from './base64Utils'

/** Server-stored wrapped private key. `blob` = base64(12-byte IV ‖ AES-256-GCM ct of the PKCS8 key). */
export interface WrappedOutsidePriv {
  v: 1
  blob: string
}

const WRAP_INFO = new TextEncoder().encode('beacon-outside-entity-wrap-v1')

/**
 * Derive the AES-256-GCM wrap key W = HKDF-SHA256(ikm=fragment_secret,
 * salt=code). Both inputs are treated as opaque UTF-8 strings; the two bundles
 * MUST derive identically. The code is the salt (independent authenticator), the
 * fragment the keying material (never reaches the server).
 */
async function deriveWrapKey(fragmentSecret: string, code: string): Promise<CryptoKey> {
  const ikm = new TextEncoder().encode(fragmentSecret)
  const salt = new TextEncoder().encode(code)
  const base = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: WRAP_INFO as BufferSource },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** The outside keypair the medic mints. `publicKeyB64` is the seal target stored as `outside_pub`. */
export interface OutsideKeypair {
  privateKey: CryptoKey
  publicKeyB64: string
}

/**
 * Generate the outside party's ECDH P-256 keypair (medic side, create time). The
 * private key is `extractable` so it can be exported+wrapped once; the medic
 * discards it immediately after wrapping — only the wrapped blob (server) and the
 * public key survive.
 */
export async function generateOutsideKeypair(): Promise<OutsideKeypair> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
  return { privateKey: pair.privateKey, publicKeyB64: bytesToBase64(new Uint8Array(spki)) }
}

/**
 * Medic side: wrap the outside PRIVATE key under W for server storage. Exports
 * the key as PKCS8, AES-GCM-encrypts under W, returns the jsonb blob written to
 * `outside_entities.wrapped_outside_priv`.
 */
export async function wrapOutsidePriv(
  privateKey: CryptoKey,
  fragmentSecret: string,
  code: string,
): Promise<WrappedOutsidePriv> {
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey))
  const W = await deriveWrapKey(fragmentSecret, code)
  const sealed = await aesGcmEncrypt(W, pkcs8)
  return { v: 1, blob: bytesToBase64(sealed) }
}

/**
 * Anon side: unwrap the outside private key after the code prompt. Re-derives W,
 * AES-GCM-decrypts (throws on wrong code/fragment or tamper), and imports the
 * PKCS8 as a NON-extractable ECDH deriveBits key — heap-only, never re-exportable,
 * dies with the tab. The caller keeps it in memory only (zero IDB).
 */
export async function unwrapOutsidePriv(
  wrapped: WrappedOutsidePriv,
  fragmentSecret: string,
  code: string,
): Promise<CryptoKey> {
  const W = await deriveWrapKey(fragmentSecret, code)
  const pkcs8 = await aesGcmDecrypt(W, base64ToBytes(wrapped.blob))
  return crypto.subtle.importKey('pkcs8', pkcs8 as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
}
