/**
 * Signal Protocol key management — public API.
 *
 * Handles identity key generation, pre-key bundle management,
 * peer key import, and raw ECDH key agreement. Uses Web Crypto API
 * exclusively (zero external dependencies), following the same
 * patterns as cryptoService.ts.
 *
 * Key types:
 * - Identity signing key (ECDSA P-256): signs pre-keys, long-lived
 * - Identity DH key (ECDH P-256): participates in X3DH, long-lived
 * - Signed pre-key (ECDH P-256): medium-lived, rotated periodically
 * - One-time pre-keys (ECDH P-256): ephemeral, consumed on contact
 *
 * Security model:
 * - Key pairs are generated with extractable=true because:
 *   (a) Public keys must be exported for server upload, and
 *   (b) IndexedDB structured-clone serialization requires extractable keys.
 *   When keys are loaded FROM storage for operational use (e.g., in-memory
 *   cache), they retain extractable=true due to this IDB constraint.
 *   IMPORTANT: Private keys never leave the device — they are stored in
 *   IndexedDB (same-origin protected) and only used via crypto.subtle
 *   operations. If a future migration moves to a non-IDB store (e.g.,
 *   WebAuthn PRF or opaque key wrapping), keys should be re-imported
 *   with extractable=false.
 * - Memory cache for hot-path identity key access.
 * - IndexedDB for offline persistence (adtmc-signal-store).
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { SIGNAL } from '../constants'
import * as store from './keyStore'
import type {
  StoredLocalIdentity,
  StoredPreKey,
  StoredSignedPreKey,
  StoredPeerIdentity,
  PublicKeyBundle,
} from './types'

const logger = createLogger('SignalKeyManager')

// ---- In-Memory Cache ----

let cachedIdentity: StoredLocalIdentity | null = null

// ---- Curve Parameters ----

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: SIGNAL.CURVE }
const ECDSA_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: SIGNAL.CURVE }
const ECDSA_SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' }

// ---- Key Generation Primitives ----

/**
 * Generate an ECDH P-256 key pair for Diffie-Hellman key agreement.
 *
 * NOTE: Keys are generated with extractable=true because IndexedDB
 * structured-clone requires it for persistence. See module-level
 * security model comment for details.
 */
async function generateDhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
}

/**
 * Generate an ECDSA P-256 key pair for digital signatures.
 *
 * NOTE: Keys are generated with extractable=true because IndexedDB
 * structured-clone requires it for persistence. See module-level
 * security model comment for details.
 */
async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify'])
}

// ---- Key Export / Import ----

/** Export a public CryptoKey to base64.
 *  ECDH keys use 'raw' format (65 bytes, uncompressed point).
 *  ECDSA keys use 'spki' format (DER-encoded SubjectPublicKeyInfo). */
