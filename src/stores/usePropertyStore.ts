import { create } from 'zustand'
import type { LocalPropertyItem } from '../Types/PropertyTypes'

interface PropertyState {
  // Item selection (view navigation is managed by parent Settings panel)
  selectedItem: LocalPropertyItem | null
  editingItem: LocalPropertyItem | null
  selectItem: (item: LocalPropertyItem | null) => void
  setEditingItem: (item: LocalPropertyItem | null) => void

  // Zone selection (which zone is selected/highlighted on the single root canvas)
  selectedZoneId: string | null
  selectZone: (zoneId: string | null) => void

  // Canvas navigation stack — path from root, e.g. ['zoneA', 'zoneA1']
  canvasStack: string[]
  navigateInto: (zoneId: string) => void
  navigateBack: () => void
  navigateToPath: (path: string[]) => void

  // Root location id (invisible canvas host for top-level zones)
  rootLocationId: string | null
  setRootLocationId: (id: string | null) => void

  // Default location for new items (set when adding from a location view)
  defaultLocationId: string | null
  setDefaultLocationId: (id: string | null) => void

  // Tag version — bumped after zone creation to trigger refetch
  tagVersion: number
  bumpTagVersion: () => void

  // Canvas transition state (prevents double-tap during animation)
  transitionState: 'idle' | 'zooming-in' | 'zooming-out'
  setTransitionState: (state: 'idle' | 'zooming-in' | 'zooming-out') => void

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

  // Canvas navigation stack
  canvasStack: [],
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

  // Root location
  rootLocationId: null,
  setRootLocationId: (id) => set({ rootLocationId: id }),

  // Default location
  defaultLocationId: null,
  setDefaultLocationId: (id) => set({ defaultLocationId: id }),

  // Tag version
  tagVersion: 0,
  bumpTagVersion: () => set((state) => ({ tagVersion: state.tagVersion + 1 })),

  // Canvas transition state
  transitionState: 'idle',
  setTransitionState: (state) => set({ transitionState: state }),

  // Filters
  holderFilter: null,
  setHolderFilter: (holderId) => set({ holderFilter: holderId }),
}))
