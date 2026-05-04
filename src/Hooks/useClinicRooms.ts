import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ClinicRoom } from '../lib/adminService'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'

/**
 * Fetches the rooms for a specific clinic (clinics.rooms jsonb).
 * `targetClinicId` defaults to the user's assigned clinic; supervisor surfaces
 * pass an explicit id to honor the clinic-context toggle. Re-runs on
 * `clinics` invalidation bump so settings edits propagate.
 */
export function useClinicRooms(targetClinicId?: string | null) {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const clinicsGen = useInvalidation('clinics')
  const [rooms, setRooms] = useState<ClinicRoom[]>([])

  useEffect(() => {
    if (!clinicId) {
      setRooms([])
      return
    }
    let cancelled = false
    supabase
      .from('clinics')
      .select('rooms')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setRooms(((data?.rooms as ClinicRoom[]) ?? []))
      })
    return () => { cancelled = true }
  }, [clinicId, clinicsGen])

  return rooms
}
