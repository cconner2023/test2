import { describe, it, expect } from 'vitest'
import { computeLegs, formatDistance, formatPaceMinutes, formatBearingForRow } from '../computeLegs'
import type { OverlayFeature } from '../../../Types/MapOverlayTypes'

const NOW = new Date('2026-05-10T12:00:00Z')

function route(coords: [number, number][], label = 'Route 1'): OverlayFeature {
  return {
    id: 'rt-1', overlay_id: 'ov-1', type: 'route',
    geometry: coords,
    label,
    style: { color: '#000', weight: 3, opacity: 1 },
    created_at: NOW.toISOString(), updated_at: NOW.toISOString(),
  }
}

function waypoint(lat: number, lng: number, label: string, id = 'wp'): OverlayFeature {
  return {
    id, overlay_id: 'ov-1', type: 'waypoint',
    geometry: [[lat, lng]],
    label,
    style: { color: '#000', weight: 3, opacity: 1 },
    created_at: NOW.toISOString(), updated_at: NOW.toISOString(),
  }
}

describe('computeLegs', () => {
  it('returns empty for fewer than 2 vertices', () => {
    const data = computeLegs({
      overlayName: 'Ov',
      route: route([[38.89, -77.05]]),
      bearingReference: 'true',
      pace: 'off',
      now: NOW,
    })
    expect(data.legs).toHaveLength(0)
    expect(data.totalDistanceM).toBe(0)
  })

  it('produces N-1 legs from N vertices', () => {
    const data = computeLegs({
      overlayName: 'Ov',
      route: route([[38.89, -77.05], [38.90, -77.05], [38.91, -77.05]]),
      bearingReference: 'true',
      pace: 'off',
      now: NOW,
    })
    expect(data.legs).toHaveLength(2)
    expect(data.legs[0].index).toBe(1)
    expect(data.legs[1].index).toBe(2)
  })

  it('cumulative distance matches sum of legs', () => {
    const data = computeLegs({
      overlayName: 'Ov',
      route: route([[38.89, -77.05], [38.90, -77.05], [38.91, -77.05]]),
      bearingReference: 'true', pace: 'off', now: NOW,
    })
    const summed = data.legs.reduce((s, l) => s + l.distanceM, 0)
    expect(data.legs[data.legs.length - 1].cumulativeM).toBeCloseTo(summed, 5)
    expect(data.totalDistanceM).toBeCloseTo(summed, 5)
  })

  it('north-pointing leg has true bearing near 0°', () => {
    const data = computeLegs({
      overlayName: 'Ov',
      route: route([[38.89, -77.05], [38.90, -77.05]]),
      bearingReference: 'true', pace: 'off', now: NOW,
    })
    expect(data.legs[0].trueBearing).toBeLessThan(2)
  })

  it('east-pointing leg has true bearing near 90°', () => {
    const data = computeLegs({
      overlayName: 'Ov',
      route: route([[38.89, -77.05], [38.89, -77.04]]),
      bearingReference: 'true', pace: 'off', now: NOW,
    })
    expect(data.legs[0].trueBearing).toBeGreaterThan(88)
    expect(data.legs[0].trueBearing).toBeLessThan(92)
  })

  it('100 m/min pace gives ~10 minutes per kilometer', () => {
    const data = computeLegs({
      overlayName: 'Ov',
      // Two points ~1km apart along a meridian (~0.009 deg lat ≈ 1km).
      route: route([[38.89, -77.05], [38.899, -77.05]]),
      bearingReference: 'true', pace: '100', now: NOW,
    })
    expect(data.legs[0].paceMinutes).not.toBeNull()
    expect(data.legs[0].paceMinutes!).toBeGreaterThan(9)
    expect(data.legs[0].paceMinutes!).toBeLessThan(11)
  })

  it('80 m/min pace is slower than 100 m/min for the same distance', () => {
    const r = route([[38.89, -77.05], [38.90, -77.05]])
    const fast = computeLegs({ overlayName: 'O', route: r, bearingReference: 'true', pace: '100', now: NOW })
    const slow = computeLegs({ overlayName: 'O', route: r, bearingReference: 'true', pace: '80', now: NOW })
    expect(slow.legs[0].paceMinutes!).toBeGreaterThan(fast.legs[0].paceMinutes!)
  })

  it('pace=off leaves paceMinutes null', () => {
    const data = computeLegs({
      overlayName: 'Ov',
      route: route([[38.89, -77.05], [38.90, -77.05]]),
      bearingReference: 'true', pace: 'off', now: NOW,
    })
    expect(data.legs[0].paceMinutes).toBeNull()
    expect(data.totalPaceMinutes).toBeNull()
  })

  it('endLabel uses a nearby waypoint name when within 15m of the leg end', () => {
    const wp = waypoint(38.90, -77.05, 'Rally Point')
    const data = computeLegs({
      overlayName: 'Ov',
      route: route([[38.89, -77.05], [38.90, -77.05]]),
      waypoints: [wp],
      bearingReference: 'true', pace: 'off', now: NOW,
    })
    expect(data.legs[0].endLabel).toBe('Rally Point')
  })

  it('endLabel falls back to MGRS when no nearby waypoint', () => {
    const data = computeLegs({
      overlayName: 'Ov',
      route: route([[38.89, -77.05], [38.90, -77.05]]),
      bearingReference: 'true', pace: 'off', now: NOW,
    })
    expect(data.legs[0].endLabel).toMatch(/^[0-9]+[A-Z]/)
  })
})

describe('format helpers', () => {
  it('formatDistance switches at 1km', () => {
    expect(formatDistance(950)).toBe('950 m')
    expect(formatDistance(1500)).toBe('1.50 km')
  })

  it('formatPaceMinutes handles null + various ranges', () => {
    expect(formatPaceMinutes(null)).toBe('—')
    expect(formatPaceMinutes(0.5)).toMatch(/^0:\d{2}$/)        // < 10 min → m:ss
    expect(formatPaceMinutes(15)).toMatch(/^15m \d{2}s$/)      // ≥ 10 min → Mm SSs
    expect(formatPaceMinutes(95)).toMatch(/^1h \d{2}m$/)       // ≥ 60 min → Hh MMm
  })

  it('formatBearingForRow zero-pads to 3 digits and appends suffix', () => {
    expect(formatBearingForRow(45, 'true')).toBe('045°T')
    expect(formatBearingForRow(180, 'grid')).toBe('180°G')
    expect(formatBearingForRow(7, 'magnetic')).toBe('007°M')
  })
})
