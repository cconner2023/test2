/**
 * Property / Equipment Management service layer.
 *
 * Offline-first: all writes go to IndexedDB first, then sync queue,
 * then attempt immediate push to Supabase.
 */
import { supabase } from './supabase'
import { succeed, fail, type ServiceResult } from './result'
import { createLogger } from '../Utilities/Logger'
import { addToSyncQueue, removeSyncQueueItemsForRecord } from './offlineDb'
import { emitAudit, updateAuditEvent, deleteAuditEvent, deleteAuditEventsBySubject, deleteTransferAuditForCustody } from './auditService'
import type { PmcsFaultOpened, PmcsFaultCorrected } from './pmcsFold'
import {
  getDb,
  getLocalPropertyItems,
  saveLocalPropertyItem,
  deleteLocalPropertyItem,
  getLocalPropertyItemsByHolder,
  getLocalPropertySubItems,
  getLocalPropertyLocations,
  getAllLocalPropertyLocations,
  saveLocalPropertyLocation,
  deleteLocalPropertyLocation,
  getLocalDiscrepancies,
  saveLocalDiscrepancy,
  saveLocalCustodyEntry,
  deleteLocalCustody,
  getLocalCustodyByReceipt,
  getLocalCustodyByClinic,
  getLocalCustodyByItem,
  getAllLocalCustody,
  getLocalLocationTags,
  getLocalLocationTagsBatch,
  saveLocalLocationTags,
  deleteLocalTagsByTarget,
  getPendingTagCanvasIds,
  getLocalTagCanvasVersion,
  setLocalTagCanvasVersion,
} from './offlineDb'
import { processSyncQueue, isOnline } from './syncService'
import { computeReservedBandTile } from './propertyGeometry'
import { resolvePropertyTargetClinics, sendPropertyEvent, sendPropertyEventsBatch, deletePropertyVaultMessages, type PropertyBatchEvent } from './propertyVault'
import { queuePendingPropertySend, addItemTombstone, addZoneTombstone } from './propertyEventStore'
import { getItemTombstones, getZoneTombstones } from './propertyEventRouting'
import { useAuthStore } from '../stores/useAuthStore'
import type { PropertyEntity, PropertyEventPayload } from './signal/messageContent'
import type {
  PropertyItem,
  PropertyLocation,
  LocationTag,
  CustodyLedgerEntry,
  LocalCustodyEntry,
  Discrepancy,
  LocalPropertyItem,
  LocalPropertyLocation,
  LocalDiscrepancy,
  TransferPayload,
  PropertySearchResult,
  SubItemCheck,
  SyncStatus,
  VisualFingerprint,
  ItemType,
  UnitOfIssue,
} from '../Types/PropertyTypes'

const logger = createLogger('PropertyService')

// ── Helpers ──────────────────────────────────────────────────

function localItem(item: PropertyItem, syncStatus: SyncStatus = 'pending'): LocalPropertyItem {
  return {
    ...item,
    // Coerce for legacy IDB rows cached before signed_out_external existed.
    signed_out_external: item.signed_out_external ?? false,
    // Coerce legacy IDB rows cached before owner_user_id existed. null = cluster-owned.
    owner_user_id: item.owner_user_id ?? null,
    // Coerce legacy IDB rows cached before quantity_authorized existed. null = not tracked.
    quantity_authorized: item.quantity_authorized ?? null,
    // Coerce legacy IDB rows cached before item_type existed. Serialized → SI, else DI
    // (mirrors the spine backfill). unit_of_issue null → EA at read; pack_size null → 1.
    item_type: item.item_type ?? (item.is_serialized ? 'SI' : 'DI'),
    unit_of_issue: item.unit_of_issue ?? null,
    pack_size: item.pack_size ?? null,
    // Coerce legacy IDB rows cached before turned_in_at existed. null = active/on the books.
    turned_in_at: item.turned_in_at ?? null,
    // Coerce legacy rows cached before turn_in_origin_location_id existed.
    turn_in_origin_location_id: item.turn_in_origin_location_id ?? null,
    // Coerce legacy IDB rows cached before represents_location_id existed. null = not a
    // zone-shadow (ordinary item). Set = this item IS a zone's hand-receipt component.
    represents_location_id: item.represents_location_id ?? null,
    _sync_status: syncStatus,
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }
}

function localLocation(loc: PropertyLocation, syncStatus: SyncStatus = 'pending'): LocalPropertyLocation {
  return {
    ...loc,
    _sync_status: syncStatus,
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }
}

function localDiscrepancy(d: Discrepancy, syncStatus: SyncStatus = 'pending'): LocalDiscrepancy {
  return {
    ...d,
    _sync_status: syncStatus,
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }
}

async function immediateSync(userId: string): Promise<void> {
  if (!isOnline()) return
  try {
    await processSyncQueue(userId)
  } catch (err) {
    logger.warn('Immediate sync attempt failed (will retry):', err)
  }
}

// ── Clinic-vault fan-out helpers ─────────────────────────────
// Property is vault-authoritative: every mutation writes IDB + the plaintext
// spine (backstop) AND fans a per-device envelope. originId is an IDB/envelope
// field with no spine column, so it is stripped before the row hits Supabase.

/** Strip client-only fields (originId + sync metadata) before a row hits the spine. */
function toSpine(row: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = { ...row }
  delete r.originId
  delete r._sync_status; delete r._sync_retry_count; delete r._last_sync_error; delete r._last_sync_error_message
  return r
}

/** Build the envelope body for an entity row: keep originId, drop sync metadata. */
function toEnvelope(row: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = { ...row }
  delete r._sync_status; delete r._sync_retry_count; delete r._last_sync_error; delete r._last_sync_error_message
  return r
}

/** Fan a property envelope; on failure queue it for the reconnect drain. */
async function fanProperty(
  userId: string,
  action: 'c' | 'u' | 'd',
  entity: PropertyEntity,
  payload: PropertyEventPayload,
  holderIds: string[],
  authoringClinicId: string | null,
  fanToClinics?: string[],
): Promise<void> {
  try {
    const sent = await sendPropertyEvent(userId, action, entity, payload, fanToClinics)
    if (sent) return
  } catch (e) {
    logger.warn('property fan-out failed, queuing for retry:', e)
  }
  await queuePendingPropertySend({
    key: `${entity}:${payload.id}`, entity, action, payload,
    holderIds: holderIds.filter(Boolean), authoringClinicId,
  }).catch(() => {})
}

// ── Property Items CRUD ──────────────────────────────────────

export async function fetchClinicItems(clinicId: string): Promise<LocalPropertyItem[]> {
  // Load local first for instant display
  const localItems = await getLocalPropertyItems(clinicId)

  // COLD-DEVICE FLOOR ONLY — mirrors the clinic-vault drain's cold gate.
  // processClinicVaultMessages pulls the FULL archive only when there is no
  // snapshot (tailFloor '' ⇒ replay); a warm device with a snapshot decrypts just
  // the tail. The durable table is the clinicvault FLOOR for cold devices, so pull
  // it on the same signal: ONLY when local IDB is empty (cold/fresh device). A
  // warm device is already populated by the clinic snapshot + seq tail (property
  // rides loadSnapshotPropertyItems), so re-pulling the whole table on every
  // init/refresh/picker-open is redundant egress against the floor.
  // Additive only — NEVER delete-local (the clinic-vault drain + tombstones are
  // the sole deletion authority); deleted_at filter + tombstone guard keep a
  // soft-deleted row from painting on the cold pull.
  if (isOnline() && localItems.length === 0) {
    try {
      const { data, error } = await supabase
        .from('property_items')
        .select('*')
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .order('name')

      if (!error && data) {
        const tomb = getItemTombstones()
        const localMap = new Map(localItems.map((r) => [r.id, r]))
        for (const serverRecord of data) {
          if (tomb.has(serverRecord.id)) continue
          const local = localMap.get(serverRecord.id)
          if (!local) {
            await saveLocalPropertyItem(localItem(serverRecord as PropertyItem, 'synced'))
          } else if (local._sync_status !== 'pending') {
            const serverTime = new Date(serverRecord.updated_at).getTime()
            const localTime = new Date(local.updated_at).getTime()
            if (serverTime >= localTime) {
              await saveLocalPropertyItem(localItem(serverRecord as PropertyItem, 'synced'))
            }
          }
        }
      }
    } catch (err) {
      logger.warn('Property bootstrap read failed, using local data:', err)
    }
  }

  return getLocalPropertyItems(clinicId)
}

export async function createItem(
  data: Omit<PropertyItem, 'id' | 'created_at' | 'updated_at' | 'signed_out_external' | 'owner_user_id' | 'quantity_authorized' | 'turned_in_at' | 'item_type' | 'unit_of_issue' | 'pack_size'>
    & { quantity_authorized?: number | null; item_type?: ItemType; unit_of_issue?: UnitOfIssue | null; pack_size?: number | null },
  userId: string,
): Promise<ServiceResult<{ item: LocalPropertyItem }>> {
  try {
    const now = new Date().toISOString()
    // Cross-cluster fan-out: an item follows its holder across clusters.
    const holderIds = data.current_holder_id ? [data.current_holder_id] : []
    const targets = await resolvePropertyTargetClinics(data.clinic_id, holderIds)
    const originId = crypto.randomUUID()
    const item: PropertyItem = {
      ...data,
      signed_out_external: false,
      owner_user_id: null,
      quantity_authorized: data.quantity_authorized ?? null,
      item_type: data.item_type ?? 'DI',
      unit_of_issue: data.unit_of_issue ?? null,
      pack_size: data.pack_size ?? null,
      turned_in_at: null,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      target_clinic_ids: targets,
      originId,
    }

    const local = localItem(item)
    await saveLocalPropertyItem(local)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'property_items',
      record_id: item.id,
      payload: toSpine(item as unknown as Record<string, unknown>),
    })

    await fanProperty(userId, 'c', 'item', {
      id: item.id, clinic_id: item.clinic_id, target_clinic_ids: targets, originId,
      data: toEnvelope(item as unknown as Record<string, unknown>),
    }, holderIds, item.clinic_id)

    // Lifecycle event for the item timeline (best-effort; never throws).
    await emitAudit(
      {
        clinicId: item.clinic_id,
        actorId: userId,
        domain: 'property',
        eventType: 'item.created',
        subjectType: 'item',
        subjectId: item.id,
        occurredAt: now,
        payload: {
          name: item.name,
          nsn: item.nsn,
          serial_number: item.serial_number,
          quantity: item.quantity,
          is_serialized: item.is_serialized,
          condition_code: item.condition_code,
          location_id: item.location_id,
          parent_item_id: item.parent_item_id,
        },
      },
      userId,
    )

    immediateSync(userId)
    return succeed({ item: local })
  } catch (err) {
    return fail(String(err))
  }
}

/** The create payload shape shared by createItem + createItemsBatch. */
export type CreateItemData = Parameters<typeof createItem>[0]

/**
 * Bulk create — the CSV-import fast path. Same per-item local writes as createItem
 * (IDB row + spine sync-queue row + `item.created` audit), but the clinic-vault fan-out is
 * COALESCED into a single sendPropertyEventsBatch pass: the per-clinic device fetch + session
 * prune are paid once for the whole import instead of once per item, and immediateSync runs
 * once at the end. Any entity the batch send couldn't deliver is queued for the reconnect drain
 * (same fallback as the per-item fanProperty path).
 *
 * Returns the created local rows in input order so the store can fold them into a SINGLE state
 * update (one re-render) rather than one set() per item.
 */
export async function createItemsBatch(
  dataList: CreateItemData[],
  userId: string,
): Promise<LocalPropertyItem[]> {
  if (dataList.length === 0) return []

  const now = new Date().toISOString()
  const created: LocalPropertyItem[] = []
  const events: PropertyBatchEvent[] = []
  // Parallel to `events`: the reconnect-drain fallback for each, replayed if the send misses.
  const fallbacks: Array<{ originId: string; entity: 'item'; action: 'c'; payload: PropertyEventPayload; holderIds: string[]; authoringClinicId: string | null }> = []

  for (const data of dataList) {
    const holderIds = data.current_holder_id ? [data.current_holder_id] : []
    const targets = await resolvePropertyTargetClinics(data.clinic_id, holderIds)
    const originId = crypto.randomUUID()
    const item: PropertyItem = {
      ...data,
      signed_out_external: false,
      owner_user_id: null,
      quantity_authorized: data.quantity_authorized ?? null,
      item_type: data.item_type ?? 'DI',
      unit_of_issue: data.unit_of_issue ?? null,
      pack_size: data.pack_size ?? null,
      turned_in_at: null,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      target_clinic_ids: targets,
      originId,
    }

    const local = localItem(item)
    await saveLocalPropertyItem(local)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'property_items',
      record_id: item.id,
      payload: toSpine(item as unknown as Record<string, unknown>),
    })

    const payload: PropertyEventPayload = {
      id: item.id, clinic_id: item.clinic_id, target_clinic_ids: targets, originId,
      data: toEnvelope(item as unknown as Record<string, unknown>),
    }
    events.push({ action: 'c', entity: 'item', payload })
    fallbacks.push({ originId, entity: 'item', action: 'c', payload, holderIds: holderIds.filter(Boolean), authoringClinicId: item.clinic_id })

    // Lifecycle event for the item timeline (best-effort; never throws).
    await emitAudit(
      {
        clinicId: item.clinic_id,
        actorId: userId,
        domain: 'property',
        eventType: 'item.created',
        subjectType: 'item',
        subjectId: item.id,
        occurredAt: now,
        payload: {
          name: item.name,
          nsn: item.nsn,
          serial_number: item.serial_number,
          quantity: item.quantity,
          is_serialized: item.is_serialized,
          condition_code: item.condition_code,
          location_id: item.location_id,
          parent_item_id: item.parent_item_id,
        },
      },
      userId,
    )

    created.push(local)
  }

  // ONE coalesced fan-out for the whole import; queue whatever didn't reach a device.
  const sent = await sendPropertyEventsBatch(userId, events)
  for (const fb of fallbacks) {
    if (sent.has(fb.originId)) continue
    await queuePendingPropertySend({
      key: `${fb.entity}:${fb.payload.id}`, entity: fb.entity, action: fb.action, payload: fb.payload,
      holderIds: fb.holderIds, authoringClinicId: fb.authoringClinicId,
    }).catch(() => {})
  }

  immediateSync(userId)
  return created
}

/** Fields whose change is worth an `item.edited` timeline event (location +
 *  holder get their own move/assign events; quantity churn is handled by
 *  expend/split/merge, which pass skipAudit). */
const AUDITED_EDIT_FIELDS: (keyof PropertyItem)[] = [
  'name', 'nomenclature', 'nsn', 'lin', 'serial_number',
  'condition_code', 'quantity', 'expiry_date', 'notes', 'parent_item_id', 'owner_user_id',
  'quantity_authorized', 'item_type', 'unit_of_issue', 'pack_size',
]

