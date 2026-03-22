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
 * Any device creates/updates backups. All devices restore on login.
 */

import { deflateRaw, inflateRaw } from 'pako'
import { supabase } from '../supabase'
import { SIGNAL } from '../constants'
import { createLogger } from '../../Utilities/Logger'
import { base64ToBytes, bytesToBase64 } from '../base64Utils'
import { saveMessage, setOnMessageSaved, loadAllConversations } from './messageStore'
import { isCalendarEvent, routeCalendarEvent } from '../calendarRouting'
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
/** Timestamp of the first dirty event since last successful backup.
 *  Caps the debounce so active conversations don't postpone backups forever. */
let _firstDirtyAt: number | null = null
/** Periodic interval that fires backups independently of message saves. */
let _periodicTimer: ReturnType<typeof setInterval> | null = null
/** The userId bound to the current backup scheduler. */
let _scheduledUserId: string | null = null
/** Whether the pagehide listener has been registered. */
let _pagehideRegistered = false
/** Whether this device has completed initial IDB hydration.
 *  Prevents a fresh device from overwriting the backup before restoring. */
let _hydrationComplete = false

export function markHydrationComplete(): void {
  _hydrationComplete = true
}

/** Max time (ms) from first unsaved change before a backup is forced. */
const BACKUP_MAX_WAIT_MS = 30_000
/** Periodic backup interval (ms). */
const BACKUP_PERIODIC_MS = 60_000

// ---- IDB persistence for the non-extractable CryptoKey ----

