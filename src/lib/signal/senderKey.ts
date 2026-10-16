/**
 * Sender Key cryptographic operations for group messaging.
 *
 * Implements the Signal Sender Keys protocol:
 * - Each group member generates their own sender key (chain key + ECDSA signing pair).
 * - The public portion (SenderKeyDistribution) is shared with every group member
 *   via existing 1:1 pairwise sessions.
 * - Group messages are encrypted once (AES-256-GCM) and signed (ECDSA-SHA256).
 *   All group members can decrypt using their stored copy of the sender's key.
 *
 * Chain mechanics mirror the Double Ratchet chain key pattern in kdf.ts:
 *   messageKey  = HMAC-SHA256(chainKey, 0x01)   — same byte constant as kdfChainKey
 *   nextChainKey = HMAC-SHA256(chainKey, 0x02)  — same byte constant as kdfChainKey
 *
 * Out-of-order delivery is handled by storing skipped message keys (bounded by
 * SIGNAL.MAX_SKIP, same constant as ratchet.ts). Skipped keys age out via the
 * same { key, ts } pattern used in the Double Ratchet.
 *
 * References:
 *   https://signal.org/docs/specifications/senderkey/
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { SIGNAL } from '../constants'
import { kdfChainKey } from './kdf'
import {
  saveSenderKey,
  loadSenderKey,
} from './senderKeyStore'
import type { SenderKeyState, SenderKeyDistribution, SenderKeyMessage } from './types'

const logger = createLogger('SenderKey')

// ---- Concurrency Lock (same pattern as session.ts withSessionLock) ----

const senderKeyLocks = new Map<string, Promise<void>>()

/** Serialize async operations on the same sender key to prevent TOCTOU races. */
function withSenderKeyLock<T>(senderKeyId: string, fn: () => Promise<T>): Promise<T> {
  const prev = senderKeyLocks.get(senderKeyId) ?? Promise.resolve()
  let release!: () => void
  const next = new Promise<void>((resolve) => { release = resolve })
  senderKeyLocks.set(senderKeyId, next)
  return prev.then(() => fn()).finally(() => {
    if (senderKeyLocks.get(senderKeyId) === next) senderKeyLocks.delete(senderKeyId)
    release()
  })
}

// ---- Constants ----

/** ECDSA P-256 algorithm parameters — mirrors keyManager.ts. */
const ECDSA_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: SIGNAL.CURVE }
const ECDSA_SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' }

/** Time-to-live for skipped sender-key message keys (7 days in ms). */
const SKIPPED_KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000

// ---- Errors ----

/**
 * We hold no usable sender key for this sender: none at all (missed the
 * distribution), or a different key than the message was sent under (sender
 * rotated or reinstalled). Recoverable only by asking the sender to
 * re-distribute (retry-receipt).
 */
export class SenderKeyMissingError extends Error {
  constructor(readonly senderKeyId: string, reason: string) {
    super(`No sender key for ${senderKeyId} (${reason}) — request re-distribution from this sender`)
    this.name = 'SenderKeyMissingError'
  }
}

// ---- Skipped Key Storage (persisted on the SenderKeyState) ----

type SkippedKeys = NonNullable<SenderKeyState['skippedKeys']>

/**
 * Drop expired skipped keys and enforce the per-sender MAX_SKIP cap (oldest
 * iterations evicted first). Returns a new map.
 */
function pruneSkippedKeys(senderKeyId: string, skipped: SkippedKeys): SkippedKeys {
  const now = Date.now()
  const live = Object.entries(skipped)
    .filter(([, e]) => now - e.ts <= SKIPPED_KEY_TTL_MS)
    .sort(([a], [b]) => Number(a) - Number(b))
  const evictCount = Math.max(0, live.length - SIGNAL.MAX_SKIP)
  if (evictCount > 0) {
    logger.warn(`Evicted ${evictCount} skipped sender-key message(s) for ${senderKeyId} to enforce MAX_SKIP cap`)
  }
  return Object.fromEntries(live.slice(evictCount))
}


// ---- AES-256-GCM ----

/**
 * Encrypt plaintext bytes with AES-256-GCM.
 * Returns base64(12-byte IV || ciphertext) — same format as ratchet.ts aeadEncrypt.
 */
