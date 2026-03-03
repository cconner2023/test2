import { aesGcmEncrypt, aesGcmDecrypt } from '../aesGcm'
import { bytesToBase64, base64ToBytes } from '../base64Utils'

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
  const combined = await aesGcmEncrypt(key, enc.encode(name))
  return ENC_PREFIX + bytesToBase64(combined)
}

export async function decryptGroupName(groupId: string, encryptedName: string): Promise<string> {
  if (!encryptedName.startsWith(ENC_PREFIX)) return encryptedName
  try {
    const combined = base64ToBytes(encryptedName.slice(ENC_PREFIX.length))
    const key = await deriveKey(groupId)
    const plain = await aesGcmDecrypt(key, combined)
    return new TextDecoder().decode(plain)
  } catch {
    return encryptedName
  }
}
