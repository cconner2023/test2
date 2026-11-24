/**
 * Tracking Board model — pure helpers over real data (no store, no vault).
 *
 * Echelon rules (2026-11-01 / 02):
 *  - ONE shared entry per patient visit = a hidden calendar event carrying
 *    tracking_data (Types/TrackingTypes.ts), fanned to origin + every ancestor
 *    (tracking_clinic_chain). Visibility therefore = origin + ancestors: an
 *    entry reaches a board only when the viewer is its origin or above it.
 *  - STATIONS ARE MAP FEATURES. Any feature on any map with `tracking: true`
 *    (feature editor → "Add to tracking board") is a station. Only the
 *    overlay's own cluster edits / removes it (on the map).
 *  - Sharing is cluster-to-cluster (2026-11-20): A sends to B, B receives from
 *    A → B's board gets A's stations, and B's map a view-only copy of A's
 *    overlays holding just those features. Overlays reach B via
 *    target_clinic_ids. No per-station opt-in.
 *  - A position is a feature ref { overlay_id, feature_id } or null = Pending.
 *    A board groups stations under the cluster that owns them.
 *  - Entries hold pin refs only → renames show up everywhere; a removed pin (or
 *    one no longer a station) resolves AT READ TIME to Pending
 *    (resolvePlaces). Events are never rewritten for it.
 *  - In transit is NOT a station: a marker on the entry, superseded by the
 *    next move.
 *  - Status is derived from the last move: Pending (no station), in process (at
 *    a station), Complete (dispositioned — a move flagged `complete`, so it
 *    union-merges like any other and any later move reopens the entry).
 *  - Leaves the board ONLY by expire, delete, or max cap — Complete stays on it.
 *  - Duplicate BRN → every entry stays; numbered at read, oldest check-in first:
 *    BRN, BRN (2), BRN (3). Nothing is deleted or stored for it.
 */

import type { LinkedFeatureRef } from '../../Types/MissionTypes'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import type { LocalMapOverlay } from '../../Types/MapOverlayTypes'
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

/** A station — a tracking feature, flattened. */
export interface TrackingPlace {
  overlayId: string
  featureId: string
  label: string
  /** The overlay's cluster — owns the station; the only one that edits / removes it. */
  clinicId: string
}

