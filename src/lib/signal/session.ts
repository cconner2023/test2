/**
 * Session management — high-level messaging API.
 *
 * Ties together X3DH key agreement, Double Ratchet, and IndexedDB
 * persistence to provide a clean encrypt/decrypt interface.
 *
 * Multi-device: sessions are keyed by `${peerId}:${peerDeviceId}`.
 * Legacy sessions (bare peerId key) are migrated on first access.
 *
 * Usage:
 *   // Alice initiates a session with Bob's device
 *   const initial = await createOutboundSession(bobId, bobDeviceId, bobBundle, "Hello")
 *   // → send `initial` to Bob via Supabase
 *
 *   // Bob receives Alice's initial message
 *   const text = await receiveInitialMessage(aliceId, aliceDeviceId, initial)
 *
 *   // Subsequent messages (either direction)
 *   const encrypted = await encryptMessage(peerId, peerDeviceId, "Follow-up")
 *   const decrypted = await decryptMessage(peerId, peerDeviceId, encrypted)
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { ensureLocalIdentity, consumePreKey, storePeerIdentity } from './keyManager'
import * as store from './keyStore'
import { x3dhInitiate, x3dhRespond } from './x3dh'
import { initSender, initReceiver, ratchetEncrypt, ratchetDecrypt } from './ratchet'
import { importDhPublicKey } from './keyManager'
import type {
  PublicKeyBundle,
  StoredSession,
  EncryptedMessage,
  InitialMessage,
} from './types'

const logger = createLogger('SignalSession')

// ---- Helpers ----

/** Build compound session key from peerId and peerDeviceId. */
function makeSessionKey(peerId: string, peerDeviceId: string): string {
  return `${peerId}:${peerDeviceId}`
}

// ---- In-Memory Session Cache ----

const sessionCache = new Map<string, StoredSession>()

async function getSession(peerId: string, peerDeviceId: string): Promise<StoredSession | null> {
  const key = makeSessionKey(peerId, peerDeviceId)
  const cached = sessionCache.get(key)
  if (cached) return cached

  const stored = await store.loadSession(key)
  if (stored) {
    sessionCache.set(key, stored)
    return stored
  }

  // Legacy fallback: try bare peerId for pre-multi-device sessions
  const legacy = await store.loadSession(peerId)
  if (legacy) {
    // Migrate: re-save with compound key
    const migrated: StoredSession = {
      ...legacy,
      peerDeviceId,
      sessionKey: key,
    }
    sessionCache.set(key, migrated)
    await store.saveSession(migrated)
    // Clean up old bare-key entry
    await store.deleteSession(peerId).catch(() => {})
    logger.info(`Migrated legacy session for ${peerId} → ${key}`)
    return migrated
  }

  return null
}

async function persistSession(session: StoredSession): Promise<void> {
  sessionCache.set(session.sessionKey, session)
  await store.saveSession(session)
}

// ---- Session Creation ----

/**
 * Create an outbound session with a peer device and encrypt the first message.
 *
 * Performs X3DH key agreement using the peer's public key bundle
 * (fetched from Supabase by the caller), initializes the Double
 * Ratchet as sender, and encrypts the first message.
 *
 * @returns InitialMessage to send to the peer (contains X3DH handshake
 *          data + the encrypted first message)
 * @throws If the peer's signed pre-key signature is invalid
 */
