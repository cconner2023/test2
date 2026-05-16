import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useInvalidation } from '../stores/useInvalidationStore'
import { createLogger } from '../Utilities/Logger'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

const logger = createLogger('ClinicLoans')

/**
 * Loaned-in medics for a single clinic. Queries profile_clinic_loans directly
 * so the list is accurate even for soldiers whose oldest loan is at a different
 * clinic (the dual-written profiles.surrogate_clinic_id only points at one).
 *
 * Returns the lightweight ClinicMedic shape so callers can render with the
 * same row components as useClinicMedics.
 */
export function useClinicLoans(clinicId: string | null) {
  const [medics, setMedics] = useState<ClinicMedic[]>([])
  const [loading, setLoading] = useState(false)
  const usersGen = useInvalidation('users')

  useEffect(() => {
    if (!clinicId) {
      setMedics([])
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('profile_clinic_loans')
      .select(`
        user_id,
        profile:profiles!profile_clinic_loans_user_id_fkey (
          id, first_name, last_name, middle_initial, rank, credential, roles, avatar_id, clinic_id
        )
      `)
      .eq('clinic_id', clinicId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          logger.warn('useClinicLoans fetch failed:', error.message)
          setMedics([])
          setLoading(false)
          return
        }
        const rows = (data ?? []) as Array<{ profile: Record<string, unknown> | null }>
        const mapped: ClinicMedic[] = rows
          .map((r) => r.profile)
          .filter((p): p is Record<string, unknown> => !!p)
          .map((p) => ({
            id: p.id as string,
            firstName: (p.first_name as string) ?? '',
            lastName: (p.last_name as string) ?? '',
            middleInitial: (p.middle_initial as string) ?? '',
            rank: (p.rank as string) ?? '',
            credential: (p.credential as string) ?? '',
            avatarId: (p.avatar_id as string) ?? null,
            roles: (p.roles as string[]) ?? [],
            clinicId: (p.clinic_id as string) ?? undefined,
            isLoanedIn: true,
          }))
        setMedics(mapped)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clinicId, usersGen])

  return { medics, loading }
}