const BACKUP_KEY_DB = 'adtmc-backup-key'
const BACKUP_KEY_STORE = 'keys'
const BACKUP_KEY_ID = 'master'
/** IDB key for the legacy salt-only derived key, kept until migration succeeds. */
const BACKUP_KEY_LEGACY_ID = 'master-legacy'

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BACKUP_KEY_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(BACKUP_KEY_STORE)) {
        req.result.createObjectStore(BACKUP_KEY_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function persistKeyToIdb(key: CryptoKey): Promise<void> {
  const db = await openKeyDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_KEY_STORE, 'readwrite')
    tx.objectStore(BACKUP_KEY_STORE).put(key, BACKUP_KEY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadKeyFromIdb(): Promise<CryptoKey | null> {
  const db = await openKeyDb()
  const key = await new Promise<CryptoKey | null>((resolve, reject) => {
    const tx = db.transaction(BACKUP_KEY_STORE, 'readonly')
    const req = tx.objectStore(BACKUP_KEY_STORE).get(BACKUP_KEY_ID)
    req.onsuccess = () => resolve((req.result as CryptoKey) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return key
}

async function clearKeyFromIdb(): Promise<void> {
  const db = await openKeyDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_KEY_STORE, 'readwrite')
    const store = tx.objectStore(BACKUP_KEY_STORE)
    store.delete(BACKUP_KEY_ID)
    store.delete(BACKUP_KEY_LEGACY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function persistLegacyKeyToIdb(key: CryptoKey): Promise<void> {
  const db = await openKeyDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_KEY_STORE, 'readwrite')
    tx.objectStore(BACKUP_KEY_STORE).put(key, BACKUP_KEY_LEGACY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadLegacyKeyFromIdb(): Promise<CryptoKey | null> {
  const db = await openKeyDb()
  const key = await new Promise<CryptoKey | null>((resolve, reject) => {
    const tx = db.transaction(BACKUP_KEY_STORE, 'readonly')
    const req = tx.objectStore(BACKUP_KEY_STORE).get(BACKUP_KEY_LEGACY_ID)
    req.onsuccess = () => resolve((req.result as CryptoKey) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return key
}

async function clearLegacyKeyFromIdb(): Promise<void> {
  const db = await openKeyDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_KEY_STORE, 'readwrite')
    tx.objectStore(BACKUP_KEY_STORE).delete(BACKUP_KEY_LEGACY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// ---- Key management ----

/**
 * Derive a non-extractable AES-256-GCM CryptoKey from the password and cache it.
 * The plaintext password is never stored; it goes out of scope in the caller.
 * The derived CryptoKey is persisted to IndexedDB so it survives page refreshes.
 *
 * The userId is mixed into the salt so different users with the same password
 * derive distinct keys. The fixed BACKUP_MASTER_SALT is preserved as a prefix
 * for backward-compatibility detection in restoreBackup.
 */
export function deriveAndStoreBackupKey(password: string, userId: string): Promise<void> {
  _backupKeyReady = (async () => {
    const enc = new TextEncoder()

    // Per-user salt: fixed prefix + userId bytes
    const userSaltBytes = enc.encode(userId)
    const combinedSalt = new Uint8Array(BACKUP_MASTER_SALT.length + userSaltBytes.length)
    combinedSalt.set(BACKUP_MASTER_SALT)
    combinedSalt.set(userSaltBytes, BACKUP_MASTER_SALT.length)

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
        salt: combinedSalt as BufferSource,
        iterations: SIGNAL.BACKUP_PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,                // non-extractable
      ['encrypt', 'decrypt'],
    )
    persistKeyToIdb(_backupKey).catch(() =>
      logger.warn('Failed to persist backup key to IDB')
    )
    // Also derive and persist the legacy key (no userId) so restoreBackup can
    // fall back to it when decrypting backups created before this change.
    deriveLegacyBackupKey(password).then(legacyKey =>
      persistLegacyKeyToIdb(legacyKey).catch(() =>
        logger.warn('Failed to persist legacy backup key to IDB')
      )
    ).catch(() => {})
  })()
  return _backupKeyReady
}

/**
 * Derive a legacy backup key using only the fixed BACKUP_MASTER_SALT (no userId).
 * Used internally by restoreBackup to migrate existing backups to the new format.
 */
async function deriveLegacyBackupKey(password: string): Promise<CryptoKey> {
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
      salt: BACKUP_MASTER_SALT as BufferSource,
      iterations: SIGNAL.BACKUP_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Wipe cached key, detach callbacks, stop all timers (called on sign-out). */
export function clearBackupKey(): void {
  _backupKey = null
  _backupKeyReady = null
  _hydrationComplete = false
  _firstDirtyAt = null
  _scheduledUserId = null
  if (_backupTimer) {
    clearTimeout(_backupTimer)
    _backupTimer = null
  }
  if (_periodicTimer) {
    clearInterval(_periodicTimer)
    _periodicTimer = null
  }
  // Detach the onMessageSaved callback to prevent stale backup triggers
  setOnMessageSaved(null)
  clearKeyFromIdb().catch(() => {})
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
      salt: salt as BufferSource,
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
    data as BufferSource,
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
export async function decryptWithPassword(ciphertextB64: string, saltB64: string, password: string): Promise<Uint8Array> {
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

// ---- Internal flush helper ----

/** Run createBackup immediately, reset dirty tracking. */
async function flushBackup(userId: string): Promise<void> {
  _firstDirtyAt = null
  if (_backupTimer) {
    clearTimeout(_backupTimer)
    _backupTimer = null
  }
  await createBackup(userId)
}

// ---- Public API ----

/** Create an encrypted backup and upsert to Supabase. */
export async function createBackup(userId: string): Promise<void> {
  try { if (_backupKeyReady) await _backupKeyReady } catch { /* fall through to IDB */ }
  if (!_backupKey) {
    // Session restored without password (e.g. PWA reopen) — try IDB
    try {
      _backupKey = await loadKeyFromIdb()
    } catch { /* IDB unavailable */ }
  }
  if (!_backupKey) {
    logger.warn('No backup key cached, skipping backup')
    return
  }

  try {
    let messages = await loadRawMessages()
    if (messages.length === 0 && !_hydrationComplete) {
      logger.info('Skipping empty backup — hydration not yet complete')
      return
    }
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
  try { if (_backupKeyReady) await _backupKeyReady } catch { /* fall through to IDB */ }
  if (!_backupKey) {
    // Session restored without password (e.g. page refresh) — try IDB
    try {
      _backupKey = await loadKeyFromIdb()
    } catch { /* IDB unavailable */ }
  }
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

    // Try primary (per-user) key first, then fall back to legacy key.
    let compressed: Uint8Array
    let usedLegacyKey = false
    try {
      compressed = await decryptWithKey(data.ciphertext, _backupKey)
    } catch {
      // Primary key failed — attempt legacy key (backup encrypted before userId salt)
      const legacyKey = await loadLegacyKeyFromIdb().catch(() => null)
      if (!legacyKey) {
        logger.warn('Backup restore failed: primary key failed and no legacy key available')
        return
      }
      compressed = await decryptWithKey(data.ciphertext, legacyKey)
      usedLegacyKey = true
      logger.info('Restored backup using legacy key — will re-encrypt with current key')
    }

    const json = new TextDecoder().decode(inflateRaw(compressed))
    const payload: BackupPayload = JSON.parse(json)

    if (payload.version !== 1) {
      logger.warn(`Unknown backup version: ${payload.version}`)
      return
    }

    let restored = 0

    // Pre-scan: collect event IDs that have a delete action so we don't
    // resurrect them when replaying earlier create messages.
    const deletedEventIds = new Set<string>()
    for (const msg of payload.messages) {
      if (isCalendarEvent(msg.content) && msg.content.action === 'delete') {
        deletedEventIds.add(msg.content.data.id)
      }
    }

    for (const msg of payload.messages) {
      await saveMessage(msg, userId)
      // Route calendar events, but skip create/update for events that
      // were later deleted — prevents backup from resurrecting them.
      if (isCalendarEvent(msg.content)) {
        if (msg.content.action === 'delete' || !deletedEventIds.has(msg.content.data.id)) {
          routeCalendarEvent(msg.content)
        }
      }
      restored++
    }

    logger.info(`Restored ${restored} messages from backup`)

    if (restored > 0) {
      window.dispatchEvent(new CustomEvent('backup-restored'))
    }

    // Migration: re-encrypt with the current (per-user) key and clear legacy key slot.
    if (usedLegacyKey) {
      createBackup(userId).catch(() => {})
      clearLegacyKeyFromIdb().catch(() => {})
    }
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

/**
 * Schedule a backup with capped debounce + periodic fallback + pagehide flush.
 *
 * - Debounce: each message save resets a short timer, but a max-wait cap
 *   ensures a backup fires within BACKUP_MAX_WAIT_MS of the first change.
 * - Periodic: an interval fires every BACKUP_PERIODIC_MS regardless of
 *   message activity, so idle sessions still get fresh backups.
 * - Pagehide: best-effort flush before the page goes away.
 *
 * Any device can call this — not gated on primary role.
 */
export function scheduleBackup(userId: string): void {
  _scheduledUserId = userId

  // Register so every future saveMessage() triggers a debounced backup
  setOnMessageSaved(scheduleBackup)

  // Track when the first unsaved change happened
  if (_firstDirtyAt === null) {
    _firstDirtyAt = Date.now()
  }

  // If we've exceeded the max-wait cap, flush immediately
  const elapsed = Date.now() - _firstDirtyAt
  if (elapsed >= BACKUP_MAX_WAIT_MS) {
    flushBackup(userId).catch(err => logger.warn('Max-wait backup failed:', err))
    return
  }

  // Otherwise reset the debounce timer (capped to remaining max-wait time)
  if (_backupTimer) clearTimeout(_backupTimer)
  const delay = Math.min(SIGNAL.BACKUP_DEBOUNCE_MS, BACKUP_MAX_WAIT_MS - elapsed)
  _backupTimer = setTimeout(() => {
    _backupTimer = null
    flushBackup(userId).catch(err => logger.warn('Scheduled backup failed:', err))
  }, delay)

  // Start periodic interval (once per scheduleBackup lifecycle)
  if (!_periodicTimer) {
    _periodicTimer = setInterval(() => {
      if (_scheduledUserId) {
        createBackup(_scheduledUserId).catch(err => logger.warn('Periodic backup failed:', err))
      }
    }, BACKUP_PERIODIC_MS)
  }

  // Register pagehide listener (once) to flush before the page goes away
  if (!_pagehideRegistered && typeof window !== 'undefined') {
    _pagehideRegistered = true
    window.addEventListener('pagehide', () => {
      if (_scheduledUserId) {
        // Best-effort synchronous-ish flush — createBackup is async but the
        // browser gives pagehide handlers a brief window to fire keepalive fetches.
        // We kick it off; if the page survives long enough it completes.
        flushBackup(_scheduledUserId).catch(() => {})
      }
    })
  }
}
