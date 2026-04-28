import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ClinicHuddleTask } from '../lib/supervisorService'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'

/**
 * Fetches the current clinic's huddle tasks (clinics.huddle_tasks jsonb).
 * Re-runs on `clinics` invalidation bump so settings edits propagate.
 * Mirrors useClinicRooms.
 */
export function useClinicHuddleTasks() {
  const { clinicId } = useAuth()
  const clinicsGen = useInvalidation('clinics')
  const [tasks, setTasks] = useState<ClinicHuddleTask[]>([])

  useEffect(() => {
    if (!clinicId) {
      setTasks([])
      return
    }
    let cancelled = false
    supabase
      .from('clinics')
      .select('huddle_tasks')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setTasks(((data?.huddle_tasks as ClinicHuddleTask[]) ?? []))
      })
    return () => { cancelled = true }
  }, [clinicId, clinicsGen])

  return tasks
}
