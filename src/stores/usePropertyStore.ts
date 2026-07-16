import { create } from 'zustand'
import type {
  LocalPropertyItem,
  LocalPropertyLocation,
  HolderInfo,
  PropertyItem,
  PropertyLocation,
  VisualFingerprint,
  ItemType,
  UnitOfIssue,
} from '../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../Types/PropertyTypes'
import { useAuthStore } from './useAuthStore'
import { supabase } from '../lib/supabase'
import {
  fetchClinicItems,
  createItem,
  createItemsBatch,
  updateItem,
  deleteItem,
  fetchClinicLocations,
  createLocation,
  createLevel,
  updateLocation,
  deleteLocation,
  fetchSubItems,
  syncLocationNameToTags,
  ensureRootLocation,
  ensureMemberLocations,
  ensureDefaultClusterZone,
  ensureTurnInZone,
  healReservedZonePlacement,
  reconcileLocationsFromTags,
  updateFingerprint,
  recordExpendedEntry,
  recordPmcs as recordPmcsSvc,
  editPmcsEntry as editPmcsEntrySvc,
  deletePmcsEntry as deletePmcsEntrySvc,
  openDispatch as openDispatchSvc,
  closeDispatch as closeDispatchSvc,
  signOutItems,
  signInReceipt,
  fetchClinicLedger,
  stageTurnIn as stageTurnInSvc,
  verifyTurnIn as verifyTurnInSvc,
  unstageTurnInItem as unstageTurnInItemSvc,
  deleteTurnInDoc as deleteTurnInDocSvc,
  recordItemSplit,
  recordItemMerge,
} from '../lib/propertyService'
import type { CustodyLedgerEntry } from '../Types/PropertyTypes'
import type { AuditEvent } from '../lib/auditTypes'
import type { PmcsReadings, DispatchOpenInput, DispatchCloseInput } from '../lib/propertyService'
import { setupConnectivityListeners, healStuckPendingRecords } from '../lib/syncService'
import { getLocalPropertyItems, getLocalPropertyLocations } from '../lib/offlineDb'
import { invalidate, useInvalidationStore } from './useInvalidationStore'
import { createLogger } from '../Utilities/Logger'
import { isLinContainer } from '../Utilities/propertyAuthorized'
import type { ReconcilePlan } from '../Utilities/PropertyCSV'

const logger = createLogger('PropertyStore')

const collectDescendants = (parentId: string, allLocs: LocalPropertyLocation[]): string[] => {
  const children = allLocs.filter(l => l.parent_id === parentId)
  return children.flatMap(c => [c.id, ...collectDescendants(c.id, allLocs)])
}

interface PropertyState {
  items: LocalPropertyItem[]
  locations: LocalPropertyLocation[]
  holders: Map<string, HolderInfo>
  clinicMembers: HolderInfo[]
  isLoading: boolean
  isSyncing: boolean
  clinicId: string | null

  editingItem: LocalPropertyItem | null
  selectedZoneId: string | null
  rootLocationId: string | null
  defaultLocationId: string | null
  tagVersion: number
  transitionState: 'idle' | 'zooming-in' | 'zooming-out'
  /** Active floor per level-container (containerLocationId → active level locationId). */
  activeLevelByContainer: Record<string, string>

  visibleLocations: () => LocalPropertyLocation[]

  setEditingItem: (item: LocalPropertyItem | null) => void
  selectZone: (zoneId: string | null) => void
  setActiveLevel: (containerId: string, levelId: string) => void
  navigateToPath: (path: string[]) => void
  setRootLocationId: (id: string | null) => void
  setDefaultLocationId: (id: string | null) => void
  bumpTagVersion: () => void
  setTransitionState: (state: 'idle' | 'zooming-in' | 'zooming-out') => void

