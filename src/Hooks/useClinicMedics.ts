import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { loadCachedClinicUsers, saveCachedClinicUsers } from '../lib/clinicUsersCache'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

/** Fetches medics from the same location (via RPC), falling back to same-clinic query. */
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

      // Try the location-based RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_location_medics')

      if (!rpcError && rpcData && rpcData.length > 0) {
        const medicProfiles: ClinicMedic[] = rpcData.map((p: {
          id: string; first_name: string; last_name: string; middle_initial: string;
          rank: string; credential: string; avatar_id: string; clinic_id: string; clinic_name: string
        }) => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          middleInitial: p.middle_initial,
          rank: p.rank,
          credential: p.credential,
          avatarId: p.avatar_id ?? null,
          clinicId: p.clinic_id,
          clinicName: p.clinic_name,
        }))

        setMedics(medicProfiles)
        saveCachedClinicUsers(medicProfiles).catch(() => {})
        return
      }

      // Fallback: same-clinic query (RPC not available or location_group not set)
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

      const { data: clinicProfiles, error: clinicError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_initial, rank, credential, roles, avatar_id')
        .eq('clinic_id', profile.clinic_id)

      if (clinicError) {
        setError(clinicError.message)
        setLoading(false)
        return
      }

      const medicProfiles: ClinicMedic[] = (clinicProfiles || [])
        .filter(p => p.id !== user.id)
        .map(p => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          middleInitial: p.middle_initial,
          rank: p.rank,
          credential: p.credential,
          avatarId: p.avatar_id ?? null,
        }))

      setMedics(medicProfiles)
      saveCachedClinicUsers(medicProfiles).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch medics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    // Load from IDB cache first for instant render
    loadCachedClinicUsers().then(cached => {
      if (cancelled) return
      if (cached.length > 0) {
        setMedics(cached)
        setLoading(false)
      }
      // Then refresh from Supabase in background
      fetchMedics()
    }).catch(() => {
      // Cache load failed — fall through to network fetch
      if (!cancelled) fetchMedics()
    })

    return () => { cancelled = true }
  }, [fetchMedics])

  return { medics, loading, error, refresh: fetchMedics }
}
