import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useInvalidation } from '../stores/useInvalidationStore'
import { createLogger } from '../Utilities/Logger'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

const logger = createLogger('ClinicLoans')

const LOANS_SELECT = `
        user_id,
        profile:profiles!profile_clinic_loans_user_id_fkey (
          id, first_name, last_name, middle_initial, rank, credential, roles, avatar_id, avatar_blob, clinic_id,
          home_clinic:clinics!profiles_clinic_id_fkey ( name )
        )
      `

// Resolved snapshots + in-flight promises, keyed `${clinicId}::${usersGen}`. The
// loaned-in roster is read by ~5 mount points (useClinicGroupedMedics in
// CalendarDrawer/CalendarPanel/MessagesPanel/MessagingOncallSettings + ClinicPanel
// directly); previously each fired its own profile_clinic_loans join per mount.
// Loans only change via admin actions, which invalidate('users') → new gen → one
// shared refetch. Same shape as useClinicConfig.
const snapshots = new Map<string, ClinicMedic[]>()
const inflight = new Map<string, Promise<ClinicMedic[]>>()

function fetchLoans(clinicId: string, key: string): Promise<ClinicMedic[]> {
  const existing = inflight.get(key)
  if (existing) return existing

  const p = supabase
    .from('profile_clinic_loans')
    .select(LOANS_SELECT)
    .eq('clinic_id', clinicId)
    .then(({ data, error }) => {
      inflight.delete(key)
      if (error) {
        // Don't cache failures — let the next mount retry instead of pinning [].
        logger.warn('useClinicLoans fetch failed:', error.message)
        return [] as ClinicMedic[]
      }
      const rows = (data ?? []) as Array<{ profile: Record<string, unknown> | null }>
      const mapped: ClinicMedic[] = rows
        .map((r) => r.profile)
        .filter((pr): pr is Record<string, unknown> => !!pr)
        .map((pr) => ({
          id: pr.id as string,
          firstName: (pr.first_name as string) ?? '',
          lastName: (pr.last_name as string) ?? '',
          middleInitial: (pr.middle_initial as string) ?? '',
          rank: (pr.rank as string) ?? '',
          credential: (pr.credential as string) ?? '',
          avatarId: (pr.avatar_id as string) ?? null,
          avatarBlob: (pr.avatar_blob as ClinicMedic['avatarBlob']) ?? null,
          roles: (pr.roles as string[]) ?? [],
          clinicId: (pr.clinic_id as string) ?? undefined,
          clinicName: (pr.home_clinic as { name?: string } | null)?.name ?? undefined,
          isLoanedIn: true,
        }))
      snapshots.set(key, mapped)
      // Bound the map: drop older generations for this clinic.
      const prefix = `${clinicId}::`
      for (const k of snapshots.keys()) {
        if (k !== key && k.startsWith(prefix)) snapshots.delete(k)
      }
      return mapped
    })
    .catch(() => {
      inflight.delete(key)
      return [] as ClinicMedic[]
    })

  inflight.set(key, p)
  return p
}

/**
 * Loaned-in medics for a single clinic. Queries profile_clinic_loans directly
 * so the list is accurate even for soldiers whose oldest loan is at a different
 * clinic (the dual-written profiles.surrogate_clinic_id only points at one).
 *
 * Reads through a shared snapshot cache keyed by (clinicId, `users` generation),
 * de-duped across concurrent mounts — so the ~5 consumers share ONE query.
 * Returns the lightweight ClinicMedic shape so callers can render with the same
 * row components as useClinicMedics.
 */
export function useClinicLoans(clinicId: string | null) {
  const usersGen = useInvalidation('users')
  const key = clinicId ? `${clinicId}::${usersGen}` : ''
  const [medics, setMedics] = useState<ClinicMedic[]>(() => (key && snapshots.get(key)) || [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clinicId) {
      setMedics([])
      setLoading(false)
      return
    }
    const cached = snapshots.get(key)
    if (cached) {
      setMedics(cached)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchLoans(clinicId, key).then((rows) => {
      if (cancelled) return
      setMedics(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [clinicId, key])

  return { medics, loading }
}
