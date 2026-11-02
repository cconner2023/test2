/**
 * Tracking Board model — MOCK echelon data + pure helpers (no store, no vault).
 *
 * Echelon rules (2026-11-01 / 02):
 *  - ONE shared entry per patient visit, synced across the chain like a loaned
 *    calendar event. Real path: target_clinic_ids = origin + every ancestor.
 *  - Visibility = origin + ancestors: a viewer sees an entry when its ORIGIN
 *    cluster is the viewer or one of the viewer's descendants. Role I sees only
 *    its own patients; Role II its own + below; Role III everything. Where the
 *    patient currently sits never widens that.
 *  - Places:
 *     · UNASSIGNED — per cluster (checked in / arrived, not yet placed).
 *     · STATION — a real physical place. Created by one cluster; clusters up /
 *       down the chain OPT IN to use the SAME place instead of making a
 *       duplicate (one Triage tent fed by two BASs). A board lists each station
 *       once, under the first cluster on it that uses it.
 *     · AXP — exchange point, owned by NOBODY. Usually set up by Role Is as the
 *       way into their Role II, so scoped to the RECEIVING cluster (visible to
 *       it + everything under it). Anyone who sees one may rename / remove it.
 *  - Entries hold place ids only → renames show up everywhere; a removed
 *    station / AXP resolves AT READ TIME to Unassigned at the patient's last
 *    cluster (resolvePlaces). Events are never rewritten for it.
 *  - Moving up an echelon is a move into a station / AXP the chain uses — the
 *    entry never closes / re-creates.
 *  - In transit is NOT a place: it's a marker on the entry (`transit`) — the
 *    patient stays where they are, flagged "leaving → destination", until a
 *    move lands them (any move clears it).
 *  - Leaves the board ONLY by expire, delete, or max cap.
 *  - Duplicate BRN → newest check-in wins (older entry reset/removed).
 */

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

/** A shared physical place. Real path: plaintext rows (place names only, no PHI). */
export interface TrackingStation {
  id: string
  label: string
  createdByClinicId: string
  /** Clusters using it — the creator plus everyone who opted in. */
  memberClinicIds: string[]
}

/** Ambulance exchange point — shared, unowned, scoped to the receiving cluster. */
export interface TrackingExchangePoint {
  id: string
  label: string
  /** The cluster patients are handed INTO here (usually the Role II). */
  scopeClinicId: string
  /** Cluster that set it up (audit only — confers no ownership). */
  createdByClinicId: string
}

export type TrackingPosition =
  | { kind: 'unassigned'; clinicId: string }
  | { kind: 'station'; stationId: string }
  | { kind: 'axp'; axpId: string }

export interface TrackingMove {
  id: string
  to: TrackingPosition
  at: number // epoch ms
}

/** "Leaving → destination" marker. Cleared by the next move. */
export interface TrackingTransit {
  to: TrackingPosition
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
  /** Empty = Unassigned at the origin. Append-only (union-merge by id on sync). */
  moves: TrackingMove[]
  /** Oldest first. Union-merge by id on sync. */
  comments: MockComment[]
  transit?: TrackingTransit | null
}

export interface TrackingNetwork {
  clusters: TrackingCluster[]
  stations: TrackingStation[]
  axps: TrackingExchangePoint[]
}

// ── Board limits (placeholders until settled) ──

/** Entry drops off every board this long after check-in. */
export const TRACKING_EXPIRE_MS = 72 * 60 * 60 * 1000
/** Max entries a board shows — newest check-ins kept. */
export const TRACKING_MAX_ENTRIES = 200

// ── Mock network: Role III ← Role II ← two Role Is ──

export const MOCK_CLUSTERS: TrackingCluster[] = [
  { id: 'r3', label: 'CSH', uic: 'WFG3H0', echelon: 3, parentId: null },
  { id: 'r2', label: 'Role II FSMC', uic: 'WCD2E0', echelon: 2, parentId: 'r3' },
  { id: 'r1n', label: 'BAS North', uic: 'WAB1C0', echelon: 1, parentId: 'r2' },
  { id: 'r1s', label: 'BAS South', uic: 'WAB2C0', echelon: 1, parentId: 'r2' },
]