  init: () => Promise<void>
  addItem: (data: Omit<PropertyItem, 'id' | 'created_at' | 'updated_at' | 'signed_out_external' | 'owner_user_id' | 'quantity_authorized' | 'turned_in_at' | 'item_type' | 'unit_of_issue' | 'pack_size'> & { quantity_authorized?: number | null; item_type?: ItemType; unit_of_issue?: UnitOfIssue | null; pack_size?: number | null }) => Promise<LocalPropertyItem | null>
  editItem: (id: string, updates: Partial<PropertyItem>, opts?: { skipAudit?: boolean }) => Promise<void>
  /** Apply a reconciled CSV import in one shot: batch-creates LIN containers + new items
   *  (coalesced vault fan-out), applies merges/de-auths, then commits ONE state update.
   *  Returns the number of applied operations. */
  applyImport: (plan: ReconcilePlan) => Promise<number>
  removeItem: (id: string) => Promise<void>
  addLocation: (data: Omit<PropertyLocation, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; location?: LocalPropertyLocation }>
  addLevel: (parentId: string, name: string, ordinal: number) => Promise<LocalPropertyLocation | null>
  editLocation: (id: string, updates: Partial<PropertyLocation>) => Promise<void>
  removeLocation: (id: string) => Promise<void>
  refreshItems: () => Promise<void>
  refreshLocations: () => Promise<void>
  enrollFingerprint: (itemId: string, fingerprint: VisualFingerprint) => Promise<void>
  expendItem: (itemId: string, quantityDelta: number) => Promise<void>
  /** Sign 1..N items out on a single DA 2062 hand receipt. `toHolderId` set =
   *  internal cluster member; null + `externalName` = outside-cluster recipient.
   *  Resolves to the new hand_receipt_id (for immediate printing) or null. */
  signOut: (params: { itemIds: string[]; quantities?: Record<string, number>; toHolderId: string | null; externalName: string | null; notes: string | null; moveToZone?: boolean }) => Promise<string | null>
  /** Sign a hand receipt back in — clears each item's custodian. `toLocationId`
   *  re-places the returned items at the chosen zone (absent = leave as-is). */
  signIn: (handReceiptId: string, fromHolderId: string | null, itemIds: string[], toLocationId?: string | null) => Promise<boolean>
  /** Stage items for turn-in (rolling pending bucket; reversible). Returns the doc id. */
  stageTurnIn: (itemIds: string[], notes?: string | null) => Promise<string | null>
  /** Verify a staged turn-in (depot accepted) → the items leave the active book. `itemIds` = a subset. */
  verifyTurnIn: (turnInDocId: string, itemIds?: string[]) => Promise<boolean>
  /** Drop one item from a pending turn-in before the depot run. */
  unstageTurnInItem: (turnInDocId: string, itemId: string) => Promise<boolean>
  /** Delete a submitted DA 3161 record — does NOT restore equipment (items stay turned in). */
  deleteTurnInDoc: (turnInDocId: string) => Promise<boolean>
  /** Clinic-wide custody ledger (newest first) for the accountability surface. */
  fetchLedger: () => Promise<CustodyLedgerEntry[]>
  splitItem: (itemId: string, qty: number, targetLocationId: string | null) => Promise<void>
  mergeItems: (sourceId: string, targetId: string) => Promise<void>
  /** Reverse the most recent (head) timeline event of an item. Caller passes the
   *  head event it is displaying. Only move/assign/edit/split heads are undoable
   *  (terminal merge/turn-in/delete and custody have their own flows). */
  undoLastEvent: (itemId: string, head: AuditEvent) => Promise<void>
  /** Record a PMCS check — the whole check in one event. `readings` carries the
   *  vehicle intake (mileage, fuel), who did it, an optional 5988E, and the faults
   *  the check found/corrected (faultsOpened/faultsCorrected); omit for a
   *  non-vehicle clean-check paper-trail entry. Faults live in the audit row, not
   *  subject state. */
  recordPmcs: (subjectType: 'item' | 'location', subjectId: string, readings?: PmcsReadings) => Promise<boolean>
  /** Edit a PMCS history entry in place — `payload` is the full new event payload
   *  ({ description } for a fault, { corrects, note } for a correction). */
  editPmcsEntry: (eventId: string, payload: Record<string, unknown>) => Promise<boolean>
  /** Delete a PMCS history entry (fault / correction / clean check). Also used
   *  for dispatch history rows (generic audit edit/delete by event id). */
  deletePmcsEntry: (eventId: string) => Promise<boolean>
  /** Put a vehicle on dispatch (DA 5982/5987). Resolves to the dispatch.opened
   *  event id (so a later return can close it) or null. */
  openDispatch: (subjectId: string, input: DispatchOpenInput) => Promise<string | null>
  /** Close (return) an open dispatch — `input.dispatches` is the opened event id. */
  closeDispatch: (subjectId: string, input: DispatchCloseInput) => Promise<boolean>
}

let cleanupListeners: (() => void) | null = null
let cleanupInvalidation: (() => void) | null = null

