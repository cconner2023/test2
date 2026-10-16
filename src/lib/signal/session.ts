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
import { ensureLocalIdentity, storePeerIdentity, getPeerIdentity, getPreKeyCount, generatePreKeys, assemblePublicKeyBundle } from './keyManager'
import * as store from './keyStore'
import { x3dhInitiate, x3dhRespond } from './x3dh'
import { initSender, initReceiver, ratchetEncrypt, ratchetDecrypt, DuplicateMessageError } from './ratchet'
import { importDhPublicKey } from './keyManager'
import { seal, unseal } from './sealedSender'
import { uploadKeyBundle, fetchPublishedIdentities } from './signalService'
import { SIGNAL } from '../constants'
import type { SealedEnvelope, SenderCertificate } from './sealedSender'
import type {
  PublicKeyBundle,
  StoredSession,
  SessionState,
  PendingPreKey,
  StoredLocalIdentity,
  EncryptedMessage,
  InitialMessage,
} from './types'

export { DuplicateMessageError }

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

// ---- Errors ----

/**
 * A ratchet (non-X3DH) packet arrived from a peer device we hold no session
 * with — our half was lost (IDB wipe, or the pre-fix 1:1 conversation delete)
 * while the peer still holds theirs. Typed so the receive path can trigger the
 * session-reset recovery instead of string-matching the message.
 */
export class NoSessionError extends Error {
  constructor(readonly peerId: string, readonly peerDeviceId: string) {
    super(`No session with ${peerId}:${peerDeviceId}`)
    this.name = 'NoSessionError'
  }
}

/**
 * A ratchet packet from a peer device that none of our held sessions (current
 * or archived) can open — the two sides hold different sessions, e.g. after a
 * handshake one side never received. Like NoSessionError, recoverable only by
 * a fresh handshake (session reset).
 */
