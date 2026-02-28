/**
 * X3DH (Extended Triple Diffie-Hellman) key agreement.
 *
 * Establishes a shared secret between two parties who may not
 * be online simultaneously. The initiator uses the responder's
 * pre-key bundle (fetched from Supabase) to compute the secret
 * without any round trips.
 *
 * Protocol flow:
 *   Initiator (Alice):
 *     1. Fetch Bob's pre-key bundle from server
 *     2. Generate ephemeral ECDH key pair
 *     3. Compute DH1..DH4 and derive shared secret via HKDF
 *     4. Initialize Double Ratchet as sender
 *     5. Send initial message with identity key, ephemeral key, and pre-key IDs
 *
 *   Responder (Bob):
 *     1. Receive Alice's initial message
 *     2. Compute same DH operations using his private keys
 *     3. Derive same shared secret
 *     4. Initialize Double Ratchet as receiver
 *     5. Delete consumed one-time pre-key
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { SIGNAL } from '../constants'
import { performDh, importDhPublicKey, importSigningPublicKey, verifySignature } from './keyManager'
import { kdfX3dh } from './kdf'
import type { StoredLocalIdentity, PublicKeyBundle } from './types'

const logger = createLogger('SignalX3DH')

// ---- Helpers ----

/** Concatenate multiple Uint8Arrays into one. */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

// ---- Result Types ----

export interface X3dhInitiatorResult {
  /** 32-byte shared secret for Double Ratchet initialization. */
  sharedSecret: Uint8Array
  /** Associated data: concat(initiator DH identity, responder DH identity). */
  associatedData: Uint8Array
  /** Ephemeral public key to include in the initial message (raw base64). */
  ephemeralPublicKeyBase64: string
  /** Which signed pre-key was used. */
  signedPreKeyId: number
  /** Which one-time pre-key was consumed (null if none available). */
  oneTimePreKeyId: number | null
}

export interface X3dhResponderResult {
  /** Same 32-byte shared secret the initiator derived. */
  sharedSecret: Uint8Array
  /** Same associated data (initiator identity || responder identity). */
  associatedData: Uint8Array
}

// ---- Initiator ----

/**
 * Initiator side of X3DH.
 *
 * Computes:
 *   DH1 = ECDH(IKa_priv, SPKb)    — our identity × peer's signed pre-key
 *   DH2 = ECDH(EKa_priv, IKb)     — our ephemeral × peer's identity
 *   DH3 = ECDH(EKa_priv, SPKb)    — our ephemeral × peer's signed pre-key
 *   DH4 = ECDH(EKa_priv, OPKb)    — our ephemeral × peer's one-time pre-key (if available)
 *
 *   SK = HKDF(DH1 || DH2 || DH3 [|| DH4])
 *
 * @throws If signed pre-key signature verification fails
 */
