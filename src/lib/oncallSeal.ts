/**
 * On-call voicemail crypto — anon-bundle-safe (imports ONLY aesGcm + base64Utils,
 * NO `src/lib/signal/*`). Used by the outside bundle (seal/encrypt) and the medic
 * side (unseal/decrypt).
 *
 * Model (mirrors the removed signalingCrypto.ts approach, P-256 throughout to
 * match the repo's WebCrypto ECDH style — no pgsodium/noble):
 *   1. The voicemail audio blob is encrypted with a fresh random AES-256-GCM key K.
 *   2. K is sealed to the clinic's voicemail public key (`oncall_recipient_pub`,
 *      an SPKI P-256 ECDH pubkey): ephemeral ECDH → HKDF-SHA256 → AES-GCM wrap.
 *   3. Server stores only ciphertext (audio) + the sealed K + ephemeral pub + salt.
 *
 * The clinic voicemail PRIVATE key is generated in the supervisor's browser and
 * wrapped to each cluster member's Signal vault (see src/lib/signal/oncallKeyWrap.ts).
 * Decryption capability therefore = cluster membership; this module never touches
 * Signal — it only consumes a P-256 private CryptoKey the caller already unwrapped.
 */

import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm'
import { base64ToBytes, bytesToBase64 } from './base64Utils'

const HKDF_INFO = new TextEncoder().encode('beacon-oncall-voicemail')

export interface SealedKey {
  /** base64(IV ‖ AES-GCM ciphertext) of the wrapped audio key K. */
  sealed_key: string
  /** base64(raw 65-byte ephemeral P-256 public key). */
  ephemeral_pub: string
  /** base64(16-byte HKDF salt). */
  nonce: string
}

async function deriveWrapKey(
  sharedBits: ArrayBuffer,
  salt: Uint8Array,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const hk = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: HKDF_INFO },
    hk,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

/** Generate a fresh AES-256-GCM key for one voicemail blob. */
export async function generateAudioKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

/**
 * Generate the clinic voicemail keypair (supervisor side, GATE-2 first enable).
 * The public SPKI goes to the server (`oncall_recipient_pub`); the private PKCS8
 * is wrapped to each cluster member's vault and NEVER reaches the server.
 */
export async function generateVoicemailKeypair(): Promise<{ privPkcs8B64: string; pubSpkiB64: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const priv = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const pub = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey))
  return { privPkcs8B64: bytesToBase64(priv), pubSpkiB64: bytesToBase64(pub) }
}

/** Re-import the clinic voicemail private key (PKCS8 base64) for unsealing. */
export async function importVoicemailPrivateKey(privPkcs8B64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    base64ToBytes(privPkcs8B64) as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )
}

/** Encrypt the audio blob with K → base64(IV ‖ ciphertext). */
export async function encryptAudio(key: CryptoKey, blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const out = await aesGcmEncrypt(key, bytes)
  return bytesToBase64(out)
}

/** Decrypt base64(IV ‖ ciphertext) with K → a Blob of the given mime. */
export async function decryptAudio(key: CryptoKey, audioB64: string, mime: string): Promise<Blob> {
  const pt = await aesGcmDecrypt(key, base64ToBytes(audioB64))
  return new Blob([pt as BlobPart], { type: mime || 'audio/webm' })
}

/** Encrypt a UTF-8 text body with K → base64(IV ‖ ciphertext). Sibling of encryptAudio
 *  for the outside→cluster one-way message (same seal envelope as voicemail). */
export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const out = await aesGcmEncrypt(key, new TextEncoder().encode(text))
  return bytesToBase64(out)
}

/** Decrypt base64(IV ‖ ciphertext) with K → the UTF-8 text body. */
export async function decryptText(key: CryptoKey, cipherB64: string): Promise<string> {
  const pt = await aesGcmDecrypt(key, base64ToBytes(cipherB64))
  return new TextDecoder().decode(pt as BufferSource)
}

/** Seal the raw audio key K to the clinic voicemail SPKI public key. */
export async function sealAudioKey(audioKey: CryptoKey, recipientSpkiB64: string): Promise<SealedKey> {
  const rawK = new Uint8Array(await crypto.subtle.exportKey('raw', audioKey))
  const recipientPub = await crypto.subtle.importKey(
    'spki',
    base64ToBytes(recipientSpkiB64) as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientPub }, eph.privateKey, 256)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const wrapKey = await deriveWrapKey(shared, salt, 'encrypt')
  const sealed = await aesGcmEncrypt(wrapKey, rawK)
  const ephRaw = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey))
  return {
    sealed_key: bytesToBase64(sealed),
    ephemeral_pub: bytesToBase64(ephRaw),
    nonce: bytesToBase64(salt),
  }
}

/**
 * Seal the raw key K to a recipient's RAW (65-byte uncompressed) P-256 ECDH public
 * key — the format a Signal vault `identity_dh_key` is stored in. Sibling of
 * sealAudioKey (which imports an SPKI pubkey); shares the same ephemeral-ECDH →
 * HKDF → AES-GCM envelope, so unsealAudioKey opens it with the recipient's vault DH
 * private key. Used for per-supervisor event-intake seals (no on-call key involved).
 */
export async function sealKeyToRawP256(key: CryptoKey, recipientRawB64: string): Promise<SealedKey> {
  const rawK = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  const recipientPub = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(recipientRawB64) as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientPub }, eph.privateKey, 256)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const wrapKey = await deriveWrapKey(shared, salt, 'encrypt')
  const sealed = await aesGcmEncrypt(wrapKey, rawK)
  const ephRaw = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey))
  return {
    sealed_key: bytesToBase64(sealed),
    ephemeral_pub: bytesToBase64(ephRaw),
    nonce: bytesToBase64(salt),
  }
}

/**
 * Unseal the audio key K using the clinic voicemail PRIVATE key (a P-256 ECDH
 * CryptoKey the medic already unwrapped from their vault) — also opens a
 * sealKeyToRawP256 envelope with a supervisor's vault DH private key.
 */
export async function unsealAudioKey(sealed: SealedKey, recipientPriv: CryptoKey): Promise<CryptoKey> {
  const ephPub = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(sealed.ephemeral_pub) as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephPub }, recipientPriv, 256)
  const wrapKey = await deriveWrapKey(shared, base64ToBytes(sealed.nonce), 'decrypt')
  const rawK = await aesGcmDecrypt(wrapKey, base64ToBytes(sealed.sealed_key))
  return crypto.subtle.importKey('raw', rawK as BufferSource, { name: 'AES-GCM', length: 256 }, true, ['decrypt'])
}
