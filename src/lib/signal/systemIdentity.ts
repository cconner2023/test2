/**
 * System identity — shared "System" entity for dev-authored messages.
 *
 * Architecture
 * ────────────
 *   - System has a single public Signal bundle in `signal_key_bundles` at
 *     SYSTEM_USER_ID / device_id='primary'. The private side is wrapped per-dev
 *     with that dev's password-derived AES-GCM key and stored opaque in
 *     `system_identity_keys_per_dev`. Any dev can unwrap their own row on
 *     sign-in; no dev can read another dev's wrapped blob.
 *   - Outbound (dev → user) uses X3DH initiator from system's keys to the
 *     recipient's bundle. No persistent ratchet state — every send is a fresh
 *     X3DH so multiple devs can send concurrently without ratchet desync.
 *     Recipients decrypt via the unchanged `processIncomingMessage` path
 *     (InitialMessage → X3DH responder → ratchet receiver init).
 *   - Inbound (user → system) is X3DH responder using system's privates.
 *     One-time pre-keys are consumed and removed from the wrapped blob via
 *     optimistic-concurrency UPDATE on `system_identity_keys_per_dev`. Public
 *     bundle's `one_time_pre_keys` is updated in tandem.
 *   - Reply-drain: any dev pulls `drain_system_inbox`, decrypts each, posts
 *     into local store under conversation key = peer userId. Decryption only
 *     supports the X3DH initial-message path in v1 — subsequent ratchet
 *     messages from the same peer (where peer already has a session) need the
 *     reply-side ratchet state, which v1 does not persist. Peer-side
 *     `sendMessage` to SYSTEM_USER_ID therefore forces re-X3DH every send
 *     by deleting any cached session before encrypting.
 *
 * v1 explicit limitations (documented; expand later as needed):
 *   - Multi-dev bootstrap ceremony is deferred. If the public bundle is
 *     initialized but the calling dev has no wrapped blob row, `bootstrap`
 *     fails with `not-provisioned`. v1 pilot has a single dev.
 *   - System signed-pre-key rotation is not implemented.
 *   - One-time pre-key replenishment is not implemented (initial 500-key
 *     pool is sufficient for the pilot).
 *
 * Cross-links:
 *   - DB schema + RPCs: supabase/migrations/20260522b_system_identity.sql
 *   - Send wire gate:   supabase/migrations/20260522_signal_system_messages.sql
 *   - peerProfile mask: src/stores/useMessagingStore.ts (SYSTEM_PEER_PROFILE)
 *   - KG facts:         SYSTEM_USER_ID, system_identity_keys_per_dev
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { bytesToHex, hexToBytes } from '../cryptoUtils'
import { supabase } from '../supabase'
import { SIGNAL } from '../constants'
import { ok, err, callRpc, type Result } from '../result'
import {
  generateDhKeyPair,
  generateSigningKeyPair,
  exportPublicKey,
  signBytes,
  importDhPublicKey,
} from './keyPrimitives'
import { x3dhInitiate, x3dhRespond } from './x3dh'
import { initSender, initReceiver, ratchetEncrypt, ratchetDecrypt } from './ratchet'
import { seal, unseal, type SealedEnvelope } from './sealedSender'
import { saveMessage, getTombstone, deleteMessagesByOriginId } from './messageStore'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { parseMessageContent, type IntakeRequestContent } from './messageContent'
import { isCalendarEvent, routeCalendarEvent } from '../calendarRouting'
import { isMapOverlay, isMapFeature, routeMapOverlay, routeMapFeature } from '../mapOverlayRouting'
import type {
  PublicKeyBundle,
  StoredLocalIdentity,
  InitialMessage,
  EncryptedMessage,
  RatchetState,
} from './types'
import type { DecryptedSignalMessage, SignalMessageRow } from './transportTypes'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

const logger = createLogger('SystemIdentity')

// ── Constants ───────────────────────────────────────────────────────────────

/** Sentinel pseudo-user UUID for the shared "System" entity. */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'

/** Singleton device id for system's Signal key bundle. */
export const SYSTEM_DEVICE_ID = 'primary'

/** Same KDF iterations as vault — Web Crypto has no native Argon2. */
const SYSTEM_KDF_ITERATIONS = 600_000

/** Initial OTP pool size. v1 has no replenishment; 500 is plenty for pilot. */
const SYSTEM_OTP_BATCH_SIZE = 500

/**
 * Synthetic ClinicMedic for the System entity. Injected into
 * useMessagingStore.peerProfiles on hydration so existing name/avatar
 * resolution paths render 'System' anywhere SYSTEM_USER_ID appears as
 * sender or recipient — no profiles row required (and intentionally
 * absent: profiles.id FKs to auth.users).
 */
export const SYSTEM_PEER_PROFILE: ClinicMedic = {
  id: SYSTEM_USER_ID,
  firstName: 'System',
  lastName: null,
  middleInitial: null,
  rank: null,
  credential: null,
  avatarId: null,
}

// ── Internal types ──────────────────────────────────────────────────────────

interface SystemPreKeyJwk {
  keyId: number
  privateKey: JsonWebKey
  publicKey: JsonWebKey
  publicKeyBase64: string
}

interface SystemSignedPreKeyJwk {
  keyId: number
  privateKey: JsonWebKey
  publicKey: JsonWebKey
  publicKeyBase64: string
  signature: string
  createdAt: string
}

interface SystemBlobPlaintext {
  signingPrivateKey: JsonWebKey
  signingPublicKey: JsonWebKey
  dhPrivateKey: JsonWebKey
  dhPublicKey: JsonWebKey
  signingPublicKeyBase64: string
  dhPublicKeyBase64: string
  signedPreKey: SystemSignedPreKeyJwk
  preKeys: SystemPreKeyJwk[]
  nextPreKeyId: number
}

