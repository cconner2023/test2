import type { AdminClinic, AdminLocation } from '../../lib/adminService'

/**
 * Pure containment index for the unified admin Directory tree.
 *
 * The org is one 4-tier containment chain, all real FKs:
 *   location (parent_id) ⊃ location ⊃ cluster (location_id / parent_clinic_id) ⊃ cluster ⊃ user (clinic_id)
 *
 * Placement rule (re-implements the deleted adminGraph): a cluster nests under
 * its parent cluster if it has one (parent_clinic_id), else under its location
 * (location_id), else floats at the tree root. A sub-cluster's own location_id
 * is IGNORED for placement — it lives under its parent. Scope resolution uses
 * the SAME rule so "what's under this node" matches what the tree renders.
 *
 * NOTE: as of 2026-06-26 the Directory tree is ORG-ROOTED (it iterates
 * `rootClinics`, not `rootLocations`) — location is shown as a per-cluster chip,
 * not a tree parent, since an org can sit in a different location than its
 * parent. The location-rooted fields (clinicsByLocation / rootLocations /
 * floatingRootClinics) remain for the scope helpers below.
 */
export interface ScopeIndex {
  /** parent_clinic_id → child clusters (sorted by name). */
  clinicChildren: Map<string, AdminClinic[]>
  /** parent_id → child locations (sorted by display_name). */
  locChildren: Map<string, AdminLocation[]>
  /** location_id → root clusters (no parent_clinic_id) placed in that location. */
  clinicsByLocation: Map<string, AdminClinic[]>
  /** Root locations (no parent_id), sorted. */
  rootLocations: AdminLocation[]
  /** Root clusters with no resolvable location — float at the tree root. */
  floatingRootClinics: AdminClinic[]
  /** Every root cluster (no/dangling parent_clinic_id), sorted by name —
   *  regardless of location. The roots of the org-rooted Directory tree. */
  rootClinics: AdminClinic[]
}

const byName = (a: AdminClinic, b: AdminClinic) => a.name.localeCompare(b.name)
const byDisplay = (a: AdminLocation, b: AdminLocation) =>
  a.display_name.localeCompare(b.display_name)

export function buildScopeIndex(
  clinics: AdminClinic[],
  locations: AdminLocation[],
): ScopeIndex {
  const locById = new Map(locations.map(l => [l.id, l]))

  const clinicChildren = new Map<string, AdminClinic[]>()
  for (const c of clinics) {
    if (!c.parent_clinic_id) continue
    const arr = clinicChildren.get(c.parent_clinic_id)
    if (arr) arr.push(c)
    else clinicChildren.set(c.parent_clinic_id, [c])
  }
  for (const arr of clinicChildren.values()) arr.sort(byName)

  const locChildren = new Map<string, AdminLocation[]>()
  for (const l of locations) {
    if (!l.parent_id || !locById.has(l.parent_id)) continue
    const arr = locChildren.get(l.parent_id)
    if (arr) arr.push(l)
    else locChildren.set(l.parent_id, [l])
  }
  for (const arr of locChildren.values()) arr.sort(byDisplay)

  // Root clusters only (sub-clusters are placed under their parent). A root
  // cluster lands in its location_id bucket if that location exists, else floats.
  // `rootClinics` collects every root cluster regardless of location — the org-
  // rooted Directory tree iterates that; the by-location split feeds the scope
  // helpers.
  const clinicsByLocation = new Map<string, AdminClinic[]>()
  const floatingRootClinics: AdminClinic[] = []
  const rootClinics: AdminClinic[] = []
  const clinicById = new Map(clinics.map(c => [c.id, c]))
  for (const c of clinics) {
    const isRoot = !c.parent_clinic_id || !clinicById.has(c.parent_clinic_id)
    if (!isRoot) continue
    rootClinics.push(c)
    if (c.location_id && locById.has(c.location_id)) {
      const arr = clinicsByLocation.get(c.location_id)
      if (arr) arr.push(c)
      else clinicsByLocation.set(c.location_id, [c])
    } else {
      floatingRootClinics.push(c)
    }
  }
  for (const arr of clinicsByLocation.values()) arr.sort(byName)
  floatingRootClinics.sort(byName)
  rootClinics.sort(byName)

  const rootLocations = locations
    .filter(l => !l.parent_id || !locById.has(l.parent_id))
    .sort(byDisplay)

  return { clinicChildren, locChildren, clinicsByLocation, rootLocations, floatingRootClinics, rootClinics }
}

/** Self + all cluster descendants (parent_clinic_id chain), as a flat id list. */
export function clinicIdsUnderClinic(index: ScopeIndex, clinicId: string): string[] {
  const out: string[] = []
  const walk = (id: string) => {
    out.push(id)
    for (const child of index.clinicChildren.get(id) ?? []) walk(child.id)
  }
  walk(clinicId)
  return out
}

/** Every cluster id under a location: clusters placed in it or any descendant
 *  location, plus each of those clusters' cluster-descendants. */
export function clinicIdsUnderLocation(index: ScopeIndex, locationId: string): string[] {
  const out: string[] = []
  const visitLocation = (id: string) => {
    for (const clinic of index.clinicsByLocation.get(id) ?? []) {
      out.push(...clinicIdsUnderClinic(index, clinic.id))
    }
    for (const child of index.locChildren.get(id) ?? []) visitLocation(child.id)
  }
  visitLocation(locationId)
  return out
}