export async function createOutboundSession(
  peerId: string,
  peerDeviceId: string,
  peerBundle: PublicKeyBundle,
  firstMessage: string
): Promise<InitialMessage> {
  const identity = await ensureLocalIdentity()

  // X3DH key agreement
  const x3dh = await x3dhInitiate(identity, peerBundle)

  // Store peer's identity for future trust verification
  await storePeerIdentity(
    peerId,
    peerDeviceId,
    peerBundle.identitySigningKey,
    peerBundle.identityDhKey
  )

  // Initialize sender ratchet
  const peerSpk = await importDhPublicKey(peerBundle.signedPreKey.publicKey)
  const ratchetState = await initSender(
    x3dh.sharedSecret,
    peerSpk,
    peerBundle.signedPreKey.publicKey
  )

  // Encrypt first message
  const plaintext = new TextEncoder().encode(firstMessage)
  const { state, message } = await ratchetEncrypt(
    ratchetState, plaintext, x3dh.associatedData
  )

  // Persist session
  const sessionKey = makeSessionKey(peerId, peerDeviceId)
  const session: StoredSession = {
    peerId,
    peerDeviceId,
    sessionKey,
    state,
    associatedData: uint8ToBase64(x3dh.associatedData),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await persistSession(session)

  logger.info(`Outbound session created with peer ${peerId} device ${peerDeviceId}`)
  return {
    identitySigningKey: identity.signingPublicKeyBase64,
    identityDhKey: identity.dhPublicKeyBase64,
    ephemeralKey: x3dh.ephemeralPublicKeyBase64,
    signedPreKeyId: x3dh.signedPreKeyId,
    oneTimePreKeyId: x3dh.oneTimePreKeyId,
    message,
  }
}

/**
 * Receive an initial message from a peer device and decrypt it.
 *
 * Performs X3DH responder flow using our pre-keys, initializes
 * the Double Ratchet as receiver, and decrypts the first message.
 *
 * @param peerId - The sender's user ID (known from Supabase message metadata)
 * @param peerDeviceId - The sender's device ID
 * @param initial - The InitialMessage received from the peer
 * @returns Decrypted first message text
 * @throws If required pre-keys are missing or decryption fails
 */
export async function receiveInitialMessage(
  peerId: string,
  peerDeviceId: string,
  initial: InitialMessage
): Promise<string> {
  const identity = await ensureLocalIdentity()

  // Load the signed pre-key that was used
  const signedPreKey = await store.loadSignedPreKey(initial.signedPreKeyId)
  if (!signedPreKey) {
    throw new Error(`Signed pre-key ${initial.signedPreKeyId} not found`)
  }

  // Load and consume the one-time pre-key if used
  let oneTimePreKeyPair = null
  if (initial.oneTimePreKeyId !== null) {
    const otpk = await consumePreKey(initial.oneTimePreKeyId)
    if (otpk) {
      oneTimePreKeyPair = {
        publicKey: otpk.publicKey,
        privateKey: otpk.privateKey,
      }
    }
  }

  // X3DH responder
  const x3dh = await x3dhRespond(
    identity,
    { publicKey: signedPreKey.publicKey, privateKey: signedPreKey.privateKey },
    oneTimePreKeyPair,
    initial.identityDhKey,
    initial.ephemeralKey
  )

  // Store peer's identity for trust verification
  await storePeerIdentity(
    peerId,
    peerDeviceId,
    initial.identitySigningKey,
    initial.identityDhKey
  )

  // Initialize receiver ratchet
  const ratchetState = await initReceiver(x3dh.sharedSecret, {
    publicKey: signedPreKey.publicKey,
    privateKey: signedPreKey.privateKey,
    publicKeyBase64: signedPreKey.publicKeyBase64,
  })

  // Decrypt first message
  const { state, plaintext } = await ratchetDecrypt(
    ratchetState, initial.message, x3dh.associatedData
  )

  // Persist session
  const sessionKey = makeSessionKey(peerId, peerDeviceId)
  const session: StoredSession = {
    peerId,
    peerDeviceId,
    sessionKey,
    state,
    associatedData: uint8ToBase64(x3dh.associatedData),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await persistSession(session)

  logger.info(`Inbound session created with peer ${peerId} device ${peerDeviceId}`)
  return new TextDecoder().decode(plaintext)
}

// ---- Message Encryption / Decryption ----

/**
 * Encrypt a message to a peer device with an established session.
 *
 * @throws If no session exists with the peer device
 */
export async function encryptMessage(
  peerId: string,
  peerDeviceId: string,
  plaintext: string
): Promise<EncryptedMessage> {
  const session = await getSession(peerId, peerDeviceId)
  if (!session) {
    throw new Error(`No session with peer ${peerId} device ${peerDeviceId}`)
  }

  const ad = base64ToUint8(session.associatedData)
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const { state, message } = await ratchetEncrypt(session.state, plaintextBytes, ad)

  await persistSession({
    ...session,
    state,
    updatedAt: new Date().toISOString(),
  })

  return message
}

/**
 * Decrypt a message from a peer device with an established session.
 *
 * Handles out-of-order delivery automatically via skipped message keys.
 *
 * @throws If no session exists, or decryption/authentication fails
 */
export async function decryptMessage(
  peerId: string,
  peerDeviceId: string,
  message: EncryptedMessage
): Promise<string> {
  const session = await getSession(peerId, peerDeviceId)
  if (!session) {
    throw new Error(`No session with peer ${peerId} device ${peerDeviceId}`)
  }

  const ad = base64ToUint8(session.associatedData)
  const { state, plaintext } = await ratchetDecrypt(session.state, message, ad)

  await persistSession({
    ...session,
    state,
    updatedAt: new Date().toISOString(),
  })

  return new TextDecoder().decode(plaintext)
}

// ---- Session Queries ----

/** Check if an encrypted session exists with a peer device. */
export async function hasSession(peerId: string, peerDeviceId: string): Promise<boolean> {
  return (await getSession(peerId, peerDeviceId)) !== null
}

/** Delete a session with a specific peer device. */
export async function deleteSession(peerId: string, peerDeviceId: string): Promise<void> {
  const key = makeSessionKey(peerId, peerDeviceId)
  sessionCache.delete(key)
  await store.deleteSession(key)
  logger.info(`Deleted session with peer ${peerId} device ${peerDeviceId}`)
}

/** Clear all sessions (called on sign-out alongside clearSignalKeys). */
export async function clearAllSessions(): Promise<void> {
  sessionCache.clear()
  // Sessions are cleared as part of clearSignalStore() in keyStore
}
