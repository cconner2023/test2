/**
 * Clinic Vault Device — always-online Signal peer for the clinic persona.
 *
 * The clinic is a "user" in the Signal infrastructure. Its vault device
 * (`device_id = 'vault'`) is a peer in the fan-out mesh: every clinic action
 * ('c', 'u', 'd' for calendar events, property, announcements) is encrypted
 * for it alongside the member clinic devices. Members observe changes live via
 * their own fan-out copies (useMessages → routeCalendarEvent); the vault copy is
 * the clinic's durable PRIMARY-DEVICE history for bootstrap/catch-up.
 *
 * SNAPSHOT + TAIL (2026-05-31, replaces the per-device cursor / archive replay):
 * processClinicVaultMessages no longer re-decrypts the whole chain. A HEALTHY
 * session loads the latest clinic snapshot (a signal_backups row, user_id =
 * clinic_id, sealed to the vault identity — the resolved calendar+overlay state
 * at a watermark), decrypts only the tail of vault rows past that watermark, then
 * compacts: write a fresh snapshot (OCC via write_clinic_snapshot) and reap the
 * archive rows it now covers (reap_clinic_vault_below) — two-phase, reap only
 * after the snapshot lands. This is the personal signal_backups model applied to
 * the clinic. The snapshot materialises resolution, so there is no per-pair
 * clean and no 'd'-must-survive invariant.
 *
 * Key differences from personal vault (vaultDevice.ts):
 * - Wrapping key derived from clinic's `encryption_key` (shared among members)
 *   instead of a user password.
 * - Provisioned once per clinic, never deleted unless clinic is deleted.
 * - Any authenticated clinic member can drain its inbox on login.
 * - Member fan-out copies use personal recipient_id; vault copy uses clinic_id.
 *
 * Security model:
 * - Vault private keys wrapped with PBKDF2(encryption_key, salt, 600K iterations)
 * - Same ECDSA signing + ECDH identity as personal vault
 * - X3DH + Double Ratchet for message encryption (standard Signal Protocol)
 *
 * Crypto posture caveat: unlike a normal Signal peer, the current code forces
 * fresh X3DH on every vault send and never consumes OTP private keys from the
 * blob — a replay-all-forever posture that keeps historical messages
 * decryptable across logins but is archive-shaped at the crypto layer. The
 * calendar/property/etc. LAYERS treat the vault as a normal peer; only the
 * underlying cipher bookkeeping still operates in archive mode. Future work.
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
import { uploadKeyBundle, registerDevice } from './signalService'
import { isCalendarEvent, routeCalendarEvent, initCalendarTombstones, publishFullReplayLiveIds, poisonFullReplayReconcile, snapshotCalendarEvents, loadSnapshotCalendarEvents } from '../calendarRouting'
import { isMapOverlay, isMapFeature, routeMapOverlay, routeMapFeature, initOverlayTombstones, loadSnapshotOverlays, snapshotOverlays } from '../mapOverlayRouting'
import type { CalendarEventContent, MapOverlayContent, MapFeatureContent } from './messageContent'
import { parseMessageContent } from './messageContent'
import { deflateRaw, inflateRaw } from 'pako'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import type { LocalMapOverlay } from '../../Types/MapOverlayTypes'
import type { PublicKeyBundle, InitialMessage, EncryptedMessage, RatchetState } from './types'
import type { SignalMessageRow } from './transportTypes'
import type { SealedEnvelope } from './sealedSender'

const logger = createLogger('ClinicVault')

export const CLINIC_VAULT_DEVICE_ID = 'vault'
const KDF_ITERATIONS = 600_000
const PREKEY_BATCH_SIZE = 500

// ---- Types ----

/** Serialised SPK stored in the vault blob (JWK format). */
interface StoredSignedPreKey {
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
  signedPreKey: StoredSignedPreKey
  /** Retained old SPKs so vault messages encrypted with previous keys remain decryptable. */
  previousSignedPreKeys?: StoredSignedPreKey[]
  preKeys: Array<{
    keyId: number
    privateKey: JsonWebKey
    publicKey: JsonWebKey
    publicKeyBase64: string
  }>
  nextPreKeyId: number
}

/** Imported SPK with live CryptoKey handles. */
interface ImportedSignedPreKey {
  keyId: number
  privateKey: CryptoKey
  publicKey: CryptoKey
  publicKeyBase64: string
  signature: string
  createdAt: string
}

interface VaultPrivateKeys {
  signingPrivateKey: CryptoKey
  signingPublicKey: CryptoKey
  dhPrivateKey: CryptoKey
  dhPublicKey: CryptoKey
  signingPublicKeyBase64: string
  dhPublicKeyBase64: string
  signedPreKey: ImportedSignedPreKey
  /** Previous SPKs retained for decrypting older vault messages (keyed by keyId). */
  previousSignedPreKeys: ImportedSignedPreKey[]
  preKeys: Array<{
    keyId: number
    privateKey: CryptoKey
    publicKey: CryptoKey
    publicKeyBase64: string
  }>
  nextPreKeyId: number
}

interface VaultDeviceKeysRow {
  user_id: string
  encrypted_blob: string
  salt: string
  iv: string
  kdf_iterations: number
  version: number
}

