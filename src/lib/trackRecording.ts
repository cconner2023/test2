/**
 * GPS track recording — adaptive sampling, IDB-buffered, Douglas-Peucker
 * decimation on save, optional WakeLock to keep the screen on.
 *
 * The buffer persists per-overlayId so a reload mid-recording recovers state.
 * Saved tracks become OverlayFeatures (type='route', recorded=true) and flow
 * through the existing autosave path.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { getDb, type TrackBufferEntry } from './offlineDb'

// ─────────────────────────── DECIMATION ───────────────────────────

/**
 * Douglas-Peucker polyline simplification. Drops vertices whose
 * perpendicular distance to the line through their neighbors is below
 * `epsilonM`. Distance approximated planarly via meters/degree at the
 * polyline's mid-latitude — well below 1% error at AO scales.
 *
 * Endpoints are always preserved.
 */
export function douglasPeucker(
  geometry: [number, number][],
  epsilonM: number,
): [number, number][] {
  if (geometry.length <= 2) return [...geometry]

  const midLat = geometry[Math.floor(geometry.length / 2)][0]
  const mPerDegLat = 111_320
  const mPerDegLng = 111_320 * Math.cos((midLat * Math.PI) / 180)

  function perpDistMeters(p: [number, number], a: [number, number], b: [number, number]): number {
    const ax = a[1] * mPerDegLng, ay = a[0] * mPerDegLat
    const bx = b[1] * mPerDegLng, by = b[0] * mPerDegLat
    const px = p[1] * mPerDegLng, py = p[0] * mPerDegLat
    const dx = bx - ax, dy = by - ay
    const len = Math.hypot(dx, dy)
    if (len === 0) return Math.hypot(px - ax, py - ay)
    const t = ((px - ax) * dx + (py - ay) * dy) / (len * len)
    const cx = ax + t * dx, cy = ay + t * dy
    return Math.hypot(px - cx, py - cy)
  }

  function recurse(start: number, end: number, keep: boolean[]) {
    let maxDist = 0
    let maxIdx = -1
    for (let i = start + 1; i < end; i++) {
      const d = perpDistMeters(geometry[i], geometry[start], geometry[end])
      if (d > maxDist) { maxDist = d; maxIdx = i }
    }
    if (maxDist > epsilonM && maxIdx >= 0) {
      keep[maxIdx] = true
      recurse(start, maxIdx, keep)
      recurse(maxIdx, end, keep)
    }
  }

  const keep = new Array(geometry.length).fill(false)
  keep[0] = true
  keep[geometry.length - 1] = true
  recurse(0, geometry.length - 1, keep)
  return geometry.filter((_, i) => keep[i])
}

/** Cumulative distance along a polyline in meters (haversine). */
export function totalDistanceMeters(geometry: [number, number][]): number {
  if (geometry.length < 2) return 0
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  let sum = 0
  for (let i = 1; i < geometry.length; i++) {
    const [lat1, lng1] = geometry[i - 1]
    const [lat2, lng2] = geometry[i]
    const φ1 = toRad(lat1), φ2 = toRad(lat2)
    const Δφ = toRad(lat2 - lat1)
    const Δλ = toRad(lng2 - lng1)
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
    sum += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return sum
}

// ─────────────────────────── BUFFER PERSISTENCE ───────────────────────────

export async function loadTrackBuffer(overlayId: string): Promise<TrackBufferEntry | null> {
  try {
    const db = await getDb()
    return (await db.get('trackBuffer', overlayId)) ?? null
  } catch { return null }
}

export async function saveTrackBuffer(entry: TrackBufferEntry): Promise<void> {
  try {
    const db = await getDb()
    await db.put('trackBuffer', entry)
  } catch { /* best-effort buffer */ }
}

export async function clearTrackBuffer(overlayId: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('trackBuffer', overlayId)
  } catch { /* swallow — clearing a missing buffer is fine */ }
}

// ─────────────────────────── HOOK ───────────────────────────

export type RecorderStatus = 'idle' | 'recording' | 'paused'

export interface UseTrackRecorderArgs {
  overlayId: string | null
  /** Live GPS feed from useGeolocation — null when GPS unavailable. */
  gps: { lat: number; lng: number; accuracy: number } | null
}

export interface UseTrackRecorderReturn {
  status: RecorderStatus
  points: [number, number, string][]
  startedAt: string | null
  /** Distance accumulated so far, in meters (raw, not decimated). */
  distanceM: number
  start: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  /** Stop and return the recorded track ready to be turned into a feature.
   *  Returns null when there's nothing usable. */
  stop: () => Promise<RecordingResult | null>
  /** Drop the active buffer without producing a feature. */
  discard: () => Promise<void>
}

export interface RecordingResult {
  geometry: [number, number][]   // already decimated
  rawCount: number               // original sample count before decimation
  startedAt: string
  endedAt: string
  distanceM: number
}

/** Sample-rate control. Active recording aims for ~5s between persisted
 *  samples while moving; samples that haven't moved more than this many
 *  meters from the previous accepted point are dropped (deduplication). */
const MIN_MOVE_M = 4
const PERSIST_INTERVAL_MS = 5_000
const DECIMATE_EPSILON_M = 3

