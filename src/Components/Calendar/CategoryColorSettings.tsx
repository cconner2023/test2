import { useEffect, useState } from 'react'
import {
  EVENT_CATEGORIES,
  CATEGORY_SWATCH_IDS,
  CATEGORY_SWATCHES,
  DEFAULT_SWATCH,
  type CategoryColorMap,
  type CategorySwatchId,
  type EventCategory,
} from '../../Types/CalendarTypes'
import { useAuth } from '../../Hooks/useAuth'
import { useInvalidation, invalidate } from '../../stores/useInvalidationStore'
import { supabase } from '../../lib/supabase'
import { updateSupervisorClinicCalendarColors } from '../../lib/supervisorService'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('CategoryColorSettings')

/**
 * Supervisor-set per-category color DEFAULTS, rendered as a section inside the
 * calendar settings (CalendarClinicEditor). Writes the clinic-shared map
 * (clinics.calendar_category_colors). Individual users override per event in the
 * event form — that override wins at resolve time (see useCategoryColors).
 *
 * Self-contained + clinic-scoped (mirrors persistRooms/persistApptTypes) so the
 * supervisor operating-as toggle edits the right clinic. Non-supervisors see the
 * defaults read-only.
 */
export function CategoryColorSettings() {
  const { clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole, isDevRole } = useAuth()
  const clinicId = supervisingClinicId ?? assignedClinicId
  const clinicsGen = useInvalidation('clinics')
  const [colors, setColors] = useState<CategoryColorMap>({})

  useEffect(() => {
    if (!clinicId) { setColors({}); return }
    let cancelled = false
    supabase
      .from('clinics')
      .select('calendar_category_colors')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setColors(((data?.calendar_category_colors as CategoryColorMap) ?? {}))
      })
    return () => { cancelled = true }
  }, [clinicId, clinicsGen])

  const categories = EVENT_CATEGORIES.filter(c => !c.hidden && (!c.devOnly || isDevRole))

  const persist = async (next: CategoryColorMap) => {
    if (!clinicId) return
    const prev = colors
    setColors(next) // optimistic
    const res = await updateSupervisorClinicCalendarColors(clinicId, next)
    if (res.success) {
      invalidate('clinics')
    } else {
      setColors(prev) // revert
      logger.warn('calendar color save failed:', res.error)
    }
  }

  const setColor = (category: EventCategory, id: CategorySwatchId) => {
    void persist({ ...colors, [category]: id })
  }

  return (
    <section>
      <div className="pb-2">
        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Event Colors</p>
      </div>
      <div className="rounded-xl bg-themewhite2 overflow-hidden">
        <div className="px-4 py-3 space-y-1">
          {categories.map(({ value: category, label }) => {
            const effective = colors[category] ?? DEFAULT_SWATCH
            return (
              <div key={category} className="flex items-center gap-3 py-1.5">
                <span className="text-sm font-medium text-primary truncate flex-1">{label}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {CATEGORY_SWATCH_IDS.map(id => {
                    const sw = CATEGORY_SWATCHES[id]
                    const isEffective = effective === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={isSupervisorRole ? () => setColor(category, id) : undefined}
                        disabled={!isSupervisorRole}
                        aria-label={`${label}: ${sw.label}`}
                        className={`h-5 w-5 rounded-full ${sw.solid} transition-transform ${
                          isSupervisorRole ? 'active:scale-90' : ''
                        } ${
                          isEffective ? 'ring-2 ring-offset-2 ring-offset-themewhite2 ring-primary' : 'opacity-40'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
