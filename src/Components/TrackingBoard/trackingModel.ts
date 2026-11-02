/**
 * Tracking Board model — MOCK echelon data + pure helpers (no store, no vault).
 *
 * Echelon rules (2026-11-01 / 02):
 *  - ONE shared entry per patient visit, synced across the chain like a loaned
 *    calendar event. Real path: target_clinic_ids = origin + every ancestor
 *    (clinics.parent_clinic_id chain — child_clinic_ids is not the source).
 *  - Visibility = origin + ancestors: a viewer sees an entry when its ORIGIN
 *    cluster is the viewer or one of the viewer's descendants. Role I sees only
 *    its own patients; Role II its own + below; Role III everything. Where the
 *    patient currently sits never widens that.
 *  - STATIONS ARE MAP PINS. A waypoint with `tracking: true` (map pin editor →
 *    "Add to tracking board") is a station; AXPs, CCPs, tents — all just pins.
 *    Only the overlay's own cluster edits / removes the pin (on the map). Other
 *    related clusters (up / down the chain, siblings) toggle it onto their
 *    board in board settings → `tracking_clinic_ids` (same physical spot, no
 *    duplicate). Real path: the overlay's E2E payload, overlays fanned to
 *    related clusters via target_clinic_ids. No server table.
 *  - A position is a pin reference { overlay_id, feature_id } (the calendar's
 *    LinkedFeatureRef shape) or null = UNASSIGNED — the lack of a station, not
 *    a pin. A board lists each station once, under the first cluster using it.
 *  - Entries hold pin refs only → renames show up everywhere; a removed pin (or
 *    one no longer marked a station) resolves AT READ TIME to Unassigned
 *    (resolvePlaces). Events are never rewritten for it.
 *  - In transit is NOT a station: it's a marker on the entry (`transit`) — the
 *    patient stays where they are, flagged "leaving → destination station",
 *    until a move lands them (any move clears it).
 *  - Leaves the board ONLY by expire, delete, or max cap.
 *  - Duplicate BRN → newest check-in wins (older entry reset/removed).
 */

import type { LinkedFeatureRef } from '../../Types/MissionTypes'

// ── Shapes ──

export interface TrackingCluster {
  id: string
  /** Nickname-style working name (real path: clusterLabel). */
  label: string
  uic: string
  /** 1 = Role I … 3 = Role III. Orders groups along the patient flow. */
  echelon: number
  parentId: string | null
}

