/**
 * Tracking Board model — pure helpers over real data (no store, no vault).
 *
 * Echelon rules (2026-11-01 / 02):
 *  - ONE shared entry per patient visit = a hidden calendar event carrying
 *    tracking_data (Types/TrackingTypes.ts), fanned to origin + every ancestor
 *    (tracking_clinic_chain). Visibility therefore = origin + ancestors: an
 *    entry reaches a board only when the viewer is its origin or above it.
 *  - STATIONS ARE MAP PINS. A waypoint with `tracking: true` (pin editor →
 *    "Add to tracking board") is a station; AXPs, CCPs, tents — all just pins.
 *    Only the overlay's own cluster edits / removes the pin (on the map). Other
 *    related clusters toggle it onto their board in board settings →
 *    `tracking_clinic_ids`. Overlays reach related clusters via target_clinic_ids.
 *  - A position is a pin ref { overlay_id, feature_id } or null = UNASSIGNED.
 *    A board lists each station once, under the first cluster using it.
 *  - Entries hold pin refs only → renames show up everywhere; a removed pin (or
 *    one no longer a station) resolves AT READ TIME to Pending
 *    (resolvePlaces). Events are never rewritten for it.
 *  - In transit is NOT a station: a marker on the entry, superseded by the
 *    next move.
 *  - Status is derived from the last move: Pending (no station), in process (at
 *    a station), Complete (dispositioned — a move flagged `complete`, so it
 *    union-merges like any other and any later move reopens the entry).
 *  - Leaves the board ONLY by expire, delete, or max cap — Complete stays on it.
 *  - Duplicate BRN → newest check-in wins (older entry removed at check-in,
 *    collapsed at read elsewhere).
 */

import type { LinkedFeatureRef } from '../../Types/MissionTypes'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import type { LocalMapOverlay, OverlayFeature } from '../../Types/MapOverlayTypes'
import {
  TRACKING_MAX_ENTRIES, isTrackingExpired,
  type TrackingData, type TrackingMove, type TrackingTransit, type TrackingComment, type TrackingPosition,
} from '../../Types/TrackingTypes'

export type { TrackingMove, TrackingTransit, TrackingComment, TrackingPosition } from '../../Types/TrackingTypes'

// ── Shapes ──

export interface TrackingCluster {
  id: string
  /** Nickname-style working name (clusterLabel). */
  label: string
  uic: string
  /** 1 = lowest echelon in the known tree (Role I) … Orders groups along the patient flow. */
  echelon: number
  parentId: string | null
}

/** A station — a tracking pin, flattened. */
export interface TrackingPlace {
  overlayId: string
  featureId: string
  label: string
  /** The overlay's cluster — the only one that edits / removes the pin. */
  clinicId: string
  /** Clusters showing it on their board. */
  targetClinicIds: string[]
}

/** Board view of one entry (derived from its calendar event). */
export interface TrackingEntry {
  id: string
  brn: string
  /** Cluster that checked the patient in — drives visibility. */
  originClinicId: string
  checkedInAt: number
  /** Oldest first. Empty = Pending. */
  moves: TrackingMove[]
  /** Live (non-deleted) comments, oldest first. */
  comments: TrackingComment[]
  /** Only while newer than the last move. */
  transit: TrackingTransit | null
}

export interface TrackingNetwork {
  clusters: TrackingCluster[]
  /** Every tracking pin the viewer's device knows (own + related clusters'). */
  places: TrackingPlace[]
}

// ── Derivation ──

/** Raw cluster rows (tracking_cluster_tree) → clusters with echelon by tree height. */
export function buildClusters(rows: { id: string; label: string; uic: string; parentId: string | null }[]): TrackingCluster[] {
  const byId = new Map(rows.map(r => [r.id, r]))
  const depth = (id: string): number => {
    let d = 0
    const seen = new Set<string>()
    let cur = byId.get(id)
    while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id); d++; cur = byId.get(cur.parentId)
    }
    return d
  }
  const depths = new Map(rows.map(r => [r.id, depth(r.id)]))
  const max = Math.max(0, ...depths.values())
  return rows.map(r => ({ ...r, echelon: max - (depths.get(r.id) ?? 0) + 1 }))
}

