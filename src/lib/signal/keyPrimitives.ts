/**
 * Shared Signal Protocol crypto primitives.
 *
 * Pure, identity-agnostic functions used by both keyManager.ts (personal device
 * identity) and clinicKeyManager.ts (clinic device identity). Operates on raw
 * CryptoKey material and base64 strings — no IDB, no caches, no domain state.
 *
 * Security model is documented in keyManager.ts. Keys are generated with
 * extractable=true because IDB structured-clone serialization requires it;
 * private keys never leave the device.
 */

import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { SIGNAL } from '../constants'

// ---- Curve Parameters ----

export const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: SIGNAL.CURVE }
export const ECDSA_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: SIGNAL.CURVE }
export const ECDSA_SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' }

// ---- Key Generation ----

/** Generate an ECDH P-256 key pair for Diffie-Hellman key agreement. */
export async function generateDhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
}

/** Generate an ECDSA P-256 key pair for digital signatures. */
export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify'])
}

// ---- Key Export / Import ----

/** Export a public CryptoKey to base64. ECDH keys use 'raw' (65 bytes,
 *  uncompressed point); ECDSA keys use 'spki' (DER SubjectPublicKeyInfo). */
export async function exportPublicKey(
  key: CryptoKey,
  format: 'raw' | 'spki' = 'raw'
): Promise<string> {
  const exported = await crypto.subtle.exportKey(format, key)
  return uint8ToBase64(new Uint8Array(exported))
}

/** Import a peer's ECDH public key from base64 (raw format). */
export async function importDhPublicKey(base64: string): Promise<CryptoKey> {
  const keyBytes = base64ToUint8(base64)
  return crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    ECDH_PARAMS,
    true,
    []
  )
}

/** Import a peer's ECDSA public key from base64 (SPKI format). */
export async function importSigningPublicKey(base64: string): Promise<CryptoKey> {
  const keyBytes = base64ToUint8(base64)
  return crypto.subtle.importKey(
    'spki',
    keyBytes.buffer as ArrayBuffer,
    ECDSA_PARAMS,
    true,
    ['verify']
  )
}

// ---- Signing / Verification ----

/** Sign data with an ECDSA private key. Returns base64 signature. */
export async function signBytes(privateKey: CryptoKey, data: Uint8Array): Promise<string> {
  const signature = await crypto.subtle.sign(ECDSA_SIGN_PARAMS, privateKey, data as BufferSource)
  return uint8ToBase64(new Uint8Array(signature))
}

/** Verify an ECDSA signature against a public key. */
export async function verifySignature(
  publicKey: CryptoKey,
  signatureBase64: string,
  data: Uint8Array
): Promise<boolean> {
  const sigBytes = base64ToUint8(signatureBase64)
  return crypto.subtle.verify(ECDSA_SIGN_PARAMS, publicKey, sigBytes as BufferSource, data as BufferSource)
}

// ---- Key Agreement (ECDH) ----

/** Perform raw ECDH key agreement. Returns 256 bits of shared secret material. */
export async function performDh(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256
  )
}

// ---- Peer Identity Key Helpers ----

/** Build a compound identity key (userId:deviceId) for peer identity storage. */
export function makePeerIdentityKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}
