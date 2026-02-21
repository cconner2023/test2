const DB_NAME = 'adtmc-secure-store'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbInstance: IDBDatabase | null = null
let encKey: CryptoKey | null = null
let useLocalStorageFallback = false

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

function checkFallback(): boolean {
  if (useLocalStorageFallback) return true
  if (typeof indexedDB === 'undefined' || typeof crypto?.subtle === 'undefined') {
    useLocalStorageFallback = true
    console.warn('secureStorage: IndexedDB or Web Crypto unavailable, falling back to localStorage')
    return true
  }
  return false
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (checkFallback()) {
    localStorage.setItem(key, value)
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
    console.warn('secureStorage: encryption failed, falling back to localStorage')
    localStorage.setItem(key, value)
  }
}

export async function secureGet(key: string): Promise<string | null> {
  if (checkFallback()) {
    return localStorage.getItem(key)
  }
  try {
    const db = await getDb()
    const raw = await idbGet(db, key)
    if (!raw) return null
    const combined = new Uint8Array(raw)
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const ek = await getEncryptionKey()
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, ek, ciphertext)
    return new TextDecoder().decode(plainBuffer)
  } catch {
    return localStorage.getItem(key)
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
