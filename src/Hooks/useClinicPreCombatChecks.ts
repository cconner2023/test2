import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ClinicPreCombatCheck } from '../lib/supervisorService'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'

/**
 * Fetches the current clinic's pre-combat check templates
 * (clinics.pre_combat_checks jsonb). Mirrors useClinicHuddleTasks.
 */
export function useClinicPreCombatChecks(targetClinicId?: string | null) {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const clinicsGen = useInvalidation('clinics')
  const [pcc, setPcc] = useState<ClinicPreCombatCheck[]>([])

  useEffect(() => {
    if (!clinicId) {
      setPcc([])
      return
    }
    let cancelled = false
    supabase
      .from('clinics')
      .select('pre_combat_checks')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setPcc(((data?.pre_combat_checks as ClinicPreCombatCheck[]) ?? []))
      })
    return () => { cancelled = true }
  }, [clinicId, clinicsGen])

  return pcc
}
