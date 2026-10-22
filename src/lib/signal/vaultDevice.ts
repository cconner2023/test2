/**
 * Vault Device — the user's personal inbox (vault-first messaging).
 *
 * The vault is a permanent virtual Signal device whose public key bundle is
 * always available in `signal_key_bundles`. Every personal message is ONE row
 * addressed to the recipient user's vault (vaultSend.ts) — a self-contained
 * X3DH to the vault's signed pre-key. Private keys are wrapped with a
 * password-derived AES-256-GCM key and stored opaque in `vault_device_keys`;
 * every device of the user recovers them (getVaultDecryptKeys) and reads the
 * vault tail from its own cursor (vaultCursor.ts, useSignalMessages).
 *
 * The vault is a STABLE entity: it is never rotated on logout or device
 * removal (device revocation is auth/RLS — a signed-out device cannot read
 * rows). Only a password reset re-provisions it.
 *
 * Security notes:
 * - Forward secrecy is bounded by signed pre-key retention (no ratchet, no
 *   one-time pre-keys): the SPK rotates at most once per
 *   VAULT_SPK_ROTATION_INTERVAL_MS and the previous VAULT_PREVIOUS_SPK_RETENTION
 *   are kept so unreaped rows stay openable.
 * - PBKDF2 with 600K iterations (Web Crypto — no native Argon2).
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { bytesToHex, hexToBytes } from '../cryptoUtils'
import { supabase } from '../supabase'
import { dbName } from '../idbEnv'
import { SIGNAL } from '../constants'
import { ok, err, type Result } from '../result'
import { uploadKeyBundle, registerDevice } from './signalService'
import type { PublicKeyBundle } from './types'
import type { VaultDecryptKeys } from './session'

const logger = createLogger('VaultDevice')

// ---- Constants ----

export const VAULT_DEVICE_ID = 'vault'

/** Fired on window when the vault wrapping key becomes available on this device;
 *  the vault-first receive path re-runs its catch-up on it. */
export const VAULT_UNLOCKED_EVENT = 'vault-unlocked'
const VAULT_KDF_ITERATIONS = 600_000
const VAULT_PREKEY_BATCH_SIZE = 500
/** Cap on retained previous signed pre-keys. The previous N keep in-flight
 *  InitialMessages decryptable across a rotation. */
const VAULT_PREVIOUS_SPK_RETENTION = 10

/** Minimum age before the vault SPK is rotated. Rotation is periodic hygiene,
 *  NOT a per-drain op: attempting it on every drain made concurrent same-device
 *  logins (INITIAL_SESSION + SIGNED_IN, or the VaultUnlockBanner drain racing
 *  the SIGNED_IN drain) collide on the vault_device_keys OCC write — the loser
 *  logged "another device won the race" on every load, plus did wasted crypto.
 *  It also churned SPKs far faster than needed. With RETENTION=10, weekly
 *  rotation keeps ~10 weeks of old InitialMessages decryptable. */
const VAULT_SPK_ROTATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

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
 *  getVaultDecryptKeys awaits this so it doesn't race with the PBKDF2
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

// Separate DB for the cached vault ROW (the ~350 KB encrypted_blob), keyed by
// version. See fetchVaultRow for the egress rationale.
const VAULT_ROW_DB = 'adtmc-vault-row'
const VAULT_ROW_STORE = 'rows'
const VAULT_ROW_ID = 'current'

interface StoredVaultKey {
  key: CryptoKey
  userId: string
  salt: string
  iterations: number
}

function openVaultKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(VAULT_KEY_DB), 1)
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

// ---- Vault row (encrypted blob) cache — egress reduction ----
//
// The vault row's encrypted_blob is a fixed ~350 KB: it carries the full
// one-time pre-key batch (VAULT_PREKEY_BATCH_SIZE JWK keypairs). Every device
// loads it (getVaultDecryptKeys) on EVERY session start and PWA resume to open
// its vault inbox, so re-downloading that blob each time would dominate DB
// egress even when nothing is waiting.
//
// Every writer of encrypted_blob (provision, SPK rotation, OTP replenish, password
// re-encrypt) bumps `version`, so version is a COMPLETE cache key — a version match
// guarantees a byte-identical blob. We cheap-probe `version` (a single int) on each
// drain and download the full row only on a miss. A cross-device write bumps the
// version too, so a stale local cache always misses the probe and refetches; this
// can never serve the wrong blob.

