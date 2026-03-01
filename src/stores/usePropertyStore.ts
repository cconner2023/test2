import { create } from 'zustand'
import type { PropertyItem, PropertyLocation } from '../Types/PropertyTypes'

export type PropertyView =
  | 'list'
  | 'item-detail'
  | 'item-form'
  | 'transfer'
  | 'location-map'
  | 'discrepancies'
  | 'search'

interface PropertyState {
  // Navigation
  view: PropertyView
  setView: (view: PropertyView) => void

  // Item selection
  selectedItem: PropertyItem | null
  editingItem: PropertyItem | null
  selectItem: (item: PropertyItem | null) => void
  openAddForm: () => void
  openEditForm: (item: PropertyItem) => void
  closeForm: () => void

  // Transfer
  isTransferOpen: boolean
  openTransfer: () => void
  closeTransfer: () => void

  // Location breadcrumb stack
  locationPath: PropertyLocation[]
  selectedLocation: PropertyLocation | null
  pushLocation: (location: PropertyLocation) => void
  popLocation: () => void
  resetLocationPath: () => void

  // Filters
  searchQuery: string
  holderFilter: string | null
  setSearchQuery: (query: string) => void
  setHolderFilter: (holderId: string | null) => void
}

export const usePropertyStore = create<PropertyState>((set) => ({
  // Navigation
  view: 'list',
  setView: (view) => set({ view }),

  // Item selection
  selectedItem: null,
  editingItem: null,
  selectItem: (item) => set({ selectedItem: item, view: item ? 'item-detail' : 'list' }),
  openAddForm: () => set({ editingItem: null, view: 'item-form' }),
  openEditForm: (item) => set({ editingItem: item, view: 'item-form' }),
  closeForm: () => set({ editingItem: null, view: 'list' }),

  // Transfer
  isTransferOpen: false,
  openTransfer: () => set({ isTransferOpen: true, view: 'transfer' }),
  closeTransfer: () => set({ isTransferOpen: false, view: 'item-detail' }),

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
  searchQuery: '',
  holderFilter: null,
  setSearchQuery: (query) => set({ searchQuery: query }),
  setHolderFilter: (holderId) => set({ holderFilter: holderId }),
}))
