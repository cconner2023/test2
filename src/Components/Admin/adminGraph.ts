/**
 * adminGraph.ts
 *
 * Pure containment model for the Admin "Map" tab. Turns the three flat admin
 * lists (users / clusters / locations) into a single navigable forest, grouped
 * geographically so the top tier is a handful of regions instead of ~100 flat
 * locations:
 *
 *     Country ⊃ Region(state/subdivision) ⊃ Location ⊃ Cluster ⊃ Cluster ⊃ User
 *
 * Country + Region are SYNTHETIC grouping nodes (no DB row) derived from each
 * location's country_code + subdivision — this is the "by region" lens chosen
 * for the map. The containment edges below them come straight from the schema:
 *   - clinic.location_id        → which location a cluster sits in
 *   - clinic.parent_clinic_id   → cluster command tree
 *   - user.clinic_id            → a user's home cluster
 *   - clinic.associated_clinic_ids / user.surrogate_clinic_id → the peer/loan
 *     web, surfaced as a secondary (dashed) link layer, not containment.
 *
 * location.parent_id is intentionally NOT used for nesting here — geography
 * (country/subdivision) is the grouping axis, and parent_id is near-empty in
 * practice. No React, no layout math here — AdminMap owns presentation. This
 * file only answers "what contains what" and "what links to what".
 */

import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'
import { findCountry, findSubdivisionName } from '../../lib/iso3166'

export type GraphNodeType = 'root' | 'country' | 'region' | 'location' | 'clinic' | 'user'

export interface GraphNode {
    id: string
    type: GraphNodeType
    label: string
    /** Secondary line (command, rank, location subtitle…). */
    sublabel: string | null
    /** Direct containment count — drives the badge + "drillable?" check. */
    childCount: number
    /** Back-reference to the source row (null for synthetic root/country/region). */
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
    userById: Map<string, AdminUser>
    /** location_id → clinics sitting directly in it (excludes child clinics) */
    clinicsByLocation: Map<string, AdminClinic[]>
    /** parent_clinic_id → child clinics */
    clinicsByParentClinic: Map<string, AdminClinic[]>
    /** clinic_id → home users */
    usersByClinic: Map<string, AdminUser[]>
    /** country_code → locations in that country */
    locationsByCountry: Map<string, AdminLocation[]>
    /** `${country}|${subdivision}` → locations in that region */
    locationsByRegion: Map<string, AdminLocation[]>
    /** ordered country codes present, by display name */
    countryCodes: string[]
}

export const ROOT_ID = '__root__'
const COUNTRY_PREFIX = 'country:'
const REGION_PREFIX = 'region:'
/** Bucket key for locations with no subdivision set. */
const NO_SUB = '~'

const countryId = (code: string) => `${COUNTRY_PREFIX}${code}`
const regionId = (code: string, sub: string) => `${REGION_PREFIX}${code}|${sub}`
const regionKey = (code: string, sub: string | null) => `${code}|${sub || NO_SUB}`

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
    const arr = map.get(key)
    if (arr) arr.push(value)
    else map.set(key, [value])
}

function countryLabel(code: string): string {
    return findCountry(code)?.name ?? (code || 'Unknown')
}

function regionLabel(code: string, sub: string): string {
    if (sub === NO_SUB) return 'Other'
    return findSubdivisionName(code, sub) ?? sub
}

