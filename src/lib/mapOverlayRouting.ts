/**
 * Shared map overlay routing — applies overlay actions from any message
 * processing path (realtime, vault drain, backup restore) to the overlay
 * IDB projection and notifies subscribers via useInvalidationStore.
 *
 * This centralises the routing logic so every path that decrypts a map
 * overlay message can call a single function instead of duplicating the
 * create/update/delete branching.
 *
 * Projection target: offlineDb 'mapOverlays' store. UI components watch
 * useInvalidatedQuery('mapOverlays') and refetch on bump.
 */

import type { MessageContent, MapOverlayContent, MapOverlayPayload, MapFeatureContent } from './signal/messageContent'
import type { LocalMapOverlay, OverlayFeature } from '../Types/MapOverlayTypes'
import {
  getLocalMapOverlay,
  getLocalMapOverlays,
  saveLocalMapOverlay,
  deleteLocalMapOverlay,
} from './offlineDb'
import { addOverlayTombstone, loadOverlayTombstones } from './mapOverlayEventStore'
import { invalidate } from '../stores/useInvalidationStore'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('MapOverlayRouting')

/** Returns true if the content is a map overlay message. */
export function isMapOverlay(content: MessageContent | undefined | null): content is MapOverlayContent {
  return content?.type === 'map_overlay'
}

/** Returns true if the content is a single-feature map overlay message. */
export function isMapFeature(content: MessageContent | undefined | null): content is MapFeatureContent {
  return content?.type === 'map_feature'
}

// Module-level tombstone set for O(1) lookups — avoids IDB on every message.
let _tombstones: Set<string> = new Set()

/** Expose the in-memory tombstone set for hydration filtering. */
export function getOverlayTombstones(): Set<string> {
  return _tombstones
}

// Per-overlay serialization queue. Both routeMapOverlay and routeMapFeature
// do read-modify-write on the same LocalMapOverlay.features[] row, so
// concurrent calls for one overlay last-write-wins drop deltas. Calendar
// doesn't need this — its routes write to a Zustand store synchronously.
// Here every caller (vault drain, realtime, backup restore, system inbox)
// can fire the route without ordering knowledge: the queue serializes
// applies per overlay_id while still letting unrelated overlays parallelize.
const _routeQueue: Map<string, Promise<void>> = new Map()

function enqueueRoute(overlayId: string, task: () => Promise<void>): Promise<void> {
  const prior = _routeQueue.get(overlayId) ?? Promise.resolve()
  const next = prior.then(task, task).catch(() => {})
  _routeQueue.set(overlayId, next)
  // Drop the chain entry once this tail resolves so the Map doesn't grow
  // unbounded. If new work was enqueued after this, the Map already points
  // at the newer tail and this branch is a no-op.
  next.then(() => {
    if (_routeQueue.get(overlayId) === next) _routeQueue.delete(overlayId)
  })
  return next
}

/**
 * Load persisted tombstones into the in-memory set.
 * Must be called once during hydration before replaying any message stream.
 */
export async function initOverlayTombstones(): Promise<void> {
  _tombstones = await loadOverlayTombstones()
}

/**
 * Route a map overlay message to the IDB projection.
 * Safe to call from any context.
 *
 * Create/update actions are silently dropped for tombstoned overlay IDs so
 * vault replay and backup restore cannot resurrect deleted overlays.
 */
export function routeMapOverlay(content: MapOverlayContent): Promise<void> {
  const { data } = content
  if (!data.id) return Promise.resolve()
  return enqueueRoute(data.id, () => applyOverlay(content))
}

async function applyOverlay(content: MapOverlayContent): Promise<void> {
  const { action, data } = content

  if (action === 'delete') {
    _tombstones.add(data.id)
    addOverlayTombstone(data.id).catch(() => {})
    try {
      await deleteLocalMapOverlay(data.id)
    } catch (e) {
      logger.warn('Failed to delete overlay from IDB:', e)
    }
    invalidate('mapOverlays')
    return
  }

  // Guard: skip create/update for any tombstoned overlay.
  if (_tombstones.has(data.id)) return

  try {
    const existing = await getLocalMapOverlay(data.id)
    const merged = mergeOverlay(existing, data)
    if (!merged) return
    await saveLocalMapOverlay(merged)
    invalidate('mapOverlays')
  } catch (e) {
    logger.warn('Failed to route overlay:', e)
  }
}

/**
 * Merge a payload into an existing overlay (or build a fresh one for create).
 * Returns null when a 'create' arrives without enough fields to materialise
 * a full overlay — vault drain may surface partial replays that we just drop.
 */