export class SessionMismatchError extends Error {
  constructor(readonly peerId: string, readonly peerDeviceId: string) {
    super(`No session with ${peerId}:${peerDeviceId} could decrypt the message`)
    this.name = 'SessionMismatchError'
  }
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

// ---- Session Record Helpers ----

/** Archived sessions kept per peer device (libsignal keeps 40; ours are heavier). */
const MAX_PREVIOUS_STATES = 10

/** Pick the SessionState fields off a record (its current session). */
function currentOf(record: StoredSession): SessionState {
  return {
    state: record.state,
    associatedData: record.associatedData,
    peerIdentityDhKey: record.peerIdentityDhKey,
    baseKey: record.baseKey,
    pendingPreKey: record.pendingPreKey,
  }
}

/** All sessions in a record, current first. */
function allStates(record: StoredSession | null): SessionState[] {
  return record ? [currentOf(record), ...(record.previousStates ?? [])] : []
}

/** Build a record whose current session is `current` and whose archive is `previous`. */
function makeRecord(
  peerId: string,
  peerDeviceId: string,
  current: SessionState,
  previous: SessionState[],
  createdAt?: string,
): StoredSession {
  const now = new Date().toISOString()
  return {
    peerId,
    peerDeviceId,
    sessionKey: makeSessionKey(peerId, peerDeviceId),
    state: current.state,
    associatedData: current.associatedData,
    peerIdentityDhKey: current.peerIdentityDhKey,
    baseKey: current.baseKey,
    pendingPreKey: current.pendingPreKey,
    previousStates: previous.slice(0, MAX_PREVIOUS_STATES),
    createdAt: createdAt ?? now,
    updatedAt: now,
  }
}

// ---- Sender Identity ----

/** SYSTEM sender uuid — mirrors systemIdentity.SYSTEM_USER_ID (not imported:
 *  that module pulls in supabase/zustand). Its edge-function identity is not
 *  in the published directory, so SYSTEM stays trust-on-first-use. */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Authenticate the sender certificate. The cert is self-signed, so on its own
 * it proves only that the sender holds the keys IN the cert — anyone can claim
 * any uuid. A known-good key for this peer device is accepted as-is; a first-
 * seen or changed key must match an identity the claimed user has published
 * under their own auth (signal_key_bundles RLS), or the message is rejected.
 *
 * @throws if the identity is not published, or the directory is unreachable
 *         (retriable — the row stays unread and catch-up tries again).
 */
async function verifySenderIdentity(
  senderUuid: string,
  senderDeviceId: string,
  cert: SenderCertificate,
): Promise<void> {
  const known = await getPeerIdentity(senderUuid, senderDeviceId)
  if (
    known &&
    known.signingPublicKeyBase64 === cert.senderIdentitySigningKey &&
    known.dhPublicKeyBase64 === cert.senderIdentityDhKey
  ) {
    return
  }
  if (senderUuid === SYSTEM_USER_ID) return

  const published = await fetchPublishedIdentities(senderUuid)
  if (!published.ok) {
    throw new Error(`Cannot verify sender identity for ${senderUuid}: ${published.error}`)
  }
  const match = published.data.some(
    k => k.signing === cert.senderIdentitySigningKey && k.dh === cert.senderIdentityDhKey,
  )
  if (!match) {
    throw new Error(`Sender identity for ${senderUuid} is not published — rejecting certificate`)
  }
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
 * Any existing session with the device is archived, not discarded, so
 * packets still in flight on it keep decrypting. The new session carries a
 * pending pre-key: every message sent on it repeats the X3DH header until the
 * peer replies (see encryptMessage).
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

  const pendingPreKey: PendingPreKey = {
    identitySigningKey: identity.signingPublicKeyBase64,
    identityDhKey: identity.dhPublicKeyBase64,
    ephemeralKey: x3dh.ephemeralPublicKeyBase64,
    signedPreKeyId: x3dh.signedPreKeyId,
    oneTimePreKeyId: x3dh.oneTimePreKeyId,
  }

  // Persist as the current session (including peerIdentityDhKey for future
  // sealing), archiving whatever was current before
  const existing = await getSession(peerId, peerDeviceId)
  await persistSession(makeRecord(
    peerId,
    peerDeviceId,
    {
      state,
      associatedData: uint8ToBase64(x3dh.associatedData),
      peerIdentityDhKey: peerBundle.identityDhKey,
      baseKey: x3dh.ephemeralPublicKeyBase64,
      pendingPreKey,
    },
    allStates(existing),
  ))

  // Build the InitialMessage inner payload
  const initialMessage: InitialMessage = { ...pendingPreKey, message }

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
 * SealedEnvelope so the server cannot identify the sender. While the
 * session's pre-key is still pending (peer has not replied), the packet is
 * wrapped in the X3DH InitialMessage so it opens even if earlier ones didn't
 * arrive.
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

    const inner: InitialMessage | EncryptedMessage = session.pendingPreKey
      ? { ...session.pendingPreKey, message }
      : message

    return seal(
      inner as unknown as Record<string, unknown>,
      senderUuid,
      identity,
      peerId,
      session.peerIdentityDhKey
    )
  })
}

/**
 * Seal an already-encrypted inner payload for a specific peer DEVICE using the
 * sealed-sender ECIES layer ONLY — no Double Ratchet.
 *
 * Used for group `sender-key-message` content: the inner is already sender-key-
 * encrypted once (O(1)); this wraps it per-recipient-device so the SENDER
 * identity is invisible to the server, matching the operator-blind guarantee the
 * 1:1 path already provides. The recipient's per-device identity DH key comes
 * from an established session; if none exists yet, the caller passes the key from
 * the peer's published bundle (`peerDhKeyFallback`).
 *
 * Read-only w.r.t. session state (unlike encryptMessage, no ratchet advance).
 *
 * @throws if no identity DH key is available for the peer device.
 */
export async function sealForPeerDevice(
  peerId: string,
  peerDeviceId: string,
  inner: Record<string, unknown>,
  senderUuid: string,
  peerDhKeyFallback?: string,
): Promise<SealedEnvelope> {
  const identity = await ensureLocalIdentity()
  const session = await getSession(peerId, peerDeviceId)
  const peerDhKey = session?.peerIdentityDhKey ?? peerDhKeyFallback
  if (!peerDhKey) {
    throw new Error(`sealForPeerDevice: no identity DH key for ${peerId}:${peerDeviceId}`)
  }
  return seal(inner, senderUuid, identity, peerId, peerDhKey)
}