export async function updateItem(
  id: string,
  updates: Partial<PropertyItem>,
  userId: string,
  opts: { skipAudit?: boolean } = {},
): Promise<ServiceResult<{ item: LocalPropertyItem }>> {
  try {
    const db = await getDb()
    const existing = await db.get('propertyItems', id)
    if (!existing) return fail('Item not found')

    // If location changed, remove item's pin from the old zone's canvas
    if (updates.location_id !== undefined && updates.location_id !== existing.location_id) {
      await purgeItemPins(id)
    }

    const now = new Date().toISOString()

    // Cross-cluster retract: resolve the new target set from the (possibly
    // changed) holder. The new envelope fans to UNION(old, new) targets — a
    // dropped cluster receives the update with target_clinic_ids no longer
    // listing it, so its snapshot filter + reap remove it. This is NEVER a 'd'
    // (a global-by-id tombstone would poison the item in a surviving cluster).
    const oldTargets = existing.target_clinic_ids ?? (existing.clinic_id ? [existing.clinic_id] : [])
    const oldOriginId = existing.originId ?? null
    const newHolder = updates.current_holder_id !== undefined ? updates.current_holder_id : existing.current_holder_id
    const holderIds = newHolder ? [newHolder] : []
    // Resolve from the POST-update clinic so a clinic_id change (PCS re-home of a
    // personal item travelling with its member-zone) re-targets to the new cluster.
    // No-op for the common case where clinic_id is unchanged.
    const newClinicId = updates.clinic_id !== undefined ? updates.clinic_id : existing.clinic_id
    const newTargets = await resolvePropertyTargetClinics(newClinicId, holderIds)
    const fanUnion = Array.from(new Set([...oldTargets, ...newTargets]))
    const newOriginId = crypto.randomUUID()

    const updated: LocalPropertyItem = {
      ...existing,
      ...updates,
      target_clinic_ids: newTargets,
      originId: newOriginId,
      updated_at: now,
      _sync_status: 'pending',
    }

    await saveLocalPropertyItem(updated)

    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'property_items',
      record_id: id,
      payload: toSpine({ ...updates, target_clinic_ids: newTargets, updated_at: now }),
    })

    // Drop the old fan-out copies (across every clinic they reached) before the
    // new one lands, so dropped clusters and stale duplicates are cleaned up.
    if (oldOriginId) {
      for (const c of oldTargets) await deletePropertyVaultMessages([oldOriginId], c)
    }
    await fanProperty(userId, 'u', 'item', {
      id, clinic_id: newClinicId, target_clinic_ids: newTargets, originId: newOriginId,
      data: toEnvelope(updated as unknown as Record<string, unknown>),
    }, holderIds, newClinicId, fanUnion)

    // Lifecycle events for the item timeline. One updateItem can carry a move,
    // a reassign, and field edits at once → emit each that actually changed.
    // skipAudit suppresses noise from custody-transfer cascades and qty churn
    // (expend/split/merge), which log their own dedicated events.
    if (!opts.skipAudit) {
      const movedLocation =
        updates.location_id !== undefined && updates.location_id !== existing.location_id
      const reassignedHolder =
        updates.current_holder_id !== undefined &&
        updates.current_holder_id !== existing.current_holder_id
      const changedFields = AUDITED_EDIT_FIELDS.filter(
        (f) => updates[f] !== undefined && updates[f] !== existing[f],
      )

      if (movedLocation) {
        await emitAudit(
          {
            clinicId: existing.clinic_id, actorId: userId, domain: 'property',
            eventType: 'item.moved', subjectType: 'item', subjectId: id, occurredAt: now,
            payload: { from_location_id: existing.location_id, to_location_id: updates.location_id },
          },
          userId,
        )
      }
      if (reassignedHolder) {
        await emitAudit(
          {
            clinicId: existing.clinic_id, actorId: userId, domain: 'property',
            eventType: 'item.assigned', subjectType: 'item', subjectId: id, occurredAt: now,
            payload: { from_holder_id: existing.current_holder_id, to_holder_id: updates.current_holder_id },
          },
          userId,
        )
      }
      if (changedFields.length > 0) {
        // `changed` (keys) drives the timeline label; `changes` (before/after)
        // makes the edit REVERSIBLE — undoLastEvent restores each field to `from`.
        // All AUDITED_EDIT_FIELDS are equipment/accountability vocab (no PHI).
        const changes: Record<string, { from: unknown; to: unknown }> = {}
        for (const f of changedFields) changes[f] = { from: existing[f] ?? null, to: updates[f] ?? null }
        await emitAudit(
          {
            clinicId: existing.clinic_id, actorId: userId, domain: 'property',
            eventType: 'item.edited', subjectType: 'item', subjectId: id, occurredAt: now,
            payload: { changed: changedFields, changes },
          },
          userId,
        )
      }
    }

    immediateSync(userId)
    return succeed({ item: updated })
  } catch (err) {
    return fail(String(err))
  }
}

/** Property subjects a fault/PMCS can attach to: a stock item OR a property
 *  location (a kind='vehicle' zone carries its own 5988). */
export type PropertyFaultSubject = 'item' | 'location'

/**
 * An attached 5988E worksheet. The file is encrypted client-side into the
 * message-attachments bucket via uploadEncryptedAttachment; `key` is the random
 * AES key the recipient needs to decrypt it (rides in the encrypted payload, so
 * the server never sees the plaintext file). No PHI — equipment maintenance.
 */
export interface PmcsDoc {
  path: string
  key: string
  mime?: string
  name?: string
}

/**
 * What a PMCS check submits — the whole check in one shot. Vehicle intake readings
 * (mileage, fuel), the operator who performed it + the optional mechanic who
 * serviced it, an optional 5988E worksheet, AND the faults this check found
 * (`faultsOpened`) or corrected (`faultsCorrected`). Faults are bundled INTO the
 * check (not separate fault.opened/fault.corrected events) so one PMCS = one audit
 * row that states its own outcome. All optional; no PHI (operational vocabulary
 * only — fault text is equipment maintenance, ridden encrypted).
 */
export interface PmcsReadings {
  mileage?: number
  fuelLevel?: number
  operator?: string
  mechanic?: string
  doc?: PmcsDoc
  faultsOpened?: PmcsFaultOpened[]
  faultsCorrected?: PmcsFaultCorrected[]
}

/**
 * What opening a vehicle dispatch records. `exp_date` (ISO date) is when the
 * dispatch authorization expires — the single date driving the expiring/expired
 * fold and the calendar entry. `doc` is the encrypted DA 5982/5987 dispatch form
 * (reuses PmcsDoc + the attachment pipeline). odo_out/note optional. No PHI.
 */
export interface DispatchOpenInput {
  exp_date: string
  doc?: PmcsDoc
  note?: string
  odo_out?: number
  operator?: string
  tc?: string
}

/** What closing (returning) a dispatch records. `dispatches` = the dispatch.opened
 *  event id this return closes; the opened event is left intact for the history. */
export interface DispatchCloseInput {
  dispatches: string
  returned_at: string
  doc?: PmcsDoc
  note?: string
  odo_in?: number
}

/**
 * Record a PMCS (preventive-maintenance check) — the whole check as ONE event. It
 * carries the vehicle readings, an optional 5988E, AND the faults the check found
 * or corrected (bundled in the payload, not separate fault events) so a single row
 * states its outcome ("no new faults" / "new fault: X" / "corrected: Y"). Open
 * faults fold across checks: a faultsCorrected id closes an earlier faultsOpened
 * (or a legacy fault.opened) so it drops off the open list. Everything operational
 * (no PHI) rides the clinic-key-encrypted payload. With NOTHING present (a clean
 * check on a non-vehicle item) the event is spine-only (payload null), so it never
 * defers on a missing clinic key — the original clean-check behaviour.
 */
