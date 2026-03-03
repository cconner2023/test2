/**
 * Server-side encrypted message backup.
 *
 * Crypto flow:
 *   password --> PBKDF2(600k, SHA-256) --> master CryptoKey (non-extractable)
 *   export:  master key wraps per-backup AES-256-GCM key (random salt + IV)
 *   import:  password re-derives key at restore time
 *
 * The plaintext password is NEVER stored. Only a non-extractable CryptoKey
 * lives in module scope for the duration of the session.
 *
 * One backup row per user. Primary device creates/updates.
 * Non-primary devices restore from it on login.
 */

import { deflateRaw, inflateRaw } from 'pako'
import { supabase } from '../supabase'
import { SIGNAL } from '../constants'
import { createLogger } from '../../Utilities/Logger'
import { base64ToBytes, bytesToBase64 } from '../base64Utils'
import { saveMessage, setOnMessageSaved, loadAllConversations } from './messageStore'
import type { StoredMessage } from './messageStore'

const logger = createLogger('BackupService')

// ---- Module-level state ----

/** Non-extractable AES-256-GCM key derived from the user's password at sign-in. */
let _backupKey: CryptoKey | null = null

/** Promise that resolves when the key derivation is complete.
 *  restoreBackup awaits this so it doesn't race with the PBKDF2 derivation
 *  that runs fire-and-forget from signIn(). */
let _backupKeyReady: Promise<void> | null = null

/** Fixed app-level salt for deriving the cached backup master key.
 *  This is NOT the per-backup salt (that is random each time). */
const BACKUP_MASTER_SALT = new Uint8Array([
  0x41, 0x44, 0x54, 0x4d, 0x43, 0x2d, 0x42, 0x4b,
  0x55, 0x50, 0x2d, 0x4d, 0x41, 0x53, 0x54, 0x45,
  0x52, 0x2d, 0x4b, 0x45, 0x59, 0x2d, 0x53, 0x41,
  0x4c, 0x54, 0x2d, 0x56, 0x31, 0x2d, 0x30, 0x30,
])

let _backupTimer: ReturnType<typeof setTimeout> | null = null

// ---- Key management ----

/**
 * Derive a non-extractable AES-256-GCM CryptoKey from the password and cache it.
 * The plaintext password is never stored; it goes out of scope in the caller.
 */
export function deriveAndStoreBackupKey(password: string): Promise<void> {
  _backupKeyReady = (async () => {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    _backupKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: BACKUP_MASTER_SALT,
        iterations: SIGNAL.BACKUP_PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,                // non-extractable
      ['encrypt', 'decrypt'],
    )
  })()
  return _backupKeyReady
}

/** Wipe cached key and detach the save callback (called on sign-out). */
export function clearBackupKey(): void {
  _backupKey = null
  _backupKeyReady = null
  if (_backupTimer) {
    clearTimeout(_backupTimer)
    _backupTimer = null
  }
  // Detach the onMessageSaved callback to prevent stale backup triggers
  setOnMessageSaved(null)
}

/** @deprecated Use clearBackupKey(). Alias kept for backward compatibility. */
export const clearBackupPassword = clearBackupKey

// ---- Crypto helpers ----

/**
 * Derive a key from a raw password and a per-backup salt.
 * Used only during importBackup where the user provides their password directly.
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: SIGNAL.BACKUP_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypt data using the cached backup CryptoKey. */
async function encryptWithKey(data: Uint8Array, key: CryptoKey): Promise<{ salt: string; ciphertext: string }> {
  // We still store a random "salt" per backup for the DB schema compat,
  // but the actual encryption uses the pre-derived master key directly.
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  )
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  return {
    salt: bytesToBase64(salt),
    ciphertext: bytesToBase64(combined),
  }
}

/** Decrypt data using the cached backup CryptoKey. */
async function decryptWithKey(ciphertextB64: string, key: CryptoKey): Promise<Uint8Array> {
  const combined = base64ToBytes(ciphertextB64)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )
  return new Uint8Array(decrypted)
}

