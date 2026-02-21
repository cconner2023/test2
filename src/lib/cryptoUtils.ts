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

export async function hashWithSalt(input: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = bytesToHex(salt)
  const encoder = new TextEncoder()
  const data = new Uint8Array([...salt, ...encoder.encode(input)])
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hash = bytesToHex(new Uint8Array(hashBuffer))
  return { hash, salt: saltHex }
}

export async function verifyHash(input: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const saltArray = hexToBytes(storedSalt)
  const encoder = new TextEncoder()
  const data = new Uint8Array([...saltArray, ...encoder.encode(input)])
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hash = bytesToHex(new Uint8Array(hashBuffer))
  return hash === storedHash
}
