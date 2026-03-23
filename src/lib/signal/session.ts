/**
 * Session management — high-level messaging API.
 *
 * Ties together X3DH key agreement, Double Ratchet, IndexedDB
 * persistence, and Sealed Sender to provide a clean encrypt/decrypt
 * interface.
 *
 * All outbound messages are wrapped in a SealedEnvelope so the server
 * cannot identify the sender. Inbound messages are unsealed before
 * being dispatched to either the X3DH responder path (first contact)
 * or the Double Ratchet decrypt path (established session).
 *
 * Multi-device: sessions are keyed by `${peerId}:${peerDeviceId}`.
 * Legacy sessions (bare peerId key) are migrated on first access.
 *
 * Usage:
 *   // Alice initiates a session with Bob's device
 *   const envelope = await createOutboundSession(bobId, bobDeviceId, bobBundle, "Hello", aliceUuid)
 *   // → send `envelope` to Bob via Supabase
 *
 *   // Bob receives any inbound sealed envelope
 *   const { plaintext, senderUuid } = await processIncomingMessage(aliceDeviceId, envelope, bobUuid)
 *
 *   // Subsequent messages (either direction)
 *   const envelope2 = await encryptMessage(peerId, peerDeviceId, "Follow-up", senderUuid)
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { ensureLocalIdentity, consumePreKey, storePeerIdentity, getPreKeyCount, generatePreKeys, assemblePublicKeyBundle } from './keyManager'
import * as store from './keyStore'
import { x3dhInitiate, x3dhRespond } from './x3dh'
import { initSender, initReceiver, ratchetEncrypt, ratchetDecrypt } from './ratchet'
import { importDhPublicKey } from './keyManager'
import { seal, unseal } from './sealedSender'
import { uploadKeyBundle } from './signalService'
import { SIGNAL } from '../constants'
import type { SealedEnvelope } from './sealedSender'
import type {
  PublicKeyBundle,
  StoredSession,
  EncryptedMessage,
  InitialMessage,
} from './types'

const logger = createLogger('SignalSession')

// ---- Pre-Key Replenishment ----

let _replenishPromise: Promise<void> | null = null

async function replenishPreKeysIfNeeded(myUserId: string): Promise<void> {
  if (_replenishPromise) return _replenishPromise
  _replenishPromise = (async () => {
    try {
      const currentCount = await getPreKeyCount()
      const threshold = Math.floor(SIGNAL.PREKEY_BATCH_SIZE / 2)
      if (currentCount >= threshold) return

      const needed = SIGNAL.PREKEY_BATCH_SIZE - currentCount
      await generatePreKeys(needed)

      const identity = await ensureLocalIdentity()
      const bundle = await assemblePublicKeyBundle(myUserId, identity.deviceId)
      if (!bundle) {
        logger.warn('replenishPreKeysIfNeeded: could not assemble bundle after generating pre-keys')
        return
      }

      await uploadKeyBundle(bundle)
      logger.info(`Pre-key pool replenished: generated ${needed}, uploaded updated bundle`)
    } catch (err) {
      logger.warn('replenishPreKeysIfNeeded failed', err)
    }
  })().finally(() => { _replenishPromise = null })
  return _replenishPromise
}

// ---- Helpers ----

/** Build compound session key from peerId and peerDeviceId. */
function makeSessionKey(peerId: string, peerDeviceId: string): string {
  return `${peerId}:${peerDeviceId}`
}

// ---- In-Memory Session Cache ----

const sessionCache = new Map<string, StoredSession>()

const sessionLocks = new Map<string, Promise<void>>()

function withSessionLock<T>(sessionKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = sessionLocks.get(sessionKey) ?? Promise.resolve()
  let release!: () => void
  const next = new Promise<void>((resolve) => { release = resolve })
  sessionLocks.set(sessionKey, next)
  return prev.then(() => fn()).finally(() => {
    if (sessionLocks.get(sessionKey) === next) sessionLocks.delete(sessionKey)
    release()
  })
}

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
 * Ratchet as sender, encrypts the first message, and wraps the
 * result in a SealedEnvelope so the server cannot identify the sender.
 *
 * @param senderUuid - Caller's user UUID (used to issue the sender certificate)
 * @returns SealedEnvelope to send to the peer (contains X3DH handshake
 *          data + the encrypted first message, sealed for the recipient)
 * @throws If the peer's signed pre-key signature is invalid
 */
