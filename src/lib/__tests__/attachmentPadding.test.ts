import { describe, it, expect } from 'vitest'
import { padAttachment, unpadAttachment, paddedLength, isPaddedKey } from '../attachmentPadding'

describe('attachment padding', () => {
  it('round-trips arbitrary lengths', () => {
    for (const len of [0, 1, 536, 537, 1000, 65_536, 1_234_567]) {
      const bytes = crypto.getRandomValues(new Uint8Array(Math.min(len, 65_536)))
      const src = len > 65_536 ? new Uint8Array(len).map((_, i) => bytes[i % bytes.length]) : bytes
      const padded = padAttachment(src)
      expect(padded.byteLength).toBe(paddedLength(src.byteLength + 4))
      expect(unpadAttachment(padded)).toEqual(src)
    }
  })

  it('never pads below the 541-byte floor and grows at most ~5%', () => {
    expect(paddedLength(1)).toBe(541)
    for (const len of [10_000, 1_000_000, 25 * 1024 * 1024]) {
      const p = paddedLength(len)
      expect(p).toBeGreaterThanOrEqual(len)
      expect(p / len).toBeLessThan(1.051)
    }
  })

  it('maps many nearby sizes to one bucket', () => {
    expect(paddedLength(100_000)).toBe(paddedLength(100_100))
  })

  it('rejects a length prefix larger than the buffer', () => {
    const bad = new Uint8Array(8)
    new DataView(bad.buffer).setUint32(0, 100, false)
    expect(() => unpadAttachment(bad)).toThrow()
  })

  it('pads only message and voicemail keys', () => {
    expect(isPaddedKey('m/abc')).toBe(true)
    expect(isPaddedKey('v/abc')).toBe(true)
    expect(isPaddedKey('p/abc')).toBe(false)
    expect(isPaddedKey('p/cert/a/b')).toBe(false)
    expect(isPaddedKey('user/uuid.enc')).toBe(false)
  })
})
