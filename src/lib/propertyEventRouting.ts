/**
 * Shared property routing — applies property actions from any message-processing
 * path (realtime per-device fan-out, clinic-vault drain, snapshot bootstrap) to
 * the property IDB projections and notifies subscribers via useInvalidationStore.
 *
 * One envelope type (`property_event`) carries all five property entities,
 * discriminated by `entity`. Per-entity semantics live here, not on the wire:
 *   - item / zone   : flat create/update/delete (tombstone-guarded, resurrection-safe)
 *   - custody       : append-only (create idempotent; update/delete are no-ops)
 *   - discrepancy   : create + rectify-update (never deleted)
 *   - tags          : full-canvas replace, keyed by location_id
 *
 * Mirrors mapOverlayRouting.ts (the async / IDB-backed variant with an
 * enqueueRoute per-id serialization queue), NOT the synchronous Zustand
 * calendar variant — property entities are IDB rows under read-modify-write.
 *
 * Projection targets: offlineDb propertyItems / propertyLocations /
 * custodyLedger / propertyDiscrepancies / locationTags. UI watches
 * useInvalidatedQuery('properties').
 */

import type { MessageContent, PropertyEventContent, PropertyEntity } from './signal/messageContent'
import type {
  LocalPropertyItem,
  LocalPropertyLocation,
  LocalCustodyEntry,
  LocalDiscrepancy,
  PropertyItem,
  PropertyLocation,
  CustodyLedgerEntry,
  Discrepancy,
  LocationTag,
} from '../Types/PropertyTypes'
import {
  getDb,
  getAllLocalPropertyItems,
  getAllLocalPropertyLocations,
  getAllLocalCustody,
  getAllLocalDiscrepancies,
  saveLocalPropertyItem,
  deleteLocalPropertyItem,
  saveLocalPropertyLocation,
  deleteLocalPropertyLocation,
  saveLocalCustodyEntry,
  saveLocalDiscrepancy,
  getLocalLocationTags,
  saveLocalLocationTags,
} from './offlineDb'
import {
  addItemTombstone,
  loadItemTombstones,
  addZoneTombstone,
  loadZoneTombstones,
} from './propertyEventStore'
import { invalidate } from '../stores/useInvalidationStore'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('PropertyEventRouting')

/** A property tags canvas, as stored in the clinic-vault snapshot. */
export interface PropertyTagsSnapshot {
  location_id: string
  tags: LocationTag[]
}

const SYNC_META = {
  _sync_status: 'synced' as const,
  _sync_retry_count: 0,
  _last_sync_error: null,
  _last_sync_error_message: null,
}

/** Returns true if the content is a property message. */
export function isPropertyEvent(content: MessageContent | undefined | null): content is PropertyEventContent {
  return content?.type === 'property_event'
}

// Module-level tombstone sets for O(1) lookups — only items and zones can be
// absence-deleted, so only they have tombstones.
let _itemTombstones: Set<string> = new Set()
let _zoneTombstones: Set<string> = new Set()

export function getItemTombstones(): Set<string> { return _itemTombstones }
export function getZoneTombstones(): Set<string> { return _zoneTombstones }

/**
 * Load persisted tombstones into the in-memory sets. Must run once during
 * hydration before replaying any message stream (clinicVaultDevice drain).
 */
export async function initPropertyTombstones(): Promise<void> {
  _itemTombstones = await loadItemTombstones()
  _zoneTombstones = await loadZoneTombstones()
}

// Per-entity serialization queue. Item/zone/tags routes do read-modify-write on
// an IDB row, so concurrent calls for one id last-write-wins drop deltas. The
// queue serializes applies per (entity,id) while parallelizing unrelated ones.
const _routeQueue: Map<string, Promise<void>> = new Map()

function enqueueRoute(key: string, task: () => Promise<void>): Promise<void> {
  const prior = _routeQueue.get(key) ?? Promise.resolve()
  const next = prior.then(task, task).catch(() => {})
  _routeQueue.set(key, next)
  next.then(() => {
    if (_routeQueue.get(key) === next) _routeQueue.delete(key)
  })
  return next
}

/**
 * Route a property message to its IDB projection. Safe to call from any context.
 * Create/update are dropped for tombstoned item/zone ids so vault replay and
 * snapshot bootstrap cannot resurrect a deleted entity.
 */