export async function recordPmcs(
  subjectType: PropertyFaultSubject,
  subjectId: string,
  clinicId: string,
  userId: string,
  readings?: PmcsReadings,
): Promise<ServiceResult> {
  try {
    // Drop empty keys so a reading-less, fault-less, doc-less check stays truly
    // spine-only (payload null → never defers on a missing clinic key).
    const payload: PmcsReadings = {}
    if (readings?.mileage != null) payload.mileage = readings.mileage
    if (readings?.fuelLevel != null) payload.fuelLevel = readings.fuelLevel
    if (readings?.operator) payload.operator = readings.operator
    if (readings?.mechanic) payload.mechanic = readings.mechanic
    if (readings?.doc) payload.doc = readings.doc
    if (readings?.faultsOpened?.length) payload.faultsOpened = readings.faultsOpened
    if (readings?.faultsCorrected?.length) payload.faultsCorrected = readings.faultsCorrected
    const hasContent = Object.keys(payload).length > 0

    const event = await emitAudit(
      {
        clinicId, actorId: userId, domain: 'property',
        eventType: 'pmcs.clear', subjectType, subjectId,
        // readings / 5988E ride in the encrypted payload; null keeps it spine-only.
        payload: hasContent ? payload : null,
      },
      userId,
    )
    if (!event) return fail('Could not record PMCS')

    immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

/**
 * Edit a PMCS history entry's text in place — a fault.opened description or a
 * fault.corrected note. `payload` is the FULL new payload for that event type
 * (e.g. { description } for a fault, { corrects, note } for a correction — the
 * caller preserves `corrects`). Re-encrypts + hard-updates the audit row.
 */
export async function editPmcsEntry(
  eventId: string,
  payload: Record<string, unknown>,
  userId: string,
): Promise<ServiceResult> {
  try {
    const row = await updateAuditEvent(eventId, payload, userId)
    if (!row) return fail('Could not edit entry')
    // Await the push: a hard edit re-writes an existing (often already-synced) row,
    // so the caller's refetch must see the new payload — otherwise the read-through
    // cache re-surfaces the stale server copy over our optimistic edit.
    await immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

/**
 * Delete a PMCS history entry (fault / correction / clean check). Hard-removes
 * the audit row — append-only was relaxed for audit_log on 2026-06-21.
 */
export async function deletePmcsEntry(eventId: string, userId: string): Promise<ServiceResult> {
  try {
    const ok = await deleteAuditEvent(eventId, userId)
    if (!ok) return fail('Could not delete entry')
    // Await the push: the row is hard-deleted server-side, so the caller's refetch
    // must run AFTER the delete lands — otherwise the read-through cache re-fetches
    // and re-persists the still-present server row, resurrecting the entry.
    await immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

/**
 * Put a vehicle on dispatch. Emits an append-only `dispatch.opened` event on the
 * vehicle location (subjectType='location'); the exp date / odometer / dispatch
 * form ride in the encrypted payload (operational, no PHI). The current dispatch
 * is the open `dispatch.opened` with no matching `dispatch.closed`, folded
 * client-side. Returns the event id so a later return can point back at it.
 */
export async function openDispatch(
  subjectId: string,
  clinicId: string,
  userId: string,
  input: DispatchOpenInput,
): Promise<ServiceResult<{ dispatchId: string }>> {
  try {
    const payload: Record<string, unknown> = { exp_date: input.exp_date }
    if (input.doc) payload.doc = input.doc
    if (input.note) payload.note = input.note
    if (input.odo_out != null) payload.odo_out = input.odo_out
    if (input.operator) payload.operator = input.operator
    if (input.tc) payload.tc = input.tc

    const event = await emitAudit(
      {
        clinicId, actorId: userId, domain: 'property',
        eventType: 'dispatch.opened', subjectType: 'location', subjectId,
        payload,
      },
      userId,
    )
    if (!event) return fail('Could not open dispatch')

    immediateSync(userId)
    return succeed({ dispatchId: event.id })
  } catch (err) {
    return fail(String(err))
  }
}

/**
 * Close (return) an open dispatch. Emits a `dispatch.closed` event whose payload
 * points back at the opened event's id via `dispatches`, so the timeline pairs
 * dispatched→returned. The opened event is left intact (full history preserved).
 */
export async function closeDispatch(
  subjectId: string,
  clinicId: string,
  userId: string,
  input: DispatchCloseInput,
): Promise<ServiceResult> {
  try {
    const payload: Record<string, unknown> = {
      dispatches: input.dispatches,
      returned_at: input.returned_at,
    }
    if (input.doc) payload.doc = input.doc
    if (input.note) payload.note = input.note
    if (input.odo_in != null) payload.odo_in = input.odo_in

    const event = await emitAudit(
      {
        clinicId, actorId: userId, domain: 'property',
        eventType: 'dispatch.closed', subjectType: 'location', subjectId,
        payload,
      },
      userId,
    )
    if (!event) return fail('Could not close dispatch')

    immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

export async function deleteItem(
  id: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    const db = await getDb()
    const existing = await db.get('propertyItems', id)
    const clinicId = existing?.clinic_id ?? null
    const targets = existing?.target_clinic_ids ?? (clinicId ? [clinicId] : [])
    const now = new Date().toISOString()

    // Durable tombstone (in-memory + persisted) so replay / snapshot bootstrap
    // can never resurrect this item on any device.
    getItemTombstones().add(id)
    addItemTombstone(id).catch(() => {})

    await deleteLocalPropertyItem(id)
    await purgeItemPins(id)

    // Drop any outstanding create/update for this item first — a failed create
    // (FK, RLS) would otherwise be retried after the delete and re-insert a live
    // row. Then enqueue the soft-delete.
    await removeSyncQueueItemsForRecord(userId, 'property_items', id)

    // Spine soft-delete (UPDATE deleted_at) — NOT a hard DELETE. Reconcile can't
    // resurrect, and a device dark past any reap still pulls the tombstone on its
    // next bootstrap (the spine row with deleted_at survives indefinitely).
    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'property_items',
      record_id: id,
      payload: { deleted_at: now, updated_at: now },
    })

    // Durable per-device 'd' envelope — consumed on each device's drain.
    const originId = crypto.randomUUID()
    await fanProperty(userId, 'd', 'item', {
      id, clinic_id: clinicId ?? undefined, target_clinic_ids: targets, originId, data: { id },
    }, [], clinicId)

    // Take the item's history with it: cascade hard-delete every audit_log row
    // for this subject (item.created/moved/assigned/transferred/edited/expended,
    // PMCS, dispatch). We do NOT emit a trailing item.deleted event — the user's
    // intent is for the history to disappear, not to leave a lone tombstone row
    // that would still surface in the clinic-wide weekly activity feed.
    await deleteAuditEventsBySubject(id, userId, { clinicId: clinicId ?? undefined })

    // Await the flush so the enqueued audit deletes (and the spine soft-delete)
    // land BEFORE the caller's invalidate → refetch re-reads audit_log; an
    // un-awaited sync would race the read-through cache and resurrect the rows.
    await immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

export async function fetchItemsByHolder(holderId: string): Promise<LocalPropertyItem[]> {
  return getLocalPropertyItemsByHolder(holderId)
}

export async function fetchSubItems(parentId: string): Promise<LocalPropertyItem[]> {
  return getLocalPropertySubItems(parentId)
}

// ── Property Locations CRUD ──────────────────────────────────

export async function fetchClinicLocations(clinicId: string): Promise<LocalPropertyLocation[]> {
  const localLocs = await getLocalPropertyLocations(clinicId)

  // COLD-DEVICE FLOOR ONLY — same cold gate as fetchClinicItems (mirrors the
  // clinic-vault drain: pull the durable floor only when local IDB is empty).
  // Warm devices are populated by the clinic snapshot + tail; the full pull is
  // redundant egress otherwise. Additive only — no delete-local pass.
  if (isOnline() && localLocs.length === 0) {
    try {
      const { data, error } = await supabase
        .from('property_locations')
        .select('*')
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .order('name')

      if (!error && data) {
        const tomb = getZoneTombstones()
        const localMap = new Map(localLocs.map((r) => [r.id, r]))
        for (const serverRecord of data) {
          if (tomb.has(serverRecord.id)) continue
          const local = localMap.get(serverRecord.id)
          if (!local || (local._sync_status !== 'pending' && new Date(serverRecord.updated_at).getTime() >= new Date(local.updated_at).getTime())) {
            await saveLocalPropertyLocation(localLocation(serverRecord as PropertyLocation, 'synced'))
          }
        }
      }
    } catch (err) {
      logger.warn('Location bootstrap read failed:', err)
    }
  }

  return getLocalPropertyLocations(clinicId)
}

export async function createLocation(
  data: Omit<PropertyLocation, 'id' | 'created_at' | 'updated_at'>,
  userId: string,
): Promise<ServiceResult<{ location: LocalPropertyLocation }>> {
  try {
    const now = new Date().toISOString()
    const originId = crypto.randomUUID()
    // A member-zone (holder_user_id set) follows its holder across clusters, so its
    // fan-out targets = holder's [home, ...loans]. A plain physical zone (BAS, rooms;
    // holder null) stays clinic-pinned. See personal-zone-pcs-rehome.md §3.3.
    const holderIds = data.holder_user_id ? [data.holder_user_id] : []
    const targets = data.holder_user_id
      ? await resolvePropertyTargetClinics(data.clinic_id, holderIds)
      : (data.clinic_id ? [data.clinic_id] : [])
    const location: PropertyLocation = {
      ...data,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      target_clinic_ids: targets,
      originId,
    }

    const local = localLocation(location)
    await saveLocalPropertyLocation(local)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'property_locations',
      record_id: location.id,
      payload: toSpine(location as unknown as Record<string, unknown>),
    })

    await fanProperty(userId, 'c', 'zone', {
      id: location.id, clinic_id: location.clinic_id, target_clinic_ids: targets, originId,
      data: toEnvelope(location as unknown as Record<string, unknown>),
    }, holderIds, location.clinic_id)

    immediateSync(userId)
    return succeed({ location: local })
  } catch (err) {
    return fail(String(err))
  }
}

export async function updateLocation(
  id: string,
  updates: Partial<PropertyLocation>,
  userId: string,
): Promise<ServiceResult> {
  try {
    const db = await getDb()
    const existing = await db.get('propertyLocations', id)
    if (!existing) return fail('Location not found')

    const now = new Date().toISOString()
    // Holder/clinic-aware re-targeting (mirrors updateItem). A member-zone follows
    // its holder; a clinic_id change (PCS re-home) re-targets to the new cluster and
    // RETRACTS the old copies — never a 'd' (a global tombstone would poison the zone
    // in a surviving cluster). For a plain physical zone (holder null) with no clinic
    // change this resolves to the same [clinic_id] as before. See
    // personal-zone-pcs-rehome.md §3.3 / §5.
    const oldTargets = existing.target_clinic_ids ?? (existing.clinic_id ? [existing.clinic_id] : [])
    const oldOriginId = existing.originId ?? null
    const newHolder = updates.holder_user_id !== undefined ? updates.holder_user_id : existing.holder_user_id
    const newClinicId = updates.clinic_id !== undefined ? updates.clinic_id : existing.clinic_id
    const holderIds = newHolder ? [newHolder] : []
    const newTargets = newHolder
      ? await resolvePropertyTargetClinics(newClinicId, holderIds)
      : (newClinicId ? [newClinicId] : [])
    const fanUnion = Array.from(new Set([...oldTargets, ...newTargets]))
    const newOriginId = crypto.randomUUID()
    const updated: LocalPropertyLocation = {
      ...existing,
      ...updates,
      target_clinic_ids: newTargets,
      originId: newOriginId,
      updated_at: now,
      _sync_status: 'pending',
    }

    await saveLocalPropertyLocation(updated)

    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'property_locations',
      record_id: id,
      payload: toSpine({ ...updates, target_clinic_ids: newTargets, updated_at: now }),
    })

    if (oldOriginId) {
      for (const c of oldTargets) await deletePropertyVaultMessages([oldOriginId], c)
    }
    await fanProperty(userId, 'u', 'zone', {
      id, clinic_id: newClinicId, target_clinic_ids: newTargets, originId: newOriginId,
      data: toEnvelope(updated as unknown as Record<string, unknown>),
    }, holderIds, newClinicId, fanUnion)

    immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

export async function deleteLocation(
  id: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    const db = await getDb()
    const existing = await db.get('propertyLocations', id)
    const clinicId = existing?.clinic_id ?? null
    const targets = existing?.target_clinic_ids ?? (clinicId ? [clinicId] : [])
    const now = new Date().toISOString()

    getZoneTombstones().add(id)
    addZoneTombstone(id).catch(() => {})

    await deleteLocalPropertyLocation(id)

    // Remove the deleted zone's tile from every canvas it sat on, then queue a
    // DURABLE full-canvas tag-sync for each affected canvas — not an online-only
    // direct delete. An offline delete must still remove the server tag on
    // reconnect; otherwise the geometry-aware reconcile re-adds the tile from the
    // surviving server row (resurrection via the Supabase channel).
    const affectedTagCanvases = await deleteLocalTagsByTarget(id)
    for (const canvasId of affectedTagCanvases) await queueTagSync(canvasId)

    // Drop any outstanding create/update for this zone first — a failed create
    // (e.g. parent_id FK not yet satisfiable) would otherwise be retried after the
    // delete and re-insert a live row. Then enqueue the soft-delete.
    await removeSyncQueueItemsForRecord(userId, 'property_locations', id)

    // Spine soft-delete (UPDATE) — never a hard DELETE.
    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'property_locations',
      record_id: id,
      payload: { deleted_at: now, updated_at: now },
    })

    const originId = crypto.randomUUID()
    await fanProperty(userId, 'd', 'zone', {
      id, clinic_id: clinicId ?? undefined, target_clinic_ids: targets, originId, data: { id },
    }, [], clinicId)

    immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

/**
 * Cascade-delete a location and all its descendants.
 * - Recursively finds all descendant location IDs via parent_id
 * - Deletes all location_tags referencing those IDs
 * - Reassigns orphaned items to the parent location (or null)
 * - Deletes the locations themselves
 */
export async function cascadeDeleteLocation(
  locationId: string,
  userId: string,
  clinicId: string,
): Promise<ServiceResult> {
  try {
    const allLocations = await getLocalPropertyLocations(clinicId)

    // Find all descendant IDs recursively
    const toDelete = new Set<string>([locationId])
    let changed = true
    while (changed) {
      changed = false
      for (const loc of allLocations) {
        if (loc.parent_id && toDelete.has(loc.parent_id) && !toDelete.has(loc.id)) {
          toDelete.add(loc.id)
          changed = true
        }
      }
    }

    // Find the parent of the root location being deleted (for orphan reassignment)
    const rootLoc = allLocations.find((l) => l.id === locationId)
    const reassignParentId = rootLoc?.parent_id ?? null

    // Reassign items at any of these locations to the parent
    const items = await getLocalPropertyItems(clinicId)
    for (const item of items) {
      if (item.location_id && toDelete.has(item.location_id)) {
        const now = new Date().toISOString()
        const targets = item.target_clinic_ids ?? (item.clinic_id ? [item.clinic_id] : [])
        const oldOriginId = item.originId ?? null
        const newOriginId = crypto.randomUUID()
        const reassigned: LocalPropertyItem = {
          ...item,
          location_id: reassignParentId,
          target_clinic_ids: targets,
          originId: newOriginId,
          updated_at: now,
          _sync_status: 'pending',
        }
        await saveLocalPropertyItem(reassigned)
        await addToSyncQueue({
          user_id: userId,
          action: 'update',
          table_name: 'property_items',
          record_id: item.id,
          payload: toSpine({ location_id: reassignParentId, updated_at: now }),
        })
        if (oldOriginId) { for (const c of targets) await deletePropertyVaultMessages([oldOriginId], c) }
        await fanProperty(userId, 'u', 'item', {
          id: item.id, clinic_id: item.clinic_id, target_clinic_ids: targets, originId: newOriginId,
          data: toEnvelope(reassigned as unknown as Record<string, unknown>),
        }, item.current_holder_id ? [item.current_holder_id] : [], item.clinic_id)
      }
    }

    // Delete tags referencing any of these locations. Durable full-canvas
    // tag-sync per affected canvas (not online-only) so an offline cascade still
    // removes the server tags on reconnect instead of having them resurrected.
    for (const locId of toDelete) {
      const affectedTagCanvases = await deleteLocalTagsByTarget(locId)
      for (const canvasId of affectedTagCanvases) await queueTagSync(canvasId)
    }

    // Delete the locations themselves (soft-delete spine + 'd' zone envelope)
    const locById = new Map(allLocations.map(l => [l.id, l]))
    for (const locId of toDelete) {
      const loc = locById.get(locId)
      const targets = loc?.target_clinic_ids ?? (clinicId ? [clinicId] : [])
      const now = new Date().toISOString()
      getZoneTombstones().add(locId)
      addZoneTombstone(locId).catch(() => {})
      await deleteLocalPropertyLocation(locId)
      // Drop any outstanding create/update so a failed create can't resurrect it.
      await removeSyncQueueItemsForRecord(userId, 'property_locations', locId)
      await addToSyncQueue({
        user_id: userId,
        action: 'update',
        table_name: 'property_locations',
        record_id: locId,
        payload: { deleted_at: now, updated_at: now },
      })
      const originId = crypto.randomUUID()
      await fanProperty(userId, 'd', 'zone', {
        id: locId, clinic_id: loc?.clinic_id ?? clinicId ?? undefined, target_clinic_ids: targets, originId, data: { id: locId },
      }, [], loc?.clinic_id ?? clinicId)
    }

    immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

// ── Member Locations ─────────────────────────────────────────

/** Collect a location and all its parent_id descendants from a flat location list. */
function collectSubtreeLocationIds(rootId: string, locs: LocalPropertyLocation[]): Set<string> {
  const ids = new Set<string>([rootId])
  let changed = true
  while (changed) {
    changed = false
    for (const l of locs) {
      if (l.parent_id && ids.has(l.parent_id) && !ids.has(l.id)) { ids.add(l.id); changed = true }
    }
  }
  return ids
}

/**
 * STRAND the cluster-owned items under a (departed member's) zone up to that
 * cluster's canvas. Only owner_user_id === null (cluster property) is reassigned;
 * personally-owned items are left in place (they travel with the zone on re-home).
 * The zone itself is NOT deleted/tombstoned here — see ensureMemberLocations.
 */
async function strandClusterItemsUnder(
  zoneRootId: string,
  clinicId: string,
  userId: string,
  locs: LocalPropertyLocation[],
): Promise<void> {
  const subtree = collectSubtreeLocationIds(zoneRootId, locs)
  const strandTo = locs.find(l => l.id === zoneRootId)?.parent_id ?? null
  const items = await getLocalPropertyItems(clinicId)
  for (const item of items) {
    if (item.location_id && subtree.has(item.location_id) && (item.owner_user_id ?? null) === null) {
      await updateItem(item.id, { location_id: strandTo }, userId)
    }
  }
}

/**
 * RE-HOME the current user's member-zone subtree into a new cluster on PCS arrival.
 * Re-publishes from the owner's own local copy (never a pull from the old vault):
 *   1. STRAND cluster-owned (owner null) descendants up to the OLD canvas FIRST,
 *      while the subtree is still resolvable in the old clinic (best-effort — the old
 *      cluster's own ensureMemberLocations is the authoritative stranding side).
 *   2. RE-HOME the zone (re-parented to the new canvas) + sub-zones to the new clinic;
 *      updateLocation holder-routes + retracts the old copies (never a 'd').
 *   3. CARRY the owner's own items into the new clinic.
 * See personal-zone-pcs-rehome.md §5 Phase 3 / §6.
 */
async function rehomeMemberZone(
  zone: LocalPropertyLocation,
  newClinicId: string,
  newRootId: string,
  userId: string,
): Promise<void> {
  const oldClinicId = zone.clinic_id
  const oldLocs = await getLocalPropertyLocations(oldClinicId)
  const subtree = collectSubtreeLocationIds(zone.id, oldLocs)
  const items = await getLocalPropertyItems(oldClinicId)

  // 1) strand cluster-owned descendants (stay in the old cluster)
  const strandTo = zone.parent_id ?? null
  for (const item of items) {
    if (item.location_id && subtree.has(item.location_id) && (item.owner_user_id ?? null) === null) {
      await updateItem(item.id, { location_id: strandTo }, userId)
    }
  }
  // 2) re-home the zone + sub-zones to the new cluster
  await updateLocation(zone.id, { clinic_id: newClinicId, parent_id: newRootId }, userId)
  for (const id of subtree) {
    if (id !== zone.id) await updateLocation(id, { clinic_id: newClinicId }, userId)
  }
  // 3) carry ALL the owner's own items. Personal property (owner_user_id === me)
  //    TRAVELS with its owner regardless of where it sits — inside the re-homing
  //    zone, the clinic pool (location null), or another old-cluster zone. Keep the
  //    location only when it re-homes with us (in the subtree); otherwise drop the
  //    item into the new clinic's pool so it can't dangle at a stranded location.
  for (const item of items) {
    if (item.owner_user_id !== userId) continue
    const locTravels = item.location_id != null && subtree.has(item.location_id)
    await updateItem(
      item.id,
      locTravels ? { clinic_id: newClinicId } : { clinic_id: newClinicId, location_id: null },
      userId,
      { skipAudit: true },
    )
  }
}

/**
 * COLD-DEVICE ADOPT — spine fallback for the PCS re-home. When the arriving user
 * has NO local copy of a prior member-zone (fresh device / cleared cache / a device
 * that never loaded the losing cluster), hydrate it from spine so rehomeMemberZone
 * can adopt + re-publish it, instead of ensureMemberLocations minting a fresh EMPTY
 * zone. Minting empty is the "personal zone wiped on cluster switch" bug — the
 * owner's real zone + owner-marked items are left stranded in the losing cluster.
 *
 * Only rows the OWNER/HOLDER self-RLS clauses expose are reachable off-cluster:
 * property_locations WHERE holder_user_id = auth.uid() and property_items WHERE
 * owner_user_id = auth.uid(). Sub-zones (holder_user_id null) are NOT exposed by
 * RLS, so un-owned sub-zone structure can't be recovered cold — a known limitation
 * until the self-clause is widened to the subtree. Returns the hydrated FOREIGN
 * member-zones (those not already in the current clinic), oldest-first.
 * See personal-zone-pcs-rehome.md §5 Phase 1/3 (the deferred cold-device spine pull).
 */
async function hydrateOwnPortableProperty(
  userId: string,
  currentClinicId: string,
): Promise<LocalPropertyLocation[]> {
  if (!isOnline()) return []
  try {
    const [locRes, itemRes] = await Promise.all([
      supabase.from('property_locations').select('*')
        .eq('holder_user_id', userId).is('deleted_at', null),
      supabase.from('property_items').select('*')
        .eq('owner_user_id', userId).is('deleted_at', null),
    ])

    const db = await getDb()
    const out: LocalPropertyLocation[] = []

    if (locRes.data) {
      const tomb = getZoneTombstones()
      for (const rec of locRes.data) {
        if (tomb.has(rec.id) || rec.clinic_id === currentClinicId) continue
        const existing = await db.get('propertyLocations', rec.id)
        if (existing && existing._sync_status === 'pending') { out.push(existing); continue }
        const local = localLocation(rec as PropertyLocation, 'synced')
        await saveLocalPropertyLocation(local)
        out.push(local)
      }
    }
    if (itemRes.data) {
      const tomb = getItemTombstones()
      for (const rec of itemRes.data) {
        if (tomb.has(rec.id) || rec.clinic_id === currentClinicId) continue
        const existing = await db.get('propertyItems', rec.id)
        if (existing && existing._sync_status === 'pending') continue
        await saveLocalPropertyItem(localItem(rec as PropertyItem, 'synced'))
      }
    }

    out.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    return out
  } catch (err) {
    logger.warn('Cold-device portable-property adopt failed:', err)
    return []
  }
}

/**
 * Eagerly ensure every clinic member has a real persisted location record.
 * Called on drawer open. Creates missing member-locations, renames stale ones,
 * and places a default zone on the root canvas for any newly created record.
 */
export async function ensureMemberLocations(
  clinicId: string,
  userId: string,
  members: import('../Types/PropertyTypes').HolderInfo[],
  rootLocationId: string,
): Promise<void> {
  const allLocs = await getLocalPropertyLocations(clinicId)
  const memberLocMap = new Map<string, LocalPropertyLocation>()
  for (const loc of allLocs) {
    if (loc.holder_user_id) memberLocMap.set(loc.holder_user_id, loc)
  }

  // DEDUP duplicate member-zones for the same holder. A PCS race can mint two: a
  // placeholder created by a teammate's device while my real (content-bearing) zone
  // re-homes in. Keep the OLDEST (the re-homed zone retains its original created_at,
  // so it sorts before a fresh placeholder); delete EMPTY duplicates only — a throwaway
  // id never re-homed, so its tombstone can't poison the surviving zone.
  const byHolder = new Map<string, LocalPropertyLocation[]>()
  for (const loc of allLocs) {
    if (!loc.holder_user_id) continue
    const arr = byHolder.get(loc.holder_user_id) ?? []
    arr.push(loc)
    byHolder.set(loc.holder_user_id, arr)
  }
  const dupHolders = [...byHolder].filter(([, zs]) => zs.length > 1)
  if (dupHolders.length > 0) {
    const clinicItems = await getLocalPropertyItems(clinicId)
    for (const [holderId, zones] of dupHolders) {
      const sorted = [...zones].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      const keep = sorted[0]
      for (const z of sorted.slice(1)) {
        const subtree = collectSubtreeLocationIds(z.id, allLocs)
        const hasChildZone = allLocs.some(l => l.id !== z.id && subtree.has(l.id))
        const hasItems = clinicItems.some(i => i.location_id && subtree.has(i.location_id))
        if (!hasChildZone && !hasItems) await cascadeDeleteLocation(z.id, userId, clinicId)
      }
      memberLocMap.set(holderId, keep)
    }
  }

  // DEPARTED MEMBERS → STORAGE. A member-zone TRAVELS with its holder (re-homed from
  // the holder's OWN device on PCS arrival), so we must NOT cascade-delete/tombstone a
  // departed holder's zone here — a global tombstone would poison the owner's re-homed
  // copy (no-resurrect). But it must also NOT accumulate as a visible stale location
  // (users who never open the app at the new unit would stack zones forever). So a
  // departed zone goes into STORAGE — a durable, owner-readable row that is INVISIBLE
  // in this cluster: (1) STRAND its cluster-owned (owner null) items up to the root
  // pool; (2) REMOVE its canvas tile so it leaves the map; (3) the cluster tree/list
  // filters it out by roster (PropertyPanel visibleLocations). It rests in storage
  // until the owner RE-HOMES it (PCS) or the account is DELETED (the only sanctioned
  // tombstone — the user is gone for good, so no re-home can be poisoned). CONTRACT in
  // personal-zone-pcs-rehome.md §5a. Guarded on a non-empty roster so a transient/failed
  // member load can't sweep everyone into storage.
  if (members.length > 0) {
    const memberIds = new Set(members.map(m => m.id))
    for (const [holderId, loc] of memberLocMap) {
      if (!memberIds.has(holderId) && loc.clinic_id === clinicId) {
        await strandClusterItemsUnder(loc.id, clinicId, userId, allLocs)
        // Drop the storage zone's canvas tile (placement only; tag ≠ zone identity, so
        // this is clinic-local and safe — never touches the zone row or its vault copy).
        const affected = await deleteLocalTagsByTarget(loc.id)
        for (const canvasId of affected) await queueTagSync(canvasId)
      }
    }
  }

  // SELF-HEAL orphans: a cluster-owned (owner null) item whose location no longer
  // resolves (its zone was re-homed to another cluster) is reassigned up to the root
  // canvas so it can't dangle invisibly. Personally-owned items are their owner's
  // concern (they travel with the zone), so they're left alone.
  const liveLocIds = new Set(allLocs.map(l => l.id))
  for (const item of await getLocalPropertyItems(clinicId)) {
    if (item.location_id && !liveLocIds.has(item.location_id) && (item.owner_user_id ?? null) === null) {
      await updateItem(item.id, { location_id: rootLocationId }, userId)
    }
  }

  // Every current member's zone id+name — drives canvas tiling below. Collected for
  // existing, freshly-created, AND re-homed/adopted zones so we can HEAL a missing tile
  // (a returning member whose tile was dropped while they were in storage re-acquires one).
  const desiredTiles: { id: string; name: string }[] = []

  for (const member of members) {
    const existing = memberLocMap.get(member.id)
    if (existing) {
      // COLD-DEVICE RE-ADOPT: my current-cluster member-zone may be a fresh EMPTY
      // placeholder — minted by ensureMemberLocations before my prior zone was
      // reachable, or by a teammate's device in a PCS race — while my real, older
      // zone still lives in the losing cluster (readable on spine via the holder
      // self-RLS clause). Pull + re-home it so my identity and owner-marked items
      // land here, then reap the empty placeholder. Gated on an EMPTY existing zone
      // (mirrors the dedup emptiness test) so a content-bearing zone is never
      // silently displaced. This is what self-heals a switch that already minted.
      if (member.id === userId && isOnline()) {
        const sub = collectSubtreeLocationIds(existing.id, allLocs)
        const clinicItems = await getLocalPropertyItems(clinicId)
        const hasChild = allLocs.some(l => l.id !== existing.id && sub.has(l.id))
        const hasItems = clinicItems.some(i => i.location_id && sub.has(i.location_id))
        if (!hasChild && !hasItems) {
          const older = (await hydrateOwnPortableProperty(userId, clinicId)).find(
            l => !l.deleted_at && l.clinic_id !== clinicId
              && (l.created_at ?? '') < (existing.created_at ?? ''),
          )
          if (older) {
            await rehomeMemberZone(older, clinicId, rootLocationId, userId)
            await cascadeDeleteLocation(existing.id, userId, clinicId)
            desiredTiles.push({ id: older.id, name: member.displayName })
            continue
          }
        }
      }
      if (existing.name !== member.displayName) {
        await updateLocation(existing.id, { name: member.displayName }, userId)
      }
      desiredTiles.push({ id: existing.id, name: member.displayName })
      continue
    }
    // No member-zone for this member in THIS cluster yet.
    if (member.id === userId) {
      // ADOPT-NOT-RECREATE: I may already own a member-zone keyed to my previous
      // cluster (PCS in transit). Re-home it here from my own local copy instead of
      // minting an empty one — carrying my structure + my items, stranding cluster
      // gear.
      let mine = (await getAllLocalPropertyLocations()).find(
        l => l.holder_user_id === userId && l.clinic_id !== clinicId && !l.deleted_at,
      )
      // COLD DEVICE: my prior zone isn't in local IDB. Pull it (+ my owned items)
      // from spine via the owner/holder self-RLS clauses before falling through to a
      // fresh empty mint — otherwise my real zone + owner-marked gear stay stranded
      // in the losing cluster ("personal zone wiped on cluster switch").
      if (!mine) {
        const hydrated = await hydrateOwnPortableProperty(userId, clinicId)
        mine = hydrated.find(l => !l.deleted_at && l.clinic_id !== clinicId)
      }
      if (mine) {
        await rehomeMemberZone(mine, clinicId, rootLocationId, userId)
        desiredTiles.push({ id: mine.id, name: member.displayName })
        continue
      }
    }
    const result = await createLocation(
      {
        clinic_id: clinicId,
        parent_id: rootLocationId,
        name: member.displayName,
        photo_data: null,
        holder_user_id: member.id,
        created_by: userId,
      },
      userId,
    )
    if (result.success) {
      desiredTiles.push({ id: result.location.id, name: member.displayName })
    }
  }

  // Tile any desired member-zone that lacks a root-canvas tile — covers freshly
  // created, re-homed/adopted, AND returning-from-storage members (whose tile was
  // dropped on departure). Steady state (all tiled) → missing is empty → no-op.
  const existingTags = await fetchLocationTags(rootLocationId)
  const taggedTargets = new Set(
    existingTags.filter(t => t.target_type === 'location').map(t => t.target_id),
  )
  const missingTiles = desiredTiles.filter(z => !taggedTargets.has(z.id))
  if (missingTiles.length === 0) return

  // Personnel zones are RESERVED family → the hidden bottom band, not the top grid.
  // Band index counts only already-tiled reserved zones (holder_user_id OR
  // is_turn_in_zone), so it never collides with (or is inflated by) user-drawn zones.
  const reservedIds = new Set(
    allLocs.filter(l => l.holder_user_id != null || l.is_turn_in_zone).map(l => l.id),
  )
  const reservedTagCount = existingTags.filter(
    t => t.target_type === 'location' && reservedIds.has(t.target_id),
  ).length
  const additionalTags = missingTiles.map(({ id: locId, name }, i) => {
    const tile = computeReservedBandTile(reservedTagCount + i)
    return {
      id: crypto.randomUUID(),
      location_id: rootLocationId,
      target_type: 'location' as const,
      target_id: locId,
      ...tile,
      label: name,
    }
  })
  await upsertLocationTags(rootLocationId, [...existingTags, ...additionalTags])
}

/**
 * Ensure the clinic has exactly one default cluster zone (the battalion aid
 * station, BAS) as a physical zone under the root canvas — the sibling-to-
 * personnel-zones counterpart of {@link ensureMemberLocations}. Additive and
 * idempotent: created once on first drawer open, then skipped. This zone is the
 * default `room_id` target for calendar events (the cluster's standing location).
 */
export async function ensureDefaultClusterZone(
  clinicId: string,
  userId: string,
  rootLocationId: string,
): Promise<void> {
  const allLocs = await getLocalPropertyLocations(clinicId)
  const existingDefault = allLocs.find(l => l.is_default_zone)
  if (existingDefault) {
    // Self-heal legacy rows: the default zone is a top-level physical zone and
    // must follow the parent_id:null convention used by every zone drawn on the
    // root canvas. Older BAS rows were created under the root location id, which
    // hid them from the location tree / list / sheet (those surfaces treat
    // parent_id===null as top-level) even though the map still rendered them via
    // the root-canvas tag. Re-home to null so the concept becomes visible.
    if ((existingDefault.parent_id ?? null) !== null) {
      await updateLocation(existingDefault.id, { parent_id: null }, userId)
    }
    return
  }

  const result = await createLocation(
    {
      clinic_id: clinicId,
      parent_id: null,
      name: DEFAULT_CLUSTER_ZONE_NAME,
      photo_data: null,
      holder_user_id: null,
      is_default_zone: true,
      created_by: userId,
    },
    userId,
  )
  if (!result.success) return

  // Place its zone tile on the root canvas, after any existing zones.
  const existingTags = await fetchLocationTags(rootLocationId)
  // BAS stays in the TOP grid, but its index must count only NON-reserved tiles so
  // the reserved-family band (personnel + turn-in zones) never inflates its slot.
  const reservedIds = new Set(
    allLocs.filter(l => l.holder_user_id != null || l.is_turn_in_zone).map(l => l.id),
  )
  const normalCount = existingTags.filter(
    t => t.target_type === 'location' && !reservedIds.has(t.target_id),
  ).length
  const col = normalCount % 4
  const row = Math.floor(normalCount / 4)
  await upsertLocationTags(rootLocationId, [
    ...existingTags,
    {
      id: crypto.randomUUID(),
      location_id: rootLocationId,
      target_type: 'location' as const,
      target_id: result.location.id,
      x: 0.05 + col * 0.23,
      y: 0.05 + row * 0.18,
      width: 0.2,
      height: 0.14,
      label: DEFAULT_CLUSTER_ZONE_NAME,
    },
  ])
}

/**
 * Ensure the cluster's DA 3161 turn-in staging zone exists (one per clinic; mirrors
 * ensureDefaultClusterZone/BAS): a standing, non-deletable property_location that items
 * relocate INTO when staged for turn-in. NO canvas tag is placed here — the tile is
 * toggled on the root canvas by {@link syncTurnInZoneTag} so the zone shows on the map
 * only while it holds staged items (conditionally rendered, like a personnel zone).
 * Idempotent; returns the zone id (null only if creation failed).
 */
export async function ensureTurnInZone(clinicId: string, userId: string): Promise<string | null> {
  const allLocs = await getLocalPropertyLocations(clinicId)
  const existing = allLocs.find(l => l.is_turn_in_zone)
  if (existing) {
    // Self-heal: the bucket is a top-level zone (parent_id null) like BAS so the tree /
    // list / sheet treat it as a root. Re-home legacy rows nested under the root id.
    if ((existing.parent_id ?? null) !== null) {
      await updateLocation(existing.id, { parent_id: null }, userId)
    }
    return existing.id
  }
  const result = await createLocation(
    {
      clinic_id: clinicId,
      parent_id: null,
      name: TURN_IN_ZONE_NAME,
      photo_data: null,
      holder_user_id: null,
      is_turn_in_zone: true,
      created_by: userId,
    },
    userId,
  )
  return result.success ? result.location.id : null
}

/**
 * Toggle the turn-in zone's tile on the root canvas to match its populated state: a
 * root-canvas tag exists IFF the zone holds ≥1 staged (active, not-yet-verified) item, so
 * the map renders the staging zone only while pending. Call after every stage / unstage /
 * verify. No-op when the cluster has no turn-in zone or no root yet.
 */
async function syncTurnInZoneTag(clinicId: string, userId: string): Promise<void> {
  const locs = await getLocalPropertyLocations(clinicId)
  const zone = locs.find(l => l.is_turn_in_zone)
  if (!zone) return
  const root = locs.find(l => l.name === ROOT_LOCATION_NAME && (l.parent_id ?? null) === null)
  if (!root) return
  const items = await getLocalPropertyItems(clinicId)
  const populated = items.some(i => i.location_id === zone.id && !i.deleted_at && !i.turned_in_at)
  const tags = await fetchLocationTags(root.id)
  const hasTag = tags.some(t => t.target_type === 'location' && t.target_id === zone.id)
  if (populated && !hasTag) {
    // Turn-in zone is RESERVED family → hidden bottom band, indexed by the count of
    // already-tiled reserved zones (personnel + turn-in), NOT all tags.
    const reservedIds = new Set(
      locs.filter(l => l.holder_user_id != null || l.is_turn_in_zone).map(l => l.id),
    )
    const bandIndex = tags.filter(
      t => t.target_type === 'location' && reservedIds.has(t.target_id),
    ).length
    const tile = computeReservedBandTile(bandIndex)
    await upsertLocationTags(root.id, [
      ...tags,
      {
        id: crypto.randomUUID(),
        location_id: root.id,
        target_type: 'location' as const,
        target_id: zone.id,
        ...tile,
        label: TURN_IN_ZONE_NAME,
      },
    ])
  } else if (!populated && hasTag) {
    await upsertLocationTags(root.id, tags.filter(t => !(t.target_type === 'location' && t.target_id === zone.id)))
  }
}

/**
 * One-time, idempotent HEAL that migrates any reserved-family root tiles (personnel
 * zones with holder_user_id set + the turn-in staging zone) into the hidden bottom
 * band. The band placers ({@link ensureMemberLocations}, syncTurnInZoneTag) are
 * place-if-MISSING, so a reserved zone tiled by the OLD top grid before the band
 * existed stays stranded up top and never migrates. This packs every reserved tile
 * into contiguous band slots.
 *
 * Slot assignment is deterministic across devices: reserved tags are sorted by a
 * STABLE key (target_id) before indexing, because location-tags fan out vault-
 * authoritative to peers — a non-deterministic order would make geometry flip-flop
 * device-to-device. Geometry-only: writes tile x/y/width/height, preserves every
 * other tag field, and NEVER deletes a zone row or emits a tombstone/deleted_at
 * (DEPARTED-ZONE STORAGE CONTRACT — tag != zone identity). Writes only when a
 * reserved tile is off its computed slot; a fully-packed canvas is a no-op.
 */
export async function healReservedZonePlacement(
  clinicId: string,
  userId: string,
  rootLocationId: string,
): Promise<void> {
  const allLocs = await getLocalPropertyLocations(clinicId)
  const reservedIds = new Set(
    allLocs.filter(l => l.holder_user_id != null || l.is_turn_in_zone).map(l => l.id),
  )
  // Guard: nothing reserved yet (empty/transient fetch) → don't churn geometry.
  if (reservedIds.size === 0) return

  const existingTags = await fetchLocationTags(rootLocationId)
  const reservedTags = existingTags.filter(
    t => t.target_type === 'location' && reservedIds.has(t.target_id),
  )
  if (reservedTags.length === 0) return

  // STABLE, device-deterministic ordering — see doc-comment. Do not remove.
  const sorted = [...reservedTags].sort((a, b) =>
    a.target_id < b.target_id ? -1 : a.target_id > b.target_id ? 1 : 0,
  )

  const tileByTagId = new Map<string, ReturnType<typeof computeReservedBandTile>>()
  let needsWrite = false
  sorted.forEach((tag, i) => {
    const tile = computeReservedBandTile(i)
    tileByTagId.set(tag.id, tile)
    // Diff on {x,y} only — minimize churn; a tile already at its slot is skipped.
    if (tag.x !== tile.x || tag.y !== tile.y) needsWrite = true
  })
  if (!needsWrite) return

  // Full-replace the canvas: reserved tiles snap to their computed band slot
  // (x/y/width/height from computeReservedBandTile), every other field + every
  // non-reserved tag passes through untouched.
  const nextTags = existingTags.map(t => {
    const tile = tileByTagId.get(t.id)
    return tile ? { ...t, ...tile } : t
  })
  await upsertLocationTags(rootLocationId, nextTags)
}

/**
 * Create a full-size "level" sub-zone (e.g. a building floor) under `parentId`.
 *
 * Unlike "New area" (a drawn rect), a level occupies its parent's WHOLE footprint:
 * we persist a full-extent 0..1 zone tag on the parent's canvas so the level's own
 * canvas fills the parent when active. Sibling levels share the footprint (overlap);
 * the map suppresses inactive ones, so only the active floor renders.
 */
export async function createLevel(
  clinicId: string,
  userId: string,
  parentId: string,
  name: string,
  ordinal: number,
): Promise<ServiceResult<{ location: LocalPropertyLocation }>> {
  const result = await createLocation(
    {
      clinic_id: clinicId,
      parent_id: parentId,
      name,
      photo_data: null,
      holder_user_id: null,
      kind: 'level',
      ordinal,
      created_by: userId,
    },
    userId,
  )
  if (!result.success) return result

  // Full-extent tag on the parent canvas — the level fills its parent's footprint.
  const existingTags = await fetchLocationTags(parentId)
  await upsertLocationTags(parentId, [
    ...existingTags,
    {
      id: crypto.randomUUID(),
      location_id: parentId,
      target_type: 'location' as const,
      target_id: result.location.id,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      label: name,
    },
  ])

  return result
}

// ── Zone → Location Reconciliation ───────────────────────────

/**
 * Ensures a `property_locations` record exists for every zone tag on the
 * root canvas.  Called during store init so that zones drawn on the map
 * are always reflected in the list view.
 *
 * Preserves `tag.target_id` as the location `id` so existing canvas links
 * remain valid.  Only creates records — never deletes or renames existing ones.
 *
 * Returns true if any records were created (caller can trigger an IDB flush).
 */
export async function reconcileLocationsFromTags(
  clinicId: string,
  userId: string,
  rootLocationId: string,
  existingLocations: LocalPropertyLocation[],
): Promise<boolean> {
  const rootTags = await fetchLocationTags(rootLocationId)
  const zoneTags = rootTags.filter(t => t.target_type === 'location')
  if (zoneTags.length === 0) return false

  const knownIds = new Set(existingLocations.map(l => l.id))
  knownIds.add(rootLocationId)

  const now = new Date().toISOString()
  let created = false

  for (const tag of zoneTags) {
    if (knownIds.has(tag.target_id)) continue

    const location: PropertyLocation = {
      id: tag.target_id,
      clinic_id: clinicId,
      parent_id: null,
      name: tag.label ?? 'Location',
      photo_data: null,
      holder_user_id: null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    }
    await saveLocalPropertyLocation(localLocation(location, 'pending'))
    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'property_locations',
      record_id: location.id,
      payload: location as unknown as Record<string, unknown>,
    })
    knownIds.add(tag.target_id)
    created = true
  }

  return created
}

// ── Root Location (invisible canvas host) ────────────────────

import { ROOT_LOCATION_NAME, DEFAULT_CLUSTER_ZONE_NAME, TURN_IN_ZONE_NAME } from '../Types/PropertyTypes'

/**
 * Ensure the invisible root location exists for the clinic.
 * Returns the root location record (creates if needed).
 */
export async function ensureRootLocation(
  clinicId: string,
  userId: string,
): Promise<LocalPropertyLocation> {
  // Check local DB first
  const locals = await getLocalPropertyLocations(clinicId)
  const localRoot = locals.find((l) => l.name === ROOT_LOCATION_NAME && l.parent_id === null)
  if (localRoot) return localRoot

  // Check Supabase
  if (isOnline()) {
    try {
      const { data } = await supabase
        .from('property_locations')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('name', ROOT_LOCATION_NAME)
        .is('parent_id', null)
        .limit(1)
        .maybeSingle()
      if (data) {
        const loc = localLocation(data as PropertyLocation, 'synced')
        await saveLocalPropertyLocation(loc)
        return loc
      }
    } catch (err) {
      logger.warn('Root location lookup failed:', err)
    }
  }

  // Create the root location — retry once if IDB write fails on cold start
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await createLocation(
      { clinic_id: clinicId, parent_id: null, name: ROOT_LOCATION_NAME, photo_data: null, holder_user_id: null, created_by: userId },
      userId,
    )
    if (result.success) return result.location
    if (attempt === 0) {
      logger.warn('Root location creation failed, retrying:', result.error)
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw new Error('Failed to create root location after 2 attempts')
}

// ── Location Tags ────────────────────────────────────────────

export async function fetchLocationTags(locationId: string): Promise<LocationTag[]> {
  // Load local first for instant display
  const localTags = await getLocalLocationTags(locationId)

  // Check if this canvas has pending local changes
  const pendingIds = await getPendingTagCanvasIds()
  const hasPending = pendingIds.has(locationId)

  // Seed-only (vault-authoritative): pull the spine ONLY to bootstrap a canvas
  // this device has never populated (empty + version 0). A non-empty / versioned
  // local canvas was filled by the vault tag channel or a local edit and is
  // authoritative — overwriting it from the (lagging, vault-only-geometry-missing)
  // spine would delete that geometry. See reconcileLocationTagsWithServer.
  if (isOnline() && !hasPending && localTags.length === 0 && (await getLocalTagCanvasVersion(locationId)) === 0) {
    try {
      const { data, error } = await supabase
        .from('location_tags')
        .select('*')
        .eq('location_id', locationId)
      if (!error && data && data.length > 0) {
        const serverTags = data as LocationTag[]
        await saveLocalLocationTags(locationId, serverTags)
        await setLocalTagCanvasVersion(locationId, Date.now())
        return serverTags
      }
    } catch (err) {
      logger.warn('Failed to seed location tags from server:', err)
    }
  }

  return localTags
}

/**
 * Remove item pins for a given item from all canvas tags.
 * Scans IDB for canvases that contain a pin for this item, then re-saves
 * each canvas without the pin. upsertLocationTags handles offline queuing.
 */
async function purgeItemPins(itemId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('locationTags', 'readonly')
  const store = tx.objectStore('locationTags')
  const affectedCanvases = new Set<string>()
  let cursor = await store.openCursor()
  while (cursor) {
    if (cursor.value.target_id === itemId && cursor.value.target_type === 'item') {
      affectedCanvases.add(cursor.value.location_id)
    }
    cursor = await cursor.continue()
  }
  await tx.done

  for (const canvasId of affectedCanvases) {
    const tags = await getLocalLocationTags(canvasId)
    const withoutPin = tags.filter(t => !(t.target_id === itemId && t.target_type === 'item'))
    if (withoutPin.length !== tags.length) {
      await upsertLocationTags(canvasId, withoutPin)
    }
  }
}

/** Batch-fetch tags for multiple canvas locations (IndexedDB only, no network fallback). */
export async function fetchLocationTagsBatch(locationIds: string[]): Promise<Map<string, LocationTag[]>> {
  return getLocalLocationTagsBatch(locationIds)
}

/** Fetch ALL location tags for a clinic in a single IDB scan.
 *  Collects tags from every location that has tags, grouped by location_id. */
export async function fetchAllLocationTags(clinicId: string, locations: { id: string }[]): Promise<Map<string, LocationTag[]>> {
  const locationIds = locations.map(l => l.id)
  await reconcileLocationTagsWithServer(clinicId, locations)
  return getLocalLocationTagsBatch(locationIds)
}

export async function upsertLocationTags(
  locationId: string,
  tags: (Omit<LocationTag, 'id'> & { id?: string })[],
): Promise<ServiceResult<{ tags: LocationTag[] }>> {
  try {
    // Preserve existing IDs, generate only for truly new tags
    const fullTags: LocationTag[] = tags.map((t) => ({
      id: t.id || crypto.randomUUID(),
      location_id: locationId,
      target_type: t.target_type,
      target_id: t.target_id,
      x: t.x,
      y: t.y,
      width: t.width ?? null,
      height: t.height ?? null,
      label: t.label,
      rects: t.rects ?? null,
    }))

    // Always save to IndexedDB first (offline-first). Stamp a fresh canvas
    // version so the clinic-vault tag channel (snapshot/envelope) treats this
    // local edit as authoritative and a stale snapshot can't reset it.
    await saveLocalLocationTags(locationId, fullTags)
    const canvasVersion = Date.now()
    await setLocalTagCanvasVersion(locationId, canvasVersion)

    // Fan the canvas as a full-replace 'tags' envelope (vault distribution).
    // userId comes from the auth store (this fn has no userId param); clinic +
    // targets come from the canvas's location row. The version rides along so a
    // peer overwrites its canvas only when this edit is strictly newer.
    const fanUserId = useAuthStore.getState().user?.id ?? null
    const db = await getDb()
    const loc = await db.get('propertyLocations', locationId)
    const tagClinicId = loc?.clinic_id ?? null
    const tagTargets = loc?.target_clinic_ids ?? (tagClinicId ? [tagClinicId] : [])
    if (fanUserId && tagClinicId) {
      await fanProperty(fanUserId, 'c', 'tags', {
        id: locationId, clinic_id: tagClinicId, target_clinic_ids: tagTargets, tags: fullTags, version: canvasVersion,
      }, [], tagClinicId)
    }

    // If online, push to Supabase immediately
    if (isOnline()) {
      try {
        await supabase.from('location_tags').delete().eq('location_id', locationId)
        if (fullTags.length > 0) {
          const { error } = await supabase.from('location_tags').insert(fullTags)
          if (error) {
            logger.warn('Failed to push tags to Supabase, queuing for retry:', error.message)
            await queueTagSync(locationId)
          }
        }
      } catch {
        // Network error — queue for retry
        await queueTagSync(locationId)
      }
    } else {
      // Offline — queue for sync when connectivity returns
      await queueTagSync(locationId)
    }

    return succeed({ tags: fullTags })
  } catch (err) {
    return fail(String(err))
  }
}

/** Queue a canvas for tag sync. Uses the sync queue so it's processed on reconnect. */
async function queueTagSync(locationId: string): Promise<void> {
  // Use a deterministic user_id placeholder — the sync handler reads fresh from IDB
  await addToSyncQueue({
    user_id: '__tag_sync__',
    action: 'create',
    table_name: 'location_tags',
    record_id: locationId,
    payload: { _canvas_id: locationId },
  })
}

/**
 * Reconcile location tags with the server for a clinic — VAULT-AUTHORITATIVE.
 *
 * Property geometry is distributed device-to-device via the clinic-vault 'tags'
 * channel (applyTagsCanvas), not the spine. The spine is a write-only backstop +
 * fresh-device bootstrap. So this reconcile is SEED-ONLY: it populates a canvas
 * that is locally empty AND never touched (version 0), but NEVER overwrites a
 * canvas the vault or a local edit has already populated. A non-empty / versioned
 * local canvas is authoritative.
 *
 * The old server-authoritative overwrite deleted any tag the spine lacked — and
 * the spine lags (or never receives) vault-only geometry like a freshly drawn
 * vehicle rect, so it silently wiped vault-delivered geometry on every recipient
 * device the moment the map opened ("zone geometry doesn't persist across
 * devices"). Same delete-local data-loss class the 2026-06-21 vault cutover
 * retired for property item/zone ROWS; the tags channel had been left behind.
 */
export async function reconcileLocationTagsWithServer(
  clinicId: string,
  locations: { id: string }[],
): Promise<void> {
  if (!isOnline()) return

  try {
    const allIds = locations.map((l) => l.id)
    if (allIds.length === 0) return

    // COLD-CANVAS FLOOR ONLY — narrow the network read to canvases that are still
    // cold (locally empty AND version 0 AND not pending) BEFORE hitting the wire.
    // A warm device rides the vault tag channel + local edits, so every canvas is
    // already authoritative; the old full location_tags pull on every performSync
    // was redundant egress. Mirrors the seed-only WRITE guard below (kept as a
    // belt-and-suspenders check against a canvas warming between here and the write).
    const pendingCanvasIds = await getPendingTagCanvasIds()
    const localByCanvasPre = await getLocalLocationTagsBatch(allIds)
    const coldIds: string[] = []
    for (const id of allIds) {
      if (pendingCanvasIds.has(id)) continue
      if ((localByCanvasPre.get(id) || []).length > 0) continue
      if ((await getLocalTagCanvasVersion(id)) > 0) continue
      coldIds.push(id)
    }
    if (coldIds.length === 0) return // every canvas already owned locally — zero egress

    // Fetch tags for the cold canvases only
    const { data, error } = await supabase
      .from('location_tags')
      .select('*')
      .in('location_id', coldIds)

    if (error || !data) {
      logger.warn('Tag reconciliation failed:', error?.message)
      return
    }

    // Group server tags by canvas
    const serverByCanvas = new Map<string, LocationTag[]>()
    for (const tag of data as LocationTag[]) {
      const arr = serverByCanvas.get(tag.location_id) || []
      arr.push(tag)
      serverByCanvas.set(tag.location_id, arr)
    }

    // SEED-ONLY (vault-authoritative): only populate a canvas that is locally
    // empty AND never touched (version 0) — the fresh/cold-device bootstrap case.
    // A non-empty OR versioned local canvas was already populated by the vault
    // tag channel (or a local edit) and is authoritative; pulling the (possibly
    // stale, vault-only-geometry-missing) spine over it would delete that
    // geometry. Mirrors applyTagsCanvas's seed-empty / never-reset guard.
    for (const [locId, serverTags] of serverByCanvas) {
      if (serverTags.length === 0) continue
      if (pendingCanvasIds.has(locId)) continue
      const localTags = await getLocalLocationTags(locId)
      if (localTags.length > 0) continue
      if ((await getLocalTagCanvasVersion(locId)) > 0) continue // vault/local already owns this canvas
      await saveLocalLocationTags(locId, serverTags)
      await setLocalTagCanvasVersion(locId, Date.now())
    }
  } catch (err) {
    logger.warn('Tag reconciliation error:', err)
  }
}

// ── Name Sync (tree → canvas tags) ───────────────────────────

/**
 * When a location is renamed in the tree, update all canvas tags
 * that reference it so the canvas label stays in sync.
 *
 * Scan is O(n) over all tags because there's no target_id index.
 * Fine for typical data sizes (tens to hundreds of tags).
 */
export async function syncLocationNameToTags(locationId: string, newName: string): Promise<void> {
  try {
    // 1. Scan for affected canvases (read-only — cheaper than readwrite cursor)
    const db = await getDb()
    const tx = db.transaction('locationTags', 'readonly')
    const store = tx.objectStore('locationTags')
    const affectedCanvasIds = new Set<string>()
    let cursor = await store.openCursor()
    while (cursor) {
      const tag = cursor.value as LocationTag
      if (tag.target_type === 'location' && tag.target_id === locationId && tag.label !== newName) {
        affectedCanvasIds.add(tag.location_id)
      }
      cursor = await cursor.continue()
    }
    await tx.done

    if (affectedCanvasIds.size === 0) return

    // 2. For each affected canvas, update labels and upsert (handles IDB + Supabase + offline queue)
    for (const canvasId of affectedCanvasIds) {
      const tags = await getLocalLocationTags(canvasId)
      const updated = tags.map(t =>
        t.target_type === 'location' && t.target_id === locationId
          ? { ...t, label: newName }
          : t,
      )
      await upsertLocationTags(canvasId, updated)
    }
  } catch (err) {
    logger.warn('syncLocationNameToTags failed:', err)
  }
}

// ── Custody Ledger ───────────────────────────────────────────

export async function recordLedgerEntry(
  entry: Omit<CustodyLedgerEntry, 'id' | 'recorded_at'>,
  userId: string,
): Promise<ServiceResult<{ entry: CustodyLedgerEntry }>> {
  try {
    const now = new Date().toISOString()
    // Custody follows both holders across clusters (a transfer to a loaned
    // soldier must reach his home/loan clinics).
    const holderIds = [entry.to_holder_id, entry.from_holder_id].filter((h): h is string => !!h)
    const targets = await resolvePropertyTargetClinics(entry.clinic_id, holderIds)
    const originId = crypto.randomUUID()
    const ledgerEntry: CustodyLedgerEntry = {
      ...entry,
      id: crypto.randomUUID(),
      recorded_at: now,
      target_clinic_ids: targets,
      originId,
    }

    // Local projection (custody is now vault-delivered + offline-readable).
    await saveLocalCustodyEntry({
      ...ledgerEntry,
      _sync_status: 'pending', _sync_retry_count: 0, _last_sync_error: null, _last_sync_error_message: null,
    })

    // Ledger is append-only.
    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'custody_ledger',
      record_id: ledgerEntry.id,
      payload: toSpine(ledgerEntry as unknown as Record<string, unknown>),
    })

    await fanProperty(userId, 'c', 'custody', {
      id: ledgerEntry.id, clinic_id: ledgerEntry.clinic_id, target_clinic_ids: targets, originId,
      data: toEnvelope(ledgerEntry as unknown as Record<string, unknown>),
    }, holderIds, ledgerEntry.clinic_id)

    // Dual-write the same custody event into the unified audit_log (timeline +
    // consolidation target; custody_ledger folds in once proven). Best-effort —
    // emitAudit never throws, so a key/queue hiccup can't fail the transfer.
    await emitAudit(
      {
        clinicId: ledgerEntry.clinic_id,
        actorId: userId,
        domain: 'property',
        eventType: 'item.transferred',
        subjectType: 'item',
        subjectId: ledgerEntry.item_id,
        occurredAt: now,
        payload: {
          action: ledgerEntry.action,
          quantity_delta: ledgerEntry.quantity_delta ?? null,
          condition_code: ledgerEntry.condition_code,
          from_holder_id: ledgerEntry.from_holder_id,
          to_holder_id: ledgerEntry.to_holder_id,
          sub_item_check: ledgerEntry.sub_item_check,
          notes: ledgerEntry.notes,
        },
      },
      userId,
    )

    immediateSync(userId)
    return succeed({ entry: ledgerEntry })
  } catch (err) {
    return fail(String(err))
  }
}

/** Append-only custody rows are immutable + keyed by id, so a bootstrap merge is a
 *  pure insert-missing: any server row absent locally is seeded, never overwritten.
 *  Mirrors the vault-authoritative read pattern used for items/locations. */
function localCustody(row: CustodyLedgerEntry): LocalCustodyEntry {
  return {
    ...row,
    _sync_status: 'synced',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }
}

async function seedCustodyFromServer(
  column: 'item_id' | 'clinic_id',
  value: string,
  localIds: Set<string>,
): Promise<void> {
  if (!isOnline()) return
  try {
    const { data, error } = await supabase
      .from('custody_ledger')
      .select('*')
      .eq(column, value)
    if (error || !data) return
    for (const row of data as CustodyLedgerEntry[]) {
      if (localIds.has(row.id)) continue // already have it (append-only → immutable)
      await saveLocalCustodyEntry(localCustody(row))
    }
  } catch (err) {
    logger.warn('Custody bootstrap read failed, using local data:', err)
  }
}

const byRecordedDesc = (a: CustodyLedgerEntry, b: CustodyLedgerEntry) =>
  b.recorded_at.localeCompare(a.recorded_at)

/** One item's custody history (newest first). Local-first: reads the IDB
 *  projection (populated by recordLedgerEntry + the vault custody channel), with a
 *  best-effort spine seed-merge when online. Works fully offline. */
export async function fetchItemLedger(itemId: string): Promise<CustodyLedgerEntry[]> {
  const local = await getLocalCustodyByItem(itemId)
  // COLD-DEVICE FLOOR — custody rides the clinic-vault snapshot + tail (append-only,
  // routed via applyCustody, which fires 'properties' invalidation on arrival), so a
  // warm device already holds every ledger row. Only backstop-pull the durable table
  // when this device holds NO custody at all (cold/fresh) — checked clinic-wide so a
  // never-signed-out item doesn't re-pull on every timeline open. Mirrors fetchClinicItems.
  if (local.length === 0 && (await getAllLocalCustody()).length === 0) {
    await seedCustodyFromServer('item_id', itemId, new Set())
  }
  return (await getLocalCustodyByItem(itemId)).sort(byRecordedDesc)
}

/** Clinic-wide custody ledger (newest first) — feeds the DA 2062 accountability
 *  surface, which folds these rows into hand receipts by hand_receipt_id.
 *  Local-first (IDB projection + best-effort spine seed-merge), so receipts render
 *  offline and a just-signed-out receipt shows before its spine push lands. RLS
 *  scopes the server read to the caller's clinic + cross-cluster targets. */
export async function fetchClinicLedger(clinicId: string): Promise<CustodyLedgerEntry[]> {
  const local = await getLocalCustodyByClinic(clinicId)
  // COLD-DEVICE FLOOR — see fetchItemLedger. Custody arrives via snapshot + tail; a
  // warm device refetches from IDB on the 'properties' invalidation applyCustody fires
  // when a remote sign-out/in lands, so it never needs the durable pull. Gating on the
  // empty clinic projection stops the full custody_ledger re-pull on EVERY 'properties'
  // invalidation — the always-mounted master-search egress (useHandReceipts).
  if (local.length === 0) {
    await seedCustodyFromServer('clinic_id', clinicId, new Set())
  }
  return (await getLocalCustodyByClinic(clinicId)).sort(byRecordedDesc)
}

// ── Discrepancies ────────────────────────────────────────────

export async function fetchHolderDiscrepancies(holderId: string): Promise<LocalDiscrepancy[]> {
  return getLocalDiscrepancies(holderId)
}

export async function createDiscrepancy(
  data: Omit<Discrepancy, 'id' | 'created_at' | 'status' | 'rectified_at' | 'rectified_by' | 'rectify_method' | 'rectify_notes'>,
  userId: string,
): Promise<ServiceResult<{ discrepancy: LocalDiscrepancy }>> {
  try {
    const now = new Date().toISOString()
    const originId = crypto.randomUUID()
    const disc: Discrepancy = {
      ...data,
      id: crypto.randomUUID(),
      status: 'open',
      rectified_at: null,
      rectified_by: null,
      rectify_method: null,
      rectify_notes: null,
      created_at: now,
      originId,
    }

    const local = localDiscrepancy(disc)
    await saveLocalDiscrepancy(local)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'discrepancies',
      record_id: disc.id,
      payload: toSpine(disc as unknown as Record<string, unknown>),
    })

    // Discrepancies carry no clinic_id — scope/fan via the parent item's set.
    const db = await getDb()
    const parentItem = await db.get('propertyItems', disc.item_id)
    const clinicId = parentItem?.clinic_id ?? null
    const targets = parentItem?.target_clinic_ids ?? (clinicId ? [clinicId] : [])
    await fanProperty(userId, 'c', 'discrepancy', {
      id: disc.id, clinic_id: clinicId ?? undefined, target_clinic_ids: targets, originId,
      data: toEnvelope(disc as unknown as Record<string, unknown>),
    }, [], clinicId)

    immediateSync(userId)
    return succeed({ discrepancy: local })
  } catch (err) {
    return fail(String(err))
  }
}

export async function rectifyDiscrepancy(
  id: string,
  method: string,
  notes: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    const db = await getDb()
    const existing = await db.get('propertyDiscrepancies', id)
    if (!existing) return fail('Discrepancy not found')

    const now = new Date().toISOString()
    const newOriginId = crypto.randomUUID()
    const updated: LocalDiscrepancy = {
      ...existing,
      status: 'rectified',
      rectified_at: now,
      rectified_by: userId,
      rectify_method: method as LocalDiscrepancy['rectify_method'],
      rectify_notes: notes || null,
      originId: newOriginId,
      _sync_status: 'pending',
    }

    await saveLocalDiscrepancy(updated)

    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'discrepancies',
      record_id: id,
      payload: {
        status: 'rectified',
        rectified_at: now,
        rectified_by: userId,
        rectify_method: method,
        rectify_notes: notes || null,
      },
    })

    const parentItem = await db.get('propertyItems', existing.item_id)
    const clinicId = parentItem?.clinic_id ?? null
    const targets = parentItem?.target_clinic_ids ?? (clinicId ? [clinicId] : [])
    await fanProperty(userId, 'u', 'discrepancy', {
      id, clinic_id: clinicId ?? undefined, target_clinic_ids: targets, originId: newOriginId,
      data: toEnvelope(updated as unknown as Record<string, unknown>),
    }, [], clinicId)

    immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