// ---- Module-level cached wrapping key ----

let cachedClinicVaultKey: CryptoKey | null = null
let cachedClinicId: string | null = null

// ---- PBKDF2 Key Derivation ----

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
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
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
  const wrappingKey = await deriveWrappingKey(password, salt, KDF_ITERATIONS)
  const ptBytes = new TextEncoder().encode(JSON.stringify(plaintext))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, ptBytes)
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

async function generateDhPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: SIGNAL.CURVE },
    true,
    ['deriveKey', 'deriveBits']
  )
}

async function generateSigningPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: SIGNAL.CURVE },
    true,
    ['sign', 'verify']
  )
}

async function exportPubKey(key: CryptoKey, format: 'raw' | 'spki' = 'raw'): Promise<string> {
  const exported = await crypto.subtle.exportKey(format, key)
  return uint8ToBase64(new Uint8Array(exported))
}

async function signBytes(privateKey: CryptoKey, data: Uint8Array): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data as BufferSource
  )
  return uint8ToBase64(new Uint8Array(sig))
}

// ---- Key Import ----

async function importSignedPreKey(spk: StoredSignedPreKey): Promise<ImportedSignedPreKey> {
  const [priv, pub] = await Promise.all([
    crypto.subtle.importKey('jwk', spk.privateKey, { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, ['deriveKey', 'deriveBits']),
    crypto.subtle.importKey('jwk', spk.publicKey, { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, []),
  ])
  return {
    keyId: spk.keyId,
    privateKey: priv,
    publicKey: pub,
    publicKeyBase64: spk.publicKeyBase64,
    signature: spk.signature,
    createdAt: spk.createdAt,
  }
}

async function importVaultKeys(blob: VaultBlobPlaintext): Promise<VaultPrivateKeys> {
  const [signingPriv, signingPub, dhPriv, dhPub] = await Promise.all([
    crypto.subtle.importKey('jwk', blob.signingPrivateKey, { name: 'ECDSA', namedCurve: SIGNAL.CURVE }, true, ['sign']),
    crypto.subtle.importKey('jwk', blob.signingPublicKey, { name: 'ECDSA', namedCurve: SIGNAL.CURVE }, true, ['verify']),
    crypto.subtle.importKey('jwk', blob.dhPrivateKey, { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, ['deriveKey', 'deriveBits']),
    crypto.subtle.importKey('jwk', blob.dhPublicKey, { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, []),
  ])

  const currentSpk = await importSignedPreKey(blob.signedPreKey)

  const previousSpks = await Promise.all(
    (blob.previousSignedPreKeys ?? []).map(importSignedPreKey)
  )

  const preKeys = await Promise.all(blob.preKeys.map(async pk => ({
    keyId: pk.keyId,
    privateKey: await crypto.subtle.importKey('jwk', pk.privateKey, { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, ['deriveKey', 'deriveBits']),
    publicKey: await crypto.subtle.importKey('jwk', pk.publicKey, { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, []),
    publicKeyBase64: pk.publicKeyBase64,
  })))

  return {
    signingPrivateKey: signingPriv,
    signingPublicKey: signingPub,
    dhPrivateKey: dhPriv,
    dhPublicKey: dhPub,
    signingPublicKeyBase64: blob.signingPublicKeyBase64,
    dhPublicKeyBase64: blob.dhPublicKeyBase64,
    signedPreKey: currentSpk,
    previousSignedPreKeys: previousSpks,
    preKeys,
    nextPreKeyId: blob.nextPreKeyId,
  }
}

// ---- Public API ----

/**
 * Derive and cache the clinic vault wrapping key.
 * Must be called after login before processClinicVaultMessages.
 */
export async function deriveAndCacheClinicVaultKey(
  clinicId: string,
  encryptionKey: string,
): Promise<void> {
  const { data } = await supabase
    .from('vault_device_keys')
    .select('salt, kdf_iterations')
    .eq('user_id', clinicId)
    .maybeSingle()

  if (!data) return // Vault doesn't exist yet

  const saltBytes = hexToBytes(data.salt)
  cachedClinicVaultKey = await deriveWrappingKey(encryptionKey, saltBytes, data.kdf_iterations)
  cachedClinicId = clinicId
  logger.info('Clinic vault wrapping key cached')
}

/** Clear cached clinic vault key (called on sign-out). */
export function clearClinicVaultKey(): void {
  cachedClinicVaultKey = null
  cachedClinicId = null
}

interface ClinicVaultMaterial {
  encryptedBlob: string
  salt: string
  iv: string
  signingPubBase64: string
  dhPubBase64: string
  spkPubBase64: string
  spkSignature: string
  publicPreKeys: { keyId: number; publicKey: string }[]
}

async function generateClinicVaultMaterial(encryptionKey: string): Promise<ClinicVaultMaterial> {
  const [signingPair, dhPair] = await Promise.all([
    generateSigningPair(),
    generateDhPair(),
  ])
  const [signingPubBase64, dhPubBase64] = await Promise.all([
    exportPubKey(signingPair.publicKey, 'spki'),
    exportPubKey(dhPair.publicKey, 'raw'),
  ])

  const spkPair = await generateDhPair()
  const spkPubBase64 = await exportPubKey(spkPair.publicKey, 'raw')
  const spkSignature = await signBytes(signingPair.privateKey, base64ToUint8(spkPubBase64))

  const preKeys: VaultBlobPlaintext['preKeys'] = []
  for (let i = 1; i <= PREKEY_BATCH_SIZE; i++) {
    const pair = await generateDhPair()
    const pubBase64 = await exportPubKey(pair.publicKey, 'raw')
    preKeys.push({
      keyId: i,
      privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
      publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
      publicKeyBase64: pubBase64,
    })
  }

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
    previousSignedPreKeys: [],
    preKeys,
    nextPreKeyId: PREKEY_BATCH_SIZE + 1,
  }

  const { encryptedBlob, salt, iv } = await encryptBlob(blob, encryptionKey)

  return {
    encryptedBlob, salt, iv,
    signingPubBase64, dhPubBase64, spkPubBase64, spkSignature,
    publicPreKeys: preKeys.map(pk => ({ keyId: pk.keyId, publicKey: pk.publicKeyBase64 })),
  }
}

/**
 * Provision a clinic vault as a dev via SECURITY DEFINER RPC.
 *
 * Used by adminService.createClinic. The RPC runs all three vault inserts
 * (vault_device_keys, signal_key_bundles, user_devices) in a single
 * transaction with a server-side requireDev check — bypasses the RLS
 * timing/membership issues that caused intermittent failures when a dev
 * created a clinic they were not yet a member of.
 */
export async function provisionClinicVaultAsAdmin(
  clinicId: string,
  encryptionKey: string,
): Promise<Result<void>> {
  logger.info('Provisioning clinic vault device via admin RPC')

  const m = await generateClinicVaultMaterial(encryptionKey)

  const { error } = await supabase.rpc('admin_provision_clinic_vault', {
    p_clinic_id: clinicId,
    p_encrypted_blob: m.encryptedBlob,
    p_salt: m.salt,
    p_iv: m.iv,
    p_kdf_iterations: KDF_ITERATIONS,
    p_version: 1,
    p_identity_signing_key: m.signingPubBase64,
    p_identity_dh_key: m.dhPubBase64,
    p_signed_pre_key_id: 1,
    p_signed_pre_key: m.spkPubBase64,
    p_signed_pre_key_sig: m.spkSignature,
    p_one_time_pre_keys: m.publicPreKeys,
    p_device_label: 'Clinic Vault',
  })

  if (error) {
    const detail = error.message || error.details || error.hint || error.code || JSON.stringify(error)
    logger.error('admin_provision_clinic_vault failed:', detail, error)
    return err(detail)
  }

  logger.info('Clinic vault device provisioned via admin RPC')
  return ok(undefined)
}

/**
 * Ensure a clinic vault device exists. If not, create one.
 * Idempotent — safe to call on every login. Any clinic member can provision.
 */
export async function ensureClinicVaultExists(
  clinicId: string,
  encryptionKey: string,
): Promise<Result<void>> {
  const { data, error: existsError } = await supabase
    .from('vault_device_keys')
    .select('user_id')
    .eq('user_id', clinicId)
    .maybeSingle()

  // FAIL CLOSED. A read error (transient network, RLS visibility blip) makes
  // maybeSingle() return null — which is NOT proof the vault is absent. Treating
  // that null as "missing" is exactly what regenerated ce06896f's vault identity
  // on 2026-05-29 (version reset to 1, whole archive orphaned). Never provision
  // off an errored existence check; the existing vault must be left untouched.
  if (existsError) {
    logger.error('Clinic vault existence check failed — refusing to (re)provision:', existsError)
    return err(existsError.message)
  }

  if (data) {
    // Keys already exist — ensure device is registered in user_devices.
    // Handles the edge case where vault_device_keys was provisioned but
    // the user_devices row was subsequently lost (e.g. partial DB cleanup).
    // registerDevice is idempotent (upsert), so safe to call every login.
    await registerDevice(clinicId, CLINIC_VAULT_DEVICE_ID, 'Clinic Vault')
    return ok(undefined)
  }

  logger.info('Provisioning clinic vault device')

  const m = await generateClinicVaultMaterial(encryptionKey)

  // INSERT, never upsert. The clinic vault identity is the calendar's only
  // durable root key — overwriting it orphans every archived row sealed to the
  // old identity. A plain insert errors on the unique user_id if a vault already
  // exists (concurrent provisioner, or a false-negative existence check above),
  // and we ADOPT that existing vault rather than clobber it. onConflict-upsert
  // would have silently replaced it — that is the bug we are closing.
  const { error: vaultError } = await supabase
    .from('vault_device_keys')
    .insert({
      user_id: clinicId,
      encrypted_blob: m.encryptedBlob,
      salt: m.salt,
      iv: m.iv,
      kdf_iterations: KDF_ITERATIONS,
      version: 1,
      updated_at: new Date().toISOString(),
    })

  if (vaultError) {
    // 23505 = unique_violation: a vault already exists. Back off and adopt it —
    // do NOT upload a new public bundle (that would advertise an identity whose
    // private keys we just threw away). The winning provisioner owns the bundle.
    if (vaultError.code === '23505') {
      logger.warn('Clinic vault already exists (insert raced) — adopting existing vault, not overwriting')
      await registerDevice(clinicId, CLINIC_VAULT_DEVICE_ID, 'Clinic Vault')
      return ok(undefined)
    }
    logger.error('Failed to store clinic vault keys:', vaultError)
    return err(vaultError.message)
  }

  const publicBundle: PublicKeyBundle = {
    userId: clinicId,
    deviceId: CLINIC_VAULT_DEVICE_ID,
    identitySigningKey: m.signingPubBase64,
    identityDhKey: m.dhPubBase64,
    signedPreKey: { keyId: 1, publicKey: m.spkPubBase64, signature: m.spkSignature },
    oneTimePreKeys: m.publicPreKeys,
  }

  const uploadResult = await uploadKeyBundle(publicBundle)
  if (!uploadResult.ok) return uploadResult

  await registerDevice(clinicId, CLINIC_VAULT_DEVICE_ID, 'Clinic Vault')

  logger.info('Clinic vault device provisioned')
  return ok(undefined)
}

/**
 * Max fraction of a clinic-vault tail batch that may fail to decrypt before the
 * snapshot write + reap are refused entirely. All clinic members share one vault
 * identity, so a healthy session decrypts ~100% of the tail. Anything above this
 * is a wrong session (regenerated/rotated vault identity, stale build, bad key)
 * — never genuinely-dead rows — so we fail closed: don't compact, preserve the
 * archive. Set low: real corruption is a row or two; identity loss fails ~100%.
 */
const VAULT_PURGE_MAX_FAIL_RATIO = 0.10

export interface ClinicDrainOptions {
  /**
   * When true (login path), the drain publishes the resolved live calendar
   * event-id set (snapshot base + tail) so useCalendarSync runs its drop-stale
   * prune. A partial/unhealthy decrypt poisons it instead (fail-closed).
   */
  publishReconcile?: boolean
}

// ---- Clinic Snapshot (cached resolved state + tail) ----
//
// The clinic vault is the clinic's "primary device" history. Rather than
// re-decrypting the whole archive on every login, a HEALTHY session compacts the
// resolved calendar+overlay state into an encrypted snapshot (a signal_backups
// row with user_id = clinic_id, sealed to the clinic vault identity) and reaps
// the archived vault rows it covers. A returning/fresh device then loads one
// snapshot row and decrypts only the short tail past its watermark. This mirrors
// the personal signal_backups model — see two-phase-vault-drain: never reap a
// vault row until the snapshot that preserves it has landed.

const CLINIC_SNAPSHOT_PAYLOAD_VERSION = 1
const CLINIC_SNAPSHOT_RETAIN = 3

interface ClinicSnapshotPayload {
  v: number
  /** ISO created_at high-water of the vault rows folded into this snapshot. */
  watermark: string
  events: CalendarEvent[]
  overlays: LocalMapOverlay[]
}

interface LoadedClinicSnapshot {
  version: number
  payload: ClinicSnapshotPayload
}

/** Seal a snapshot payload with the cached clinic vault key (IV-prefixed AES-GCM, mirrors backupService). */
async function sealClinicSnapshot(payload: ClinicSnapshotPayload): Promise<{ salt: string; ciphertext: string } | null> {
  if (!cachedClinicVaultKey) return null
  const compressed = deflateRaw(new TextEncoder().encode(JSON.stringify(payload)))
  const salt = crypto.getRandomValues(new Uint8Array(32)) // schema-compat only; key is the cached clinic key
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cachedClinicVaultKey, compressed as BufferSource)
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  return { salt: uint8ToBase64(salt), ciphertext: uint8ToBase64(combined) }
}

/** Open a snapshot ciphertext with the cached clinic vault key. Throws on auth-tag failure (wrong/rotated identity). */
async function openClinicSnapshot(ciphertextB64: string): Promise<ClinicSnapshotPayload | null> {
  if (!cachedClinicVaultKey) return null
  const combined = base64ToUint8(ciphertextB64)
  const iv = combined.slice(0, 12)
  const ct = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cachedClinicVaultKey, ct as BufferSource)
  const json = new TextDecoder().decode(inflateRaw(new Uint8Array(decrypted)))
  return JSON.parse(json) as ClinicSnapshotPayload
}

/** Read the latest clinic snapshot, or null if none / undecryptable (caller rebuilds from the archive). */
async function readClinicSnapshot(clinicId: string): Promise<LoadedClinicSnapshot | null> {
  const { data, error } = await supabase
    .from('signal_backups')
    .select('ciphertext, backup_version')
    .eq('user_id', clinicId)
    .order('backup_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  try {
    const payload = await openClinicSnapshot(data.ciphertext)
    if (!payload) return null
    return { version: data.backup_version, payload }
  } catch (e) {
    // Undecryptable snapshot = wrong/rotated clinic identity. Fall back to archive
    // replay rather than trusting a stale row. Never delete it here.
    logger.warn('Clinic snapshot undecryptable — falling back to archive replay:', e)
    return null
  }
}

/** Write a snapshot via the OCC RPC. Returns the new version, or -1 if another device won the race / on error. */
async function writeClinicSnapshot(
  clinicId: string,
  payload: ClinicSnapshotPayload,
  expectedVersion: number,
): Promise<number> {
  const sealed = await sealClinicSnapshot(payload)
  if (!sealed) return -1
  const { data, error } = await supabase.rpc('write_clinic_snapshot', {
    p_clinic_id: clinicId,
    p_ciphertext: sealed.ciphertext,
    p_salt: sealed.salt,
    p_event_count: payload.events.length,
    p_expected_version: expectedVersion,
    p_retain: CLINIC_SNAPSHOT_RETAIN,
  })
  if (error) {
    logger.warn('write_clinic_snapshot failed:', error.message)
    return -1
  }
  return typeof data === 'number' ? data : -1
}

/**
 * Drain the clinic vault for this device: load the cached snapshot base, then
 * decrypt and apply only the tail of archive rows past the snapshot watermark.
 *
 * Called on login after personal vault processing. The clinic vault is the
 * clinic's primary-device history; members also receive live changes via
 * per-member fan-out (useMessages → routeCalendarEvent), so this drain is the
 * bootstrap/catch-up path, not the steady-state path.
 *
 * A HEALTHY pass (decrypt fail-ratio ≤ VAULT_PURGE_MAX_FAIL_RATIO) that saw new
 * tail compacts the resolved state into a fresh snapshot (OCC) and reaps the
 * archive rows it now covers. There is no per-device cursor and no whole-chain
 * replay once a snapshot exists.
 */
export async function processClinicVaultMessages(
  clinicId: string,
  opts: ClinicDrainOptions = {},
): Promise<number> {
  // 0. Ensure tombstones are loaded so routeCalendarEvent / routeMapOverlay can
  // guard against resurrecting deleted events. This runs before React hooks
  // (useCalendarSync) so the in-memory sets must be warm.
  await initCalendarTombstones()
  await initOverlayTombstones()

  // 1. Fetch vault row
  const { data: vaultRow } = await supabase
    .from('vault_device_keys')
    .select('*')
    .eq('user_id', clinicId)
    .single()

  if (!vaultRow) {
    logger.info('No clinic vault found — skipping')
    return 0
  }

  if (!cachedClinicVaultKey || cachedClinicId !== clinicId) {
    logger.warn('Clinic vault wrapping key not cached — cannot process')
    return 0
  }

  // 2. Recover vault keys
  let vaultKeys: VaultPrivateKeys
  try {
    const blob = await decryptBlob(
      vaultRow.encrypted_blob,
      vaultRow.iv,
      cachedClinicVaultKey
    )
    vaultKeys = await importVaultKeys(blob)
  } catch (e) {
    logger.error('Failed to recover clinic vault keys:', e)
    return 0
  }

  // 3a. Force-sync server OTPs to match blob — prevents senders from getting
  // OTPs whose private keys were evicted by pre-April-19 code.
  await supabase
    .from('signal_key_bundles')
    .update({
      one_time_pre_keys: vaultKeys.preKeys.map(pk => ({
        keyId: pk.keyId, publicKey: pk.publicKeyBase64,
      })),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', clinicId)
    .eq('device_id', CLINIC_VAULT_DEVICE_ID)

  // 2b. SNAPSHOT BASE. Load the latest cached clinic snapshot (resolved calendar
  // + overlay state at a watermark) before touching the archive. A fresh device
  // gets the whole clinic state from one row; a returning device re-loads it
  // (idempotent upsert) and decrypts only the short tail past the watermark. No
  // snapshot yet — first-ever, or undecryptable after a re-provision — means
  // tailFloor '' = replay the whole archive once and build the first snapshot.
  const snap = await readClinicSnapshot(clinicId)
  let tailFloor = ''
  let baseVersion = 0
  if (snap) {
    baseVersion = snap.version
    tailFloor = snap.payload.watermark
    loadSnapshotCalendarEvents(snap.payload.events)
    await loadSnapshotOverlays(snap.payload.overlays).catch(() => {})
  }

  // 3. Fetch the TAIL: vault rows at/after the snapshot watermark. gte not gt —
  // two rows can share an exact created_at (same fan-out batch); re-decrypting
  // the boundary is idempotent (routeCalendarEvent/routeMapOverlay upsert).
  let query = supabase
    .from('signal_messages')
    .select('*')
    .eq('recipient_id', clinicId)
    .eq('recipient_device_id', CLINIC_VAULT_DEVICE_ID)
    .order('created_at', { ascending: true })
  if (tailFloor) query = query.gte('created_at', tailFloor)
  const { data: rows, error: fetchError } = await query

  if (fetchError) {
    // A fetch failure is NOT an empty archive — never prune the local cache on a
    // transient blip. Poison the reconcile and bail.
    logger.warn('Failed to fetch clinic vault tail:', fetchError)
    if (opts.publishReconcile) poisonFullReplayReconcile()
    await rotateClinicVaultSPK(clinicId, vaultKeys, vaultRow as VaultDeviceKeysRow)
    return 0
  }

  if (!rows || rows.length === 0) {
    // No tail past the snapshot. The snapshot base (already loaded) IS the live
    // truth — publish it for the drop-stale reconcile, then no-op the rest.
    logger.info('No clinic vault tail past snapshot')
    if (opts.publishReconcile) {
      publishFullReplayLiveIds(snapshotCalendarEvents(clinicId).map(e => e.id))
    }
    await rotateClinicVaultSPK(clinicId, vaultKeys, vaultRow as VaultDeviceKeysRow)
    return 0
  }

  logger.info(`Processing ${rows.length} clinic vault tail messages`)

  // 4. Batch decrypt with ephemeral session map
  const sessionMap = new Map<string, { state: RatchetState; ad: Uint8Array }>()
  // Rows that failed to decrypt, by id. A high fail ratio means a wrong session
  // (rotated identity / stale build), which gates off the snapshot write + reap
  // below so the archive is never compacted from a session that can't read it.
  const deadRowIdSet = new Set<string>()
  const markDead = (row: SignalMessageRow) => { deadRowIdSet.add(row.id) }
  let processedCount = 0
  const calendarRoutes: Array<{ content: CalendarEventContent; originId: string | null }> = []
  const overlayRoutes: Array<{ content: MapOverlayContent; originId: string | null }> = []
  const featureRoutes: Array<{ content: MapFeatureContent; originId: string | null }> = []

  for (const row of rows as SignalMessageRow[]) {
    try {
      const envelope = row.payload as unknown as SealedEnvelope
      const senderDeviceId = row.sender_device_id ?? 'unknown'

      // Unseal with vault's DH keys
      let inner: Record<string, unknown>
      let senderUuid: string
      try {
        ;({ inner, senderUuid } = await unseal(
          envelope,
          clinicId,
          vaultKeys.dhPrivateKey,
          vaultKeys.dhPublicKeyBase64,
          { skipExpiry: true }
        ))
      } catch (e) {
        logger.error(`Vault unseal failed for message ${row.id}:`, e)
        markDead(row)
        continue
      }

      let plaintext: string
      const sessionKey = `${senderUuid}:${senderDeviceId}`

      if ('identitySigningKey' in inner) {
        // X3DH initial message — look up SPK by keyId (mirrors clinicSession.ts)
        const initial = inner as unknown as InitialMessage

        // Match the SPK the sender used — check current + retained previous keys
        const matchedSpk = initial.signedPreKeyId === vaultKeys.signedPreKey.keyId
          ? vaultKeys.signedPreKey
          : vaultKeys.previousSignedPreKeys.find(spk => spk.keyId === initial.signedPreKeyId)

        if (!matchedSpk) {
          logger.warn(`Clinic vault SPK ${initial.signedPreKeyId} not found — message undecryptable, skipping`)
          markDead(row)
          continue
        }

        const spkPair = {
          publicKey: matchedSpk.publicKey,
          privateKey: matchedSpk.privateKey,
        }

        // OTP private keys are retained in the blob indefinitely because the
        // vault's crypto posture is archive-mode (see header): every vault send
        // forces fresh X3DH, so every message carries a oneTimePreKeyId, and
        // later logins must still recompute DH4 from the same private key or
        // AEAD fails for every vault message. SPK rotation re-uploads the full
        // OTP list to the public bundle every 7 days so senders always have
        // public OTPs. Look up by keyId only, never mark consumed.
        let otpkPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null
        if (initial.oneTimePreKeyId !== null) {
          const otpk = vaultKeys.preKeys.find(pk => pk.keyId === initial.oneTimePreKeyId)
          if (otpk) {
            otpkPair = { publicKey: otpk.publicKey, privateKey: otpk.privateKey }
          } else {
            logger.warn(`Vault OTP keyId ${initial.oneTimePreKeyId} absent from blob for message ${row.id} — either never provisioned or evicted by pre-April-19 code. This message is permanently undecryptable.`)
            markDead(row)
            continue
          }
        }

        let x3dh: Awaited<ReturnType<typeof x3dhRespond>>
        try {
          x3dh = await x3dhRespond(
            {
              deviceId: CLINIC_VAULT_DEVICE_ID,
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
        } catch (e) {
          logger.error(`Vault X3DH failed for message ${row.id} (SPK ${initial.signedPreKeyId}):`, e)
          markDead(row)
          continue
        }

        const ratchetState = await initReceiver(x3dh.sharedSecret, {
          publicKey: matchedSpk.publicKey,
          privateKey: matchedSpk.privateKey,
          publicKeyBase64: matchedSpk.publicKeyBase64,
        })

        const { state, plaintext: ptBytes } = await ratchetDecrypt(
          ratchetState, initial.message, x3dh.associatedData
        )
        plaintext = new TextDecoder().decode(ptBytes)
        sessionMap.set(sessionKey, { state, ad: x3dh.associatedData })
      } else {
        // Established session message
        const encMsg = inner as unknown as EncryptedMessage
        const existing = sessionMap.get(sessionKey)
        if (!existing) {
          // Orphaned follow-on message — preceding X3DH initial failed or
          // never arrived in this batch. Won't decrypt on future replays
          // either (session state is ephemeral per drain).
          markDead(row)
          continue
        }

        const { state, plaintext: ptBytes } = await ratchetDecrypt(
          existing.state, encMsg, existing.ad
        )
        plaintext = new TextDecoder().decode(ptBytes)
        sessionMap.set(sessionKey, { state, ad: existing.ad })
      }

      // Parse and route content
      const { content } = parseMessageContent(plaintext)
      if (isCalendarEvent(content)) {
        calendarRoutes.push({ content, originId: (row as SignalMessageRow).origin_id ?? null })
      } else if (isMapOverlay(content)) {
        overlayRoutes.push({ content, originId: (row as SignalMessageRow).origin_id ?? null })
      } else if (isMapFeature(content)) {
        featureRoutes.push({ content, originId: (row as SignalMessageRow).origin_id ?? null })
      }

      processedCount++
    } catch (e) {
      logger.error(`Failed to process clinic vault message ${row.id}:`, e)
      markDead(row)  // Permanently undecryptable — schedule for hard delete
    }
  }

  // 5. Apply decrypted actions to the stores, delete-aware: a 'd' in this batch
  // suppresses its paired 'c'/'u'. Compaction is NOT done per-pair anymore — the
  // snapshot below materialises the resolved state and the watermark reap removes
  // the covered rows wholesale, so the old 'd'-must-survive invariant is gone.
  if (calendarRoutes.length > 0) {
    const deletedEventIds = new Set<string>()
    for (const { content } of calendarRoutes) {
      if (content.action === 'delete') deletedEventIds.add(content.data.id)
    }
    for (const { content } of calendarRoutes) {
      if (content.action === 'delete' || !deletedEventIds.has(content.data.id)) {
        routeCalendarEvent(content)
      }
    }
  }

  // 5b. Map overlays. Serial await — overlay/feature routes share a single IDB
  // row (LocalMapOverlay.features[]) under read-modify-write; parallel
  // fire-and-forget would last-write-wins drop deltas.
  if (overlayRoutes.length > 0) {
    const deletedOverlayIds = new Set<string>()
    for (const { content } of overlayRoutes) {
      if (content.action === 'delete') deletedOverlayIds.add(content.data.id)
    }
    for (const { content } of overlayRoutes) {
      if (content.action === 'delete' || !deletedOverlayIds.has(content.data.id)) {
        await routeMapOverlay(content).catch(() => {})
      }
    }
  }

  // 5c. Map feature envelopes, keyed on (overlay_id, feature_id).
  if (featureRoutes.length > 0) {
    const deletedFeatureKeys = new Set<string>()
    const keyOf = (c: MapFeatureContent) => `${c.data.overlay_id}::${c.data.feature.id}`
    for (const { content } of featureRoutes) {
      if (content.action === 'delete') deletedFeatureKeys.add(keyOf(content))
    }
    for (const { content } of featureRoutes) {
      if (content.action === 'delete' || !deletedFeatureKeys.has(keyOf(content))) {
        await routeMapFeature(content).catch(() => {})
      }
    }
  }

  // 5d. Health gate. All clinic members share one vault identity, so a healthy
  // session decrypts ~100% of the tail. A high fail ratio means a wrong session
  // (rotated identity / stale build) — fail closed: don't publish a partial live
  // set, don't snapshot, don't reap. This subsumes the old purge circuit-breaker.
  const deadCount = deadRowIdSet.size
  const failRatio = rows.length > 0 ? deadCount / rows.length : 0
  const healthy = failRatio <= VAULT_PURGE_MAX_FAIL_RATIO

  // 5e. Publish the resolved live calendar-event ids (snapshot base + tail) for
  // useCalendarSync's drop-stale prune. A healthy pass is authoritative truth; a
  // partial decrypt poisons the whole login's reconcile (fail-closed).
  if (opts.publishReconcile) {
    if (healthy) {
      publishFullReplayLiveIds(snapshotCalendarEvents(clinicId).map(e => e.id))
    } else {
      poisonFullReplayReconcile()
    }
  }

  // 5f. WRITER ELECTION -> SNAPSHOT -> REAP. Only a healthy session that saw new
  // tail (or is bootstrapping the first snapshot) compacts. write_clinic_snapshot
  // applies OCC: concurrent member writers serialise per-clinic and only one wins
  // the next version (losers return -1 and skip the reap). The reap is TWO-PHASE
  // — it runs ONLY after the snapshot row is confirmed, so every reaped vault row
  // is already preserved in the snapshot (the personal-vault "never reap until the
  // backup landed" contract). This one watermark-gated pass replaces the old
  // pair-clean + dead-row purge + per-device cursor entirely.
  const newWatermark = (rows as SignalMessageRow[])[rows.length - 1].created_at
  const hasNewTail = snap === null ? true : newWatermark > tailFloor
  if (healthy && hasNewTail) {
    try {
      const payload: ClinicSnapshotPayload = {
        v: CLINIC_SNAPSHOT_PAYLOAD_VERSION,
        watermark: newWatermark,
        events: snapshotCalendarEvents(clinicId),
        overlays: await snapshotOverlays(clinicId),
      }
      const newVersion = await writeClinicSnapshot(clinicId, payload, baseVersion)
      if (newVersion > 0) {
        const { error: reapErr } = await supabase.rpc('reap_clinic_vault_below', {
          p_clinic_id: clinicId,
          p_watermark: newWatermark,
        })
        if (reapErr) logger.warn('reap_clinic_vault_below failed:', reapErr.message)
        else logger.info(`Clinic vault snapshot v${newVersion} written; reaped archive <= ${newWatermark}`)
      }
    } catch (e) {
      logger.warn('Clinic snapshot write/reap failed (archive preserved):', e)
    }
  }

  // 6. Rotate SPK. OTPs are never consumed from the blob (see comment above):
  // the vault is archive-mode, so every consumed OTP's private key must be
  // retained indefinitely to keep older rows decryptable. There is deliberately
  // NO pre-key replenish path — replenish would have to evict consumed OTP
  // privates (standard one-time semantics), which for an archive vault orphans
  // every row sealed to them. SPK rotation re-uploads the full OTP public list
  // to the key bundle each cycle, so senders always have public OTPs to use.
  await rotateClinicVaultSPK(clinicId, vaultKeys, vaultRow as VaultDeviceKeysRow)

  logger.info(`Processed ${processedCount} clinic vault messages`)
  return processedCount
}

// ---- SPK Rotation & Pre-Key Replenishment ----

/** Minimum age (ms) before rotating the clinic vault SPK. */
const SPK_ROTATION_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
/** Maximum age (ms) to retain previous SPKs — must exceed any realistic vault message lifetime. */
const SPK_RETENTION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

async function exportSignedPreKey(spk: ImportedSignedPreKey): Promise<StoredSignedPreKey> {
  return {
    keyId: spk.keyId,
    privateKey: await crypto.subtle.exportKey('jwk', spk.privateKey),
    publicKey: await crypto.subtle.exportKey('jwk', spk.publicKey),
    publicKeyBase64: spk.publicKeyBase64,
    signature: spk.signature,
    createdAt: spk.createdAt,
  }
}

async function rotateClinicVaultSPK(
  clinicId: string,
  vaultKeys: VaultPrivateKeys,
  vaultRow: VaultDeviceKeysRow
): Promise<void> {
  if (!cachedClinicVaultKey) return

  // Only rotate if current SPK is old enough — vault messages must remain
  // decryptable across logins, so frequent rotation is destructive.
  const spkAge = Date.now() - new Date(vaultKeys.signedPreKey.createdAt).getTime()
  if (spkAge < SPK_ROTATION_MIN_AGE_MS) return

  try {
    const newSpkPair = await generateDhPair()
    const newSpkPubBase64 = await exportPubKey(newSpkPair.publicKey, 'raw')
    const spkPubBytes = base64ToUint8(newSpkPubBase64)
    const newSpkSignature = await signBytes(vaultKeys.signingPrivateKey, spkPubBytes)
    const newSpkId = vaultKeys.signedPreKey.keyId + 1

    // Retain the outgoing SPK so vault messages encrypted with it remain decryptable.
    // Prune previous SPKs older than the retention window.
    const retainedPrevious = vaultKeys.previousSignedPreKeys.filter(
      spk => Date.now() - new Date(spk.createdAt).getTime() < SPK_RETENTION_MAX_AGE_MS
    )
    const allPrevious = [
      ...await Promise.all(retainedPrevious.map(exportSignedPreKey)),
      await exportSignedPreKey(vaultKeys.signedPreKey),
    ]

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
      previousSignedPreKeys: allPrevious,
      preKeys: await Promise.all(vaultKeys.preKeys.map(async pk => ({
        keyId: pk.keyId,
        privateKey: await crypto.subtle.exportKey('jwk', pk.privateKey),
        publicKey: await crypto.subtle.exportKey('jwk', pk.publicKey),
        publicKeyBase64: pk.publicKeyBase64,
      }))),
      nextPreKeyId: vaultKeys.nextPreKeyId,
    }

    const salt = hexToBytes(vaultRow.salt)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ptBytes = new TextEncoder().encode(JSON.stringify(updatedBlob))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cachedClinicVaultKey, ptBytes)

    const { data: rotateData, error: rotateError } = await supabase.from('vault_device_keys').update({
      encrypted_blob: uint8ToBase64(new Uint8Array(ciphertext)),
      iv: uint8ToBase64(iv),
      version: vaultRow.version + 1,
      updated_at: new Date().toISOString(),
    }).eq('user_id', clinicId).eq('version', vaultRow.version).select('user_id')

    if (rotateError || !rotateData?.length) {
      logger.warn('Clinic vault SPK update conflict — another device won the race, skipping')
      return
    }

    // Update public bundle
    const publicBundle: PublicKeyBundle = {
      userId: clinicId,
      deviceId: CLINIC_VAULT_DEVICE_ID,
      identitySigningKey: vaultKeys.signingPublicKeyBase64,
      identityDhKey: vaultKeys.dhPublicKeyBase64,
      signedPreKey: { keyId: newSpkId, publicKey: newSpkPubBase64, signature: newSpkSignature },
      oneTimePreKeys: vaultKeys.preKeys.map(pk => ({ keyId: pk.keyId, publicKey: pk.publicKeyBase64 })),
    }
    await uploadKeyBundle(publicBundle)

    logger.info(`Clinic vault SPK rotated (${vaultKeys.signedPreKey.keyId} → ${newSpkId}, retained ${allPrevious.length} previous)`)
  } catch (e) {
    logger.warn('Failed to rotate clinic vault SPK:', e)
  }
}