export function routePropertyEvent(content: PropertyEventContent): Promise<void> {
  const { entity, data } = content
  if (!data.id) return Promise.resolve()
  return enqueueRoute(`${entity}:${data.id}`, () => applyPropertyEvent(content))
}

async function applyPropertyEvent(content: PropertyEventContent): Promise<void> {
  switch (content.entity) {
    case 'item': return applyItem(content)
    case 'zone': return applyZone(content)
    case 'custody': return applyCustody(content)
    case 'discrepancy': return applyDiscrepancy(content)
    case 'tags': return applyTags(content)
  }
}

async function applyItem(content: PropertyEventContent): Promise<void> {
  const { action, data } = content
  if (action === 'delete') {
    _itemTombstones.add(data.id)
    addItemTombstone(data.id).catch(() => {})
    try { await deleteLocalPropertyItem(data.id) } catch (e) { logger.warn('item delete failed:', e) }
    invalidate('properties')
    return
  }
  if (_itemTombstones.has(data.id)) return
  try {
    const existing = await getExisting<LocalPropertyItem>('item', data.id)
    const row = data.data as unknown as PropertyItem | undefined
    if (!existing && !row) return
    await saveLocalPropertyItem({ ...(existing ?? {}), ...(row ?? {}), ...SYNC_META } as LocalPropertyItem)
    invalidate('properties')
  } catch (e) { logger.warn('Failed to route item:', e) }
}

async function applyZone(content: PropertyEventContent): Promise<void> {
  const { action, data } = content
  if (action === 'delete') {
    _zoneTombstones.add(data.id)
    addZoneTombstone(data.id).catch(() => {})
    try { await deleteLocalPropertyLocation(data.id) } catch (e) { logger.warn('zone delete failed:', e) }
    invalidate('properties')
    return
  }
  if (_zoneTombstones.has(data.id)) return
  try {
    const existing = await getExisting<LocalPropertyLocation>('zone', data.id)
    const row = data.data as unknown as PropertyLocation | undefined
    if (!existing && !row) return
    await saveLocalPropertyLocation({ ...(existing ?? {}), ...(row ?? {}), ...SYNC_META } as LocalPropertyLocation)
    invalidate('properties')
  } catch (e) { logger.warn('Failed to route zone:', e) }
}

async function applyCustody(content: PropertyEventContent): Promise<void> {
  // Append-only: only 'create' carries data; update/delete are defensive no-ops.
  if (content.action !== 'create') return
  const row = content.data.data as unknown as CustodyLedgerEntry | undefined
  if (!row) return
  try {
    await saveLocalCustodyEntry({ ...row, ...SYNC_META } as LocalCustodyEntry)
    invalidate('properties')
  } catch (e) { logger.warn('Failed to route custody:', e) }
}

async function applyDiscrepancy(content: PropertyEventContent): Promise<void> {
  // create or rectify-update; discrepancies are never deleted.
  const row = content.data.data as unknown as Discrepancy | undefined
  if (!row) return
  try {
    const existing = await getExisting<LocalDiscrepancy>('discrepancy', content.data.id)
    await saveLocalDiscrepancy({ ...(existing ?? {}), ...row, ...SYNC_META } as LocalDiscrepancy)
    invalidate('properties')
  } catch (e) { logger.warn('Failed to route discrepancy:', e) }
}

async function applyTags(content: PropertyEventContent): Promise<void> {
  // Full-canvas replace keyed on location_id (= content.data.id).
  const tags = content.data.tags ?? []
  try {
    await saveLocalLocationTags(content.data.id, tags)
    invalidate('properties')
  } catch (e) { logger.warn('Failed to route tags:', e) }
}

/** Direct IDB lookup of an existing local row by entity+id (keyPath get). */
async function getExisting<T>(entity: PropertyEntity, id: string): Promise<T | undefined> {
  const db = await getDb()
  if (entity === 'item') return await db.get('propertyItems', id) as T | undefined
  if (entity === 'zone') return await db.get('propertyLocations', id) as T | undefined
  if (entity === 'discrepancy') return await db.get('propertyDiscrepancies', id) as T | undefined
  return undefined
}

// ============================================================
// Snapshot build + load (clinic-vault bootstrap base)
// ============================================================