/** Board view of one entry (derived from its calendar event). */
export interface TrackingEntry {
  id: string
  brn: string
  /** What the board shows — `brn`, or `brn (2)` etc. when it's on the board more than once. */
  brnLabel: string
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
  /** Every station the board shows — own + live senders'. */
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

/** Tracking features → stations. */
export const derivePlaces = (overlays: LocalMapOverlay[]): TrackingPlace[] =>
  overlays.flatMap(o => o.features
    .filter(f => f.tracking)
    .map(f => ({
      overlayId: o.id,
      featureId: f.id,
      label: f.label || 'Station',
      clinicId: o.clinic_id,
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
    brnLabel: d.brn,
    originClinicId: ev.clinic_id,
    checkedInAt: d.checked_in_at,
    moves,
    comments: (d.comments ?? []).filter(c => !c.deleted),
    transit: d.transit && d.transit.at >= lastAt ? d.transit : null,
  }
}

// ── Tree helpers ──

export const clusterById = (clusters: TrackingCluster[], id: string) => clusters.find(c => c.id === id)

// ── Place helpers ──

/** Stable key for a position — `pl:<feature id>` or `pending`. */
export const placeKey = (p: TrackingPosition) => (p ? `pl:${p.feature_id}` : 'pending')
export const samePlace = (a: TrackingPosition, b: TrackingPosition) => placeKey(a) === placeKey(b)
export const refOf = (p: TrackingPlace): LinkedFeatureRef => ({ overlay_id: p.overlayId, feature_id: p.featureId })

export const placeByRef = (net: TrackingNetwork, ref: LinkedFeatureRef) =>
  net.places.find(p => p.featureId === ref.feature_id && p.overlayId === ref.overlay_id)

/** Stations a cluster owns, in network order. */
const placesOf = (net: TrackingNetwork, clinicId: string) =>
  net.places.filter(p => p.clinicId === clinicId)

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

/** Repeat BRNs get a visit number, oldest check-in first. Id breaks ties so devices agree. */
export function numberDuplicateBrns(entries: TrackingEntry[]): TrackingEntry[] {
  const counts = new Map<string, number>()
  return [...entries]
    .sort((a, b) => a.checkedInAt - b.checkedInAt || a.id.localeCompare(b.id))
    .map(e => {
      const n = (counts.get(e.brn) ?? 0) + 1
      counts.set(e.brn, n)
      return n > 1 ? { ...e, brnLabel: `${e.brn} (${n})` } : e
    })
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
 * What the viewers' boards hold: events fanned to any viewer (origin + ancestors)
 * → not expired → duplicate BRNs numbered → capped to the newest check-ins →
 * gone stations resolved to Pending. Complete entries sink below the open ones.
 * viewerIds is home + loans for a loaned member (one id otherwise). origins
 * narrows to entries checked in by those clusters (null = no narrowing).
 */
export function boardEntries(events: CalendarEvent[], net: TrackingNetwork, viewerIds: string[], now: number, origins: string[] | null = null): TrackingEntry[] {
  const live = events
    .filter(ev => ev.tracking_data && !isTrackingExpired(ev.tracking_data, now)
      && (viewerIds.includes(ev.clinic_id) || (ev.target_clinic_ids?.some(id => viewerIds.includes(id)) ?? false)))
    .map(toEntry)
    .filter((e): e is TrackingEntry => !!e && (!origins || origins.includes(e.originClinicId)))
  const board = numberDuplicateBrns(live)
    .map(e => resolvePlaces(e, net))
    .sort((a, b) => b.checkedInAt - a.checkedInAt)
    .slice(0, TRACKING_MAX_ENTRIES)
  return [...board.filter(e => !isComplete(e)), ...board.filter(isComplete)]
}

export interface BoardPlace {
  pos: LinkedFeatureRef
  label: string
}

/** A column group: the stations one cluster owns. Pending sits outside every group. */
export interface BoardGroupDef {
  cluster: TrackingCluster
  places: BoardPlace[]
}

/**
 * A viewer's board: every known station, grouped by owning cluster — the
 * viewer's own first, then along the patient flow (Role I → Role III).
 * Clusters with no stations are dropped.
 */
export function boardLayout(net: TrackingNetwork, viewerId: string): BoardGroupDef[] {
  return net.clusters
    .slice()
    .sort((a, b) => Number(b.id === viewerId) - Number(a.id === viewerId) || a.echelon - b.echelon || a.label.localeCompare(b.label))
    .map(c => ({ cluster: c, places: placesOf(net, c.id).map(p => ({ pos: refOf(p), label: p.label })) }))
    .filter(g => g.places.length > 0)
}

/** Move to / Send to targets — every station on the board, one flat list in board order. */
export const moveTargets = (net: TrackingNetwork, viewerId: string): BoardPlace[] =>
  boardLayout(net, viewerId).flatMap(g => g.places)

// ── Writes (mutators over TrackingData — useTrackingWrite.updateEntry) ──

const newId = () => crypto.randomUUID()

/** Fresh entry data for a check-in. */
export const newTrackingData = (brn: string, at: number): TrackingData =>
  ({ brn, brn_at: at, checked_in_at: at, moves: [], comments: [], transit: null, transit_at: at })

/** Where a move can land: a position, or Complete. */
export const COMPLETE = 'complete' as const
export type TrackingTarget = TrackingPosition | typeof COMPLETE

/** Add a move; supersedes any transit marker. Unchanged position = no-op.
 *  No author: moves are the cluster's, not a member's (shown as "System"). */
export function moveData(d: TrackingData, target: TrackingTarget, at: number): TrackingData {
  const last = [...d.moves].sort((a, b) => a.at - b.at)[d.moves.length - 1]
  const complete = target === COMPLETE
  const to = complete ? null : target
  if (!!last?.complete === complete && samePlace(last?.to ?? null, to)) return d
  return { ...d, transit: null, transit_at: at, moves: [...d.moves, { id: newId(), to, at, ...(complete ? { complete } : {}) }] }
}

/** Set (or clear, null) the "leaving → destination station" marker. */
export const transitData = (d: TrackingData, to: LinkedFeatureRef | null, by: string, at: number): TrackingData =>
  ({ ...d, transit: to ? { to, by, at } : null, transit_at: at })

/** Draft the drawer owns — the Save pill lives in the surface header. */
export interface TrackingEditDraft {
  brn: string
  /** Existing comments by id; `removed` (or cleared text on a text-only comment)
   *  = soft-deleted on save. */
  comments: { id: string; text: string; removed?: boolean }[]
  /** New comment appended on save (blank = none). In the Edit form this is the
   *  chat input's unsent text — saved too, so Save never drops typed text. */
  newComment: string
  /** Comments "sent" from the chat input (Edit + check-in), appended on save in order. */
  added?: { text: string; attachment?: TrackingComment['attachment'] }[]
  /** Uploaded but unsent attachment (Edit form + check-in). Saved like unsent text, ahead of it. */
  staged?: TrackingComment['attachment']
}

/** Apply a saved draft. Removed comments are soft-deleted so the merge keeps them gone. */
export function draftData(d: TrackingData, draft: TrackingEditDraft, by: string, at: number): TrackingData {
  const byId = new Map(draft.comments.map(c => [c.id, c]))
  const added = [...(draft.added ?? []), ...(draft.staged ? [{ text: '', attachment: draft.staged }] : []), { text: draft.newComment }]
    .map(a => ({ ...a, text: a.text.trim() }))
    .filter(a => a.text || a.attachment)
  return {
    ...d,
    ...(draft.brn !== d.brn ? { brn: draft.brn, brn_at: at } : {}),
    comments: [
      ...d.comments.map(c => {
        const dc = byId.get(c.id)
        if (c.deleted || !dc) return c
        const text = dc.text.trim()
        if (dc.removed || (!text && !c.attachment)) return { ...c, deleted: true, editedAt: at, editedBy: by }
        return text === c.text ? c : { ...c, text, editedAt: at, editedBy: by }
      }),
      ...added.map(a => ({ id: newId(), text: a.text, by, at, ...(a.attachment ? { attachment: a.attachment } : {}) })),
    ],
  }
}

