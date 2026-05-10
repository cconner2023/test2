/**
 * Phase 4.4 — Strip-map data layer.
 *
 * Pure functions that turn a route OverlayFeature into a leg-by-leg
 * navigation table: distance, true/grid/magnetic azimuth, MGRS endpoints,
 * cumulative distance, time at chosen pace count.
 *
 * No PDF, no React. The PDF generator (sibling generatePdf.ts) consumes
 * StripMapData; the UI consumes the same shape for an on-screen preview.
 */

import { forward } from 'mgrs'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import {
  applyBearingReference,
  type BearingReference,
} from '../declination'

/** Pace-count standards (meters per minute). 100 m/min = double-time / no-load
 *  road march; 80 m/min = combat-loaded foot pace; 'off' = no time column. */
export type Pace = 'off' | '100' | '80'

const PACE_M_PER_MIN: Record<Exclude<Pace, 'off'>, number> = {
  '100': 100,
  '80': 80,
}

export interface LegRow {
  index: number             // 1-based
  distanceM: number
  cumulativeM: number
  /** Stored on the feature side as TRUE bearing — converted at render time. */
  trueBearing: number
  /** Bearing in the user's chosen reference (true/grid/magnetic). */
  refBearing: number
  startMgrs: string
  endMgrs: string
  /** End-point label — falls back to truncated MGRS when no nearby waypoint. */
  endLabel: string
  /** Minutes at the chosen pace. null when pace='off'. */
  paceMinutes: number | null
}

export interface StripMapData {
  overlayName: string
  routeName: string
  legs: LegRow[]
  totalDistanceM: number
  totalPaceMinutes: number | null
  bearingReference: BearingReference
  pace: Pace
  /** Date the strip map was generated. */
  generatedAt: string
}

export interface ComputeLegsOptions {
  overlayName: string
  route: OverlayFeature
  /** Other waypoints in the overlay — used to label legs that end on a waypoint. */
  waypoints?: OverlayFeature[]
  bearingReference: BearingReference
  pace: Pace
  /** MGRS precision digits (1..5). 4 = 8-digit / 10m, the operationally
   *  conventional readback precision. Default 4. */
  mgrsPrecision?: number
  /** Date for the generatedAt field. Defaults to now. */
  now?: Date
}

const WAYPOINT_SNAP_M = 15

export function computeLegs(opts: ComputeLegsOptions): StripMapData {
  const {
    overlayName,
    route,
    waypoints = [],
    bearingReference,
    pace,
    mgrsPrecision = 4,
    now = new Date(),
  } = opts

  if (route.type !== 'route' || route.geometry.length < 2) {
    return {
      overlayName,
      routeName: route.label || 'Route',
      legs: [],
      totalDistanceM: 0,
      totalPaceMinutes: null,
      bearingReference,
      pace,
      generatedAt: now.toISOString(),
    }
  }

  const legs: LegRow[] = []
  let cumulative = 0

  for (let i = 0; i < route.geometry.length - 1; i++) {
    const [aLat, aLng] = route.geometry[i]
    const [bLat, bLng] = route.geometry[i + 1]
    const { distanceM, bearing: trueBearing } = legGeometry(aLat, aLng, bLat, bLng)
    cumulative += distanceM

    const midLat = (aLat + bLat) / 2
    const midLng = (aLng + bLng) / 2
    const refBearing = applyBearingReference(trueBearing, bearingReference, midLat, midLng, now)

    const startMgrs = safeMgrs(aLat, aLng, mgrsPrecision)
    const endMgrs = safeMgrs(bLat, bLng, mgrsPrecision)
    const endLabel = nearestWaypointLabel(bLat, bLng, waypoints, route.id) ?? endMgrs

    const paceMinutes = pace === 'off'
      ? null
      : distanceM / PACE_M_PER_MIN[pace]

    legs.push({
      index: i + 1,
      distanceM,
      cumulativeM: cumulative,
      trueBearing,
      refBearing,
      startMgrs,
      endMgrs,
      endLabel,
      paceMinutes,
    })
  }

  const totalPaceMinutes = pace === 'off'
    ? null
    : cumulative / PACE_M_PER_MIN[pace]

  return {
    overlayName,
    routeName: route.label || 'Route',
    legs,
    totalDistanceM: cumulative,
    totalPaceMinutes,
    bearingReference,
    pace,
    generatedAt: now.toISOString(),
  }
}

// ─────────────────────────── helpers ───────────────────────────

function legGeometry(lat1: number, lng1: number, lat2: number, lng2: number): { distanceM: number; bearing: number } {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const φ1 = toRad(lat1), φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lng2 - lng1)
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return { distanceM, bearing }
}

function safeMgrs(lat: number, lng: number, precision: number): string {
  try { return forward([lng, lat], precision) }
  catch { return '—' }
}

function nearestWaypointLabel(
  lat: number,
  lng: number,
  waypoints: OverlayFeature[],
  selfId: string,
): string | null {
  let best: { label: string; d: number } | null = null
  for (const w of waypoints) {
    if (w.id === selfId || w.geometry.length === 0) continue
    const [wLat, wLng] = w.geometry[0]
    const { distanceM } = legGeometry(lat, lng, wLat, wLng)
    if (distanceM <= WAYPOINT_SNAP_M && (!best || distanceM < best.d)) {
      best = { label: w.label || 'Waypoint', d: distanceM }
    }
  }
  return best ? best.label : null
}

// ─────────────────────────── format helpers (shared with PDF gen) ───────────

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

export function formatPaceMinutes(minutes: number | null): string {
  if (minutes == null) return '—'
  const total = Math.round(minutes * 60) // seconds
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m >= 10) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function bearingSuffix(ref: BearingReference): 'T' | 'G' | 'M' {
  if (ref === 'magnetic') return 'M'
  if (ref === 'grid') return 'G'
  return 'T'
}

export function formatBearingForRow(bearing: number, ref: BearingReference): string {
  return `${Math.round(bearing).toString().padStart(3, '0')}°${bearingSuffix(ref)}`
}
