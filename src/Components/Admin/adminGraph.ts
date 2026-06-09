/**
 * adminGraph.ts
 *
 * Pure containment model for the Admin "Map" tab. Turns the three flat admin
 * lists (users / clusters / locations) into a single navigable forest:
 *
 *     Location ⊃ Location ⊃ Cluster ⊃ Cluster ⊃ User
 *
 * Edges come straight from the schema — no new abstraction:
 *   - location.parent_id        → location tree
 *   - clinic.location_id        → which location a cluster sits in
 *   - clinic.parent_clinic_id   → cluster command tree
 *   - user.clinic_id            → a user's home cluster
 *   - clinic.associated_clinic_ids / user.surrogate_clinic_id → the peer/loan
 *     web, surfaced as a secondary (dashed) link layer, not containment.
 *
 * No React, no layout math here — AdminMap owns presentation. This file only
 * answers "what contains what" and "what links to what".
 */

import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'

export type GraphNodeType = 'root' | 'location' | 'clinic' | 'user'

export interface GraphNode {
    id: string
    type: GraphNodeType
    label: string
    /** Secondary line (command, rank, location subtitle…). */
    sublabel: string | null
    /** Direct containment count — drives the badge + "drillable?" check. */
    childCount: number
    /** Back-reference to the source row (null for the virtual root). */
    raw: AdminUser | AdminClinic | AdminLocation | null
}

/** A non-containment relationship drawn as a dashed link between two nodes. */
export interface GraphLink {
    fromId: string
    toId: string
    kind: 'association' | 'loan'
}

export interface GraphIndex {
    users: AdminUser[]
    clinics: AdminClinic[]
    locations: AdminLocation[]
    clinicById: Map<string, AdminClinic>
    locationById: Map<string, AdminLocation>
    /** location_id → clinics sitting directly in it */
    clinicsByLocation: Map<string, AdminClinic[]>
    /** parent_clinic_id → child clinics */
    clinicsByParentClinic: Map<string, AdminClinic[]>
    /** parent_id → child locations */
    locationsByParent: Map<string, AdminLocation[]>
    /** clinic_id → home users */
    usersByClinic: Map<string, AdminUser[]>
}

export const ROOT_ID = '__root__'

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
    const arr = map.get(key)
    if (arr) arr.push(value)
    else map.set(key, [value])
}

export function buildGraphIndex(
    users: AdminUser[],
    clinics: AdminClinic[],
    locations: AdminLocation[],
): GraphIndex {
    const clinicById = new Map(clinics.map(c => [c.id, c]))
    const locationById = new Map(locations.map(l => [l.id, l]))
    const clinicsByLocation = new Map<string, AdminClinic[]>()
    const clinicsByParentClinic = new Map<string, AdminClinic[]>()
    const locationsByParent = new Map<string, AdminLocation[]>()
    const usersByClinic = new Map<string, AdminUser[]>()

    for (const l of locations) {
        if (l.parent_id && locationById.has(l.parent_id)) push(locationsByParent, l.parent_id, l)
    }
    for (const c of clinics) {
        // A clinic nests under its parent clinic if that parent exists; otherwise
        // it surfaces under its location (or floats at root when neither holds).
        if (c.parent_clinic_id && clinicById.has(c.parent_clinic_id)) {
            push(clinicsByParentClinic, c.parent_clinic_id, c)
        } else if (c.location_id && locationById.has(c.location_id)) {
            push(clinicsByLocation, c.location_id, c)
        }
    }
    for (const u of users) {
        if (u.clinic_id && clinicById.has(u.clinic_id)) push(usersByClinic, u.clinic_id, u)
    }

    return {
        users, clinics, locations,
        clinicById, locationById,
        clinicsByLocation, clinicsByParentClinic, locationsByParent, usersByClinic,
    }
}

// ── Node factories ────────────────────────────────────────────────────────

function locationNode(l: AdminLocation, idx: GraphIndex): GraphNode {
    const childLocs = idx.locationsByParent.get(l.id)?.length ?? 0
    const childClinics = idx.clinicsByLocation.get(l.id)?.length ?? 0
    return {
        id: l.id,
        type: 'location',
        label: l.display_name || l.installation,
        sublabel: [l.sub_area, l.command].filter(Boolean).join(' · ') || null,
        childCount: childLocs + childClinics,
        raw: l,
    }
}

function clinicNode(c: AdminClinic, idx: GraphIndex): GraphNode {
    const childClinics = idx.clinicsByParentClinic.get(c.id)?.length ?? 0
    const childUsers = idx.usersByClinic.get(c.id)?.length ?? 0
    return {
        id: c.id,
        type: 'clinic',
        label: c.name,
        sublabel: [c.location, c.uics[0]].filter(Boolean).join(' · ') || null,
        childCount: childClinics + childUsers,
        raw: c,
    }
}

