/**
 * Tests for wireFormat.ts — binary conversion helpers, UUID conversion,
 * frame encode/decode round-trips, confirmation encode/decode, and segmentation.
 */

import { describe, it, expect } from 'vitest'
import {
  bytesToHex,
  hexToBytes,
  uuidToBytes,
  bytesToUuid,
  shortIdToHex,
  encodeFrame,
  decodeFrame,
  encodeConfirmation,
  decodeConfirmation,
  segmentPayload,
  reassemblePayload,
} from '../wireFormat'
import {
  LORA_HEADER_FIXED,
  LORA_SIGNATURE,
} from '../types'
import type { LoRaFrame, ConfirmationFrame } from '../types'

// ═════════════════════════════════════════════════════════════════════════
// 1. bytesToHex / hexToBytes round-trips (previously duplicated)
// ═════════════════════════════════════════════════════════════════════════

describe('bytesToHex / hexToBytes', () => {
  it('round-trips a simple byte array', () => {
    const original = new Uint8Array([0x00, 0xff, 0x42, 0xab])
    const hex = bytesToHex(original)
    expect(hex).toBe('00ff42ab')
    const recovered = hexToBytes(hex)
    expect(recovered).toEqual(original)
  })

  it('round-trips empty array', () => {
    const original = new Uint8Array(0)
    const hex = bytesToHex(original)
    expect(hex).toBe('')
    expect(hexToBytes(hex)).toEqual(original)
  })

  it('round-trips single byte', () => {
    const original = new Uint8Array([0x0a])
    const hex = bytesToHex(original)
    expect(hex).toBe('0a')
    expect(hexToBytes(hex)).toEqual(original)
  })

  it('round-trips 8-byte short ID', () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe])
    const hex = bytesToHex(original)
    expect(hex).toBe('deadbeefcafebabe')
    expect(hexToBytes(hex)).toEqual(original)
  })

  it('round-trips 16-byte message ID', () => {
    const original = new Uint8Array(16)
    for (let i = 0; i < 16; i++) original[i] = i * 16 + i
    const hex = bytesToHex(original)
    expect(hex).toHaveLength(32)
    expect(hexToBytes(hex)).toEqual(original)
  })

  it('pads single-digit hex values with leading zero', () => {
    expect(bytesToHex(new Uint8Array([0x00]))).toBe('00')
    expect(bytesToHex(new Uint8Array([0x01]))).toBe('01')
    expect(bytesToHex(new Uint8Array([0x0f]))).toBe('0f')
  })

  it('hexToBytes handles uppercase hex', () => {
    const bytes = hexToBytes('DEADBEEF')
    expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 2. shortIdToHex
// ═════════════════════════════════════════════════════════════════════════

describe('shortIdToHex', () => {
  it('converts 8-byte ID to 16-char hex', () => {
    const id = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
    expect(shortIdToHex(id)).toBe('0102030405060708')
  })

  it('only uses first 8 bytes if array is longer', () => {
    const id = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x99, 0x99])
    expect(shortIdToHex(id)).toBe('aabbccddeeff0011')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 3. UUID conversion
// ═════════════════════════════════════════════════════════════════════════

describe('UUID conversion', () => {
  it('uuidToBytes → bytesToUuid round-trips', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const bytes = uuidToBytes(uuid)
    expect(bytes).toHaveLength(16)
    expect(bytesToUuid(bytes)).toBe(uuid)
  })

  it('uuidToBytes strips dashes and converts to bytes', () => {
    const uuid = '00000000-0000-0000-0000-000000000001'
    const bytes = uuidToBytes(uuid)
    expect(bytes[15]).toBe(1)
    for (let i = 0; i < 15; i++) expect(bytes[i]).toBe(0)
  })

  it('uuidToBytes throws on invalid UUID', () => {
    expect(() => uuidToBytes('not-a-uuid')).toThrow('Invalid UUID')
  })

  it('bytesToUuid throws on wrong length', () => {
    expect(() => bytesToUuid(new Uint8Array(8))).toThrow('Expected 16 bytes')
  })

  it('round-trips a random UUID', () => {
    const uuid = crypto.randomUUID()
    const bytes = uuidToBytes(uuid)
    expect(bytesToUuid(bytes)).toBe(uuid)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 4. Frame encode/decode round-trips
// ═════════════════════════════════════════════════════════════════════════

describe('frame encode/decode', () => {
  function makeFrame(overrides?: Partial<LoRaFrame>): LoRaFrame {
    return {
      version: 0x01,
      type: 0x01,
      messageId: uuidToBytes(crypto.randomUUID()),
      senderId: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      recipientId: new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]),
      sequence: 42,
      timestamp: Math.floor(Date.now() / 1000),
      hopCount: 0,
      maxHops: 3,
      segmentInfo: 0,
      pathLength: 0,
      path: new Uint8Array(0),
      payload: new Uint8Array([0xca, 0xfe]),
      signature: new Uint8Array(LORA_SIGNATURE),
      ...overrides,
    }
  }

  it('round-trips a minimal frame (no path)', () => {
    const frame = makeFrame()
    const encoded = encodeFrame(frame)
    const decoded = decodeFrame(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.version).toBe(frame.version)
    expect(decoded!.type).toBe(frame.type)
    expect(bytesToHex(decoded!.messageId)).toBe(bytesToHex(frame.messageId))
    expect(bytesToHex(decoded!.senderId)).toBe(bytesToHex(frame.senderId))
    expect(bytesToHex(decoded!.recipientId)).toBe(bytesToHex(frame.recipientId))
    expect(decoded!.sequence).toBe(42)
    expect(decoded!.hopCount).toBe(0)
    expect(decoded!.maxHops).toBe(3)
    expect(decoded!.segmentInfo).toBe(0)
    expect(decoded!.pathLength).toBe(0)
    expect(decoded!.payload).toEqual(new Uint8Array([0xca, 0xfe]))
  })

  it('round-trips a frame with path entries', () => {
    const hop1 = new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88])
    const hop2 = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11])
    const path = new Uint8Array(16)
    path.set(hop1, 0)
    path.set(hop2, 8)

    const frame = makeFrame({ pathLength: 2, path, hopCount: 2 })
    const encoded = encodeFrame(frame)
    const decoded = decodeFrame(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.pathLength).toBe(2)
    expect(decoded!.hopCount).toBe(2)
    expect(bytesToHex(decoded!.path.slice(0, 8))).toBe(bytesToHex(hop1))
    expect(bytesToHex(decoded!.path.slice(8, 16))).toBe(bytesToHex(hop2))
  })

  it('round-trips a frame with segmentInfo', () => {
    const frame = makeFrame({ segmentInfo: 0x23 }) // segment 2 of 3
    const encoded = encodeFrame(frame)
    const decoded = decodeFrame(encoded)

    expect(decoded!.segmentInfo).toBe(0x23)
  })

  it('preserves payload content', () => {
    const payload = new TextEncoder().encode('Hello LoRa Mesh!')
    const frame = makeFrame({ payload })
    const encoded = encodeFrame(frame)
    const decoded = decodeFrame(encoded)

    const text = new TextDecoder().decode(decoded!.payload)
    expect(text).toBe('Hello LoRa Mesh!')
  })

  it('returns null for too-short bytes', () => {
    const tooShort = new Uint8Array(10)
    expect(decodeFrame(tooShort)).toBeNull()
  })

  it('returns null for invalid frame type', () => {
    const frame = makeFrame()
    const encoded = encodeFrame(frame)
    encoded[1] = 0xff // invalid type
    expect(decodeFrame(encoded)).toBeNull()
  })

  it('encoded size matches expected layout', () => {
    const payloadSize = 20
    const frame = makeFrame({ payload: new Uint8Array(payloadSize) })
    const encoded = encodeFrame(frame)
    expect(encoded.length).toBe(LORA_HEADER_FIXED + 0 + payloadSize + LORA_SIGNATURE)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 5. Confirmation encode/decode
// ═════════════════════════════════════════════════════════════════════════

describe('confirmation encode/decode', () => {
  it('round-trips a confirmation frame', () => {
    const conf: ConfirmationFrame = {
      version: 0x01,
      type: 0x02,
      messageId: uuidToBytes(crypto.randomUUID()),
      recipientId: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      senderId: new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]),
      timestamp: Math.floor(Date.now() / 1000),
      signature: new Uint8Array(LORA_SIGNATURE),
    }

    const encoded = encodeConfirmation(conf)
    const decoded = decodeConfirmation(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.version).toBe(0x01)
    expect(decoded!.type).toBe(0x02)
    expect(bytesToHex(decoded!.messageId)).toBe(bytesToHex(conf.messageId))
    expect(bytesToHex(decoded!.recipientId)).toBe(bytesToHex(conf.recipientId))
    expect(bytesToHex(decoded!.senderId)).toBe(bytesToHex(conf.senderId))
    expect(decoded!.timestamp).toBe(conf.timestamp)
  })

  it('returns null for too-short bytes', () => {
    expect(decodeConfirmation(new Uint8Array(10))).toBeNull()
  })

  it('returns null for wrong type byte', () => {
    const conf: ConfirmationFrame = {
      version: 0x01,
      type: 0x02,
      messageId: new Uint8Array(16),
      recipientId: new Uint8Array(8),
      senderId: new Uint8Array(8),
      timestamp: 0,
      signature: new Uint8Array(LORA_SIGNATURE),
    }
    const encoded = encodeConfirmation(conf)
    encoded[1] = 0x01 // data type, not confirmation
    expect(decodeConfirmation(encoded)).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 6. Segmentation / reassembly
// ═════════════════════════════════════════════════════════════════════════

describe('segmentPayload / reassemblePayload', () => {
  it('returns single segment when payload fits', () => {
    const payload = new Uint8Array(50)
    const segments = segmentPayload(payload, 100)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toBe(payload) // same reference
  })

  it('splits payload into multiple segments', () => {
    const payload = new Uint8Array(100)
    for (let i = 0; i < 100; i++) payload[i] = i
    const segments = segmentPayload(payload, 30)
    expect(segments.length).toBe(4) // 30+30+30+10

    // Verify total bytes
    const totalLen = segments.reduce((s, seg) => s + seg.length, 0)
    expect(totalLen).toBe(100)
  })

  it('reassemblePayload reassembles correctly', () => {
    const original = new Uint8Array(100)
    for (let i = 0; i < 100; i++) original[i] = i

    const segments = segmentPayload(original, 30)
    const segMap = new Map<number, Uint8Array>()
    for (let i = 0; i < segments.length; i++) {
      segMap.set(i, segments[i])
    }

    const reassembled = reassemblePayload(segMap, segments.length)
    expect(reassembled).not.toBeNull()
    expect(reassembled).toEqual(original)
  })

  it('reassemblePayload returns null when segments are missing', () => {
    const segMap = new Map<number, Uint8Array>()
    segMap.set(0, new Uint8Array([1, 2, 3]))
    // Missing segment 1
    expect(reassemblePayload(segMap, 2)).toBeNull()
  })

  it('reassemblePayload returns null when count mismatches', () => {
    const segMap = new Map<number, Uint8Array>()
    segMap.set(0, new Uint8Array([1]))
    expect(reassemblePayload(segMap, 3)).toBeNull()
  })

  it('throws when payload produces more than 15 segments', () => {
    const huge = new Uint8Array(200)
    expect(() => segmentPayload(huge, 10)).toThrow('Payload too large')
  })

  it('segment → reassemble round-trip preserves content', () => {
    const text = 'The quick brown fox jumps over the lazy dog. This is a test payload for segmentation.'
    const payload = new TextEncoder().encode(text)
    const segments = segmentPayload(payload, 20)

    const segMap = new Map<number, Uint8Array>()
    segments.forEach((seg, i) => segMap.set(i, seg))

    const reassembled = reassemblePayload(segMap, segments.length)
    expect(reassembled).not.toBeNull()
    expect(new TextDecoder().decode(reassembled!)).toBe(text)
  })
})
