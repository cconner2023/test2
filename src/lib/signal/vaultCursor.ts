/**
 * Vault cursor — this device's read position in the user's vault inbox.
 *
 * Vault-first messaging: every personal message is ONE row addressed to the
 * recipient user's vault (recipient_device_id = 'vault'); each of the user's
 * devices reads the vault tail past its own cursor. The cursor is the
 * (created_at, id) of the last row this device has persisted locally.
 *
 * - Local copy in localStorage (fast resume), server copy in vault_cursors
 *   (survives iOS storage eviction; drives the reap of rows every active device
 *   has read). Server writes are debounced and forward-only (advance_vault_cursor).
 * - created_at is assigned at insert but rows can COMMIT out of that order, so
 *   the tail is always re-read from CURSOR_OVERLAP_MS before the cursor and
 *   deduped by row id (processed-id window below). The server reap keeps a
 *   matching cushion behind every cursor.
 * - A device with no cursor (new device / cleared storage) starts from the
 *   restored backup's vault_watermark — rows below it are in the snapshot.
 */

import { supabase } from '../supabase'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('VaultCursor')

/** Re-read window behind the cursor (late-committing rows). */
export const CURSOR_OVERLAP_MS = 2 * 60 * 1000

/** How long a processed row id is remembered for overlap dedupe. */
const PROCESSED_TTL_MS = 30 * 60 * 1000

/** Debounce for the server cursor write. */
const FLUSH_DEBOUNCE_MS = 5_000

export interface VaultCursor {
  createdAt: string
  id: string
}

let _owner: { userId: string; deviceId: string } | null = null
let _cursor: VaultCursor | null = null
let _flushTimer: ReturnType<typeof setTimeout> | null = null
let _dirty = false

const cursorKey = (userId: string, deviceId: string) => `vault_cursor:${userId}:${deviceId}`
const processedKey = (userId: string, deviceId: string) => `vault_processed:${userId}:${deviceId}`

function isAfter(a: VaultCursor, b: VaultCursor): boolean {
  return a.createdAt > b.createdAt || (a.createdAt === b.createdAt && a.id > b.id)
}

function readLocal(userId: string, deviceId: string): VaultCursor | null {
  try {
    const raw = localStorage.getItem(cursorKey(userId, deviceId))
    return raw ? JSON.parse(raw) as VaultCursor : null
  } catch { return null }
}

function writeLocal(userId: string, deviceId: string, cursor: VaultCursor): void {
  try { localStorage.setItem(cursorKey(userId, deviceId), JSON.stringify(cursor)) } catch { /* ignore */ }
}

/**
 * Load this device's cursor: local copy, else the server row, else null (the
 * caller then starts from the restored backup watermark, or the beginning).
 */
export async function loadVaultCursor(userId: string, deviceId: string): Promise<VaultCursor | null> {
  if (_owner?.userId !== userId || _owner?.deviceId !== deviceId) {
    _owner = { userId, deviceId }
    _cursor = null
    _dirty = false
  }
  if (_cursor) return _cursor

  const local = readLocal(userId, deviceId)
  if (local) {
    _cursor = local
    return local
  }

  const { data, error } = await supabase
    .from('vault_cursors')
    .select('last_created_at, last_id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error) {
    logger.warn('loadVaultCursor failed:', error.message)
    return null
  }
  if (!data) return null
  _cursor = { createdAt: data.last_created_at, id: data.last_id }
  writeLocal(userId, deviceId, _cursor)
  return _cursor
}

/** Seed the cursor for a device that has none (e.g. from a backup watermark). */
export function seedVaultCursor(userId: string, deviceId: string, createdAt: string): void {
  if (_cursor) return
  _owner = { userId, deviceId }
  _cursor = { createdAt, id: '00000000-0000-0000-0000-000000000000' }
  writeLocal(userId, deviceId, _cursor)
}

/** Current cursor (null until loaded/seeded/advanced). */
export function currentVaultCursor(): VaultCursor | null {
  return _cursor
}

/** Advance past a row this device has handled. Forward-only; server write debounced. */
export function advanceVaultCursor(row: { created_at: string; id: string }): void {
  if (!_owner) return
  const next = { createdAt: row.created_at, id: row.id }
  if (_cursor && !isAfter(next, _cursor)) return
  _cursor = next
  writeLocal(_owner.userId, _owner.deviceId, next)
  _dirty = true
  if (_flushTimer) clearTimeout(_flushTimer)
  _flushTimer = setTimeout(() => { void flushVaultCursor() }, FLUSH_DEBOUNCE_MS)
}

/** Push the cursor to the server now (also called when the page hides). */
export async function flushVaultCursor(): Promise<void> {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null }
  if (!_dirty || !_owner || !_cursor) return
  _dirty = false
  const { error } = await supabase.rpc('advance_vault_cursor', {
    p_device_id: _owner.deviceId,
    p_created_at: _cursor.createdAt,
    p_id: _cursor.id,
  })
  if (error) {
    _dirty = true
    logger.warn('advance_vault_cursor failed:', error.message)
  }
}

// ---- Processed-row window (overlap dedupe) ----

function readProcessed(userId: string, deviceId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(processedKey(userId, deviceId))
    return raw ? JSON.parse(raw) as Record<string, number> : {}
  } catch { return {} }
}

/** Whether this device already handled a vault row (within the overlap window). */
export function wasVaultRowProcessed(rowId: string): boolean {
  if (!_owner) return false
  return rowId in readProcessed(_owner.userId, _owner.deviceId)
}

/** Remember a handled vault row so the overlap re-read skips it. */
export function markVaultRowProcessed(rowId: string): void {
  if (!_owner) return
  const now = Date.now()
  const map = readProcessed(_owner.userId, _owner.deviceId)
  map[rowId] = now
  for (const [id, ts] of Object.entries(map)) {
    if (now - ts > PROCESSED_TTL_MS) delete map[id]
  }
  try { localStorage.setItem(processedKey(_owner.userId, _owner.deviceId), JSON.stringify(map)) } catch { /* ignore */ }
}

/** Forget the in-memory owner on sign-out (local copies stay keyed by user+device). */
export function resetVaultCursor(): void {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null }
  _owner = null
  _cursor = null
  _dirty = false
}
