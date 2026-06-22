/**
 * Vault Device — E2EE messaging bridge for offline recipients.
 *
 * The vault is a permanent virtual Signal device whose public key bundle
 * is always available in `signal_key_bundles`. Senders encrypt to it via
 * existing multi-device fan-out (zero changes to sending path). Private
 * keys are wrapped with a password-derived AES-256-GCM key and stored
 * opaque in `vault_device_keys`.
 *
 * When a real device logs in it recovers the vault keys, batch-decrypts
 * pending messages, and continues normally.
 *
 * Security notes:
 * - Vault messages have weaker forward secrecy than real-device messages
 *   (the vault never sends replies, so the DH ratchet never advances).
 * - The vault signed pre-key is rotated on every processVaultMessages call.
 * - PBKDF2 with 600K iterations (Web Crypto — no native Argon2).
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { bytesToHex, hexToBytes } from '../cryptoUtils'
import { supabase } from '../supabase'
import { SIGNAL } from '../constants'
import { ok, err, type Result } from '../result'
import { unseal } from './sealedSender'
import { x3dhRespond } from './x3dh'
import { initReceiver, ratchetDecrypt } from './ratchet'
import { importDhPublicKey } from './keyManager'
import { uploadKeyBundle, registerDevice } from './signalService'
import { saveMessage, deleteMessagesByOriginId, getTombstone } from './messageStore'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { isCalendarEvent, routeCalendarEvent, initCalendarTombstones } from '../calendarRouting'
import { isMapOverlay, isMapFeature, routeMapOverlay, routeMapFeature, initOverlayTombstones } from '../mapOverlayRouting'
import type { CalendarEventContent, MapOverlayContent, MapFeatureContent } from './messageContent'
import { parseMessageContent } from './messageContent'
import type { PublicKeyBundle, InitialMessage, EncryptedMessage, RatchetState, RatchetKeyPair } from './types'
import type { DecryptedSignalMessage, SignalMessageRow, SyncMessagePayload } from './transportTypes'
import type { SealedEnvelope } from './sealedSender'

const logger = createLogger('VaultDevice')

// ---- Constants ----

export const VAULT_DEVICE_ID = 'vault'
const VAULT_KDF_ITERATIONS = 600_000
const VAULT_PREKEY_BATCH_SIZE = 500
/** Cap on retained previous signed pre-keys. Vault rotates SPK every drain;
 *  the previous N keep in-flight InitialMessages decryptable across a rotation. */
const VAULT_PREVIOUS_SPK_RETENTION = 10

// ---- Types ----

interface VaultDeviceKeysRow {
  user_id: string
  encrypted_blob: string
  salt: string
  iv: string
  kdf_iterations: number
  version: number
}

/** Signed pre-key shape stored in the vault blob (JWK format). */
interface VaultStoredSignedPreKey {
  keyId: number
  privateKey: JsonWebKey
  publicKey: JsonWebKey
  publicKeyBase64: string
  signature: string
  createdAt: string
}

/** Plaintext vault blob — all private keys in JWK format. */
interface VaultBlobPlaintext {
  signingPrivateKey: JsonWebKey
  signingPublicKey: JsonWebKey
  dhPrivateKey: JsonWebKey
  dhPublicKey: JsonWebKey
  signingPublicKeyBase64: string
  dhPublicKeyBase64: string
  signedPreKey: VaultStoredSignedPreKey
  /** Retained old SPKs so InitialMessages encrypted to a recently-rotated
   *  SPK still decrypt during the drain window. Bounded by
   *  VAULT_PREVIOUS_SPK_RETENTION; oldest entries dropped on overflow. */
  previousSignedPreKeys?: VaultStoredSignedPreKey[]
  preKeys: Array<{
    keyId: number
    privateKey: JsonWebKey
    publicKey: JsonWebKey
    publicKeyBase64: string
  }>
  nextPreKeyId: number
}

/** Imported SPK with live CryptoKey handles. */
interface VaultImportedSignedPreKey {
  keyId: number
  privateKey: CryptoKey
  publicKey: CryptoKey
  publicKeyBase64: string
  signature: string
  createdAt: string
}

/** Recovered vault keys with CryptoKey objects ready for use. */
interface VaultPrivateKeys {
  signingPrivateKey: CryptoKey
  signingPublicKey: CryptoKey
  dhPrivateKey: CryptoKey
  dhPublicKey: CryptoKey
  signingPublicKeyBase64: string
  dhPublicKeyBase64: string
  signedPreKey: VaultImportedSignedPreKey
  previousSignedPreKeys: VaultImportedSignedPreKey[]
  preKeys: Array<{
    keyId: number
    privateKey: CryptoKey
    publicKey: CryptoKey
    publicKeyBase64: string
  }>
  nextPreKeyId: number
}

interface VaultKeyBundle {
  encryptedBlob: string
  salt: string
  iv: string
  publicBundle: PublicKeyBundle
}

// ---- Module-level cached vault wrapping key ----

let cachedVaultKey: CryptoKey | null = null

/** Cached vault identity DH keypair, keyed by user — recovered lazily for
 *  unsealing content addressed to the portable vault identity (e.g. the clinic
 *  inbound-key wrap). Cleared on sign-out alongside cachedVaultKey. */
let _cachedVaultDh: { userId: string; dhPrivateKey: CryptoKey; dhPublicKeyBase64: string } | null = null

/** Promise that resolves when the vault wrapping key derivation completes.
 *  processVaultMessages awaits this so it doesn't race with the PBKDF2
 *  derivation that runs fire-and-forget from signIn().
 *  Mirrors _backupKeyReady in backupService.ts. */
let _vaultKeyReady: Promise<void> | null = null

/** Register the vault key derivation promise (called from authService). */
export function setVaultKeyReady(promise: Promise<void>): void {
  _vaultKeyReady = promise
}

// ---- IDB persistence for the non-extractable wrapping key ----
//
// The wrapping key is PBKDF2(password) and lives in module scope, so it is lost
// on every page reload. A live-session resume (PWA cold start with a still-valid
// Supabase token) fires INITIAL_SESSION WITHOUT the password sign-in path, so the
// key was never re-derived and the vault drain no-ops. Mirror backupService's
// non-extractable-CryptoKey-in-IDB pattern so the drain survives a resume.
//
// SAFETY: the persisted record is tagged with { userId, salt, iterations }. On
// restore we use the key ONLY if all three still match the live vault row. A salt
// change means the password was reset and the vault re-provisioned, so the stored
// key is stale and is DISCARDED — never used. This keeps a stale key from ever
// reaching recoverVaultKeys and tripping the OperationError → vault-wipe path
// (the wipe must fire only for a freshly password-derived key, never a cached one).

