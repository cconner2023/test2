/**
 * Double Ratchet algorithm.
 *
 * Provides forward secrecy and break-in recovery for 1:1 messaging.
 * Each message uses a unique key derived from a ratcheting chain,
 * and a DH ratchet step occurs each time the conversation direction
 * changes, generating fresh key material.
 *
 * State machine — all functions are pure (state in, state out).
 * Persistence is handled by the session module.
 *
 * Implements the Double Ratchet spec:
 *   https://signal.org/docs/specifications/doubleratchet/
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { SIGNAL } from '../constants'
import { performDh, importDhPublicKey } from './keyManager'
import { kdfRootKey, kdfChainKey } from './kdf'
import type { RatchetState, RatchetKeyPair, MessageHeader, EncryptedMessage } from './types'

const logger = createLogger('SignalRatchet')

// ---- Skipped Key Limits ----

/** Maximum total skipped message keys stored across all chains.
 *  Prevents unbounded memory/storage growth from adversarial headers. */
const MAX_TOTAL_SKIPPED = 1024

/** Time-to-live for skipped message keys (7 days in milliseconds).
 *  Keys older than this are evicted on the next decrypt operation. */
const SKIPPED_KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000

// ---- Helpers ----

/**
 * Extract the message key from a skipped key entry, handling both
 * old format (bare string) and new format ({ key, ts }).
 * Returns null if the entry has expired per SKIPPED_KEY_TTL_MS.
 */
function resolveSkippedKey(entry: string | { key: string; ts: number }): string | null {
  if (typeof entry === 'string') {
    // Old format (no timestamp): treat as valid (no TTL info)
    return entry
  }
  // New format: check TTL
  if (Date.now() - entry.ts > SKIPPED_KEY_TTL_MS) {
    return null // expired
  }
  return entry.key
}

/**
 * Evict expired skipped keys and enforce global cap (MAX_TOTAL_SKIPPED).
 * When over the cap, evicts oldest entries first (by timestamp).
 * Old-format entries without timestamps are evicted first since they
 * predate the TTL system and are assumed oldest.
 */
function pruneSkippedKeys(
  skipped: Record<string, string | { key: string; ts: number }>
): Record<string, string | { key: string; ts: number }> {
  const pruned: Record<string, string | { key: string; ts: number }> = {}
  const now = Date.now()

  // First pass: copy non-expired entries
  for (const [k, v] of Object.entries(skipped)) {
    if (typeof v === 'string') {
      // Old format: keep (no TTL info to check)
      pruned[k] = v
    } else if (now - v.ts <= SKIPPED_KEY_TTL_MS) {
      pruned[k] = v
    }
    // else: expired, skip
  }

  // Second pass: enforce global cap by evicting oldest
  const keys = Object.keys(pruned)
  if (keys.length <= MAX_TOTAL_SKIPPED) {
    return pruned
  }

  // Sort entries: old-format (no ts) first (evict first), then by ascending ts
  const sorted = keys.sort((a, b) => {
    const va = pruned[a]
    const vb = pruned[b]
    const tsA = typeof va === 'string' ? 0 : va.ts
    const tsB = typeof vb === 'string' ? 0 : vb.ts
    return tsA - tsB
  })

  // Keep only the newest MAX_TOTAL_SKIPPED entries
  const toKeep = new Set(sorted.slice(sorted.length - MAX_TOTAL_SKIPPED))
  const capped: Record<string, string | { key: string; ts: number }> = {}
  for (const k of toKeep) {
    capped[k] = pruned[k]
  }

  const evicted = keys.length - MAX_TOTAL_SKIPPED
  if (evicted > 0) {
    logger.warn(`Evicted ${evicted} skipped message key(s) to enforce global cap of ${MAX_TOTAL_SKIPPED}`)
  }

  return capped
}

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