// ── Transfer Execution ───────────────────────────────────────

export async function executeTransfer(
  payload: TransferPayload,
  userId: string,
  clinicId: string,
): Promise<ServiceResult<{ ledgerEntryId: string; discrepancyCount: number }>> {
  try {
    // 1. Build sub-item check snapshot
    const subItemCheck: SubItemCheck[] = payload.checklist.map((c) => ({
      item_id: c.item_id,
      name: c.name,
      present: c.present,
    }))

    // 2. Record ledger entry
    const ledgerResult = await recordLedgerEntry(
      {
        item_id: payload.parent_item_id,
        clinic_id: clinicId,
        action: 'sign_down',
        from_holder_id: payload.from_holder_id,
        to_holder_id: payload.to_holder_id,
        condition_code: payload.condition_code,
        sub_item_check: subItemCheck,
        notes: payload.notes,
        recorded_by: userId,
      },
      userId,
    )
    if (!ledgerResult.success) return fail(ledgerResult.error)

    // 3. Update parent item holder (the ledger entry already logged item.transferred)
    await updateItem(payload.parent_item_id, { current_holder_id: payload.to_holder_id }, userId, { skipAudit: true })

    // 4. Process each sub-item
    let discrepancyCount = 0
    for (const checkItem of payload.checklist) {
      if (checkItem.present) {
        // Present: transfer to new holder
        await updateItem(checkItem.item_id, { current_holder_id: payload.to_holder_id }, userId, { skipAudit: true })
      } else {
        // Missing: mark as missing, create discrepancy
        await updateItem(checkItem.item_id, { condition_code: 'missing' }, userId, { skipAudit: true })

        await createDiscrepancy(
          {
            item_id: checkItem.item_id,
            parent_item_id: payload.parent_item_id,
            responsible_holder_id: payload.from_holder_id,
            transfer_ledger_id: ledgerResult.entry.id,
          },
          userId,
        )
        discrepancyCount++
      }
    }

    return succeed({ ledgerEntryId: ledgerResult.entry.id, discrepancyCount })
  } catch (err) {
    return fail(String(err))
  }
}

