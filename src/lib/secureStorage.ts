import { base64ToBytes, bytesToBase64 } from './base64Utils'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('SecureStorage')

const DB_NAME = 'adtmc-secure-store'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbInstance: IDBDatabase | null = null
let encKey: CryptoKey | null = null
let useLocalStorageFallback = false
/** True when Web Crypto is missing — we cannot encrypt at all. */
let cryptoUnavailable = false

// ---- IDB key names ----
/** Legacy key name for raw bytes (kept for SW compatibility). */
const IDB_KEY_RAW = '__enc_key_raw'
/** New key name for the non-extractable CryptoKey object. */
const IDB_KEY_CRYPTO = '__enc_cryptokey'

// ---- Key management ----

/**
 * Generate a cryptographically random 256-bit key.
 * Returns both the raw bytes (for SW persistence) and the non-extractable CryptoKey.
 */
async function generateRandomKey(): Promise<{ raw: Uint8Array; key: CryptoKey }> {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  const key = await crypto.subtle.importKey(
    'raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )
  return { raw, key }
}

/**
 * Try to load a CryptoKey from IDB.
 *
 * Migration path:
 *   1. Try the new CryptoKey slot first (__enc_cryptokey).
 *   2. Fall back to the legacy raw-bytes slot (__enc_key_raw) — import the
 *      bytes as a non-extractable CryptoKey, then store it in the new slot
 *      so future loads are fast.
 */
async function loadKeyFromIdb(db: IDBDatabase): Promise<CryptoKey | null> {
  // 1. Try the new CryptoKey slot
  try {
    const stored = await idbGetAny(db, IDB_KEY_CRYPTO)
    if (stored && (stored as CryptoKey).type === 'secret') {
      return stored as CryptoKey
    }
  } catch { /* slot missing or corrupt — try legacy */ }

  // 2. Try legacy raw bytes slot (migration from old code or SW-written key)
  try {
    const rawBytes = await idbGetAny(db, IDB_KEY_RAW)
    if (rawBytes) {
      const key = await crypto.subtle.importKey(
        'raw', rawBytes as ArrayBuffer, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      )
      // Upgrade: persist the CryptoKey in the new slot for future loads
      await idbPutAny(db, IDB_KEY_CRYPTO, key).catch(() => {})
      return key
    }
  } catch { /* no legacy key either */ }

  return null
}

/**
 * Persist the encryption key into IDB.
 *   - Stores a non-extractable CryptoKey under __enc_cryptokey (for the main app).
 *   - Also stores raw bytes under __enc_key_raw (for SW access via importKey).
 */
async function persistKeyToIdb(raw: Uint8Array, key: CryptoKey): Promise<void> {
  try {
    const db = await getDb()
    // Store the CryptoKey object (non-extractable)
    await idbPutAny(db, IDB_KEY_CRYPTO, key)
    // Store raw bytes for service-worker compatibility (SW cannot use CryptoKey
    // objects from a different global scope and imports raw bytes itself).
    await idbPut(db, IDB_KEY_RAW, raw.buffer as ArrayBuffer)
  } catch {
    logger.warn('Failed to persist encryption key to IDB for SW')
  }
}

/**
 * Get or create the AES-GCM encryption key.
 *
 * Strategy:
 *   1. Return cached CryptoKey if already loaded.
 *   2. Try to load from IDB (handles both new CryptoKey and legacy raw bytes).
 *   3. Generate a cryptographically random 256-bit key and persist it.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (encKey) return encKey

  // 1. Load persisted key from IDB if available
  try {
    const db = await getDb()
    const loaded = await loadKeyFromIdb(db)
    if (loaded) {
      encKey = loaded
      return encKey
    }
  } catch { /* IDB unavailable — fall through to generation */ }

  // 2. Generate a new cryptographically random key
  const { raw, key } = await generateRandomKey()
  encKey = key

  // 3. Persist both forms to IDB
  persistKeyToIdb(raw, key).catch(() => {})

  return encKey
}

// ---- IDB helpers ----

function getDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }
    request.onerror = () => reject(request.error)
  })
}

function idbPut(db: IDBDatabase, key: string, value: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Generic put that can store any structured-cloneable value (including CryptoKey). */
function idbPutAny(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbGet(db: IDBDatabase, key: string): Promise<ArrayBuffer | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined)
    req.onerror = () => reject(req.error)
  })
}