async function aeadEncrypt(messageKey: Uint8Array, plaintext: Uint8Array): Promise<string> {
  const aesKey = await crypto.subtle.importKey(
    'raw', messageKey as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext as BufferSource
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return uint8ToBase64(combined)
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Input is base64(IV(12) || ciphertext) — same format as ratchet.ts aeadDecrypt.
 */
async function aeadDecrypt(messageKey: Uint8Array, ciphertextBase64: string): Promise<Uint8Array> {
  const combined = base64ToUint8(ciphertextBase64)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const aesKey = await crypto.subtle.importKey(
    'raw', messageKey as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  )
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext as BufferSource
  )
  return new Uint8Array(plaintext)
}

// ---- Signature Helpers ----

/**
 * Build the canonical length-prefixed byte payload that is signed/verified for a group message.
 *
 * Covers: groupId + senderId + deviceId + iteration + ciphertext
 *
 * Each field is length-prefixed with a 4-byte big-endian uint32 to prevent
 * boundary ambiguity attacks (e.g., "ab"+"cde" vs "abc"+"de" producing the
 * same concatenated string). The iteration is encoded as a 4-byte big-endian
 * uint32 (network byte order).
 */
function buildSignedPayload(
  groupId: string,
  senderId: string,
  deviceId: string,
  iteration: number,
  ciphertext: Uint8Array
): Uint8Array {
  const enc = new TextEncoder()
  const iterBytes = new Uint8Array(4)
  new DataView(iterBytes.buffer).setUint32(0, iteration, false)

  const fields: Uint8Array[] = [
    enc.encode(groupId),
    enc.encode(senderId),
    enc.encode(deviceId),
    iterBytes,
    ciphertext,
  ]

  let totalLen = 0
  for (const f of fields) totalLen += 4 + f.length
  const buf = new Uint8Array(totalLen)
  const view = new DataView(buf.buffer)
  let offset = 0
  for (const f of fields) {
    view.setUint32(offset, f.length, false)
    offset += 4
    buf.set(f, offset)
    offset += f.length
  }
  return buf
}

// ---- Public API ----

/**
 * Generate a new sender key for ourselves in a group.
 *
 * Creates a random 256-bit chain key and a fresh ECDSA P-256 signing key pair.
 * The resulting SenderKeyState is persisted to IDB and returned.
 *
 * @param groupId  - Group this key belongs to
 * @param memberId - Our own user ID
 * @param deviceId - Our own device ID
 * @param epoch    - Membership epoch this key is minted under (default 0)
 */
export async function generateSenderKey(
  groupId: string,
  memberId: string,
  deviceId: string,
  epoch = 0
): Promise<SenderKeyState> {
  // 1. Generate a random 256-bit chain key
  const chainKeyBytes = crypto.getRandomValues(new Uint8Array(32))
  const chainKey = uint8ToBase64(chainKeyBytes)

  // 2. Generate ECDSA P-256 signing key pair
  //    extractable=true for initial generation so we can export the public key.
  //    Private key is re-imported as non-extractable immediately after.
  const signingPair = await crypto.subtle.generateKey(
    ECDSA_PARAMS, true, ['sign', 'verify']
  )

  // 3. Export signing public key in SPKI format (matches identity signing key convention)
  const signingPubRaw = await crypto.subtle.exportKey('spki', signingPair.publicKey)
  const signingPublicKey = uint8ToBase64(new Uint8Array(signingPubRaw))

  // 4. Re-import private key as non-extractable (prevents exfiltration via IDB access)
  const privRaw = await crypto.subtle.exportKey('pkcs8', signingPair.privateKey)
  const nonExtractablePrivate = await crypto.subtle.importKey(
    'pkcs8', privRaw, ECDSA_PARAMS, false, ['sign']
  )
  new Uint8Array(privRaw).fill(0) // zero out exported bytes

  const senderKeyId = `${groupId}:${memberId}:${deviceId}`
  const state: SenderKeyState = {
    groupId,
    memberId,
    deviceId,
    senderKeyId,
    chainKey,
    iteration: 0,
    signingPublicKey,
    signingPrivateKey: nonExtractablePrivate,
    epoch,
    keyId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }

  await saveSenderKey(state)
  logger.info(`Generated sender key for group ${groupId} member ${memberId} device ${deviceId}`)
  return state
}

/**
 * Create a SenderKeyDistribution message from our sender key.
 *
 * Extracts the public portion only — the signing private key is never included.
 * Pass the returned distribution to each group member via their 1:1 pairwise session.
 *
 * @param key - Our SenderKeyState (must have been generated by generateSenderKey)
 */
export function createDistribution(key: SenderKeyState): SenderKeyDistribution {
  return {
    type: 'sender-key-distribution',
    groupId: key.groupId,
    memberId: key.memberId,
    deviceId: key.deviceId,
    chainKey: key.chainKey,
    iteration: key.iteration,
    signingPublicKey: key.signingPublicKey,
    keyId: key.keyId,
  }
}

/**
 * Store a received SenderKeyDistribution from another group member.
 *
 * Called when we receive a `sender-key-distribution` message via our 1:1 session
 * with the sender. The stored state is used to decrypt that member's future
 * group messages.
 *
 * @param dist         - Distribution message received from the sender
 * @param groupMembers - List of known member IDs for the group. The distribution
 *                       is rejected if the sender is not present in the list
 *                       (prevents rogue key injection from non-members).
 * @param sender       - The authenticated 1:1 sender the distribution arrived
 *                       from. A member may only distribute its OWN key for the
 *                       device it sent from — otherwise any member could replace
 *                       another member's key and sign messages as them.
 * @returns true if the key was stored, false if rejected
 */
export async function processSenderKeyDistribution(
  dist: SenderKeyDistribution,
  groupMembers: string[],
  sender: { userId: string; deviceId: string },
): Promise<boolean> {
  if (dist.memberId !== sender.userId || dist.deviceId !== sender.deviceId) {
    logger.warn(
      `Rejected sender key distribution for ${dist.memberId}:${dist.deviceId} ` +
      `delivered by ${sender.userId}:${sender.deviceId}`
    )
    return false
  }
  if (!groupMembers.includes(dist.memberId)) {
    logger.warn(`Rejected sender key distribution: ${dist.memberId} is not a member of group ${dist.groupId}`)
    return false
  }

  const senderKeyId = `${dist.groupId}:${dist.memberId}:${dist.deviceId}`
  return withSenderKeyLock(senderKeyId, async () => {
    // A re-delivery of the key we already hold must not rewind our chain
    // position — that would make every message since then undecryptable.
    const existing = await loadSenderKey(dist.groupId, dist.memberId, dist.deviceId)
    if (
      existing &&
      (existing.keyId ?? null) === (dist.keyId ?? null) &&
      existing.signingPublicKey === dist.signingPublicKey &&
      existing.iteration >= dist.iteration
    ) {
      logger.debug(`Ignoring stale/duplicate sender key distribution for ${senderKeyId}`)
      return true
    }

    const state: SenderKeyState = {
      groupId: dist.groupId,
      memberId: dist.memberId,
      deviceId: dist.deviceId,
      senderKeyId,
      chainKey: dist.chainKey,
      iteration: dist.iteration,
      signingPublicKey: dist.signingPublicKey,
      keyId: dist.keyId,
      createdAt: new Date().toISOString(),
    }

    await saveSenderKey(state)
    logger.info(`Stored sender key distribution from ${dist.memberId}:${dist.deviceId} for group ${dist.groupId}`)
    return true
  })
}

/**
 * Encrypt a plaintext message for a group using our sender key.
 *
 * Steps:
 * 1. Load our SenderKeyState for (groupId, memberId, deviceId)
 * 2. Derive message key via kdfChainKey: HMAC-SHA256(chainKey, 0x01); advance chain: HMAC-SHA256(chainKey, 0x02)
 * 3. Encrypt with AES-256-GCM (12-byte random IV prepended to ciphertext)
 * 4. Sign: ECDSA-SHA256 over length-prefixed (groupId + memberId + deviceId + iteration + ciphertext)
 * 5. Persist updated state (advanced chain key, incremented iteration)
 * 6. Return SenderKeyMessage
 *
 * @param groupId  - Group to send to
 * @param memberId - Our own user ID (must match the stored key)
 * @param deviceId - Our own device ID (must match the stored key)
 * @param plaintext - UTF-8 plaintext to encrypt
 * @throws If no sender key exists for this (groupId, memberId, deviceId) tuple
 * @throws If the stored key has no signingPrivateKey (cannot sign without our own key)
 */
export async function senderKeyEncrypt(
  groupId: string,
  memberId: string,
  deviceId: string,
  plaintext: string
): Promise<SenderKeyMessage> {
  const senderKeyId = `${groupId}:${memberId}:${deviceId}`
  return withSenderKeyLock(senderKeyId, async () => {
  const state = await loadSenderKey(groupId, memberId, deviceId)
  if (!state) {
    throw new Error(
      `No sender key for group ${groupId} member ${memberId} device ${deviceId} — ` +
      'call generateSenderKey() first'
    )
  }
  if (!state.signingPrivateKey) {
    throw new Error(
      `Sender key for ${groupId}:${memberId}:${deviceId} has no signing private key — ` +
      'can only encrypt with our own sender key'
    )
  }

  const currentIteration = state.iteration

  // 2. Derive message key for this iteration via HMAC-SHA256(chainKey, 0x01) — same as Double Ratchet
  const { messageKey, chainKey: nextChainKey } = await kdfChainKey(state.chainKey)

  // 3. Encrypt plaintext
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const ciphertext = await aeadEncrypt(messageKey, plaintextBytes)

  // 4. Sign canonical length-prefixed payload covering groupId + senderId + deviceId + iteration + ciphertext
  const ciphertextBytes = base64ToUint8(ciphertext)
  const sigData = buildSignedPayload(groupId, memberId, deviceId, currentIteration, ciphertextBytes)
  const sigBuf = await crypto.subtle.sign(ECDSA_SIGN_PARAMS, state.signingPrivateKey, sigData as BufferSource)
  const signature = uint8ToBase64(new Uint8Array(sigBuf))

  // 5. Chain key already advanced by kdfChainKey above

  // 6. Persist updated state (advanced chain, incremented iteration)
  const updatedState: SenderKeyState = {
    ...state,
    chainKey: nextChainKey,
    iteration: currentIteration + 1,
  }
  await saveSenderKey(updatedState)

  logger.info(`Encrypted group message for ${groupId} at iteration ${currentIteration}`)

  return {
    groupId,
    senderId: memberId,
    senderDeviceId: deviceId,
    iteration: currentIteration,
    ...(state.keyId ? { keyId: state.keyId } : {}),
    ciphertext,
    signature,
  }
  }) // end withSenderKeyLock
}

/**
 * Decrypt a sender-key encrypted group message.
 *
 * Steps:
 * 1. Load SenderKeyState for (groupId, senderId, senderDeviceId)
 * 2. If missing, throw a descriptive error — caller should request re-distribution
 * 3. Check skipped key cache for out-of-order messages
 * 4. If message.iteration > state.iteration: advance chain storing skipped keys (bounded by MAX_SKIP)
 * 5. Verify ECDSA signature BEFORE decrypting (fail fast on tampered messages)
 * 6. Decrypt AES-256-GCM
 * 7. Persist updated state (advanced chain)
 * 8. Return plaintext string
 *
 * @param message - The SenderKeyMessage received from the group
 * @throws If no sender key is stored for the sender (request re-distribution)
 * @throws If the chain must skip more than SIGNAL.MAX_SKIP messages
 * @throws If the ECDSA signature is invalid (potential tampering)
 * @throws If AES-GCM decryption fails (authentication tag mismatch)
 */
export async function senderKeyDecrypt(message: SenderKeyMessage): Promise<string> {
  const { groupId, senderId, senderDeviceId, iteration, ciphertext, signature } = message
  const senderKeyId = `${groupId}:${senderId}:${senderDeviceId}`

  return withSenderKeyLock(senderKeyId, async () => {
  const state = await loadSenderKey(groupId, senderId, senderDeviceId)
  if (!state) {
    throw new SenderKeyMissingError(senderKeyId, 'never received')
  }
  if (message.keyId && state.keyId && message.keyId !== state.keyId) {
    throw new SenderKeyMissingError(senderKeyId, 'sender is on a newer key')
  }

  const skipped: SkippedKeys = { ...(state.skippedKeys ?? {}) }

  // Out-of-order: a key we derived earlier while skipping ahead.
  const skippedEntry = skipped[iteration]
  if (skippedEntry && Date.now() - skippedEntry.ts <= SKIPPED_KEY_TTL_MS) {
    await verifySenderSignature(state.signingPublicKey, groupId, senderId, senderDeviceId, iteration, ciphertext, signature)
    const plaintext = await aeadDecrypt(base64ToUint8(skippedEntry.key), ciphertext)
    delete skipped[iteration]
    await saveSenderKey({ ...state, skippedKeys: skipped })
    logger.info(`Decrypted out-of-order group message from ${senderKeyId} at iteration ${iteration}`)
    return new TextDecoder().decode(plaintext)
  }

  if (iteration < state.iteration) {
    // A key minted before keyIds existed can't be told apart from a rotated one
    // by id; an iteration behind our position with nothing skipped means our
    // copy is not the key this message was sent under (or it is a replay).
    if (!message.keyId || !state.keyId) {
      throw new SenderKeyMissingError(senderKeyId, `iteration ${iteration} behind chain position ${state.iteration}`)
    }
    throw new Error(
      `Cannot decrypt group message from ${senderKeyId}: ` +
      `iteration ${iteration} is behind current chain position ${state.iteration} ` +
      'and was not found in the skipped key cache'
    )
  }

  // Advance the chain to the message's iteration, keeping skipped keys
  let ck = state.chainKey
  if (iteration > state.iteration) {
    const toSkip = iteration - state.iteration
    if (toSkip > SIGNAL.MAX_SKIP) {
      throw new Error(
        `Cannot skip ${toSkip} sender key messages for ${senderKeyId} (max: ${SIGNAL.MAX_SKIP})`
      )
    }
    const now = Date.now()
    for (let i = state.iteration; i < iteration; i++) {
      const { messageKey: skippedMk, chainKey: nextCk } = await kdfChainKey(ck)
      skipped[i] = { key: uint8ToBase64(skippedMk), ts: now }
      ck = nextCk
    }
  }

  // Verify signature BEFORE decrypting (fail fast on tampering)
  await verifySenderSignature(state.signingPublicKey, groupId, senderId, senderDeviceId, iteration, ciphertext, signature)

  // Derive the message key for this iteration and advance
  const { messageKey, chainKey: nextChainKey } = await kdfChainKey(ck)

  // Decrypt
  const plaintext = await aeadDecrypt(messageKey, ciphertext)

  // Persist the advanced chain only after a successful decrypt
  await saveSenderKey({
    ...state,
    chainKey: nextChainKey,
    iteration: iteration + 1,
    skippedKeys: pruneSkippedKeys(senderKeyId, skipped),
  })

  logger.info(`Decrypted group message from ${senderKeyId} at iteration ${iteration}`)
  return new TextDecoder().decode(plaintext)
  }) // end withSenderKeyLock
}

/**
 * Rotate the sender key for a group member.
 *
 * Generates a fresh key pair, replacing the existing sender key in IDB.
 * After rotation, the caller must distribute the new key to all remaining
 * group members (e.g., after a member is removed for forward secrecy).
 *
 * @param groupId  - Group to rotate the key for
 * @param memberId - Member whose key is being rotated (must be our own)
 * @param deviceId - Device whose key is being rotated
 * @param epoch    - Membership epoch the fresh key is minted under (default 0)
 */
export async function rotateSenderKey(
  groupId: string,
  memberId: string,
  deviceId: string,
  epoch = 0
): Promise<SenderKeyState> {
  const newKey = await generateSenderKey(groupId, memberId, deviceId, epoch)
  logger.info(`Rotated sender key for group ${groupId} member ${memberId} device ${deviceId} at epoch ${epoch}`)
  return newKey
}

// ---- Internal: Signature Verification ----

/**
 * Import the sender's ECDSA signing public key (SPKI base64) and verify
 * the message signature. Throws if the signature is invalid.
 */
async function verifySenderSignature(
  signingPublicKeyBase64: string,
  groupId: string,
  senderId: string,
  deviceId: string,
  iteration: number,
  ciphertext: string,
  signature: string
): Promise<void> {
  const keyBytes = base64ToUint8(signingPublicKeyBase64)
  const publicKey = await crypto.subtle.importKey(
    'spki',
    keyBytes.buffer as ArrayBuffer,
    ECDSA_PARAMS,
    true,
    ['verify']
  )

  const ciphertextBytes = base64ToUint8(ciphertext)
  const sigData = buildSignedPayload(groupId, senderId, deviceId, iteration, ciphertextBytes)
  const sigBytes = base64ToUint8(signature)

  const valid = await crypto.subtle.verify(
    ECDSA_SIGN_PARAMS,
    publicKey,
    sigBytes as BufferSource,
    sigData as BufferSource
  )

  if (!valid) {
    throw new Error(
      `Sender key signature verification failed for group ${groupId} sender ${senderId}:${deviceId} ` +
      `at iteration ${iteration} — potential message tampering`
    )
  }
}