// ── DA 2062 Hand Receipt (multi-item sign-out / sign-in) ─────

export interface SignOutParams {
  itemIds: string[]
  /** Per-item quantity to sign out (itemId → count). Absent/missing → 1.
   *  Recorded on the sign_down row's quantity_delta and printed in the 2062 QTY column. */
  quantities?: Record<string, number>
  clinicId: string
  /** Issuing hand-receipt holder (usually the current user); may be null. */
  fromHolderId: string | null
  /** Cluster member receiving custody, or null when signing OUTSIDE the cluster. */
  toHolderId: string | null
  /** Recipient name when signing outside the cluster (no profile id exists). */
  externalName: string | null
  /** Optional free-text added to the receipt. */
  notes: string | null
  /** A "real" sign-out (item physically leaves) vs. a sign-over / sign-for (custody
   *  only). When true AND the recipient is an internal member, each item is relocated
   *  to that member's member-zone on the map; when false the item's location_id is
   *  left untouched (the existing sign-over behaviour). No-op for external recipients
   *  (they have no member-zone). */
  moveToZone?: boolean
}

type CustodyState = { signed_out_external: boolean; current_holder_id: string | null }

/**
 * CUSTODY MODEL — one canonical stack record, quantity-accounted.
 *
 * A non-serialized stack stays a SINGLE item whose `quantity` is the ON-HAND count
 * (what's physically at its standing zone). Signing some out decrements on-hand and
 * leaves a custody_ledger sign_down row (qty_delta + to_holder_id) against the SAME
 * stack id — never a child item. So "who holds how many" is read off the open ledger
 * rows / receipts (a stack can be split across many holders at once), the stack's own
 * timeline shows every transfer + return in one place, and a return just adds the
 * quantity back. The stack's current_holder_id is NOT used for non-serialized custody
 * (one field can't name three holders) — it stays whatever it was (normally null).
 *
 * A SERIALIZED item is a single unit: custody is the whole thing, so it keeps the
 * current_holder_id / signed_out_external flags (quantity stays 1, never decremented).
 */

