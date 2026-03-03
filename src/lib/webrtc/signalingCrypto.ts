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
import { aesGcmEncrypt, aesGcmDecrypt } from '../aesGcm'
import { bytesToBase64, base64ToBytes } from '../base64Utils'

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
  const pubKeyBase64 = bytesToBase64(new Uint8Array(pubKeyRaw))

  let sharedKey: CryptoKey | null = null

  const getPublicKeyBase64 = async () => pubKeyBase64

  const setPeerKey = async (peerKeyBase64: string) => {
    try {
      const peerKeyBytes = base64ToBytes(peerKeyBase64)
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
    const encoded = new TextEncoder().encode(JSON.stringify(payload))
    const combined = await aesGcmEncrypt(sharedKey, encoded)
    return bytesToBase64(combined)
  }

  const decrypt = async (ciphertext: string): Promise<unknown> => {
    if (!sharedKey) throw new Error('Shared key not derived')
    const combined = base64ToBytes(ciphertext)
    const plainBuffer = await aesGcmDecrypt(sharedKey, combined)
    return JSON.parse(new TextDecoder().decode(plainBuffer))
  }

  return { getPublicKeyBase64, setPeerKey, isReady, encrypt, decrypt }
}
