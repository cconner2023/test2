import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ClinicWorkout } from '../lib/supervisorService'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'

/**
 * Fetches the current clinic's workout templates (clinics.workouts jsonb).
 * Re-runs on `clinics` invalidation bump so settings edits propagate.
 * Mirrors useClinicHuddleTasks / useClinicAppointmentTypes.
 */
export function useClinicWorkouts(targetClinicId?: string | null) {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const clinicsGen = useInvalidation('clinics')
  const [workouts, setWorkouts] = useState<ClinicWorkout[]>([])

  useEffect(() => {
    if (!clinicId) {
      setWorkouts([])
      return
    }
    let cancelled = false
    supabase
      .from('clinics')
      .select('workouts')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setWorkouts(((data?.workouts as ClinicWorkout[]) ?? []))
      })
    return () => { cancelled = true }
  }, [clinicId, clinicsGen])

  return workouts
}
