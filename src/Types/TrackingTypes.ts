/**
 * Tracking Board payload — rides a CalendarEvent as `tracking_data`.
 *
 * A tracking entry is ONE hidden calendar event per patient visit:
 *  - clinic_id        = origin cluster (who checked them in)
 *  - target_clinic_ids = origin + every ancestor (tracking_clinic_chain RPC)
 * It never appears on the calendar — useCalendarStore partitions any event
 * carrying tracking_data into `tracking`, out of `events`.
 *
 * PHI: the BRN (initials + last-4 DODID) and comment free text are a deliberate
 * exception — they live ONLY inside the E2E event payload. Never put them in a
 * plaintext column, log line, push body or CSV.
 *
 * Merge (calendarRouting → mergeTrackingData): moves[] and comments[] union by
 * id (comment versions: latest editedAt/at wins, deletes are soft so they
 * merge); brn last-write-wins on brn_at; transit last-write-wins on transit_at.
 */

import type { LinkedFeatureRef } from './MissionTypes'

/** Pin ref (a map waypoint with `tracking: true`), or null = Unassigned. */
export type TrackingPosition = LinkedFeatureRef | null

export interface TrackingMove {
  id: string
  to: TrackingPosition
  /** epoch ms */
  at: number
  /** Mover display name (rank + last), stamped at write. */
  by?: string
}

/** "Leaving → destination station" marker. A later move supersedes it. */
export interface TrackingTransit {
  to: LinkedFeatureRef
  at: number
  by: string
}

export interface TrackingComment {
  id: string
  text: string
  /** Author display name (rank + last), stamped at write. */
  by: string
  at: number
  editedAt?: number
  editedBy?: string
  /** Soft delete — kept so a union merge can't resurrect it. */
  deleted?: boolean
}

export interface TrackingData {
  brn: string
  /** When brn was last written — LWW key. */
  brn_at: number
  checked_in_at: number
  moves: TrackingMove[]
  comments: TrackingComment[]
  transit: TrackingTransit | null
  /** When transit was last set / cleared — LWW key. */
  transit_at: number
}

const commentStamp = (c: TrackingComment) => c.editedAt ?? c.at

function unionBy<T extends { id: string }>(a: T[], b: T[], pick: (x: T, y: T) => T): T[] {
  const byId = new Map<string, T>()
  for (const x of a) byId.set(x.id, x)
  for (const y of b) {
    const x = byId.get(y.id)
    byId.set(y.id, x ? pick(x, y) : y)
  }
  return Array.from(byId.values())
}

/** Merge two copies of one entry's tracking data. Commutative. */
export function mergeTrackingData(a: TrackingData, b: TrackingData): TrackingData {
  const brnSide = (b.brn_at ?? 0) > (a.brn_at ?? 0) ? b : a
  const transitSide = (b.transit_at ?? 0) > (a.transit_at ?? 0) ? b : a
  return {
    brn: brnSide.brn,
    brn_at: brnSide.brn_at,
    checked_in_at: Math.min(a.checked_in_at, b.checked_in_at),
    moves: unionBy(a.moves ?? [], b.moves ?? [], x => x).sort((x, y) => x.at - y.at || x.id.localeCompare(y.id)),
    comments: unionBy(a.comments ?? [], b.comments ?? [], (x, y) => {
      const sx = commentStamp(x), sy = commentStamp(y)
      if (sx !== sy) return sy > sx ? y : x
      return y.deleted ? y : x
    }).sort((x, y) => x.at - y.at || x.id.localeCompare(y.id)),
    transit: transitSide.transit ?? null,
    transit_at: transitSide.transit_at ?? 0,
  }
}

/** Entry drops off every board (and out of the vault snapshot) this long after check-in. */
export const TRACKING_EXPIRE_MS = 72 * 60 * 60 * 1000
/** Max entries a board shows — newest check-ins kept. */
export const TRACKING_MAX_ENTRIES = 200

export const isTrackingExpired = (d: Pick<TrackingData, 'checked_in_at'>, now = Date.now()) =>
  now - d.checked_in_at >= TRACKING_EXPIRE_MS
