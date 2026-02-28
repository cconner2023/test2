export function hexToBytes(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g)
  if (!matches) return new Uint8Array(0)
  return new Uint8Array(matches.map(b => parseInt(b, 16)))
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

// ---- PBKDF2 parameters ----

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_HASH = 'SHA-256'
const PBKDF2_KEY_LENGTH_BITS = 256

/** Prefix identifying PBKDF2-hashed values (vs legacy SHA-256). */
const PBKDF2_PREFIX = 'pbkdf2:'

/** Constant-time comparison of two hex strings.
 *  Prevents timing side-channel attacks on hash verification. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/** Hash input using PBKDF2-SHA256 with a random salt. */
export async function hashWithSalt(input: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = bytesToHex(salt)
  const encoder = new TextEncoder()

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(input),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    PBKDF2_KEY_LENGTH_BITS
  )

  const hash = PBKDF2_PREFIX + bytesToHex(new Uint8Array(derivedBits))
  return { hash, salt: saltHex }
}

/** Verify input against a stored hash and salt.
 *  Supports both PBKDF2 (current) and legacy SHA-256 hashes.
 *  Returns { match, needsRehash } — caller should re-hash with
 *  hashWithSalt() when needsRehash is true. */
export async function verifyHash(
  input: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const saltArray = hexToBytes(storedSalt)
  const encoder = new TextEncoder()

  if (storedHash.startsWith(PBKDF2_PREFIX)) {
    // Current PBKDF2 path
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(input),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltArray, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
      keyMaterial,
      PBKDF2_KEY_LENGTH_BITS
    )
    const computed = PBKDF2_PREFIX + bytesToHex(new Uint8Array(derivedBits))
    return constantTimeEqual(computed, storedHash)
  }

  // Legacy SHA-256 path (for existing PINs — will be re-hashed on next save)
  const data = new Uint8Array([...saltArray, ...encoder.encode(input)])
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const computed = bytesToHex(new Uint8Array(hashBuffer))
  return constantTimeEqual(computed, storedHash)
}

/** Check if a hash uses the legacy SHA-256 format (needs upgrade to PBKDF2). */
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith(PBKDF2_PREFIX)
}
