import { create } from 'zustand'
import type { PropertyItem } from '../Types/PropertyTypes'

interface PropertyState {
  // Item selection (view navigation is managed by parent Settings panel)
  selectedItem: PropertyItem | null
  editingItem: PropertyItem | null
  selectItem: (item: PropertyItem | null) => void
  setEditingItem: (item: PropertyItem | null) => void

  // Zone selection (which zone is selected/highlighted on the single root canvas)
  selectedZoneId: string | null
  selectZone: (zoneId: string | null) => void

  // Root location id (invisible canvas host for top-level zones)
  rootLocationId: string | null
  setRootLocationId: (id: string | null) => void

  // Default location for new items (set when adding from a location view)
  defaultLocationId: string | null
  setDefaultLocationId: (id: string | null) => void

  // Filters
  holderFilter: string | null
  setHolderFilter: (holderId: string | null) => void
}

export const usePropertyStore = create<PropertyState>((set) => ({
  // Item selection
  selectedItem: null,
  editingItem: null,
  selectItem: (item) => set({ selectedItem: item }),
  setEditingItem: (item) => set({ editingItem: item }),

  // Zone selection
  selectedZoneId: null,
  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),

  // Root location
  rootLocationId: null,
  setRootLocationId: (id) => set({ rootLocationId: id }),

  // Default location
  defaultLocationId: null,
  setDefaultLocationId: (id) => set({ defaultLocationId: id }),

  // Filters
  holderFilter: null,
  setHolderFilter: (holderId) => set({ holderFilter: holderId }),
}))