/** Sign `signQty` of `item` OUT. Serialized → flip the holder flags in place; non-
 *  serialized → decrement on-hand (custody lives on the ledger row, not the item).
 *
 *  LOCATION on a "real" sign-out (moveToLocationId set = recipient's member-zone):
 *   - SERIALIZED, or a WHOLE-stack non-serialized move (nothing stays on-hand) → the
 *     single record relocates (custody flags / on-hand-0 + the new location_id).
 *   - PARTIAL non-serialized move → the remainder MUST stay at the source zone, so we
 *     canNOT relocate the shared stack record (that dragged the leftover stock to the
 *     recipient's zone — the bug this branch fixes). Instead: decrement the source in
 *     place (location untouched) and spawn a NEW stack carrying the moved qty at the
 *     destination. The custody ledger stays on the SOURCE stack (the caller records
 *     sign_down against it) — the new item is just relocated physical stock, so a
 *     later sign-in returns the qty to the source. */
async function applyOutbound(
  item: LocalPropertyItem,
  signQty: number,
  custody: CustodyState,
  userId: string,
  moveToLocationId?: string | null,
): Promise<void> {
  const moving = !!moveToLocationId && moveToLocationId !== item.location_id
  const locationPatch = moving ? { location_id: moveToLocationId } : {}
  if (item.is_serialized) {
    await updateItem(item.id, { ...custody, ...locationPatch }, userId, { skipAudit: true })
    return
  }
  const signed = Math.max(1, signQty)
  const onHand = Math.max(0, item.quantity - signed)
  // PARTIAL "real" move (stock stays behind): split the moved qty off as a new stack
  // at the destination and leave the source stack's location alone.
  if (moving && onHand > 0) {
    await updateItem(item.id, { quantity: onHand }, userId, { skipAudit: true })
    await createItem(
      {
        clinic_id: item.clinic_id,
        name: item.name,
        nomenclature: item.nomenclature,
        nsn: item.nsn,
        lin: item.lin,
        serial_number: null,
        quantity: signed,
        is_serialized: false,
        condition_code: item.condition_code,
        parent_item_id: item.parent_item_id,
        location_id: moveToLocationId,
        current_holder_id: item.current_holder_id,
        location_tag_id: null,
        photo_url: item.photo_url,
        visual_fingerprint: null,
        expiry_date: item.expiry_date,
        notes: item.notes,
        item_type: item.item_type,
        unit_of_issue: item.unit_of_issue,
        pack_size: item.pack_size,
      },
      userId,
    )
    return
  }
  // Sign-over (no move) or a whole-stack move → the one record decrements (to 0 on a
  // full sign-out) and, when moving, relocates.
  await updateItem(item.id, { quantity: onHand, ...locationPatch }, userId, { skipAudit: true })
}

/** Return `qty` of `item` to stock. Serialized → clear the holder flags; non-
 *  serialized → add the quantity back on-hand. Optionally re-place the item at a
 *  chosen zone (sign-in lets the user pick where it lands now — there is NO original-
 *  location tracking). moveToLocationId null/absent → leave location_id as-is. */
async function applyReturn(
  item: LocalPropertyItem,
  qty: number,
  userId: string,
  moveToLocationId?: string | null,
): Promise<void> {
  const locationPatch =
    moveToLocationId && moveToLocationId !== item.location_id ? { location_id: moveToLocationId } : {}
  if (item.is_serialized) {
    await updateItem(item.id, { signed_out_external: false, current_holder_id: null, ...locationPatch }, userId, { skipAudit: true })
  } else {
    await updateItem(item.id, { quantity: item.quantity + Math.max(1, qty), ...locationPatch }, userId, { skipAudit: true })
  }
}

/** Apply a VERIFIED turn-in of `qty` of `item` — terminal (no return path, unlike
 *  applyReturn). Serialized unit → leaves the active book (turned_in_at set; custody
 *  flags cleared — it's gone). Non-serialized stack → a partial turn-in PERMANENTLY
 *  decrements on-hand (the stack stays active with the remainder); a full turn-in sets
 *  turned_in_at and LEAVES quantity as the manifest count (no nuke — quantity records
 *  how many were turned in). turned_in_at drops it from the active book + anchors the
 *  ~180d reap. */
async function applyTurnIn(item: LocalPropertyItem, qty: number, userId: string, at: string): Promise<void> {
  // A full turn-in leaves the active book AND vacates the staging zone (location_id null,
  // origin cleared — it's gone for good), so the zone empties and its tile drops.
  if (item.is_serialized) {
    await updateItem(item.id, { turned_in_at: at, current_holder_id: null, signed_out_external: false, location_id: null, turn_in_origin_location_id: null }, userId, { skipAudit: true })
    return
  }
  const remaining = item.quantity - Math.max(1, qty)
  if (remaining <= 0) {
    await updateItem(item.id, { turned_in_at: at, location_id: null, turn_in_origin_location_id: null }, userId, { skipAudit: true }) // whole stack out; keep qty as manifest
  } else {
    await updateItem(item.id, { quantity: remaining }, userId, { skipAudit: true }) // partial — stack stays active
  }
}

/** The signed-out quantity a receipt's sign_down row recorded for one item (the
 *  amount to put back on return / when the item is dropped from the receipt). */
function signedOutQty(rows: LocalCustodyEntry[], itemId: string): number {
  const row = rows.find((r) => r.action === 'sign_down' && r.item_id === itemId)
  return Math.max(1, row?.quantity_delta ?? 1)
}

/** Net quantity an item is STILL OUT on a receipt = Σ sign_down − Σ sign_up, clamped
 *  ≥ 0. Zero for a receipt already signed in (returned). Drives delete: a returned
 *  receipt's items are already back on-hand / holder-cleared, so deleting that
 *  historical 2062 must NOT return stock again (double-count) or re-clear a holder the
 *  serialized item may now legitimately have on a NEWER open receipt — it only purges
 *  the document + timeline. An OPEN receipt nets to its outstanding qty (returned). */
function netOutstandingQty(rows: LocalCustodyEntry[], itemId: string): number {
  let net = 0
  for (const r of rows) {
    if (r.item_id !== itemId) continue
    if (r.action === 'sign_down') net += Math.max(1, r.quantity_delta ?? 1)
    else if (r.action === 'sign_up') net -= Math.max(1, r.quantity_delta ?? 1)
  }
  return Math.max(0, net)
}

/** Delete the split-off destination stack that a PARTIAL "real" (move-to-zone) sign-out
 *  created for `sourceItem` at recipient `toHolderId`'s member-zone (applyOutbound
 *  partial-move branch). Every return path (sign-in, drop-from-receipt, delete-receipt)
 *  puts the moved qty back on the SOURCE stack via applyReturn, which would DOUBLE-COUNT
 *  against that still-standing physical stack — so the return also removes it. Delete
 *  only, no merge. Matched by member-zone + identity + EXACT moved qty (the stack was
 *  created with quantity = the receipt's sign_down qty) so it can't touch unrelated
 *  stock. No-ops for a serialized unit / sign-over / whole-stack move (no separate stack
 *  was made) or an external recipient (no member-zone). Pass `allItems` read AFTER any
 *  custody-row purge (the property item itself is untouched by that purge). */
async function removeMovedStack(
  sourceItem: LocalPropertyItem,
  toHolderId: string | null,
  movedQty: number,
  allItems: LocalPropertyItem[],
  locs: LocalPropertyLocation[],
  userId: string,
): Promise<void> {
  if (sourceItem.is_serialized || !toHolderId) return
  const memberZoneId = locs.find((l) => l.holder_user_id === toHolderId && !l.deleted_at)?.id ?? null
  if (!memberZoneId) return
  const moved = allItems.find((i) =>
    i.id !== sourceItem.id &&
    !i.is_serialized &&
    i.location_id === memberZoneId &&
    i.quantity === movedQty &&
    i.name.toLowerCase() === sourceItem.name.toLowerCase() &&
    (sourceItem.nsn ? i.nsn === sourceItem.nsn : !i.nsn),
  )
  if (moved) await deleteItem(moved.id, userId)
}

// ── SKO subtree = the accountability atom (settles the DA 2062 parent_id question;
//    see .claude/Projects/_ideas/accountability-reorder-loop.md DECISION 2026-06-28) ──
//
// A custody event (sign-out / turn-in) on a parent end-item CASCADES to its entire
// component subtree — "components ride their parent" is now true in DATA, not just a
// SignOutForm UI claim. Acting on a single component WITHOUT its parent first DETACHES
// it from the SKO (parent_item_id → null) so the kit reads a shortage (computeShortages
// = authorized − present). owner_user_id + signed_out_external inherit from the parent;
// location cascades only on a "real" sign-out (moveToZone).

/** Expand a selection to its SKO subtree atom(s): each id PLUS every descendant via
 *  parent_item_id, deduped, parent-before-child order (so the 2062 lists the kit then
 *  its contents). */
function expandSubtrees(rootIds: string[], allItems: LocalPropertyItem[]): string[] {
  const childrenByParent = new Map<string, LocalPropertyItem[]>()
  for (const i of allItems) {
    if (!i.parent_item_id) continue
    const arr = childrenByParent.get(i.parent_item_id)
    if (arr) arr.push(i)
    else childrenByParent.set(i.parent_item_id, [i])
  }
  const out: string[] = []
  const seen = new Set<string>()
  const visit = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
    for (const c of childrenByParent.get(id) ?? []) visit(c.id)
  }
  for (const id of rootIds) visit(id)
  return out
}

/** Auto-detach: any selected component whose SKO parent is NOT also in the selection
 *  leaves its kit (parent_item_id → null) before being actioned — the gap becomes an
 *  open shortage line. parent_item_id is audited, so this logs item.edited as the
 *  accountability event. Patches `itemsById` in place so the caller's later expansion
 *  sees the detached state (won't re-pull the ex-parent's other children). */
