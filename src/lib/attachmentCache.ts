/**
 * Ciphertext cache for attachment objects (R2 and legacy Supabase), keyed by object key.
 *
 * Holds the stored ciphertext, never plaintext, so a cache hit still needs the AES key
 * from the message or record. It exists to skip the attachment-sign round trip and the
 * R2 Class B read on re-render; there is deliberately no service-worker route for R2
 * because presigned URLs change on every signature and would never hit.
 *
 * Object keys are immutable except cert documents (p/cert/...), which are overwritten on
 * replace: callers pass a version (certifications.updated_at) that becomes part of the
 * cache key so a replaced card is not served stale.
 *
 * Own database rather than a store in offlineDb so the cache can be dropped without a
 * schema bump on the main store. Sizes live in a separate meta store so LRU eviction can
 * walk entries without loading their bytes.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { dbName } from './idbEnv'

const DB_BASE = 'adtmc-attachment-cache'
const CAP_BYTES = 150 * 1024 * 1024

interface CacheDB extends DBSchema {
  blobs: { key: string; value: { key: string; bytes: ArrayBuffer } }
  meta: { key: string; value: { key: string; size: number; at: number }; indexes: { 'by-at': number } }
}

let dbPromise: Promise<IDBPDatabase<CacheDB>> | null = null

function db(): Promise<IDBPDatabase<CacheDB>> {
  dbPromise ??= openDB<CacheDB>(dbName(DB_BASE), 1, {
    upgrade(d) {
      d.createObjectStore('blobs', { keyPath: 'key' })
      d.createObjectStore('meta', { keyPath: 'key' }).createIndex('by-at', 'at')
    },
  })
  return dbPromise
}

export const cacheKeyFor = (objectKey: string, version?: string) =>
  version ? `${objectKey}@${version}` : objectKey

export async function getCachedCiphertext(cacheKey: string): Promise<Uint8Array | null> {
  try {
    const d = await db()
    const row = await d.get('blobs', cacheKey)
    if (!row) return null
    const meta = await d.get('meta', cacheKey)
    if (meta) await d.put('meta', { ...meta, at: Date.now() })
    return new Uint8Array(row.bytes)
  } catch {
    return null
  }
}

export async function putCachedCiphertext(cacheKey: string, bytes: Uint8Array): Promise<void> {
  try {
    if (bytes.byteLength > CAP_BYTES / 4) return
    const d = await db()
    const tx = d.transaction(['blobs', 'meta'], 'readwrite')
    const copy = bytes.slice().buffer
    await tx.objectStore('blobs').put({ key: cacheKey, bytes: copy })
    await tx.objectStore('meta').put({ key: cacheKey, size: bytes.byteLength, at: Date.now() })
    await tx.done
    await evict(d)
  } catch {
    // Cache is best-effort; quota errors on iOS must not fail the download.
  }
}

export async function deleteCachedCiphertext(objectKeys: string[]): Promise<void> {
  try {
    const d = await db()
    const tx = d.transaction(['blobs', 'meta'], 'readwrite')
    // Cert entries carry an @version suffix, so match by prefix.
    let cursor = await tx.objectStore('meta').openCursor()
    while (cursor) {
      const k = cursor.key as string
      if (objectKeys.some(o => k === o || k.startsWith(`${o}@`))) {
        await tx.objectStore('blobs').delete(k)
        await cursor.delete()
      }
      cursor = await cursor.continue()
    }
    await tx.done
  } catch { /* best-effort */ }
}

export async function clearAttachmentCache(): Promise<void> {
  try {
    const d = await db()
    const tx = d.transaction(['blobs', 'meta'], 'readwrite')
    await tx.objectStore('blobs').clear()
    await tx.objectStore('meta').clear()
    await tx.done
  } catch { /* best-effort */ }
}

async function evict(d: IDBPDatabase<CacheDB>): Promise<void> {
  const all = await d.getAllFromIndex('meta', 'by-at')
  let total = all.reduce((n, m) => n + m.size, 0)
  if (total <= CAP_BYTES) return
  const tx = d.transaction(['blobs', 'meta'], 'readwrite')
  for (const m of all) {
    if (total <= CAP_BYTES) break
    await tx.objectStore('blobs').delete(m.key)
    await tx.objectStore('meta').delete(m.key)
    total -= m.size
  }
  await tx.done
}