export function useTrackRecorder({ overlayId, gps }: UseTrackRecorderArgs): UseTrackRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [points, setPoints] = useState<[number, number, string][]>([])
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [distanceM, setDistanceM] = useState(0)

  const lastPersistRef = useRef<number>(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const overlayIdRef = useRef(overlayId)
  useEffect(() => { overlayIdRef.current = overlayId }, [overlayId])

  // Recover any in-progress buffer when the overlay opens. Status restored
  // is whatever was persisted (paused buffers come back paused).
  useEffect(() => {
    if (!overlayId) return
    let cancelled = false
    loadTrackBuffer(overlayId).then(buf => {
      if (cancelled || !buf || buf.points.length === 0) return
      setPoints(buf.points)
      setStartedAt(buf.startedAt)
      setStatus(buf.status)
      const geom = buf.points.map(([la, ln]) => [la, ln] as [number, number])
      setDistanceM(totalDistanceMeters(geom))
    })
    return () => { cancelled = true }
  }, [overlayId])

  // Sample GPS while recording (paused does NOT capture).
  useEffect(() => {
    if (status !== 'recording' || !gps) return
    const now = Date.now()
    setPoints(prev => {
      const last = prev[prev.length - 1]
      if (last) {
        const movedM = haversineMeters(last[0], last[1], gps.lat, gps.lng)
        if (movedM < MIN_MOVE_M) return prev
      }
      const next = [...prev, [gps.lat, gps.lng, new Date().toISOString()] as [number, number, string]]
      // Throttled persistence — write through to IDB at most every 5s.
      if (now - lastPersistRef.current > PERSIST_INTERVAL_MS && overlayIdRef.current && startedAt) {
        lastPersistRef.current = now
        saveTrackBuffer({
          overlayId: overlayIdRef.current,
          startedAt,
          points: next,
          status: 'recording',
        })
      }
      return next
    })
  }, [gps, status, startedAt])

  // Recompute distance whenever points changes (cheap — incremental would be
  // an optimization for very long tracks, not needed at field-op scale).
  useEffect(() => {
    setDistanceM(totalDistanceMeters(points.map(([la, ln]) => [la, ln])))
  }, [points])

  const acquireWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined') return
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock
    if (!wl) return
    try { wakeLockRef.current = await wl.request('screen') }
    catch { /* permission denied or unsupported — soldier on */ }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    try { await wakeLockRef.current?.release() } catch { /* idempotent */ }
    wakeLockRef.current = null
  }, [])

  const start = useCallback(async () => {
    if (!overlayId) return
    const startIso = new Date().toISOString()
    setStartedAt(startIso)
    setPoints([])
    setDistanceM(0)
    setStatus('recording')
    await saveTrackBuffer({ overlayId, startedAt: startIso, points: [], status: 'recording' })
    await acquireWakeLock()
  }, [overlayId, acquireWakeLock])

  const pause = useCallback(async () => {
    setStatus(prev => (prev === 'recording' ? 'paused' : prev))
    if (overlayIdRef.current && startedAt) {
      await saveTrackBuffer({
        overlayId: overlayIdRef.current,
        startedAt,
        points,
        status: 'paused',
      })
    }
    await releaseWakeLock()
  }, [points, startedAt, releaseWakeLock])

  const resume = useCallback(async () => {
    setStatus(prev => (prev === 'paused' ? 'recording' : prev))
    if (overlayIdRef.current && startedAt) {
      await saveTrackBuffer({
        overlayId: overlayIdRef.current,
        startedAt,
        points,
        status: 'recording',
      })
    }
    await acquireWakeLock()
  }, [points, startedAt, acquireWakeLock])

  const stop = useCallback(async (): Promise<RecordingResult | null> => {
    if (points.length === 0 || !startedAt) {
      if (overlayIdRef.current) await clearTrackBuffer(overlayIdRef.current)
      setStatus('idle')
      setPoints([])
      setStartedAt(null)
      setDistanceM(0)
      await releaseWakeLock()
      return null
    }
    const rawGeom = points.map(([la, ln]) => [la, ln] as [number, number])
    const decimated = douglasPeucker(rawGeom, DECIMATE_EPSILON_M)
    const result: RecordingResult = {
      geometry: decimated,
      rawCount: rawGeom.length,
      startedAt,
      endedAt: new Date().toISOString(),
      distanceM: totalDistanceMeters(rawGeom),
    }
    if (overlayIdRef.current) await clearTrackBuffer(overlayIdRef.current)
    setStatus('idle')
    setPoints([])
    setStartedAt(null)
    setDistanceM(0)
    await releaseWakeLock()
    return result
  }, [points, startedAt, releaseWakeLock])

  const discard = useCallback(async () => {
    if (overlayIdRef.current) await clearTrackBuffer(overlayIdRef.current)
    setStatus('idle')
    setPoints([])
    setStartedAt(null)
    setDistanceM(0)
    await releaseWakeLock()
  }, [releaseWakeLock])

  return { status, points, startedAt, distanceM, start, pause, resume, stop, discard }
}

// ─────────────────────────── INTERNAL ───────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const φ1 = toRad(lat1), φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lng2 - lng1)
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