async function detachLooseComponents(
  selectedIds: string[],
  itemsById: Map<string, LocalPropertyItem>,
  userId: string,
): Promise<void> {
  const selected = new Set(selectedIds)
  for (const id of selectedIds) {
    const it = itemsById.get(id)
    if (it?.parent_item_id && !selected.has(it.parent_item_id)) {
      await updateItem(id, { parent_item_id: null }, userId)
      itemsById.set(id, { ...it, parent_item_id: null })
    }
  }
}

/**
 * Sign 1..N items out on a single DA 2062 hand receipt. Writes one append-only
 * custody_ledger sign_down row per item (qty_delta + recipient), all sharing a
 * freshly minted hand_receipt_id, against the CANONICAL stack id (see the CUSTODY
 * MODEL note above applyOutbound). Then applyOutbound either:
 *   - NON-SERIALIZED stack → decrements on-hand quantity (custody is ledger-tracked;
 *     the stack can be split across many holders, so current_holder_id is NOT set)
 *   - SERIALIZED unit → flips the holder flags (internal current_holder_id = toHolderId,
 *     external signed_out_external = true; recipient name lives in the row notes)
 * A sign-over (default) leaves location_id untouched (custody transfer only); a "real"
 * sign-out (params.moveToZone, internal recipient) ALSO relocates each item to the
 * recipient's member-zone. Returns the hand_receipt_id so the caller can immediately
 * print the 2062.
 */
export async function signOutItems(
  params: SignOutParams,
  userId: string,
): Promise<ServiceResult<{ handReceiptId: string }>> {
  try {
    const { itemIds, quantities, clinicId, fromHolderId, toHolderId, externalName, notes } = params
    if (itemIds.length === 0) return fail('No items selected')
    const isExternal = !toHolderId
    if (isExternal && !externalName?.trim()) return fail('External recipient name required')

    const handReceiptId = crypto.randomUUID()
    // External recipient is carried in the row notes — free-text is the only place a
    // non-member recipient lives. The accountability fold reads it back as the label.
    const rowNotes = isExternal
      ? [externalName!.trim(), notes?.trim()].filter(Boolean).join(' — ')
      : (notes?.trim() || null)

    const custody: CustodyState = isExternal
      ? { signed_out_external: true, current_holder_id: null }
      : { signed_out_external: false, current_holder_id: toHolderId }
    const itemsById = new Map((await getLocalPropertyItems(clinicId)).map((i) => [i.id, i]))

    // SKO subtree atom: a selected component without its parent detaches first (kit
    // shows a shortage), then each selection expands to its whole component subtree —
    // signing out a kit takes its contents. The cascaded children ride the SAME
    // receipt, so sign-in / delete / reprint cover them with no extra plumbing.
    await detachLooseComponents(itemIds, itemsById, userId)
    const originallySelected = new Set(itemIds)
    const expandedIds = expandSubtrees(itemIds, [...itemsById.values()])

    // "Real" sign-out (moveToZone) relocates each item to the recipient's member-zone
    // (property_locations.holder_user_id === toHolderId). External recipients have no
    // member-zone, so the move is internal-only; a sign-over leaves location untouched.
    let memberZoneId: string | null = null
    if (params.moveToZone && toHolderId) {
      const locs = await getLocalPropertyLocations(clinicId)
      memberZoneId = locs.find((l) => l.holder_user_id === toHolderId && !l.deleted_at)?.id ?? null
    }

    for (const itemId of expandedIds) {
      const item = itemsById.get(itemId)
      if (!item) return fail('Item not found')
      const cascaded = !originallySelected.has(itemId)
      // On-hand caps the signed-out count for a stack; serialized is always 1.
      const available = item.is_serialized ? 1 : item.quantity
      if (available <= 0) {
        if (cascaded) continue // empty component slot in the kit — nothing to ride along
        return fail(`${item.name} has none on hand`)
      }
      // A cascaded component rides WHOLE with its kit (full on-hand); a directly
      // selected stack honors the picker quantity.
      const signQty = item.is_serialized
        ? 1
        : cascaded
          ? available
          : Math.max(1, Math.min(quantities?.[itemId] ?? 1, available))

      // One row against the STACK id (never a child): the receipt + the dual-written
      // item.transferred timeline both hang off the canonical item, so its history
      // reads "transferred N to X" in one place and a sign-in adds the qty back.
      const ledgerResult = await recordLedgerEntry(
        {
          item_id: itemId,
          clinic_id: clinicId,
          hand_receipt_id: handReceiptId,
          action: 'sign_down',
          quantity_delta: signQty,
          from_holder_id: fromHolderId,
          to_holder_id: toHolderId,
          condition_code: 'serviceable',
          sub_item_check: null,
          notes: rowNotes,
          recorded_by: userId,
        },
        userId,
      )
      if (!ledgerResult.success) return fail(ledgerResult.error)

      // Decrement on-hand (stack) or flip the holder flags (serialized), and on a
      // "real" sign-out relocate it to the recipient's member-zone.
      await applyOutbound(item, signQty, custody, userId, memberZoneId)
    }

    return succeed({ handReceiptId })
  } catch (err) {
    return fail(String(err))
  }
}

/**
 * Sign a hand receipt back in: append a sign_up row per item (sharing the original
 * hand_receipt_id so the receipt folds to status 'returned') and clear each item's
 * custodian. `toLocationId` re-places every returned item at the chosen zone (the
 * user picks where it lands now — there is no original-location restore); null/absent
 * leaves location_id as-is (e.g. for a sign-over that never moved it).
 */
