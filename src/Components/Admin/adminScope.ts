import type { AdminClinic } from '../../lib/adminService'

/**
 * Pure containment index for the admin Directory tree.
 *
 * A cluster nests under its parent cluster (parent_clinic_id) if it has one,
 * else it is a root. Location is NOT part of the placement rule: the tree is
 * org-rooted and shows location as a per-cluster chip, because an org can sit
 * in a different location than its parent. See AdminSummary.
 */
export interface ScopeIndex {
  /** parent_clinic_id → child clusters (sorted by name). */
  clinicChildren: Map<string, AdminClinic[]>
  /** Every root cluster (no/dangling parent_clinic_id), sorted by name — the
   *  roots the Directory tree iterates. */
  rootClinics: AdminClinic[]
}

const byName = (a: AdminClinic, b: AdminClinic) => a.name.localeCompare(b.name)

export function buildScopeIndex(clinics: AdminClinic[]): ScopeIndex {
  const clinicChildren = new Map<string, AdminClinic[]>()
  for (const c of clinics) {
    if (!c.parent_clinic_id) continue
    const arr = clinicChildren.get(c.parent_clinic_id)
    if (arr) arr.push(c)
    else clinicChildren.set(c.parent_clinic_id, [c])
  }
  for (const arr of clinicChildren.values()) arr.sort(byName)

  // A cluster whose parent_clinic_id points at a cluster that isn't in the list
  // is treated as a root, so a dangling FK surfaces the cluster instead of
  // hiding it under a parent that never renders.
  const clinicById = new Map(clinics.map(c => [c.id, c]))
  const rootClinics = clinics
    .filter(c => !c.parent_clinic_id || !clinicById.has(c.parent_clinic_id))
    .sort(byName)

  return { clinicChildren, rootClinics }
}
