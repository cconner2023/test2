/**
 * Key derivation functions for Signal Protocol.
 *
 * Implements:
 * - HKDF (RFC 5869) for X3DH shared secret derivation and root key ratchet
 * - HMAC-SHA256 chain key ratchet for message key derivation
 *
 * Uses Web Crypto API exclusively (zero external dependencies).
 */

import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'

// ---- Info strings (application-specific context for domain separation) ----

const RATCHET_INFO = new TextEncoder().encode('adtmc-ratchet')
const X3DH_INFO = new TextEncoder().encode('adtmc-x3dh')

// ---- HKDF (RFC 5869) ----

/**
 * HKDF using SHA-256.
 *
 * @param ikm - Input key material (BufferSource)
 * @param salt - Salt value
 * @param info - Application-specific context
 * @param lengthBytes - Output length in bytes
 */
async function hkdf(
  ikm: BufferSource,
  salt: Uint8Array,
  info: Uint8Array,
  lengthBytes: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', ikm, 'HKDF', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    lengthBytes * 8
  )
  return new Uint8Array(derived)
}

// ---- Root Key Ratchet (KDF_RK) ----

/**
 * KDF_RK: Root key ratchet step.
 *
 * Uses HKDF with the current root key as salt and the ECDH
 * output as input key material. Produces a new root key (32 bytes)
 * and a chain key (32 bytes).
 *
 * @param rootKey - Current root key (base64)
 * @param dhOutput - Raw ECDH shared secret (ArrayBuffer from performDh)
 */
export async function kdfRootKey(
  rootKey: string,
  dhOutput: ArrayBuffer
): Promise<{ rootKey: string; chainKey: string }> {
  const salt = base64ToUint8(rootKey)
  const derived = await hkdf(dhOutput, salt, RATCHET_INFO, 64)
  return {
    rootKey: uint8ToBase64(derived.slice(0, 32)),
    chainKey: uint8ToBase64(derived.slice(32, 64)),
  }
}

// ---- Chain Key Ratchet (KDF_CK) ----

/**
 * KDF_CK: Chain key ratchet step.
 *
 * Uses HMAC-SHA256 to derive a message key and advance the chain:
 * - HMAC(ck, 0x01) → message key (used once, then discarded)
 * - HMAC(ck, 0x02) → next chain key
 *
 * @param chainKey - Current chain key (base64)
 */
export async function kdfChainKey(
  chainKey: string
): Promise<{ chainKey: string; messageKey: Uint8Array }> {
  const ckBytes = base64ToUint8(chainKey)
  const hmacKey = await crypto.subtle.importKey(
    'raw', ckBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )

  const [mkBuffer, ckBuffer] = await Promise.all([
    crypto.subtle.sign('HMAC', hmacKey, new Uint8Array([0x01])),
    crypto.subtle.sign('HMAC', hmacKey, new Uint8Array([0x02])),
  ])

  return {
    messageKey: new Uint8Array(mkBuffer),
    chainKey: uint8ToBase64(new Uint8Array(ckBuffer)),
  }
}

// ---- X3DH Shared Secret Derivation ----

/**
 * Derive the shared secret from concatenated X3DH DH outputs.
 *
 * Uses HKDF with a zero salt (no pre-shared secret) and
 * application-specific info string for domain separation.
 *
 * @param dhOutputs - Concatenated DH outputs (96 or 128 bytes for 3 or 4 DH ops)
 * @returns 32-byte shared secret for Double Ratchet initialization
 */
export async function kdfX3dh(dhOutputs: Uint8Array): Promise<Uint8Array> {
  const zeroSalt = new Uint8Array(32)
  return hkdf(dhOutputs, zeroSalt, X3DH_INFO, 32)
}