/** The slice of a map overlay the board needs (real path: useMapOverlaysStore). */
export interface MockOverlay {
  id: string
  clinic_id: string
  pins: { id: string; label: string; tracking?: boolean; tracking_clinic_ids?: string[] }[]
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

/** Pin ref, or null = Unassigned. */
export type TrackingPosition = LinkedFeatureRef | null

export interface TrackingMove {
  id: string
  to: TrackingPosition
  at: number // epoch ms
}

/** "Leaving → destination station" marker. Cleared by the next move. */
export interface TrackingTransit {
  to: LinkedFeatureRef
  at: number
  by: string
}

export interface MockComment {
  id: string
  text: string
  /** Author display name, stamped at write (rank + last name). */
  by: string
  at: number // epoch ms
  /** Set on edit — last-write-wins; `editedBy` = whoever wrote last. */
  editedAt?: number
  editedBy?: string
}

export interface MockEntry {
  id: string
  brn: string
  /** Cluster that checked the patient in — drives visibility. */
  originClinicId: string
  checkedInAt: number
  /** Empty = Unassigned. Append-only (union-merge by id on sync). */
  moves: TrackingMove[]
  /** Oldest first. Union-merge by id on sync. */
  comments: MockComment[]
  transit?: TrackingTransit | null
}

export interface TrackingNetwork {
  clusters: TrackingCluster[]
  /** Every tracking pin the viewer's device knows (own + related clusters'). */
  places: TrackingPlace[]
}

// ── Board limits (placeholders until settled) ──

/** Entry drops off every board this long after check-in. */
export const TRACKING_EXPIRE_MS = 72 * 60 * 60 * 1000
/** Max entries a board shows — newest check-ins kept. */
export const TRACKING_MAX_ENTRIES = 200

// ── Mock network: Role III ← Role II ← two Role Is, one overlay each ──

export const MOCK_CLUSTERS: TrackingCluster[] = [
  { id: 'r3', label: 'CSH', uic: 'WFG3H0', echelon: 3, parentId: null },
  { id: 'r2', label: 'Role II FSMC', uic: 'WCD2E0', echelon: 2, parentId: 'r3' },
  { id: 'r1n', label: 'BAS North', uic: 'WAB1C0', echelon: 1, parentId: 'r2' },
  { id: 'r1s', label: 'BAS South', uic: 'WAB2C0', echelon: 1, parentId: 'r2' },
]

export const MOCK_OVERLAYS: MockOverlay[] = [
  {
    id: 'ov-n', clinic_id: 'r1n', pins: [
      { id: 'n-checkin', label: 'Check-in', tracking: true },
      // One Triage tent — BAS South toggled it on.
      { id: 'n-triage', label: 'Triage', tracking: true, tracking_clinic_ids: ['r1n', 'r1s'] },
      { id: 'n-treat', label: 'Treatment', tracking: true },
      // AXP — just a pin. Role II toggled it on.
      { id: 'axp-copper', label: 'AXP Copper', tracking: true, tracking_clinic_ids: ['r1n', 'r2'] },
      { id: 'n-rally', label: 'Rally point' }, // plain pin, not a station
    ],
  },
  {
    id: 'ov-s', clinic_id: 'r1s', pins: [
      // Duplicate name, BAS North hasn't toggled it on.
      { id: 's-checkin', label: 'Check-in', tracking: true },
      { id: 's-treat', label: 'Treatment', tracking: true },
      { id: 'axp-iron', label: 'AXP Iron', tracking: true, tracking_clinic_ids: ['r1s', 'r2'] },
    ],
  },
  {
    id: 'ov-2', clinic_id: 'r2', pins: [
      { id: '2-triage', label: 'Triage', tracking: true },
      { id: '2-surgery', label: 'Surgery', tracking: true },
      { id: '2-hold', label: 'Hold', tracking: true },
    ],
  },
  {
    id: 'ov-3', clinic_id: 'r3', pins: [
      { id: '3-er', label: 'ER', tracking: true },
      { id: '3-or', label: 'OR', tracking: true },
      { id: '3-icu', label: 'ICU', tracking: true },
      { id: '3-ward', label: 'Ward', tracking: true },
    ],
  },
]

/** Tracking pins → stations. Unset tracking_clinic_ids = the overlay's cluster only. */
export const derivePlaces = (overlays: MockOverlay[]): TrackingPlace[] =>
  overlays.flatMap(o => o.pins
    .filter(p => p.tracking)
    .map(p => ({ overlayId: o.id, featureId: p.id, label: p.label, clinicId: o.clinic_id, targetClinicIds: p.tracking_clinic_ids ?? [o.clinic_id] })))

export const DEFAULT_VIEWER_ID = 'r2'

const MIN = 60 * 1000

/** Pin ref for a mock station (feature ids are unique across the mock overlays). */
const pin = (featureId: string): LinkedFeatureRef => {
  const o = MOCK_OVERLAYS.find(ov => ov.pins.some(p => p.id === featureId))
  return { overlay_id: o?.id ?? '', feature_id: featureId }
}

/** Mock entries anchored to "now". Includes one duplicated BRN (older loses). */
export function buildMockEntries(now: number): MockEntry[] {
  const ago = (m: number) => now - m * MIN
  let n = 0
  const mv = (to: TrackingPosition, m: number): TrackingMove => ({ id: `m${++n}`, to, at: ago(m) })
  return [
    { id: 'e1', brn: 'AB1234', originClinicId: 'r1n', checkedInAt: ago(3), moves: [], comments: [] },
    { id: 'e2', brn: 'CD5678', originClinicId: 'r1n', checkedInAt: ago(190), moves: [mv(pin('n-checkin'), 188), mv(pin('n-triage'), 175), mv(pin('n-treat'), 160), mv(pin('axp-copper'), 135), mv(pin('2-triage'), 120), mv(pin('2-surgery'), 95), mv(pin('3-er'), 20)], comments: [{ id: 'c1', text: 'GSW L thigh, TQ 1405', by: 'SGT Doe', at: ago(185) }] },
    { id: 'e3', brn: 'EF9012', originClinicId: 'r1s', checkedInAt: ago(72), moves: [mv(pin('s-checkin'), 70), mv(pin('s-treat'), 60), mv(pin('axp-iron'), 25)], comments: [{ id: 'c2', text: 'Awaiting x-ray read', by: 'SPC Roe', at: ago(30) }], transit: { to: pin('2-triage'), at: ago(4), by: 'SPC Roe' } },
    { id: 'e4', brn: 'GH3456', originClinicId: 'r2', checkedInAt: ago(41), moves: [mv(pin('2-triage'), 40), mv(pin('2-hold'), 28)], comments: [] },
    // Two clusters' patients in the one shared Triage.
    { id: 'e5', brn: 'JK7890', originClinicId: 'r1s', checkedInAt: ago(23), moves: [mv(pin('s-checkin'), 22), mv(pin('n-triage'), 12)], comments: [] },
    { id: 'e9', brn: 'QR4680', originClinicId: 'r1n', checkedInAt: ago(15), moves: [mv(pin('n-checkin'), 14), mv(pin('n-triage'), 10)], comments: [] },
    { id: 'e6', brn: 'LM2468', originClinicId: 'r3', checkedInAt: ago(7), moves: [mv(pin('3-er'), 6)], comments: [] },
    { id: 'e7', brn: 'NP1357', originClinicId: 'r1n', checkedInAt: ago(9), moves: [mv(pin('n-treat'), 8)], comments: [], transit: { to: pin('axp-copper'), at: ago(2), by: 'SGT Doe' } },
    // Duplicate BRN — the older visit is superseded by e7's newer check-in.
    { id: 'e8', brn: 'NP1357', originClinicId: 'r1s', checkedInAt: ago(300), moves: [mv(pin('s-treat'), 290)], comments: [] },
  ]
}

// ── Tree helpers (real path: parent_clinic_id chain RPC + cluster directory) ──

export const clusterById = (clusters: TrackingCluster[], id: string) => clusters.find(c => c.id === id)

/** `id` + every ancestor, nearest first. */
export function ancestorChain(clusters: TrackingCluster[], id: string): string[] {
  const out: string[] = []
  let cur = clusterById(clusters, id)
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

/** Clusters whose stations `id` knows about: ancestors, descendants and
 *  siblings (same parent). Real path: overlays fanned across this set. */
export function relatedClusters(clusters: TrackingCluster[], id: string): Set<string> {
  const out = new Set([...ancestorChain(clusters, id), ...subtree(clusters, id)])
  const parent = clusterById(clusters, id)?.parentId
  if (parent) for (const c of clusters) if (c.parentId === parent) out.add(c.id)
  return out
}

// ── Place helpers ──

/** Stable key for a position — `pl:<feature id>` or `unassigned`. */
export const placeKey = (p: TrackingPosition) => (p ? `pl:${p.feature_id}` : 'unassigned')
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

const lastMove = (e: MockEntry) => e.moves[e.moves.length - 1] as TrackingMove | undefined

export const positionOf = (e: MockEntry): TrackingPosition => lastMove(e)?.to ?? null

export const sinceAt = (e: MockEntry) => lastMove(e)?.at ?? e.checkedInAt

const clusterName = (net: TrackingNetwork, id: string) => clusterById(net.clusters, id)?.label ?? id

/** Short name — station label / Unassigned. */
export function stationLabel(net: TrackingNetwork, p: TrackingPosition): string {
  return p ? placeByRef(net, p)?.label ?? 'Station' : 'Unassigned'
}

/** Full name for a footer / detail. Bare when the viewer shows the station
 *  (or for Unassigned); otherwise prefixed with the pin's cluster. */
export function placeLabel(net: TrackingNetwork, p: TrackingPosition, viewerId?: string): string {
  const name = stationLabel(net, p)
  if (!p) return name
  const pl = placeByRef(net, p)
  if (!pl || (viewerId && pl.targetClinicIds.includes(viewerId))) return name
  return `${clusterName(net, pl.clinicId)} · ${name}`
}

/** Transit destination label. */
export const destinationLabel = (net: TrackingNetwork, p: LinkedFeatureRef) => placeLabel(net, p)

/** Detail sub-line: the clusters showing the station. */
export function placeOwnerLabel(net: TrackingNetwork, p: TrackingPosition): string {
  if (!p) return ''
  const pl = placeByRef(net, p)
  return pl ? pl.targetClinicIds.map(id => clusterName(net, id)).join(' · ') : ''
}

export const originUic = (clusters: TrackingCluster[], e: MockEntry) => clusterById(clusters, e.originClinicId)?.uic ?? ''

// ── Board composition ──

/** Newest check-in per BRN wins. */
export function dedupeByBrn(entries: MockEntry[]): MockEntry[] {
  const best = new Map<string, MockEntry>()
  for (const e of entries) {
    const cur = best.get(e.brn)
    if (!cur || e.checkedInAt > cur.checkedInAt) best.set(e.brn, e)
  }
  return entries.filter(e => best.get(e.brn) === e)
}

/**
 * Read-time resolution — pins are renamed / removed / un-stationed on the map
 * and entries only hold refs, so a rename shows up everywhere for free. A move
 * onto a pin that's gone (or no longer a station) reads as Unassigned; a
 * transit marker pointing at one is dropped.
 */
export function resolvePlaces(e: MockEntry, net: TrackingNetwork): MockEntry {
  const live = (p: TrackingPosition) => !p || !!placeByRef(net, p)
  if (e.moves.every(m => live(m.to)) && (!e.transit || live(e.transit.to))) return e
  return {
    ...e,
    moves: e.moves.map(m => (live(m.to) ? m : { ...m, to: null })),
    transit: e.transit && live(e.transit.to) ? e.transit : null,
  }
}

/**
 * What a viewer's board holds: origin in the viewer's subtree → not expired →
 * duplicate BRNs collapsed to the newest → capped to the newest check-ins →
 * gone stations resolved to Unassigned.
 */
export function boardEntries(all: MockEntry[], net: TrackingNetwork, viewerId: string, now: number): MockEntry[] {
  const mine = subtree(net.clusters, viewerId)
  const live = all.filter(e => mine.has(e.originClinicId) && now - e.checkedInAt < TRACKING_EXPIRE_MS)
  return dedupeByBrn(live)
    .map(e => resolvePlaces(e, net))
    .sort((a, b) => b.checkedInAt - a.checkedInAt)
    .slice(0, TRACKING_MAX_ENTRIES)
}

export interface BoardPlace {
  pos: LinkedFeatureRef
  label: string
}

/** A column group: one cluster's stations. Unassigned sits outside every group. */
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
export function boardLayout(net: TrackingNetwork, viewerId: string, entries: MockEntry[]): BoardGroupDef[] {
  const clusterIds = subtree(net.clusters, viewerId)
  for (const e of entries) {
    const p = positionOf(e)
    const pl = p && placeByRef(net, p)
    if (pl && !pl.targetClinicIds.some(id => clusterIds.has(id))) clusterIds.add(pl.targetClinicIds.includes(pl.clinicId) ? pl.clinicId : pl.targetClinicIds[0])
  }
  return buildGroups(net, clusterIds)
}

/** Stations an entry may move to: what its origin's chain shows, lowest echelon first. */
export const moveTargets = (net: TrackingNetwork, e: MockEntry): BoardGroupDef[] =>
  buildGroups(net, new Set(ancestorChain(net.clusters, e.originClinicId)))

// ── Writes ──

/** Add a move; clears any transit marker. Unchanged position = no-op. */
export function applyMove(e: MockEntry, to: TrackingPosition, at: number): MockEntry {
  if (samePlace(positionOf(e), to)) return e
  return { ...e, transit: null, moves: [...e.moves, { id: `m-${at}`, to, at }] }
}

/** Flag the patient as leaving for station `to` (they stay put until a move lands them). */
export const applyTransit = (e: MockEntry, to: LinkedFeatureRef, by: string, at: number): MockEntry =>
  ({ ...e, transit: { to, by, at } })

export const clearTransit = (e: MockEntry): MockEntry => ({ ...e, transit: null })

/**
 * Board settings toggle — show / hide a known station on `clinicId`'s board.
 * Writes the pin's tracking_clinic_ids (real path: an overlay feature edit,
 * fanned to the overlay's targets like any other pin edit).
 */
export function togglePlace(overlays: MockOverlay[], ref: LinkedFeatureRef, clinicId: string): MockOverlay[] {
  return overlays.map(o => o.id !== ref.overlay_id ? o : {
    ...o,
    pins: o.pins.map(p => {
      if (p.id !== ref.feature_id) return p
      const cur = p.tracking_clinic_ids ?? [o.clinic_id]
      return { ...p, tracking_clinic_ids: cur.includes(clinicId) ? cur.filter(c => c !== clinicId) : [...cur, clinicId] }
    }),
  })
}
