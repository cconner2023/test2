const DB_NAME = 'adtmc-secure-store'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbInstance: IDBDatabase | null = null
let encKey: CryptoKey | null = null
let useLocalStorageFallback = false
/** True when Web Crypto is missing — we cannot encrypt at all. */
let cryptoUnavailable = false

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
  const fingerprint = await getFingerprint()
  encKey = await crypto.subtle.importKey(
    'raw',
    fingerprint,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  return encKey
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
    console.warn('secureStorage: Web Crypto unavailable — writes will be rejected to prevent plaintext storage')
    return true
  }
  if (typeof indexedDB === 'undefined') {
    useLocalStorageFallback = true
    console.warn('secureStorage: IndexedDB unavailable, falling back to encrypted localStorage')
    return true
  }
  return false
}

/** Encrypt value and store as base64 in localStorage. */
async function lsEncryptedSet(key: string, value: string): Promise<void> {
  if (cryptoUnavailable) {
    console.error('secureStorage: cannot store data — encryption unavailable')
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
    console.error('secureStorage: cannot decrypt — Web Crypto unavailable')
    return null
  }
  const b64 = raw.slice(LS_ENC_PREFIX.length)
  const binary = atob(b64)
  const combined = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i)
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
    console.warn('secureStorage: IndexedDB write failed, falling back to encrypted localStorage')
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
