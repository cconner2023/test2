import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RecentSearchEntry {
  query: string
  label: string
  lat: number
  lng: number
  ts: number
}

interface MapSearchState {
  recentSearches: RecentSearchEntry[]
  pushRecent: (entry: Omit<RecentSearchEntry, 'ts'>) => void
  clearRecents: () => void
}

const MAX_RECENTS = 10

export const useMapSearchStore = create<MapSearchState>()(
  persist(
    (set) => ({
      recentSearches: [],
      pushRecent: (entry) => set((s) => {
        const next: RecentSearchEntry = { ...entry, ts: Date.now() }
        const deduped = s.recentSearches.filter(
          (r) => r.label.toLowerCase() !== entry.label.toLowerCase(),
        )
        return { recentSearches: [next, ...deduped].slice(0, MAX_RECENTS) }
      }),
      clearRecents: () => set({ recentSearches: [] }),
    }),
    { name: 'map-search' },
  ),
)