/**
 * Unseal a SealedEnvelope with our local identity WITHOUT Double-Ratchet
 * decrypting the inner. Counterpart to {@link sealForPeerDevice} for sealed
 * group sender-key-messages whose inner is a SenderKeyMessage (sender-key-
 * encrypted, not ratchet-wrapped).
 *
 * Throws 'Sealed sender: cert recipient mismatch' when the envelope is addressed
 * to a SIBLING device (per-device fan-out) — the caller treats that as benign and
 * skips. Also throws on tamper / expiry / forged cert, and when the cert's
 * identity is neither known for this sender device nor published by the
 * claimed sender.
 */
export async function unsealOnly(
  envelope: SealedEnvelope,
  myUuid: string,
  senderDeviceId: string,
): Promise<{ inner: Record<string, unknown>; senderUuid: string }> {
  const identity = await ensureLocalIdentity()
  const { inner, senderUuid, cert } = await unseal(
    envelope,
    myUuid,
    identity.dhPrivateKey,
    identity.dhPublicKeyBase64,
  )
  await verifySenderIdentity(senderUuid, senderDeviceId, cert)
  return { inner, senderUuid }
}

// ---- Unified Inbound Handler ----

/**
 * Open an X3DH InitialMessage. A handshake we already hold a session for
 * (matched by base key — a repeated pending pre-key header, a replay, or a
 * crossed handshake) decrypts on that session; only an unseen handshake runs
 * X3DH, and the one-time pre-key is deleted only after the first message
 * actually decrypts.
 */
