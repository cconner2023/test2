// adminHierarchy.ts
//
// Pure builder for the Admin Directory's containment forest:
//
//   Location (installation)  ⊃  Cluster (echelon, via parent_clinic_id)  ⊃  Users
//
// Replaces the deleted radial AdminMap/adminGraph — same source-of-truth schema
// edges (clinic.location_id ⊃ cluster; clinic.parent_clinic_id ⊃ sub-cluster;
// user.clinic_id ⊃ user), but shaped as an indented tree the Directory renders
// inline (desktop) and in a Sheet (mobile). NO React here — buildAdminHierarchy
// is called from a useMemo and the result drives both the tree and the roster.
//
// Locations are rendered FLAT at the installation level (their own parent_id
// state→installation tree is picker noise for the directory). Clusters with no
// resolvable location fall under a synthetic "No location" group; users with no
// clinic fall under a synthetic "Unassigned" group. Both are selectable pseudo
// roots so their rosters are reachable.
import type { AdminClinic, AdminLocation, AdminUser } from '../../lib/adminService'

export const NO_LOCATION_ID = '__no_location__'
export const UNASSIGNED_ID = '__unassigned__'

export interface ClusterNode {
    kind: 'cluster'
    id: string
    label: string
    /** location name · UICs — the row subtitle. */
    sublabel: string
    clinic: AdminClinic
    children: ClusterNode[]
    /** Users assigned directly to THIS cluster (clinic_id match). */
    directUserCount: number
    /** Direct + all descendant users — the echelon roll-up shown on the node. */
    totalUserCount: number
}

export interface LocationNode {
    kind: 'location' | 'no-location' | 'unassigned'
    id: string
    label: string
    sublabel: string
    /** The backing record — present only for real 'location' nodes (so dev can
     *  open AdminLocationDetail). null for the synthetic groups. */
    location?: AdminLocation
    /** Root clusters at this location (empty for the 'unassigned' pseudo-node). */
    children: ClusterNode[]
    /** Direct + descendant users across all clusters here (or, for 'unassigned',
     *  the count of clinic-less users). */
    totalUserCount: number
}

export type HierNode = LocationNode | ClusterNode

export interface AdminHierarchy {
    /** Top-level rows: real locations (sorted), then "No location", then
     *  "Unassigned" — each only present when it actually has members. */
    roots: LocationNode[]
    /** clinic_id → users assigned there (clinic_id match only — NOT loans). */
    usersByClinic: Map<string, AdminUser[]>
    /** Users with a null/unknown clinic_id — the 'unassigned' roster. */
    unassignedUsers: AdminUser[]
    /** Flat id → node lookup for both location and cluster nodes (selection,
     *  breadcrumb resolution). */
    nodeById: Map<string, HierNode>
    /** cluster id → its parent cluster/location id, for breadcrumb walk-up. */
    parentById: Map<string, string>
}

function clusterSublabel(clinic: AdminClinic): string {
    return [clinic.location, clinic.uics.length > 0 ? clinic.uics.join(' · ') : null]
        .filter(Boolean)
        .join(' — ')
}

