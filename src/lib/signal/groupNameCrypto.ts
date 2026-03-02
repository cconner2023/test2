const ENC_PREFIX = 'genc:'
const enc = new TextEncoder()

async function deriveKey(groupId: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    enc.encode(groupId),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('adtmc-group-name-v1'),
      info: enc.encode('group-name-encryption'),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptGroupName(groupId: string, name: string): Promise<string> {
  const key = await deriveKey(groupId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(name))
  const combined = new Uint8Array(12 + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), 12)
  return ENC_PREFIX + btoa(String.fromCharCode(...combined))
}

export async function decryptGroupName(groupId: string, encryptedName: string): Promise<string> {
  if (!encryptedName.startsWith(ENC_PREFIX)) return encryptedName
  try {
    const combined = Uint8Array.from(atob(encryptedName.slice(ENC_PREFIX.length)), c => c.charCodeAt(0))
    const key = await deriveKey(groupId)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) },
      key,
      combined.slice(12),
    )
    return new TextDecoder().decode(plain)
  } catch {
    return encryptedName
  }
}