const VAULT_KEY_DB = 'adtmc-vault-key'
const VAULT_KEY_STORE = 'keys'
const VAULT_KEY_ID = 'wrapping'

interface StoredVaultKey {
  key: CryptoKey
  userId: string
  salt: string
  iterations: number
}

function openVaultKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_KEY_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(VAULT_KEY_STORE)) {
        req.result.createObjectStore(VAULT_KEY_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function persistVaultKeyToIdb(record: StoredVaultKey): Promise<void> {
  const db = await openVaultKeyDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_KEY_STORE, 'readwrite')
    tx.objectStore(VAULT_KEY_STORE).put(record, VAULT_KEY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadVaultKeyFromIdb(): Promise<StoredVaultKey | null> {
  const db = await openVaultKeyDb()
  const rec = await new Promise<StoredVaultKey | null>((resolve, reject) => {
    const tx = db.transaction(VAULT_KEY_STORE, 'readonly')
    const req = tx.objectStore(VAULT_KEY_STORE).get(VAULT_KEY_ID)
    req.onsuccess = () => resolve((req.result as StoredVaultKey) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return rec
}

async function clearVaultKeyFromIdb(): Promise<void> {
  const db = await openVaultKeyDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_KEY_STORE, 'readwrite')
    tx.objectStore(VAULT_KEY_STORE).delete(VAULT_KEY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/**
 * Restore the cached wrapping key from IDB on a live-session resume, but ONLY if
 * the persisted record still matches the current vault row (same user, salt, and
 * iterations). Any mismatch means the key is stale (password reset → new salt, or
 * a different user) — discard it so it can never decrypt against a re-provisioned
 * blob and trip the OperationError wipe. No-ops if a key is already cached.
 */
async function restoreVaultKeyFromIdb(
  userId: string,
  currentSalt: string,
  currentIterations: number,
): Promise<void> {
  if (cachedVaultKey) return
  try {
    const stored = await loadVaultKeyFromIdb()
    if (!stored) return
    if (
      stored.userId !== userId ||
      stored.salt !== currentSalt ||
      stored.iterations !== currentIterations
    ) {
      // Stale (password reset / different user). Drop it.
      await clearVaultKeyFromIdb().catch(() => {})
      return
    }
    cachedVaultKey = stored.key
    logger.info('Vault wrapping key restored from IDB (live-session resume)')
  } catch {
    // IDB unavailable — fall through to the not-cached path.
  }
}

// ---- Pending drain ack (two-phase drain) ----

/** Held between the drain (Phase 1) and the post-backup ack (Phase 2).
 *  See processVaultMessages header. Module-scope so callers don't have to
 *  thread state through the auth chain. Cleared on sign-out + on ack. */
interface PendingVaultAck {
  userId: string
  processedIds: string[]
  consumedOtpIds: number[]
}
let _pendingVaultAck: PendingVaultAck | null = null

// ---- PBKDF2 Key Derivation ----

/**
 * Derive an AES-256-GCM wrapping key from a password via PBKDF2.
 */
async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ---- Encrypt / Decrypt Blob ----

async function encryptBlob(
  plaintext: VaultBlobPlaintext,
  password: string
): Promise<{ encryptedBlob: string; salt: string; iv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrappingKey = await deriveWrappingKey(password, salt, VAULT_KDF_ITERATIONS)

  const ptBytes = new TextEncoder().encode(JSON.stringify(plaintext))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    ptBytes
  )

  return {
    encryptedBlob: uint8ToBase64(new Uint8Array(ciphertext)),
    salt: bytesToHex(salt),
    iv: uint8ToBase64(iv),
  }
}

async function decryptBlob(
  encryptedBlob: string,
  iv: string,
  wrappingKey: CryptoKey
): Promise<VaultBlobPlaintext> {
  const ciphertext = base64ToUint8(encryptedBlob)
  const ivBytes = base64ToUint8(iv)

  const ptBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    wrappingKey,
    ciphertext
  )

  return JSON.parse(new TextDecoder().decode(ptBuffer)) as VaultBlobPlaintext
}

// ---- Key Generation ----

/** Generate a fresh ECDH P-256 key pair. */
async function generateDhPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: SIGNAL.CURVE },
    true,
    ['deriveKey', 'deriveBits']
  )
}

/** Generate a fresh ECDSA P-256 key pair. */
async function generateSigningPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: SIGNAL.CURVE },
    true,
    ['sign', 'verify']
  )
}

/** Export a public key to base64. */
async function exportPubKey(key: CryptoKey, format: 'raw' | 'spki' = 'raw'): Promise<string> {
  const exported = await crypto.subtle.exportKey(format, key)
  return uint8ToBase64(new Uint8Array(exported))
}

/** Sign raw bytes with an ECDSA key, return base64 signature. */
async function signBytes(privateKey: CryptoKey, data: Uint8Array): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data as BufferSource
  )
  return uint8ToBase64(new Uint8Array(sig))
}

// ---- Public API ----

/**
 * Generate a full vault identity (all key pairs + pre-keys),
 * encrypt with the user's password, and return both the encrypted
 * blob and the public bundle for upload.
 */
export async function generateVaultIdentity(
  userId: string,
  password: string
): Promise<VaultKeyBundle> {
  logger.info('Generating vault identity')

  // 1. Generate identity key pairs
  const [signingPair, dhPair] = await Promise.all([
    generateSigningPair(),
    generateDhPair(),
  ])

  const [signingPubBase64, dhPubBase64] = await Promise.all([
    exportPubKey(signingPair.publicKey, 'spki'),
    exportPubKey(dhPair.publicKey, 'raw'),
  ])

  // 2. Generate signed pre-key
  const spkPair = await generateDhPair()
  const spkPubBase64 = await exportPubKey(spkPair.publicKey, 'raw')
  const spkPubBytes = base64ToUint8(spkPubBase64)
  const spkSignature = await signBytes(signingPair.privateKey, spkPubBytes)

  // 3. Generate one-time pre-keys
  const preKeys: VaultBlobPlaintext['preKeys'] = []
  for (let i = 1; i <= VAULT_PREKEY_BATCH_SIZE; i++) {
    const pair = await generateDhPair()
    const pubBase64 = await exportPubKey(pair.publicKey, 'raw')
    preKeys.push({
      keyId: i,
      privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
      publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
      publicKeyBase64: pubBase64,
    })
  }

  // 4. Export all private keys to JWK
  const blob: VaultBlobPlaintext = {
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
      signature: spkSignature,
      createdAt: new Date().toISOString(),
    },
    preKeys,
    nextPreKeyId: VAULT_PREKEY_BATCH_SIZE + 1,
  }

  // 5. Encrypt blob
  const { encryptedBlob, salt, iv } = await encryptBlob(blob, password)

  // 6. Assemble public bundle
  const publicBundle: PublicKeyBundle = {
    userId,
    deviceId: VAULT_DEVICE_ID,
    identitySigningKey: signingPubBase64,
    identityDhKey: dhPubBase64,
    signedPreKey: {
      keyId: 1,
      publicKey: spkPubBase64,
      signature: spkSignature,
    },
    oneTimePreKeys: preKeys.map(pk => ({
      keyId: pk.keyId,
      publicKey: pk.publicKeyBase64,
    })),
  }

  logger.info('Vault identity generated')
  return { encryptedBlob, salt, iv, publicBundle }
}