function mergeOverlay(
  existing: LocalMapOverlay | undefined,
  data: MapOverlayPayload,
): LocalMapOverlay | null {
  if (existing) {
    return {
      ...existing,
      ...(data.clinic_id !== undefined && { clinic_id: data.clinic_id }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.center !== undefined && { center: data.center }),
      ...(data.zoom !== undefined && { zoom: data.zoom }),
      ...(data.features !== undefined && { features: data.features }),
      ...(data.floors !== undefined && { floors: data.floors }),
      ...(data.created_by !== undefined && { created_by: data.created_by }),
      ...(data.created_at !== undefined && { created_at: data.created_at }),
      ...(data.updated_at !== undefined && { updated_at: data.updated_at }),
      ...(data.originId !== undefined && { originId: data.originId }),
      _sync_status: 'synced',
      _sync_retry_count: 0,
      _last_sync_error: null,
      _last_sync_error_message: null,
    }
  }

  // Fresh create — require the fields a viewable overlay needs.
  if (!data.clinic_id || !data.created_by) return null
  return {
    id: data.id,
    clinic_id: data.clinic_id,
    name: data.name ?? '',
    description: data.description,
    center: data.center ?? [0, 0],
    zoom: data.zoom ?? 12,
    features: data.features ?? [],
    floors: data.floors,
    created_by: data.created_by,
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
    originId: data.originId,
    _sync_status: 'synced',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }
}

/**
 * Route a single-feature map overlay message to the IDB projection.
 *
 * The parent overlay record holds the features[] array; this function mutates
 * that array by feature.id (upsert on c/u, splice on d) and writes the
 * overlay back. Silently drops when the parent overlay is unknown — vault
 * replay ordering may surface a feature before its parent overlay landed.
 * The replay loop is idempotent, so a later parent arrival followed by a
 * feature replay still reconciles.
 *
 * Tombstone guard short-circuits when the parent overlay is deleted —
 * resurrection-safe.
 */
export function routeMapFeature(content: MapFeatureContent): Promise<void> {
  const { data } = content
  if (!data.overlay_id || !data.feature?.id) return Promise.resolve()
  return enqueueRoute(data.overlay_id, () => applyFeature(content))
}

async function applyFeature(content: MapFeatureContent): Promise<void> {
  const { action, data } = content
  if (_tombstones.has(data.overlay_id)) return

  try {
    const existing = await getLocalMapOverlay(data.overlay_id)
    if (!existing) {
      // Parent overlay not landed yet; vault replay will surface it later and
      // a subsequent feature replay (or a snapshot send) reconciles.
      return
    }

    const featureId = data.feature.id
    const now = new Date().toISOString()
    let nextFeatures: OverlayFeature[]

    if (action === 'delete') {
      nextFeatures = existing.features.filter(f => f.id !== featureId)
    } else {
      const full = data.feature as OverlayFeature
      const idx = existing.features.findIndex(f => f.id === featureId)
      if (idx === -1) {
        nextFeatures = [...existing.features, full]
      } else {
        nextFeatures = existing.features.slice()
        nextFeatures[idx] = full
      }
    }

    await saveLocalMapOverlay({
      ...existing,
      features: nextFeatures,
      updated_at: now,
      _sync_status: 'synced',
      _sync_retry_count: 0,
      _last_sync_error: null,
      _last_sync_error_message: null,
    })
    invalidate('mapOverlays')
  } catch (e) {
    logger.warn('Failed to route map feature:', e)
  }
}

/**
 * Load a clinic snapshot's resolved overlays into IDB as the bootstrap base
 * (before the tail is decrypted on top). Direct upsert of already-resolved
 * LocalMapOverlay rows — the snapshot stores the merged feature[] state, so no
 * per-feature read-modify-write is needed. One invalidation at the end refreshes
 * the map surface.
 *
 * Tombstone-guarded: a snapshot can never resurrect an overlay deleted locally
 * after the snapshot was sealed (mirrors loadSnapshotCalendarEvents). Without
 * this, a stale snapshot re-writes a deleted overlay into IDB on every login,
 * and once the paired 'd' tail row is reaped there is nothing left to kill it.
 */
export async function loadSnapshotOverlays(overlays: LocalMapOverlay[]): Promise<void> {
  let wrote = false
  for (const ov of overlays) {
    if (_tombstones.has(ov.id)) continue
    await saveLocalMapOverlay(ov)
    wrote = true
  }
  if (wrote) invalidate('mapOverlays')
}

/**
 * Resolve the live overlay set for a clinic, dropping any tombstoned ids.
 * The map-overlay equivalent of snapshotCalendarEvents — used when rebuilding
 * the clinic snapshot so a freshly-sealed snapshot can never re-include an
 * overlay this device has already deleted (the poison-snapshot guard).
 */
export async function snapshotOverlays(clinicId: string): Promise<LocalMapOverlay[]> {
  const overlays = await getLocalMapOverlays(clinicId)
  return overlays.filter(o => !_tombstones.has(o.id))
}
