import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BearingReference } from '../lib/declination'

export type CoordDisplay = 'latlng' | 'mgrs' | 'utm'

interface MapPrefsState {
  bearingReference: BearingReference
  coordDisplay: CoordDisplay
  /** Active tile source ID — keys into mapTileService TILE_SOURCES. */
  basemapId: string
  setBearingReference: (ref: BearingReference) => void
  setCoordDisplay: (mode: CoordDisplay) => void
  setBasemapId: (id: string) => void
}

export const useMapPrefsStore = create<MapPrefsState>()(
  persist(
    (set) => ({
      bearingReference: 'true',
      coordDisplay: 'mgrs',
      basemapId: 'osm',
      setBearingReference: (bearingReference) => set({ bearingReference }),
      setCoordDisplay: (coordDisplay) => set({ coordDisplay }),
      setBasemapId: (basemapId) => set({ basemapId }),
    }),
    { name: 'map-prefs' },
  ),
)