/**
 * Upload vault device: store encrypted blob, upload public bundle,
 * and register device entry.
 */
export async function uploadVaultDevice(
  userId: string,
  bundle: VaultKeyBundle
): Promise<Result<void>> {
  try {
    // 1. Upsert vault_device_keys row
    const { error: vaultError } = await supabase
      .from('vault_device_keys')
      .upsert({
        user_id: userId,
        encrypted_blob: bundle.encryptedBlob,
        salt: bundle.salt,
        iv: bundle.iv,
        kdf_iterations: VAULT_KDF_ITERATIONS,
        version: 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (vaultError) {
      logger.error('Failed to store vault keys:', vaultError)
      return err(vaultError.message)
    }

    // 2. Upload public bundle
    const uploadResult = await uploadKeyBundle(bundle.publicBundle)
    if (!uploadResult.ok) return uploadResult

    // 3. Register vault device entry
    await registerDevice(userId, VAULT_DEVICE_ID, 'Vault')

    logger.info('Vault device uploaded successfully')
    return ok(undefined)
  } catch (e) {
    logger.error('Failed to upload vault device:', e)
    return err(e instanceof Error ? e.message : 'Unknown error')
  }
}

/**
 * Derive and cache the vault wrapping key from the user's password.
 * Called during signIn while the password is still in scope.
 */
export async function deriveAndCacheVaultKey(
  password: string,
  userId: string,
  salt?: string,
  iterations?: number
): Promise<void> {
  // If salt not provided, fetch from vault_device_keys
  let saltHex = salt
  let iters = iterations ?? VAULT_KDF_ITERATIONS

  if (!saltHex) {
    const { data, error } = await supabase
      .from('vault_device_keys')
      .select('salt, kdf_iterations')
      .eq('user_id', userId)
      .maybeSingle()

    if (!data) {
      // No vault exists yet — nothing to cache
      return
    }
    saltHex = data.salt
    iters = data.kdf_iterations
  }

  const saltBytes = hexToBytes(saltHex)
  cachedVaultKey = await deriveWrappingKey(password, saltBytes, iters)
  // Persist (non-extractable) so a live-session resume can restore it without the
  // password. Tagged with salt+iterations so a later reset/re-provision is detected
  // as stale on load. Fire-and-forget — caching in memory is the source of truth.
  void persistVaultKeyToIdb({ key: cachedVaultKey, userId, salt: saltHex, iterations: iters })
    .catch(() => logger.warn('Failed to persist vault key to IDB'))
  logger.info('Vault wrapping key cached')
}

/**
 * True when the password-derived wrapping key is held in memory. When false,
 * processVaultMessages bails (warn + return 0) without decrypting anything — the
 * caller can use this to distinguish a "no key" bail from a "no messages" drain
 * and offer a non-blocking re-enter-password prompt.
 */
export function isVaultKeyCached(): boolean {
  return cachedVaultKey !== null
}

/**
 * Cheap existence check for undrained vault messages — used to decide whether a
 * key-not-cached bail is worth surfacing a re-auth prompt for (don't nag when
 * nothing is actually waiting). Mirrors processVaultMessages' unread filter
 * (recipient + vault device + read_at null, minus per-recipient read rows).
 */
export async function hasPendingVaultMessages(userId: string): Promise<boolean> {
  const { data: readRows } = await supabase
    .from('signal_message_reads')
    .select('message_id')
    .eq('recipient_id', userId)
  const readIds = (readRows ?? []).map(r => r.message_id)

  let q = supabase
    .from('signal_messages')
    .select('id')
    .eq('recipient_id', userId)
    .eq('recipient_device_id', VAULT_DEVICE_ID)
    .is('read_at', null)
    .limit(1)
  if (readIds.length > 0) {
    q = q.not('id', 'in', `(${readIds.join(',')})`)
  }
  const { data } = await q
  return (data?.length ?? 0) > 0
}

/** Clear cached vault key (called on sign-out). */
export function clearVaultKey(): void {
  cachedVaultKey = null
  _cachedVaultDh = null
  _vaultKeyReady = null
  // Drop any stashed drain ack — it belongs to the prior session and would
  // otherwise mark-read / replenish under the wrong identity if a different
  // user signs in next.
  _pendingVaultAck = null
  // Wipe the persisted key so the next user on this device can't load it. The
  // userId tag on the record is a second guard if this fire-and-forget races.
  void clearVaultKeyFromIdb().catch(() => {})
}

/**
 * Ensure a vault exists for this user. If not, create one.
 * Called during signIn for migration of existing users.
 */
export async function ensureVaultExists(
  userId: string,
  password: string
): Promise<void> {
  const { data } = await supabase
    .from('vault_device_keys')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (data) return // Vault already exists

  logger.info('No vault found — creating vault for existing user')
  const bundle = await generateVaultIdentity(userId, password)
  const result = await uploadVaultDevice(userId, bundle)
  if (!result.ok) {
    logger.warn('Failed to create vault during migration:', result.error)
  }
}

// ---- Vault Key Recovery ----

/** Import a single SPK JWK record into live CryptoKey handles. */
async function importVaultSpk(spk: VaultStoredSignedPreKey): Promise<VaultImportedSignedPreKey> {
  const [spkPriv, spkPub] = await Promise.all([
    crypto.subtle.importKey('jwk', spk.privateKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, ['deriveKey', 'deriveBits']),
    crypto.subtle.importKey('jwk', spk.publicKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, []),
  ])
  return {
    keyId: spk.keyId,
    privateKey: spkPriv,
    publicKey: spkPub,
    publicKeyBase64: spk.publicKeyBase64,
    signature: spk.signature,
    createdAt: spk.createdAt,
  }
}

/** Import JWK keys from the decrypted blob back into CryptoKey objects. */
async function importVaultKeys(blob: VaultBlobPlaintext): Promise<VaultPrivateKeys> {
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

  const importedSpk = await importVaultSpk(blob.signedPreKey)
  const importedPrevious = await Promise.all(
    (blob.previousSignedPreKeys ?? []).map(importVaultSpk)
  )

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
    signedPreKey: importedSpk,
    previousSignedPreKeys: importedPrevious,
    preKeys,
    nextPreKeyId: blob.nextPreKeyId,
  }
}

/** Recover vault private keys using the cached wrapping key. */
async function recoverVaultKeys(row: VaultDeviceKeysRow): Promise<VaultPrivateKeys> {
  if (!cachedVaultKey) {
    throw new Error('Vault wrapping key not cached — call deriveAndCacheVaultKey first')
  }

  const blob = await decryptBlob(row.encrypted_blob, row.iv, cachedVaultKey)
  return importVaultKeys(blob)
}

/**
 * Recover the user's portable vault identity DH keypair, for unsealing content
 * sealed to the vault bundle (device_id='vault') — i.e. the clinic inbound-key
 * wrap (oncallKeyWrap). Unlike loadLocalIdentity() (this physical device's key),
 * the vault identity is restored from the password backup on ANY device, so a
 * re-login / new device / cleared localStorage can still open the wrap.
 *
 * Returns null if there is no vault row or the wrapping key isn't cached yet
 * (caller treats that as "can't decrypt on this device" — same as a missing key).
 * Cached for the session; invalidated by clearVaultKey().
 */
export async function getVaultIdentityDh(
  userId: string,
): Promise<{ dhPrivateKey: CryptoKey; dhPublicKeyBase64: string } | null> {
  if (_cachedVaultDh && _cachedVaultDh.userId === userId) {
    return { dhPrivateKey: _cachedVaultDh.dhPrivateKey, dhPublicKeyBase64: _cachedVaultDh.dhPublicKeyBase64 }
  }
  const { data: vaultRow } = await supabase
    .from('vault_device_keys')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (!vaultRow) return null
  // Wait for the PBKDF2 derivation that runs fire-and-forget from signIn().
  try { if (_vaultKeyReady) await _vaultKeyReady } catch { /* fall through */ }
  // Live-session resume: restore the persisted key (salt-gated) if none cached.
  if (!cachedVaultKey) {
    const row = vaultRow as VaultDeviceKeysRow
    await restoreVaultKeyFromIdb(userId, row.salt, row.kdf_iterations)
  }
  if (!cachedVaultKey) return null
  const keys = await recoverVaultKeys(vaultRow as VaultDeviceKeysRow)
  _cachedVaultDh = { userId, dhPrivateKey: keys.dhPrivateKey, dhPublicKeyBase64: keys.dhPublicKeyBase64 }
  return { dhPrivateKey: keys.dhPrivateKey, dhPublicKeyBase64: keys.dhPublicKeyBase64 }
}

// ---- Vault Message Processing ----

/**
 * Fetch and decrypt all pending vault messages for this user.
 * Saves decrypted messages to local messageStore.
 * Returns the count of processed messages.
 */
export async function processVaultMessages(userId: string): Promise<number> {
  // 0. Ensure tombstones are loaded before replaying any messages
  await initCalendarTombstones()
  await initOverlayTombstones()

  // 1. Fetch vault_device_keys row
  const { data: vaultRow } = await supabase
    .from('vault_device_keys')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!vaultRow) {
    logger.info('No vault found — skipping vault message processing')
    return 0
  }

  // Wait for the vault key derivation that runs fire-and-forget from signIn()
  try { if (_vaultKeyReady) await _vaultKeyReady } catch { /* fall through */ }

  // Live-session resume (e.g. PWA cold start with a valid token) never runs the
  // password sign-in path, so the key was never re-derived. Restore it from IDB,
  // gated on a salt+iterations match so a stale key is discarded, not used.
  if (!cachedVaultKey) {
    const row = vaultRow as VaultDeviceKeysRow
    await restoreVaultKeyFromIdb(userId, row.salt, row.kdf_iterations)
  }

  if (!cachedVaultKey) {
    logger.warn('Vault wrapping key not cached — cannot process vault messages')
    return 0
  }

  // 2. Recover vault keys.
  // Only wipe + re-provision on a definitive AES-GCM auth-tag failure
  // (DOMException name 'OperationError'), which is the unambiguous
  // "wrong wrapping key" signal — i.e. password reset. Any other throw
  // (network, blob parse, transient Web Crypto blip) is treated as
  // transient: we abort the drain and leave the vault intact, so senders
  // fanning out to the cached bundle don't lose messages to a fresh
  // identity racing the next login.
  let vaultKeys: VaultPrivateKeys
  try {
    vaultKeys = await recoverVaultKeys(vaultRow as VaultDeviceKeysRow)
  } catch (e) {
    const isAuthTagFailure = e instanceof DOMException && e.name === 'OperationError'
    if (!isAuthTagFailure) {
      logger.warn('Vault key recovery failed (transient) — leaving vault intact:', e)
      return 0
    }
    logger.error('Vault AES-GCM auth failure — password changed; wiping vault for re-provision:', e)
    await supabase.from('vault_device_keys').delete().eq('user_id', userId)
    await supabase.from('signal_key_bundles').delete()
      .eq('user_id', userId).eq('device_id', VAULT_DEVICE_ID)
    await supabase.from('user_devices').delete()
      .eq('user_id', userId).eq('device_id', VAULT_DEVICE_ID)
    return 0
  }

  // 3. Fetch unread vault messages.
  // Per-recipient read state lives in signal_message_reads; legacy read_at
  // is kept as a silent-fail "already read" fallback for pre-migration rows
  // (see 20260514_signal_message_reads).
  const { data: readRows } = await supabase
    .from('signal_message_reads')
    .select('message_id')
    .eq('recipient_id', userId)
  const readIds = (readRows ?? []).map(r => r.message_id)

  let vaultQuery = supabase
    .from('signal_messages')
    .select('*')
    .eq('recipient_id', userId)
    .eq('recipient_device_id', VAULT_DEVICE_ID)
    .is('read_at', null)
    .order('created_at', { ascending: true })

  if (readIds.length > 0) {
    vaultQuery = vaultQuery.not('id', 'in', `(${readIds.join(',')})`)
  }

  const { data: rows, error: fetchError } = await vaultQuery

  if (fetchError || !rows || rows.length === 0) {
    if (fetchError) logger.warn('Failed to fetch vault messages:', fetchError)
    else logger.info('No pending vault messages')

    // Still rotate SPK even if no messages (staleness mitigation)
    await rotateVaultSignedPreKey(userId, vaultKeys, vaultRow as VaultDeviceKeysRow)
    return 0
  }

  logger.info(`Processing ${rows.length} vault messages`)

  // 4. Build ephemeral session map for batch processing
  const sessionMap = new Map<string, { state: RatchetState; ad: Uint8Array }>()
  const processedIds: string[] = []
  let processedCount = 0

  // Track consumed OTP key IDs so we don't reuse them
  const consumedOtpIds = new Set<number>()

  // Collect calendar event routes for delete-aware dispatch after the main loop.
  // This prevents an earlier create/update from resurrecting an event that is
  // deleted by a later message in the same vault batch.
  const calendarRoutes: CalendarEventContent[] = []
  const overlayRoutes: MapOverlayContent[] = []
  const featureRoutes: MapFeatureContent[] = []

  // 5. Process each message in order
  for (const row of rows as SignalMessageRow[]) {
    try {
      const envelope = row.payload as unknown as SealedEnvelope
      const senderDeviceId = row.sender_device_id ?? 'unknown'

      // Unseal with vault's DH keys and skipExpiry
      const { inner, senderUuid } = await unseal(
        envelope,
        userId,
        vaultKeys.dhPrivateKey,
        vaultKeys.dhPublicKeyBase64,
        { skipExpiry: true }
      )

      let plaintext: string

      const sessionKey = `${senderUuid}:${senderDeviceId}`

      if ('identitySigningKey' in inner) {
        // X3DH initial message
        const initial = inner as unknown as InitialMessage

        // Look up the SPK referenced by the InitialMessage. Senders may have
        // fetched the bundle before the most recent vault drain rotated SPK,
        // so fall back through previousSignedPreKeys before giving up.
        const matchedSpk = vaultKeys.signedPreKey.keyId === initial.signedPreKeyId
          ? vaultKeys.signedPreKey
          : vaultKeys.previousSignedPreKeys.find(s => s.keyId === initial.signedPreKeyId)
        if (!matchedSpk) {
          // The referenced signed pre-key has rotated OUT of the vault blob
          // (previousSignedPreKeys is bounded; SPKs are only ever removed,
          // never re-added), so this row can NEVER decrypt on any future drain.
          // Consume it — same dead-row treatment as the OperationError branch in
          // the per-row catch below — so it stops re-warning on every login.
          // processedCount++ ensures a drain made up ENTIRELY of these rows still
          // trips the caller's `drainCount > 0` gate → createBackup → ackVaultDrain.
          // Content (if any) is recoverable from backup-service history.
          logger.warn(`Vault SPK ${initial.signedPreKeyId} not found (current or previous) — consuming row ${row.id}`)
          processedIds.push(row.id)
          processedCount++
          continue
        }
        const spkPair = {
          publicKey: matchedSpk.publicKey,
          privateKey: matchedSpk.privateKey,
        }

        // Find and consume one-time pre-key
        let otpkPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null
        if (initial.oneTimePreKeyId !== null) {
          const otpk = vaultKeys.preKeys.find(
            pk => pk.keyId === initial.oneTimePreKeyId && !consumedOtpIds.has(pk.keyId)
          )
          if (otpk) {
            otpkPair = { publicKey: otpk.publicKey, privateKey: otpk.privateKey }
            consumedOtpIds.add(otpk.keyId)
          }
        }

        // X3DH respond with vault identity
        const x3dh = await x3dhRespond(
          {
            deviceId: VAULT_DEVICE_ID,
            signingPublicKey: vaultKeys.signingPublicKey,
            signingPrivateKey: vaultKeys.signingPrivateKey,
            dhPublicKey: vaultKeys.dhPublicKey,
            dhPrivateKey: vaultKeys.dhPrivateKey,
            signingPublicKeyBase64: vaultKeys.signingPublicKeyBase64,
            dhPublicKeyBase64: vaultKeys.dhPublicKeyBase64,
            nextPreKeyId: vaultKeys.nextPreKeyId,
            createdAt: '',
          },
          spkPair,
          otpkPair,
          initial.identityDhKey,
          initial.ephemeralKey
        )

        // Initialize receiver ratchet against the matched SPK
        const ratchetState = await initReceiver(x3dh.sharedSecret, {
          publicKey: matchedSpk.publicKey,
          privateKey: matchedSpk.privateKey,
          publicKeyBase64: matchedSpk.publicKeyBase64,
        })

        // Decrypt first message
        const { state, plaintext: ptBytes } = await ratchetDecrypt(
          ratchetState, initial.message, x3dh.associatedData
        )
        plaintext = new TextDecoder().decode(ptBytes)

        // Store session for subsequent messages from same sender
        sessionMap.set(sessionKey, { state, ad: x3dh.associatedData })

      } else {
        // Established session message
        const encMsg = inner as unknown as EncryptedMessage
        const existing = sessionMap.get(sessionKey)
        if (!existing) {
          // Orphaned message: its X3DH initial was consumed in a prior session.
          // Mark as read so it doesn't accumulate. The backup service already
          // handles conversation history restoration.
          processedIds.push(row.id)
          continue
        }

        const { state, plaintext: ptBytes } = await ratchetDecrypt(
          existing.state, encMsg, existing.ad
        )
        plaintext = new TextDecoder().decode(ptBytes)

        // Update session state for next message in chain
        sessionMap.set(sessionKey, { state, ad: existing.ad })
      }

      // Save decrypted message to local store
      const { plaintext: displayText, content, replyTo } = parseMessageContent(plaintext)

      // Handle sync messages
      if (row.message_type === 'sync') {
        try {
          const maybeSyncType = JSON.parse(plaintext) as Record<string, unknown>
          if (maybeSyncType.__syncType === 'read') {
            processedIds.push(row.id)
            processedCount++
            continue
          }
        } catch { /* not a read-sync, proceed as normal sync */ }
        const sync = JSON.parse(plaintext) as SyncMessagePayload
        const { plaintext: syncText, content: syncContent, replyTo: syncReply } = parseMessageContent(sync.serialized)
        const syncMsg: DecryptedSignalMessage = {
          id: sync.originalMessageId,
          senderId: senderUuid,
          recipientId: sync.forPeerId,
          plaintext: syncText,
          content: syncContent,
          messageType: sync.originalMessageType,
          createdAt: sync.originalTimestamp,
          readAt: new Date().toISOString(),
          ...(syncReply && { threadId: syncReply.messageId, replyPreview: syncReply.preview }),
          ...(sync.forGroupId && { groupId: sync.forGroupId }),
          originId: sync.originId ?? row.origin_id ?? undefined,
        }
        const syncConversationKey = sync.forGroupId ?? sync.forPeerId
        const syncTombstoneAt = await getTombstone(syncConversationKey)
        if (!syncTombstoneAt || sync.originalTimestamp >= syncTombstoneAt) {
          await saveMessage(syncMsg, userId)
          // Push to live store so UI reflects drained messages without a reload.
          // addMessage dedupes by id + originId so realtime/catch-up races are safe.
          useMessagingStore.getState().addMessage(syncMsg)
          if (isCalendarEvent(syncContent)) calendarRoutes.push(syncContent)
          else if (isMapOverlay(syncContent)) overlayRoutes.push(syncContent)
          else if (isMapFeature(syncContent)) featureRoutes.push(syncContent)
        }
      } else if (row.message_type === 'delete') {
        try {
          const { originIds } = JSON.parse(plaintext) as { originIds: string[] }
          await deleteMessagesByOriginId(originIds)
        } catch { /* ignore parse errors */ }
      } else {
        const isCalEvent = isCalendarEvent(content)
        const isOverlay = isMapOverlay(content)
        const isFeature = isMapFeature(content)
        const msg: DecryptedSignalMessage = {
          id: row.id,
          senderId: senderUuid,
          recipientId: row.recipient_id,
          plaintext: displayText,
          content,
          messageType: row.message_type,
          createdAt: row.created_at,
          readAt: (isCalEvent || isOverlay || isFeature) ? new Date().toISOString() : null,
          ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
          ...(row.group_id && { groupId: row.group_id }),
          originId: row.origin_id ?? undefined,
        }
        const msgConversationKey = row.group_id ?? (senderUuid === userId ? row.recipient_id : senderUuid)
        const msgTombstoneAt = await getTombstone(msgConversationKey)
        if (!msgTombstoneAt || row.created_at >= msgTombstoneAt) {
          await saveMessage(msg, userId)
          useMessagingStore.getState().addMessage(msg)
          if (isCalEvent) calendarRoutes.push(content as CalendarEventContent)
          else if (isOverlay) overlayRoutes.push(content as MapOverlayContent)
          else if (isFeature) featureRoutes.push(content as MapFeatureContent)
        }
      }

      processedIds.push(row.id)
      processedCount++
    } catch (e) {
      // An AES-GCM/ratchet auth-tag failure (DOMException 'OperationError') is
      // DETERMINISTIC: the pre-key material this message's X3DH referenced (a
      // one-time / signed pre-key) has rotated out of the vault blob, so it can
      // NEVER decrypt on any future drain. Consume it (stash for ackVaultDrain
      // to mark read) so it stops re-failing on every login and the backlog
      // doesn't accumulate. Content, if any, is recoverable from backup-service
      // conversation history — same rationale as the orphaned-session branch.
      // This mirrors the OperationError discrimination the wipe path trusts;
      // dead messages never matched an OTPK, so consumedOtpIds is untouched.
      const isAuthTagFailure = e instanceof DOMException && e.name === 'OperationError'
      if (isAuthTagFailure) {
        logger.warn(`Vault message ${row.id} permanently undecryptable (pre-key rotated out) — consuming`)
        processedIds.push(row.id)
        // Count it as processed so the caller's `drainCount > 0` gate runs
        // createBackup → ackVaultDrain. Otherwise a drain made up ENTIRELY of
        // dead rows returns 0, ackVaultDrain never fires, and these rows stay
        // read_at=null → re-fetched + re-warned on every login forever. Dead
        // rows carry no recoverable content, so acking them without a fresh
        // backup is safe (nothing to lose from the backstop contract).
        processedCount++
      } else {
        // Transient (network / parse / Web Crypto blip) — leave unread so a
        // later drain retries. Do NOT consume.
        logger.error(`Failed to process vault message ${row.id}:`, e instanceof Error ? e.message : e)
      }
    }
  }

  // 5b. Dispatch collected calendar routes with delete-awareness.
  // Pre-scan for deleted event IDs so earlier create/update messages in the
  // same batch don't resurrect an event that was subsequently deleted.
  if (calendarRoutes.length > 0) {
    const deletedEventIds = new Set<string>()
    for (const c of calendarRoutes) {
      if (c.action === 'delete') deletedEventIds.add(c.data.id)
    }
    for (const c of calendarRoutes) {
      if (c.action === 'delete' || !deletedEventIds.has(c.data.id)) {
        routeCalendarEvent(c)
      }
    }
  }

  // 5c. Same delete-aware dispatch for map overlays.
  if (overlayRoutes.length > 0) {
    const deletedOverlayIds = new Set<string>()
    for (const c of overlayRoutes) {
      if (c.action === 'delete') deletedOverlayIds.add(c.data.id)
    }
    // Serial await — overlay/feature routes share a single IDB row under RMW.
    for (const c of overlayRoutes) {
      if (c.action === 'delete' || !deletedOverlayIds.has(c.data.id)) {
        await routeMapOverlay(c).catch(() => {})
      }
    }
  }

  // 5d. Map feature envelopes. Delete-aware on (overlay_id, feature_id) so
  // an in-batch create+delete pair never resurrects a removed feature.
  if (featureRoutes.length > 0) {
    const deletedFeatureKeys = new Set<string>()
    const keyOf = (c: MapFeatureContent) => `${c.data.overlay_id}::${c.data.feature.id}`
    for (const c of featureRoutes) {
      if (c.action === 'delete') deletedFeatureKeys.add(keyOf(c))
    }
    for (const c of featureRoutes) {
      if (c.action === 'delete' || !deletedFeatureKeys.has(keyOf(c))) {
        await routeMapFeature(c).catch(() => {})
      }
    }
  }

  // 6. Two-phase drain: stash mark-read + OTP replenishment for ackVaultDrain()
  //    to run AFTER createBackup confirms the just-drained messages are in
  //    signal_backups. If we acked inline and the user logged out / iOS
  //    evicted before the next backup, the messages would be marked read
  //    (invisible to next drain) AND OTP private keys would be gone
  //    (undecryptable even if re-fetched) — and they wouldn't be in any
  //    backup. Vault loses its backstop contract.
  //
  //    Until ackVaultDrain runs the drain is fully idempotent:
  //      - messages stay unread server-side → re-drained on next login
  //      - OTP private keys stay in blob   → re-decryption works
  //      - saveMessage + addMessage dedupe by id → no UI duplication
  if (processedIds.length > 0 || consumedOtpIds.size > 0) {
    _pendingVaultAck = {
      userId,
      processedIds,
      consumedOtpIds: [...consumedOtpIds],
    }
  }

  // 7. Rotate vault signed pre-key — orthogonal to ack (SPK rotation doesn't
  //    touch OTP private keys or message rows, and is just staleness
  //    mitigation). Safe to run before backup confirms.
  await rotateVaultSignedPreKey(userId, vaultKeys, vaultRow as VaultDeviceKeysRow)

  logger.info(`Processed ${processedCount} vault messages (ack pending)`)
  return processedCount
}