export function buildGraphIndex(
    users: AdminUser[],
    clinics: AdminClinic[],
    locations: AdminLocation[],
): GraphIndex {
    const clinicById = new Map(clinics.map(c => [c.id, c]))
    const locationById = new Map(locations.map(l => [l.id, l]))
    const userById = new Map(users.map(u => [u.id, u]))
    const clinicsByLocation = new Map<string, AdminClinic[]>()
    const clinicsByParentClinic = new Map<string, AdminClinic[]>()
    const usersByClinic = new Map<string, AdminUser[]>()
    const locationsByCountry = new Map<string, AdminLocation[]>()
    const locationsByRegion = new Map<string, AdminLocation[]>()

    for (const l of locations) {
        const code = l.country_code || ''
        push(locationsByCountry, code, l)
        push(locationsByRegion, regionKey(code, l.subdivision), l)
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

    const countryCodes = [...locationsByCountry.keys()]
        .sort((a, b) => countryLabel(a).localeCompare(countryLabel(b)))

    return {
        users, clinics, locations,
        clinicById, locationById, userById,
        clinicsByLocation, clinicsByParentClinic, usersByClinic,
        locationsByCountry, locationsByRegion, countryCodes,
    }
}

// ── Node factories ────────────────────────────────────────────────────────

function countryNode(code: string, idx: GraphIndex): GraphNode {
    const locs = idx.locationsByCountry.get(code) ?? []
    const subs = new Set(locs.map(l => regionKey(code, l.subdivision)))
    return {
        id: countryId(code),
        type: 'country',
        label: countryLabel(code),
        sublabel: `${locs.length} location${locs.length !== 1 ? 's' : ''}`,
        childCount: subs.size,
        raw: null,
    }
}

function regionNode(code: string, sub: string, idx: GraphIndex): GraphNode {
    const locs = idx.locationsByRegion.get(`${code}|${sub}`) ?? []
    return {
        id: regionId(code, sub),
        type: 'region',
        label: regionLabel(code, sub),
        sublabel: countryLabel(code),
        childCount: locs.length,
        raw: null,
    }
}

function locationNode(l: AdminLocation, idx: GraphIndex): GraphNode {
    const childClinics = idx.clinicsByLocation.get(l.id)?.length ?? 0
    return {
        id: l.id,
        type: 'location',
        label: l.display_name || l.installation,
        sublabel: [l.sub_area, l.command].filter(Boolean).join(' · ') || null,
        childCount: childClinics,
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

// ── id parsing ────────────────────────────────────────────────────────────

function parseRegionId(id: string): { code: string; sub: string } | null {
    if (!id.startsWith(REGION_PREFIX)) return null
    const body = id.slice(REGION_PREFIX.length)
    const pipe = body.indexOf('|')
    if (pipe < 0) return null
    return { code: body.slice(0, pipe), sub: body.slice(pipe + 1) }
}

// ── Traversal ───────────────────────────────────────────────────────────────

/**
 * Children of `focusId` in containment order. `null`/ROOT_ID yields the top
 * ring: one node per country present + any clusters that float free of a
 * location.
 */
export function childrenOf(focusId: string | null, idx: GraphIndex): GraphNode[] {
    if (!focusId || focusId === ROOT_ID) {
        const countries = idx.countryCodes.map(code => countryNode(code, idx))
        const floatingClinics = idx.clinics
            .filter(c =>
                (!c.parent_clinic_id || !idx.clinicById.has(c.parent_clinic_id)) &&
                (!c.location_id || !idx.locationById.has(c.location_id)))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => clinicNode(c, idx))
        return [...countries, ...floatingClinics]
    }

    if (focusId.startsWith(COUNTRY_PREFIX)) {
        const code = focusId.slice(COUNTRY_PREFIX.length)
        const locs = idx.locationsByCountry.get(code) ?? []
        const subs = new Set(locs.map(l => l.subdivision || NO_SUB))
        return [...subs]
            .map(sub => regionNode(code, sub, idx))
            // real subdivisions A→Z, the "Other" bucket last
            .sort((a, b) => (a.label === 'Other' ? 1 : b.label === 'Other' ? -1 : a.label.localeCompare(b.label)))
    }

    const region = parseRegionId(focusId)
    if (region) {
        return (idx.locationsByRegion.get(`${region.code}|${region.sub}`) ?? [])
            .slice()
            .sort((a, b) => (a.display_name || a.installation).localeCompare(b.display_name || b.installation))
            .map(l => locationNode(l, idx))
    }

    if (idx.locationById.has(focusId)) {
        return (idx.clinicsByLocation.get(focusId) ?? [])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => clinicNode(c, idx))
    }

    if (idx.clinicById.has(focusId)) {
        const childClinics = (idx.clinicsByParentClinic.get(focusId) ?? [])
            .slice()
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
    if (focusId.startsWith(COUNTRY_PREFIX)) {
        const code = focusId.slice(COUNTRY_PREFIX.length)
        return idx.locationsByCountry.has(code) ? countryNode(code, idx) : null
    }
    const region = parseRegionId(focusId)
    if (region) {
        return idx.locationsByRegion.has(`${region.code}|${region.sub}`)
            ? regionNode(region.code, region.sub, idx)
            : null
    }
    const loc = idx.locationById.get(focusId)
    if (loc) return locationNode(loc, idx)
    const clinic = idx.clinicById.get(focusId)
    if (clinic) return clinicNode(clinic, idx)
    const user = idx.userById.get(focusId)
    if (user) return userNode(user)
    return null
}

/**
 * The id of `focusId`'s container, or null at root. Walks the synthetic
 * geography tiers (region → country → root) above the real schema edges.
 */
function parentIdOf(focusId: string, idx: GraphIndex): string | null {
    if (focusId.startsWith(COUNTRY_PREFIX)) return null
    const region = parseRegionId(focusId)
    if (region) return idx.locationsByCountry.has(region.code) ? countryId(region.code) : null

    const loc = idx.locationById.get(focusId)
    if (loc) return regionId(loc.country_code || '', loc.subdivision || NO_SUB)

    const clinic = idx.clinicById.get(focusId)
    if (clinic) {
        if (clinic.parent_clinic_id && idx.clinicById.has(clinic.parent_clinic_id)) return clinic.parent_clinic_id
        if (clinic.location_id && idx.locationById.has(clinic.location_id)) return clinic.location_id
        return null
    }
    const user = idx.userById.get(focusId)
    if (user) return user.clinic_id && idx.clinicById.has(user.clinic_id) ? user.clinic_id : null
    return null
}

/** Root→focus ancestry (exclusive of focus) for the breadcrumb. */
export function ancestryOf(focusId: string | null, idx: GraphIndex): GraphNode[] {
    if (!focusId || focusId === ROOT_ID) return []
    const chain: GraphNode[] = []
    const seen = new Set<string>()
    let cursor: string | null = parentIdOf(focusId, idx)
    let guard = 0
    while (cursor && guard++ < 64) {
        if (seen.has(cursor)) break
        seen.add(cursor)
        const node = nodeFor(cursor, idx)
        if (node) chain.push(node)
        cursor = parentIdOf(cursor, idx)
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
        const user = idx.userById.get(id)
        if (user?.surrogate_clinic_id && visibleIds.has(user.surrogate_clinic_id)) {
            links.push({ fromId: id, toId: user.surrogate_clinic_id, kind: 'loan' })
        }
    }
    return links
}