export const usePropertyStore = create<PropertyState>((set, get) => ({
  items: [],
  locations: [],
  holders: new Map(),
  clinicMembers: [],
  isLoading: false,
  isSyncing: false,
  clinicId: null,

  editingItem: null,
  selectedZoneId: null,
  rootLocationId: null,
  defaultLocationId: null,
  tagVersion: 0,
  transitionState: 'idle',
  activeLevelByContainer: {},

  visibleLocations: () => {
    return get().locations.filter(l => l.name !== ROOT_LOCATION_NAME)
  },

  setEditingItem: (item) => set({ editingItem: item }),
  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),
  setActiveLevel: (containerId, levelId) =>
    set((state) => ({ activeLevelByContainer: { ...state.activeLevelByContainer, [containerId]: levelId } })),

  navigateToPath: (path) => set({
    selectedZoneId: path[path.length - 1] ?? null,
  }),

  setRootLocationId: (id) => set({ rootLocationId: id }),
  setDefaultLocationId: (id) => set({ defaultLocationId: id }),
  bumpTagVersion: () => set((state) => ({ tagVersion: state.tagVersion + 1 })),
  setTransitionState: (state) => set({ transitionState: state }),

  init: async () => {
    const user = useAuthStore.getState().user
    if (!user) return

    set({ isLoading: true })

    try {
      // clinic_id is already resolved at login (useAuthStore.clinic_id, sync-hydrated
      // from cached roles). Reuse it instead of a duplicate profiles GET; only fall
      // back to the wire if the store hasn't populated it yet (init before profile).
      let clinicId = useAuthStore.getState().clinicId ?? null
      if (!clinicId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('clinic_id')
          .eq('id', user.id)
          .maybeSingle()
        clinicId = profile?.clinic_id ?? null
      }
      if (!clinicId) {
        logger.warn('No clinic_id found for user')
        set({ isLoading: false })
        return
      }

      set({ clinicId, activeLevelByContainer: {} })

      healStuckPendingRecords(user.id)

      const [items, locations, holdersResult] = await Promise.all([
        fetchClinicItems(clinicId),
        fetchClinicLocations(clinicId),
        supabase
          .from('profiles')
          .select('id, rank, first_name, last_name, sub_cluster_id')
          .eq('clinic_id', clinicId),
      ])

      const holderMap = new Map<string, HolderInfo>()
      const memberList: HolderInfo[] = []
      if (holdersResult.data) {
        for (const p of holdersResult.data) {
          const info: HolderInfo = {
            id: p.id,
            rank: p.rank,
            firstName: p.first_name,
            lastName: p.last_name,
            displayName: [p.rank, p.last_name, p.first_name].filter(Boolean).join(' '),
            subClusterId: p.sub_cluster_id ?? null,
          }
          holderMap.set(p.id, info)
          memberList.push(info)
        }
      }

      const rootLoc = await ensureRootLocation(clinicId, user.id)

      // Set initial data — keep isLoading true so PropertyPanel spinner holds
      // if the first fetch returned nothing (the reconciliation below may fix it).
      // If locations already has data, PropertyPanel's hasData guard will render
      // the list immediately without waiting for isLoading to flip.
      set({
        items,
        locations,
        holders: holderMap,
        clinicMembers: memberList,
        rootLocationId: rootLoc.id,
      })

      // Reconcile: any zone on the root canvas whose target_id has no matching
      // property_locations record gets created here (preserving the original ID).
      // This fixes the case where locationTags and propertyLocations diverged.
      await reconcileLocationsFromTags(clinicId, user.id, rootLoc.id, locations)

      // Eagerly ensure every clinic member has a persisted location record
      await ensureMemberLocations(clinicId, user.id, memberList, rootLoc.id)
      // Ensure the cluster's default zone (BAS) exists as the standing calendar room
      await ensureDefaultClusterZone(clinicId, user.id, rootLoc.id)
      // Ensure the cluster's DA 3161 turn-in staging zone exists (conditionally rendered)
      await ensureTurnInZone(clinicId, user.id)
      // Migrate any reserved-family tiles (personnel + turn-in) stranded in the old top
      // grid into the hidden bottom band. Idempotent geometry-only heal; no-op once packed.
      await healReservedZonePlacement(clinicId, user.id, rootLoc.id)
      const freshLocations = await fetchClinicLocations(clinicId)
      set({ locations: freshLocations, isLoading: false })

      if (cleanupListeners) {
        cleanupListeners()
        cleanupListeners = null
      }

      cleanupListeners = setupConnectivityListeners(user.id, {
        clinicId,
        onSyncStart: () => set({ isSyncing: true }),
        onSyncComplete: () => set({ isSyncing: false }),
        onPropertyReconcileComplete: (reconciledItems) => set({ items: reconciledItems }),
        onLocationsReconcileComplete: () => { void get().refreshLocations() },
        getLocations: () => get().locations,
        onTagsReconcileComplete: () => set((state) => ({ tagVersion: state.tagVersion + 1 })),
      })

      // Vault-authoritative refresh: live per-device fan-out and the clinic-vault
      // drain fold property changes into IDB and bump invalidate('properties').
      // Re-read items + zones from IDB on each bump so peer changes surface live.
      if (cleanupInvalidation) { cleanupInvalidation(); cleanupInvalidation = null }
      let lastGen = useInvalidationStore.getState().generations.properties
      cleanupInvalidation = useInvalidationStore.subscribe((s) => {
        const g = s.generations.properties
        if (g === lastGen) return
        lastGen = g
        const cId = get().clinicId
        if (!cId) return
        void Promise.all([getLocalPropertyItems(cId), getLocalPropertyLocations(cId)])
          .then(([items, locations]) => set({ items, locations }))
          .catch(() => {})
      })
    } catch (err) {
      logger.warn('Property store init failed:', err)
      set({ isLoading: false })
    }
  },

  addItem: async (data) => {
    const user = useAuthStore.getState().user
    if (!user) return null

    const result = await createItem(data, user.id)
    if (result.success) {
      set({ items: [result.item, ...get().items] })
      return result.item
    }
    return null
  },

  editItem: async (id, updates, opts) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const result = await updateItem(id, updates, user.id, opts)
    if (result.success) {
      set({ items: get().items.map(i => i.id === id ? result.item : i) })
    }
  },

  applyImport: async (plan) => {
    const user = useAuthStore.getState().user
    const { clinicId, locations, items } = get()
    if (!user || !clinicId) return 0

    // Locations referenced by CREATE rows — auto-created by name (same as the single-item CSV
    // path). Created via the service directly so they don't each trigger their own set().
    const visibleLocs = locations.filter(l => l.name !== ROOT_LOCATION_NAME && !l.is_turn_in_zone)
    const locMap = new Map<string, string>()
    for (const l of visibleLocs) locMap.set(l.name.toLowerCase(), l.id)
    const neededNames = [...new Set(
      [...plan.creates, ...plan.updates].map(r => r.location.trim()).filter(n => n !== '' && !locMap.has(n.toLowerCase()))
    )]
    const newLocations: LocalPropertyLocation[] = []
    for (const name of neededNames) {
      const res = await createLocation(
        { clinic_id: clinicId, parent_id: null, name, photo_data: null, holder_user_id: null, created_by: '' },
        user.id,
      )
      if (res.success && res.location) {
        locMap.set(name.toLowerCase(), res.location.id)
        newLocations.push(res.location)
      }
    }

    // Existing LIN containers, then batch-create the ones the plan flagged as missing.
    const containerMap = new Map<string, string>()
    for (const it of items) {
      if (!it.deleted_at && !it.turned_in_at && isLinContainer(it) && it.lin) {
        containerMap.set(it.lin.trim().toLowerCase(), it.id)
      }
    }
    const containerRows = await createItemsBatch(
      plan.linContainers.map(lin => ({
        clinic_id: clinicId, name: lin, nomenclature: null, nsn: null, lin,
        condition_code: 'serviceable' as const, location_id: null, current_holder_id: null,
        parent_item_id: null, expiry_date: null, notes: null, is_serialized: false, serial_number: null,
        quantity: 0, location_tag_id: null, photo_url: null, visual_fingerprint: null, sub_cluster_id: null,
        quantity_authorized: null, item_type: 'DI' as const, unit_of_issue: null, pack_size: null,
      })),
      user.id,
    )
    plan.linContainers.forEach((lin, i) => {
      const c = containerRows[i]
      if (c) containerMap.set(lin.trim().toLowerCase(), c.id)
    })

    // New items — one coalesced batch, each parented under its LIN container.
    const createRows = await createItemsBatch(
      plan.creates.map(row => {
        const locationId = row.location.trim() ? (locMap.get(row.location.trim().toLowerCase()) ?? null) : null
        const parentId = row.lin.trim() ? (containerMap.get(row.lin.trim().toLowerCase()) ?? null) : null
        return {
          clinic_id: clinicId, name: row.name, nomenclature: row.nomenclature || null, nsn: row.nsn || null,
          lin: row.lin || null, condition_code: 'serviceable' as const, location_id: locationId,
          current_holder_id: null, parent_item_id: parentId, expiry_date: row.expiryDate?.trim() || null, notes: null,
          is_serialized: row.itemType === 'SI' || !!row.serialNumber.trim(),
          serial_number: row.serialNumber || null, quantity: row.quantity, location_tag_id: null,
          photo_url: null, visual_fingerprint: null, sub_cluster_id: null,
          quantity_authorized: row.quantityAuthorized, item_type: row.itemType ?? undefined,
          unit_of_issue: row.unitOfIssue, pack_size: row.packSize,
        }
      }),
      user.id,
    )

    // Merges + de-auths — each is a per-item vault update (retract-old + refan, order-sensitive),
    // so NOT coalesced; they still fold into the single state update below.
    const updatedById = new Map<string, LocalPropertyItem>()
    for (const m of plan.merges) {
      const res = await updateItem(m.itemId, {
        ...(m.qtyChanged ? { quantity: m.newQty } : {}),
        ...(m.authChanged ? { quantity_authorized: m.newAuth } : {}),
      }, user.id)
      if (res.success) updatedById.set(m.itemId, res.item)
    }
    for (const d of plan.deauthorizes) {
      const res = await updateItem(d.itemId, { quantity_authorized: null }, user.id)
      if (res.success) updatedById.set(d.itemId, res.item)
    }

    // Bulk-EDIT rows — id-keyed in-place updates. Resolve location/LIN, diff vs the live item,
    // update only the fields that ACTUALLY changed (unchanged items don't re-fan or emit a
    // spurious item.edited). A LIN change re-parents to that receipt's container (created on
    // demand); an unchanged LIN never touches parent_item_id (leaves decoupled stock as-is).
    const itemById = new Map(items.map(i => [i.id, i]))
    const onDemandContainers: LocalPropertyItem[] = []
    let updateCount = 0
    for (const u of plan.updates) {
      if (!u.itemId) continue
      const cur = itemById.get(u.itemId)
      if (!cur) continue
      const patch: Partial<PropertyItem> = {}

      if (cur.name !== u.name) patch.name = u.name
      if ((cur.nomenclature ?? null) !== (u.nomenclature || null)) patch.nomenclature = u.nomenclature || null
      if ((cur.nsn ?? null) !== (u.nsn || null)) patch.nsn = u.nsn || null

      // LIN re-link — ONLY when the code changed. Resolve or create the container, set lin +
      // parent_item_id together so they never desync.
      const curLin = cur.lin ?? null
      const newLin = u.lin.trim() || null
      if (curLin !== newLin) {
        patch.lin = newLin
        let parentId: string | null = null
        if (newLin) {
          parentId = containerMap.get(newLin.toLowerCase()) ?? null
          if (!parentId) {
            const [c] = await createItemsBatch([{
              clinic_id: clinicId, name: newLin, nomenclature: null, nsn: null, lin: newLin,
              condition_code: 'serviceable' as const, location_id: null, current_holder_id: null,
              parent_item_id: null, expiry_date: null, notes: null, is_serialized: false, serial_number: null,
              quantity: 0, location_tag_id: null, photo_url: null, visual_fingerprint: null, sub_cluster_id: null,
              quantity_authorized: null, item_type: 'DI' as const, unit_of_issue: null, pack_size: null,
            }], user.id)
            if (c) { parentId = c.id; containerMap.set(newLin.toLowerCase(), c.id); onDemandContainers.push(c) }
          }
        }
        patch.parent_item_id = parentId
      }

      const locId = u.location.trim() ? (locMap.get(u.location.trim().toLowerCase()) ?? null) : null
      if ((cur.location_id ?? null) !== locId) patch.location_id = locId

      const isSerial = u.itemType === 'SI' || !!u.serialNumber.trim()
      if (!!cur.is_serialized !== isSerial) patch.is_serialized = isSerial
      if ((cur.serial_number ?? null) !== (u.serialNumber || null)) patch.serial_number = u.serialNumber || null
      if (cur.quantity !== u.quantity) patch.quantity = u.quantity
      if ((cur.quantity_authorized ?? null) !== (u.quantityAuthorized ?? null)) patch.quantity_authorized = u.quantityAuthorized ?? null
      if ((cur.expiry_date ?? null) !== (u.expiryDate?.trim() || null)) patch.expiry_date = u.expiryDate?.trim() || null
      if (u.itemType && u.itemType !== cur.item_type) patch.item_type = u.itemType
      if ((cur.unit_of_issue ?? null) !== (u.unitOfIssue ?? null)) patch.unit_of_issue = u.unitOfIssue ?? null
      if ((cur.pack_size ?? null) !== (u.packSize ?? null)) patch.pack_size = u.packSize ?? null

      if (Object.keys(patch).length === 0) continue
      const res = await updateItem(u.itemId, patch, user.id)
      if (res.success) { updatedById.set(u.itemId, res.item); updateCount++ }
    }

    // ONE state update for the whole import — no per-item re-render storm.
    set(s => ({
      locations: newLocations.length ? [...s.locations, ...newLocations] : s.locations,
      items: [
        ...containerRows,
        ...onDemandContainers,
        ...createRows,
        ...s.items.map(i => updatedById.get(i.id) ?? i),
      ],
    }))

    return plan.linContainers.length + plan.creates.length + plan.merges.length + plan.deauthorizes.length + updateCount
  },

  recordPmcs: async (subjectType, subjectId, readings) => {
    const user = useAuthStore.getState().user
    const clinicId = get().clinicId
    if (!user || !clinicId) return false

    const result = await recordPmcsSvc(subjectType, subjectId, clinicId, user.id, readings)
    if (result.success) invalidate('properties')
    return result.success
  },

  editPmcsEntry: async (eventId, payload) => {
    const user = useAuthStore.getState().user
    if (!user) return false

    const result = await editPmcsEntrySvc(eventId, payload, user.id)
    if (result.success) invalidate('properties')
    return result.success
  },

  deletePmcsEntry: async (eventId) => {
    const user = useAuthStore.getState().user
    if (!user) return false

    const result = await deletePmcsEntrySvc(eventId, user.id)
    if (result.success) invalidate('properties')
    return result.success
  },

  openDispatch: async (subjectId, input) => {
    const user = useAuthStore.getState().user
    const clinicId = get().clinicId
    if (!user || !clinicId) return null

    const result = await openDispatchSvc(subjectId, clinicId, user.id, input)
    if (result.success) invalidate('properties')
    return result.success ? result.dispatchId : null
  },

  closeDispatch: async (subjectId, input) => {
    const user = useAuthStore.getState().user
    const clinicId = get().clinicId
    if (!user || !clinicId) return false

    const result = await closeDispatchSvc(subjectId, clinicId, user.id, input)
    if (result.success) invalidate('properties')
    return result.success
  },

  removeItem: async (id) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const children = await fetchSubItems(id)
    const childIds = new Set(children.map(c => c.id))

    const result = await deleteItem(id, user.id)
    if (result.success) {
      for (const child of children) {
        await deleteItem(child.id, user.id)
      }
      set({ items: get().items.filter(i => i.id !== id && !childIds.has(i.id)) })
    }
  },

  addLocation: async (data) => {
    const user = useAuthStore.getState().user
    if (!user) return { success: false }

    const result = await createLocation(data, user.id)
    if (result.success) {
      set({ locations: [...get().locations, result.location] })
      return { success: true, location: result.location }
    }
    return { success: false }
  },

  addLevel: async (parentId, name, ordinal) => {
    const user = useAuthStore.getState().user
    const { clinicId } = get()
    if (!user || !clinicId) return null

    const result = await createLevel(clinicId, user.id, parentId, name, ordinal)
    if (result.success) {
      set({ locations: [...get().locations, result.location], tagVersion: get().tagVersion + 1 })
      return result.location
    }
    return null
  },

  editLocation: async (id, updates) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const result = await updateLocation(id, updates, user.id)
    if (result.success) {
      set({
        locations: get().locations.map(l =>
          l.id === id ? { ...l, ...updates, updated_at: new Date().toISOString(), _sync_status: 'pending' as const } : l
        ),
      })

      if (updates.name) {
        await syncLocationNameToTags(id, updates.name)
        set((state) => ({ tagVersion: state.tagVersion + 1 }))
      }
    }
  },

  removeLocation: async (id) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const allLocs = get().locations

    // The default cluster zone (BAS) is a standing concept, not user-owned —
    // un-deletable by definition. Refuse the request outright (the explicit
    // target) and never let it ride along as a descendant of another delete.
    // This is the single chokepoint for every delete path (row menus + the
    // canvas editor's merge/delete), so the guard belongs here.
    // The turn-in staging zone is likewise a standing, auto-provisioned concept — never deletable.
    if (allLocs.find(l => l.id === id)?.is_default_zone || allLocs.find(l => l.id === id)?.is_turn_in_zone) return
    const defaultZoneIds = new Set(allLocs.filter(l => l.is_default_zone || l.is_turn_in_zone).map(l => l.id))

    const descendantIds = collectDescendants(id, allLocs)
    const allRemovedIds = new Set([id, ...descendantIds])

    for (const locId of allRemovedIds) {
      if (defaultZoneIds.has(locId)) continue
      await deleteLocation(locId, user.id)
    }

    // Zone shadows: a removed zone's hand-receipt COMPONENT shadow goes too (vehicle, case, bag —
    // any zone that is itself accountable property). Matched by represents_location_id, plus the
    // legacy isLinContainer-at-zone fallback for un-rescued pre-model header shadows. Detach +
    // de-authorize any children FIRST so removeItem doesn't cascade-delete BII — they survive as
    // loose stock (the location null-out below strands them from the removed zone).
    const shadows = get().items.filter(
      (i) =>
        (i.represents_location_id && allRemovedIds.has(i.represents_location_id)) ||
        (i.location_id && allRemovedIds.has(i.location_id) && isLinContainer(i)),
    )
    for (const shadow of shadows) {
      for (const comp of get().items.filter((i) => i.parent_item_id === shadow.id)) {
        await get().editItem(comp.id, { parent_item_id: null, quantity_authorized: null })
      }
      await get().removeItem(shadow.id)
    }

    const currentItems = get().items
    const updatedItems = currentItems.map(item => {
      if (item.location_id && allRemovedIds.has(item.location_id)) {
        return { ...item, location_id: null }
      }
      return item
    })

    set({
      locations: get().locations.filter(l => !allRemovedIds.has(l.id)),
      items: updatedItems,
      tagVersion: get().tagVersion + 1,
    })
  },

  refreshItems: async () => {
    const { clinicId } = get()
    if (!clinicId) return
    const items = await fetchClinicItems(clinicId)
    set({ items })
  },

  refreshLocations: async () => {
    const { clinicId } = get()
    if (!clinicId) return
    const locations = await fetchClinicLocations(clinicId)
    set({ locations })
  },

  enrollFingerprint: async (itemId, fingerprint) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const result = await updateFingerprint(itemId, fingerprint, user.id)
    if (result.success) {
      set({ items: get().items.map(i => i.id === itemId ? result.item : i) })
    }
  },

  expendItem: async (itemId, quantityDelta) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const { clinicId, items } = get()
    if (!clinicId) return

    const item = items.find(i => i.id === itemId)
    if (!item) return

    // Never hard-delete on expend: clamp to 0 so the record survives as a
    // reorder signal (qty 0 = depleted, needs restock) vs. re-inputting from scratch.
    const newQty = Math.max(0, item.quantity - quantityDelta)
    // recordExpendedEntry logs item.expended — skip the redundant item.edited.
    await get().editItem(itemId, { quantity: newQty }, { skipAudit: true })

    await recordExpendedEntry(itemId, quantityDelta, clinicId, user.id)
    // Refresh subscribers (the item timeline watches the 'properties' generation
    // so the "Expended ×N" event shows immediately).
    invalidate('properties')
  },

  signOut: async (params) => {
    const user = useAuthStore.getState().user
    const { clinicId } = get()
    if (!user || !clinicId) return null

    const result = await signOutItems(
      { ...params, clinicId, fromHolderId: user.id },
      user.id,
    )
    if (!result.success) return null

    invalidate('properties')
    await get().refreshItems()
    return result.handReceiptId
  },

  signIn: async (handReceiptId, fromHolderId, itemIds, toLocationId) => {
    const user = useAuthStore.getState().user
    const { clinicId } = get()
    if (!user || !clinicId) return false

    const result = await signInReceipt(handReceiptId, clinicId, fromHolderId, itemIds, user.id, toLocationId)
    if (!result.success) return false

    invalidate('properties')
    await get().refreshItems()
    return true
  },

  fetchLedger: async () => {
    const { clinicId } = get()
    if (!clinicId) return []
    return fetchClinicLedger(clinicId)
  },

  stageTurnIn: async (itemIds, notes) => {
    const user = useAuthStore.getState().user
    const { clinicId } = get()
    if (!user || !clinicId) return null

    const result = await stageTurnInSvc({ itemIds, clinicId, fromHolderId: user.id, notes: notes ?? null }, user.id)
    if (!result.success) return null

    invalidate('properties')
    await get().refreshItems()
    get().bumpTagVersion() // the staging-zone tile may have just appeared on the map
    return result.turnInDocId
  },

  verifyTurnIn: async (turnInDocId, itemIds) => {
    const user = useAuthStore.getState().user
    const { clinicId } = get()
    if (!user || !clinicId) return false

    const result = await verifyTurnInSvc(turnInDocId, clinicId, user.id, itemIds)
    if (!result.success) return false

    invalidate('properties')
    await get().refreshItems()
    get().bumpTagVersion() // the staging zone may have emptied → tile dropped
    return true
  },

  unstageTurnInItem: async (turnInDocId, itemId) => {
    const user = useAuthStore.getState().user
    const { clinicId } = get()
    if (!user || !clinicId) return false

    const result = await unstageTurnInItemSvc(turnInDocId, itemId, clinicId, user.id)
    if (!result.success) return false

    invalidate('properties')
    await get().refreshItems()
    get().bumpTagVersion() // the staging zone may have emptied → tile dropped
    return true
  },

  deleteTurnInDoc: async (turnInDocId) => {
    const user = useAuthStore.getState().user
    const { clinicId } = get()
    if (!user || !clinicId) return false

    const result = await deleteTurnInDocSvc(turnInDocId, clinicId, user.id)
    if (!result.success) return false

    invalidate('properties') // drops the doc from the Turn-In history fold; items untouched
    return true
  },

  splitItem: async (itemId, qty, targetLocationId) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const { items } = get()
    const source = items.find(i => i.id === itemId)
    if (!source || source.is_serialized) return

    const clampedQty = Math.max(1, Math.min(qty, source.quantity))
    const isFull = clampedQty >= source.quantity

    // Check if target already has a matching non-serialized item (same name + nsn)
    const match = items.find(i =>
      i.id !== itemId &&
      !i.is_serialized &&
      i.location_id === targetLocationId &&
      i.name.toLowerCase() === source.name.toLowerCase() &&
      (source.nsn ? i.nsn === source.nsn : !i.nsn)
    )

    // WHOLE quantity to an empty target = a MOVE, not a split — the same stack
    // relocates (reversible item.moved), no new row and no orphan delete.
    if (isFull && !match) {
      await get().editItem(itemId, { location_id: targetLocationId })
      return
    }

    // WHOLE quantity onto an identical stack = a MERGE (terminal): the source
    // ceases and the target becomes the tracked entity. Not undoable.
    if (isFull && match) {
      await get().editItem(match.id, { quantity: match.quantity + source.quantity }, { skipAudit: true })
      await recordItemMerge(match.id, source.name, source.quantity, source.clinic_id, user.id)
      await get().removeItem(itemId)
      invalidate('properties')
      return
    }

    // PARTIAL = a real split (a branch). The moved portion lands in the matching
    // stack if one exists, else a fresh row; the source keeps the remainder. The
    // split is recorded on the source so it is visible AND reversible (undo
    // merges the portion back).
    let destId: string
    if (match) {
      await get().editItem(match.id, { quantity: match.quantity + clampedQty }, { skipAudit: true })
      destId = match.id
    } else {
      const created = await get().addItem({
        clinic_id: source.clinic_id,
        name: source.name,
        nomenclature: source.nomenclature,
        nsn: source.nsn,
        lin: source.lin,
        serial_number: null,
        quantity: clampedQty,
        is_serialized: false,
        condition_code: source.condition_code,
        parent_item_id: source.parent_item_id,
        location_id: targetLocationId,
        current_holder_id: source.current_holder_id,
        location_tag_id: null,
        photo_url: source.photo_url,
        visual_fingerprint: null,
        expiry_date: source.expiry_date,
        notes: source.notes,
        item_type: source.item_type, // split-off stock keeps the source's class + issue unit
        unit_of_issue: source.unit_of_issue,
        pack_size: source.pack_size,
      })
      if (!created) return
      destId = created.id
    }
    await get().editItem(itemId, { quantity: source.quantity - clampedQty }, { skipAudit: true })
    await recordItemSplit(itemId, destId, clampedQty, source.clinic_id, user.id)
    invalidate('properties')
  },

  mergeItems: async (sourceId, targetId) => {
    const user = useAuthStore.getState().user
    if (!user) return
    const { items } = get()
    const source = items.find(i => i.id === sourceId)
    const target = items.find(i => i.id === targetId)
    if (!source || !target || source.is_serialized || target.is_serialized) return

    // TERMINAL merge: target absorbs the source's quantity and is the tracked
    // entity; the source row is deleted and its history ceases. The item.merged
    // event on the target records the absorption ("Absorbed ×N from X").
    await get().editItem(targetId, { quantity: target.quantity + source.quantity }, { skipAudit: true })
    await recordItemMerge(targetId, source.name, source.quantity, target.clinic_id, user.id)
    await get().removeItem(sourceId)
    invalidate('properties')
  },

  undoLastEvent: async (itemId, head) => {
    const user = useAuthStore.getState().user
    if (!user) return
    const p = head.payload ?? {}

    switch (head.eventType) {
      case 'item.moved':
        // Reverse a relocation: put it back where it was.
        await get().editItem(itemId, { location_id: (p.from_location_id as string | null) ?? null })
        break
      case 'item.assigned':
        // Reverse a holder reassignment (NOT a custody sign-out — that has its
        // own sign-in flow).
        await get().editItem(itemId, { current_holder_id: (p.from_holder_id as string | null) ?? null })
        break
      case 'item.edited': {
        // Restore each changed field to its `from` value. Legacy rows lack the
        // before/after map → not undoable.
        const changes = p.changes as Record<string, { from: unknown }> | undefined
        if (!changes) return
        const updates: Record<string, unknown> = {}
        for (const [field, v] of Object.entries(changes)) updates[field] = v.from
        await get().editItem(itemId, updates as Partial<PropertyItem>)
        break
      }
      case 'item.split': {
        // Merge the branched portion back into the source. If the destination is
        // left empty it is removed.
        const destId = p.to_item_id as string | undefined
        const qty = typeof p.quantity === 'number' ? p.quantity : 0
        if (!destId || qty <= 0) return
        const { items } = get()
        const source = items.find(i => i.id === itemId)
        const dest = items.find(i => i.id === destId)
        if (!source) return
        await get().editItem(itemId, { quantity: source.quantity + qty }, { skipAudit: true })
        if (dest) {
          if (dest.quantity - qty <= 0) await get().removeItem(destId)
          else await get().editItem(destId, { quantity: dest.quantity - qty }, { skipAudit: true })
        }
        // Record the pull-back as a (terminal) merge on the source so the head is
        // no longer the now-reversed split — otherwise a second Undo would re-add
        // the quantity. Terminal heads are not undoable.
        await recordItemMerge(itemId, dest?.name ?? source.name, qty, source.clinic_id, user.id)
        break
      }
      default:
        // Terminal (merge/turn-in/delete), custody, expend, created, faults/PMCS
        // are not undoable here — the affordance is hidden for those heads.
        return
    }
    invalidate('properties')
  },
}))
