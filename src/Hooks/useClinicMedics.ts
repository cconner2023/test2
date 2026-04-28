import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { loadCachedClinicUsers, saveCachedClinicUsers } from '../lib/clinicUsersCache'
import { createLogger } from '../Utilities/Logger'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

const logger = createLogger('ClinicMedics')

/** Fetches medics from the same clinic + associated clinics (via RPC), with fallback. */
export function useClinicMedics() {
  const [medics, setMedics] = useState<ClinicMedic[]>([])
  // Start not-loading — cache hydration is near-instant and will populate medics
  // before the first paint. Only flip to loading if cache is empty (cold start).
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Subscribe reactively so fetchMedics re-runs when auth resolves
  const userId = useAuthStore(s => s.user?.id ?? null)

  // Track whether we've hydrated from cache so background refreshes stay silent
  const hasCacheRef = useRef(false)

  const fetchMedics = useCallback(async () => {
    if (!userId) {
      // Auth hasn't resolved yet — stay in loading state, don't set error.
      // The effect will re-trigger once userId populates.
      return
    }

    // Only show loading spinner on cold start (no cache). Background refreshes
    // after cache hydration are silent — no flash.
    if (!hasCacheRef.current) {
      setLoading(true)
    }
    setError(null)

    try {
      const user = useAuthStore.getState().user
      if (!user) return

      // ── Try RPC first ────────────────────────────────────────────
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_location_medics')

        if (rpcError) {
          logger.warn('get_location_medics RPC failed, using fallback:', rpcError.message)
        } else if (rpcData && rpcData.length > 0) {
          const medicProfiles: ClinicMedic[] = rpcData.map((p: {
            id: string; first_name: string; last_name: string; middle_initial: string;
            rank: string; credential: string; avatar_id: string; clinic_id: string; clinic_name: string;
            roles?: string[]
          }) => ({
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            middleInitial: p.middle_initial,
            rank: p.rank,
            credential: p.credential,
            avatarId: p.avatar_id ?? null,
            roles: p.roles ?? [],
            clinicId: p.clinic_id,
            clinicName: p.clinic_name,
          }))

          logger.info(`RPC returned ${medicProfiles.length} medics`)
          setMedics(medicProfiles)
          saveCachedClinicUsers(medicProfiles).catch(() => {})
          return
        } else {
          logger.info('RPC returned 0 medics, using fallback')
        }
      } catch (rpcErr) {
        logger.warn('RPC call threw, using fallback:', rpcErr instanceof Error ? rpcErr.message : rpcErr)
      }

      // ── Fallback: same-clinic query ──────────────────────────────
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('clinic_id')
        .eq('id', user.id)
        .single()

      if (profileError) {
        logger.warn('Profile fetch failed:', profileError.message)
      }
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
        logger.warn('Clinic profiles fetch failed:', clinicError.message)
        setError(clinicError.message)
        setLoading(false)
        return
      }

      const medicProfiles: ClinicMedic[] = (clinicProfiles || [])
        .map(p => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          middleInitial: p.middle_initial,
          rank: p.rank,
          credential: p.credential,
          avatarId: p.avatar_id ?? null,
          roles: (p as { roles?: string[] }).roles ?? [],
        }))

      logger.info(`Fallback returned ${medicProfiles.length} medics`)
      setMedics(medicProfiles)
      saveCachedClinicUsers(medicProfiles).catch(() => {})
    } catch (err) {
      logger.error('fetchMedics failed:', err instanceof Error ? err.message : err)
      setError(err instanceof Error ? err.message : 'Failed to fetch medics')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // Don't attempt anything until auth has resolved
    if (!userId) return

    let cancelled = false

    // Load from IDB cache first for instant render, then refresh silently
    loadCachedClinicUsers().then(cached => {
      if (cancelled) return
      if (cached.length > 0) {
        logger.info(`Loaded ${cached.length} medics from cache`)
        hasCacheRef.current = true
        setMedics(cached)
      } else {
        // No cache — show spinner for cold start only
        setLoading(true)
      }
      // Refresh from Supabase in background (silent when cache exists)
      fetchMedics()
    }).catch(() => {
      // Cache load failed — show spinner and fall through to network fetch
      if (!cancelled) {
        setLoading(true)
        fetchMedics()
      }
    })

    return () => { cancelled = true }
  }, [userId, fetchMedics])

  return { medics, loading, error, refresh: fetchMedics }
}
