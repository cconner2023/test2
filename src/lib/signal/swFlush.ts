/**
 * Service-worker-compatible outbound queue flush.
 *
 * This module uses only raw IDB, fetch, and Web Crypto — no Supabase client,
 * no secureStorage.ts, no logger. It is designed to be imported by the SW
 * without pulling in the main app bundle.
 *
 * Flow:
 * 1. Open adtmc-outbound-queue IDB → read all pending entries
 * 2. Open adtmc-secure-store IDB → read encryption key + Supabase auth
 * 3. Decrypt each entry's payload with AES-GCM
 * 4. POST to Supabase REST API via raw fetch
 * 5. Mark entries as sent or failed
 */

import { base64ToBytes } from '../base64Utils'
import { aesGcmDecrypt } from '../aesGcm'

const QUEUE_DB = 'adtmc-outbound-queue'
const QUEUE_VERSION = 1
const SECURE_DB = 'adtmc-secure-store'
const SECURE_VERSION = 1
const SENC_PREFIX = 'senc:'

// ---- Raw IDB helpers (no idb library) ----

function openIdb(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version)
    req.onupgradeneeded = () => {
      const db = req.result
      if (name === QUEUE_DB && !db.objectStoreNames.contains('queue')) {
        const store = db.createObjectStore('queue', { keyPath: 'id' })
        store.createIndex('by-status', 'status')
      }
      if (name === SECURE_DB && !db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGetAll(db: IDBDatabase, storeName: string, indexName: string, key: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const idx = tx.objectStore(storeName).index(indexName)
    const req = idx.getAll(key)
    req.onsuccess = () => resolve(req.result as unknown[])
    req.onerror = () => reject(req.error)
  })
}

function idbGet(db: IDBDatabase, storeName: string, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbPut(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---- Crypto helpers ----

async function decryptAesGcmToString(key: CryptoKey, combined: Uint8Array): Promise<string> {
  const plain = await aesGcmDecrypt(key, combined)
  return new TextDecoder().decode(plain)
}

async function decryptSencString(encKey: CryptoKey, value: string): Promise<string> {
  if (!value.startsWith(SENC_PREFIX)) return value
  const b64 = value.slice(SENC_PREFIX.length)
  const combined = base64ToBytes(b64)
  return decryptAesGcmToString(encKey, combined)
}

// ---- Queue entry shape (matches outboundQueue.ts) ----

interface QueueEntry {
  id: string
  senderId: string
  recipientId: string
  senderDeviceId: string | null
  recipientDeviceId: string | null
  groupId: string | null
  messageType: string
  payload: string // encrypted
  createdAt: string
  status: string
  retryCount: number
  batchId: string | null
}

// ---- Main flush function ----

/**
 * Flush pending outbound queue entries via Supabase REST API.
 * Returns the number of successfully sent messages.
 */
export async function flushOutboundQueue(): Promise<number> {
  let queueDb: IDBDatabase | null = null
  let secureDb: IDBDatabase | null = null

  try {
    // 1. Open databases
    queueDb = await openIdb(QUEUE_DB, QUEUE_VERSION)
    secureDb = await openIdb(SECURE_DB, SECURE_VERSION)

    // 2. Read pending entries
    const entries = (await idbGetAll(queueDb, 'queue', 'by-status', 'pending')) as QueueEntry[]
    if (entries.length === 0) return 0

    // 3. Get encryption key from IDB
    const rawKeyBuffer = (await idbGet(secureDb, 'kv', '__enc_key_raw')) as ArrayBuffer | undefined
    if (!rawKeyBuffer) {
      console.warn('[SW Flush] No encryption key in IDB — cannot decrypt queue')
      return 0
    }

    const encKey = await crypto.subtle.importKey(
      'raw', rawKeyBuffer, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    )

    // 4. Get Supabase auth info from IDB
    const authBuffer = (await idbGet(secureDb, 'kv', '__supabase_auth')) as ArrayBuffer | undefined
    if (!authBuffer) {
      console.warn('[SW Flush] No Supabase auth in IDB — cannot send')
      return 0
    }

    // The auth is stored as a TextEncoder-encoded encrypted string
    const authEncStr = new TextDecoder().decode(new Uint8Array(authBuffer))
    const authJson = await decryptSencString(encKey, authEncStr)
    const auth = JSON.parse(authJson) as { url: string; accessToken: string; anonKey: string }

    // 5. Send each entry via REST API
    let sent = 0

    for (const entry of entries) {
      try {
        // Decrypt payload
        const payloadJson = await decryptSencString(encKey, entry.payload)
        const payload = JSON.parse(payloadJson)

        // POST via RPC (sender_id derived from JWT on server)
        const response = await fetch(`${auth.url}/rest/v1/rpc/send_signal_message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': auth.anonKey,
            'Authorization': `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({
            p_id: entry.id,
            p_recipient_id: entry.recipientId,
            p_sender_device_id: entry.senderDeviceId ?? null,
            p_recipient_device_id: entry.recipientDeviceId ?? null,
            p_message_type: entry.messageType,
            p_payload: payload,
            p_group_id: entry.groupId ?? null,
            p_origin_id: null, // originId not stored in queue entry yet
          }),
        })

        if (response.ok || response.status === 201) {
          await idbDelete(queueDb, 'queue', entry.id)
          sent++
        } else {
          // Server rejection — increment retry
          const updated = { ...entry, status: 'failed', retryCount: entry.retryCount + 1 }
          if (updated.retryCount < 10) updated.status = 'pending'
          await idbPut(queueDb, 'queue', updated)
        }
      } catch {
        // Network error on individual entry — skip, will retry later
        const updated = { ...entry, status: 'pending', retryCount: entry.retryCount + 1 }
        if (updated.retryCount >= 10) updated.status = 'failed'
        await idbPut(queueDb, 'queue', updated)
      }
    }

    console.log(`[SW Flush] Sent ${sent}/${entries.length} queued messages`)
    return sent
  } catch (e) {
    console.warn('[SW Flush] Queue flush failed:', e)
    return 0
  } finally {
    queueDb?.close()
    secureDb?.close()
  }
}
