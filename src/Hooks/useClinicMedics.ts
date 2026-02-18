import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

export function useClinicMedics() {
  const [medics, setMedics] = useState<ClinicMedic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMedics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Get current user's clinic_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.clinic_id) {
        setError('No clinic assigned')
        setMedics([])
        setLoading(false)
        return
      }

      // Fetch all profiles in the same clinic with medic role
      const { data: clinicProfiles, error: clinicError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_initial, rank, credential, roles')
        .eq('clinic_id', profile.clinic_id)

      if (clinicError) {
        setError(clinicError.message)
        setLoading(false)
        return
      }

      // Return all clinic members except the current user
      const medicProfiles: ClinicMedic[] = (clinicProfiles || [])
        .filter(p => p.id !== user.id)
        .map(p => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          middleInitial: p.middle_initial,
          rank: p.rank,
          credential: p.credential,
        }))

      setMedics(medicProfiles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch medics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMedics() }, [fetchMedics])

  return { medics, loading, error, refresh: fetchMedics }
}