/** Tracking pins → stations. Unset tracking_clinic_ids = the overlay's cluster only. */
export const derivePlaces = (overlays: LocalMapOverlay[]): TrackingPlace[] =>
  overlays.flatMap(o => o.features
    .filter(f => f.tracking && f.type === 'waypoint')
    .map(f => ({
      overlayId: o.id,
      featureId: f.id,
      label: f.label || 'Station',
      clinicId: o.clinic_id,
      targetClinicIds: f.tracking_clinic_ids ?? [o.clinic_id],
    })))

/** Calendar event → board entry. Soft-deleted comments and stale transit dropped. */
export function toEntry(ev: CalendarEvent): TrackingEntry | null {
  const d = ev.tracking_data
  if (!d) return null
  const moves = [...(d.moves ?? [])].sort((a, b) => a.at - b.at)
  const lastAt = moves[moves.length - 1]?.at ?? 0
  return {
    id: ev.id,
    brn: d.brn,
    originClinicId: ev.clinic_id,
    checkedInAt: d.checked_in_at,
    moves,
    comments: (d.comments ?? []).filter(c => !c.deleted),
    transit: d.transit && d.transit.at >= lastAt ? d.transit : null,
  }
}

// ── Tree helpers ──

export const clusterById = (clusters: TrackingCluster[], id: string) => clusters.find(c => c.id === id)

/** `id` + every ancestor, nearest first. */
export function ancestorChain(clusters: TrackingCluster[], id: string): string[] {
  const out: string[] = []
  let cur = clusterById(clusters, id)
  if (!cur) return [id]
  while (cur && !out.includes(cur.id)) {
    out.push(cur.id)
    cur = cur.parentId ? clusterById(clusters, cur.parentId) : undefined
  }
  return out
}

/** `id` + every descendant. */
export function subtree(clusters: TrackingCluster[], id: string): Set<string> {
  const out = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const c of clusters) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true }
    }
  }
  return out
}

/** Clusters whose stations `id` knows about: ancestors, descendants, siblings. */
export function relatedClusters(clusters: TrackingCluster[], id: string): Set<string> {
  const out = new Set([...ancestorChain(clusters, id), ...subtree(clusters, id)])
  const parent = clusterById(clusters, id)?.parentId
  if (parent) for (const c of clusters) if (c.parentId === parent) out.add(c.id)
  return out
}

// ── Place helpers ──

/** Stable key for a position — `pl:<feature id>` or `pending`. */
export const placeKey = (p: TrackingPosition) => (p ? `pl:${p.feature_id}` : 'pending')
export const samePlace = (a: TrackingPosition, b: TrackingPosition) => placeKey(a) === placeKey(b)
export const refOf = (p: TrackingPlace): LinkedFeatureRef => ({ overlay_id: p.overlayId, feature_id: p.featureId })

export const placeByRef = (net: TrackingNetwork, ref: LinkedFeatureRef) =>
  net.places.find(p => p.featureId === ref.feature_id && p.overlayId === ref.overlay_id)

/** Stations a cluster shows on its board, in network order. */
export const placesOf = (net: TrackingNetwork, clinicId: string) =>
  net.places.filter(p => p.targetClinicIds.includes(clinicId))

/** Stations a cluster can toggle in board settings — its own pins plus related clusters'. */
export const knownPlaces = (net: TrackingNetwork, clinicId: string) => {
  const related = relatedClusters(net.clusters, clinicId)
  return net.places.filter(p => related.has(p.clinicId))
}

// ── Position helpers ──

const lastMove = (e: TrackingEntry) => e.moves[e.moves.length - 1] as TrackingMove | undefined

export const positionOf = (e: TrackingEntry): TrackingPosition => lastMove(e)?.to ?? null

export const sinceAt = (e: TrackingEntry) => lastMove(e)?.at ?? e.checkedInAt

