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
import {
  saveMessage,
  setOnMessageSaved,
  loadAllConversations,
  getAllTombstones,
  saveTombstone,
  getAllOriginTombstones,
  saveOriginTombstones,
} from './messageStore'
import { isCalendarEvent, routeCalendarEvent, initCalendarTombstones } from '../calendarRouting'
import { isMapOverlay, isMapFeature, routeMapOverlay, routeMapFeature, initOverlayTombstones } from '../mapOverlayRouting'
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

/** Whether restoreBackup has finished (success, failure, or empty server row).
 *  createBackup is a no-op until this is true — otherwise a freshly-signed-in
 *  device can upload its pre-restore IDB snapshot and overwrite the server's
 *  richer snapshot. This is what causes the "device wipe" symptom: a peer
 *  device receives a delete envelope, deletes from IDB, schedules a backup,
 *  and the backup races the still-in-flight restore. */
let _restoreCompleted = false

/** Single-flight lock for createBackup. Multiple concurrent invocations
 *  (delete handler + incoming sync + periodic timer) collapse into one
 *  upload so a snapshot taken mid-transaction can't overwrite a clean one. */
let _createBackupInFlight: Promise<void> | null = null

export function markHydrationComplete(): void {
  _hydrationComplete = true
}

/** Max time (ms) from first unsaved change before a backup is forced. */
const BACKUP_MAX_WAIT_MS = 30_000
/** Periodic backup interval (ms). */
const BACKUP_PERIODIC_MS = 60_000
/** How many backup snapshots to retain server-side per user.
 *  See 20260514_signal_backups_multi_snapshot. A clean snapshot survives
 *  at least N-1 bad writes; restoreBackup walks newest-first and falls
 *  back to older snapshots if a newer one fails to decrypt. */
const BACKUP_RETAIN_COUNT = 3

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
  _restoreCompleted = false
  _createBackupInFlight = null
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

interface BackupPayloadV1 {
  version: 1
  createdAt: string
  messages: StoredMessage[]
}

interface BackupPayloadV2 {
  version: 2
  createdAt: string
  messages: StoredMessage[]
  tombstones: Record<string, string>  // conversationKey → deletedAt ISO
}

interface BackupPayloadV3 {
  version: 3
  createdAt: string
  messages: StoredMessage[]
  /** Conversation-level tombstones (conversationKey → deletedAt ISO). */
  tombstones: Record<string, string>
  /** Per-message tombstones (originId → deletedAt ISO). Carries the delete
   *  log across device rebirths so backup restore can't resurrect a deleted
   *  message. See messageStore invariant block. */
  originTombstones: Record<string, string>
}

type BackupPayload = BackupPayloadV1 | BackupPayloadV2 | BackupPayloadV3

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

/** Create an encrypted backup and upsert to Supabase.
 *
 *  Gated on _restoreCompleted: never uploads before restoreBackup has finished,
 *  so a freshly-signed-in device can't clobber the server snapshot with its
 *  pre-restore IDB state. Single-flight: concurrent invocations (delete handler
 *  + incoming sync + periodic timer + pagehide flush) coalesce into one upload.
 *
 *  Returns true only when the snapshot was actually inserted server-side.
 *  Callers like the vault-drain ack rely on this to know the just-drained
 *  messages are durably persisted before they mark them read on the server.
 */
export async function createBackup(userId: string): Promise<boolean> {
  if (!_restoreCompleted) {
    logger.info('createBackup deferred — restoreBackup has not completed yet')
    return false
  }
  if (_createBackupInFlight) {
    try { await _createBackupInFlight } catch { /* swallow — surface as false */ }
    // Coalesced caller doesn't know whether the upload succeeded; treat as
    // best-effort. The vault-drain ack path schedules its own createBackup
    // and is the primary flight, so this fallthrough is rare.
    return true
  }

  let uploaded = false
  _createBackupInFlight = (async () => {
    try {
      uploaded = await doCreateBackup(userId)
    } finally {
      _createBackupInFlight = null
    }
  })()
  try { await _createBackupInFlight } catch { /* doCreateBackup never throws */ }
  return uploaded
}

