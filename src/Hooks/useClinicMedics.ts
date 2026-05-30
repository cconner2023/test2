import { useEffect, useCallback } from 'react'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { useInvalidation } from '../stores/useInvalidationStore'
import { loadCachedClinicUsers, saveCachedClinicUsers } from '../lib/clinicUsersCache'
import { createLogger } from '../Utilities/Logger'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

const logger = createLogger('ClinicMedics')

/**
 * Cluster medic roster — SHARED across all consumers.
 *
 * ~17 components mount useClinicMedics (calendar panels, drawers, message
 * pickers, search, settings). Previously each instance held its own state and
 * fired its own `get_location_medics` RPC on mount, so a single render wave
 * issued many identical RPCs — a top PostgREST egress source. This module hoists
 * the roster into one Zustand store: every consumer reads the same medics, and
 * the network refresh runs at most ONCE per (userId, `users` invalidation
 * generation), de-duped across concurrent mounts. IDB cache still hydrates for
 * instant first paint. Roster mutations should `invalidate('users')` to force a
 * shared refresh.
 */

interface ClinicMedicsState {
  medics: ClinicMedic[]
  loading: boolean
  error: string | null
  /** `${userId}::${usersGen}` of the last successful network refresh. */
  fetchedKey: string | null
  /** IDB cache hydrated at least once this session. */
  hydrated: boolean
}

const useClinicMedicsStore = create<ClinicMedicsState>(() => ({
  medics: [],
  loading: false,
  error: null,
  fetchedKey: null,
  hydrated: false,
}))

// Single in-flight network refresh, shared so concurrent mounts don't stack RPCs.
let inflight: Promise<void> | null = null

/** RPC-first roster fetch with same-clinic fallback. Returns null on soft failure. */
async function fetchMedicsFromNetwork(userId: string): Promise<ClinicMedic[] | null> {
  // ── Try RPC first (same + associated clinics) ──────────────────────
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_location_medics')
    if (rpcError) {
      logger.warn('get_location_medics RPC failed, using fallback:', rpcError.message)
    } else if (rpcData && rpcData.length > 0) {
      const medicProfiles: ClinicMedic[] = rpcData.map((p: {
        id: string; first_name: string; last_name: string; middle_initial: string;
        rank: string; credential: string; avatar_id: string; clinic_id: string; clinic_name: string;
        roles?: string[]; surrogate_clinic_id?: string | null; is_loaned_in?: boolean
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
        surrogateClinicId: p.surrogate_clinic_id ?? null,
        isLoanedIn: p.is_loaned_in ?? false,
      }))
      logger.info(`RPC returned ${medicProfiles.length} medics`)
      return medicProfiles
    } else {
      logger.info('RPC returned 0 medics, using fallback')
    }
  } catch (rpcErr) {
    logger.warn('RPC call threw, using fallback:', rpcErr instanceof Error ? rpcErr.message : rpcErr)
  }

  // ── Fallback: same-clinic query ────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('clinic_id')
    .eq('id', userId)
    .single()

  if (profileError) {
    logger.warn('Profile fetch failed:', profileError.message)
  }
  if (profileError || !profile?.clinic_id) {
    throw new Error('No clinic assigned')
  }

  const { data: clinicProfiles, error: clinicError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, middle_initial, rank, credential, roles, avatar_id')
    .eq('clinic_id', profile.clinic_id)

  if (clinicError) {
    logger.warn('Clinic profiles fetch failed:', clinicError.message)
    throw new Error(clinicError.message)
  }

  const medicProfiles: ClinicMedic[] = (clinicProfiles || []).map(p => ({
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
  return medicProfiles
}

async function runNetworkRefresh(userId: string, key: string): Promise<void> {
  // Only show the spinner on a cold start (no roster yet). Background refreshes
  // after cache hydration stay silent — no flash.
  if (useClinicMedicsStore.getState().medics.length === 0) {
    useClinicMedicsStore.setState({ loading: true })
  }
  useClinicMedicsStore.setState({ error: null })
  try {
    const medics = await fetchMedicsFromNetwork(userId)
    if (medics) {
      useClinicMedicsStore.setState({ medics, fetchedKey: key, loading: false })
      saveCachedClinicUsers(medics).catch(() => {})
    } else {
      // Soft failure (e.g. RPC empty + no fallback data) — keep cache, clear spinner.
      useClinicMedicsStore.setState({ loading: false })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch medics'
    logger.error('fetchMedics failed:', message)
    useClinicMedicsStore.setState({ error: message, loading: false })
  }
}

/**
 * Ensure the shared roster is hydrated + (at most once per key) refreshed.
 * Concurrent callers share the same IDB hydration and network round-trip.
 */
async function ensureClinicMedics(userId: string, key: string, force = false): Promise<void> {
  // Hydrate from IDB once for instant render. setState is synchronous, so the
  // first caller flips `hydrated` before any await and later callers skip it.
  if (!useClinicMedicsStore.getState().hydrated) {
    useClinicMedicsStore.setState({ hydrated: true })
    const cached = await loadCachedClinicUsers().catch(() => [] as ClinicMedic[])
    if (cached.length > 0 && useClinicMedicsStore.getState().medics.length === 0) {
      logger.info(`Loaded ${cached.length} medics from cache`)
      useClinicMedicsStore.setState({ medics: cached })
    }
  }

  if (!force && useClinicMedicsStore.getState().fetchedKey === key) return // already fresh this generation
  if (!force && inflight) return inflight

  const run = runNetworkRefresh(userId, key).finally(() => {
    if (inflight === run) inflight = null
  })
  inflight = run
  return run
}

/** Fetches medics from the same clinic + associated clinics (via RPC), with fallback. */
export function useClinicMedics() {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const usersGen = useInvalidation('users')
  const medics = useClinicMedicsStore(s => s.medics)
  const loading = useClinicMedicsStore(s => s.loading)
  const error = useClinicMedicsStore(s => s.error)

  useEffect(() => {
    if (!userId) return
    ensureClinicMedics(userId, `${userId}::${usersGen}`)
  }, [userId, usersGen])

  const refresh = useCallback(() => {
    if (!userId) return Promise.resolve()
    return ensureClinicMedics(userId, `${userId}::${usersGen}`, true)
  }, [userId, usersGen])

  return { medics, loading, error, refresh }
}
