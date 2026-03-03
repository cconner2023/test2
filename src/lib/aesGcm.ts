/**
 * Shared AES-256-GCM encrypt/decrypt with 12-byte IV prepend.
 */
export async function aesGcmEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  additionalData?: Uint8Array
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, ...(additionalData ? { additionalData: additionalData as BufferSource } : {}) },
    key,
    plaintext as BufferSource
  )
  const result = new Uint8Array(12 + ct.byteLength)
  result.set(iv)
  result.set(new Uint8Array(ct), 12)
  return result
}

export async function aesGcmDecrypt(
  key: CryptoKey,
  ivAndCiphertext: Uint8Array,
  additionalData?: Uint8Array
): Promise<Uint8Array> {
  const iv = ivAndCiphertext.slice(0, 12)
  const ct = ivAndCiphertext.slice(12)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, ...(additionalData ? { additionalData: additionalData as BufferSource } : {}) },
    key,
    ct as BufferSource
  )
  return new Uint8Array(pt)
}
