import { aesGcmEncrypt, aesGcmDecrypt } from '../aesGcm'
import { bytesToBase64, base64ToBytes } from '../base64Utils'
import { getDb } from './keyStore'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('GroupNameCrypto')

const ENC_PREFIX = 'genc:'
const enc = new TextEncoder()

// ---- Group Secret IDB helpers ----

/** Retrieve the stored random secret for a group, or null if absent. */
export async function getGroupSecret(groupId: string): Promise<string | null> {
  try {
    const db = await getDb()
    const row = await db.get('groupSecrets', groupId)
    return row?.secret ?? null
  } catch (err) {
    logger.warn('Failed to load group secret:', err)
    return null
  }
}

/** Persist a group secret. */
export async function setGroupSecret(groupId: string, secret: string): Promise<void> {
  try {
    const db = await getDb()
    await db.put('groupSecrets', { groupId, secret }, groupId)
  } catch (err) {
    logger.warn('Failed to save group secret:', err)
  }
}

/** Generate a fresh 256-bit group secret and return it as base64. */
export function generateGroupSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytesToBase64(bytes)
}

// ---- Key derivation ----

/**
 * Derive an AES-256-GCM key from a secret string.
 * When secret is the group's stored random bytes, the server cannot
 * reconstruct the key (it only sees the public groupId).
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('adtmc-group-name-v1'),
      info: enc.encode('group-name-encryption'),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Load the group secret from IDB and derive the AES key.
 * Falls back to the legacy groupId-based derivation for groups created
 * before secrets were introduced (backward compat during migration).
 */
async function resolveKey(groupId: string): Promise<CryptoKey> {
  const secret = await getGroupSecret(groupId)
  if (secret) {
    return deriveKey(secret)
  }
  // Legacy fallback: derive from the public groupId (existing groups)
  logger.warn(`No group secret found for ${groupId} — falling back to legacy groupId derivation`)
  return deriveKey(groupId)
}

// ---- Public API ----

export async function encryptGroupName(groupId: string, name: string): Promise<string> {
  const key = await resolveKey(groupId)
  const combined = await aesGcmEncrypt(key, enc.encode(name))
  return ENC_PREFIX + bytesToBase64(combined)
}

export async function decryptGroupName(groupId: string, encryptedName: string): Promise<string> {
  if (!encryptedName.startsWith(ENC_PREFIX)) return encryptedName
  try {
    const combined = base64ToBytes(encryptedName.slice(ENC_PREFIX.length))
    const key = await resolveKey(groupId)
    const plain = await aesGcmDecrypt(key, combined)
    return new TextDecoder().decode(plain)
  } catch {
    return encryptedName
  }
}
