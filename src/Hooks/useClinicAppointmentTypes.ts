import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ClinicAppointmentType } from '../lib/supervisorService'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'

/**
 * Fetches the current clinic's provider appointment types (clinics.appointment_types jsonb).
 * Re-runs on `clinics` invalidation bump so settings edits propagate.
 * Mirrors useClinicHuddleTasks.
 */
export function useClinicAppointmentTypes(targetClinicId?: string | null) {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const clinicsGen = useInvalidation('clinics')
  const [types, setTypes] = useState<ClinicAppointmentType[]>([])

  useEffect(() => {
    if (!clinicId) {
      setTypes([])
      return
    }
    let cancelled = false
    supabase
      .from('clinics')
      .select('appointment_types')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setTypes(((data?.appointment_types as ClinicAppointmentType[]) ?? []))
      })
    return () => { cancelled = true }
  }, [clinicId, clinicsGen])

  return types
}