const stn = (id: string, label: string, by: string, also: string[] = []): TrackingStation =>
  ({ id, label, createdByClinicId: by, memberClinicIds: [by, ...also] })

export const MOCK_STATIONS: TrackingStation[] = [
  stn('n-checkin', 'Check-in', 'r1n'),
  // One Triage tent, made by BAS North, BAS South opted in.
  stn('n-triage', 'Triage', 'r1n', ['r1s']),
  stn('n-treat', 'Treatment', 'r1n'),
  stn('n-hold', 'Hold', 'r1n'),
  // BAS South's own Check-in — a duplicate name, not opted in (shows in "Available").
  stn('s-checkin', 'Check-in', 'r1s'),
  stn('s-treat', 'Treatment', 'r1s'),
  stn('2-triage', 'Triage', 'r2'),
  stn('2-surgery', 'Surgery', 'r2'),
  stn('2-hold', 'Hold', 'r2'),
  stn('3-er', 'ER', 'r3'),
  stn('3-or', 'OR', 'r3'),
  stn('3-icu', 'ICU', 'r3'),
  stn('3-ward', 'Ward', 'r3'),
]

export const MOCK_AXPS: TrackingExchangePoint[] = [
  { id: 'axp-n', label: 'AXP Copper', scopeClinicId: 'r2', createdByClinicId: 'r1n' },
  { id: 'axp-s', label: 'AXP Iron', scopeClinicId: 'r2', createdByClinicId: 'r1s' },
]

export const DEFAULT_VIEWER_ID = 'r2'

const MIN = 60 * 1000

export const atUnassigned = (clinicId: string): TrackingPosition => ({ kind: 'unassigned', clinicId })
export const atStation = (stationId: string): TrackingPosition => ({ kind: 'station', stationId })
export const atAxp = (axpId: string): TrackingPosition => ({ kind: 'axp', axpId })

/** Mock entries anchored to "now". Includes one duplicated BRN (older loses). */
export function buildMockEntries(now: number): MockEntry[] {
  const ago = (m: number) => now - m * MIN
  let n = 0
  const mv = (to: TrackingPosition, m: number): TrackingMove => ({ id: `m${++n}`, to, at: ago(m) })
  const st = atStation
  return [
    { id: 'e1', brn: 'AB1234', originClinicId: 'r1n', checkedInAt: ago(3), moves: [], comments: [] },
    { id: 'e2', brn: 'CD5678', originClinicId: 'r1n', checkedInAt: ago(190), moves: [mv(st('n-checkin'), 188), mv(st('n-triage'), 175), mv(st('n-treat'), 160), mv(atAxp('axp-n'), 135), mv(atUnassigned('r2'), 120), mv(st('2-surgery'), 95), mv(st('3-er'), 20)], comments: [{ id: 'c1', text: 'GSW L thigh, TQ 1405', by: 'SGT Doe', at: ago(185) }] },
    { id: 'e3', brn: 'EF9012', originClinicId: 'r1s', checkedInAt: ago(72), moves: [mv(st('s-checkin'), 70), mv(st('s-treat'), 60), mv(atAxp('axp-s'), 25)], comments: [{ id: 'c2', text: 'Awaiting x-ray read', by: 'SPC Roe', at: ago(30) }], transit: { to: atUnassigned('r2'), at: ago(4), by: 'SPC Roe' } },
    { id: 'e4', brn: 'GH3456', originClinicId: 'r2', checkedInAt: ago(41), moves: [mv(st('2-triage'), 40), mv(st('2-hold'), 28)], comments: [] },
    // Two clusters' patients in the one shared Triage.
    { id: 'e5', brn: 'JK7890', originClinicId: 'r1s', checkedInAt: ago(23), moves: [mv(st('s-checkin'), 22), mv(st('n-triage'), 12)], comments: [] },
    { id: 'e9', brn: 'QR4680', originClinicId: 'r1n', checkedInAt: ago(15), moves: [mv(st('n-checkin'), 14), mv(st('n-triage'), 10)], comments: [] },
    { id: 'e6', brn: 'LM2468', originClinicId: 'r3', checkedInAt: ago(7), moves: [mv(st('3-er'), 6)], comments: [] },
    { id: 'e7', brn: 'NP1357', originClinicId: 'r1n', checkedInAt: ago(9), moves: [mv(st('n-treat'), 8)], comments: [], transit: { to: atAxp('axp-n'), at: ago(2), by: 'SGT Doe' } },
    // Duplicate BRN — the older visit is superseded by e7's newer check-in.
    { id: 'e8', brn: 'NP1357', originClinicId: 'r1s', checkedInAt: ago(300), moves: [mv(st('s-treat'), 290)], comments: [] },
  ]
}