interface StoredVaultRow {
  userId: string
  version: number
  row: VaultDeviceKeysRow
}

function openVaultRowDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(VAULT_ROW_DB), 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(VAULT_ROW_STORE)) {
        req.result.createObjectStore(VAULT_ROW_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function persistVaultRowToIdb(record: StoredVaultRow): Promise<void> {
  const db = await openVaultRowDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VAULT_ROW_STORE, 'readwrite')
    tx.objectStore(VAULT_ROW_STORE).put(record, VAULT_ROW_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadVaultRowFromIdb(): Promise<StoredVaultRow | null> {
  const db = await openVaultRowDb()
  const rec = await new Promise<StoredVaultRow | null>((resolve, reject) => {
    const tx = db.transaction(VAULT_ROW_STORE, 'readonly')
    const req = tx.objectStore(VAULT_ROW_STORE).get(VAULT_ROW_ID)
    req.onsuccess = () => resolve((req.result as StoredVaultRow) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return rec
}

async function clearVaultRowFromIdb(): Promise<void> {
  try {
    const db = await openVaultRowDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(VAULT_ROW_STORE, 'readwrite')
      tx.objectStore(VAULT_ROW_STORE).delete(VAULT_ROW_ID)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IDB unavailable — nothing to clear.
  }
}

/**
 * Fetch the vault row, serving the ~350 KB encrypted_blob from an IDB cache when
 * the server-side `version` is unchanged. Returns null when no vault exists.
 *
 * On a cache hit the only network cost is a single-int `version` probe; the blob
 * is downloaded only when it actually changed. Any IDB error falls through to a
 * full fetch, so the cache can never serve a stale/wrong blob — version is bumped
 * by every blob writer, so a version match is byte-identical.
 */
/** Version probes are reused this long — the receive drain opens rows one by
 *  one and must not pay a round-trip per row. A rotation another device makes
 *  inside the window only delays rows sealed to the new SPK to the next drain. */
const VAULT_PROBE_TTL_MS = 15_000
let _probeCache: { userId: string; version: number | null; at: number } | null = null

async function fetchVaultRow(userId: string): Promise<VaultDeviceKeysRow | null> {
  // Cheap probe — does a vault exist, and at what version?
  let version: number | null
  if (_probeCache && _probeCache.userId === userId && Date.now() - _probeCache.at < VAULT_PROBE_TTL_MS) {
    version = _probeCache.version
  } else {
    const { data: probe, error: probeError } = await supabase
      .from('vault_device_keys')
      .select('version')
      .eq('user_id', userId)
      .maybeSingle()
    // A failed probe is NOT "no vault" — reading it as one fails every row on a
    // flaky link and burns their retry attempts.
    if (probeError) throw new VaultUnavailableError(probeError.message)
    version = probe?.version ?? null
    _probeCache = { userId, version, at: Date.now() }
  }

  if (version === null) return null // No vault for this user.
  const probe = { version }

  // Serve the cached blob when the version matches.
  try {
    const cached = await loadVaultRowFromIdb()
    if (cached && cached.userId === userId && cached.version === probe.version) {
      return cached.row
    }
  } catch {
    // IDB unavailable — fall through to a full fetch.
  }

  // Miss — download the full row and re-cache it.
  const { data: row, error } = await supabase
    .from('vault_device_keys')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw new VaultUnavailableError(error.message)
  if (!row) return null
  void persistVaultRowToIdb({ userId, version: row.version, row: row as VaultDeviceKeysRow })
    .catch(() => logger.warn('Failed to cache vault row to IDB'))
  return row as VaultDeviceKeysRow
}

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
  window.dispatchEvent(new Event(VAULT_UNLOCKED_EVENT))
}

/**
 * True when the password-derived wrapping key is held in memory. When false,
 * getVaultDecryptKeys throws VaultLockedError without decrypting anything — the
 * caller can use this to distinguish a "no key" bail from a "no messages" drain
 * and offer a non-blocking re-enter-password prompt.
 */
export function isVaultKeyCached(): boolean {
  return cachedVaultKey !== null
}

/** Clear cached vault key (called on sign-out). */
export function clearVaultKey(): void {
  cachedVaultKey = null
  _cachedVaultDh = null
  _vaultKeyReady = null
  _cachedDecryptKeys = null
  _probeCache = null
  // Wipe the persisted key so the next user on this device can't load it. The
  // userId tag on the record is a second guard if this fire-and-forget races.
  void clearVaultKeyFromIdb().catch(() => {})
  // Drop the cached vault row too — a different user signing in next must never
  // be served this user's blob (fetchVaultRow also guards on userId + version).
  void clearVaultRowFromIdb().catch(() => {})
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

// ---- Vault Inbox Keys ----

/** Vault keys for the vault-first inbox, cached per user + vault row version. */
let _cachedDecryptKeys: { userId: string; version: number; keys: VaultPrivateKeys } | null = null

/**
 * Thrown when a vault row can't be opened because the password-derived wrapping
 * key isn't available on this device (live-session resume without the password).
 * The receive path stops at that row and surfaces the vault re-auth prompt.
 */
/**
 * Thrown when the vault row can't be fetched (network/RPC failure). Transient:
 * the receive drain retries without counting it against the row.
 */
export class VaultUnavailableError extends Error {
  constructor(reason: string) {
    super(`Vault keys unavailable: ${reason}`)
    this.name = 'VaultUnavailableError'
  }
}

export class VaultLockedError extends Error {
  constructor() {
    super('Vault wrapping key not available on this device')
    this.name = 'VaultLockedError'
  }
}

/**
 * Private keys of the user's vault, ready to open vault rows. Vault-first: every
 * personal message is one row addressed to the recipient's vault and EVERY
 * device of the user opens it with these keys (replaces the login-time drain).
 *
 * Returns null when the user has no vault. Throws VaultLockedError when the
 * wrapping key can't be restored. A definitive AES-GCM auth failure on the blob
 * means the password was reset: the vault is wiped for re-provision (same rule
 * the drain applied) and null is returned.
 *
 * Also runs the periodic signed pre-key rotation (no-op while the SPK is fresh).
 */
export async function getVaultDecryptKeys(userId: string): Promise<VaultDecryptKeys | null> {
  const vaultRow = await fetchVaultRow(userId)
  if (!vaultRow) return null

  if (
    _cachedDecryptKeys &&
    _cachedDecryptKeys.userId === userId &&
    _cachedDecryptKeys.version === vaultRow.version
  ) {
    return toDecryptKeys(_cachedDecryptKeys.keys)
  }

  // Wait for the vault key derivation that runs fire-and-forget from signIn()
  try { if (_vaultKeyReady) await _vaultKeyReady } catch { /* fall through */ }

  // Live-session resume never runs the password sign-in path; restore the key
  // from IDB, gated on a salt+iterations match so a stale key is discarded.
  if (!cachedVaultKey) {
    await restoreVaultKeyFromIdb(userId, vaultRow.salt, vaultRow.kdf_iterations)
  }
  if (!cachedVaultKey) throw new VaultLockedError()

  let vaultKeys: VaultPrivateKeys
  try {
    vaultKeys = await recoverVaultKeys(vaultRow)
  } catch (e) {
    const isAuthTagFailure = e instanceof DOMException && e.name === 'OperationError'
    if (!isAuthTagFailure) throw e
    logger.error('Vault AES-GCM auth failure — password changed; wiping vault for re-provision:', e)
    await supabase.from('vault_device_keys').delete().eq('user_id', userId)
    await supabase.from('signal_key_bundles').delete()
      .eq('user_id', userId).eq('device_id', VAULT_DEVICE_ID)
    await supabase.from('user_devices').delete()
      .eq('user_id', userId).eq('device_id', VAULT_DEVICE_ID)
    void clearVaultRowFromIdb().catch(() => {})
    _cachedDecryptKeys = null
    _probeCache = null
    return null
  }

  _cachedDecryptKeys = { userId, version: vaultRow.version, keys: vaultKeys }

  // Rotation bumps the row version; the next call re-recovers the new blob.
  void rotateVaultSignedPreKey(userId, vaultKeys, vaultRow).catch(() => {})

  return toDecryptKeys(vaultKeys)
}

function toDecryptKeys(keys: VaultPrivateKeys): VaultDecryptKeys {
  return {
    dhPrivateKey: keys.dhPrivateKey,
    dhPublicKeyBase64: keys.dhPublicKeyBase64,
    signedPreKeys: [keys.signedPreKey, ...keys.previousSignedPreKeys],
    preKeys: keys.preKeys,
  }
}

// ---- Pre-Key Rotation & Replenishment ----

/**
 * Rotate the vault signed pre-key and re-encrypt the vault blob.
 * No-ops if the current SPK is younger than VAULT_SPK_ROTATION_INTERVAL_MS.
 */
async function rotateVaultSignedPreKey(
  userId: string,
  vaultKeys: VaultPrivateKeys,
  vaultRow: VaultDeviceKeysRow
): Promise<void> {
  if (!cachedVaultKey) return

  // Periodic, not per-drain. Skip while the current SPK is still fresh — the
  // common case on multi-login days — so concurrent drains don't self-race on
  // the OCC write below. A missing/invalid createdAt (legacy vault) parses to
  // NaN, fails the `>= 0` guard, and rotates once to stamp a real timestamp.
  const spkAgeMs = Date.now() - Date.parse(vaultKeys.signedPreKey.createdAt)
  if (spkAgeMs >= 0 && spkAgeMs < VAULT_SPK_ROTATION_INTERVAL_MS) return

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

// ---- Password Change Support ----

/**
 * Re-encrypt vault keys with a new password.
 * Must be called atomically with the Supabase auth password update.
 */
/**
 * Core re-wrap: given a vault row and the OLD wrapping key that can decrypt it,
 * decrypt the blob and re-encrypt it under a fresh new-password-derived key with a
 * new random salt. Updates the row, the in-memory cache, and the persisted IDB key.
 * Shared by the password-based (reEncryptVaultKeys) and cached-key-based
 * (reEncryptVaultKeysWithCachedKey) entry points so the crypto lives in one place.
 *
 * A decrypt failure here throws (OperationError) — callers decide how to handle it.
 * This NEVER wipes; it either succeeds in preserving the blob or surfaces the error.
 */
async function rewrapVaultBlob(
  userId: string,
  row: { encrypted_blob: string; iv: string; version: number },
  oldWrappingKey: CryptoKey,
  newPassword: string
): Promise<Result<void>> {
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
}

/**
 * Re-encrypt the vault blob under a new password when the OLD password is known
 * (self-service password change). Derives the old wrapping key from oldPassword +
 * the current salt, so it always works. Call this on any password change where the
 * user supplied their current password — otherwise the next login derives a key
 * that can't decrypt the old blob and trips the destructive wipe path.
 */
export async function reEncryptVaultKeys(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<Result<void>> {
  try {
    const { data: row } = await supabase
      .from('vault_device_keys')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!row) return ok(undefined) // No vault to re-encrypt

    const oldWrappingKey = await deriveWrappingKey(oldPassword, hexToBytes(row.salt), row.kdf_iterations)
    return await rewrapVaultBlob(userId, row, oldWrappingKey, newPassword)
  } catch (e) {
    logger.error('Failed to re-encrypt vault keys:', e)
    return err(e instanceof Error ? e.message : 'Unknown error')
  }
}

/**
 * Best-effort vault preservation for the forgot-password RECOVERY flow, where the
 * OLD password is NOT available. The only way to decrypt the old blob is the old
 * wrapping key still held locally — cached in memory (the recovery-login drain
 * already restores it on the user's usual device) or persisted in IDB (salt-gated
 * to the not-yet-reprovisioned vault row). If neither is available (a brand-new
 * device), the blob is cryptographically unrecoverable and we return ok(false) —
 * the caller leaves the existing wipe-on-next-login path to re-provision cleanly.
 *
 * Returns ok(true) if the vault was preserved (re-wrapped under the new password),
 * ok(false) if there was nothing to preserve or the old key wasn't available.
 * Never wipes — a wrong/stale key just fails decrypt and yields ok(false).
 */
export async function reEncryptVaultKeysWithCachedKey(
  userId: string,
  newPassword: string
): Promise<Result<boolean>> {
  try {
    const { data: row } = await supabase
      .from('vault_device_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!row) return ok(false) // No vault to preserve

    // Try to make the old wrapping key available without the password. Salt-gated
    // to the current (still-old) row, so it only loads a key that can decrypt it.
    if (!cachedVaultKey) {
      await restoreVaultKeyFromIdb(userId, row.salt, row.kdf_iterations)
    }
    if (!cachedVaultKey) return ok(false) // Old key not available locally — can't preserve.

    const res = await rewrapVaultBlob(userId, row, cachedVaultKey, newPassword)
    if (!res.ok) return err(res.error)
    return ok(true)
  } catch (e) {
    // Decrypt failure (stale/wrong cached key) or transient error — do NOT wipe;
    // report not-preserved and let the normal next-login path handle it.
    logger.warn('Recovery vault preservation skipped:', e)
    return ok(false)
  }
}