/** Generate a fresh ECDH key pair for the DH ratchet. */
async function generateRatchetKeyPair(): Promise<RatchetKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: SIGNAL.CURVE } as EcKeyGenParams,
    true,
    ['deriveKey', 'deriveBits']
  )
  const exported = await crypto.subtle.exportKey('raw', pair.publicKey)
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    publicKeyBase64: uint8ToBase64(new Uint8Array(exported)),
  }
}

// ---- Header Encoding (for AEAD associated data) ----

/** Encode a message header as bytes for AEAD authentication.
 *  Format: dh_public_key (65 bytes) || pn (4 bytes BE) || n (4 bytes BE) */
function encodeHeader(header: MessageHeader): Uint8Array {
  const dh = base64ToUint8(header.dh)
  const nums = new ArrayBuffer(8)
  const view = new DataView(nums)
  view.setUint32(0, header.pn, false)
  view.setUint32(4, header.n, false)
  return concat(dh, new Uint8Array(nums))
}

// ---- AEAD Encrypt / Decrypt (AES-256-GCM) ----

/** Encrypt plaintext with AES-256-GCM. Returns base64(12-byte IV || ciphertext).
 *  Same IV||ciphertext format as cryptoService.ts for consistency. */
async function aeadEncrypt(
  messageKey: Uint8Array,
  plaintext: Uint8Array,
  associatedData: Uint8Array
): Promise<string> {
  const aesKey = await crypto.subtle.importKey(
    'raw', messageKey as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: associatedData as BufferSource },
    aesKey,
    plaintext as BufferSource
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return uint8ToBase64(combined)
}

/** Decrypt AES-256-GCM ciphertext. Input is base64(IV || ciphertext). */
async function aeadDecrypt(
  messageKey: Uint8Array,
  ciphertextBase64: string,
  associatedData: Uint8Array
): Promise<Uint8Array> {
  const combined = base64ToUint8(ciphertextBase64)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const aesKey = await crypto.subtle.importKey(
    'raw', messageKey as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  )
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: associatedData as BufferSource },
    aesKey,
    ciphertext as BufferSource
  )
  return new Uint8Array(plaintext)
}

// ---- Ratchet Initialization ----

/**
 * Initialize ratchet state for the session initiator (sender of first message).
 *
 * The initiator performs one DH ratchet step immediately:
 *   DH(new_sending_key, peer_signed_prekey) → first sending chain
 *
 * @param sharedSecret - 32-byte X3DH output
 * @param peerSignedPreKey - Responder's signed pre-key (used as initial DHr)
 * @param peerSignedPreKeyBase64 - Same key as base64 for state tracking
 */
export async function initSender(
  sharedSecret: Uint8Array,
  peerSignedPreKey: CryptoKey,
  peerSignedPreKeyBase64: string
): Promise<RatchetState> {
  const dhSending = await generateRatchetKeyPair()

  // First root key ratchet step: DH(our new key, peer's signed prekey)
  const dhOutput = await performDh(dhSending.privateKey, peerSignedPreKey)
  const { rootKey, chainKey } = await kdfRootKey(
    uint8ToBase64(sharedSecret),
    dhOutput
  )

  return {
    dhSending,
    dhReceiving: peerSignedPreKey,
    dhReceivingBase64: peerSignedPreKeyBase64,
    rootKey,
    sendingChainKey: chainKey,
    receivingChainKey: null,
    sendingCount: 0,
    receivingCount: 0,
    previousSendingCount: 0,
    skippedKeys: {},
  }
}

/**
 * Initialize ratchet state for the session responder (receiver of first message).
 *
 * The responder uses their signed pre-key as the initial DH sending key.
 * The first DH ratchet step happens when the first message arrives.
 *
 * @param sharedSecret - 32-byte X3DH output
 * @param signedPreKeyPair - Our signed pre-key pair that was used in X3DH
 */
