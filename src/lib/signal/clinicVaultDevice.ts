/**
 * Clinic Vault Device — Persistent Signal device for the clinic persona.
 *
 * The clinic is a "user" in the Signal infrastructure. Its vault device
 * (`device_id = 'vault'`) is the canonical store for all clinic-wide
 * messages (calendar events, property, announcements).
 *
 * Key differences from personal vault (vaultDevice.ts):
 * - Wrapping key derived from clinic's `encryption_key` (shared among members)
 *   instead of a user password.
 * - Provisioned once per clinic, never deleted unless clinic is deleted.
 * - Any authenticated clinic member can process vault messages on login.
 * - Member fan-out copies use personal recipient_id; vault copy uses clinic_id.
 *
 * Security model:
 * - Vault private keys wrapped with PBKDF2(encryption_key, salt, 600K iterations)
 * - Same ECDSA signing + ECDH identity as personal vault
 * - X3DH + Double Ratchet for message encryption (standard Signal Protocol)
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
import { isCalendarEvent, routeCalendarEvent, initCalendarTombstones } from '../calendarRouting'
import type { CalendarEventContent } from './messageContent'
import { parseMessageContent } from './messageContent'
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

/**
 * Ensure a clinic vault device exists. If not, create one.
 * Idempotent — safe to call on every login. Any clinic member can provision.
 */