export function buildAdminHierarchy(
    locations: AdminLocation[],
    clinics: AdminClinic[],
    users: AdminUser[],
): AdminHierarchy {
    const clinicById = new Map(clinics.map(c => [c.id, c]))
    const locationById = new Map(locations.map(l => [l.id, l]))

    // user.clinic_id → users (home assignment only; loans handled at roster time)
    const usersByClinic = new Map<string, AdminUser[]>()
    const unassignedUsers: AdminUser[] = []
    for (const u of users) {
        if (u.clinic_id && clinicById.has(u.clinic_id)) {
            const arr = usersByClinic.get(u.clinic_id)
            if (arr) arr.push(u)
            else usersByClinic.set(u.clinic_id, [u])
        } else {
            unassignedUsers.push(u)
        }
    }

    // parent_clinic_id → child clinics (echelon edges). A clinic whose declared
    // parent is missing from the set is treated as a root (defensive).
    const childrenByParent = new Map<string, AdminClinic[]>()
    const rootClinics: AdminClinic[] = []
    for (const c of clinics) {
        if (c.parent_clinic_id && clinicById.has(c.parent_clinic_id)) {
            const arr = childrenByParent.get(c.parent_clinic_id)
            if (arr) arr.push(c)
            else childrenByParent.set(c.parent_clinic_id, [c])
        } else {
            rootClinics.push(c)
        }
    }

    const nodeById = new Map<string, HierNode>()
    const parentById = new Map<string, string>()

    // Recursively build a cluster subtree, registering parent links + counts.
    const buildCluster = (clinic: AdminClinic): ClusterNode => {
        const kids = (childrenByParent.get(clinic.id) ?? [])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(buildCluster)
        for (const k of kids) parentById.set(k.id, clinic.id)
        const directUserCount = usersByClinic.get(clinic.id)?.length ?? 0
        const totalUserCount = kids.reduce((s, k) => s + k.totalUserCount, directUserCount)
        const node: ClusterNode = {
            kind: 'cluster',
            id: clinic.id,
            label: clinic.name,
            sublabel: clusterSublabel(clinic),
            clinic,
            children: kids,
            directUserCount,
            totalUserCount,
        }
        nodeById.set(node.id, node)
        return node
    }

    // Group root clusters by their resolved installation (location_id).
    const rootsByLocation = new Map<string, ClusterNode[]>()
    const noLocationRoots: ClusterNode[] = []
    for (const clinic of rootClinics.slice().sort((a, b) => a.name.localeCompare(b.name))) {
        const node = buildCluster(clinic)
        const locId = clinic.location_id && locationById.has(clinic.location_id) ? clinic.location_id : null
        if (locId) {
            const arr = rootsByLocation.get(locId)
            if (arr) arr.push(node)
            else rootsByLocation.set(locId, [node])
        } else {
            noLocationRoots.push(node)
        }
    }

    const roots: LocationNode[] = []

    // Real locations, sorted by display name. Only those with clusters appear.
    const locIds = [...rootsByLocation.keys()].sort((a, b) => {
        const la = locationById.get(a)?.display_name ?? ''
        const lb = locationById.get(b)?.display_name ?? ''
        return la.localeCompare(lb)
    })
    for (const locId of locIds) {
        const loc = locationById.get(locId)!
        const children = rootsByLocation.get(locId)!
        const totalUserCount = children.reduce((s, c) => s + c.totalUserCount, 0)
        const node: LocationNode = {
            kind: 'location',
            id: locId,
            label: loc.display_name || loc.installation,
            sublabel: [loc.command, loc.country_code].filter(Boolean).join(' · '),
            location: loc,
            children,
            totalUserCount,
        }
        nodeById.set(node.id, node)
        for (const c of children) parentById.set(c.id, node.id)
        roots.push(node)
    }

    if (noLocationRoots.length > 0) {
        const node: LocationNode = {
            kind: 'no-location',
            id: NO_LOCATION_ID,
            label: 'No location',
            sublabel: 'Clusters without an installation',
            children: noLocationRoots,
            totalUserCount: noLocationRoots.reduce((s, c) => s + c.totalUserCount, 0),
        }
        nodeById.set(node.id, node)
        for (const c of noLocationRoots) parentById.set(c.id, node.id)
        roots.push(node)
    }

    if (unassignedUsers.length > 0) {
        const node: LocationNode = {
            kind: 'unassigned',
            id: UNASSIGNED_ID,
            label: 'Unassigned',
            sublabel: 'Users without a cluster',
            children: [],
            totalUserCount: unassignedUsers.length,
        }
        nodeById.set(node.id, node)
        roots.push(node)
    }

    return { roots, usersByClinic, unassignedUsers, nodeById, parentById }
}

/** Walk parentById from a node up to its root, returning ancestors-first crumbs
 *  (root … parent) NOT including the node itself. */
export function ancestryOf(id: string, h: AdminHierarchy): HierNode[] {
    const crumbs: HierNode[] = []
    let cur = h.parentById.get(id)
    while (cur) {
        const node = h.nodeById.get(cur)
        if (node) crumbs.unshift(node)
        cur = h.parentById.get(cur)
    }
    return crumbs
}
