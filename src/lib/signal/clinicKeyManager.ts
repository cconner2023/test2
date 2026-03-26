/**
 * Clinic device Signal Protocol key management.
 *
 * Mirrors keyManager.ts but uses clinicKeyStore for persistence.
 * Each browser/PWA instance gets its own clinic device identity
 * (deviceId = 'clinic-{userId}-{personalDeviceId}').
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { SIGNAL } from '../constants'
import * as store from './clinicKeyStore'
import type {
  StoredLocalIdentity,
  StoredPreKey,
  StoredSignedPreKey,
  StoredPeerIdentity,
  PublicKeyBundle,
} from './types'

const logger = createLogger('ClinicKeyManager')

// ---- In-Memory Cache ----

let cachedClinicIdentity: StoredLocalIdentity | null = null

// ---- Curve Parameters ----

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: SIGNAL.CURVE }
const ECDSA_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: SIGNAL.CURVE }
const ECDSA_SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' }

// ---- Key Generation Primitives ----

async function generateDhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
}

async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify'])
}

// ---- Key Export / Import ----

async function exportPublicKey(
  key: CryptoKey,
  format: 'raw' | 'spki' = 'raw'
): Promise<string> {
  const exported = await crypto.subtle.exportKey(format, key)
  return uint8ToBase64(new Uint8Array(exported))
}

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

// ---- Signing ----

async function signBytes(privateKey: CryptoKey, data: Uint8Array): Promise<string> {
  const signature = await crypto.subtle.sign(ECDSA_SIGN_PARAMS, privateKey, data as BufferSource)
  return uint8ToBase64(new Uint8Array(signature))
}

// ---- Clinic Device ID ----

export function makeClinicDeviceId(userId: string, personalDeviceId: string): string {
  return `clinic-${userId}-${personalDeviceId}`
}

// ---- Identity Key Management ----

export async function getClinicLocalIdentity(): Promise<StoredLocalIdentity | null> {
  if (cachedClinicIdentity) return cachedClinicIdentity

  const stored = await store.loadLocalIdentity()
  if (stored) {
    cachedClinicIdentity = stored
  }
  return stored
}

/**
 * Ensure clinic device identity exists. Each browser instance gets
 * a deterministic clinic device ID derived from the user's personal device ID.
 */
export async function ensureClinicDeviceIdentity(
  userId: string,
  clinicId: string,
  personalDeviceId: string,
): Promise<StoredLocalIdentity> {
  const clinicDeviceId = makeClinicDeviceId(userId, personalDeviceId)

  const existing = await getClinicLocalIdentity()
  if (existing) {
    // Ensure deviceId matches (user may have switched clinics)
    if (existing.deviceId !== clinicDeviceId) {
      logger.info('Clinic device ID mismatch — regenerating identity')
    } else {
      return existing
    }
  }

  logger.info(`Generating new clinic device identity: ${clinicDeviceId}`)

  const [signingPair, dhPair] = await Promise.all([
    generateSigningKeyPair(),
    generateDhKeyPair(),
  ])

  const [signingPubBase64, dhPubBase64] = await Promise.all([
    exportPublicKey(signingPair.publicKey, 'spki'),
    exportPublicKey(dhPair.publicKey, 'raw'),
  ])

  const identity: StoredLocalIdentity = {
    deviceId: clinicDeviceId,
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
  cachedClinicIdentity = identity

  logger.info('Clinic device identity generated and stored')
  return identity
}

// ---- Pre-Key Management ----

export async function generateClinicPreKeys(
  count: number = SIGNAL.PREKEY_BATCH_SIZE
): Promise<StoredPreKey[]> {
  const identity = cachedClinicIdentity
  if (!identity) throw new Error('Clinic identity not initialized')

  const startId = identity.nextPreKeyId
  logger.info(`Generating ${count} clinic pre-keys starting at ID ${startId}`)

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

  identity.nextPreKeyId = startId + count
  await store.saveLocalIdentity(identity)
  cachedClinicIdentity = identity

  logger.info(`Generated and stored ${count} clinic pre-keys`)
  return preKeys
}

export async function consumeClinicPreKey(keyId: number): Promise<StoredPreKey | null> {
  const preKey = await store.loadPreKey(keyId)
  if (!preKey) {
    logger.warn(`Clinic pre-key ${keyId} not found`)
    return null
  }

  await store.removePreKey(keyId)
  return preKey
}

export async function getClinicPreKeyCount(): Promise<number> {
  const ids = await store.getAllPreKeyIds()
  return ids.length
}

// ---- Signed Pre-Key Management ----

export async function generateClinicSignedPreKey(keyId?: number): Promise<StoredSignedPreKey> {
  const identity = cachedClinicIdentity
  if (!identity) throw new Error('Clinic identity not initialized')

  const id = keyId ?? (await store.getLatestSignedPreKeyId()) + 1

  logger.info(`Generating clinic signed pre-key with ID ${id}`)

  const keyPair = await generateDhKeyPair()
  const publicKeyBase64 = await exportPublicKey(keyPair.publicKey, 'raw')

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
  logger.info(`Clinic signed pre-key ${id} generated and stored`)

  return spk
}

// ---- Public Key Bundle ----

export async function assembleClinicBundle(
  clinicId: string,
  userId: string,
  personalDeviceId: string,
): Promise<PublicKeyBundle | null> {
  const identity = await getClinicLocalIdentity()
  if (!identity) {
    logger.warn('Cannot assemble clinic bundle: no clinic identity')
    return null
  }

  const latestSpkId = await store.getLatestSignedPreKeyId()
  if (latestSpkId === 0) {
    logger.warn('Cannot assemble clinic bundle: no signed pre-key')
    return null
  }

  const spk = await store.loadSignedPreKey(latestSpkId)
  if (!spk) {
    logger.warn('Cannot assemble clinic bundle: signed pre-key not found')
    return null
  }

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
    userId: clinicId,
    deviceId: makeClinicDeviceId(userId, personalDeviceId),
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

function makePeerIdentityKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

export async function storeClinicPeerIdentity(
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
    logger.warn(`Clinic peer identity key change detected for ${userId} device ${deviceId}`)
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

export async function getClinicPeerIdentity(
  userId: string,
  deviceId: string
): Promise<StoredPeerIdentity | null> {
  const identityKey = makePeerIdentityKey(userId, deviceId)
  return store.loadPeerIdentity(identityKey)
}

// ---- Key Agreement (ECDH) ----

export async function performClinicDh(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256
  )
}

// ---- Cleanup ----

export function clearClinicIdentityCache(): void {
  cachedClinicIdentity = null
}

export async function clearClinicSignalKeys(): Promise<void> {
  cachedClinicIdentity = null
  await store.clearClinicSignalStore()
  logger.info('Cleared all clinic signal key material')
}

export async function destroyClinicSignalKeys(): Promise<void> {
  cachedClinicIdentity = null
  await store.destroyClinicSignalStore()
  logger.info('Destroyed all clinic signal key material')
}