/**
 * Phase 2 of vault drain — call AFTER createBackup confirms the just-drained
 * messages have been uploaded to signal_backups. Marks the messages read
 * server-side (so they don't re-drain) and replenishes the consumed OTPs.
 *
 * Idempotent: second call is a no-op. Safe to call when no drain is pending.
 *
 * Re-recovers the latest vault row before replenishing so concurrent SPK
 * rotation or another device's replenish doesn't trigger OCC failure.
 */
export async function ackVaultDrain(): Promise<void> {
  const ack = _pendingVaultAck
  if (!ack) return
  _pendingVaultAck = null

  try {
    if (ack.processedIds.length > 0) {
      const { error } = await supabase.rpc('mark_signal_messages_read', {
        p_message_ids: ack.processedIds,
        p_recipient_id: ack.userId,
      })
      if (error) logger.warn('ackVaultDrain mark-read failed:', error.message)
    }

    if (ack.consumedOtpIds.length > 0) {
      // Re-recover with latest state. Wrapping key still cached; cheap.
      const { data: latestRow } = await supabase
        .from('vault_device_keys')
        .select('*')
        .eq('user_id', ack.userId)
        .single()
      if (latestRow) {
        try {
          const latestKeys = await recoverVaultKeys(latestRow as VaultDeviceKeysRow)
          await replenishVaultPreKeys(
            ack.userId,
            latestKeys,
            new Set(ack.consumedOtpIds),
            latestRow as VaultDeviceKeysRow,
          )
        } catch (e) {
          logger.warn('ackVaultDrain replenish failed:', e instanceof Error ? e.message : e)
        }
      }
    }
  } catch (e) {
    logger.warn('ackVaultDrain failed:', e instanceof Error ? e.message : e)
  }
}