export async function x3dhInitiate(
  ourIdentity: StoredLocalIdentity,
  peerBundle: PublicKeyBundle
): Promise<X3dhInitiatorResult> {
  // 1. Import and verify peer's keys
  const [peerIdentityDhKey, peerSignedPreKey, peerSigningKey] = await Promise.all([
    importDhPublicKey(peerBundle.identityDhKey),
    importDhPublicKey(peerBundle.signedPreKey.publicKey),
    importSigningPublicKey(peerBundle.identitySigningKey),
  ])

  // Verify the signed pre-key's signature against peer's signing key
  const spkBytes = base64ToUint8(peerBundle.signedPreKey.publicKey)
  const valid = await verifySignature(peerSigningKey, peerBundle.signedPreKey.signature, spkBytes)
  if (!valid) {
    throw new Error('Signed pre-key signature verification failed')
  }

  // 2. Generate ephemeral key pair
  const ephemeralPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: SIGNAL.CURVE } as EcKeyGenParams,
    true,
    ['deriveKey', 'deriveBits']
  )
  const ephemeralPubExported = await crypto.subtle.exportKey('raw', ephemeralPair.publicKey)
  const ephemeralPubBase64 = uint8ToBase64(new Uint8Array(ephemeralPubExported))

  // 3. Compute DH outputs
  const [dh1, dh2, dh3] = await Promise.all([
    performDh(ourIdentity.dhPrivateKey, peerSignedPreKey),     // IKa × SPKb
    performDh(ephemeralPair.privateKey, peerIdentityDhKey),    // EKa × IKb
    performDh(ephemeralPair.privateKey, peerSignedPreKey),     // EKa × SPKb
  ])

  let dhConcat: Uint8Array
  let usedOtpkId: number | null = null

  if (peerBundle.oneTimePreKeys.length > 0) {
    const otpk = peerBundle.oneTimePreKeys[0]
    const peerOtpk = await importDhPublicKey(otpk.publicKey)
    const dh4 = await performDh(ephemeralPair.privateKey, peerOtpk)  // EKa × OPKb
    dhConcat = concat(
      new Uint8Array(dh1), new Uint8Array(dh2),
      new Uint8Array(dh3), new Uint8Array(dh4)
    )
    usedOtpkId = otpk.keyId
  } else {
    dhConcat = concat(
      new Uint8Array(dh1), new Uint8Array(dh2), new Uint8Array(dh3)
    )
  }

  // 4. Derive shared secret
  const sharedSecret = await kdfX3dh(dhConcat)

  // 5. Build associated data (initiator identity || responder identity)
  const associatedData = concat(
    base64ToUint8(ourIdentity.dhPublicKeyBase64),
    base64ToUint8(peerBundle.identityDhKey)
  )

  logger.info('X3DH initiation complete')
  return {
    sharedSecret,
    associatedData,
    ephemeralPublicKeyBase64: ephemeralPubBase64,
    signedPreKeyId: peerBundle.signedPreKey.keyId,
    oneTimePreKeyId: usedOtpkId,
  }
}

// ---- Responder ----

/**
 * Responder side of X3DH.
 *
 * Computes the same DH operations as the initiator but with
 * swapped roles (our private keys × peer's public keys).
 *
 * @param ourIdentity - Our stored identity key pairs
 * @param signedPreKeyPair - The signed pre-key pair the initiator used
 * @param oneTimePreKeyPair - The one-time pre-key pair consumed (null if none)
 * @param peerIdentityDhKeyBase64 - Initiator's identity DH public key (raw base64)
 * @param peerEphemeralKeyBase64 - Initiator's ephemeral public key (raw base64)
 */
export async function x3dhRespond(
  ourIdentity: StoredLocalIdentity,
  signedPreKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey },
  oneTimePreKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null,
  peerIdentityDhKeyBase64: string,
  peerEphemeralKeyBase64: string
): Promise<X3dhResponderResult> {
  const [peerIdentityDhKey, peerEphemeralKey] = await Promise.all([
    importDhPublicKey(peerIdentityDhKeyBase64),
    importDhPublicKey(peerEphemeralKeyBase64),
  ])

  // Mirror the initiator's DH operations with swapped keys
  const [dh1, dh2, dh3] = await Promise.all([
    performDh(signedPreKeyPair.privateKey, peerIdentityDhKey),   // SPKb × IKa
    performDh(ourIdentity.dhPrivateKey, peerEphemeralKey),        // IKb × EKa
    performDh(signedPreKeyPair.privateKey, peerEphemeralKey),     // SPKb × EKa
  ])

  let dhConcat: Uint8Array

  if (oneTimePreKeyPair) {
    const dh4 = await performDh(oneTimePreKeyPair.privateKey, peerEphemeralKey)  // OPKb × EKa
    dhConcat = concat(
      new Uint8Array(dh1), new Uint8Array(dh2),
      new Uint8Array(dh3), new Uint8Array(dh4)
    )
  } else {
    dhConcat = concat(
      new Uint8Array(dh1), new Uint8Array(dh2), new Uint8Array(dh3)
    )
  }

  const sharedSecret = await kdfX3dh(dhConcat)

  // Associated data: initiator identity || responder identity (same order as initiator)
  const associatedData = concat(
    base64ToUint8(peerIdentityDhKeyBase64),
    base64ToUint8(ourIdentity.dhPublicKeyBase64)
  )

  logger.info('X3DH response complete')
  return { sharedSecret, associatedData }
}