async function decryptInitial(
  identity: StoredLocalIdentity,
  senderUuid: string,
  senderDeviceId: string,
  existing: StoredSession | null,
  initial: InitialMessage,
): Promise<{ record: StoredSession; plaintext: Uint8Array; newHandshake: boolean }> {
  const states = allStates(existing)
  const matchIdx = states.findIndex(s => s.baseKey === initial.ephemeralKey)

  if (matchIdx >= 0) {
    const matched = states[matchIdx]
    // Throws (typically DuplicateMessageError) rather than falling back to a
    // fresh X3DH — re-running the handshake is what used to clobber sessions.
    const { state, plaintext } = await ratchetDecrypt(
      matched.state, initial.message, base64ToUint8(matched.associatedData),
    )
    const record = makeRecord(
      senderUuid, senderDeviceId,
      { ...matched, state, pendingPreKey: undefined },
      states.filter((_, i) => i !== matchIdx),
      existing?.createdAt,
    )
    return { record, plaintext, newHandshake: false }
  }

  // Sessions created before base keys were recorded can't be matched above. A
  // repeated header for one of them would otherwise re-run X3DH against a
  // one-time pre-key that is already spent and fail forever — try them first,
  // and adopt the base key on success.
  for (let i = 0; i < states.length; i++) {
    const legacy = states[i]
    if (legacy.baseKey) continue
    try {
      const { state, plaintext } = await ratchetDecrypt(
        legacy.state, initial.message, base64ToUint8(legacy.associatedData),
      )
      const record = makeRecord(
        senderUuid, senderDeviceId,
        { ...legacy, state, baseKey: initial.ephemeralKey, pendingPreKey: undefined },
        states.filter((_, j) => j !== i),
        existing?.createdAt,
      )
      return { record, plaintext, newHandshake: false }
    } catch (e) {
      if (e instanceof DuplicateMessageError) throw e
    }
  }

  const signedPreKey = await store.loadSignedPreKey(initial.signedPreKeyId)
  if (!signedPreKey) {
    throw new Error(`Signed pre-key ${initial.signedPreKeyId} not found`)
  }

  let oneTimePreKeyPair = null
  if (initial.oneTimePreKeyId !== null) {
    const otpk = await store.loadPreKey(initial.oneTimePreKeyId)
    if (!otpk) {
      // Computing without DH4 can never match the initiator's secret.
      throw new Error(`One-time pre-key ${initial.oneTimePreKeyId} not found`)
    }
    oneTimePreKeyPair = { publicKey: otpk.publicKey, privateKey: otpk.privateKey }
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

  // Only now is the one-time pre-key spent: a failed open leaves it usable
  // for the retry instead of making the handshake permanently unopenable.
  if (initial.oneTimePreKeyId !== null) {
    await store.removePreKey(initial.oneTimePreKeyId)
  }

  const record = makeRecord(
    senderUuid, senderDeviceId,
    {
      state,
      associatedData: uint8ToBase64(x3dh.associatedData),
      peerIdentityDhKey: initial.identityDhKey,
      baseKey: initial.ephemeralKey,
    },
    states,
    existing?.createdAt,
  )
  return { record, plaintext, newHandshake: true }
}

/**
 * Open a ratchet packet. Tries the current session, then archived ones; the
 * one that opens it becomes current (its pending pre-key cleared — the peer
 * evidently has the session).
 *
 * @throws NoSessionError when we hold no session at all
 * @throws DuplicateMessageError when a session recognises the packet as already consumed
 * @throws SessionMismatchError when no held session can open it
 */
async function decryptWithRecord(
  senderUuid: string,
  senderDeviceId: string,
  existing: StoredSession | null,
  encMsg: EncryptedMessage,
): Promise<{ record: StoredSession; plaintext: Uint8Array }> {
  if (!existing) {
    throw new NoSessionError(senderUuid, senderDeviceId)
  }
  const states = allStates(existing)
  for (let i = 0; i < states.length; i++) {
    const candidate = states[i]
    try {
      const { state, plaintext } = await ratchetDecrypt(
        candidate.state, encMsg, base64ToUint8(candidate.associatedData),
      )
      const record = makeRecord(
        senderUuid, senderDeviceId,
        { ...candidate, state, pendingPreKey: undefined },
        states.filter((_, j) => j !== i),
        existing.createdAt,
      )
      return { record, plaintext }
    } catch (e) {
      if (e instanceof DuplicateMessageError) throw e
    }
  }
  throw new SessionMismatchError(senderUuid, senderDeviceId)
}

/**
 * Process any incoming sealed envelope (initial, message, sync, etc.).
 * Unseals the envelope, authenticates the sender certificate, determines
 * inner type (X3DH or ratchet), and decrypts accordingly. Session and
 * peer-identity state are written only after a successful decrypt.
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
    await verifySenderIdentity(senderUuid, senderDeviceId, cert)

    const existing = await getSession(senderUuid, senderDeviceId)
    let record: StoredSession
    let plaintext: Uint8Array

    if ('identitySigningKey' in inner) {
      const initial = inner as unknown as InitialMessage
      // The X3DH identity must be the certificate's identity — otherwise a
      // valid cert could front a handshake made with someone else's keys.
      if (
        initial.identityDhKey !== cert.senderIdentityDhKey ||
        initial.identitySigningKey !== cert.senderIdentitySigningKey
      ) {
        throw new Error('Initial message identity does not match sender certificate')
      }
      const opened = await decryptInitial(identity, senderUuid, senderDeviceId, existing, initial)
      record = opened.record
      plaintext = opened.plaintext
      if (opened.newHandshake) {
        replenishPreKeysIfNeeded(myUuid).catch(() => {})
        logger.info(`Inbound session created with peer ${senderUuid} device ${senderDeviceId}`)
      }
    } else {
      const opened = await decryptWithRecord(senderUuid, senderDeviceId, existing, inner as unknown as EncryptedMessage)
      record = opened.record
      plaintext = opened.plaintext
    }

    await persistSession(record)

    const trustStatus = await storePeerIdentity(
      senderUuid,
      senderDeviceId,
      cert.senderIdentitySigningKey,
      cert.senderIdentityDhKey
    )
    const identityKeyChanged = trustStatus === 'changed'
    if (identityKeyChanged) {
      logger.warn(
        `WARNING: Identity key changed for peer ${senderUuid} device ${senderDeviceId} ` +
        `during incoming message processing. The peer may have reinstalled or this ` +
        `could indicate a security issue.`
      )
    }

    return { plaintext: new TextDecoder().decode(plaintext), senderUuid, identityKeyChanged }
  })
}

// ---- Vault Inbox ----

/** Private key material of a user's vault, as needed to open vault rows. */
export interface VaultDecryptKeys {
  dhPrivateKey: CryptoKey
  dhPublicKeyBase64: string
  /** Current signed pre-key first, then retained previous ones. */
  signedPreKeys: Array<{ keyId: number; publicKey: CryptoKey; privateKey: CryptoKey; publicKeyBase64: string }>
  /** One-time pre-keys still in the vault blob (only pre-vault-first senders used them). */
  preKeys: Array<{ keyId: number; publicKey: CryptoKey; privateKey: CryptoKey }>
}

/** Ratchet state of pre-vault-first senders' long-lived vault sessions, kept
 *  only for the current page so a follow-up in the same backlog still opens. */
const legacyVaultSessions = new Map<string, { state: StoredSession['state']; ad: Uint8Array }>()

/**
 * Open a row addressed to the user's vault (vault-first inbox). Every vault row
 * is a self-contained X3DH InitialMessage — senders keep no session with a
 * vault — so this is stateless: authenticate the sender certificate, run the
 * X3DH responder against the vault's signed pre-key (one-time pre-key only for
 * pre-vault-first senders, never consumed: any of the user's devices may open
 * the same row), decrypt the single message. Replays decrypt again; callers
 * dedupe by row id.
 *
 * @throws on tamper, unknown signed pre-key, unpublished sender identity, or
 *         a pre-vault-first ratchet follow-up whose handshake isn't in this page.
 */
export async function openVaultEnvelope(
  senderDeviceId: string,
  envelope: SealedEnvelope,
  myUuid: string,
  keys: VaultDecryptKeys,
): Promise<{ plaintext: string; senderUuid: string }> {
  const { inner, senderUuid, cert } = await unseal(
    envelope,
    myUuid,
    keys.dhPrivateKey,
    keys.dhPublicKeyBase64,
    { skipExpiry: true },
  )
  await verifySenderIdentity(senderUuid, senderDeviceId, cert)
  const legacyKey = makeSessionKey(senderUuid, senderDeviceId)

  if (!('identitySigningKey' in inner)) {
    const legacy = legacyVaultSessions.get(legacyKey)
    if (!legacy) throw new NoSessionError(senderUuid, senderDeviceId)
    const { state, plaintext } = await ratchetDecrypt(legacy.state, inner as unknown as EncryptedMessage, legacy.ad)
    legacyVaultSessions.set(legacyKey, { state, ad: legacy.ad })
    return { plaintext: new TextDecoder().decode(plaintext), senderUuid }
  }

  const initial = inner as unknown as InitialMessage
  if (
    initial.identityDhKey !== cert.senderIdentityDhKey ||
    initial.identitySigningKey !== cert.senderIdentitySigningKey
  ) {
    throw new Error('Initial message identity does not match sender certificate')
  }

  const spk = keys.signedPreKeys.find(s => s.keyId === initial.signedPreKeyId)
  if (!spk) throw new Error(`Vault signed pre-key ${initial.signedPreKeyId} not found`)

  let otpk = null
  if (initial.oneTimePreKeyId !== null) {
    otpk = keys.preKeys.find(k => k.keyId === initial.oneTimePreKeyId) ?? null
    if (!otpk) throw new Error(`Vault one-time pre-key ${initial.oneTimePreKeyId} not found`)
  }

  const vaultIdentity = {
    dhPrivateKey: keys.dhPrivateKey,
    dhPublicKeyBase64: keys.dhPublicKeyBase64,
  } as StoredLocalIdentity
  const x3dh = await x3dhRespond(
    vaultIdentity,
    { publicKey: spk.publicKey, privateKey: spk.privateKey },
    otpk ? { publicKey: otpk.publicKey, privateKey: otpk.privateKey } : null,
    initial.identityDhKey,
    initial.ephemeralKey,
  )
  const ratchetState = await initReceiver(x3dh.sharedSecret, {
    publicKey: spk.publicKey,
    privateKey: spk.privateKey,
    publicKeyBase64: spk.publicKeyBase64,
  })
  const { state, plaintext } = await ratchetDecrypt(ratchetState, initial.message, x3dh.associatedData)
  legacyVaultSessions.set(legacyKey, { state, ad: x3dh.associatedData })

  await storePeerIdentity(senderUuid, senderDeviceId, cert.senderIdentitySigningKey, cert.senderIdentityDhKey)
  return { plaintext: new TextDecoder().decode(plaintext), senderUuid }
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
 * Forces the next send to this peer to open with a fresh X3DH handshake.
 * NOT for conversation deletes: dropping only our half leaves the peer sending
 * ratchet packets we can no longer open (see NoSessionError). Group sessions
 * with the same peer are handled separately (sender keys, not pairwise
 * ratchet) and are unaffected by this call.
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
