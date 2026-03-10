/**
 * Tests for cryptoUtils.ts — covers hex encoding/decoding, PBKDF2 hashing,
 * legacy SHA-256 verification, and constant-time comparison (indirectly).
 */

import { describe, it, expect } from 'vitest'
import {
  hexToBytes,
  bytesToHex,
  hashWithSalt,
  verifyHash,
  isLegacyHash,
} from '../cryptoUtils'

// ═════════════════════════════════════════════════════════════════════════
// 1. hexToBytes / bytesToHex round-trip
// ═════════════════════════════════════════════════════════════════════════

describe('hexToBytes / bytesToHex round-trip', () => {
  it('round-trips a known hex string', () => {
    const hex = 'deadbeef01020304'
    const bytes = hexToBytes(hex)
    expect(bytesToHex(bytes)).toBe(hex)
  })

  it('round-trips all single-byte values 0x00–0xff', () => {
    const bytes = new Uint8Array(256)
    for (let i = 0; i < 256; i++) bytes[i] = i
    const hex = bytesToHex(bytes)
    expect(hexToBytes(hex)).toEqual(bytes)
  })

  it('round-trips a 16-byte salt-sized value', () => {
    const original = crypto.getRandomValues(new Uint8Array(16))
    const hex = bytesToHex(original)
    expect(hexToBytes(hex)).toEqual(original)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 2. hexToBytes edge cases
// ═════════════════════════════════════════════════════════════════════════

describe('hexToBytes edge cases', () => {
  it('returns empty Uint8Array for empty string', () => {
    expect(hexToBytes('')).toEqual(new Uint8Array(0))
  })

  it('drops trailing nibble on odd-length input', () => {
    // "abc" → regex matches "ab", trailing "c" is dropped
    const result = hexToBytes('abc')
    expect(result).toEqual(new Uint8Array([0xab]))
  })

  it('parses uppercase hex correctly', () => {
    expect(hexToBytes('FF')).toEqual(new Uint8Array([255]))
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 3. bytesToHex edge cases
// ═════════════════════════════════════════════════════════════════════════

describe('bytesToHex edge cases', () => {
  it('returns empty string for empty Uint8Array', () => {
    expect(bytesToHex(new Uint8Array(0))).toBe('')
  })

  it('pads single-digit hex values with leading zero', () => {
    // 0x0a should produce "0a", not "a"
    expect(bytesToHex(new Uint8Array([0x0a]))).toBe('0a')
  })

  it('handles single byte 0x00', () => {
    expect(bytesToHex(new Uint8Array([0]))).toBe('00')
  })

  it('handles single byte 0xff', () => {
    expect(bytesToHex(new Uint8Array([255]))).toBe('ff')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 4. hashWithSalt
// ═════════════════════════════════════════════════════════════════════════

describe('hashWithSalt', () => {
  it('produces a hash with pbkdf2: prefix', async () => {
    const { hash } = await hashWithSalt('mypassword')
    expect(hash.startsWith('pbkdf2:')).toBe(true)
  })

  it('produces a 32-char hex salt (16 bytes)', async () => {
    const { salt } = await hashWithSalt('mypassword')
    expect(salt).toHaveLength(32)
    expect(salt).toMatch(/^[0-9a-f]{32}$/)
  })

  it('produces a 64-char hex hash body (256-bit key)', async () => {
    const { hash } = await hashWithSalt('mypassword')
    const body = hash.replace('pbkdf2:', '')
    expect(body).toHaveLength(64)
    expect(body).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for same input and salt', async () => {
    // Hash once, then re-derive with the same salt to confirm
    const { hash, salt } = await hashWithSalt('deterministic-test')
    const match = await verifyHash('deterministic-test', hash, salt)
    expect(match).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 5. hashWithSalt uniqueness
// ═════════════════════════════════════════════════════════════════════════

describe('hashWithSalt uniqueness', () => {
  it('produces different salts for the same input', async () => {
    const a = await hashWithSalt('same-input')
    const b = await hashWithSalt('same-input')
    expect(a.salt).not.toBe(b.salt)
  })

  it('produces different hashes for the same input (due to different salts)', async () => {
    const a = await hashWithSalt('same-input')
    const b = await hashWithSalt('same-input')
    expect(a.hash).not.toBe(b.hash)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 6. verifyHash — PBKDF2 path (correct input)
// ═════════════════════════════════════════════════════════════════════════

describe('verifyHash (PBKDF2 path)', () => {
  it('returns true for correct input', async () => {
    const input = 'correct-horse-battery-staple'
    const { hash, salt } = await hashWithSalt(input)
    expect(await verifyHash(input, hash, salt)).toBe(true)
  })

  it('works with empty string input', async () => {
    const { hash, salt } = await hashWithSalt('')
    expect(await verifyHash('', hash, salt)).toBe(true)
  })

  it('works with unicode input', async () => {
    const input = 'p\u00e4ssw\u00f6rd-\u2603'
    const { hash, salt } = await hashWithSalt(input)
    expect(await verifyHash(input, hash, salt)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 7. verifyHash — PBKDF2 path (wrong input)
// ═════════════════════════════════════════════════════════════════════════

describe('verifyHash (wrong input)', () => {
  it('returns false for incorrect input', async () => {
    const { hash, salt } = await hashWithSalt('real-password')
    expect(await verifyHash('wrong-password', hash, salt)).toBe(false)
  })

  it('returns false for off-by-one character', async () => {
    const { hash, salt } = await hashWithSalt('password1')
    expect(await verifyHash('password2', hash, salt)).toBe(false)
  })

  it('returns false for input with extra whitespace', async () => {
    const { hash, salt } = await hashWithSalt('password')
    expect(await verifyHash('password ', hash, salt)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 8. verifyHash — legacy SHA-256 path
// ═════════════════════════════════════════════════════════════════════════

describe('verifyHash (legacy SHA-256 path)', () => {
  /**
   * Helper to create a legacy SHA-256 hash (salt + input) matching
   * the legacy path in verifyHash. This mirrors the production logic
   * that existed before PBKDF2 migration.
   */
  async function legacyHash(input: string, saltHex: string): Promise<string> {
    const saltBytes = hexToBytes(saltHex)
    const encoder = new TextEncoder()
    const data = new Uint8Array([...saltBytes, ...encoder.encode(input)])
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return bytesToHex(new Uint8Array(hashBuffer))
  }

  it('verifies a legacy SHA-256 hash correctly', async () => {
    const saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
    const hash = await legacyHash('legacy-pin', saltHex)

    // Legacy hash has no "pbkdf2:" prefix
    expect(hash.startsWith('pbkdf2:')).toBe(false)
    expect(await verifyHash('legacy-pin', hash, saltHex)).toBe(true)
  })

  it('rejects wrong input against legacy hash', async () => {
    const saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
    const hash = await legacyHash('legacy-pin', saltHex)
    expect(await verifyHash('wrong-pin', hash, saltHex)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 9. isLegacyHash
// ═════════════════════════════════════════════════════════════════════════

describe('isLegacyHash', () => {
  it('returns true for a plain hex hash (no prefix)', () => {
    expect(isLegacyHash('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')).toBe(true)
  })

  it('returns false for a pbkdf2-prefixed hash', () => {
    expect(isLegacyHash('pbkdf2:abcdef1234567890')).toBe(false)
  })

  it('returns true for empty string', () => {
    expect(isLegacyHash('')).toBe(true)
  })

  it('returns false when prefix is exactly "pbkdf2:"', () => {
    expect(isLegacyHash('pbkdf2:')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 10. constantTimeEqual (indirect via verifyHash)
// ═════════════════════════════════════════════════════════════════════════

describe('constantTimeEqual (indirect)', () => {
  it('rejects nearly-matching hash (single char difference)', async () => {
    const { hash, salt } = await hashWithSalt('test-input')
    // Flip the last hex character of the hash body
    const lastChar = hash[hash.length - 1]
    const flipped = lastChar === '0' ? '1' : '0'
    const tamperedHash = hash.slice(0, -1) + flipped
    expect(await verifyHash('test-input', tamperedHash, salt)).toBe(false)
  })

  it('rejects hash with matching prefix but different body', async () => {
    const resultA = await hashWithSalt('input-a')
    // Use salt from A but hash from a different input
    const resultB = await hashWithSalt('input-b')
    // Verify that input-a does NOT match input-b's hash even with input-a's salt
    expect(await verifyHash('input-a', resultB.hash, resultA.salt)).toBe(false)
  })
})