export async function signInReceipt(
  handReceiptId: string,
  clinicId: string,
  fromHolderId: string | null,
  itemIds: string[],
  userId: string,
  toLocationId?: string | null,
): Promise<ServiceResult> {
  try {
    if (itemIds.length === 0) return fail('No items on receipt')
    const signDowns = await getLocalCustodyByReceipt(handReceiptId)
    const allItems = await getLocalPropertyItems(clinicId)
    const itemsById = new Map(allItems.map((i) => [i.id, i]))
    const locs = await getLocalPropertyLocations(clinicId)
    for (const itemId of itemIds) {
      const qty = signedOutQty(signDowns, itemId)
      const ledgerResult = await recordLedgerEntry(
        {
          item_id: itemId,
          clinic_id: clinicId,
          hand_receipt_id: handReceiptId,
          action: 'sign_up',
          quantity_delta: qty,
          from_holder_id: fromHolderId,
          to_holder_id: null,
          condition_code: 'serviceable',
          sub_item_check: null,
          notes: 'Signed in',
          recorded_by: userId,
        },
        userId,
      )
      if (!ledgerResult.success) return fail(ledgerResult.error)

      // Add the quantity back on-hand (stack) or clear the holder (serialized), and
      // re-place at the chosen destination zone when one was picked.
      const item = itemsById.get(itemId)
      if (item) await applyReturn(item, qty, userId, toLocationId)

      // The moved qty is now back on the source (applyReturn above); if this was a
      // PARTIAL move-to-zone sign-out, also delete the split-off stack it left at the
      // recipient's member-zone so the returned qty isn't double-counted.
      if (item) {
        const sd = signDowns.find((r) => r.action === 'sign_down' && r.item_id === itemId)
        await removeMovedStack(item, sd?.to_holder_id ?? null, qty, allItems, locs, userId)
      }
    }
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

// ── DA 3161 turn-in ──────────────────────────────────────────
//
// A turn-in is the DA 3161 "Turn-In" mode (back to supply). It rides custody_ledger
// exactly like the 2062 — `turn_in` rows grouped by a doc id (the hand_receipt_id
// column reused as a generic document id; the 2062 fold ignores non-sign_down rows so
// the two never mix). Unlike a sign-out, turn-in is TERMINAL: applyTurnIn drops the
// item from the active book (turned_in_at) or permanently decrements a partial stack —
// there is no sign-back-in. The SKO subtree atom applies (cascade + auto-detach), so
// turning in a kit takes its contents and turning in a loose component leaves a
// shortage. Staging (the rolling pending-turn-in bucket) + the 3161 PDF + the ~180d
// reap are separate layers; this is the verified-completion write.

export interface TurnInParams {
  itemIds: string[]
  clinicId: string
  /** Who is turning the property in (the holder/HRH); recorded on the ledger row. */
  fromHolderId: string | null
  notes?: string | null
}

// Turn-in is FULL-LINE (the whole item/stack) — there is no row-level "verified" flag
// on custody_ledger, so a partial that left a non-turned_in item in a doc would break
// open-doc detection + risk a double-apply on verify. Whole-line keeps turned_in_at a
// clean per-item "verified" marker. (Partial-stack turn-in is a later refinement.)

/** Write `turn_in` rows for a selection into `docId` — STAGE only, no apply. Applies the
 *  SKO subtree atom (detach loose components → shortage; expand each selection to its
 *  subtree). Skips ids in `skipIds` (already staged in this doc). `itemsById` is mutated
 *  by detach. */
async function writeTurnInRows(
  docId: string,
  itemIds: string[],
  clinicId: string,
  fromHolderId: string | null,
  rowNotes: string | null,
  itemsById: Map<string, LocalPropertyItem>,
  userId: string,
  skipIds: Set<string>,
  /** The cluster's turn-in staging zone — items relocate INTO it when staged. */
  turnInZoneId: string,
): Promise<ServiceResult> {
  await detachLooseComponents(itemIds, itemsById, userId)
  const originallySelected = new Set(itemIds)
  for (const itemId of expandSubtrees(itemIds, [...itemsById.values()])) {
    if (skipIds.has(itemId)) continue
    const item = itemsById.get(itemId)
    if (!item) return fail('Item not found')
    const cascaded = !originallySelected.has(itemId)
    const qty = item.is_serialized ? 1 : item.quantity
    if (qty <= 0) {
      if (cascaded) continue // empty component slot — nothing to turn in
      return fail(`${item.name} has none on hand`)
    }
    // "Move to the turn-in staging zone", split by MTOE authorization:
    //  - AUTHORIZED (quantity_authorized != null): act as if moved/expended — the BOM line
    //    STAYS PUT, zeroed, as a shortage anchor (authorized−0 = short the instant staged),
    //    and a NEW item carrying the on-hand qty (+ serial + attrs) relocates INTO the
    //    turn-in zone with the marker. A serialized source is demoted to a serial-less qty-0
    //    placeholder (the serial travels with the child).
    //  - UNAUTHORIZED (null): FULL MOVE — the whole item's location_id becomes the turn-in
    //    zone; turn_in_origin_location_id remembers where it was so un-stage restores it.
    // Cascaded SKO components ride their parent kit (nested by parent_item_id) — marker only.
    let ledgerItemId = itemId
    if (!cascaded && item.quantity_authorized != null) {
      const child = await createItem(
        {
          clinic_id: item.clinic_id,
          name: item.name,
          nomenclature: item.nomenclature,
          nsn: item.nsn,
          lin: item.lin,
          serial_number: item.serial_number, // the physical stock keeps its serial
          quantity: qty,
          is_serialized: item.is_serialized,
          condition_code: item.condition_code,
          parent_item_id: item.parent_item_id,
          location_id: turnInZoneId, // relocate into the staging zone
          current_holder_id: item.current_holder_id,
          location_tag_id: null,
          photo_url: item.photo_url,
          visual_fingerprint: null,
          expiry_date: item.expiry_date,
          notes: item.notes,
          sub_cluster_id: item.sub_cluster_id ?? null,
          quantity_authorized: null, // the moved stock is never itself a shortage line
          item_type: item.item_type, // relocated stock keeps its accountability class + unit
          unit_of_issue: item.unit_of_issue,
          pack_size: item.pack_size,
        },
        userId,
      )
      if (!child.success) return fail(child.error)
      const zeroed = await updateItem(
        item.id,
        item.is_serialized ? { quantity: 0, serial_number: null, is_serialized: false } : { quantity: 0 },
        userId,
        { skipAudit: true },
      )
      if (!zeroed.success) return fail(zeroed.error)
      ledgerItemId = child.item.id
    } else if (!cascaded) {
      const moved = await updateItem(
        item.id,
        { location_id: turnInZoneId, turn_in_origin_location_id: item.location_id ?? null },
        userId,
        { skipAudit: true },
      )
      if (!moved.success) return fail(moved.error)
    }
    const ledgerResult = await recordLedgerEntry(
      {
        item_id: ledgerItemId,
        clinic_id: clinicId,
        hand_receipt_id: docId, // generic doc id (reused column; 2062 fold ignores turn_in rows)
        action: 'turn_in',
        quantity_delta: qty,
        from_holder_id: fromHolderId,
        to_holder_id: null, // back to supply — no member recipient
        condition_code: item.condition_code, // carries serviceable/unserviceable for the 3161
        sub_item_check: null,
        notes: rowNotes,
        recorded_by: userId,
      },
      userId,
    )
    if (!ledgerResult.success) return fail(ledgerResult.error)
  }
  return succeed()
}

/** Apply (verify) the staged turn_in rows of `docId`: for each still-active item, applyTurnIn
 *  with the staged qty. `onlyItemIds` verifies a subset (independent sub-cluster runs). */
async function applyTurnInDoc(
  docId: string,
  clinicId: string,
  userId: string,
  onlyItemIds?: Set<string>,
): Promise<ServiceResult<{ verified: number }>> {
  const rows = (await getLocalCustodyByReceipt(docId)).filter((r) => r.action === 'turn_in')
  const itemsById = new Map((await getLocalPropertyItems(clinicId)).map((i) => [i.id, i]))
  const at = new Date().toISOString()
  let verified = 0
  for (const row of rows) {
    if (onlyItemIds && !onlyItemIds.has(row.item_id)) continue
    const item = itemsById.get(row.item_id)
    if (!item || item.turned_in_at) continue // gone or already verified
    await applyTurnIn(item, Math.max(1, row.quantity_delta ?? 1), userId, at)
    verified++
  }
  if (verified > 0) await syncTurnInZoneTag(clinicId, userId) // emptied → drop the zone tile
  return succeed({ verified })
}

/** Find the clinic's OPEN turn-in accumulator doc — a turn_in doc with ≥1 item still
 *  active (not yet verified). Staging appends to it ("bring everything on one trip");
 *  null ⇒ none open, mint fresh. */
async function findOpenTurnInDocId(
  clinicId: string,
  itemsById: Map<string, LocalPropertyItem>,
): Promise<string | null> {
  const byDoc = new Map<string, LocalCustodyEntry[]>()
  for (const r of await getLocalCustodyByClinic(clinicId)) {
    if (r.action !== 'turn_in' || !r.hand_receipt_id) continue
    const arr = byDoc.get(r.hand_receipt_id) ?? []
    arr.push(r)
    byDoc.set(r.hand_receipt_id, arr)
  }
  for (const [docId, rows] of byDoc) {
    if (rows.some((r) => { const it = itemsById.get(r.item_id); return it && !it.turned_in_at })) return docId
  }
  return null
}

/**
 * STAGE items for turn-in (the rolling pending bucket). Appends turn_in rows to the
 * clinic's open accumulator doc (one per depot trip; created on demand) WITHOUT applying
 * — items stay on-hand + accountable, just earmarked, fully reversible
 * (unstageTurnInItem). Cascades the SKO subtree + auto-detaches a loose component.
 */
export async function stageTurnIn(params: TurnInParams, userId: string): Promise<ServiceResult<{ turnInDocId: string }>> {
  try {
    const { itemIds, clinicId, fromHolderId, notes } = params
    if (itemIds.length === 0) return fail('No items selected')
    const turnInZoneId = await ensureTurnInZone(clinicId, userId)
    if (!turnInZoneId) return fail('Could not resolve the turn-in zone')
    const itemsById = new Map((await getLocalPropertyItems(clinicId)).map((i) => [i.id, i]))
    const docId = (await findOpenTurnInDocId(clinicId, itemsById)) ?? crypto.randomUUID()
    // Skip ids already staged in this doc (re-stage idempotent; cascade overlap can't dup).
    const already = new Set((await getLocalCustodyByReceipt(docId)).filter((r) => r.action === 'turn_in').map((r) => r.item_id))
    const result = await writeTurnInRows(docId, itemIds, clinicId, fromHolderId, notes?.trim() || null, itemsById, userId, already, turnInZoneId)
    if (!result.success) return fail(result.error)
    await syncTurnInZoneTag(clinicId, userId) // populated → show the zone tile on the map
    return succeed({ turnInDocId: docId })
  } catch (err) {
    return fail(String(err))
  }
}

/** VERIFY a staged turn-in (the depot accepted it): apply the doc's staged items so they
 *  leave the active book. `itemIds` verifies a subset (independent sub-cluster runs). */
export async function verifyTurnIn(
  turnInDocId: string,
  clinicId: string,
  userId: string,
  itemIds?: string[],
): Promise<ServiceResult<{ verified: number }>> {
  try {
    return await applyTurnInDoc(turnInDocId, clinicId, userId, itemIds ? new Set(itemIds) : undefined)
  } catch (err) {
    return fail(String(err))
  }
}

/** UNSTAGE one item from a pending turn-in (changed your mind before the depot run): purge
 *  its staged turn_in rows. The item is untouched (never applied) → it just drops out of
 *  the pending bucket. */
export async function unstageTurnInItem(
  turnInDocId: string,
  itemId: string,
  clinicId: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    const rows = (await getLocalCustodyByReceipt(turnInDocId)).filter((r) => r.action === 'turn_in' && r.item_id === itemId)
    if (rows.length === 0) return succeed()
    await purgeCustodyRows(rows, clinicId, userId, true)

    // Reverse the stage (see writeTurnInRows) so the item leaves the staging zone:
    //  - FULL-MOVED (auth-null) item carries turn_in_origin_location_id → move it back to
    //    that exact zone and clear the origin.
    //  - AUTHORIZED child (untracked, relocated into the zone, split off a zeroed BOM source)
    //    → merge its qty (+ serial, for a serialized line) back into the source and delete
    //    the child, so the shortage clears.
    //  - anything else (legacy) → just dropping the marker is the whole unstage.
    const items = await getLocalPropertyItems(clinicId)
    const staged = items.find((i) => i.id === itemId)
    if (staged && !staged.turned_in_at) {
      if (staged.turn_in_origin_location_id != null) {
        await updateItem(
          staged.id,
          { location_id: staged.turn_in_origin_location_id ?? null, turn_in_origin_location_id: null },
          userId,
          { skipAudit: true },
        )
      } else {
        // Untracked stock sitting in the zone = an authorized child; find its zeroed source.
        const norm = (s: string | null) => (s ?? '').trim().toLowerCase()
        const source = items.find((i) =>
          i.id !== staged.id &&
          i.quantity_authorized != null &&
          !i.turned_in_at &&
          norm(i.name) === norm(staged.name) &&
          (staged.nsn ? i.nsn === staged.nsn : !i.nsn)
        )
        if (source) {
          await updateItem(
            source.id,
            staged.is_serialized
              ? { quantity: source.quantity + staged.quantity, serial_number: staged.serial_number, is_serialized: true }
              : { quantity: source.quantity + staged.quantity },
            userId,
            { skipAudit: true },
          )
          await deleteItem(staged.id, userId)
        }
      }
    }
    await syncTurnInZoneTag(clinicId, userId) // maybe emptied → drop the zone tile
    await immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

/** DELETE a submitted DA 3161 turn-in document (record removal). Purges the doc's
 *  VERIFIED turn_in ledger rows so it drops out of the Turn-In history. This is NOT an
 *  undo: the turned-in items keep their turned_in_at marker (gone for good) — the
 *  equipment is NOT restored to the book. Any still-pending rows of a subset-verified
 *  doc are left alone (unstage handles those + restores their staged stock). */
export async function deleteTurnInDoc(
  turnInDocId: string,
  clinicId: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    const allRows = (await getLocalCustodyByReceipt(turnInDocId)).filter((r) => r.action === 'turn_in')
    if (allRows.length === 0) return succeed()
    const itemsById = new Map((await getLocalPropertyItems(clinicId)).map((i) => [i.id, i]))
    const rows = allRows.filter((r) => itemsById.get(r.item_id)?.turned_in_at)
    if (rows.length === 0) return succeed()
    await purgeCustodyRows(rows, clinicId, userId, true)
    await immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

/** One-shot turn-in (turn in NOW, no staging): fresh doc, write rows, verify immediately. */
export async function completeTurnIn(params: TurnInParams, userId: string): Promise<ServiceResult<{ turnInDocId: string }>> {
  try {
    const { itemIds, clinicId, fromHolderId, notes } = params
    if (itemIds.length === 0) return fail('No items selected')
    const turnInDocId = crypto.randomUUID()
    const turnInZoneId = await ensureTurnInZone(clinicId, userId)
    if (!turnInZoneId) return fail('Could not resolve the turn-in zone')
    const itemsById = new Map((await getLocalPropertyItems(clinicId)).map((i) => [i.id, i]))
    const written = await writeTurnInRows(turnInDocId, itemIds, clinicId, fromHolderId, notes?.trim() || null, itemsById, userId, new Set(), turnInZoneId)
    if (!written.success) return fail(written.error)
    const verify = await applyTurnInDoc(turnInDocId, clinicId, userId)
    if (!verify.success) return fail(verify.error)
    return succeed({ turnInDocId })
  } catch (err) {
    return fail(String(err))
  }
}

// ── DA 2062 hand receipt — edit / delete ─────────────────────
//
// A hand receipt is an editable document (USR: "consider it an edited signal
// message"): remove an item, add an item, or delete the whole 2062. Removing an
// item / deleting a receipt purges its custody_ledger rows EVERYWHERE (local +
// spine hard-delete + a cross-device 'd' custody envelope) and signs the affected
// items back in (clear holder → they return to their standing zone). custody_ledger
// is no longer append-only for these paths (custody_ledger_delete RLS + the vault
// custody 'd' route + delete-aware snapshot live-ids back this).

/**
 * Hard-delete a set of custody rows everywhere: local IDB, the plaintext spine
 * (drop any pending create first, then enqueue a delete), and a per-device 'd'
 * custody envelope so peer devices drop them too. With `purgeTimeline`, also delete
 * each row's dual-written item.transferred timeline entry (records+timeline scope).
 */
async function purgeCustodyRows(
  rows: LocalCustodyEntry[],
  clinicId: string,
  userId: string,
  purgeTimeline: boolean,
): Promise<void> {
  for (const r of rows) {
    await deleteLocalCustody(r.id)
    // Drop any still-pending create so it can't re-insert after the delete, then
    // enqueue the spine hard-delete.
    await removeSyncQueueItemsForRecord(userId, 'custody_ledger', r.id)
    await addToSyncQueue({
      user_id: userId,
      action: 'delete',
      table_name: 'custody_ledger',
      record_id: r.id,
      payload: {},
    })

    const targets = r.target_clinic_ids ?? [clinicId]
    const originId = crypto.randomUUID()
    await fanProperty(
      userId, 'd', 'custody',
      { id: r.id, clinic_id: r.clinic_id ?? clinicId, target_clinic_ids: targets, originId, data: { id: r.id } },
      [], clinicId,
    )
    // Clean up the row's ORIGINAL create envelope too (mirrors updateItem retract).
    if (r.originId) { for (const c of targets) await deletePropertyVaultMessages([r.originId], c) }

    if (purgeTimeline) await deleteTransferAuditForCustody(r.item_id, r.recorded_at, userId)
  }
}

/**
 * Remove ONE item from a hand receipt (edit the 2062 to drop an item): purge that
 * item's rows on the receipt + their timeline entries, and sign the item back in.
 */
export async function removeReceiptItem(
  handReceiptId: string,
  itemId: string,
  clinicId: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    const rows = (await getLocalCustodyByReceipt(handReceiptId)).filter((r) => r.item_id === itemId)
    if (rows.length === 0) return fail('Item not found on receipt')
    const qty = signedOutQty(rows, itemId)
    // Recipient captured BEFORE the purge wipes the rows — needed to locate any
    // split-off move-to-zone stack afterwards.
    const toHolder = rows.find((r) => r.action === 'sign_down')?.to_holder_id ?? null
    await purgeCustodyRows(rows, clinicId, userId, true)
    // No sign_up row — the receipt record is gone; just put the item back on-hand
    // (stack) or clear its holder (serialized). Read the item AFTER purge.
    const allItems = await getLocalPropertyItems(clinicId)
    const item = allItems.find((i) => i.id === itemId)
    if (item) {
      await applyReturn(item, qty, userId)
      // Drop the split-off destination stack a partial move-to-zone left behind, so the
      // qty put back on the source isn't double-counted.
      await removeMovedStack(item, toHolder, qty, allItems, await getLocalPropertyLocations(clinicId), userId)
    }
    await immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

/**
 * Add items to an existing hand receipt (edit the 2062 to add an item): append a
 * sign_down row per item carrying the receipt's hand_receipt_id + recipient, and
 * point each item at that custodian. Recipient (internal/external) is read from the
 * receipt's existing head row.
 */
export async function addReceiptItems(
  handReceiptId: string,
  itemIds: string[],
  clinicId: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    if (itemIds.length === 0) return fail('No items selected')
    const existing = await getLocalCustodyByReceipt(handReceiptId)
    const head = existing.filter((r) => r.action === 'sign_down').sort(byRecordedDesc)[0]
    if (!head) return fail('Receipt not found')
    const toHolderId = head.to_holder_id
    const isExternal = !toHolderId
    const custody: CustodyState = isExternal
      ? { signed_out_external: true, current_holder_id: null }
      : { signed_out_external: false, current_holder_id: toHolderId }
    const itemsById = new Map((await getLocalPropertyItems(clinicId)).map((i) => [i.id, i]))

    // Same SKO subtree atom as the sign-out path: detach loose components, then expand
    // each added item to its component subtree. Skip ids already on this receipt so a
    // cascade that overlaps an existing line can't double sign_down.
    await detachLooseComponents(itemIds, itemsById, userId)
    const originallySelected = new Set(itemIds)
    const alreadyOnReceipt = new Set(existing.filter((r) => r.action === 'sign_down').map((r) => r.item_id))
    const expandedIds = expandSubtrees(itemIds, [...itemsById.values()]).filter((id) => !alreadyOnReceipt.has(id))

    for (const itemId of expandedIds) {
      const item = itemsById.get(itemId)
      if (!item) continue
      if (!item.is_serialized && item.quantity <= 0) continue // nothing on hand to add
      // Add-to-receipt has no quantity picker, so a directly-added non-serialized stack
      // signs out a single unit (qty 1; use the sign-out form for a multi-count
      // transfer); a cascaded component rides WHOLE with its kit (full on-hand).
      const signQty = item.is_serialized || originallySelected.has(itemId) ? 1 : item.quantity
      const ledgerResult = await recordLedgerEntry(
        {
          item_id: itemId,
          clinic_id: clinicId,
          hand_receipt_id: handReceiptId,
          action: 'sign_down',
          quantity_delta: signQty,
          from_holder_id: head.from_holder_id,
          to_holder_id: toHolderId,
          condition_code: 'serviceable',
          sub_item_check: null,
          notes: head.notes, // carries the external recipient name for external receipts
          recorded_by: userId,
        },
        userId,
      )
      if (!ledgerResult.success) return fail(ledgerResult.error)

      await applyOutbound(item, signQty, custody, userId)
    }
    await immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

/**
 * Delete an ENTIRE hand receipt (delete the 2062): purge every custody row on it
 * (sign_down + sign_up) + their timeline entries, and sign its STILL-OUTSTANDING
 * items back in. A RETURNED receipt's items are already back (signInReceipt ran), so
 * deleting that historical 2062 returns nothing to stock and clears no holder — it
 * only purges the document + timeline (netOutstandingQty == 0).
 */
export async function deleteHandReceipt(
  handReceiptId: string,
  clinicId: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    const rows = await getLocalCustodyByReceipt(handReceiptId)
    if (rows.length === 0) return fail('Receipt not found')
    const itemIds = [...new Set(rows.filter((r) => r.action === 'sign_down').map((r) => r.item_id))]
    // Net qty STILL OUT per item, captured BEFORE the purge wipes the rows. Returned
    // receipts net to 0 → their delete is a pure document/timeline purge.
    const qtyByItem = new Map(itemIds.map((id) => [id, netOutstandingQty(rows, id)]))
    // Recipient per item captured BEFORE the purge — used to reconcile move-to-zone stacks.
    const toHolderByItem = new Map(
      itemIds.map((id) => [id, rows.find((r) => r.action === 'sign_down' && r.item_id === id)?.to_holder_id ?? null]),
    )
    await purgeCustodyRows(rows, clinicId, userId, true)
    const allItems = await getLocalPropertyItems(clinicId)
    const itemsById = new Map(allItems.map((i) => [i.id, i]))
    const locs = await getLocalPropertyLocations(clinicId)
    for (const itemId of itemIds) {
      const out = qtyByItem.get(itemId) ?? 0
      if (out <= 0) continue // already signed in — don't re-return stock / re-clear holder
      const item = itemsById.get(itemId)
      if (item) {
        await applyReturn(item, out, userId)
        // Delete the split-off destination stack a partial move-to-zone left behind
        // (returned receipts skip via out<=0 — sign-in already removed it).
        await removeMovedStack(item, toHolderByItem.get(itemId) ?? null, out, allItems, locs, userId)
      }
    }
    await immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

// ── Visual Fingerprint ───────────────────────────────────────

export async function updateFingerprint(
  id: string,
  fingerprint: VisualFingerprint,
  userId: string,
): Promise<ServiceResult<{ item: LocalPropertyItem }>> {
  try {
    const db = await getDb()
    const existing = await db.get('propertyItems', id)
    if (!existing) return fail('Item not found')

    const now = new Date().toISOString()
    const updates = { visual_fingerprint: fingerprint, updated_at: now }
    const updated: LocalPropertyItem = {
      ...existing,
      ...updates,
      _sync_status: 'pending',
    }

    await saveLocalPropertyItem(updated)

    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'property_items',
      record_id: id,
      payload: updates as unknown as Record<string, unknown>,
    })

    immediateSync(userId)
    return succeed({ item: updated })
  } catch (err) {
    return fail(String(err))
  }
}

// ── Expended Entry ───────────────────────────────────────────

export async function recordExpendedEntry(
  itemId: string,
  quantityDelta: number,
  clinicId: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    const now = new Date().toISOString()
    // Offline-first: queue the append-only ledger entry so field/offline
    // expends still produce an accountability record (synced on reconnect).
    const originId = crypto.randomUUID()
    const targets = clinicId ? [clinicId] : []
    const ledgerEntry: CustodyLedgerEntry = {
      id: crypto.randomUUID(),
      item_id: itemId,
      clinic_id: clinicId,
      action: 'expended',
      quantity_delta: quantityDelta,
      from_holder_id: null,
      to_holder_id: null,
      condition_code: 'serviceable',
      sub_item_check: null,
      notes: null,
      recorded_at: now,
      recorded_by: userId,
      target_clinic_ids: targets,
      originId,
    }

    await saveLocalCustodyEntry({
      ...ledgerEntry,
      _sync_status: 'pending', _sync_retry_count: 0, _last_sync_error: null, _last_sync_error_message: null,
    })

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'custody_ledger',
      record_id: ledgerEntry.id,
      payload: toSpine(ledgerEntry as unknown as Record<string, unknown>),
    })

    await fanProperty(userId, 'c', 'custody', {
      id: ledgerEntry.id, clinic_id: clinicId, target_clinic_ids: targets, originId,
      data: toEnvelope(ledgerEntry as unknown as Record<string, unknown>),
    }, [], clinicId)

    // Dual-write into the unified audit_log (see recordLedgerEntry).
    await emitAudit(
      {
        clinicId,
        actorId: userId,
        domain: 'property',
        eventType: 'item.expended',
        subjectType: 'item',
        subjectId: itemId,
        occurredAt: now,
        payload: { quantity_delta: quantityDelta, condition_code: 'serviceable' },
      },
      userId,
    )

    immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

// ── Split / Merge audit events ───────────────────────────────

/** A portion branched off `sourceItemId` into `toItemId` (the moved portion).
 *  Spine/audit-only (the quantity rebalance rides the item updates). REVERSIBLE:
 *  undoLastEvent merges the portion back. A whole-quantity move is an item.moved,
 *  not a split — see usePropertyStore.splitItem. */
export async function recordItemSplit(
  sourceItemId: string,
  toItemId: string,
  quantity: number,
  clinicId: string,
  userId: string,
): Promise<void> {
  await emitAudit(
    {
      clinicId, actorId: userId, domain: 'property',
      eventType: 'item.split', subjectType: 'item', subjectId: sourceItemId,
      occurredAt: new Date().toISOString(),
      payload: { to_item_id: toItemId, quantity },
    },
    userId,
  )
}

/** `targetItemId` absorbed a source stack (`fromName` ×`quantity`). Emitted on the
 *  surviving TARGET so its timeline reads "Absorbed ×N from X". TERMINAL — the
 *  source row is deleted and its history ceases; this is NOT undoable. */
export async function recordItemMerge(
  targetItemId: string,
  fromName: string,
  quantity: number,
  clinicId: string,
  userId: string,
): Promise<void> {
  await emitAudit(
    {
      clinicId, actorId: userId, domain: 'property',
      eventType: 'item.merged', subjectType: 'item', subjectId: targetItemId,
      occurredAt: new Date().toISOString(),
      payload: { from_name: fromName, quantity },
    },
    userId,
  )
}

// ── Search ───────────────────────────────────────────────────

export async function searchProperty(
  clinicId: string,
  query: string,
): Promise<PropertySearchResult[]> {
  if (!query.trim()) return []

  const q = query.toLowerCase()
  const results: PropertySearchResult[] = []

  const items = await getLocalPropertyItems(clinicId)
  for (const item of items) {
    const searchable = [item.name, item.nomenclature, item.nsn, item.lin, item.serial_number]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    if (searchable.includes(q)) {
      results.push({
        type: 'item',
        id: item.id,
        name: item.name,
        detail: item.nsn || item.serial_number || null,
      })
    }
  }

  const locations = await getLocalPropertyLocations(clinicId)
  for (const loc of locations) {
    if (loc.name.toLowerCase().includes(q)) {
      results.push({
        type: 'location',
        id: loc.id,
        name: loc.name,
        detail: null,
      })
    }
  }

  return results
}