interface SystemImportedKeys {
  signingPublicKey: CryptoKey
  signingPrivateKey: CryptoKey
  dhPublicKey: CryptoKey
  dhPrivateKey: CryptoKey
  signingPublicKeyBase64: string
  dhPublicKeyBase64: string
  signedPreKey: {
    keyId: number
    privateKey: CryptoKey
    publicKey: CryptoKey
    publicKeyBase64: string
    signature: string
    createdAt: string
  }
  preKeys: Array<{
    keyId: number
    privateKey: CryptoKey
    publicKey: CryptoKey
    publicKeyBase64: string
  }>
  nextPreKeyId: number
}

interface SystemKeysRow {
  dev_user_id: string
  encrypted_blob: string
  salt: string
  iv: string
  kdf_iterations: number
  version: number
}

interface InitOrGetResult {
  initialized: boolean
  has_dev_blob: boolean
  dev_blob: {
    encrypted_blob: string
    salt: string
    iv: string
    kdf_iterations: number
    version: number
  } | null
}

// ── Module state ────────────────────────────────────────────────────────────

let _cachedWrappingKey: CryptoKey | null = null
let _cachedWrappingSalt: string | null = null
let _cachedSystemKeys: SystemImportedKeys | null = null
let _systemKeyReady: Promise<void> | null = null
/** Bootstrap promise — coalesces concurrent bootstrap calls in the same session. */
let _bootstrapInFlight: Promise<Result<void>> | null = null
/** Single-flight lock for drainSystemInbox. Realtime can fire it rapidly. */
let _drainInFlight: Promise<number> | null = null

// ── IDB persistence for the wrapping CryptoKey ─────────────────────────────
//
// Without this, the dev's non-extractable wrapping key only lives for the
// session that entered the password. Page refresh restores the auth token but
// not the in-memory key, so ensureSystemIdentity returns no-identity until
// the dev signs out + back in. Mirrors the pattern in
// backupService.ts:103-150 (BACKUP_KEY_DB) so the security profile is
// identical: AES-GCM CryptoKey is stored non-extractable; the browser
// preserves the key handle but does not allow raw export. The salt sits
// alongside as plain text (it's per-dev random and already visible in
// system_identity_keys_per_dev.salt).

const SYSTEM_KEY_DB = 'adtmc-system-key'
const SYSTEM_KEY_STORE = 'keys'
const SYSTEM_KEY_KEY_ID = 'wrapping-key'
const SYSTEM_KEY_SALT_ID = 'wrapping-salt'

function openSystemKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYSTEM_KEY_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SYSTEM_KEY_STORE)) {
        req.result.createObjectStore(SYSTEM_KEY_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function persistSystemKeyToIdb(key: CryptoKey, saltHex: string): Promise<void> {
  const db = await openSystemKeyDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SYSTEM_KEY_STORE, 'readwrite')
    const store = tx.objectStore(SYSTEM_KEY_STORE)
    store.put(key, SYSTEM_KEY_KEY_ID)
    store.put(saltHex, SYSTEM_KEY_SALT_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadSystemKeyFromIdb(): Promise<{ key: CryptoKey; salt: string } | null> {
  const db = await openSystemKeyDb()
  const out = await new Promise<{ key: CryptoKey; salt: string } | null>((resolve, reject) => {
    const tx = db.transaction(SYSTEM_KEY_STORE, 'readonly')
    const store = tx.objectStore(SYSTEM_KEY_STORE)
    const keyReq = store.get(SYSTEM_KEY_KEY_ID)
    const saltReq = store.get(SYSTEM_KEY_SALT_ID)
    tx.oncomplete = () => {
      const key = keyReq.result as CryptoKey | undefined
      const salt = saltReq.result as string | undefined
      if (key && typeof salt === 'string') resolve({ key, salt })
      else resolve(null)
    }
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return out
}

async function clearSystemKeyFromIdb(): Promise<void> {
  const db = await openSystemKeyDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SYSTEM_KEY_STORE, 'readwrite')
    const store = tx.objectStore(SYSTEM_KEY_STORE)
    store.delete(SYSTEM_KEY_KEY_ID)
    store.delete(SYSTEM_KEY_SALT_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// ── Decrypted-system-message listener (realtime → notification dispatch) ──
//
// Mirrors the onLoRaMessage pattern in signalService.ts. Fires AFTER the row
// has been saved to IDB + pushed into useMessagingStore, so subscribers
// (MessagesContext) can run side effects like toast + sound without
// duplicating decrypt or storage work. Only emitted for routed conversation
// messages, NOT delete envelopes / calendar / overlay / feature payloads —
// those have their own routing and don't surface a system reply card.

const _systemMessageListeners = new Set<(msg: DecryptedSignalMessage) => void>()

/** Subscribe to decrypted system replies (dev-only). Returns an unsubscribe. */
export function onSystemMessage(cb: (msg: DecryptedSignalMessage) => void): () => void {
  _systemMessageListeners.add(cb)
  return () => { _systemMessageListeners.delete(cb) }
}

/** Register the wrapping-key derivation promise (called from authService). */
export function setSystemKeyReady(promise: Promise<void>): void {
  _systemKeyReady = promise
}

/** Clear all system-identity state. Called on sign-out. */
export function clearSystemIdentity(): void {
  _cachedWrappingKey = null
  _cachedWrappingSalt = null
  _cachedSystemKeys = null
  _systemKeyReady = null
  _bootstrapInFlight = null
  _drainInFlight = null
  _systemMessageListeners.clear()
  // Fire-and-forget IDB clear so the next sign-in (possibly a different dev
  // on the same browser) doesn't unwrap the previous dev's blob with stale
  // cached state.
  clearSystemKeyFromIdb().catch(() => { /* IDB unavailable */ })
}

// ── PBKDF2 wrapping-key derivation ──────────────────────────────────────────

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
      // info via PBKDF2 isn't a thing, so domain separation lives in the salt
      // (system salt is generated fresh per-dev and is distinct from vault salt).
    },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Derive and cache the system wrapping key from the dev's password.
 *
 * Called during `authService.signIn` for users with the dev role. If the
 * dev already has a row, reuses its salt; otherwise generates a fresh salt
 * and stashes it so the first-time `bootstrap` write uses the same one.
 *
 * Safe to call for non-dev users — the row lookup just returns nothing and
 * we stash a fresh salt that will go unused (cache is cleared on sign-out
 * anyway). Cheap to be permissive here; saves an `isDev` round-trip.
 */
export async function deriveAndCacheSystemWrappingKey(
  password: string,
  devUserId: string,
): Promise<void> {
  // Try to find an existing row for this dev so we reuse its salt.
  const { data } = await supabase
    .from('system_identity_keys_per_dev')
    .select('salt, kdf_iterations')
    .eq('dev_user_id', devUserId)
    .maybeSingle()

  let saltHex: string
  let iters = SYSTEM_KDF_ITERATIONS
  if (data) {
    saltHex = data.salt
    iters = data.kdf_iterations ?? SYSTEM_KDF_ITERATIONS
  } else {
    const fresh = crypto.getRandomValues(new Uint8Array(32))
    saltHex = bytesToHex(fresh)
  }

  const saltBytes = hexToBytes(saltHex)
  _cachedWrappingKey = await deriveWrappingKey(password, saltBytes, iters)
  _cachedWrappingSalt = saltHex
  // Persist so page refresh / PWA reopen doesn't force a re-sign-in to
  // re-derive. Fire-and-forget — IDB failure isn't fatal; the cached
  // module state still works for the current session.
  persistSystemKeyToIdb(_cachedWrappingKey, saltHex).catch(() =>
    logger.warn('Failed to persist system wrapping key to IDB'),
  )
  logger.info('System wrapping key cached')
}

// ── Blob encrypt / decrypt ──────────────────────────────────────────────────

async function encryptBlob(
  plaintext: SystemBlobPlaintext,
  wrappingKey: CryptoKey,
): Promise<{ encryptedBlob: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ptBytes = new TextEncoder().encode(JSON.stringify(plaintext))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    ptBytes,
  )
  return {
    encryptedBlob: uint8ToBase64(new Uint8Array(ct)),
    iv: uint8ToBase64(iv),
  }
}

async function decryptBlob(
  encryptedBlob: string,
  iv: string,
  wrappingKey: CryptoKey,
): Promise<SystemBlobPlaintext> {
  const ct = base64ToUint8(encryptedBlob)
  const ivBytes = base64ToUint8(iv)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    wrappingKey,
    ct,
  )
  return JSON.parse(new TextDecoder().decode(pt)) as SystemBlobPlaintext
}

// ── JWK ↔ CryptoKey import ──────────────────────────────────────────────────

async function importSystemKeys(blob: SystemBlobPlaintext): Promise<SystemImportedKeys> {
  const [signingPriv, signingPub, dhPriv, dhPub] = await Promise.all([
    crypto.subtle.importKey('jwk', blob.signingPrivateKey,
      { name: 'ECDSA', namedCurve: SIGNAL.CURVE }, true, ['sign']),
    crypto.subtle.importKey('jwk', blob.signingPublicKey,
      { name: 'ECDSA', namedCurve: SIGNAL.CURVE }, true, ['verify']),
    crypto.subtle.importKey('jwk', blob.dhPrivateKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, ['deriveKey', 'deriveBits']),
    crypto.subtle.importKey('jwk', blob.dhPublicKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, []),
  ])

  const [spkPriv, spkPub] = await Promise.all([
    crypto.subtle.importKey('jwk', blob.signedPreKey.privateKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, ['deriveKey', 'deriveBits']),
    crypto.subtle.importKey('jwk', blob.signedPreKey.publicKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, []),
  ])

  const preKeys = await Promise.all(blob.preKeys.map(async pk => ({
    keyId: pk.keyId,
    privateKey: await crypto.subtle.importKey('jwk', pk.privateKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, ['deriveKey', 'deriveBits']),
    publicKey: await crypto.subtle.importKey('jwk', pk.publicKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, []),
    publicKeyBase64: pk.publicKeyBase64,
  })))

  return {
    signingPrivateKey: signingPriv,
    signingPublicKey: signingPub,
    dhPrivateKey: dhPriv,
    dhPublicKey: dhPub,
    signingPublicKeyBase64: blob.signingPublicKeyBase64,
    dhPublicKeyBase64: blob.dhPublicKeyBase64,
    signedPreKey: {
      keyId: blob.signedPreKey.keyId,
      privateKey: spkPriv,
      publicKey: spkPub,
      publicKeyBase64: blob.signedPreKey.publicKeyBase64,
      signature: blob.signedPreKey.signature,
      createdAt: blob.signedPreKey.createdAt,
    },
    preKeys,
    nextPreKeyId: blob.nextPreKeyId,
  }
}

async function exportSystemKeys(keys: SystemImportedKeys): Promise<SystemBlobPlaintext> {
  return {
    signingPrivateKey: await crypto.subtle.exportKey('jwk', keys.signingPrivateKey),
    signingPublicKey: await crypto.subtle.exportKey('jwk', keys.signingPublicKey),
    dhPrivateKey: await crypto.subtle.exportKey('jwk', keys.dhPrivateKey),
    dhPublicKey: await crypto.subtle.exportKey('jwk', keys.dhPublicKey),
    signingPublicKeyBase64: keys.signingPublicKeyBase64,
    dhPublicKeyBase64: keys.dhPublicKeyBase64,
    signedPreKey: {
      keyId: keys.signedPreKey.keyId,
      privateKey: await crypto.subtle.exportKey('jwk', keys.signedPreKey.privateKey),
      publicKey: await crypto.subtle.exportKey('jwk', keys.signedPreKey.publicKey),
      publicKeyBase64: keys.signedPreKey.publicKeyBase64,
      signature: keys.signedPreKey.signature,
      createdAt: keys.signedPreKey.createdAt,
    },
    preKeys: await Promise.all(keys.preKeys.map(async pk => ({
      keyId: pk.keyId,
      privateKey: await crypto.subtle.exportKey('jwk', pk.privateKey),
      publicKey: await crypto.subtle.exportKey('jwk', pk.publicKey),
      publicKeyBase64: pk.publicKeyBase64,
    }))),
    nextPreKeyId: keys.nextPreKeyId,
  }
}

// ── First-time bootstrap: generate, wrap, upload ────────────────────────────

async function generateFreshSystemBlob(): Promise<{
  blob: SystemBlobPlaintext
  publicBundle: Omit<PublicKeyBundle, 'userId' | 'deviceId'>
}> {
  const [signingPair, dhPair] = await Promise.all([
    generateSigningKeyPair(),
    generateDhKeyPair(),
  ])
  const [signingPubBase64, dhPubBase64] = await Promise.all([
    exportPublicKey(signingPair.publicKey, 'spki'),
    exportPublicKey(dhPair.publicKey, 'raw'),
  ])

  // Signed pre-key
  const spkPair = await generateDhKeyPair()
  const spkPubBase64 = await exportPublicKey(spkPair.publicKey, 'raw')
  const spkSig = await signBytes(signingPair.privateKey, base64ToUint8(spkPubBase64))

  // One-time pre-keys
  const preKeys: SystemPreKeyJwk[] = []
  for (let i = 1; i <= SYSTEM_OTP_BATCH_SIZE; i++) {
    const pair = await generateDhKeyPair()
    const pubB64 = await exportPublicKey(pair.publicKey, 'raw')
    preKeys.push({
      keyId: i,
      privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
      publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
      publicKeyBase64: pubB64,
    })
  }

  const blob: SystemBlobPlaintext = {
    signingPrivateKey: await crypto.subtle.exportKey('jwk', signingPair.privateKey),
    signingPublicKey: await crypto.subtle.exportKey('jwk', signingPair.publicKey),
    dhPrivateKey: await crypto.subtle.exportKey('jwk', dhPair.privateKey),
    dhPublicKey: await crypto.subtle.exportKey('jwk', dhPair.publicKey),
    signingPublicKeyBase64: signingPubBase64,
    dhPublicKeyBase64: dhPubBase64,
    signedPreKey: {
      keyId: 1,
      privateKey: await crypto.subtle.exportKey('jwk', spkPair.privateKey),
      publicKey: await crypto.subtle.exportKey('jwk', spkPair.publicKey),
      publicKeyBase64: spkPubBase64,
      signature: spkSig,
      createdAt: new Date().toISOString(),
    },
    preKeys,
    nextPreKeyId: SYSTEM_OTP_BATCH_SIZE + 1,
  }

  const publicBundle: Omit<PublicKeyBundle, 'userId' | 'deviceId'> = {
    identitySigningKey: signingPubBase64,
    identityDhKey: dhPubBase64,
    signedPreKey: { keyId: 1, publicKey: spkPubBase64, signature: spkSig },
    oneTimePreKeys: preKeys.map(pk => ({ keyId: pk.keyId, publicKey: pk.publicKeyBase64 })),
  }

  return { blob, publicBundle }
}

// ── Bootstrap orchestration ─────────────────────────────────────────────────

/**
 * Bring this dev's system-identity state up to ready. Idempotent: subsequent
 * calls in the same session return the cached state.
 *
 *   - `initialized=false`: generate fresh public+private state, wrap blob,
 *      call set_system_identity, cache unwrapped keys.
 *   - `initialized=true && has_dev_blob=true`: decrypt blob with the cached
 *      wrapping key, cache unwrapped keys.
 *   - `initialized=true && has_dev_blob=false`: this dev has no wrapped copy
 *      yet. Multi-dev bootstrap ceremony is out of scope in v1.
 */
async function bootstrapInternal(): Promise<Result<void>> {
  if (_cachedSystemKeys) return ok(undefined)

  if (_systemKeyReady) {
    try { await _systemKeyReady } catch { /* fall through */ }
  }

  // Session restored without password (page refresh / PWA reopen) — try IDB.
  // Mirrors backupService.ts:469-471. The cached CryptoKey + salt are written
  // by deriveAndCacheSystemWrappingKey on every password-bearing sign-in.
  if (!_cachedWrappingKey || !_cachedWrappingSalt) {
    try {
      const loaded = await loadSystemKeyFromIdb()
      if (loaded) {
        _cachedWrappingKey = loaded.key
        _cachedWrappingSalt = loaded.salt
        logger.info('System wrapping key restored from IDB')
      }
    } catch { /* IDB unavailable */ }
  }

  if (!_cachedWrappingKey || !_cachedWrappingSalt) {
    return err('System wrapping key not cached — sign-in did not run derive step (non-dev?)')
  }

  const initRes = await callRpc<InitOrGetResult>(
    () => supabase.rpc('init_or_get_system_identity'),
    'init_or_get_system_identity', logger,
  )
  if (!initRes.ok) return err(initRes.error)

  const result = initRes.data

  // (1) Existing dev row — unwrap and cache.
  if (result.has_dev_blob && result.dev_blob) {
    try {
      const blob = await decryptBlob(
        result.dev_blob.encrypted_blob,
        result.dev_blob.iv,
        _cachedWrappingKey,
      )
      _cachedSystemKeys = await importSystemKeys(blob)
      logger.info('System identity unwrapped from existing dev blob')
      return ok(undefined)
    } catch (e) {
      logger.error('Failed to decrypt system dev blob:', e)
      return err('System dev blob decrypt failed — password may have changed since blob was wrapped')
    }
  }

  // (2) Initialized but no row for this dev — out of scope in v1.
  if (result.initialized && !result.has_dev_blob) {
    return err(
      'System identity already provisioned but this dev has no wrapped copy. ' +
      'Multi-dev bootstrap ceremony is out of scope in v1.',
    )
  }

  // (3) First-time init — generate, wrap, upload.
  const { blob, publicBundle } = await generateFreshSystemBlob()
  const { encryptedBlob, iv } = await encryptBlob(blob, _cachedWrappingKey)

  const setRes = await callRpc<{ ok: true }>(
    () => supabase.rpc('set_system_identity', {
      p_bundle: publicBundle,
      p_encrypted_blob: encryptedBlob,
      p_salt: _cachedWrappingSalt,
      p_iv: iv,
      p_kdf_iterations: SYSTEM_KDF_ITERATIONS,
    }),
    'set_system_identity', logger,
  )
  if (!setRes.ok) return err(setRes.error)

  _cachedSystemKeys = await importSystemKeys(blob)
  logger.info('System identity bootstrapped (fresh public+private)')
  return ok(undefined)
}

/**
 * Ensure system identity is ready for this dev. Coalesces concurrent calls.
 */
export async function ensureSystemIdentity(): Promise<Result<void>> {
  if (_cachedSystemKeys) return ok(undefined)
  if (_bootstrapInFlight) return _bootstrapInFlight
  _bootstrapInFlight = bootstrapInternal().finally(() => {
    _bootstrapInFlight = null
  })
  return _bootstrapInFlight
}

// ── Encrypt-as-system (one-shot X3DH initiator) ─────────────────────────────

/**
 * Encrypt a serialized payload as the System entity for one recipient device.
 *
 * Mirrors `session.createOutboundSession` but uses system's identity and does
 * NOT persist any session/ratchet state — every call is a fresh X3DH so
 * multiple devs can send concurrently without ratchet desync. The recipient
 * sees an InitialMessage and decrypts via the standard `processIncomingMessage`
 * path (X3DH responder + new receiver ratchet).
 */
export async function encryptAsSystem(
  recipientId: string,
  recipientDeviceId: string,
  recipientBundle: PublicKeyBundle,
  serialized: string,
): Promise<Result<SealedEnvelope>> {
  const ensure = await ensureSystemIdentity()
  if (!ensure.ok) return err(ensure.error)
  const keys = _cachedSystemKeys
  if (!keys) return err('System keys not cached after ensure')

  // Build a synthetic StoredLocalIdentity for system to feed into x3dhInitiate.
  // deviceId/createdAt/nextPreKeyId are irrelevant here — the X3DH primitive
  // reads only signing+dh keys and their pre-exported base64 forms.
  const systemIdentity: StoredLocalIdentity = {
    deviceId: SYSTEM_DEVICE_ID,
    signingPublicKey: keys.signingPublicKey,
    signingPrivateKey: keys.signingPrivateKey,
    dhPublicKey: keys.dhPublicKey,
    dhPrivateKey: keys.dhPrivateKey,
    signingPublicKeyBase64: keys.signingPublicKeyBase64,
    dhPublicKeyBase64: keys.dhPublicKeyBase64,
    nextPreKeyId: 0,
    createdAt: '',
  }

  try {
    // 1. X3DH
    const x3dh = await x3dhInitiate(systemIdentity, recipientBundle)

    // 2. Init sender ratchet against recipient's signed pre-key
    const peerSpk = await importDhPublicKey(recipientBundle.signedPreKey.publicKey)
    const ratchetState = await initSender(
      x3dh.sharedSecret,
      peerSpk,
      recipientBundle.signedPreKey.publicKey,
    )

    // 3. Encrypt first message
    const ptBytes = new TextEncoder().encode(serialized)
    const { message } = await ratchetEncrypt(ratchetState, ptBytes, x3dh.associatedData)

    // 4. Build InitialMessage with SYSTEM identity in the X3DH fields
    const initialMessage: InitialMessage = {
      identitySigningKey: keys.signingPublicKeyBase64,
      identityDhKey: keys.dhPublicKeyBase64,
      ephemeralKey: x3dh.ephemeralPublicKeyBase64,
      signedPreKeyId: x3dh.signedPreKeyId,
      oneTimePreKeyId: x3dh.oneTimePreKeyId,
      message,
    }

    // 5. Seal — sender cert signed by system's signing key, addressed to recipient
    const envelope = await seal(
      initialMessage as unknown as Record<string, unknown>,
      SYSTEM_USER_ID,
      systemIdentity,
      recipientId,
      recipientBundle.identityDhKey,
    )

    // recipientDeviceId is the caller's concern (used for RPC routing), not crypto
    void recipientDeviceId
    return ok(envelope)
  } catch (e) {
    logger.error('encryptAsSystem failed:', e instanceof Error ? e.message : e)
    return err(e instanceof Error ? e.message : 'encryptAsSystem failed')
  }
}

/**
 * Send a system-authored payload to a single recipient device via the
 * dev-only `send_signal_message_as_system` RPC. Returns the inserted row id.
 */
export async function sendSystemEnvelopeToDevice(
  recipientId: string,
  recipientDeviceId: string,
  envelope: SealedEnvelope,
  groupId?: string,
  originId?: string,
): Promise<Result<string>> {
  const id = crypto.randomUUID()
  return callRpc<string>(
    () => supabase.rpc('send_signal_message_as_system', {
      p_id: id,
      p_recipient_id: recipientId,
      p_recipient_device_id: recipientDeviceId,
      p_payload: envelope as unknown as Record<string, unknown>,
      p_group_id: groupId ?? null,
      p_origin_id: originId ?? null,
    }),
    'send_signal_message_as_system', logger,
  )
}

// ── Drain inbox ─────────────────────────────────────────────────────────────

/**
 * Public drain entrypoint. Coalesces concurrent calls — realtime can fire
 * rapidly (one INSERT per new SYSTEM-recipient row) and each invocation
 * re-reads the cursor + RPC-fetches the same rows; without a guard we'd
 * decrypt the same rows in parallel and race the OTP-consumption OCC.
 * In-flight callers all resolve to the same processed count.
 */
export async function drainSystemInbox(): Promise<number> {
  if (_drainInFlight) return _drainInFlight
  _drainInFlight = (async () => {
    try {
      return await _drainSystemInboxImpl()
    } finally {
      _drainInFlight = null
    }
  })()
  return _drainInFlight
}

/**
 * Drain inbound messages addressed to SYSTEM_USER_ID and post the decrypted
 * results into the local messaging store under conversation key = peer userId
 * (the sender). v1 decrypts only InitialMessages — subsequent ratchet messages
 * from the same peer are treated as orphaned and skipped (mirrors vault).
 * Consumed OTPs are removed from the dev's wrapped blob and from the public
 * `signal_key_bundles` row via OCC update; conflicts log and skip rather than
 * retry (single-dev pilot). Conversation-message routes also emit to
 * `_systemMessageListeners` so MessagesContext can fire the standard toast.
 *
 * Returns the count of successfully decrypted+routed messages.
 */
async function _drainSystemInboxImpl(): Promise<number> {
  const ensure = await ensureSystemIdentity()
  if (!ensure.ok) {
    logger.info('drainSystemInbox: system identity unavailable —', ensure.error)
    return 0
  }
  const keys = _cachedSystemKeys
  if (!keys) return 0

  // Use a localStorage cursor so we don't redrive the same rows every call.
  // Mark-read via mark_signal_messages_read doesn't work here: that RPC scopes
  // by recipient_id = auth.uid(), and the rows have recipient_id = SYSTEM_USER_ID.
  // The drain RPC already supports a p_after timestamp; we persist the latest
  // row's created_at after each successful drain.
  const cursorKey = `adtmc_system_inbox_cursor_${(await supabase.auth.getUser()).data.user?.id ?? 'unknown'}`
  let cursor: string | null = null
  try { cursor = localStorage.getItem(cursorKey) } catch { /* ignore */ }

  const rowsRes = await callRpc<SignalMessageRow[]>(
    () => supabase.rpc('drain_system_inbox', { p_after: cursor }),
    'drain_system_inbox', logger,
  )
  if (!rowsRes.ok) {
    logger.warn('drain_system_inbox failed:', rowsRes.error)
    return 0
  }
  const rows = rowsRes.data
  if (!rows || rows.length === 0) return 0

  logger.info(`Draining ${rows.length} system-inbound messages`)

  const systemIdentity: StoredLocalIdentity = {
    deviceId: SYSTEM_DEVICE_ID,
    signingPublicKey: keys.signingPublicKey,
    signingPrivateKey: keys.signingPrivateKey,
    dhPublicKey: keys.dhPublicKey,
    dhPrivateKey: keys.dhPrivateKey,
    signingPublicKeyBase64: keys.signingPublicKeyBase64,
    dhPublicKeyBase64: keys.dhPublicKeyBase64,
    nextPreKeyId: 0,
    createdAt: '',
  }

  // Track ratchet state across messages from the same peer in this drain batch.
  // Note: state is NOT persisted across drains — subsequent batches treat
  // ratchet messages from the same peer as orphaned. v1 limitation.
  const sessionMap = new Map<string, { state: RatchetState; ad: Uint8Array }>()
  const consumedOtpIds = new Set<number>()
  const processedIds: string[] = []

  for (const row of rows) {
    try {
      // ─── Plaintext early-exit: anon-authored event-intake submission ─────
      // submit_event_intake (rev6) fans out N+1 rows with sender_id=SYSTEM
      // and a PLAINTEXT jsonb payload — bypassing the Signal envelope
      // entirely. The intake bundle has no Signal keys and SYSTEM has no
      // way to encrypt to itself, so the payload IS the content. The
      // SealedEnvelope shape used below would crash on this row (no v /
      // ephemeralKey / ciphertext fields). Discriminate on payload.kind
      // before treating row.payload as an envelope. Existing dev-authored
      // SYSTEM messages have SealedEnvelope shape (no `kind` field) and
      // fall through to normal decrypt unchanged.
      const maybeIntakePayload = row.payload as Record<string, unknown> | null
      if (
        row.message_type === 'system'
        && maybeIntakePayload
        && maybeIntakePayload.kind === 'intake-request'
      ) {
        const content: IntakeRequestContent = {
          type: 'intake_request',
          intake_id: String(maybeIntakePayload.intake_id),
          requester_name: String(maybeIntakePayload.requester_name ?? ''),
          requester_email: String(maybeIntakePayload.requester_email ?? ''),
          requested_start: String(maybeIntakePayload.requested_start ?? ''),
          requested_end: String(maybeIntakePayload.requested_end ?? ''),
          title: String(maybeIntakePayload.title ?? ''),
          ...(maybeIntakePayload.requester_org
            ? { requester_org: String(maybeIntakePayload.requester_org) }
            : {}),
        }
        const msg: DecryptedSignalMessage = {
          id: row.id,
          senderId: SYSTEM_USER_ID,
          recipientId: SYSTEM_USER_ID,
          plaintext: '[event intake — request]',
          content,
          messageType: 'system',
          createdAt: row.created_at,
          readAt: row.read_at,
          ...(row.group_id && { groupId: row.group_id }),
          originId: row.origin_id ?? undefined,
        }
        const { useAuthStore } = await import('../../stores/useAuthStore')
        const devUserId = useAuthStore.getState().user?.id
        if (devUserId) {
          await saveMessage(msg, devUserId)
        }
        useMessagingStore.getState().addMessage(msg)
        for (const cb of _systemMessageListeners) {
          try { cb(msg) } catch { /* listener failures must not block drain */ }
        }
        processedIds.push(row.id)
        continue
      }

      const envelope = row.payload as unknown as SealedEnvelope
      const senderDeviceId = row.sender_device_id ?? 'unknown'

      const { inner, senderUuid } = await unseal(
        envelope,
        SYSTEM_USER_ID,
        keys.dhPrivateKey,
        keys.dhPublicKeyBase64,
        { skipExpiry: true },
      )

      const sessionKey = `${senderUuid}:${senderDeviceId}`
      let plaintext: string

      if ('identitySigningKey' in inner) {
        const initial = inner as unknown as InitialMessage

        // Match SPK — v1 has no rotation, so it must equal the current one.
        if (initial.signedPreKeyId !== keys.signedPreKey.keyId) {
          logger.warn(`System SPK ${initial.signedPreKeyId} not current (have ${keys.signedPreKey.keyId}) — skipping row ${row.id}`)
          continue
        }
        const spkPair = {
          publicKey: keys.signedPreKey.publicKey,
          privateKey: keys.signedPreKey.privateKey,
        }

        // Consume OTP if referenced and still present.
        let otpkPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null
        if (initial.oneTimePreKeyId !== null) {
          const otpk = keys.preKeys.find(
            pk => pk.keyId === initial.oneTimePreKeyId && !consumedOtpIds.has(pk.keyId),
          )
          if (otpk) {
            otpkPair = { publicKey: otpk.publicKey, privateKey: otpk.privateKey }
            consumedOtpIds.add(otpk.keyId)
          }
        }

        const x3dh = await x3dhRespond(
          systemIdentity,
          spkPair,
          otpkPair,
          initial.identityDhKey,
          initial.ephemeralKey,
        )

        const ratchetState = await initReceiver(x3dh.sharedSecret, {
          publicKey: spkPair.publicKey,
          privateKey: spkPair.privateKey,
          publicKeyBase64: keys.signedPreKey.publicKeyBase64,
        })

        const { state, plaintext: ptBytes } = await ratchetDecrypt(
          ratchetState, initial.message, x3dh.associatedData,
        )
        plaintext = new TextDecoder().decode(ptBytes)
        sessionMap.set(sessionKey, { state, ad: x3dh.associatedData })
      } else {
        const encMsg = inner as unknown as EncryptedMessage
        const existing = sessionMap.get(sessionKey)
        if (!existing) {
          // Orphaned: peer's session was established in a prior drain we no longer hold.
          logger.debug(`Orphaned system-inbound ratchet message from ${sessionKey} — skipping`)
          processedIds.push(row.id)
          continue
        }
        const { state, plaintext: ptBytes } = await ratchetDecrypt(
          existing.state, encMsg, existing.ad,
        )
        plaintext = new TextDecoder().decode(ptBytes)
        sessionMap.set(sessionKey, { state, ad: existing.ad })
      }

      // Wire-framing 'delete': user → SYSTEM delete fanout. The decrypted
      // body is { originIds }; remove those messages from the dev's local
      // state + IDB and physically delete the original rows from Supabase.
      // Also remove the delete envelope itself so SYSTEM-recipient rows
      // don't accumulate. Supabase deletes rely on the dev-on-SYSTEM
      // signal_messages RLS extension landed in 20260522f.
      if (row.message_type === 'delete') {
        try {
          const parsed = JSON.parse(plaintext) as { originIds?: unknown }
          const originIds = Array.isArray(parsed.originIds)
            ? parsed.originIds.filter((x): x is string => typeof x === 'string')
            : []
          if (originIds.length > 0) {
            useMessagingStore.getState().removeMessagesByOriginIds(originIds)
            await deleteMessagesByOriginId(originIds)
            const { error: origErr } = await supabase
              .from('signal_messages')
              .delete()
              .eq('recipient_id', SYSTEM_USER_ID)
              .in('origin_id', originIds)
            if (origErr) logger.warn(`Failed to hard-delete originals for ${row.id}:`, origErr.message)
          }
          const { error: envErr } = await supabase
            .from('signal_messages')
            .delete()
            .eq('id', row.id)
          if (envErr) logger.warn(`Failed to hard-delete delete-envelope ${row.id}:`, envErr.message)
        } catch (e) {
          logger.warn(`System delete-envelope process failed for ${row.id}:`, e instanceof Error ? e.message : e)
        }
        processedIds.push(row.id)
        continue
      }

      // Route the decrypted payload.
      const { plaintext: displayText, content, replyTo } = parseMessageContent(plaintext)
      const isCal = isCalendarEvent(content)
      const isOv = isMapOverlay(content)
      const isFt = isMapFeature(content)

      // Conversation key for system replies = the peer (sender).
      const conversationKey = senderUuid
      const tombstoneAt = await getTombstone(conversationKey)
      if (!tombstoneAt || row.created_at >= tombstoneAt) {
        const msg: DecryptedSignalMessage = {
          id: row.id,
          senderId: senderUuid,
          recipientId: SYSTEM_USER_ID,
          plaintext: displayText,
          content,
          messageType: row.message_type,
          createdAt: row.created_at,
          readAt: (isCal || isOv || isFt) ? new Date().toISOString() : null,
          ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
          originId: row.origin_id ?? undefined,
        }
        // Persist + push to live store. Dedupe by id + originId.
        // The dev's local userId is needed for saveMessage's IDB scoping;
        // pull from the auth store to avoid threading it through every call.
        const { useAuthStore } = await import('../../stores/useAuthStore')
        const devUserId = useAuthStore.getState().user?.id
        if (devUserId) {
          await saveMessage(msg, devUserId)
        }
        useMessagingStore.getState().addMessage(msg)
        if (isCal) routeCalendarEvent(content)
        // Serial await — overlay/feature routes share a single IDB row under RMW.
        else if (isOv) await routeMapOverlay(content).catch(() => {})
        else if (isFt) await routeMapFeature(content).catch(() => {})
        else {
          // Conversation reply — surface to notification dispatch. Out-of-band
          // payloads (calendar/overlay/feature) and delete-envelopes don't
          // produce a system-thread card, so they don't fire listeners.
          for (const cb of _systemMessageListeners) {
            try { cb(msg) } catch { /* listener failures must not block drain */ }
          }
        }
      }

      processedIds.push(row.id)
    } catch (e) {
      logger.error(`Failed to process system-inbound row ${row.id}:`, e instanceof Error ? e.message : e)
    }
  }

  // Persist OTP consumption: re-wrap blob with consumed OTPs removed, OCC bump,
  // and trim the public bundle's one_time_pre_keys to match.
  if (consumedOtpIds.size > 0) {
    await persistConsumedOtps(consumedOtpIds).catch(e =>
      logger.warn('Failed to persist consumed system OTPs:', e instanceof Error ? e.message : e),
    )
  }

  // Advance the cursor to the latest row's created_at so subsequent drains
  // pick up only new traffic. Even rows that failed to decrypt advance the
  // cursor — a perpetually-undecryptable row at the head would otherwise
  // block all later rows. Operational vocabulary only on the wire, so the
  // cost of skipping a malformed row is bounded.
  const lastRow = rows[rows.length - 1]
  if (lastRow?.created_at) {
    try { localStorage.setItem(cursorKey, lastRow.created_at) } catch { /* ignore */ }
  }

  logger.info(`Drained ${processedIds.length}/${rows.length} system-inbound messages (${consumedOtpIds.size} OTPs consumed)`)
  return processedIds.length
}

/**
 * Re-encrypt the per-dev system blob with consumed OTPs removed, OCC-bump
 * the row, and update `signal_key_bundles.one_time_pre_keys` to match.
 *
 * Best-effort: on conflict (another dev raced), logs and aborts. In v1 (single
 * dev pilot) this is safe; expand to retry loop when multi-dev lands.
 */
async function persistConsumedOtps(consumed: Set<number>): Promise<void> {
  if (!_cachedWrappingKey || !_cachedSystemKeys) return

  // Fetch the latest row to pick up the current version + any concurrent writes.
  const { data: row, error: rowErr } = await supabase
    .from('system_identity_keys_per_dev')
    .select('*')
    .eq('dev_user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single()
  if (rowErr || !row) {
    logger.warn('persistConsumedOtps: cannot read latest row:', rowErr?.message)
    return
  }

  const latestBlob = await decryptBlob(row.encrypted_blob, row.iv, _cachedWrappingKey)
  latestBlob.preKeys = latestBlob.preKeys.filter(pk => !consumed.has(pk.keyId))

  const { encryptedBlob: newBlob, iv: newIv } = await encryptBlob(latestBlob, _cachedWrappingKey)

  const { data: updRows, error: updErr } = await supabase
    .from('system_identity_keys_per_dev')
    .update({
      encrypted_blob: newBlob,
      iv: newIv,
      version: (row as SystemKeysRow).version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('dev_user_id', (row as SystemKeysRow).dev_user_id)
    .eq('version', (row as SystemKeysRow).version)
    .select('dev_user_id')

  if (updErr || !updRows?.length) {
    logger.warn('persistConsumedOtps: OCC conflict — another dev/race won; skipping')
    return
  }

  // Mirror into in-memory cache so subsequent sends in this session don't
  // reuse the consumed OTPs.
  _cachedSystemKeys = {
    ..._cachedSystemKeys,
    preKeys: _cachedSystemKeys.preKeys.filter(pk => !consumed.has(pk.keyId)),
  }

  // Update the public bundle's one-time-pre-keys list.
  const remainingPublicOtps = latestBlob.preKeys.map(pk => ({
    keyId: pk.keyId, publicKey: pk.publicKeyBase64,
  }))
  await supabase
    .from('signal_key_bundles')
    .update({
      one_time_pre_keys: remainingPublicOtps,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', SYSTEM_USER_ID)
    .eq('device_id', SYSTEM_DEVICE_ID)
    .then(({ error }) => {
      if (error) logger.warn('system public bundle OTP update failed:', error.message)
    })
}

// ── Deprecated stub names retained for migration ────────────────────────────

/** @deprecated use `drainSystemInbox()`. */
export async function decryptToSystem(_envelope: unknown): Promise<{ ok: false; reason: 'use-drainSystemInbox' }> {
  return { ok: false, reason: 'use-drainSystemInbox' }
}