/** Tombstone + cross-cluster + poison-snapshot retain predicate. */
function retain(
  clinicId: string,
  tombstones: Set<string> | null,
  vaultLiveIds: Set<string> | undefined,
  row: { id: string; clinic_id?: string; target_clinic_ids?: string[]; originId?: string },
): boolean {
  if (tombstones && tombstones.has(row.id)) return false
  const inClinic = row.clinic_id === clinicId || (row.target_clinic_ids?.includes(clinicId) ?? false)
  if (!inClinic) return false
  if (vaultLiveIds && row.originId && !vaultLiveIds.has(row.id)) return false
  return true
}

export async function snapshotPropertyItems(clinicId: string, vaultLiveIds?: Set<string>): Promise<LocalPropertyItem[]> {
  return (await getAllLocalPropertyItems()).filter(r => retain(clinicId, _itemTombstones, vaultLiveIds, r))
}

export async function snapshotPropertyZones(clinicId: string, vaultLiveIds?: Set<string>): Promise<LocalPropertyLocation[]> {
  return (await getAllLocalPropertyLocations()).filter(r => retain(clinicId, _zoneTombstones, vaultLiveIds, r))
}

export async function snapshotPropertyCustody(clinicId: string, vaultLiveIds?: Set<string>): Promise<LocalCustodyEntry[]> {
  return (await getAllLocalCustody()).filter(r => retain(clinicId, null, vaultLiveIds, r))
}

export async function snapshotPropertyDiscrepancies(clinicId: string, vaultLiveIds?: Set<string>): Promise<LocalDiscrepancy[]> {
  // Discrepancies carry no clinic_id — scope via their parent item's clinic set.
  const items = await getAllLocalPropertyItems()
  const inClinicItemIds = new Set(
    items.filter(i => i.clinic_id === clinicId || (i.target_clinic_ids?.includes(clinicId) ?? false)).map(i => i.id),
  )
  return (await getAllLocalDiscrepancies()).filter(d => {
    if (!inClinicItemIds.has(d.item_id)) return false
    if (vaultLiveIds && d.originId && !vaultLiveIds.has(d.id)) return false
    return true
  })
}

/** Tags snapshot = the tag canvas of every in-clinic live zone. */
export async function snapshotPropertyTags(clinicId: string, zoneVaultLiveIds?: Set<string>): Promise<PropertyTagsSnapshot[]> {
  const zones = await snapshotPropertyZones(clinicId, zoneVaultLiveIds)
  const out: PropertyTagsSnapshot[] = []
  for (const z of zones) {
    const tags = await getLocalLocationTags(z.id)
    if (tags.length > 0) out.push({ location_id: z.id, tags })
  }
  return out
}

export async function loadSnapshotPropertyItems(items: LocalPropertyItem[]): Promise<void> {
  let wrote = false
  for (const r of items) {
    if (_itemTombstones.has(r.id)) continue
    await saveLocalPropertyItem({ ...r, ...SYNC_META })
    wrote = true
  }
  if (wrote) invalidate('properties')
}

export async function loadSnapshotPropertyZones(zones: LocalPropertyLocation[]): Promise<void> {
  let wrote = false
  for (const r of zones) {
    if (_zoneTombstones.has(r.id)) continue
    await saveLocalPropertyLocation({ ...r, ...SYNC_META })
    wrote = true
  }
  if (wrote) invalidate('properties')
}

export async function loadSnapshotPropertyCustody(entries: LocalCustodyEntry[]): Promise<void> {
  let wrote = false
  for (const r of entries) { await saveLocalCustodyEntry({ ...r, ...SYNC_META }); wrote = true }
  if (wrote) invalidate('properties')
}

export async function loadSnapshotPropertyDiscrepancies(entries: LocalDiscrepancy[]): Promise<void> {
  let wrote = false
  for (const r of entries) { await saveLocalDiscrepancy({ ...r, ...SYNC_META }); wrote = true }
  if (wrote) invalidate('properties')
}

export async function loadSnapshotPropertyTags(canvases: PropertyTagsSnapshot[]): Promise<void> {
  let wrote = false
  for (const c of canvases) { await saveLocalLocationTags(c.location_id, c.tags); wrote = true }
  if (wrote) invalidate('properties')
}
