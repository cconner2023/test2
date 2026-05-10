import { describe, it, expect } from 'vitest'
import {
  magneticDeclination,
  gridConvergence,
  applyBearingReference,
  formatBearing,
} from '../declination'

describe('magneticDeclination', () => {
  it('returns westward (negative) declination for Washington DC', () => {
    // ~10° west in 2025–2026
    const decl = magneticDeclination(38.8977, -77.0365, new Date('2026-01-01'))
    expect(decl).toBeLessThan(-8)
    expect(decl).toBeGreaterThan(-13)
  })

  it('returns eastward (positive) declination for Anchorage', () => {
    const decl = magneticDeclination(61.2181, -149.9003, new Date('2026-01-01'))
    expect(decl).toBeGreaterThan(10)
    expect(decl).toBeLessThan(20)
  })
})

describe('gridConvergence', () => {
  it('is zero on a UTM zone central meridian', () => {
    // Zone 18 central meridian is -75°
    expect(Math.abs(gridConvergence(40, -75))).toBeLessThan(1e-9)
  })

  it('grows with latitude on the same meridian', () => {
    const lng = -78 // ~3° west of zone 18 central meridian
    const cAtEquator = gridConvergence(0, lng)
    const cAtMid = gridConvergence(45, lng)
    expect(Math.abs(cAtEquator)).toBeLessThan(Math.abs(cAtMid))
  })

  it('flips sign across the central meridian', () => {
    const east = gridConvergence(40, -73) // east of -75
    const west = gridConvergence(40, -77) // west of -75
    expect(Math.sign(east)).toBe(-Math.sign(west))
  })
})

describe('applyBearingReference', () => {
  const lat = 38.8977
  const lng = -77.0365
  const date = new Date('2026-01-01')

  it('returns the true bearing unchanged for ref=true', () => {
    expect(applyBearingReference(120, 'true', lat, lng, date)).toBeCloseTo(120, 5)
  })

  it('magnetic bearing > true bearing in westward-declination region', () => {
    // decl is negative ~ -10° → magnetic = true - (-10) = true + 10
    const m = applyBearingReference(120, 'magnetic', lat, lng, date)
    expect(m).toBeGreaterThan(120)
    expect(m).toBeLessThan(135)
  })

  it('wraps into [0, 360)', () => {
    const v = applyBearingReference(5, 'magnetic', 61.2181, -149.9003, date) // east decl ~+15
    // 5 - 15 = -10 → wraps to 350
    expect(v).toBeGreaterThan(340)
    expect(v).toBeLessThan(360)
  })
})

describe('formatBearing', () => {
  it('zero-pads to 3 digits and appends suffix', () => {
    const s = formatBearing(45, 'true', 0, 0)
    expect(s).toBe('045°T')
  })
})
