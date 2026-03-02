/**
 * Server-side encrypted message backup.
 *
 * Crypto flow:
 *   password + random salt --> PBKDF2(600k, SHA-256) --> AES-256-GCM key
 *   messages --> JSON --> pako.deflateRaw --> AES-256-GCM encrypt --> Supabase
 *
 * One backup row per user. Primary device creates/updates.
 * Non-primary devices restore from it on login.
 */

import { deflateRaw, inflateRaw } from 'pako'
import { supabase } from '../supabase'
import { SIGNAL } from '../constants'
import { createLogger } from '../../Utilities/Logger'
import { saveMessage, setOnMessageSaved, loadAllConversations } from './messageStore'
import type { StoredMessage } from './messageStore'

const logger = createLogger('BackupService')

// ---- Module-level state ----

let _backupPassword: string | null = null
let _backupTimer: ReturnType<typeof setTimeout> | null = null

// ---- Password management ----

/** Cache the raw password in JS heap for backup encryption (never persisted). */
export function setBackupPassword(pw: string): void {
  _backupPassword = pw
}

/** Wipe cached password (called on sign-out). */
export function clearBackupPassword(): void {
  _backupPassword = null
  if (_backupTimer) {
    clearTimeout(_backupTimer)
    _backupTimer = null
  }
}

// ---- Crypto helpers ----

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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

async function encrypt(data: Uint8Array, password: string): Promise<{ salt: string; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const key = await deriveKey(password, salt)
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

async function decrypt(ciphertextB64: string, saltB64: string, password: string): Promise<Uint8Array> {
  const salt = base64ToBytes(saltB64)
  const combined = base64ToBytes(ciphertextB64)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const key = await deriveKey(password, salt)
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
  if (!_backupPassword) {
    logger.warn('No backup password cached, skipping backup')
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

    const { salt, ciphertext } = await encrypt(compressed, _backupPassword)

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
  if (!_backupPassword) {
    logger.warn('No backup password cached, skipping restore')
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

    const compressed = await decrypt(data.ciphertext, data.salt, _backupPassword)
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
