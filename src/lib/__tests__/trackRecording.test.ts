import { describe, it, expect } from 'vitest'
import { douglasPeucker, totalDistanceMeters } from '../trackRecording'

describe('douglasPeucker', () => {
  it('returns input unchanged when length <= 2', () => {
    expect(douglasPeucker([], 5)).toEqual([])
    const one: [number, number][] = [[0, 0]]
    expect(douglasPeucker(one, 5)).toEqual(one)
    const two: [number, number][] = [[0, 0], [1, 1]]
    expect(douglasPeucker(two, 5)).toEqual(two)
  })

  it('always preserves both endpoints', () => {
    const geom: [number, number][] = [[0, 0], [0.001, 0.001], [0.002, 0.002], [0.003, 0.003]]
    const out = douglasPeucker(geom, 50)
    expect(out[0]).toEqual([0, 0])
    expect(out[out.length - 1]).toEqual([0.003, 0.003])
  })

  it('drops collinear midpoints below epsilon', () => {
    // 4 colinear points along a meridian — every midpoint has zero perp distance.
    const geom: [number, number][] = [[38.0, -77.0], [38.001, -77.0], [38.002, -77.0], [38.003, -77.0]]
    const out = douglasPeucker(geom, 1)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual([38.0, -77.0])
    expect(out[1]).toEqual([38.003, -77.0])
  })

  it('keeps a vertex whose perpendicular distance exceeds epsilon', () => {
    // ~111m east deviation at 38° lat ⇒ ~0.001 deg lng ≈ 87m — pick something well above 5m.
    const geom: [number, number][] = [
      [38.000, -77.000],
      [38.001, -76.999], // ~88m east of the great-circle line — survives epsilon=5m
      [38.002, -77.000],
    ]
    const out = douglasPeucker(geom, 5)
    expect(out).toHaveLength(3)
  })

  it('is idempotent', () => {
    const geom: [number, number][] = Array.from({ length: 50 }, (_, i) => [38 + i * 0.0001, -77 + Math.sin(i / 5) * 0.0001])
    const once = douglasPeucker(geom, 2)
    const twice = douglasPeucker(once, 2)
    expect(twice).toEqual(once)
  })
})

describe('totalDistanceMeters', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(totalDistanceMeters([])).toBe(0)
    expect(totalDistanceMeters([[0, 0]])).toBe(0)
  })

  it('matches haversine for a known meridian segment', () => {
    // 1 degree of latitude is ~110.95 km
    const d = totalDistanceMeters([[0, 0], [1, 0]])
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })

  it('sums multi-segment polylines', () => {
    const d = totalDistanceMeters([[0, 0], [0.5, 0], [1, 0]])
    const single = totalDistanceMeters([[0, 0], [1, 0]])
    expect(d).toBeCloseTo(single, 0)
  })
})
