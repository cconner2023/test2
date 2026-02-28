import { base64ToBytes } from './base64Utils'
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

/** localStorage key for persisted encryption key (stable across browser updates). */
const PERSISTED_KEY_NAME = 'adtmc_enc_key'

async function getFingerprint(): Promise<ArrayBuffer> {
  const raw = [
    navigator.userAgent,
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|')
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
}

async function getEncryptionKey(): Promise<CryptoKey> {
  if (encKey) return encKey

  // 1. Use persisted key if available (stable across browser updates)
  const persistedB64 = localStorage.getItem(PERSISTED_KEY_NAME)
  if (persistedB64) {
    try {
      const keyBytes = base64ToBytes(persistedB64)
      encKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      )
      // Persist raw key bytes to IDB for service worker access
      persistKeyToIdb(keyBytes).catch(() => {})
      return encKey
    } catch {
      // Persisted key corrupted — fall through to fingerprint
      localStorage.removeItem(PERSISTED_KEY_NAME)
    }
  }

  // 2. Derive from device fingerprint (first run or legacy)
  const fingerprint = await getFingerprint()
  encKey = await crypto.subtle.importKey(
    'raw', fingerprint, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  )

  // 3. Persist the derived key so future browser updates don't invalidate it
  try {
    const fpBytes = new Uint8Array(fingerprint)
    localStorage.setItem(PERSISTED_KEY_NAME, btoa(String.fromCharCode(...fpBytes)))
  } catch { /* localStorage full — key still works in memory */ }

  // 4. Persist raw key bytes to IDB for service worker access
  persistKeyToIdb(new Uint8Array(fingerprint)).catch(() => {})

  return encKey
}

/** Persist raw encryption key bytes into adtmc-secure-store IDB for SW access. */
async function persistKeyToIdb(rawBytes: Uint8Array): Promise<void> {
  try {
    const db = await getDb()
    await idbPut(db, '__enc_key_raw', rawBytes.buffer as ArrayBuffer)
  } catch {
    logger.warn('Failed to persist encryption key to IDB for SW')
  }
}

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

function idbGet(db: IDBDatabase, key: string): Promise<ArrayBuffer | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined)
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
  const b64 = btoa(String.fromCharCode(...combined))
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

// ---- Exported encrypt/decrypt string helpers ----
// Used by offlineDb, messageStore, and other modules for at-rest encryption
// of data stored in IndexedDB. Uses the same device-local AES-GCM key.

/** Prefix for encrypted string values (distinct from LS_ENC_PREFIX). */
const STR_ENC_PREFIX = 'senc:'

/** Encrypt a plaintext string. Returns a prefixed base64 ciphertext.
 *  Returns the original string if Web Crypto is unavailable. */
export async function encryptString(plaintext: string): Promise<string> {
  if (cryptoUnavailable) return plaintext
  try {
    const ek = await getEncryptionKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ek, encoded)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)
    return STR_ENC_PREFIX + btoa(String.fromCharCode(...combined))
  } catch {
    return plaintext
  }
}

/** Decrypt a string previously encrypted with encryptString().
 *  Handles plaintext transparently (returns as-is if no senc: prefix). */
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
