import { describe, it, expect } from 'vitest'
import { lngToTileX, latToTileY, tileToLngLat, bboxToTileRange, tileCount, pickMaxZoom } from '../tileMath'

describe('tile coordinate math', () => {
  it('zoom 0 has exactly one tile covering most of the world (right/bottom edges excluded by floor)', () => {
    // Use bounds that are strictly inside the world tile to avoid edge-floor overshoot.
    const range = bboxToTileRange([-179.9, -84.9, 179.9, 84.9], 0)
    expect(tileCount(range)).toBe(1)
    expect(range).toEqual({ xMin: 0, xMax: 0, yMin: 0, yMax: 0 })
  })

  it('zoom 1 covers the four world quadrants', () => {
    const range = bboxToTileRange([-179.9, -84.9, 179.9, 84.9], 1)
    expect(tileCount(range)).toBe(4)
  })

  it('lngToTileX maps Greenwich correctly', () => {
    expect(lngToTileX(0, 0)).toBe(0)
    expect(lngToTileX(0, 1)).toBe(1) // right edge of zoom-1 left half
  })

  it('north → smaller y, south → larger y (XYZ axis)', () => {
    expect(latToTileY(80, 4)).toBeLessThan(latToTileY(0, 4))
    expect(latToTileY(0, 4)).toBeLessThan(latToTileY(-80, 4))
  })

  it('tileToLngLat returns top-left corner', () => {
    const tl = tileToLngLat(0, 0, 0)
    expect(tl.lng).toBe(-180)
    expect(tl.lat).toBeCloseTo(85.0511, 3)
  })

  it('bboxToTileRange covers a small bbox with at least one tile per axis', () => {
    const range = bboxToTileRange([-77.05, 38.89, -77.04, 38.90], 14)
    expect(range.xMax).toBeGreaterThanOrEqual(range.xMin)
    expect(range.yMax).toBeGreaterThanOrEqual(range.yMin)
    expect(tileCount(range)).toBeGreaterThan(0)
  })

  describe('pickMaxZoom', () => {
    it('returns 0 when source is smaller than one tile', () => {
      expect(pickMaxZoom([-180, -85, 180, 85], 100, 100)).toBe(0)
    })

    it('grows with source resolution', () => {
      const small = pickMaxZoom([-77.05, 38.89, -77.04, 38.90], 256, 256)
      const big = pickMaxZoom([-77.05, 38.89, -77.04, 38.90], 4096, 4096)
      expect(big).toBeGreaterThan(small)
    })

    it('honors the hard cap', () => {
      const z = pickMaxZoom([-77.05, 38.89, -77.04, 38.90], 1_000_000, 1_000_000, 12)
      expect(z).toBeLessThanOrEqual(12)
    })
  })
})