export async function initReceiver(
  sharedSecret: Uint8Array,
  signedPreKeyPair: RatchetKeyPair
): Promise<RatchetState> {
  return {
    dhSending: signedPreKeyPair,
    dhReceiving: null,
    dhReceivingBase64: null,
    rootKey: uint8ToBase64(sharedSecret),
    sendingChainKey: null,
    receivingChainKey: null,
    sendingCount: 0,
    receivingCount: 0,
    previousSendingCount: 0,
    skippedKeys: {},
  }
}

// ---- Skip Message Keys (for out-of-order delivery) ----

/**
 * Derive and store message keys for messages we haven't received yet.
 * These are kept so that if those messages arrive later (out of order),
 * we can still decrypt them.
 *
 * @throws If skip count exceeds SIGNAL.MAX_SKIP (prevents DoS)
 */
async function skipMessageKeys(
  state: RatchetState,
  until: number
): Promise<RatchetState> {
  if (state.receivingChainKey === null || state.receivingCount >= until) {
    return state
  }

  const toSkip = until - state.receivingCount
  if (toSkip > SIGNAL.MAX_SKIP) {
    throw new Error(
      `Cannot skip ${toSkip} messages (max: ${SIGNAL.MAX_SKIP})`
    )
  }

  let ck = state.receivingChainKey
  let nr = state.receivingCount
  const newSkipped: Record<string, string | { key: string; ts: number }> = { ...state.skippedKeys }
  const now = Date.now()

  while (nr < until) {
    const result = await kdfChainKey(ck)
    ck = result.chainKey
    newSkipped[`${state.dhReceivingBase64}:${nr}`] = {
      key: uint8ToBase64(result.messageKey),
      ts: now,
    }
    nr++
  }

  // Prune expired keys and enforce global cap
  const prunedSkipped = pruneSkippedKeys(newSkipped)

  return {
    ...state,
    receivingChainKey: ck,
    receivingCount: nr,
    skippedKeys: prunedSkipped as RatchetState['skippedKeys'],
  }
}

// ---- DH Ratchet Step ----

/**
 * Perform a DH ratchet step when receiving a message with a new DH key.
 *
 * 1. Derive a new receiving chain from DH(our_current, peer_new)
 * 2. Generate a fresh DH key pair
 * 3. Derive a new sending chain from DH(our_new, peer_new)
 */
async function dhRatchetStep(
  state: RatchetState,
  header: MessageHeader
): Promise<RatchetState> {
  const peerDhKey = await importDhPublicKey(header.dh)

  // Derive receiving chain
  const dh1 = await performDh(state.dhSending.privateKey, peerDhKey)
  const { rootKey: rk1, chainKey: ckr } = await kdfRootKey(state.rootKey, dh1)

  // Generate new sending key pair
  const newDhSending = await generateRatchetKeyPair()

  // Derive sending chain
  const dh2 = await performDh(newDhSending.privateKey, peerDhKey)
  const { rootKey: rk2, chainKey: cks } = await kdfRootKey(rk1, dh2)

  return {
    ...state,
    previousSendingCount: state.sendingCount,
    sendingCount: 0,
    receivingCount: 0,
    dhSending: newDhSending,
    dhReceiving: peerDhKey,
    dhReceivingBase64: header.dh,
    rootKey: rk2,
    sendingChainKey: cks,
    receivingChainKey: ckr,
  }
}

// ---- Encrypt ----

/**
 * Encrypt a plaintext message using the Double Ratchet.
 *
 * Derives a one-time message key from the sending chain, encrypts
 * with AES-256-GCM (authenticating the header as associated data),
 * and advances the sending chain.
 *
 * @param state - Current ratchet state
 * @param plaintext - Raw plaintext bytes
 * @param ad - Session associated data (identity keys)
 * @returns Updated state + encrypted message
 */
