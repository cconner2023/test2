/**
 * Shared hook for grouping clinic medics into own-clinic and nearby-clinic buckets.
 *
 * Extracted from MessagesPanel.tsx where the identical memo logic was duplicated
 * in both ContactsPanel and ContactsSidebar components.
 *
 * Returns:
 * - ownClinicMedics: medics from the current user's clinic, sorted by lastName
 * - nearbyByClinic: medics from other clinics, grouped by clinicName, each sorted by lastName
 * - nearbyClinicNames: sorted array of nearby clinic names
 */
import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { useClinicLoans } from './useClinicLoans'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

export interface ClinicGroupedMedics {
  ownClinicMedics: ClinicMedic[]
  nearbyByClinic: Record<string, ClinicMedic[]>
  nearbyClinicNames: string[]
}

export function useClinicGroupedMedics(medics: ClinicMedic[]): ClinicGroupedMedics {
  const { clinicId, supervisingClinicId } = useAuth()
  // Pivot on the currently-active operating-as clinic so calendar/messages
  // "own clinic" reflects the loan when the cluster toggle flips. Visible to
  // any loaned user (supervisor or not) via SupervisorClinicSwitcher.
  const userClinicId = supervisingClinicId ?? clinicId

  const canSplit = !!userClinicId

  // Medics loaned in to the active clinic — `medics` from useClinicMedics only
  // matches by geographic association (associated_clinic_ids), not by loan,
  // so soldiers loaned to a surrogate clinic won't show up in `ownClinicMedics`
  // unless we union them in here.
  const { medics: loanedInMedics } = useClinicLoans(userClinicId)
  const loanedInIds = useMemo(
    () => new Set(loanedInMedics.map(m => m.id)),
    [loanedInMedics],
  )

  const ownClinicMedics = useMemo(() => {
    if (!canSplit) return [...medics].sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? ''))
    const byId = new Map<string, ClinicMedic>()
    for (const m of medics) {
      if (!m.clinicId || m.clinicId === userClinicId) byId.set(m.id, m)
    }
    for (const m of loanedInMedics) {
      if (!byId.has(m.id)) byId.set(m.id, m)
    }
    return Array.from(byId.values()).sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? ''))
  }, [medics, loanedInMedics, userClinicId, canSplit])

  const nearbyByClinic = useMemo(() => {
    if (!canSplit) return {} as Record<string, ClinicMedic[]>
    const nearby = medics.filter(m => m.clinicId && m.clinicId !== userClinicId && !loanedInIds.has(m.id))
    const grouped: Record<string, ClinicMedic[]> = {}
    for (const m of nearby) {
      const key = m.clinicName ?? 'Other'
      ;(grouped[key] ??= []).push(m)
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? ''))
    }
    return grouped
  }, [medics, userClinicId, canSplit])

  const nearbyClinicNames = useMemo(
    () => Object.keys(nearbyByClinic).sort(),
    [nearbyByClinic],
  )

  return { ownClinicMedics, nearbyByClinic, nearbyClinicNames }
}
