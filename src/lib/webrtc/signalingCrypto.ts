/**
 * Ephemeral ECDH + AES-256-GCM encryption for WebRTC call signaling.
 *
 * Protects SDP offers/answers and ICE candidates from observation by the
 * Supabase Realtime infrastructure. Each call generates a fresh P-256
 * key pair; both parties derive the same shared secret via ECDH.
 *
 * Key exchange flow:
 * 1. Caller creates SignalingCrypto, attaches ephemeralKey to outgoing messages
 * 2. Callee creates SignalingCrypto, receives caller's key, derives shared secret
 * 3. Callee attaches their ephemeralKey to the answer
 * 4. Caller receives callee's key, derives same shared secret
 * 5. All subsequent messages are encrypted with AES-256-GCM
 */

import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('SignalingCrypto')

const CURVE = 'P-256'

export interface SignalingCrypto {
  /** Base64-encoded ephemeral public key to include in outgoing messages. */
  getPublicKeyBase64(): Promise<string>
  /** Set the peer's ephemeral public key and derive the shared AES key. */
  setPeerKey(peerKeyBase64: string): Promise<void>
  /** True once both keys are exchanged and a shared secret is derived. */
  isReady(): boolean
  /** Encrypt a signaling payload. Returns base64 ciphertext. */
  encrypt(payload: unknown): Promise<string>
  /** Decrypt a base64 ciphertext back to the original payload. */
  decrypt(ciphertext: string): Promise<unknown>
}

export async function createSignalingCrypto(): Promise<SignalingCrypto> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    false,
    ['deriveBits']
  )

  // Export public key as base64 (raw format)
  const pubKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  const pubKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubKeyRaw)))

  let sharedKey: CryptoKey | null = null

  const getPublicKeyBase64 = async () => pubKeyBase64

  const setPeerKey = async (peerKeyBase64: string) => {
    try {
      const peerKeyBytes = Uint8Array.from(atob(peerKeyBase64), c => c.charCodeAt(0))
      const peerPubKey = await crypto.subtle.importKey(
        'raw',
        peerKeyBytes,
        { name: 'ECDH', namedCurve: CURVE },
        false,
        []
      )
      const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: peerPubKey },
        keyPair.privateKey,
        256
      )
      // Use HKDF to derive a proper AES key from the raw ECDH output
      const hkdfKey = await crypto.subtle.importKey(
        'raw', sharedBits, 'HKDF', false, ['deriveKey']
      )
      sharedKey = await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new TextEncoder().encode('adtmc-call-signaling'),
          info: new TextEncoder().encode('aes-gcm-key'),
        },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    } catch (err) {
      logger.warn('Failed to derive shared signaling key:', err)
    }
  }

  const isReady = () => sharedKey !== null

  const encrypt = async (payload: unknown): Promise<string> => {
    if (!sharedKey) throw new Error('Shared key not derived')
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(JSON.stringify(payload))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, encoded)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)
    return btoa(String.fromCharCode(...combined))
  }

  const decrypt = async (ciphertext: string): Promise<unknown> => {
    if (!sharedKey) throw new Error('Shared key not derived')
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const ct = combined.slice(12)
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedKey, ct)
    return JSON.parse(new TextDecoder().decode(plainBuffer))
  }

  return { getPublicKeyBase64, setPeerKey, isReady, encrypt, decrypt }
}