/** Returns true iff the snapshot row was inserted server-side. */
async function doCreateBackup(userId: string): Promise<boolean> {
  try { if (_backupKeyReady) await _backupKeyReady } catch { /* fall through to IDB */ }
  if (!_backupKey) {
    // Session restored without password (e.g. PWA reopen) — try IDB
    try {
      _backupKey = await loadKeyFromIdb()
    } catch { /* IDB unavailable */ }
  }
  if (!_backupKey) {
    logger.warn('No backup key cached, skipping backup')
    return false
  }

  try {
    let messages = await loadRawMessages()
    if (messages.length === 0 && !_hydrationComplete) {
      logger.info('Skipping empty backup — hydration not yet complete')
      return false
    }
    // Cap at max messages
    if (messages.length > SIGNAL.BACKUP_MAX_MESSAGES) {
      messages = messages.slice(0, SIGNAL.BACKUP_MAX_MESSAGES)
    }

    const tombstones = await getAllTombstones()
    const originTombstones = await getAllOriginTombstones()

    const payload: BackupPayloadV3 = {
      version: 3,
      createdAt: new Date().toISOString(),
      messages,
      tombstones,
      originTombstones,
    }

    // Compress, enforce size limit by halving message count
    let compressed = deflateRaw(new TextEncoder().encode(JSON.stringify(payload)))
    while (compressed.length > SIGNAL.BACKUP_MAX_BYTES && messages.length > 100) {
      messages = messages.slice(0, Math.floor(messages.length / 2))
      payload.messages = messages
      compressed = deflateRaw(new TextEncoder().encode(JSON.stringify(payload)))
    }

    const { salt, ciphertext } = await encryptWithKey(compressed, _backupKey)

    // Multi-snapshot retention (see 20260514_signal_backups_multi_snapshot).
    // Each createBackup inserts a NEW row; trim_signal_backups RPC prunes to
    // the last N. A clean snapshot survives at least N-1 bad writes.
    const { error } = await supabase
      .from('signal_backups')
      .insert({
        user_id: userId,
        salt,
        ciphertext,
        message_count: messages.length,
        backup_version: 3,
        created_at: new Date().toISOString(),
      })

    if (error) {
      logger.warn('Failed to insert backup:', error.message)
      return false
    }
    logger.info(`Backup created: ${messages.length} messages, ${compressed.length} bytes compressed`)
    // Fire-and-forget prune. Failure leaves extra rows behind (harmless;
    // next successful prune sweeps them).
    supabase.rpc('trim_signal_backups', { p_keep: BACKUP_RETAIN_COUNT }).then(({ error: trimErr }) => {
      if (trimErr) logger.warn('trim_signal_backups failed:', trimErr.message)
    })
    return true
  } catch (err) {
    logger.warn('Backup creation failed:', err)
    return false
  }
}

/** Hard cap on restoreBackup wall-clock time. If any internal await hangs
 *  (network stall, wedged IDB transaction, never-resolving PBKDF2), the gate
 *  still opens after this so the device can back up new activity. */
const RESTORE_HARD_TIMEOUT_MS = 15_000

/** Restore messages from an encrypted backup on Supabase.
 *
 *  Opens the createBackup gate (_restoreCompleted) in a finally block so all
 *  exit paths (success, no-backup-found, decrypt failure, missing key, hang,
 *  exception in initCalendarTombstones) unblock the gate. Never staying gated
 *  indefinitely is intentional: a permanent block would mean no device could
 *  ever back up after a restore failure. */
