import { useEffect } from 'react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useClinicConfig } from './useClinicConfig'

/**
 * Syncs the current clinic's per-category calendar color defaults
 * (clinics.calendar_category_colors jsonb: category → swatch id) into
 * useCalendarStore.clinicCategoryColors. Reads through the consolidated
 * useClinicConfig fetch, so it shares one GET /clinics with the other
 * clinic-config hooks; re-runs on `clinics` invalidation.
 *
 * Mount ONCE per calendar surface (CalendarPanel, MissionBoardPanel). This is
 * the SHARED layer; leaf components read it through useCategoryColors via a
 * cheap selector rather than each firing its own fetch. Personal overrides live
 * in useCalendarStore.categoryColors and win at resolve time.
 */
export function useClinicCategoryColorsSync(targetClinicId?: string | null): void {
  const categoryColors = useClinicConfig(targetClinicId).categoryColors
  const setClinicCategoryColors = useCalendarStore(s => s.setClinicCategoryColors)

  useEffect(() => {
    setClinicCategoryColors(categoryColors)
  }, [categoryColors, setClinicCategoryColors])
}