export const isComplete = (e: TrackingEntry) => !!lastMove(e)?.complete
/** Waiting for a station — null position, not dispositioned. */
export const isPending = (e: TrackingEntry) => positionOf(e) === null && !isComplete(e)


/** Short name — station label / Pending. */
export function stationLabel(net: TrackingNetwork, p: TrackingPosition): string {
  return p ? placeByRef(net, p)?.label ?? 'Station' : 'Pending'
}

/** Where the entry reads as being — station label / Pending / Complete. */
export const placeLabel = (net: TrackingNetwork, e: TrackingEntry) =>
  isComplete(e) ? 'Complete' : stationLabel(net, positionOf(e))

/** Transit destination label — the station name alone. */
export const destinationLabel = (net: TrackingNetwork, p: LinkedFeatureRef) => stationLabel(net, p)

export const originUic = (clusters: TrackingCluster[], e: TrackingEntry) => clusterById(clusters, e.originClinicId)?.uic ?? ''

// ── Board composition ──

/** Newest check-in per BRN wins. */
export function dedupeByBrn(entries: TrackingEntry[]): TrackingEntry[] {
  const best = new Map<string, TrackingEntry>()
  for (const e of entries) {
    const cur = best.get(e.brn)
    if (!cur || e.checkedInAt > cur.checkedInAt) best.set(e.brn, e)
  }
  return entries.filter(e => best.get(e.brn) === e)
}

/**
 * Read-time resolution — a move onto a pin that's gone (or no longer a
 * station) reads as Pending; a transit marker pointing at one is dropped.
 */
export function resolvePlaces(e: TrackingEntry, net: TrackingNetwork): TrackingEntry {
  const live = (p: TrackingPosition) => !p || !!placeByRef(net, p)
  if (e.moves.every(m => live(m.to)) && (!e.transit || live(e.transit.to))) return e
  return {
    ...e,
    moves: e.moves.map(m => (live(m.to) ? m : { ...m, to: null })),
    transit: e.transit && live(e.transit.to) ? e.transit : null,
  }
}

/**
 * What a viewer's board holds: events fanned to the viewer (origin + ancestors)
 * → not expired → duplicate BRNs collapsed to the newest → capped to the newest
 * check-ins → gone stations resolved to Pending. Complete entries sink below
 * the open ones.
 */
export function boardEntries(events: CalendarEvent[], net: TrackingNetwork, viewerId: string, now: number): TrackingEntry[] {
  const live = events
    .filter(ev => ev.tracking_data && !isTrackingExpired(ev.tracking_data, now)
      && (ev.clinic_id === viewerId || (ev.target_clinic_ids?.includes(viewerId) ?? false)))
    .map(toEntry)
    .filter((e): e is TrackingEntry => !!e)
  const board = dedupeByBrn(live)
    .map(e => resolvePlaces(e, net))
    .sort((a, b) => b.checkedInAt - a.checkedInAt)
    .slice(0, TRACKING_MAX_ENTRIES)
  return [...board.filter(e => !isComplete(e)), ...board.filter(isComplete)]
}

export interface BoardPlace {
  pos: LinkedFeatureRef
  label: string
}

/** A column group: one cluster's stations. Pending sits outside every group. */
export interface BoardGroupDef {
  cluster: TrackingCluster
  places: BoardPlace[]
}

/**
 * Groups along the patient flow (Role I → Role III). A shared station appears
 * ONCE — under the first listed cluster showing it. Clusters with no stations
 * left are dropped.
 */
function buildGroups(net: TrackingNetwork, clusterIds: Set<string>): BoardGroupDef[] {
  const placed = new Set<string>()
  return net.clusters
    .filter(c => clusterIds.has(c.id))
    .sort((a, b) => a.echelon - b.echelon || a.label.localeCompare(b.label))
    .map(c => {
      const own = placesOf(net, c.id).filter(p => !placed.has(p.featureId))
      own.forEach(p => placed.add(p.featureId))
      return { cluster: c, places: own.map(p => ({ pos: refOf(p), label: p.label })) }
    })
    .filter(g => g.places.length > 0)
}