// ── Tree helpers (real path: ancestor-chain RPC + cluster directory) ──

export const clusterById = (clusters: TrackingCluster[], id: string) => clusters.find(c => c.id === id)
export const stationById = (stations: TrackingStation[], id: string) => stations.find(s => s.id === id)
export const axpById = (axps: TrackingExchangePoint[], id: string) => axps.find(a => a.id === id)

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

/** Clusters whose stations `id` may opt in to: ancestors, descendants and
 *  siblings (same parent). Real path: the get_cluster_directory set. */
export function relatedClusters(clusters: TrackingCluster[], id: string): Set<string> {
  const out = new Set([...ancestorChain(clusters, id), ...subtree(clusters, id)])
  const parent = clusterById(clusters, id)?.parentId
  if (parent) for (const c of clusters) if (c.parentId === parent) out.add(c.id)
  return out
}

/** Stations a cluster uses (created or opted in), in network order. */
export const stationsOf = (net: TrackingNetwork, clinicId: string) =>
  net.stations.filter(s => s.memberClinicIds.includes(clinicId))

// ── Position helpers ──

const lastMove = (e: MockEntry) => e.moves[e.moves.length - 1] as TrackingMove | undefined

export const positionOf = (e: MockEntry): TrackingPosition => lastMove(e)?.to ?? atUnassigned(e.originClinicId)

export const sinceAt = (e: MockEntry) => lastMove(e)?.at ?? e.checkedInAt

/** Stable place key. */
export const placeKey = (p: TrackingPosition) =>
  p.kind === 'axp' ? `axp:${p.axpId}` : p.kind === 'station' ? `st:${p.stationId}` : `un:${p.clinicId}`

export const samePlace = (a: TrackingPosition, b: TrackingPosition) => placeKey(a) === placeKey(b)

const clusterName = (net: TrackingNetwork, id: string) => clusterById(net.clusters, id)?.label ?? id

/** Short name — station / Unassigned / AXP label. */
export function stationLabel(net: TrackingNetwork, p: TrackingPosition): string {
  if (p.kind === 'axp') return axpById(net.axps, p.axpId)?.label ?? 'AXP'
  if (p.kind === 'station') return stationById(net.stations, p.stationId)?.label ?? 'Station'
  return 'Unassigned'
}

/**
 * Full name for a footer / detail. Bare when the viewer uses the place (own
 * Unassigned, a station they're a member of, any AXP); otherwise prefixed with
 * the owning cluster (Unassigned) or the station's creator.
 */
export function placeLabel(net: TrackingNetwork, p: TrackingPosition, viewerId?: string): string {
  const name = stationLabel(net, p)
  if (p.kind === 'axp') return name
  if (p.kind === 'unassigned') return p.clinicId === viewerId ? name : `${clusterName(net, p.clinicId)} · ${name}`
  const s = stationById(net.stations, p.stationId)
  if (!s || (viewerId && s.memberClinicIds.includes(viewerId))) return name
  return `${clusterName(net, s.createdByClinicId)} · ${name}`
}

/** Transit destination — a cluster's Unassigned reads as just the cluster. */
export function destinationLabel(net: TrackingNetwork, p: TrackingPosition): string {
  return p.kind === 'unassigned' ? clusterName(net, p.clinicId) : placeLabel(net, p)
}