// ---- Pre-Key Rotation & Replenishment ----

/**
 * Rotate the vault signed pre-key and re-encrypt the vault blob.
 */
async function rotateVaultSignedPreKey(
  userId: string,
  vaultKeys: VaultPrivateKeys,
  vaultRow: VaultDeviceKeysRow
): Promise<void> {
  if (!cachedVaultKey) return

  try {
    // Generate new signed pre-key
    const newSpkPair = await generateDhPair()
    const newSpkPubBase64 = await exportPubKey(newSpkPair.publicKey, 'raw')
    const spkPubBytes = base64ToUint8(newSpkPubBase64)
    const newSpkSignature = await signBytes(vaultKeys.signingPrivateKey, spkPubBytes)
    const newSpkId = vaultKeys.signedPreKey.keyId + 1

    // Push the outgoing SPK onto the retention list so InitialMessages still
    // referencing it (sent before this rotation) can decrypt on next drain.
    // Bounded — drop oldest first to stay under VAULT_PREVIOUS_SPK_RETENTION.
    const outgoingSpkJwk: VaultStoredSignedPreKey = {
      keyId: vaultKeys.signedPreKey.keyId,
      privateKey: await crypto.subtle.exportKey('jwk', vaultKeys.signedPreKey.privateKey),
      publicKey: await crypto.subtle.exportKey('jwk', vaultKeys.signedPreKey.publicKey),
      publicKeyBase64: vaultKeys.signedPreKey.publicKeyBase64,
      signature: vaultKeys.signedPreKey.signature,
      createdAt: vaultKeys.signedPreKey.createdAt,
    }
    const previousJwk: VaultStoredSignedPreKey[] = await Promise.all(
      vaultKeys.previousSignedPreKeys.map(async s => ({
        keyId: s.keyId,
        privateKey: await crypto.subtle.exportKey('jwk', s.privateKey),
        publicKey: await crypto.subtle.exportKey('jwk', s.publicKey),
        publicKeyBase64: s.publicKeyBase64,
        signature: s.signature,
        createdAt: s.createdAt,
      }))
    )
    const retainedPrevious = [...previousJwk, outgoingSpkJwk]
      .slice(-VAULT_PREVIOUS_SPK_RETENTION)

    // Re-assemble blob with new SPK
    const updatedBlob: VaultBlobPlaintext = {
      signingPrivateKey: await crypto.subtle.exportKey('jwk', vaultKeys.signingPrivateKey),
      signingPublicKey: await crypto.subtle.exportKey('jwk', vaultKeys.signingPublicKey),
      dhPrivateKey: await crypto.subtle.exportKey('jwk', vaultKeys.dhPrivateKey),
      dhPublicKey: await crypto.subtle.exportKey('jwk', vaultKeys.dhPublicKey),
      signingPublicKeyBase64: vaultKeys.signingPublicKeyBase64,
      dhPublicKeyBase64: vaultKeys.dhPublicKeyBase64,
      signedPreKey: {
        keyId: newSpkId,
        privateKey: await crypto.subtle.exportKey('jwk', newSpkPair.privateKey),
        publicKey: await crypto.subtle.exportKey('jwk', newSpkPair.publicKey),
        publicKeyBase64: newSpkPubBase64,
        signature: newSpkSignature,
        createdAt: new Date().toISOString(),
      },
      previousSignedPreKeys: retainedPrevious,
      preKeys: await Promise.all(vaultKeys.preKeys.map(async pk => ({
        keyId: pk.keyId,
        privateKey: await crypto.subtle.exportKey('jwk', pk.privateKey),
        publicKey: await crypto.subtle.exportKey('jwk', pk.publicKey),
        publicKeyBase64: pk.publicKeyBase64,
      }))),
      nextPreKeyId: vaultKeys.nextPreKeyId,
    }

    // Re-encrypt with a new IV (same key)
    const newIv = crypto.getRandomValues(new Uint8Array(12))
    const ptBytes = new TextEncoder().encode(JSON.stringify(updatedBlob))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: newIv },
      cachedVaultKey,
      ptBytes
    )

    // Update vault_device_keys with OCC — version must match to prevent silent overwrites
    const { data: rotateData, error: rotateError } = await supabase
      .from('vault_device_keys')
      .update({
        encrypted_blob: uint8ToBase64(new Uint8Array(ciphertext)),
        iv: uint8ToBase64(newIv),
        version: vaultRow.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('version', vaultRow.version)
      .select('user_id')

    if (rotateError || !rotateData?.length) {
      logger.warn('Vault update conflict — another device won the race, skipping')
      return
    }

    // Update public bundle with new SPK
    await supabase
      .from('signal_key_bundles')
      .update({
        signed_pre_key_id: newSpkId,
        signed_pre_key: newSpkPubBase64,
        signed_pre_key_sig: newSpkSignature,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('device_id', VAULT_DEVICE_ID)

    logger.info(`Vault signed pre-key rotated to ID ${newSpkId}`)
  } catch (e) {
    logger.warn('Failed to rotate vault signed pre-key:', e)
  }
}

/**
 * Replenish consumed one-time pre-keys in the vault.
 */
async function replenishVaultPreKeys(
  userId: string,
  vaultKeys: VaultPrivateKeys,
  consumedIds: Set<number>,
  vaultRow: VaultDeviceKeysRow
): Promise<void> {
  if (!cachedVaultKey) return

  try {
    // Remove consumed keys
    const remainingPreKeys = vaultKeys.preKeys.filter(pk => !consumedIds.has(pk.keyId))

    // Generate replacements
    let nextId = vaultKeys.nextPreKeyId
    const newPreKeys: VaultBlobPlaintext['preKeys'] = []
    for (let i = 0; i < consumedIds.size; i++) {
      const pair = await generateDhPair()
      const pubBase64 = await exportPubKey(pair.publicKey, 'raw')
      newPreKeys.push({
        keyId: nextId,
        privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
        publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
        publicKeyBase64: pubBase64,
      })
      nextId++
    }

    // Combine for the new blob
    const allPreKeysJwk = [
      ...await Promise.all(remainingPreKeys.map(async pk => ({
        keyId: pk.keyId,
        privateKey: await crypto.subtle.exportKey('jwk', pk.privateKey),
        publicKey: await crypto.subtle.exportKey('jwk', pk.publicKey),
        publicKeyBase64: pk.publicKeyBase64,
      }))),
      ...newPreKeys,
    ]

    // Re-encrypt blob (fetching the latest version to avoid conflicts)
    const { data: latestRow } = await supabase
      .from('vault_device_keys')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!latestRow) return

    // Decrypt latest to get the current SPK (may have been rotated above)
    const latestBlob = await decryptBlob(latestRow.encrypted_blob, latestRow.iv, cachedVaultKey)
    latestBlob.preKeys = allPreKeysJwk
    latestBlob.nextPreKeyId = nextId

    // Re-encrypt
    const newIv = crypto.getRandomValues(new Uint8Array(12))
    const ptBytes = new TextEncoder().encode(JSON.stringify(latestBlob))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: newIv },
      cachedVaultKey,
      ptBytes
    )

    const { data: replenishData, error: replenishError } = await supabase
      .from('vault_device_keys')
      .update({
        encrypted_blob: uint8ToBase64(new Uint8Array(ciphertext)),
        iv: uint8ToBase64(newIv),
        version: latestRow.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('version', latestRow.version)
      .select('user_id')

    if (replenishError || !replenishData?.length) {
      logger.warn('Vault update conflict — another device won the race, skipping')
      return
    }

    // Update the signal_key_bundles one_time_pre_keys with remaining + new
    const allPublicOtps = [
      ...remainingPreKeys.map(pk => ({ keyId: pk.keyId, publicKey: pk.publicKeyBase64 })),
      ...newPreKeys.map(pk => ({ keyId: pk.keyId, publicKey: pk.publicKeyBase64 })),
    ]

    await supabase
      .from('signal_key_bundles')
      .update({
        one_time_pre_keys: allPublicOtps,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('device_id', VAULT_DEVICE_ID)

    logger.info(`Replenished ${consumedIds.size} vault pre-keys (next ID: ${nextId})`)
  } catch (e) {
    logger.warn('Failed to replenish vault pre-keys:', e)
  }
}

// ---- Password Change Support ----

/**
 * Re-encrypt vault keys with a new password.
 * Must be called atomically with the Supabase auth password update.
 */
export async function reEncryptVaultKeys(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<Result<void>> {
  try {
    // Fetch vault row
    const { data: row } = await supabase
      .from('vault_device_keys')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!row) return ok(undefined) // No vault to re-encrypt

    // Derive old wrapping key and decrypt
    const oldSalt = hexToBytes(row.salt)
    const oldWrappingKey = await deriveWrappingKey(oldPassword, oldSalt, row.kdf_iterations)
    const blob = await decryptBlob(row.encrypted_blob, row.iv, oldWrappingKey)

    // Derive new wrapping key with new salt
    const newSalt = crypto.getRandomValues(new Uint8Array(32))
    const newIv = crypto.getRandomValues(new Uint8Array(12))
    const newWrappingKey = await deriveWrappingKey(newPassword, newSalt, VAULT_KDF_ITERATIONS)

    // Re-encrypt
    const ptBytes = new TextEncoder().encode(JSON.stringify(blob))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: newIv },
      newWrappingKey,
      ptBytes
    )

    // Update row
    const { error } = await supabase
      .from('vault_device_keys')
      .update({
        encrypted_blob: uint8ToBase64(new Uint8Array(ciphertext)),
        salt: bytesToHex(newSalt),
        iv: uint8ToBase64(newIv),
        kdf_iterations: VAULT_KDF_ITERATIONS,
        version: row.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) return err(error.message)

    // Update cached key + persisted copy (new salt/iterations so any older
    // persisted record on another device is detected as stale on load).
    cachedVaultKey = newWrappingKey
    void persistVaultKeyToIdb({
      key: newWrappingKey,
      userId,
      salt: bytesToHex(newSalt),
      iterations: VAULT_KDF_ITERATIONS,
    }).catch(() => logger.warn('Failed to persist re-encrypted vault key to IDB'))

    logger.info('Vault keys re-encrypted with new password')
    return ok(undefined)
  } catch (e) {
    logger.error('Failed to re-encrypt vault keys:', e)
    return err(e instanceof Error ? e.message : 'Unknown error')
  }
}
