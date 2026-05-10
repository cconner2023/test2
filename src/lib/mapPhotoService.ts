/**
 * Map photo storage — DEVICE-ONLY, NEVER SYNCED.
 *
 * Photos attached to waypoints are stored in IndexedDB only. They MUST NOT
 * be enqueued to syncQueue, MUST NOT be uploaded to Supabase, and MUST NOT
 * traverse Signal vault fan-out. A photo can capture identifying or
 * operational detail (faces, IDs, equipment serials, scene context) and
 * letting it leave the device would violate Beacon's no-PHI-on-the-wire
 * invariant.
 *
 * Explicit photo sharing is a Phase 4 wedge feature. When that lands, sharing
 * MUST be a per-photo opt-in flow with an explicit confirmation — never a
 * bulk default.
 */

import { getDb, type MapPhoto } from './offlineDb'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024  // 8 MiB — generous for a waypoint photo

export interface PhotoStoreError {
  code: 'TOO_LARGE' | 'NOT_IMAGE' | 'IDB_FAILED'
  message: string
}

export async function putPhoto(
  featureId: string,
  blob: Blob,
  sourceName?: string,
): Promise<{ ok: true } | { ok: false; error: PhotoStoreError }> {
  if (!blob.type.startsWith('image/')) {
    return { ok: false, error: { code: 'NOT_IMAGE', message: 'Only image files are supported' } }
  }
  if (blob.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: { code: 'TOO_LARGE', message: `Photo exceeds ${MAX_PHOTO_BYTES / (1024 * 1024)} MB` } }
  }
  try {
    const db = await getDb()
    const entry: MapPhoto = {
      featureId,
      blob,
      capturedAt: new Date().toISOString(),
      sourceName,
    }
    await db.put('mapPhotos', entry)
    return { ok: true }
  } catch {
    return { ok: false, error: { code: 'IDB_FAILED', message: 'Could not save photo' } }
  }
}

export async function getPhoto(featureId: string): Promise<MapPhoto | null> {
  try {
    const db = await getDb()
    return (await db.get('mapPhotos', featureId)) ?? null
  } catch {
    return null
  }
}

export async function deletePhoto(featureId: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('mapPhotos', featureId)
  } catch { /* idempotent — missing entries are fine */ }
}

/** Bulk delete — used when an overlay is deleted to avoid orphaned photos. */
export async function deletePhotosForFeatures(featureIds: string[]): Promise<void> {
  if (featureIds.length === 0) return
  try {
    const db = await getDb()
    const tx = db.transaction('mapPhotos', 'readwrite')
    await Promise.all(featureIds.map(id => tx.store.delete(id)))
    await tx.done
  } catch { /* idempotent */ }
}

export async function hasPhoto(featureId: string): Promise<boolean> {
  try {
    const db = await getDb()
    const entry = await db.get('mapPhotos', featureId)
    return entry != null
  } catch {
    return false
  }
}