function userNode(u: AdminUser): GraphNode {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'User'
    return {
        id: u.id,
        type: 'user',
        label: [u.rank, name].filter(Boolean).join(' '),
        sublabel: [u.credential, u.uic].filter(Boolean).join(' · ') || null,
        childCount: 0,
        raw: u,
    }
}

// ── Traversal ───────────────────────────────────────────────────────────────

/**
 * Children of `focusId` in containment order. `null`/ROOT_ID yields the top
 * ring: root locations + any clusters that float free of a location.
 */
export function childrenOf(focusId: string | null, idx: GraphIndex): GraphNode[] {
    if (!focusId || focusId === ROOT_ID) {
        const rootLocations = idx.locations
            .filter(l => !l.parent_id || !idx.locationById.has(l.parent_id))
            .sort((a, b) => a.display_name.localeCompare(b.display_name))
            .map(l => locationNode(l, idx))
        const floatingClinics = idx.clinics
            .filter(c =>
                (!c.parent_clinic_id || !idx.clinicById.has(c.parent_clinic_id)) &&
                (!c.location_id || !idx.locationById.has(c.location_id)))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => clinicNode(c, idx))
        return [...rootLocations, ...floatingClinics]
    }

    if (idx.locationById.has(focusId)) {
        const childLocs = (idx.locationsByParent.get(focusId) ?? [])
            .sort((a, b) => a.display_name.localeCompare(b.display_name))
            .map(l => locationNode(l, idx))
        const childClinics = (idx.clinicsByLocation.get(focusId) ?? [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => clinicNode(c, idx))
        return [...childLocs, ...childClinics]
    }

    if (idx.clinicById.has(focusId)) {
        const childClinics = (idx.clinicsByParentClinic.get(focusId) ?? [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => clinicNode(c, idx))
        const users = (idx.usersByClinic.get(focusId) ?? [])
            .map(userNode)
            .sort((a, b) => a.label.localeCompare(b.label))
        return [...childClinics, ...users]
    }

    return []
}

/** The focus node itself (null for the virtual root). */
export function nodeFor(focusId: string | null, idx: GraphIndex): GraphNode | null {
    if (!focusId || focusId === ROOT_ID) return null
    const loc = idx.locationById.get(focusId)
    if (loc) return locationNode(loc, idx)
    const clinic = idx.clinicById.get(focusId)
    if (clinic) return clinicNode(clinic, idx)
    const user = idx.users.find(u => u.id === focusId)
    if (user) return userNode(user)
    return null
}

/** Root→focus ancestry (exclusive of focus) for the breadcrumb. */
export function ancestryOf(focusId: string | null, idx: GraphIndex): GraphNode[] {
    if (!focusId || focusId === ROOT_ID) return []
    const chain: GraphNode[] = []
    const seen = new Set<string>()
    let cursor: string | null = focusId
    let guard = 0
    while (cursor && guard++ < 64) {
        if (seen.has(cursor)) break
        seen.add(cursor)
        const clinic = idx.clinicById.get(cursor)
        if (clinic) {
            const next: string | null =
                (clinic.parent_clinic_id && idx.clinicById.has(clinic.parent_clinic_id)) ? clinic.parent_clinic_id
                : (clinic.location_id && idx.locationById.has(clinic.location_id)) ? clinic.location_id
                : null
            if (next) chain.push(nodeFor(next, idx)!)
            cursor = next
            continue
        }
        const loc = idx.locationById.get(cursor)
        if (loc) {
            const next = (loc.parent_id && idx.locationById.has(loc.parent_id)) ? loc.parent_id : null
            if (next) chain.push(nodeFor(next, idx)!)
            cursor = next
            continue
        }
        const user = idx.users.find(u => u.id === cursor)
        if (user) {
            const next = (user.clinic_id && idx.clinicById.has(user.clinic_id)) ? user.clinic_id : null
            if (next) chain.push(nodeFor(next, idx)!)
            cursor = next
            continue
        }
        break
    }
    return chain.reverse()
}

/**
 * Dashed links among the currently-visible node ids: cluster↔cluster peer
 * associations and user→loan-cluster. Only links whose BOTH endpoints are on
 * screen are returned, so the layer never points off into nothing.
 */
export function linksAmong(visibleIds: Set<string>, idx: GraphIndex): GraphLink[] {
    const links: GraphLink[] = []
    const seen = new Set<string>()
    for (const id of visibleIds) {
        const clinic = idx.clinicById.get(id)
        if (clinic) {
            for (const peer of clinic.associated_clinic_ids) {
                if (!visibleIds.has(peer)) continue
                const key = [id, peer].sort().join('|')
                if (seen.has(key)) continue
                seen.add(key)
                links.push({ fromId: id, toId: peer, kind: 'association' })
            }
        }
        const user = idx.users.find(u => u.id === id)
        if (user?.surrogate_clinic_id && visibleIds.has(user.surrogate_clinic_id)) {
            links.push({ fromId: id, toId: user.surrogate_clinic_id, kind: 'loan' })
        }
    }
    return links
}
