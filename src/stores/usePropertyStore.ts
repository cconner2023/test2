import { create } from 'zustand'
import type { PropertyItem, PropertyLocation } from '../Types/PropertyTypes'

interface PropertyState {
  // Item selection (view navigation is managed by parent Settings panel)
  selectedItem: PropertyItem | null
  editingItem: PropertyItem | null
  selectItem: (item: PropertyItem | null) => void
  setEditingItem: (item: PropertyItem | null) => void

  // Location breadcrumb stack
  locationPath: PropertyLocation[]
  selectedLocation: PropertyLocation | null
  pushLocation: (location: PropertyLocation) => void
  popLocation: () => void
  resetLocationPath: () => void

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

  // Location breadcrumb
  locationPath: [],
  selectedLocation: null,
  pushLocation: (location) =>
    set((state) => ({
      locationPath: [...state.locationPath, location],
      selectedLocation: location,
    })),
  popLocation: () =>
    set((state) => {
      const newPath = state.locationPath.slice(0, -1)
      return {
        locationPath: newPath,
        selectedLocation: newPath[newPath.length - 1] ?? null,
      }
    }),
  resetLocationPath: () => set({ locationPath: [], selectedLocation: null }),

  // Filters
  holderFilter: null,
  setHolderFilter: (holderId) => set({ holderFilter: holderId }),
}))
