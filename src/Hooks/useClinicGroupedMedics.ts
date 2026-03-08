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
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

export interface ClinicGroupedMedics {
  ownClinicMedics: ClinicMedic[]
  nearbyByClinic: Record<string, ClinicMedic[]>
  nearbyClinicNames: string[]
}

export function useClinicGroupedMedics(medics: ClinicMedic[]): ClinicGroupedMedics {
  const { clinicId: userClinicId } = useAuth()

  const canSplit = !!userClinicId

  const ownClinicMedics = useMemo(() => {
    const list = canSplit
      ? medics.filter(m => !m.clinicId || m.clinicId === userClinicId)
      : medics
    return [...list].sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? ''))
  }, [medics, userClinicId, canSplit])

  const nearbyByClinic = useMemo(() => {
    if (!canSplit) return {} as Record<string, ClinicMedic[]>
    const nearby = medics.filter(m => m.clinicId && m.clinicId !== userClinicId)
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