export async function createOutboundSession(
  peerId: string,
  peerDeviceId: string,
  peerBundle: PublicKeyBundle,
  firstMessage: string,
  senderUuid: string
): Promise<SealedEnvelope & { identityKeyChanged?: boolean }> {
  const identity = await ensureLocalIdentity()

  return withSessionLock(makeSessionKey(peerId, peerDeviceId), async () => {
  // X3DH key agreement
  const x3dh = await x3dhInitiate(identity, peerBundle)

  // Store peer's identity for future trust verification
  const trustStatus = await storePeerIdentity(
    peerId,
    peerDeviceId,
    peerBundle.identitySigningKey,
    peerBundle.identityDhKey
  )

  let identityKeyChanged = false
  if (trustStatus === 'changed') {
    logger.warn(
      `WARNING: Identity key changed for peer ${peerId} device ${peerDeviceId} ` +
      `during outbound session creation. The peer may have reinstalled or this ` +
      `could indicate a security issue.`
    )
    identityKeyChanged = true
  }

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

  // Persist session (including peerIdentityDhKey for future sealing)
  const sessionKey = makeSessionKey(peerId, peerDeviceId)
  const session: StoredSession = {
    peerId,
    peerDeviceId,
    sessionKey,
    state,
    associatedData: uint8ToBase64(x3dh.associatedData),
    peerIdentityDhKey: peerBundle.identityDhKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await persistSession(session)

  // Build the InitialMessage inner payload
  const initialMessage: InitialMessage = {
    identitySigningKey: identity.signingPublicKeyBase64,
    identityDhKey: identity.dhPublicKeyBase64,
    ephemeralKey: x3dh.ephemeralPublicKeyBase64,
    signedPreKeyId: x3dh.signedPreKeyId,
    oneTimePreKeyId: x3dh.oneTimePreKeyId,
    message,
  }

  logger.info(`Outbound session created with peer ${peerId} device ${peerDeviceId}`)

  // Seal the InitialMessage for the recipient
  const envelope = await seal(
    initialMessage as unknown as Record<string, unknown>,
    senderUuid,
    identity,
    peerId,
    peerBundle.identityDhKey
  )

  return { ...envelope, identityKeyChanged }
  }) // end withSessionLock
}

// ---- Message Encryption ----

/**
 * Encrypt a message to a peer device with an established session.
 *
 * Encrypts via the Double Ratchet and wraps the result in a
 * SealedEnvelope so the server cannot identify the sender.
 *
 * @param senderUuid - Caller's user UUID (used to issue the sender certificate)
 * @throws If no session exists with the peer device
 * @throws If the stored session has no peerIdentityDhKey (re-initiate session)
 */
export async function encryptMessage(
  peerId: string,
  peerDeviceId: string,
  plaintext: string,
  senderUuid: string
): Promise<SealedEnvelope> {
  const identity = await ensureLocalIdentity()
  return withSessionLock(makeSessionKey(peerId, peerDeviceId), async () => {
    const session = await getSession(peerId, peerDeviceId)
    if (!session) {
      throw new Error(`No session with peer ${peerId} device ${peerDeviceId}`)
    }

    if (!session.peerIdentityDhKey) {
      throw new Error(`Session with ${peerId}:${peerDeviceId} has no peerIdentityDhKey — re-initiate session`)
    }

    const ad = base64ToUint8(session.associatedData)
    const plaintextBytes = new TextEncoder().encode(plaintext)
    const { state, message } = await ratchetEncrypt(session.state, plaintextBytes, ad)

    await persistSession({
      ...session,
      state,
      updatedAt: new Date().toISOString(),
    })

    return seal(
      message as unknown as Record<string, unknown>,
      senderUuid,
      identity,
      peerId,
      session.peerIdentityDhKey
    )
  })
}

// ---- Unified Inbound Handler ----

/**
 * Process any incoming sealed envelope (initial, message, sync, etc.).
 * Unseals the envelope, determines inner type (X3DH or ratchet),
 * and decrypts accordingly.
 *
 * @param senderDeviceId - from row.sender_device_id (or 'unknown' for legacy)
 * @param envelope - the SealedEnvelope from the DB row payload
 * @param myUuid - this device's user UUID (recipient)
 * @returns Decrypted plaintext + verified sender UUID
 */
export async function processIncomingMessage(
  senderDeviceId: string,
  envelope: SealedEnvelope,
  myUuid: string
): Promise<{ plaintext: string; senderUuid: string; identityKeyChanged?: boolean }> {
  const identity = await ensureLocalIdentity()

  // Unseal: decrypt and verify sender cert
  const { inner, senderUuid, cert } = await unseal(
    envelope,
    myUuid,
    identity.dhPrivateKey,
    identity.dhPublicKeyBase64
  )

  return withSessionLock(makeSessionKey(senderUuid, senderDeviceId), async () => {
    const trustStatus = await storePeerIdentity(
      senderUuid,
      senderDeviceId,
      cert.senderIdentitySigningKey,
      cert.senderIdentityDhKey
    )

    let identityKeyChanged = false
    if (trustStatus === 'changed') {
      logger.warn(
        `WARNING: Identity key changed for peer ${senderUuid} device ${senderDeviceId} ` +
        `during incoming message processing. The peer may have reinstalled or this ` +
        `could indicate a security issue.`
      )
      identityKeyChanged = true
    }

    if ('identitySigningKey' in inner) {
      const initial = inner as unknown as InitialMessage

      const signedPreKey = await store.loadSignedPreKey(initial.signedPreKeyId)
      if (!signedPreKey) {
        throw new Error(`Signed pre-key ${initial.signedPreKeyId} not found`)
      }

      let oneTimePreKeyPair = null
      if (initial.oneTimePreKeyId !== null) {
        const otpk = await consumePreKey(initial.oneTimePreKeyId)
        if (otpk) oneTimePreKeyPair = { publicKey: otpk.publicKey, privateKey: otpk.privateKey }
      }

      const x3dh = await x3dhRespond(
        identity,
        { publicKey: signedPreKey.publicKey, privateKey: signedPreKey.privateKey },
        oneTimePreKeyPair,
        initial.identityDhKey,
        initial.ephemeralKey
      )

      const ratchetState = await initReceiver(x3dh.sharedSecret, {
        publicKey: signedPreKey.publicKey,
        privateKey: signedPreKey.privateKey,
        publicKeyBase64: signedPreKey.publicKeyBase64,
      })

      const { state, plaintext } = await ratchetDecrypt(ratchetState, initial.message, x3dh.associatedData)

      const sessionKey = makeSessionKey(senderUuid, senderDeviceId)
      const session: StoredSession = {
        peerId: senderUuid,
        peerDeviceId: senderDeviceId,
        sessionKey,
        state,
        associatedData: uint8ToBase64(x3dh.associatedData),
        peerIdentityDhKey: initial.identityDhKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await persistSession(session)

      replenishPreKeysIfNeeded(myUuid).catch(() => {})

      logger.info(`Inbound session created with peer ${senderUuid} device ${senderDeviceId}`)
      return { plaintext: new TextDecoder().decode(plaintext), senderUuid, identityKeyChanged }

    } else {
      const encMsg = inner as unknown as EncryptedMessage

      const session = await getSession(senderUuid, senderDeviceId)
      if (!session) {
        throw new Error(`No session with ${senderUuid}:${senderDeviceId}`)
      }

      const ad = base64ToUint8(session.associatedData)
      const { state, plaintext } = await ratchetDecrypt(session.state, encMsg, ad)

      await persistSession({
        ...session,
        state,
        updatedAt: new Date().toISOString(),
      })

      return { plaintext: new TextDecoder().decode(plaintext), senderUuid, identityKeyChanged }
    }
  })
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

/**
 * Delete all sessions with a peer across all their registered devices.
 *
 * Used when a 1:1 conversation is deleted — purges all pairwise ratchet
 * state so the peer cannot be messaged until a new X3DH handshake occurs.
 * Group sessions with the same peer are handled separately (sender keys,
 * not pairwise ratchet) and are unaffected by this call.
 *
 * @param peerId - The peer's user UUID
 */
export async function deleteSessionsForPeer(peerId: string): Promise<void> {
  const sessions = await store.loadSessionsForPeer(peerId)
  for (const session of sessions) {
    sessionCache.delete(session.sessionKey)
    await store.deleteSession(session.sessionKey)
  }
  logger.info(`Deleted ${sessions.length} session(s) for peer ${peerId}`)
}

/** Clear all sessions (called on sign-out alongside clearSignalKeys). */
export async function clearAllSessions(): Promise<void> {
  sessionCache.clear()
  // Sessions are cleared as part of clearSignalStore() in keyStore
}