/** Detail sub-line: who runs the place. */
export function placeOwnerLabel(net: TrackingNetwork, p: TrackingPosition): string {
  if (p.kind === 'unassigned') return clusterName(net, p.clinicId)
  if (p.kind === 'axp') {
    const a = axpById(net.axps, p.axpId)
    return a ? `Exchange point · into ${clusterName(net, a.scopeClinicId)}` : 'Exchange point'
  }
  const s = stationById(net.stations, p.stationId)
  if (!s) return ''
  return s.memberClinicIds.map(id => clusterName(net, id)).join(' · ')
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
 * Read-time place resolution — stations / AXPs are edited and removed freely
 * and entries only hold ids, so a rename shows up everywhere for free. A move
 * onto a REMOVED place reads as Unassigned at the cluster the patient was last
 * in (origin if none); a transit marker pointing at one is dropped.
 */
export function resolvePlaces(e: MockEntry, net: TrackingNetwork): MockEntry {
  const live = (p: TrackingPosition) =>
    p.kind === 'unassigned' || (p.kind === 'axp' ? !!axpById(net.axps, p.axpId) : !!stationById(net.stations, p.stationId))
  if (e.moves.every(m => live(m.to)) && (!e.transit || live(e.transit.to))) return e
  let lastClinic = e.originClinicId
  const moves = e.moves.map(m => {
    if (!live(m.to)) return { ...m, to: atUnassigned(lastClinic) }
    if (m.to.kind === 'unassigned') lastClinic = m.to.clinicId
    else if (m.to.kind === 'station') lastClinic = stationById(net.stations, m.to.stationId)!.createdByClinicId
    else lastClinic = axpById(net.axps, m.to.axpId)!.scopeClinicId
    return m
  })
  return { ...e, moves, transit: e.transit && live(e.transit.to) ? e.transit : null }
}

/**
 * What a viewer's board holds: origin in the viewer's subtree → not expired →
 * duplicate BRNs collapsed to the newest → capped to the newest check-ins →
 * removed places resolved to Unassigned.
 */
export function boardEntries(all: MockEntry[], net: TrackingNetwork, viewerId: string, now: number): MockEntry[] {
  const mine = subtree(net.clusters, viewerId)
  const live = all.filter(e => mine.has(e.originClinicId) && now - e.checkedInAt < TRACKING_EXPIRE_MS)
  return dedupeByBrn(live)
    .map(e => resolvePlaces(e, net))
    .sort((a, b) => b.checkedInAt - a.checkedInAt)
    .slice(0, TRACKING_MAX_ENTRIES)
}

/** AXPs a viewer's board lists: scoped to the viewer or anything above it
 *  (a Role I sees its Role II's AXPs) or below it (Role II sees its own). */
export function boardAxps(net: TrackingNetwork, viewerId: string): TrackingExchangePoint[] {
  const related = new Set([...ancestorChain(net.clusters, viewerId), ...subtree(net.clusters, viewerId)])
  return net.axps.filter(a => related.has(a.scopeClinicId))
}

export interface BoardPlace {
  pos: TrackingPosition
  label: string
}

/** A column group: a cluster (Unassigned + the stations it lists) or the AXPs into one. */
export type BoardGroupDef =
  | { kind: 'cluster'; cluster: TrackingCluster; places: BoardPlace[] }
  | { kind: 'axps'; scope: TrackingCluster; places: BoardPlace[] }

/**
 * Groups along the patient flow (Role I → Role III), each cluster's AXPs just
 * before it. A shared station appears ONCE — under the first listed cluster
 * that uses it.
 */
function buildGroups(net: TrackingNetwork, clusterIds: Set<string>, axpIds: Set<string>): BoardGroupDef[] {
  const ordered = net.clusters
    .filter(c => clusterIds.has(c.id) || net.axps.some(a => axpIds.has(a.id) && a.scopeClinicId === c.id))
    .sort((a, b) => a.echelon - b.echelon || a.label.localeCompare(b.label))
  const placed = new Set<string>()
  const out: BoardGroupDef[] = []
  for (const c of ordered) {
    const axps = net.axps.filter(a => axpIds.has(a.id) && a.scopeClinicId === c.id)
    if (axps.length > 0) out.push({ kind: 'axps', scope: c, places: axps.map(a => ({ pos: atAxp(a.id), label: a.label })) })
    if (!clusterIds.has(c.id)) continue
    const stations = stationsOf(net, c.id).filter(s => !placed.has(s.id))
    stations.forEach(s => placed.add(s.id))
    out.push({
      kind: 'cluster',
      cluster: c,
      places: [{ pos: atUnassigned(c.id), label: 'Unassigned' }, ...stations.map(s => ({ pos: atStation(s.id), label: s.label }))],
    })
  }
  return out
}

/**
 * A viewer's board: its subtree's clusters, plus any cluster above holding one
 * of its entries (a station's creator stands in for the station); its related
 * AXPs plus any holding an entry.
 */
export function boardLayout(net: TrackingNetwork, viewerId: string, entries: MockEntry[]): BoardGroupDef[] {
  const clusterIds = subtree(net.clusters, viewerId)
  const axpIds = new Set(boardAxps(net, viewerId).map(a => a.id))
  for (const e of entries) {
    const p = positionOf(e)
    if (p.kind === 'axp') axpIds.add(p.axpId)
    else if (p.kind === 'unassigned') clusterIds.add(p.clinicId)
    else {
      const s = stationById(net.stations, p.stationId)
      if (s && !s.memberClinicIds.some(id => clusterIds.has(id))) clusterIds.add(s.createdByClinicId)
    }
  }
  return buildGroups(net, clusterIds, axpIds)
}

/** Places an entry may move to: what its origin's chain uses (lowest echelon
 *  first), with the AXPs into each. */
export function moveTargets(net: TrackingNetwork, e: MockEntry): BoardGroupDef[] {
  const chain = new Set(ancestorChain(net.clusters, e.originClinicId))
  return buildGroups(net, chain, new Set(net.axps.filter(a => chain.has(a.scopeClinicId)).map(a => a.id)))
}

// ── Writes ──

/** Add a move; clears any transit marker. Unchanged position = no-op. */
export function applyMove(e: MockEntry, to: TrackingPosition, at: number): MockEntry {
  if (samePlace(positionOf(e), to)) return e
  return { ...e, transit: null, moves: [...e.moves, { id: `m-${at}`, to, at }] }
}

/** Flag the patient as leaving for `to` (they stay put until a move lands them). */
export const applyTransit = (e: MockEntry, to: TrackingPosition, by: string, at: number): MockEntry =>
  ({ ...e, transit: { to, by, at } })

export const clearTransit = (e: MockEntry): MockEntry => ({ ...e, transit: null })

/** AXP edits — anyone who can see one may rename / remove it. Entries follow by id. */
export const renameAxp = (axps: TrackingExchangePoint[], id: string, label: string) =>
  axps.map(a => (a.id === id ? { ...a, label } : a))
export const removeAxp = (axps: TrackingExchangePoint[], id: string) => axps.filter(a => a.id !== id)

/** Stations another related cluster made that `clinicId` doesn't use yet. */
export const availableStations = (net: TrackingNetwork, clinicId: string) => {
  const related = relatedClusters(net.clusters, clinicId)
  return net.stations.filter(s => related.has(s.createdByClinicId) && !s.memberClinicIds.includes(clinicId))
}

/** Opt in to / leave a station someone else made. The creator can't leave its own. */
export const optInStation = (stations: TrackingStation[], id: string, clinicId: string) =>
  stations.map(s => (s.id === id && !s.memberClinicIds.includes(clinicId) ? { ...s, memberClinicIds: [...s.memberClinicIds, clinicId] } : s))
export const leaveStation = (stations: TrackingStation[], id: string, clinicId: string) =>
  stations.map(s => (s.id === id && s.createdByClinicId !== clinicId ? { ...s, memberClinicIds: s.memberClinicIds.filter(c => c !== clinicId) } : s))

/** Station edits — the creating cluster only. Entries follow by id; a removed
 *  station's patients read as Unassigned (resolvePlaces). */
export const addStation = (stations: TrackingStation[], label: string, clinicId: string, at: number): TrackingStation[] =>
  [...stations, { id: `st-${at}`, label, createdByClinicId: clinicId, memberClinicIds: [clinicId] }]
export const renameStation = (stations: TrackingStation[], id: string, label: string) =>
  stations.map(s => (s.id === id ? { ...s, label } : s))
export const removeStation = (stations: TrackingStation[], id: string) => stations.filter(s => s.id !== id)