/** Generic get that returns any stored value (CryptoKey, ArrayBuffer, etc.). */
function idbGetAny(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbClear(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Prefix used to identify encrypted localStorage entries
const LS_ENC_PREFIX = 'enc:'

function checkFallback(): boolean {
  if (useLocalStorageFallback) return true
  if (typeof crypto?.subtle === 'undefined') {
    cryptoUnavailable = true
    useLocalStorageFallback = true
    logger.warn('Web Crypto unavailable — writes will be rejected to prevent plaintext storage')
    return true
  }
  if (typeof indexedDB === 'undefined') {
    useLocalStorageFallback = true
    logger.warn('IndexedDB unavailable, falling back to encrypted localStorage')
    return true
  }
  return false
}

/** Encrypt value and store as base64 in localStorage. */
async function lsEncryptedSet(key: string, value: string): Promise<void> {
  if (cryptoUnavailable) {
    logger.error('Cannot store data — encryption unavailable')
    return
  }
  const ek = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(value)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ek, encoded)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  // Store as base64 with prefix so we can identify encrypted entries
  const b64 = bytesToBase64(combined)
  localStorage.setItem(key, LS_ENC_PREFIX + b64)
}

/** Read and decrypt a base64-encrypted localStorage entry. */
async function lsEncryptedGet(key: string): Promise<string | null> {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  // Handle legacy unencrypted entries (migrate on read)
  if (!raw.startsWith(LS_ENC_PREFIX)) {
    // Legacy plaintext entry — if we can encrypt, migrate it now
    if (!cryptoUnavailable) {
      try {
        await lsEncryptedSet(key, raw)
      } catch { /* best effort migration */ }
    }
    return raw
  }
  if (cryptoUnavailable) {
    logger.error('Cannot decrypt — Web Crypto unavailable')
    return null
  }
  const b64 = raw.slice(LS_ENC_PREFIX.length)
  const combined = base64ToBytes(b64)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const ek = await getEncryptionKey()
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, ek, ciphertext)
  return new TextDecoder().decode(plainBuffer)
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (checkFallback()) {
    await lsEncryptedSet(key, value)
    return
  }
  try {
    const ek = await getEncryptionKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(value)
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ek, encoded)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)
    const db = await getDb()
    await idbPut(db, key, combined.buffer as ArrayBuffer)
  } catch {
    useLocalStorageFallback = true
    logger.warn('IndexedDB write failed, falling back to encrypted localStorage')
    await lsEncryptedSet(key, value)
  }
}

export async function secureGet(key: string): Promise<string | null> {
  if (checkFallback()) {
    return lsEncryptedGet(key)
  }
  try {
    const db = await getDb()
    const raw = await idbGet(db, key)
    if (!raw) {
      // Check localStorage for migrated/fallback entries
      return lsEncryptedGet(key)
    }
    const combined = new Uint8Array(raw)
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const ek = await getEncryptionKey()
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, ek, ciphertext)
    return new TextDecoder().decode(plainBuffer)
  } catch {
    return lsEncryptedGet(key)
  }
}

export async function secureRemove(key: string): Promise<void> {
  if (checkFallback()) {
    localStorage.removeItem(key)
    return
  }
  try {
    const db = await getDb()
    await idbDelete(db, key)
  } catch {
    localStorage.removeItem(key)
  }
  try {
    localStorage.removeItem(key)
  } catch { /* clean up any fallback remnant */ }
}

export async function secureClear(): Promise<void> {
  if (checkFallback()) {
    return
  }
  try {
    const db = await getDb()
    await idbClear(db)
  } catch { /* best effort */ }
}

/**
 * Aggressively destroy the secure store database and reset all module state.
 * This wipes the encryption key — after calling this, any previously encrypted
 * data (in IDB or localStorage) becomes unrecoverable. Call on logout for a clean slate.
 */
export async function destroySecureStore(): Promise<void> {
  encKey = null
  useLocalStorageFallback = false
  cryptoUnavailable = false
  try {
    if (dbInstance) {
      dbInstance.close()
      dbInstance = null
    }
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  } catch { /* best effort */ }
}

// ---- Exported encrypt/decrypt string helpers ----
// Used by offlineDb, messageStore, and other modules for at-rest encryption
// of data stored in IndexedDB. Uses the same device-local AES-GCM key.

/** Prefix for encrypted string values (distinct from LS_ENC_PREFIX). */
const STR_ENC_PREFIX = 'senc:'

/** Encrypt a plaintext string. Returns a prefixed base64 ciphertext.
 *  Throws if encryption fails (never returns plaintext silently). */
export async function encryptString(plaintext: string): Promise<string> {
  if (cryptoUnavailable) {
    throw new Error('encryptString: Web Crypto is unavailable — cannot encrypt')
  }
  const ek = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ek, encoded)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return STR_ENC_PREFIX + bytesToBase64(combined)
}

/** Decrypt a string previously encrypted with encryptString().
 *  Handles legacy plaintext transparently (returns as-is if no senc: prefix). */
export async function decryptString(value: string): Promise<string> {
  if (!value.startsWith(STR_ENC_PREFIX)) return value
  if (cryptoUnavailable) return value
  try {
    const b64 = value.slice(STR_ENC_PREFIX.length)
    const combined = base64ToBytes(b64)
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const ek = await getEncryptionKey()
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, ek, ciphertext)
    return new TextDecoder().decode(plainBuffer)
  } catch {
    // Decryption failed (key changed, corrupted data) — return raw value
    return value
  }
}

// ---- Supabase auth persistence for SW ----

/**
 * Persist Supabase connection info to IDB so the service worker can
 * make authenticated REST API calls without importing the Supabase client.
 * Called on sign-in and token refresh.
 */
export async function persistSupabaseAuth(
  url: string,
  accessToken: string,
  anonKey: string,
): Promise<void> {
  try {
    const payload = JSON.stringify({ url, accessToken, anonKey })
    const encrypted = await encryptString(payload)
    const db = await getDb()
    const encoded = new TextEncoder().encode(encrypted)
    await idbPut(db, '__supabase_auth', encoded.buffer as ArrayBuffer)
  } catch {
    logger.warn('Failed to persist Supabase auth to IDB for SW')
  }
}