export async function ratchetEncrypt(
  state: RatchetState,
  plaintext: Uint8Array,
  ad: Uint8Array
): Promise<{ state: RatchetState; message: EncryptedMessage }> {
  if (!state.sendingChainKey) {
    throw new Error('No sending chain key — ratchet not initialized for sending')
  }

  // Derive message key from sending chain
  const { chainKey, messageKey } = await kdfChainKey(state.sendingChainKey)

  // Build header
  const header: MessageHeader = {
    dh: state.dhSending.publicKeyBase64,
    pn: state.previousSendingCount,
    n: state.sendingCount,
  }

  // Encrypt with AEAD (AD = session AD || encoded header)
  const headerBytes = encodeHeader(header)
  const fullAd = concat(ad, headerBytes)
  const ciphertext = await aeadEncrypt(messageKey, plaintext, fullAd)

  const newState: RatchetState = {
    ...state,
    sendingChainKey: chainKey,
    sendingCount: state.sendingCount + 1,
  }

  return {
    state: newState,
    message: { header, ciphertext },
  }
}

// ---- Decrypt ----

/**
 * Decrypt a message using the Double Ratchet.
 *
 * Handles:
 * 1. Out-of-order messages (via skipped message keys)
 * 2. DH ratchet steps (when peer sends from a new key)
 * 3. Normal in-order decryption
 *
 * @param state - Current ratchet state
 * @param message - Encrypted message with header
 * @param ad - Session associated data (identity keys)
 * @returns Updated state + decrypted plaintext
 * @throws On decryption failure, max skip exceeded, or authentication error
 */
export async function ratchetDecrypt(
  state: RatchetState,
  message: EncryptedMessage,
  ad: Uint8Array
): Promise<{ state: RatchetState; plaintext: Uint8Array }> {
  const { header, ciphertext } = message

  // 1. Try skipped message keys (out-of-order delivery)
  const skipKey = `${header.dh}:${header.n}`
  const skippedEntry = state.skippedKeys[skipKey]
  if (skippedEntry !== undefined) {
    // Resolve the key, handling both old format (string) and new format ({ key, ts })
    const resolvedMk = resolveSkippedKey(skippedEntry as string | { key: string; ts: number })
    if (resolvedMk) {
      const headerBytes = encodeHeader(header)
      const fullAd = concat(ad, headerBytes)
      const mk = base64ToUint8(resolvedMk)
      const plaintext = await aeadDecrypt(mk, ciphertext, fullAd)

      const newSkipped = { ...state.skippedKeys }
      delete newSkipped[skipKey]

      return {
        state: { ...state, skippedKeys: newSkipped },
        plaintext,
      }
    }
    // Key was expired; remove it and fall through to normal decrypt path
    const newSkipped = { ...state.skippedKeys }
    delete newSkipped[skipKey]
    // Continue with updated skipped keys
    state = { ...state, skippedKeys: newSkipped }
  }

  let newState = { ...state, skippedKeys: { ...state.skippedKeys } }

  // 2. DH ratchet if the header contains a new DH key
  if (header.dh !== state.dhReceivingBase64) {
    // Skip missed messages in the current receiving chain
    newState = await skipMessageKeys(newState, header.pn)
    // Perform DH ratchet step
    newState = await dhRatchetStep(newState, header)
  }

  // 3. Skip missed messages up to this message's number
  newState = await skipMessageKeys(newState, header.n)

  // 4. Derive message key from receiving chain
  if (!newState.receivingChainKey) {
    throw new Error('No receiving chain key after ratchet step')
  }
  const { chainKey, messageKey } = await kdfChainKey(newState.receivingChainKey)
  newState = {
    ...newState,
    receivingChainKey: chainKey,
    receivingCount: newState.receivingCount + 1,
  }

  // 5. Decrypt
  const headerBytes = encodeHeader(header)
  const fullAd = concat(ad, headerBytes)
  const plaintext = await aeadDecrypt(messageKey, ciphertext, fullAd)

  logger.debug(`Decrypted message n=${header.n} from DH key ${header.dh.slice(0, 8)}…`)
  return { state: newState, plaintext }
}
