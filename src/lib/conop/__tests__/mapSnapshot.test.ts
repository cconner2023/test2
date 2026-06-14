import { describe, it, expect } from 'vitest'
import { lngToWorldX, latToWorldY, fitZoom, padBbox } from '../mapSnapshot'

describe('CONOP map snapshot projection', () => {
  it('lngToWorldX maps longitude linearly across the world width', () => {
    // World pixel width at zoom z is 256 * 2^z.
    expect(lngToWorldX(-180, 0)).toBeCloseTo(0)
    expect(lngToWorldX(180, 0)).toBeCloseTo(256)
    expect(lngToWorldX(0, 0)).toBeCloseTo(128)
    expect(lngToWorldX(0, 2)).toBeCloseTo(512) // 256 * 4 / 2
  })

  it('latToWorldY is monotonic: north → smaller Y than south', () => {
    expect(latToWorldY(80, 4)).toBeLessThan(latToWorldY(0, 4))
    expect(latToWorldY(0, 4)).toBeLessThan(latToWorldY(-80, 4))
    // Equator sits at the vertical midpoint.
    expect(latToWorldY(0, 0)).toBeCloseTo(128)
  })

  it('fitZoom backs off for a wide bbox and saturates for a tiny one', () => {
    const wide = fitZoom([-100, -40, 100, 40], 1040, 980, 19)
    const tiny = fitZoom([-77.001, 38.899, -76.999, 38.901], 1040, 980, 19)
    expect(tiny).toBeGreaterThan(wide)
    expect(tiny).toBeLessThanOrEqual(19) // never exceeds the source maxZoom
  })

  it('fitZoom result actually fits the bbox within the target dimensions', () => {
    const bbox: [number, number, number, number] = [-77.05, 38.88, -77.0, 38.92]
    const w = 1040
    const h = 980
    const z = fitZoom(bbox, w, h, 19)
    const spanX = lngToWorldX(bbox[2], z) - lngToWorldX(bbox[0], z)
    const spanY = latToWorldY(bbox[1], z) - latToWorldY(bbox[3], z)
    expect(spanX).toBeLessThanOrEqual(w)
    expect(spanY).toBeLessThanOrEqual(h)
    // One zoom deeper would overflow at least one axis.
    const deeperX = lngToWorldX(bbox[2], z + 1) - lngToWorldX(bbox[0], z + 1)
    const deeperY = latToWorldY(bbox[1], z + 1) - latToWorldY(bbox[3], z + 1)
    expect(deeperX > w || deeperY > h).toBe(true)
  })

  it('padBbox expands outward by a fraction of span and clamps to web-mercator limits', () => {
    const [w, s, e, n] = padBbox([-10, -10, 10, 10], 0.1)
    expect(w).toBeCloseTo(-12)
    expect(e).toBeCloseTo(12)
    expect(s).toBeCloseTo(-12)
    expect(n).toBeCloseTo(12)
    // Latitude clamps to ±85 (Web Mercator), longitude to ±180.
    const clamped = padBbox([-179, -84, 179, 84], 0.5)
    expect(clamped[0]).toBeGreaterThanOrEqual(-180)
    expect(clamped[1]).toBeGreaterThanOrEqual(-85)
    expect(clamped[3]).toBeLessThanOrEqual(85)
  })
})
