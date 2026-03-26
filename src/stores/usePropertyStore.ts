import { create } from 'zustand'
import type {
  LocalPropertyItem,
  LocalPropertyLocation,
  HolderInfo,
  PropertyItem,
  PropertyLocation,
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
  updateLocation,
  deleteLocation,
  fetchSubItems,
  syncLocationNameToTags,
  ensureRootLocation,
} from '../lib/propertyService'
import { setupConnectivityListeners, healStuckPendingRecords } from '../lib/syncService'
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

  selectedItem: LocalPropertyItem | null
  editingItem: LocalPropertyItem | null
  selectedZoneId: string | null
  canvasStack: string[]
  rootLocationId: string | null
  defaultLocationId: string | null
  tagVersion: number
  transitionState: 'idle' | 'zooming-in' | 'zooming-out'
  holderFilter: string | null

  visibleLocations: () => LocalPropertyLocation[]

  selectItem: (item: LocalPropertyItem | null) => void
  setEditingItem: (item: LocalPropertyItem | null) => void
  selectZone: (zoneId: string | null) => void
  navigateInto: (zoneId: string) => void
  navigateBack: () => void
  navigateToPath: (path: string[]) => void
  setRootLocationId: (id: string | null) => void
  setDefaultLocationId: (id: string | null) => void
  bumpTagVersion: () => void
  setTransitionState: (state: 'idle' | 'zooming-in' | 'zooming-out') => void
  setHolderFilter: (holderId: string | null) => void

  init: () => Promise<void>
  addItem: (data: Omit<PropertyItem, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  editItem: (id: string, updates: Partial<PropertyItem>) => Promise<void>
  removeItem: (id: string) => Promise<void>
  addLocation: (data: Omit<PropertyLocation, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  editLocation: (id: string, updates: Partial<PropertyLocation>) => Promise<void>
  removeLocation: (id: string) => Promise<void>
  refreshItems: () => Promise<void>
  refreshLocations: () => Promise<void>
}

let cleanupListeners: (() => void) | null = null

export const usePropertyStore = create<PropertyState>((set, get) => ({
  items: [],
  locations: [],
  holders: new Map(),
  clinicMembers: [],
  isLoading: false,
  isSyncing: false,
  clinicId: null,

  selectedItem: null,
  editingItem: null,
  selectedZoneId: null,
  canvasStack: [],
  rootLocationId: null,
  defaultLocationId: null,
  tagVersion: 0,
  transitionState: 'idle',
  holderFilter: null,

  visibleLocations: () => get().locations.filter(l => l.name !== ROOT_LOCATION_NAME),

  selectItem: (item) => set({ selectedItem: item }),
  setEditingItem: (item) => set({ editingItem: item }),
  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),

  navigateInto: (zoneId) => set((state) => ({
    canvasStack: [...state.canvasStack, zoneId],
    selectedZoneId: zoneId,
  })),
  navigateBack: () => set((state) => {
    const next = state.canvasStack.slice(0, -1)
    return { canvasStack: next, selectedZoneId: next[next.length - 1] ?? null }
  }),
  navigateToPath: (path) => set({
    canvasStack: path,
    selectedZoneId: path[path.length - 1] ?? null,
  }),

  setRootLocationId: (id) => set({ rootLocationId: id }),
  setDefaultLocationId: (id) => set({ defaultLocationId: id }),
  bumpTagVersion: () => set((state) => ({ tagVersion: state.tagVersion + 1 })),
  setTransitionState: (state) => set({ transitionState: state }),
  setHolderFilter: (holderId) => set({ holderFilter: holderId }),

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

      set({ clinicId })

      healStuckPendingRecords(user.id)

      const [items, locations, holdersResult] = await Promise.all([
        fetchClinicItems(clinicId),
        fetchClinicLocations(clinicId),
        supabase
          .from('profiles')
          .select('id, rank, first_name, last_name')
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
          }
          holderMap.set(p.id, info)
          memberList.push(info)
        }
      }

      const rootLoc = await ensureRootLocation(clinicId, user.id)

      set({
        items,
        locations,
        holders: holderMap,
        clinicMembers: memberList,
        rootLocationId: rootLoc.id,
        isLoading: false,
      })

      if (cleanupListeners) {
        cleanupListeners()
        cleanupListeners = null
      }

      cleanupListeners = setupConnectivityListeners(user.id, {
        clinicId,
        onSyncStart: () => set({ isSyncing: true }),
        onSyncComplete: () => set({ isSyncing: false }),
        onPropertyReconcileComplete: (reconciledItems) => set({ items: reconciledItems }),
        getLocations: () => get().locations,
        onTagsReconcileComplete: () => set((state) => ({ tagVersion: state.tagVersion + 1 })),
      })
    } catch (err) {
      logger.warn('Property store init failed:', err)
      set({ isLoading: false })
    }
  },

  addItem: async (data) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const result = await createItem(data, user.id)
    if (result.success) {
      set({ items: [result.item, ...get().items] })
    }
  },

  editItem: async (id, updates) => {
    const user = useAuthStore.getState().user
    if (!user) return

    const result = await updateItem(id, updates, user.id)
    if (result.success) {
      set({ items: get().items.map(i => i.id === id ? result.item : i) })
    }
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
    if (!user) return

    const result = await createLocation(data, user.id)
    if (result.success) {
      set({ locations: [...get().locations, result.location] })
    }
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
    const descendantIds = collectDescendants(id, allLocs)
    const allRemovedIds = new Set([id, ...descendantIds])

    for (const locId of allRemovedIds) {
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
}))