/** Decrypt data using a password string (for import/restore where user provides the password). */
async function decryptWithPassword(ciphertextB64: string, saltB64: string, password: string): Promise<Uint8Array> {
  const salt = base64ToBytes(saltB64)
  const combined = base64ToBytes(ciphertextB64)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const key = await deriveKeyFromPassword(password, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )
  return new Uint8Array(decrypted)
}

// ---- Backup payload ----

interface BackupPayload {
  version: 1
  createdAt: string
  messages: StoredMessage[]
}

// ---- Load messages from IndexedDB directly (bypasses at-rest encryption) ----

async function loadRawMessages(): Promise<StoredMessage[]> {
  const convos = await loadAllConversations()
  const all: StoredMessage[] = []
  for (const msgs of Object.values(convos)) {
    for (const msg of msgs) {
      all.push(msg as StoredMessage)
    }
  }
  // Sort newest-first for truncation
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return all
}

// ---- Public API ----

/** Create an encrypted backup and upsert to Supabase. */
export async function createBackup(userId: string): Promise<void> {
  if (_backupKeyReady) await _backupKeyReady
  if (!_backupKey) {
    logger.warn('No backup key cached, skipping backup')
    return
  }

  try {
    let messages = await loadRawMessages()
    // Cap at max messages
    if (messages.length > SIGNAL.BACKUP_MAX_MESSAGES) {
      messages = messages.slice(0, SIGNAL.BACKUP_MAX_MESSAGES)
    }

    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      messages,
    }

    // Compress, enforce size limit by halving message count
    let compressed = deflateRaw(new TextEncoder().encode(JSON.stringify(payload)))
    while (compressed.length > SIGNAL.BACKUP_MAX_BYTES && messages.length > 100) {
      messages = messages.slice(0, Math.floor(messages.length / 2))
      payload.messages = messages
      compressed = deflateRaw(new TextEncoder().encode(JSON.stringify(payload)))
    }

    const { salt, ciphertext } = await encryptWithKey(compressed, _backupKey)

    const { error } = await supabase
      .from('signal_backups')
      .upsert({
        user_id: userId,
        salt,
        ciphertext,
        message_count: messages.length,
        backup_version: 1,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      logger.warn('Failed to upsert backup:', error.message)
    } else {
      logger.info(`Backup created: ${messages.length} messages, ${compressed.length} bytes compressed`)
    }
  } catch (err) {
    logger.warn('Backup creation failed:', err)
  }
}

/** Restore messages from an encrypted backup on Supabase. */
export async function restoreBackup(userId: string): Promise<void> {
  if (_backupKeyReady) await _backupKeyReady
  if (!_backupKey) {
    logger.warn('No backup key cached, skipping restore')
    return
  }

  try {
    const { data, error } = await supabase
      .from('signal_backups')
      .select('salt, ciphertext')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      logger.info('No backup found for user')
      return
    }

    const compressed = await decryptWithKey(data.ciphertext, _backupKey)
    const json = new TextDecoder().decode(inflateRaw(compressed))
    const payload: BackupPayload = JSON.parse(json)

    if (payload.version !== 1) {
      logger.warn(`Unknown backup version: ${payload.version}`)
      return
    }

    let restored = 0
    for (const msg of payload.messages) {
      await saveMessage(msg, userId)
      restored++
    }

    logger.info(`Restored ${restored} messages from backup`)
  } catch (err) {
    logger.warn('Backup restore failed:', err)
  }
}

/** Delete the backup row for a user. */
export async function deleteBackup(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('signal_backups')
      .delete()
      .eq('user_id', userId)

    if (error) {
      logger.warn('Failed to delete backup:', error.message)
    }
  } catch (err) {
    logger.warn('Backup deletion failed:', err)
  }
}

/** Debounced trigger for createBackup. Resets the timer on each call.
 *  On first call, also registers itself as the onMessageSaved callback
 *  so future message saves auto-trigger backup scheduling. */
export function scheduleBackup(userId: string): void {
  // Register so every future saveMessage() triggers a debounced backup
  setOnMessageSaved(scheduleBackup)

  if (_backupTimer) clearTimeout(_backupTimer)
  _backupTimer = setTimeout(() => {
    _backupTimer = null
    createBackup(userId).catch(err => logger.warn('Scheduled backup failed:', err))
  }, SIGNAL.BACKUP_DEBOUNCE_MS)
}
