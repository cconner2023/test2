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
import { saveMessage, deleteMessagesByOriginId } from './messageStore'
import { parseMessageContent } from './messageContent'
import type { PublicKeyBundle, InitialMessage, EncryptedMessage, RatchetState, RatchetKeyPair } from './types'
import type { DecryptedSignalMessage, SignalMessageRow, SyncMessagePayload } from './transportTypes'
import type { SealedEnvelope } from './sealedSender'

const logger = createLogger('VaultDevice')

// ---- Constants ----

export const VAULT_DEVICE_ID = 'vault'
const VAULT_KDF_ITERATIONS = 600_000
const VAULT_PREKEY_BATCH_SIZE = 500

// ---- Types ----

interface VaultDeviceKeysRow {
  user_id: string
  encrypted_blob: string
  salt: string
  iv: string
  kdf_iterations: number
  version: number
}

/** Plaintext vault blob — all private keys in JWK format. */
interface VaultBlobPlaintext {
  signingPrivateKey: JsonWebKey
  signingPublicKey: JsonWebKey
  dhPrivateKey: JsonWebKey
  dhPublicKey: JsonWebKey
  signingPublicKeyBase64: string
  dhPublicKeyBase64: string
  signedPreKey: {
    keyId: number
    privateKey: JsonWebKey
    publicKey: JsonWebKey
    publicKeyBase64: string
    signature: string
    createdAt: string
  }
  preKeys: Array<{
    keyId: number
    privateKey: JsonWebKey
    publicKey: JsonWebKey
    publicKeyBase64: string
  }>
  nextPreKeyId: number
}

/** Recovered vault keys with CryptoKey objects ready for use. */
interface VaultPrivateKeys {
  signingPrivateKey: CryptoKey
  signingPublicKey: CryptoKey
  dhPrivateKey: CryptoKey
  dhPublicKey: CryptoKey
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

interface VaultKeyBundle {
  encryptedBlob: string
  salt: string
  iv: string
  publicBundle: PublicKeyBundle
}

// ---- Module-level cached vault wrapping key ----

let cachedVaultKey: CryptoKey | null = null

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
  salt?: string,
  iterations?: number
): Promise<void> {
  // If salt not provided, fetch from vault_device_keys
  let saltHex = salt
  let iters = iterations ?? VAULT_KDF_ITERATIONS

  if (!saltHex) {
    const { data } = await supabase
      .from('vault_device_keys')
      .select('salt, kdf_iterations')
      .single()

    if (!data) {
      // No vault exists yet — nothing to cache
      return
    }
    saltHex = data.salt
    iters = data.kdf_iterations
  }

  const saltBytes = hexToBytes(saltHex)
  cachedVaultKey = await deriveWrappingKey(password, saltBytes, iters)
  logger.info('Vault wrapping key cached')
}

