import type { ClinicMedic } from '../Types/SupervisorTestTypes'

export function getInitials(firstName?: string | null, lastName?: string | null): string {
  return ((firstName?.charAt(0) ?? '') + (lastName?.charAt(0) ?? '')).toUpperCase() || '?'
}

/** Display name: "Rank Last, F." or just "Last" or "Unknown". */
export function getDisplayName(medic: ClinicMedic): string {
  const parts: string[] = []
  if (medic.rank) parts.push(medic.rank)
  if (medic.lastName) {
    let name = medic.lastName
    if (medic.firstName) name += `, ${medic.firstName.charAt(0)}.`
    parts.push(name)
  }
  return parts.join(' ') || 'Unknown'
}