/**
 * A viewer's board: its subtree's clusters, plus the pin's cluster for any
 * entry sitting at a station nobody on the board shows (moved above the viewer).
 */
export function boardLayout(net: TrackingNetwork, viewerId: string, entries: TrackingEntry[]): BoardGroupDef[] {
  const clusterIds = subtree(net.clusters, viewerId)
  for (const e of entries) {
    const p = positionOf(e)
    const pl = p && placeByRef(net, p)
    if (pl && !pl.targetClinicIds.some(id => clusterIds.has(id))) clusterIds.add(pl.targetClinicIds.includes(pl.clinicId) ? pl.clinicId : pl.targetClinicIds[0])
  }
  return buildGroups(net, clusterIds)
}

/** Stations an entry may move to: what its origin's chain shows, lowest echelon first. */
export const moveTargets = (net: TrackingNetwork, e: TrackingEntry): BoardGroupDef[] =>
  buildGroups(net, new Set(ancestorChain(net.clusters, e.originClinicId)))

// ── Writes (mutators over TrackingData — useTrackingWrite.updateEntry) ──

const newId = () => crypto.randomUUID()

/** Fresh entry data for a check-in. */
export const newTrackingData = (brn: string, at: number): TrackingData =>
  ({ brn, brn_at: at, checked_in_at: at, moves: [], comments: [], transit: null, transit_at: at })

/** Where a move can land: a position, or Complete. */
export const COMPLETE = 'complete' as const
export type TrackingTarget = TrackingPosition | typeof COMPLETE

/** Add a move; supersedes any transit marker. Unchanged position = no-op. */
export function moveData(d: TrackingData, target: TrackingTarget, by: string, at: number): TrackingData {
  const last = [...d.moves].sort((a, b) => a.at - b.at)[d.moves.length - 1]
  const complete = target === COMPLETE
  const to = complete ? null : target
  if (!!last?.complete === complete && samePlace(last?.to ?? null, to)) return d
  return { ...d, transit: null, transit_at: at, moves: [...d.moves, { id: newId(), to, at, by, ...(complete ? { complete } : {}) }] }
}

/** Set (or clear, null) the "leaving → destination station" marker. */
export const transitData = (d: TrackingData, to: LinkedFeatureRef | null, by: string, at: number): TrackingData =>
  ({ ...d, transit: to ? { to, by, at } : null, transit_at: at })

/** Draft the drawer owns — the Save pill lives in the surface header. */
export interface TrackingEditDraft {
  brn: string
  /** Existing comments by id; cleared text = removed on save. */
  comments: { id: string; text: string }[]
  /** New comment appended on save (blank = none). */
  newComment: string
}

/** Apply a saved draft. Removed comments are soft-deleted so the merge keeps them gone. */
export function draftData(d: TrackingData, draft: TrackingEditDraft, by: string, at: number): TrackingData {
  const byId = new Map(draft.comments.map(c => [c.id, c.text.trim()]))
  const added = draft.newComment.trim()
  return {
    ...d,
    ...(draft.brn !== d.brn ? { brn: draft.brn, brn_at: at } : {}),
    comments: [
      ...d.comments.map(c => {
        if (c.deleted || !byId.has(c.id)) return c
        const text = byId.get(c.id)!
        if (!text) return { ...c, deleted: true, editedAt: at, editedBy: by }
        return text === c.text ? c : { ...c, text, editedAt: at, editedBy: by }
      }),
      ...(added ? [{ id: newId(), text: added, by, at }] : []),
    ],
  }
}

/**
 * Board settings toggle — show / hide a station on `clinicId`'s board. Returns
 * the edited pin for useMapOverlayWrite.upsertFeature (fans to the overlay's targets).
 */
export function toggledFeature(f: OverlayFeature, ownerClinicId: string, clinicId: string): OverlayFeature {
  const cur = f.tracking_clinic_ids ?? [ownerClinicId]
  return {
    ...f,
    tracking_clinic_ids: cur.includes(clinicId) ? cur.filter(c => c !== clinicId) : [...cur, clinicId],
    updated_at: new Date().toISOString(),
  }
}
