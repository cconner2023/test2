/**
 * MGRS ↔ lat/lng conversion tests — round-trip accuracy, edge cases, invalid input.
 * Uses the `mgrs` library directly (same as MGRSConverter.tsx and MapView.tsx).
 */

import { describe, it, expect } from 'vitest'
import { forward, toPoint } from 'mgrs'

// ── Helpers ──────────────────────────────────────────────────

/** Round-trip: lat/lng → MGRS → lat/lng, check within tolerance */
function roundTrip(lat: number, lng: number, precision: number, toleranceM: number) {
  const mgrs = forward([lng, lat], precision)
  const [outLng, outLat] = toPoint(mgrs)
  // Rough meter conversion: 1° lat ≈ 111_320m, 1° lng ≈ 111_320 * cos(lat)
  const dLat = Math.abs(outLat - lat) * 111_320
  const dLng = Math.abs(outLng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180)
  return { mgrs, dLat, dLng, withinTolerance: dLat < toleranceM && dLng < toleranceM }
}

// ── Tests ────────────────────────────────────────────────────

describe('MGRS forward (lat/lng → MGRS)', () => {
  it('converts Washington DC at 5-digit precision', () => {
    const mgrs = forward([-77.0365, 38.8977], 5)
    expect(mgrs).toMatch(/^18S/)
    expect(mgrs.length).toBe(15) // GZD(3) + 100km(2) + easting(5) + northing(5)
  })

  it('converts at different precision levels', () => {
    const p1 = forward([-77.0365, 38.8977], 1)
    const p3 = forward([-77.0365, 38.8977], 3)
    const p5 = forward([-77.0365, 38.8977], 5)
    expect(p1.length).toBe(7)   // GZD(3) + 100km(2) + 1+1
    expect(p3.length).toBe(11)  // GZD(3) + 100km(2) + 3+3
    expect(p5.length).toBe(15)  // GZD(3) + 100km(2) + 5+5
  })

  it('converts equator/prime meridian intersection', () => {
    const mgrs = forward([0, 0], 5)
    expect(mgrs).toMatch(/^31N/)
  })

  it('throws for latitude above 84°', () => {
    expect(() => forward([0, 85], 5)).toThrow()
  })

  it('throws for latitude below -80°', () => {
    expect(() => forward([0, -81], 5)).toThrow()
  })
})

describe('MGRS toPoint (MGRS → lat/lng)', () => {
  it('converts a known MGRS string back to approximate lat/lng', () => {
    const [lng, lat] = toPoint('18SUJ2337106519')
    // MGRS grid cell center may differ slightly from the original coords
    expect(lat).toBeCloseTo(38.89, 1)
    expect(lng).toBeCloseTo(-77.04, 1)
  })

  it('handles whitespace in input', () => {
    const [lng, lat] = toPoint('18S UJ 23371 06519')
    expect(lat).toBeCloseTo(38.89, 1)
    expect(lng).toBeCloseTo(-77.04, 1)
  })

  it('throws on completely invalid string', () => {
    expect(() => toPoint('ZZZZZZ')).toThrow()
  })
})

describe('Round-trip accuracy', () => {
  const cases: [string, number, number][] = [
    ['Washington DC', 38.8977, -77.0365],
    ['London', 51.5074, -0.1278],
    ['Tokyo', 35.6762, 139.6503],
    ['Sydney', -33.8688, 151.2093],
    ['Equator/PM', 0, 0],
    ['Near south limit', -79.5, 10],
    ['Near north limit', 83.5, 10],
  ]

  for (const [name, lat, lng] of cases) {
    it(`round-trips ${name} within 1m at precision 5`, () => {
      const { withinTolerance } = roundTrip(lat, lng, 5, 1)
      expect(withinTolerance).toBe(true)
    })
  }

  it('round-trips within 10m at precision 4', () => {
    const { withinTolerance } = roundTrip(38.8977, -77.0365, 4, 10)
    expect(withinTolerance).toBe(true)
  })

  it('round-trips within 100m at precision 3', () => {
    const { withinTolerance } = roundTrip(38.8977, -77.0365, 3, 100)
    expect(withinTolerance).toBe(true)
  })
})
