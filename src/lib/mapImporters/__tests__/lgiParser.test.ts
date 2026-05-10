import { describe, it, expect } from 'vitest'
import { detectGeoRef } from '../lgiParser'

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

describe('detectGeoRef — PDF 1.7 /VP /Measure /GPTS', () => {
  it('extracts bbox from a standard GPTS array', () => {
    // GPTS is the corners of the LPTS bbox in lat,lng pairs.
    const pdf = `
      %PDF-1.7
      1 0 obj
      << /Type /Viewport /BBox [0 0 100 100]
         /Measure <<
           /Type /Measure
           /Subtype /GEO
           /GPTS [38.89 -77.05  38.89 -77.04  38.90 -77.04  38.90 -77.05]
         >>
      >>
      endobj
    `
    const r = detectGeoRef(bytes(pdf))
    expect(r).not.toBeNull()
    expect(r!.source).toBe('vp-measure-gpts')
    expect(r!.bounds[0]).toBeCloseTo(-77.05)
    expect(r!.bounds[1]).toBeCloseTo(38.89)
    expect(r!.bounds[2]).toBeCloseTo(-77.04)
    expect(r!.bounds[3]).toBeCloseTo(38.90)
  })

  it('handles GPTS emitted in (lng, lat) order by detecting the swap', () => {
    const pdf = `
      /Subtype /GEO
      /GPTS [-77.05 38.89  -77.04 38.89  -77.04 38.90  -77.05 38.90]
    `
    const r = detectGeoRef(bytes(pdf))
    expect(r).not.toBeNull()
    expect(r!.bounds[0]).toBeCloseTo(-77.05)
    expect(r!.bounds[3]).toBeCloseTo(38.90)
  })

  it('returns null when /Subtype /GEO is missing', () => {
    const pdf = `/GPTS [38.89 -77.05  38.90 -77.04]`
    expect(detectGeoRef(bytes(pdf))).toBeNull()
  })

  it('returns null when GPTS values are out of geographic range and not swap-fixable', () => {
    const pdf = `/Subtype /GEO /GPTS [200 200 200 200 200 200 200 200]`
    expect(detectGeoRef(bytes(pdf))).toBeNull()
  })
})

describe('detectGeoRef — Adobe /LGIDict /Registration', () => {
  it('extracts bbox from a 4-tuple registration table', () => {
    const pdf = `
      /LGIDict
      << /Version (2.1)
         /Registration [
           [10 10 -77.05 38.89]
           [990 10 -77.04 38.89]
           [990 990 -77.04 38.90]
           [10 990 -77.05 38.90]
         ]
      >>
    `
    const r = detectGeoRef(bytes(pdf))
    expect(r).not.toBeNull()
    expect(r!.source).toBe('lgi-registration')
    expect(r!.bounds[0]).toBeCloseTo(-77.05)
    expect(r!.bounds[1]).toBeCloseTo(38.89)
    expect(r!.bounds[2]).toBeCloseTo(-77.04)
    expect(r!.bounds[3]).toBeCloseTo(38.90)
  })

  it('handles 6-tuple rows by reading the LAST two values as (lng, lat)', () => {
    const pdf = `
      /LGIDict
      << /Registration [
           [10 10 0 0 -77.05 38.89]
           [990 990 0 0 -77.04 38.90]
         ]
      >>
    `
    const r = detectGeoRef(bytes(pdf))
    expect(r).not.toBeNull()
    expect(r!.bounds[0]).toBeCloseTo(-77.05)
    expect(r!.bounds[3]).toBeCloseTo(38.90)
  })

  it('returns null when fewer than 2 valid rows', () => {
    const pdf = `
      /LGIDict
      << /Registration [
           [10 10 -77.05 38.89]
         ]
      >>
    `
    expect(detectGeoRef(bytes(pdf))).toBeNull()
  })
})

describe('detectGeoRef — overall', () => {
  it('returns null on a PDF without any georef', () => {
    const pdf = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >>\nendobj`
    expect(detectGeoRef(bytes(pdf))).toBeNull()
  })

  it('prefers VP-Measure when both structures are present', () => {
    const pdf = `
      /Subtype /GEO
      /GPTS [38.89 -77.05  38.89 -77.04  38.90 -77.04  38.90 -77.05]

      /LGIDict
      << /Registration [
           [10 10 -78.00 39.00]
           [990 990 -77.50 39.50]
         ]
      >>
    `
    const r = detectGeoRef(bytes(pdf))
    expect(r!.source).toBe('vp-measure-gpts')
    // Used /GPTS bounds, not /LGIDict bounds.
    expect(r!.bounds[0]).toBeCloseTo(-77.05)
  })
})