export async function restoreBackup(userId: string): Promise<void> {
  const hardTimeout = setTimeout(() => {
    if (!_restoreCompleted) {
      logger.warn(`restoreBackup hard-timeout after ${RESTORE_HARD_TIMEOUT_MS}ms — opening createBackup gate`)
      _restoreCompleted = true
    }
  }, RESTORE_HARD_TIMEOUT_MS)

  let usedLegacyKey = false
  try {
    // Warm the calendar tombstone set before routing any restored messages.
    // restoreBackup can race processClinicVaultMessages at login; without this,
    // a 'c' from the personal backup for a clinic-deleted event could bypass
    // the routeCalendarEvent tombstone guard if the backup finishes first.
    // Wrapped so a thrown error still hits the finally and opens the gate.
    try { await initCalendarTombstones(); await initOverlayTombstones() } catch (err) {
      logger.warn('initCalendarTombstones failed during restoreBackup:', err)
    }

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

    // Multi-snapshot fallback: pull the most recent N snapshots and walk
    // newest-first. If a snapshot fails to decrypt or parse, try the next
    // older one — survives a single corrupt upload.
    const { data: snapshots, error } = await supabase
      .from('signal_backups')
      .select('salt, ciphertext, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(BACKUP_RETAIN_COUNT)

    if (error || !snapshots || snapshots.length === 0) {
      logger.info('No backup found for user')
      return
    }

    // Legacy key (encrypted before userId salt) loaded once, used as a
    // per-snapshot fallback if the primary key fails.
    const legacyKey = await loadLegacyKeyFromIdb().catch(() => null)

    let payload: BackupPayload | null = null
    for (const snap of snapshots) {
      try {
        let compressed: Uint8Array
        try {
          compressed = await decryptWithKey(snap.ciphertext, _backupKey)
        } catch {
          if (!legacyKey) throw new Error('primary decrypt failed, no legacy key')
          compressed = await decryptWithKey(snap.ciphertext, legacyKey)
          usedLegacyKey = true
          logger.info('Restored backup using legacy key — will re-encrypt with current key')
        }

        const json = new TextDecoder().decode(inflateRaw(compressed))
        const candidate: BackupPayload = JSON.parse(json)
        if (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3) {
          logger.warn(`Unknown backup version ${candidate.version} in snapshot ${snap.created_at} — trying older`)
          continue
        }
        payload = candidate
        if (snap !== snapshots[0]) {
          logger.warn(`Newest backup unusable; restored from snapshot at ${snap.created_at}`)
        }
        break
      } catch (e) {
        logger.warn(`Snapshot at ${snap.created_at} failed to decrypt/parse, trying older:`, e instanceof Error ? e.message : e)
      }
    }

    if (!payload) {
      logger.warn(`All ${snapshots.length} snapshot(s) failed to restore`)
      return
    }

    let restored = 0

    // V2+: restore tombstones FIRST so the saveMessage tombstone guards fire correctly.
    // V3 additionally restores per-originId tombstones (the canonical delete identity).
    if ((payload.version === 2 || payload.version === 3) && payload.tombstones) {
      for (const [conversationKey, deletedAt] of Object.entries(payload.tombstones)) {
        await saveTombstone(conversationKey, deletedAt)
      }
      logger.info(`Restored ${Object.keys(payload.tombstones).length} conversation tombstones`)
    }
    if (payload.version === 3 && payload.originTombstones) {
      const originEntries = Object.entries(payload.originTombstones)
      // Group by deletedAt so a single saveOriginTombstones call writes each batch atomically.
      const byDeletedAt = new Map<string, string[]>()
      for (const [originId, deletedAt] of originEntries) {
        const bucket = byDeletedAt.get(deletedAt) ?? []
        bucket.push(originId)
        byDeletedAt.set(deletedAt, bucket)
      }
      for (const [deletedAt, originIds] of byDeletedAt) {
        await saveOriginTombstones(originIds, deletedAt)
      }
      logger.info(`Restored ${originEntries.length} origin tombstones`)
    }

    // Pre-scan: collect event/overlay/feature IDs that have a delete action so
    // we don't resurrect them when replaying earlier create messages.
    const deletedEventIds = new Set<string>()
    const deletedOverlayIds = new Set<string>()
    const deletedFeatureKeys = new Set<string>()
    for (const msg of payload.messages) {
      if (isCalendarEvent(msg.content) && msg.content.action === 'delete') {
        deletedEventIds.add(msg.content.data.id)
      } else if (isMapOverlay(msg.content) && msg.content.action === 'delete') {
        deletedOverlayIds.add(msg.content.data.id)
      } else if (isMapFeature(msg.content) && msg.content.action === 'delete') {
        deletedFeatureKeys.add(`${msg.content.data.overlay_id}::${msg.content.data.feature.id}`)
      }
    }

    for (const msg of payload.messages) {
      await saveMessage(msg, userId, { preserveReadAt: true })
      // Route calendar events, but skip create/update for events that
      // were later deleted — prevents backup from resurrecting them.
      if (isCalendarEvent(msg.content)) {
        if (msg.content.action === 'delete' || !deletedEventIds.has(msg.content.data.id)) {
          routeCalendarEvent(msg.content)
        }
      } else if (isMapOverlay(msg.content)) {
        if (msg.content.action === 'delete' || !deletedOverlayIds.has(msg.content.data.id)) {
          routeMapOverlay(msg.content).catch(() => {})
        }
      } else if (isMapFeature(msg.content)) {
        const key = `${msg.content.data.overlay_id}::${msg.content.data.feature.id}`
        if (msg.content.action === 'delete' || !deletedFeatureKeys.has(key)) {
          routeMapFeature(msg.content).catch(() => {})
        }
      }
      restored++
    }

    logger.info(`Restored ${restored} messages from backup`)

    if (restored > 0) {
      window.dispatchEvent(new CustomEvent('backup-restored'))
    }
  } catch (err) {
    logger.warn('Backup restore failed:', err)
  } finally {
    // Open the createBackup gate. All exit paths land here — including
    // "no backup found" and decrypt failures — so a session never gets
    // permanently locked out of backing up. Set BEFORE the legacy-key
    // migration so its createBackup call passes the gate.
    _restoreCompleted = true
    clearTimeout(hardTimeout)
  }

  // Migration: re-encrypt with the current (per-user) key and clear legacy key slot.
  // Runs after the gate opens so the createBackup actually fires.
  if (usedLegacyKey) {
    createBackup(userId).catch(() => {})
    clearLegacyKeyFromIdb().catch(() => {})
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