export async function ensureClinicVaultExists(
  clinicId: string,
  encryptionKey: string,
): Promise<Result<void>> {
  const { data } = await supabase
    .from('vault_device_keys')
    .select('user_id')
    .eq('user_id', clinicId)
    .maybeSingle()

  if (data) {
    // Keys already exist — ensure device is registered in user_devices.
    // Handles the edge case where vault_device_keys was provisioned but
    // the user_devices row was subsequently lost (e.g. partial DB cleanup).
    // registerDevice is idempotent (upsert), so safe to call every login.
    await registerDevice(clinicId, CLINIC_VAULT_DEVICE_ID, 'Clinic Vault')
    return ok(undefined)
  }

  logger.info('Provisioning clinic vault device')

  // Generate full X3DH identity for the clinic vault
  const [signingPair, dhPair] = await Promise.all([
    generateSigningPair(),
    generateDhPair(),
  ])
  const [signingPubBase64, dhPubBase64] = await Promise.all([
    exportPubKey(signingPair.publicKey, 'spki'),
    exportPubKey(dhPair.publicKey, 'raw'),
  ])

  // Signed pre-key
  const spkPair = await generateDhPair()
  const spkPubBase64 = await exportPubKey(spkPair.publicKey, 'raw')
  const spkSignature = await signBytes(signingPair.privateKey, base64ToUint8(spkPubBase64))

  // One-time pre-keys
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

  // Build plaintext blob
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

  // Encrypt blob with clinic's encryption_key
  const { encryptedBlob, salt, iv } = await encryptBlob(blob, encryptionKey)

  // Store encrypted vault blob
  const { error: vaultError } = await supabase
    .from('vault_device_keys')
    .upsert({
      user_id: clinicId,
      encrypted_blob: encryptedBlob,
      salt,
      iv,
      kdf_iterations: KDF_ITERATIONS,
      version: 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (vaultError) {
    logger.error('Failed to store clinic vault keys:', vaultError)
    return err(vaultError.message)
  }

  // Upload public bundle
  const publicBundle: PublicKeyBundle = {
    userId: clinicId,
    deviceId: CLINIC_VAULT_DEVICE_ID,
    identitySigningKey: signingPubBase64,
    identityDhKey: dhPubBase64,
    signedPreKey: { keyId: 1, publicKey: spkPubBase64, signature: spkSignature },
    oneTimePreKeys: preKeys.map(pk => ({ keyId: pk.keyId, publicKey: pk.publicKeyBase64 })),
  }

  const uploadResult = await uploadKeyBundle(publicBundle)
  if (!uploadResult.ok) return uploadResult

  // Register vault device
  await registerDevice(clinicId, CLINIC_VAULT_DEVICE_ID, 'Clinic Vault')

  logger.info('Clinic vault device provisioned')
  return ok(undefined)
}

/**
 * Process unread messages addressed to the clinic vault device.
 *
 * Called on login after personal vault processing. Mirrors the
 * personal processVaultMessages flow but uses the clinic's
 * encryption_key as the wrapping key.
 */
export async function processClinicVaultMessages(clinicId: string): Promise<number> {
  // 0. Ensure tombstones are loaded so routeCalendarEvent can guard against resurrecting deleted events.
  // This runs before React hooks (useCalendarSync) so the in-memory set must be warm.
  await initCalendarTombstones()

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

  // 3. Fetch unread vault messages
  const { data: rows, error: fetchError } = await supabase
    .from('signal_messages')
    .select('*')
    .eq('recipient_id', clinicId)
    .eq('recipient_device_id', CLINIC_VAULT_DEVICE_ID)
    .order('created_at', { ascending: true })

  if (fetchError || !rows || rows.length === 0) {
    if (fetchError) logger.warn('Failed to fetch clinic vault messages:', fetchError)
    else logger.info('No pending clinic vault messages')
    await rotateClinicVaultSPK(clinicId, vaultKeys, vaultRow as VaultDeviceKeysRow)
    return 0
  }

  logger.info(`Processing ${rows.length} clinic vault messages`)

  // 4. Batch decrypt with ephemeral session map
  const sessionMap = new Map<string, { state: RatchetState; ad: Uint8Array }>()
  const processedIds: string[] = []
  let processedCount = 0
  const consumedOtpIds = new Set<number>()
  const calendarRoutes: CalendarEventContent[] = []

  for (const row of rows as SignalMessageRow[]) {
    try {
      const envelope = row.payload as unknown as SealedEnvelope
      const senderDeviceId = row.sender_device_id ?? 'unknown'

      // Unseal with vault's DH keys
      const { inner, senderUuid } = await unseal(
        envelope,
        clinicId,
        vaultKeys.dhPrivateKey,
        vaultKeys.dhPublicKeyBase64,
        { skipExpiry: true }
      )

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
          processedIds.push(row.id)
          continue
        }

        const spkPair = {
          publicKey: matchedSpk.publicKey,
          privateKey: matchedSpk.privateKey,
        }

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

        const x3dh = await x3dhRespond(
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
          processedIds.push(row.id)
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
        calendarRoutes.push(content)
      }

      processedIds.push(row.id)
      processedCount++
    } catch (e) {
      logger.error(`Failed to process clinic vault message ${row.id}:`, e instanceof Error ? e.message : e)
    }
  }

  // 5. Route calendar events with delete-awareness.
  // Delete messages no longer fan out to the vault (useCalendarVault filters them),
  // so this pre-scan is dead code for new messages. Kept for backward compat with
  // any legacy 'd' messages already in the vault store.
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

  // 6. Rotate SPK and replenish OTPs
  await rotateClinicVaultSPK(clinicId, vaultKeys, vaultRow as VaultDeviceKeysRow)
  if (consumedOtpIds.size > 0) {
    await replenishClinicVaultPreKeys(clinicId, vaultKeys, consumedOtpIds, vaultRow as VaultDeviceKeysRow)
  }

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

async function replenishClinicVaultPreKeys(
  clinicId: string,
  vaultKeys: VaultPrivateKeys,
  consumedIds: Set<number>,
  vaultRow: VaultDeviceKeysRow
): Promise<void> {
  if (!cachedClinicVaultKey) return

  try {
    // Generate replacements for consumed keys
    const newPreKeys: VaultBlobPlaintext['preKeys'] = []
    let nextId = vaultKeys.nextPreKeyId

    for (let i = 0; i < consumedIds.size; i++) {
      const pair = await generateDhPair()
      const pubBase64 = await exportPubKey(pair.publicKey, 'raw')
      newPreKeys.push({
        keyId: nextId++,
        privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
        publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
        publicKeyBase64: pubBase64,
      })
    }

    // Merge: keep unconsumed + add new
    const survivingPreKeys = await Promise.all(
      vaultKeys.preKeys
        .filter(pk => !consumedIds.has(pk.keyId))
        .map(async pk => ({
          keyId: pk.keyId,
          privateKey: await crypto.subtle.exportKey('jwk', pk.privateKey),
          publicKey: await crypto.subtle.exportKey('jwk', pk.publicKey),
          publicKeyBase64: pk.publicKeyBase64,
        }))
    )

    const allPreKeys = [...survivingPreKeys, ...newPreKeys]

    const updatedBlob: VaultBlobPlaintext = {
      signingPrivateKey: await crypto.subtle.exportKey('jwk', vaultKeys.signingPrivateKey),
      signingPublicKey: await crypto.subtle.exportKey('jwk', vaultKeys.signingPublicKey),
      dhPrivateKey: await crypto.subtle.exportKey('jwk', vaultKeys.dhPrivateKey),
      dhPublicKey: await crypto.subtle.exportKey('jwk', vaultKeys.dhPublicKey),
      signingPublicKeyBase64: vaultKeys.signingPublicKeyBase64,
      dhPublicKeyBase64: vaultKeys.dhPublicKeyBase64,
      signedPreKey: await exportSignedPreKey(vaultKeys.signedPreKey),
      previousSignedPreKeys: await Promise.all(
        vaultKeys.previousSignedPreKeys.map(exportSignedPreKey)
      ),
      preKeys: allPreKeys,
      nextPreKeyId: nextId,
    }

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ptBytes = new TextEncoder().encode(JSON.stringify(updatedBlob))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cachedClinicVaultKey, ptBytes)

    const { data: replenishData, error: replenishError } = await supabase.from('vault_device_keys').update({
      encrypted_blob: uint8ToBase64(new Uint8Array(ciphertext)),
      iv: uint8ToBase64(iv),
      version: vaultRow.version + 1,
      updated_at: new Date().toISOString(),
    }).eq('user_id', clinicId).eq('version', vaultRow.version).select('user_id')

    if (replenishError || !replenishData?.length) {
      logger.warn('Clinic vault pre-key update conflict — another device won the race, skipping')
      return
    }

    // Update public bundle with surviving + new OTPs
    const publicBundle: PublicKeyBundle = {
      userId: clinicId,
      deviceId: CLINIC_VAULT_DEVICE_ID,
      identitySigningKey: vaultKeys.signingPublicKeyBase64,
      identityDhKey: vaultKeys.dhPublicKeyBase64,
      signedPreKey: {
        keyId: vaultKeys.signedPreKey.keyId,
        publicKey: vaultKeys.signedPreKey.publicKeyBase64,
        signature: vaultKeys.signedPreKey.signature,
      },
      oneTimePreKeys: allPreKeys.map(pk => ({ keyId: pk.keyId, publicKey: pk.publicKeyBase64 })),
    }
    await uploadKeyBundle(publicBundle)

    logger.info(`Replenished ${newPreKeys.length} clinic vault pre-keys`)
  } catch (e) {
    logger.warn('Failed to replenish clinic vault pre-keys:', e)
  }
}
