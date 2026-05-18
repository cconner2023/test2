import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BearingReference } from '../lib/declination'

export type CoordDisplay = 'latlng' | 'mgrs' | 'utm'
export type LabelMode = 'always' | 'selected'

interface MapPrefsState {
  bearingReference: BearingReference
  coordDisplay: CoordDisplay
  /** Active tile source ID — keys into mapTileService TILE_SOURCES. */
  basemapId: string
  /** When 'always', feature labels render permanently on the map.
   *  When 'selected' (default), labels appear only on the selected feature. */
  labelMode: LabelMode
  setBearingReference: (ref: BearingReference) => void
  setCoordDisplay: (mode: CoordDisplay) => void
  setBasemapId: (id: string) => void
  setLabelMode: (mode: LabelMode) => void
}

export const useMapPrefsStore = create<MapPrefsState>()(
  persist(
    (set) => ({
      bearingReference: 'true',
      coordDisplay: 'mgrs',
      basemapId: 'osm',
      labelMode: 'selected',
      setBearingReference: (bearingReference) => set({ bearingReference }),
      setCoordDisplay: (coordDisplay) => set({ coordDisplay }),
      setBasemapId: (basemapId) => set({ basemapId }),
      setLabelMode: (labelMode) => set({ labelMode }),
    }),
    { name: 'map-prefs' },
  ),
)
