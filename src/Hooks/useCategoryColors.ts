import { useCallback, useMemo } from 'react'
import {
  CATEGORY_SWATCHES,
  DEFAULT_SWATCH,
  type CategoryColorMap,
  type CategorySwatch,
  type CategorySwatchId,
  type EventCategory,
} from '../Types/CalendarTypes'
import { useCalendarStore } from '../stores/useCalendarStore'
import { invalidate } from '../stores/useInvalidationStore'
import { updateSupervisorClinicCalendarColors } from '../lib/supervisorService'
import { useAuth } from './useAuth'

/**
 * Resolves the calendar color swatch for an event, layering:
 *   per-event override  >  clinic category default  >  built-in default ('blue').
 *
 * `resolve(category, override)` is a pure map lookup — safe to call once per
 * rendered event. The clinic defaults come from useCalendarStore via a cheap
 * selector (synced once per surface by useClinicCategoryColorsSync — no per-call
 * fetch). Also exposes the clinic-default map + setClinic so the calendar-settings
 * editor (CalendarClinicEditor) can persist supervisor-set defaults.
 */
export function useCategoryColors(targetClinicId?: string | null) {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const clinic = useCalendarStore(s => s.clinicCategoryColors)
  const setClinicCategoryColors = useCalendarStore(s => s.setClinicCategoryColors)

  const resolve = useCallback(
    (category: EventCategory, override?: CategorySwatchId | null): CategorySwatch => {
      const id: CategorySwatchId = override ?? clinic[category] ?? DEFAULT_SWATCH
      return CATEGORY_SWATCHES[id]
    },
    [clinic],
  )

  /** Supervisor-only: persist the clinic default map. Optimistic + invalidate('clinics'). */
  const setClinic = useCallback(
    async (next: CategoryColorMap) => {
      if (!clinicId) return
      setClinicCategoryColors(next) // optimistic — refetch on invalidation reconciles
      const res = await updateSupervisorClinicCalendarColors(clinicId, next)
      if (res.success) invalidate('clinics')
      return res
    },
    [clinicId, setClinicCategoryColors],
  )

  return useMemo(() => ({ resolve, clinic, setClinic }), [resolve, clinic, setClinic])
}
