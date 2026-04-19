import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { upsertCachedClinicUser } from '../lib/clinicUsersCache'
import { createLogger } from '../Utilities/Logger'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

const logger = createLogger('OrphanedProfiles')

/**
 * Fetches profiles for user IDs that have conversations but are no longer
 * visible through the clinic roster (e.g. user migrated to another clinic).
 *
 * Uses fetch_profiles_by_ids (SECURITY DEFINER) to bypass RLS for the lookup.
 * Results are individually upserted into clinicUsersCache for offline use.
 */
export function useOrphanedProfiles(orphanedIds: string[]): Map<string, ClinicMedic> {
  const [profileMap, setProfileMap] = useState<Map<string, ClinicMedic>>(new Map())
  const prevKeyRef = useRef<string>('')

  useEffect(() => {
    const key = [...orphanedIds].sort().join(',')
    if (!key || key === prevKeyRef.current) return
    prevKeyRef.current = key

    let cancelled = false

    supabase
      .rpc('fetch_profiles_by_ids', { user_ids: orphanedIds })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const map = new Map<string, ClinicMedic>()
        for (const p of data as any[]) {
          const medic: ClinicMedic = {
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            middleInitial: p.middle_initial,
            rank: p.rank,
            credential: p.credential,
            avatarId: p.avatar_id ?? null,
            clinicId: p.clinic_id,
            clinicName: p.clinic_name,
          }
          map.set(p.id, medic)
          upsertCachedClinicUser(medic).catch(() => {})
        }
        setProfileMap(map)
      })
      .catch(err => logger.warn('fetch_profiles_by_ids failed:', err))

    return () => { cancelled = true }
  }, [orphanedIds])

  return profileMap
}
