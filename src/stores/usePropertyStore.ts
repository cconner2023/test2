import { create } from 'zustand'
import type {
  LocalPropertyItem,
  LocalPropertyLocation,
  HolderInfo,
  PropertyItem,
  PropertyLocation,
  VisualFingerprint,
} from '../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../Types/PropertyTypes'
import { useAuthStore } from './useAuthStore'
import { supabase } from '../lib/supabase'
import {
  fetchClinicItems,
  createItem,
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
  reconcileLocationsFromTags,
  updateFingerprint,
  recordExpendedEntry,
  raiseFault as raiseFaultSvc,
  correctFault as correctFaultSvc,
  recordPmcs as recordPmcsSvc,
  editPmcsEntry as editPmcsEntrySvc,
  deletePmcsEntry as deletePmcsEntrySvc,
  openDispatch as openDispatchSvc,
  closeDispatch as closeDispatchSvc,
  signOutItems,
  signInReceipt,
  fetchClinicLedger,
} from '../lib/propertyService'
import type { CustodyLedgerEntry } from '../Types/PropertyTypes'
import type { PmcsReadings, DispatchOpenInput, DispatchCloseInput } from '../lib/propertyService'
import { setupConnectivityListeners, healStuckPendingRecords } from '../lib/syncService'
import { getLocalPropertyItems, getLocalPropertyLocations } from '../lib/offlineDb'
import { invalidate, useInvalidationStore } from './useInvalidationStore'
import { createLogger } from '../Utilities/Logger'

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
  addItem: (data: Omit<PropertyItem, 'id' | 'created_at' | 'updated_at' | 'signed_out_external' | 'owner_user_id'>) => Promise<LocalPropertyItem | null>
  editItem: (id: string, updates: Partial<PropertyItem>, opts?: { skipAudit?: boolean }) => Promise<void>
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
  signOut: (params: { itemIds: string[]; quantities?: Record<string, number>; toHolderId: string | null; externalName: string | null; notes: string | null }) => Promise<string | null>
  /** Sign a hand receipt back in — clears each item's custodian. */
  signIn: (handReceiptId: string, fromHolderId: string | null, itemIds: string[]) => Promise<boolean>
  /** Clinic-wide custody ledger (newest first) for the accountability surface. */
  fetchLedger: () => Promise<CustodyLedgerEntry[]>
  splitItem: (itemId: string, qty: number, targetLocationId: string | null) => Promise<void>
  mergeItems: (sourceId: string, targetId: string) => Promise<void>
  /** Raise a maintenance fault on a property subject (item or vehicle/location);
   *  resolves to the fault id (the fault.opened event id) or null. Faults live in
   *  audit_log, not subject state. */
  raiseFault: (subjectType: 'item' | 'location', subjectId: string, description: string) => Promise<string | null>
  /** Mark a raised fault corrected (faultId = the fault.opened event id). */
  correctFault: (subjectType: 'item' | 'location', subjectId: string, faultId: string, note?: string) => Promise<boolean>
  /** Record a PMCS check. `readings` carries the vehicle intake (mileage, fuel
   *  level); omit for a non-vehicle clean-check paper-trail entry. */
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('id', user.id)
        .maybeSingle()

      const clinicId = profile?.clinic_id
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

  raiseFault: async (subjectType, subjectId, description) => {
    const user = useAuthStore.getState().user
    const clinicId = get().clinicId
    if (!user || !clinicId) return null

    const result = await raiseFaultSvc(subjectType, subjectId, clinicId, description, user.id)
    if (result.success) invalidate('properties')
    return result.success ? result.faultId : null
  },

  correctFault: async (subjectType, subjectId, faultId, note) => {
    const user = useAuthStore.getState().user
    const clinicId = get().clinicId
    if (!user || !clinicId) return false

    const result = await correctFaultSvc(subjectType, subjectId, clinicId, faultId, user.id, note)
    if (result.success) invalidate('properties')
    return result.success
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
    if (allLocs.find(l => l.id === id)?.is_default_zone) return
    const defaultZoneIds = new Set(allLocs.filter(l => l.is_default_zone).map(l => l.id))

    const descendantIds = collectDescendants(id, allLocs)
    const allRemovedIds = new Set([id, ...descendantIds])

    for (const locId of allRemovedIds) {
      if (defaultZoneIds.has(locId)) continue
      await deleteLocation(locId, user.id)
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

  signIn: async (handReceiptId, fromHolderId, itemIds) => {
    const user = useAuthStore.getState().user
    const { clinicId } = get()
    if (!user || !clinicId) return false

    const result = await signInReceipt(handReceiptId, clinicId, fromHolderId, itemIds, user.id)
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

  splitItem: async (itemId, qty, targetLocationId) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const { items } = get()
    const source = items.find(i => i.id === itemId)
    if (!source || source.is_serialized) return

    const clampedQty = Math.max(1, Math.min(qty, source.quantity))

    // Check if target already has a matching non-serialized item (same name + nsn)
    const match = items.find(i =>
      i.id !== itemId &&
      !i.is_serialized &&
      i.location_id === targetLocationId &&
      i.name.toLowerCase() === source.name.toLowerCase() &&
      (source.nsn ? i.nsn === source.nsn : !i.nsn)
    )

    if (match) {
      await get().editItem(match.id, { quantity: match.quantity + clampedQty }, { skipAudit: true })
    } else {
      await get().addItem({
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
      })
    }

    if (clampedQty >= source.quantity) {
      await get().removeItem(itemId)
    } else {
      await get().editItem(itemId, { quantity: source.quantity - clampedQty }, { skipAudit: true })
    }
  },

  mergeItems: async (sourceId, targetId) => {
    const { items } = get()
    const source = items.find(i => i.id === sourceId)
    const target = items.find(i => i.id === targetId)
    if (!source || !target || source.is_serialized || target.is_serialized) return

    await get().editItem(targetId, { quantity: target.quantity + source.quantity }, { skipAudit: true })
    await get().removeItem(sourceId)
  },
}))
