/**
 * Area and item photos on R2 (property_locations.photo_ref / property_items.photo_ref).
 *
 * The row carries {store:'r2', k, ak, mime}; the 800px JPEG lives at R2 p/<k>, encrypted
 * with the per-object key `ak`. A ref is ~150 bytes, so editing a zone name no longer
 * re-sends the photo through the spine row, the clinic vault fan-out and the snapshot.
 * Exposure is unchanged from inline photo_data: whoever can read the row can read the
 * photo.
 *
 * Offline: the upload needs the network. When it fails, commitPropertyPhoto falls back
 * to the old inline photo_data so the photo still saves and syncs; the next online
 * change to that photo moves it to R2. Readers accept either form.
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { uploadEncryptedAttachment, downloadDecryptedAttachment, deleteAttachments } from './signal/attachmentService'
import { bytesToBase64, base64ToBytes } from './base64Utils'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('PropertyPhoto')

export interface PhotoRef {
  store: 'r2'
  k: string
  ak: string
  mime: string
}

export interface PhotoFields {
  photo_data?: string | null
  photo_ref?: PhotoRef | null
}

type RefTable = 'property_locations' | 'property_items'

const urlCache = new Map<string, string>()

function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!m) return null
  return new Blob([base64ToBytes(m[2]) as BlobPart], { type: m[1] })
}

/**
 * Turn a freshly picked photo (data URL) into the row patch to save. Uploads to R2 when
 * online; otherwise keeps the bytes inline. `previous` is the ref being replaced; its
 * object is deleted after a successful upload (a failed delete is left to the sweep,
 * and a non-owner's delete is refused and also left to the sweep).
 */
export async function commitPropertyPhoto(dataUrl: string, refTable: RefTable, previous?: PhotoRef | null): Promise<PhotoFields> {
  try {
    const blob = dataUrlToBlob(dataUrl)
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!blob || !userId) return { photo_data: dataUrl, photo_ref: null }
    const up = await uploadEncryptedAttachment(userId, blob, { class: 'p', refTable })
    if (!up.ok) {
      logger.warn('Photo upload failed, keeping inline:', up.error)
      return { photo_data: dataUrl, photo_ref: null }
    }
    const ref: PhotoRef = { store: 'r2', k: up.data.path, ak: up.data.key, mime: blob.type || 'image/jpeg' }
    urlCache.set(ref.k, dataUrl)
    if (previous?.k && previous.k !== ref.k) void deleteAttachments([previous.k])
    return { photo_data: null, photo_ref: ref }
  } catch (e) {
    logger.warn('commitPropertyPhoto error:', e instanceof Error ? e.message : e)
    return { photo_data: dataUrl, photo_ref: null }
  }
}

/** Row patch for removing a photo; deletes the R2 object when there is one. */
export function removePropertyPhoto(previous?: PhotoRef | null): PhotoFields {
  if (previous?.k) void deleteAttachments([previous.k])
  return { photo_data: null, photo_ref: null }
}

/** Data URL for a stored ref, memoized by object key. R2 bytes are also in the ciphertext
 *  IDB cache, so a photo seen once renders offline. */
export async function resolvePhotoRef(ref: PhotoRef): Promise<string | null> {
  const hit = urlCache.get(ref.k)
  if (hit) return hit
  const res = await downloadDecryptedAttachment(ref.k, ref.ak, 'r2', ref.mime)
  if (!res.ok) return null
  const url = `data:${ref.mime || 'image/jpeg'};base64,${bytesToBase64(new Uint8Array(await res.data.arrayBuffer()))}`
  urlCache.set(ref.k, url)
  return url
}

/** Renderable photo URL for a row with photo_ref and/or legacy photo_data. */
export function usePropertyPhotoUrl(row: PhotoFields | null | undefined): string | null {
  const ref = row?.photo_ref ?? null
  const inline = row?.photo_data ?? null
  const [url, setUrl] = useState<string | null>(() => (ref ? urlCache.get(ref.k) ?? null : inline))

  useEffect(() => {
    if (!ref) { setUrl(inline); return }
    const hit = urlCache.get(ref.k)
    if (hit) { setUrl(hit); return }
    let cancelled = false
    void resolvePhotoRef(ref).then(u => { if (!cancelled) setUrl(u) })
    return () => { cancelled = true }
    // ref identity changes on every row object; the key is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.k, inline])

  return url
}

/** id -> renderable photo URL for a list of rows (zone map tile backgrounds). Rows whose
 *  R2 photo is still resolving are absent until it lands. */
export function usePropertyPhotoMap(rows: ReadonlyArray<{ id: string } & PhotoFields>): Map<string, string> {
  const [resolved, setResolved] = useState<Record<string, string>>({})
  const refKeys = rows.map(r => r.photo_ref?.k ?? '').join('|')

  useEffect(() => {
    let cancelled = false
    for (const r of rows) {
      const ref = r.photo_ref
      if (!ref || resolved[ref.k]) continue
      const hit = urlCache.get(ref.k)
      if (hit) { setResolved(prev => ({ ...prev, [ref.k]: hit })); continue }
      void resolvePhotoRef(ref).then(u => {
        if (!cancelled && u) setResolved(prev => ({ ...prev, [ref.k]: u }))
      })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKeys])

  return useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) {
      const u = r.photo_ref ? resolved[r.photo_ref.k] ?? urlCache.get(r.photo_ref.k) : r.photo_data
      if (u) m.set(r.id, u)
    }
    return m
  }, [rows, resolved])
}