/** Clear cached vault key (called on sign-out). */
export function clearVaultKey(): void {
  cachedVaultKey = null
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

  const spk = blob.signedPreKey
  const [spkPriv, spkPub] = await Promise.all([
    crypto.subtle.importKey('jwk', spk.privateKey,
      { name: 'ECDH', namedCurve: SIGNAL.CURVE }, true, ['deriveKey', 'deriveBits']),
    crypto.subtle.importKey('jwk', spk.publicKey,
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
      keyId: spk.keyId,
      privateKey: spkPriv,
      publicKey: spkPub,
      publicKeyBase64: spk.publicKeyBase64,
      signature: spk.signature,
      createdAt: spk.createdAt,
    },
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

// ---- Vault Message Processing ----

/**
 * Fetch and decrypt all pending vault messages for this user.
 * Saves decrypted messages to local messageStore.
 * Returns the count of processed messages.
 */
export async function processVaultMessages(userId: string): Promise<number> {
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

  if (!cachedVaultKey) {
    logger.warn('Vault wrapping key not cached — cannot process vault messages')
    return 0
  }

  // 2. Recover vault keys
  let vaultKeys: VaultPrivateKeys
  try {
    vaultKeys = await recoverVaultKeys(vaultRow as VaultDeviceKeysRow)
  } catch (e) {
    logger.error('Failed to recover vault keys (password changed?):', e)
    // Password reset scenario: delete old vault, fresh one will be created
    await supabase.from('vault_device_keys').delete().eq('user_id', userId)
    await supabase.from('signal_key_bundles').delete()
      .eq('user_id', userId).eq('device_id', VAULT_DEVICE_ID)
    await supabase.from('user_devices').delete()
      .eq('user_id', userId).eq('device_id', VAULT_DEVICE_ID)
    return 0
  }

  // 3. Fetch unread vault messages
  const { data: rows, error: fetchError } = await supabase
    .from('signal_messages')
    .select('*')
    .eq('recipient_id', userId)
    .eq('recipient_device_id', VAULT_DEVICE_ID)
    .is('read_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

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

        // Find the vault signed pre-key
        const spkPair = {
          publicKey: vaultKeys.signedPreKey.publicKey,
          privateKey: vaultKeys.signedPreKey.privateKey,
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

        // Initialize receiver ratchet
        const ratchetState = await initReceiver(x3dh.sharedSecret, {
          publicKey: vaultKeys.signedPreKey.publicKey,
          privateKey: vaultKeys.signedPreKey.privateKey,
          publicKeyBase64: vaultKeys.signedPreKey.publicKeyBase64,
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
          logger.warn(`No vault session for ${sessionKey} — skipping message ${row.id}`)
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
        await saveMessage(syncMsg.id, senderUuid, syncMsg)
      } else if (row.message_type === 'delete') {
        try {
          const { originIds } = JSON.parse(plaintext) as { originIds: string[] }
          await deleteMessagesByOriginId(originIds)
        } catch { /* ignore parse errors */ }
      } else {
        const msg: DecryptedSignalMessage = {
          id: row.id,
          senderId: senderUuid,
          recipientId: row.recipient_id,
          plaintext: displayText,
          content,
          messageType: row.message_type,
          createdAt: row.created_at,
          readAt: null,
          ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
          ...(row.group_id && { groupId: row.group_id }),
          originId: row.origin_id ?? undefined,
        }
        await saveMessage(msg.id, senderUuid, msg)
      }

      processedIds.push(row.id)
      processedCount++
    } catch (e) {
      logger.error(`Failed to process vault message ${row.id}:`, e instanceof Error ? e.message : e)
    }
  }

  // 6. Mark processed vault messages as read
  if (processedIds.length > 0) {
    await supabase
      .from('signal_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', processedIds)
  }

  // 7. Rotate vault signed pre-key and replenish OTPs
  await rotateVaultSignedPreKey(userId, vaultKeys, vaultRow as VaultDeviceKeysRow)

  // 8. Replenish consumed OTPs
  if (consumedOtpIds.size > 0) {
    await replenishVaultPreKeys(userId, vaultKeys, consumedOtpIds, vaultRow as VaultDeviceKeysRow)
  }

  logger.info(`Processed ${processedCount} vault messages`)
  return processedCount
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

    // Update vault_device_keys
    await supabase
      .from('vault_device_keys')
      .update({
        encrypted_blob: uint8ToBase64(new Uint8Array(ciphertext)),
        iv: uint8ToBase64(newIv),
        version: vaultRow.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

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

    await supabase
      .from('vault_device_keys')
      .update({
        encrypted_blob: uint8ToBase64(new Uint8Array(ciphertext)),
        iv: uint8ToBase64(newIv),
        version: latestRow.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

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

    // Update cached key
    cachedVaultKey = newWrappingKey

    logger.info('Vault keys re-encrypted with new password')
    return ok(undefined)
  } catch (e) {
    logger.error('Failed to re-encrypt vault keys:', e)
    return err(e instanceof Error ? e.message : 'Unknown error')
  }
}
