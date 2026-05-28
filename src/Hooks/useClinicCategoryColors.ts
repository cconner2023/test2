import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { CategoryColorMap } from '../Types/CalendarTypes'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useAuth } from './useAuth'

/**
 * Syncs the current clinic's per-category calendar color defaults
 * (clinics.calendar_category_colors jsonb: category → swatch id) into
 * useCalendarStore.clinicCategoryColors. Re-runs on `clinics` invalidation.
 *
 * Mount ONCE per calendar surface (CalendarPanel, MissionBoardPanel). This is
 * the SHARED layer; leaf components read it through useCategoryColors via a
 * cheap selector rather than each firing its own fetch. Personal overrides live
 * in useCalendarStore.categoryColors and win at resolve time.
 */
export function useClinicCategoryColorsSync(targetClinicId?: string | null): void {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const clinicsGen = useInvalidation('clinics')
  const setClinicCategoryColors = useCalendarStore(s => s.setClinicCategoryColors)

  useEffect(() => {
    if (!clinicId) {
      setClinicCategoryColors({})
      return
    }
    let cancelled = false
    supabase
      .from('clinics')
      .select('calendar_category_colors')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setClinicCategoryColors(((data?.calendar_category_colors as CategoryColorMap) ?? {}))
      })
    return () => { cancelled = true }
  }, [clinicId, clinicsGen, setClinicCategoryColors])
}
