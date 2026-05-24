import { create } from 'zustand'
import { useEffect } from 'react'
import { getOverlays } from '../lib/mapOverlayService'
import { useInvalidation } from './useInvalidationStore'
import type { LocalMapOverlay } from '../Types/MapOverlayTypes'

interface MapOverlaysCacheState {
  overlays: LocalMapOverlay[]
  clinicId: string | null
  setOverlays: (overlays: LocalMapOverlay[], clinicId: string | null) => void
  clear: () => void
}

export const useMapOverlaysStore = create<MapOverlaysCacheState>((set) => ({
  overlays: [],
  clinicId: null,
  setOverlays: (overlays, clinicId) => set({ overlays, clinicId }),
  clear: () => set({ overlays: [], clinicId: null }),
}))

export function useMapOverlaysCache(clinicId: string | null): void {
  const gen = useInvalidation('mapOverlays')
  useEffect(() => {
    let cancelled = false
    if (!clinicId) {
      useMapOverlaysStore.getState().clear()
      return
    }
    void (async () => {
      const res = await getOverlays(clinicId)
      if (cancelled) return
      if (res.ok) useMapOverlaysStore.getState().setOverlays(res.data, clinicId)
    })()
    return () => { cancelled = true }
  }, [clinicId, gen])
}
