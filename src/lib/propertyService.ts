/**
 * Property / Equipment Management service layer.
 *
 * Offline-first: all writes go to IndexedDB first, then sync queue,
 * then attempt immediate push to Supabase.
 */
import { supabase } from './supabase'
import { succeed, fail, type ServiceResult } from './result'
import { createLogger } from '../Utilities/Logger'
import { addToSyncQueue } from './offlineDb'
import {
  getDb,
  getLocalPropertyItems,
  saveLocalPropertyItem,
  deleteLocalPropertyItem,
  getLocalPropertyItemsByHolder,
  getLocalPropertySubItems,
  getLocalPropertyLocations,
  saveLocalPropertyLocation,
  deleteLocalPropertyLocation,
  getLocalDiscrepancies,
  saveLocalDiscrepancy,
} from './offlineDb'
import { processSyncQueue, isOnline } from './syncService'
import type {
  PropertyItem,
  PropertyLocation,
  LocationTag,
  CustodyLedgerEntry,
  Discrepancy,
  LocalPropertyItem,
  LocalPropertyLocation,
  LocalDiscrepancy,
  TransferPayload,
  PropertySearchResult,
  SubItemCheck,
  SyncStatus,
} from '../Types/PropertyTypes'

const logger = createLogger('PropertyService')

// ── Helpers ──────────────────────────────────────────────────

function localItem(item: PropertyItem, syncStatus: SyncStatus = 'pending'): LocalPropertyItem {
  return {
    ...item,
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

// ── Property Items CRUD ──────────────────────────────────────

export async function fetchClinicItems(clinicId: string): Promise<LocalPropertyItem[]> {
  // Load local first for instant display
  const localItems = await getLocalPropertyItems(clinicId)

  // If online, reconcile with server
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('property_items')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('name')

      if (!error && data) {
        const serverMap = new Map(data.map((r: PropertyItem) => [r.id, r]))
        const localMap = new Map(localItems.map((r) => [r.id, r]))

        // Download server-only or newer records
        for (const serverRecord of data) {
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

        // Remove local synced records not on server
        for (const local of localItems) {
          if (local._sync_status === 'synced' && !serverMap.has(local.id)) {
            await deleteLocalPropertyItem(local.id)
          }
        }
      }
    } catch (err) {
      logger.warn('Server reconciliation failed, using local data:', err)
    }
  }

  return getLocalPropertyItems(clinicId)
}

export async function createItem(
  data: Omit<PropertyItem, 'id' | 'created_at' | 'updated_at'>,
  userId: string,
): Promise<ServiceResult<{ item: LocalPropertyItem }>> {
  try {
    const now = new Date().toISOString()
    const item: PropertyItem = {
      ...data,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    }

    const local = localItem(item)
    await saveLocalPropertyItem(local)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'property_items',
      record_id: item.id,
      payload: item as unknown as Record<string, unknown>,
    })

    immediateSync(userId)
    return succeed({ item: local })
  } catch (err) {
    return fail(String(err))
  }
}

export async function updateItem(
  id: string,
  updates: Partial<PropertyItem>,
  userId: string,
): Promise<ServiceResult<{ item: LocalPropertyItem }>> {
  try {
    const db = await getDb()
    const existing = await db.get('propertyItems', id)
    if (!existing) return fail('Item not found')

    const now = new Date().toISOString()
    const updated: LocalPropertyItem = {
      ...existing,
      ...updates,
      updated_at: now,
      _sync_status: 'pending',
    }

    await saveLocalPropertyItem(updated)

    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'property_items',
      record_id: id,
      payload: { ...updates, updated_at: now } as Record<string, unknown>,
    })

    immediateSync(userId)
    return succeed({ item: updated })
  } catch (err) {
    return fail(String(err))
  }
}

