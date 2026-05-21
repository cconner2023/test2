import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RecentSearchEntry {
  query: string
  label: string
  lat: number
  lng: number
  ts: number
}

export type SavedPlaceSlot = 'home' | 'work' | 'more'

export interface SavedPlace {
  lat: number
  lng: number
  label: string
}

interface MapSearchState {
  recentSearches: RecentSearchEntry[]
  savedPlaces: Record<SavedPlaceSlot, SavedPlace | null>
  pushRecent: (entry: Omit<RecentSearchEntry, 'ts'>) => void
  clearRecents: () => void
  setSavedPlace: (slot: SavedPlaceSlot, place: SavedPlace | null) => void
}

const MAX_RECENTS = 10

export const useMapSearchStore = create<MapSearchState>()(
  persist(
    (set) => ({
      recentSearches: [],
      savedPlaces: { home: null, work: null, more: null },
      pushRecent: (entry) => set((s) => {
        const next: RecentSearchEntry = { ...entry, ts: Date.now() }
        const deduped = s.recentSearches.filter(
          (r) => r.label.toLowerCase() !== entry.label.toLowerCase(),
        )
        return { recentSearches: [next, ...deduped].slice(0, MAX_RECENTS) }
      }),
      clearRecents: () => set({ recentSearches: [] }),
      setSavedPlace: (slot, place) => set((s) => ({
        savedPlaces: { ...s.savedPlaces, [slot]: place },
      })),
    }),
    { name: 'map-search' },
  ),
)
