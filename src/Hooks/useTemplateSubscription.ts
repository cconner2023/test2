/**
 * Per-user choice of WHICH clinics' note content (text templates / order sets /
 * plan tags) to merge into note-writing. A loaned user belongs to {home} ∪ loans
 * and opts in per clinic. Personal blocks are always merged regardless.
 *
 * Default (never configured → profile.noteTemplateClinicIds == null): HOME ONLY.
 * Loans are opt-in, so a freshly-loaned medic doesn't get a surprise flood of
 * another clinic's templates until they turn it on here.
 *
 * Authorization is never derived from this list — it's a display/merge preference.
 * The effective set is always intersected with current valid memberships, so a
 * stale id left over from an ended loan is silently dropped, and RLS still gates
 * whether the clinic's content is even readable.
 */

import { useCallback, useMemo } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserProfile } from './useUserProfile'

export interface TemplateSourceMembership {
  id: string
  name: string
  isHome: boolean
  subscribed: boolean
}

/**
 * Resolve the stored subscription list to the set actually used in the merge.
 * Pure so the merge hook and the settings UI agree exactly.
 */
export function effectiveSubscribedClinicIds(
  stored: string[] | null | undefined,
  homeId: string | null,
  loanIds: string[],
): string[] {
  const valid = new Set<string>([homeId, ...loanIds].filter(Boolean) as string[])
  // Opt-in default: home only until the user configures sources explicitly.
  if (stored == null) return homeId ? [homeId] : []
  return stored.filter(id => valid.has(id))
}

export function useTemplateSubscription() {
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const homeClinicId = useAuthStore(s => s.clinicId)
  const homeClinicName = useAuthStore(s => s.profile.clinicName) ?? profile?.clinicName

  const loanClinics = profile?.surrogateClinics ?? []
  const loanIds = useMemo(() => loanClinics.map(c => c.id), [loanClinics])
  const stored = profile?.noteTemplateClinicIds

  const subscribedClinicIds = useMemo(
    () => effectiveSubscribedClinicIds(stored, homeClinicId, loanIds),
    [stored, homeClinicId, loanIds],
  )
  const subscribedSet = useMemo(() => new Set(subscribedClinicIds), [subscribedClinicIds])

  /** Only loaned users get the choice — home-only users always merge home. */
  const isLoaned = loanIds.length > 0

  const memberships = useMemo<TemplateSourceMembership[]>(() => {
    const rows: TemplateSourceMembership[] = []
    if (homeClinicId) {
      rows.push({
        id: homeClinicId,
        name: homeClinicName || 'Home clinic',
        isHome: true,
        subscribed: subscribedSet.has(homeClinicId),
      })
    }
    for (const c of loanClinics) {
      rows.push({ id: c.id, name: c.name || 'Clinic', isHome: false, subscribed: subscribedSet.has(c.id) })
    }
    return rows
  }, [homeClinicId, homeClinicName, loanClinics, subscribedSet])

  const toggle = useCallback((clinicId: string) => {
    const current = new Set(effectiveSubscribedClinicIds(stored, homeClinicId, loanIds))
    if (current.has(clinicId)) current.delete(clinicId)
    else current.add(clinicId)
    const next = [...current]
    updateProfile({ noteTemplateClinicIds: next })
    syncProfileField({ note_template_clinic_ids: next })
  }, [stored, homeClinicId, loanIds, updateProfile, syncProfileField])

  return { isLoaned, memberships, subscribedClinicIds, toggle }
}