export async function deleteItem(
  id: string,
  userId: string,
): Promise<ServiceResult> {
  try {
    await deleteLocalPropertyItem(id)

    await addToSyncQueue({
      user_id: userId,
      action: 'delete',
      table_name: 'property_items',
      record_id: id,
      payload: { _deleted_at_timestamp: new Date().toISOString() },
    })

    immediateSync(userId)
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

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('property_locations')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('name')

      if (!error && data) {
        const serverMap = new Map(data.map((r: PropertyLocation) => [r.id, r]))
        const localMap = new Map(localLocs.map((r) => [r.id, r]))

        for (const serverRecord of data) {
          const local = localMap.get(serverRecord.id)
          if (!local || (local._sync_status !== 'pending' && new Date(serverRecord.updated_at).getTime() >= new Date(local.updated_at).getTime())) {
            await saveLocalPropertyLocation(localLocation(serverRecord as PropertyLocation, 'synced'))
          }
        }

        for (const local of localLocs) {
          if (local._sync_status === 'synced' && !serverMap.has(local.id)) {
            await deleteLocalPropertyLocation(local.id)
          }
        }
      }
    } catch (err) {
      logger.warn('Location reconciliation failed:', err)
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
    const location: PropertyLocation = {
      ...data,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    }

    const local = localLocation(location)
    await saveLocalPropertyLocation(local)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'property_locations',
      record_id: location.id,
      payload: location as unknown as Record<string, unknown>,
    })

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
    const updated: LocalPropertyLocation = {
      ...existing,
      ...updates,
      updated_at: now,
      _sync_status: 'pending',
    }

    await saveLocalPropertyLocation(updated)

    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'property_locations',
      record_id: id,
      payload: { ...updates, updated_at: now } as Record<string, unknown>,
    })

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
    await deleteLocalPropertyLocation(id)

    await addToSyncQueue({
      user_id: userId,
      action: 'delete',
      table_name: 'property_locations',
      record_id: id,
      payload: { _deleted_at_timestamp: new Date().toISOString() },
    })

    immediateSync(userId)
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

// ── Location Tags ────────────────────────────────────────────

export async function fetchLocationTags(locationId: string): Promise<LocationTag[]> {
  if (!isOnline()) return []
  try {
    const { data, error } = await supabase
      .from('location_tags')
      .select('*')
      .eq('location_id', locationId)
    if (error) throw error
    return (data as LocationTag[]) ?? []
  } catch (err) {
    logger.warn('Failed to fetch location tags:', err)
    return []
  }
}

export async function upsertLocationTags(
  locationId: string,
  tags: Omit<LocationTag, 'id'>[],
): Promise<ServiceResult> {
  if (!isOnline()) return fail('Tags require connectivity')
  try {
    // Full replace: delete existing, insert new
    await supabase.from('location_tags').delete().eq('location_id', locationId)

    if (tags.length > 0) {
      const rows = tags.map((t) => ({
        id: crypto.randomUUID(),
        location_id: locationId,
        target_type: t.target_type,
        target_id: t.target_id,
        x: t.x,
        y: t.y,
        label: t.label,
      }))
      const { error } = await supabase.from('location_tags').insert(rows)
      if (error) return fail(error.message)
    }
    return succeed()
  } catch (err) {
    return fail(String(err))
  }
}

// ── Custody Ledger ───────────────────────────────────────────

export async function recordLedgerEntry(
  entry: Omit<CustodyLedgerEntry, 'id' | 'recorded_at'>,
  userId: string,
): Promise<ServiceResult<{ entry: CustodyLedgerEntry }>> {
  try {
    const now = new Date().toISOString()
    const ledgerEntry: CustodyLedgerEntry = {
      ...entry,
      id: crypto.randomUUID(),
      recorded_at: now,
    }

    // Ledger is append-only and primarily online
    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'custody_ledger',
      record_id: ledgerEntry.id,
      payload: ledgerEntry as unknown as Record<string, unknown>,
    })

    immediateSync(userId)
    return succeed({ entry: ledgerEntry })
  } catch (err) {
    return fail(String(err))
  }
}

export async function fetchItemLedger(itemId: string): Promise<CustodyLedgerEntry[]> {
  if (!isOnline()) return []
  try {
    const { data, error } = await supabase
      .from('custody_ledger')
      .select('*')
      .eq('item_id', itemId)
      .order('recorded_at', { ascending: false })
    if (error) throw error
    return (data as CustodyLedgerEntry[]) ?? []
  } catch (err) {
    logger.warn('Failed to fetch ledger:', err)
    return []
  }
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
    const disc: Discrepancy = {
      ...data,
      id: crypto.randomUUID(),
      status: 'open',
      rectified_at: null,
      rectified_by: null,
      rectify_method: null,
      rectify_notes: null,
      created_at: now,
    }

    const local = localDiscrepancy(disc)
    await saveLocalDiscrepancy(local)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'discrepancies',
      record_id: disc.id,
      payload: disc as unknown as Record<string, unknown>,
    })

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
    const updated: LocalDiscrepancy = {
      ...existing,
      status: 'rectified',
      rectified_at: now,
      rectified_by: userId,
      rectify_method: method as LocalDiscrepancy['rectify_method'],
      rectify_notes: notes || null,
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

    // 3. Update parent item holder
    await updateItem(payload.parent_item_id, { current_holder_id: payload.to_holder_id }, userId)

    // 4. Process each sub-item
    let discrepancyCount = 0
    for (const checkItem of payload.checklist) {
      if (checkItem.present) {
        // Present: transfer to new holder
        await updateItem(checkItem.item_id, { current_holder_id: payload.to_holder_id }, userId)
      } else {
        // Missing: mark as missing, create discrepancy
        await updateItem(checkItem.item_id, { condition_code: 'missing' }, userId)

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
