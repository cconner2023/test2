import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ClinicExercise } from '../lib/supervisorService'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'

/**
 * Fetches the current clinic's exercise catalog (clinics.exercises jsonb).
 * Re-runs on `clinics` invalidation bump so settings edits propagate.
 * Mirrors useClinicWorkouts.
 */
export function useClinicExercises(targetClinicId?: string | null) {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const clinicsGen = useInvalidation('clinics')
  const [exercises, setExercises] = useState<ClinicExercise[]>([])

  useEffect(() => {
    if (!clinicId) {
      setExercises([])
      return
    }
    let cancelled = false
    supabase
      .from('clinics')
      .select('exercises')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setExercises(((data?.exercises as ClinicExercise[]) ?? []))
      })
    return () => { cancelled = true }
  }, [clinicId, clinicsGen])

  return exercises
}
