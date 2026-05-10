import { describe, it, expect } from 'vitest'
import { tmsYToXyzY, xyzYToTmsY, mimeForFormat } from '../mbtilesShared'

describe('TMS ↔ XYZ y-axis conversion', () => {
  it('flips top and bottom rows at zoom 0', () => {
    // Zoom 0 has exactly one tile (0,0) — both axes agree.
    expect(tmsYToXyzY(0, 0)).toBe(0)
    expect(xyzYToTmsY(0, 0)).toBe(0)
  })

  it('flips correctly at zoom 1 (2x2 grid)', () => {
    // TMS y=0 (bottom) ↔ XYZ y=1 (bottom of XYZ since y=0 is top)
    expect(tmsYToXyzY(1, 0)).toBe(1)
    expect(tmsYToXyzY(1, 1)).toBe(0)
    expect(xyzYToTmsY(1, 1)).toBe(0)
    expect(xyzYToTmsY(1, 0)).toBe(1)
  })

  it('flips correctly at zoom 13 (large grid)', () => {
    const max = (1 << 13) - 1  // 8191
    expect(tmsYToXyzY(13, 0)).toBe(max)
    expect(tmsYToXyzY(13, max)).toBe(0)
    expect(tmsYToXyzY(13, 4096)).toBe(max - 4096)
  })

  it('round-trips: tmsToXyz then xyzToTms is identity', () => {
    for (const z of [3, 8, 13]) {
      for (const tmsY of [0, 1, (1 << z) - 1, Math.floor((1 << z) / 2)]) {
        expect(xyzYToTmsY(z, tmsYToXyzY(z, tmsY))).toBe(tmsY)
      }
    }
  })
})

describe('mimeForFormat', () => {
  it('maps common raster formats', () => {
    expect(mimeForFormat('png')).toBe('image/png')
    expect(mimeForFormat('PNG')).toBe('image/png')
    expect(mimeForFormat('jpg')).toBe('image/jpeg')
    expect(mimeForFormat('jpeg')).toBe('image/jpeg')
    expect(mimeForFormat('webp')).toBe('image/webp')
  })

  it('flags vector tiles distinctly', () => {
    expect(mimeForFormat('pbf')).toBe('application/x-protobuf')
  })

  it('falls back to PNG for unknown formats', () => {
    expect(mimeForFormat('mystery')).toBe('image/png')
    expect(mimeForFormat('')).toBe('image/png')
  })
})