async function exportPublicKey(
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
    []  // public keys: no usage flags needed (private key does deriveKey)
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
async function signBytes(privateKey: CryptoKey, data: Uint8Array): Promise<string> {
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

// ---- Identity Key Management ----

/**
 * Get the local identity, loading from IndexedDB if not cached.
 * Returns null if no identity has been generated yet.
 */
export async function getLocalIdentity(): Promise<StoredLocalIdentity | null> {
  if (cachedIdentity) return cachedIdentity

  const stored = await store.loadLocalIdentity()
  if (stored) {
    cachedIdentity = stored
  }
  return stored
}

/**
 * Generate a new local identity key pair.
 *
 * Creates both an ECDSA signing key pair (for signing pre-keys) and
 * an ECDH key pair (for X3DH key agreement). Stores in IndexedDB
 * and caches in memory.
 *
 * WARNING: Calling this when an identity already exists will overwrite
 * it, invalidating all existing sessions. Check getLocalIdentity()
 * first, or use ensureLocalIdentity() for safe initialization.
 */
export async function generateLocalIdentity(): Promise<StoredLocalIdentity> {
  logger.info('Generating new local identity key pair')

  const [signingPair, dhPair] = await Promise.all([
    generateSigningKeyPair(),
    generateDhKeyPair(),
  ])

  const [signingPubBase64, dhPubBase64] = await Promise.all([
    exportPublicKey(signingPair.publicKey, 'spki'),
    exportPublicKey(dhPair.publicKey, 'raw'),
  ])

  const identity: StoredLocalIdentity = {
    deviceId: crypto.randomUUID(),
    signingPublicKey: signingPair.publicKey,
    signingPrivateKey: signingPair.privateKey,
    dhPublicKey: dhPair.publicKey,
    dhPrivateKey: dhPair.privateKey,
    signingPublicKeyBase64: signingPubBase64,
    dhPublicKeyBase64: dhPubBase64,
    nextPreKeyId: 1,
    createdAt: new Date().toISOString(),
  }

  await store.saveLocalIdentity(identity)
  cachedIdentity = identity

  logger.info('Local identity generated and stored')
  return identity
}

/**
 * Ensure local identity exists, generating one if needed.
 * Safe to call multiple times — idempotent.
 * Backfills deviceId on existing identities that predate multi-device.
 */
export async function ensureLocalIdentity(): Promise<StoredLocalIdentity> {
  const existing = await getLocalIdentity()
  if (existing) {
    // Backfill deviceId for pre-multi-device identities
    if (!existing.deviceId) {
      existing.deviceId = crypto.randomUUID()
      await store.saveLocalIdentity(existing)
      cachedIdentity = existing
      logger.info('Backfilled deviceId on existing identity')
    }
    return existing
  }
  return generateLocalIdentity()
}

/**
 * Get the local device ID. Returns null if no identity exists.
 */
export async function getLocalDeviceId(): Promise<string | null> {
  const identity = await getLocalIdentity()
  return identity?.deviceId ?? null
}

// ---- Pre-Key Management ----

/**
 * Generate a batch of one-time pre-keys.
 *
 * Pre-keys are ECDH key pairs identified by monotonically increasing
 * keyIds (tracked via identity.nextPreKeyId). The server stores only
 * public components; private keys stay local. A pre-key is consumed
 * (removed) when a peer uses it to establish a session.
 *
 * @param count - Number of pre-keys to generate (default: SIGNAL.PREKEY_BATCH_SIZE)
 */
export async function generatePreKeys(
  count: number = SIGNAL.PREKEY_BATCH_SIZE
): Promise<StoredPreKey[]> {
  const identity = await ensureLocalIdentity()
  const startId = identity.nextPreKeyId

  logger.info(`Generating ${count} pre-keys starting at ID ${startId}`)

  const preKeys: StoredPreKey[] = []
  const now = new Date().toISOString()

  for (let i = 0; i < count; i++) {
    const keyId = startId + i
    const keyPair = await generateDhKeyPair()
    const publicKeyBase64 = await exportPublicKey(keyPair.publicKey, 'raw')

    preKeys.push({
      keyId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      publicKeyBase64,
      createdAt: now,
    })
  }

  await store.savePreKeys(preKeys)

  // Advance the counter so future batches don't reuse IDs
  identity.nextPreKeyId = startId + count
  await store.saveLocalIdentity(identity)
  cachedIdentity = identity

  logger.info(`Generated and stored ${count} pre-keys`)
  return preKeys
}

/**
 * Consume a pre-key (remove from local store after peer uses it).
 * Called when a peer uses one of our pre-keys to initiate a session.
 * Returns the pre-key for session setup, or null if not found.
 */
export async function consumePreKey(keyId: number): Promise<StoredPreKey | null> {
  const preKey = await store.loadPreKey(keyId)
  if (!preKey) {
    logger.warn(`Pre-key ${keyId} not found (already consumed or never existed)`)
    return null
  }

  await store.removePreKey(keyId)
  return preKey
}

/** Get the count of remaining unused pre-keys. */
export async function getPreKeyCount(): Promise<number> {
  const ids = await store.getAllPreKeyIds()
  return ids.length
}

// ---- Signed Pre-Key Management ----

/**
 * Generate a new signed pre-key.
 *
 * The signed pre-key is an ECDH key pair whose public component is
 * signed by our identity signing key. This allows peers to verify
 * the pre-key belongs to us without direct communication.
 *
 * Signed pre-keys are rotated periodically (SIGNAL.SIGNED_PREKEY_ROTATION_DAYS)
 * but old ones are kept until all sessions using them are established.
 *
 * @param keyId - Explicit key ID, or auto-increments from latest
 */
export async function generateSignedPreKey(keyId?: number): Promise<StoredSignedPreKey> {
  const identity = await ensureLocalIdentity()
  const id = keyId ?? (await store.getLatestSignedPreKeyId()) + 1

  logger.info(`Generating signed pre-key with ID ${id}`)

  const keyPair = await generateDhKeyPair()
  const publicKeyBase64 = await exportPublicKey(keyPair.publicKey, 'raw')

  // Sign the raw public key bytes with our identity signing key
  const publicKeyBytes = base64ToUint8(publicKeyBase64)
  const signatureBase64 = await signBytes(identity.signingPrivateKey, publicKeyBytes)

  const spk: StoredSignedPreKey = {
    keyId: id,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyBase64,
    signatureBase64,
    createdAt: new Date().toISOString(),
  }

  await store.saveSignedPreKey(spk)
  logger.info(`Signed pre-key ${id} generated and stored`)

  return spk
}

// ---- Public Key Bundle ----

/**
 * Assemble a public key bundle for upload to Supabase.
 *
 * The bundle contains only public key material — no private keys.
 * Peers fetch this bundle to initiate X3DH key agreement.
 * Returns null if identity or signed pre-key is not yet generated.
 */
export async function assemblePublicKeyBundle(
  userId: string,
  deviceId?: string
): Promise<PublicKeyBundle | null> {
  const identity = await getLocalIdentity()
  if (!identity) {
    logger.warn('Cannot assemble bundle: no local identity')
    return null
  }

  const latestSpkId = await store.getLatestSignedPreKeyId()
  if (latestSpkId === 0) {
    logger.warn('Cannot assemble bundle: no signed pre-key')
    return null
  }

  const spk = await store.loadSignedPreKey(latestSpkId)
  if (!spk) {
    logger.warn('Cannot assemble bundle: signed pre-key not found')
    return null
  }

  // Collect available one-time pre-keys
  const preKeyIds = await store.getAllPreKeyIds()
  const oneTimePreKeys: PublicKeyBundle['oneTimePreKeys'] = []

  for (const keyId of preKeyIds) {
    const pk = await store.loadPreKey(keyId)
    if (pk) {
      oneTimePreKeys.push({
        keyId: pk.keyId,
        publicKey: pk.publicKeyBase64,
      })
    }
  }

  return {
    userId,
    deviceId: deviceId ?? identity.deviceId,
    identitySigningKey: identity.signingPublicKeyBase64,
    identityDhKey: identity.dhPublicKeyBase64,
    signedPreKey: {
      keyId: spk.keyId,
      publicKey: spk.publicKeyBase64,
      signature: spk.signatureBase64,
    },
    oneTimePreKeys,
  }
}

// ---- Peer Identity Management ----

/** Build a compound identity key for peer identity storage. */
function makePeerIdentityKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

/**
 * Store a peer's identity public keys (per-device).
 *
 * If the peer+device already has a stored identity with different keys,
 * this indicates a potential key change (reinstall or MITM).
 * Returns the trust status so the caller can handle appropriately.
 *
 * @returns 'new' — first time seeing this peer device
 * @returns 'trusted' — keys match what we have on file
 * @returns 'changed' — keys differ (security event)
 */
export async function storePeerIdentity(
  userId: string,
  deviceId: string,
  signingPublicKeyBase64: string,
  dhPublicKeyBase64: string
): Promise<'new' | 'trusted' | 'changed'> {
  const identityKey = makePeerIdentityKey(userId, deviceId)
  const existing = await store.loadPeerIdentity(identityKey)

  if (!existing) {
    await store.savePeerIdentity({
      userId,
      deviceId,
      identityKey,
      signingPublicKeyBase64,
      dhPublicKeyBase64,
      firstSeen: new Date().toISOString(),
      verified: false,
    })
    return 'new'
  }

  if (
    existing.signingPublicKeyBase64 !== signingPublicKeyBase64 ||
    existing.dhPublicKeyBase64 !== dhPublicKeyBase64
  ) {
    logger.warn(`Identity key change detected for peer ${userId} device ${deviceId}`)
    await store.savePeerIdentity({
      userId,
      deviceId,
      identityKey,
      signingPublicKeyBase64,
      dhPublicKeyBase64,
      firstSeen: new Date().toISOString(),
      verified: false,
    })
    return 'changed'
  }

  return 'trusted'
}

/** Get a stored peer identity for a specific device. */
export async function getPeerIdentity(
  userId: string,
  deviceId: string
): Promise<StoredPeerIdentity | null> {
  const identityKey = makePeerIdentityKey(userId, deviceId)
  return store.loadPeerIdentity(identityKey)
}

/** Mark a peer device's identity as verified (e.g., via safety number comparison). */
export async function markPeerVerified(userId: string, deviceId: string): Promise<boolean> {
  const identityKey = makePeerIdentityKey(userId, deviceId)
  const peer = await store.loadPeerIdentity(identityKey)
  if (!peer) {
    logger.warn(`Cannot verify peer ${userId}:${deviceId}: identity not found`)
    return false
  }

  await store.savePeerIdentity({ ...peer, verified: true })
  return true
}

// ---- Key Agreement (ECDH) ----

/**
 * Perform raw ECDH key agreement between a private key and a peer's
 * public key. Returns 256 bits of shared secret material.
 *
 * This is a building block for X3DH — not called directly for
 * message encryption. The Double Ratchet (Phase 2) will compose
 * multiple DH outputs with a KDF to establish session keys.
 */
export async function performDh(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256  // P-256 shared secret is 256 bits
  )
}

// ---- Cleanup ----

/**
 * Clear all Signal Protocol key material.
 * Call on sign-out alongside clearKeyStore() from cryptoService.
 */
export async function clearSignalKeys(): Promise<void> {
  cachedIdentity = null
  await store.clearSignalStore()
  logger.info('Cleared all signal key material')
}

/**
 * Aggressively destroy all Signal Protocol key material and the database.
 * Call on primary logout for a complete clean slate.
 */
export async function destroySignalKeys(): Promise<void> {
  cachedIdentity = null
  await store.destroySignalStore()
  logger.info('Destroyed all signal key material')
}
