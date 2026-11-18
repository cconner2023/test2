// Biometric Unlock Service — WebAuthn-based Face ID / Touch ID
// provides biometric as an alternative to 4-digit PIN
// Uses platform authenticator (secure enclave) for local-only verification

import { bytesToBase64, base64ToBytes, bytesToBase64url, base64urlToBytes } from './base64Utils'

const STORAGE_KEY = 'adtmc_webauthn_credential'
const BIOMETRIC_ENABLED_KEY = 'adtmc_biometric_enabled'

interface StoredCredential {
  credentialId: string
  publicKeySpki: string
  createdAt: number
}

// --- Feature detection ---

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function isBiometricEnrolled(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'
  } catch {
    return false
  }
}

// --- Registration ---

export async function enrollBiometric(): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userId = crypto.getRandomValues(new Uint8Array(16))

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'ADTMC' },
        user: { id: userId, name: 'local-user', displayName: 'ADTMC User' },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256 (preferred on Apple)
          { alg: -257, type: 'public-key' },  // RS256 (fallback)
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null

    if (!credential) return false

    const response = credential.response as AuthenticatorAttestationResponse
    const pk = response.getPublicKey?.()

    const stored: StoredCredential = {
      credentialId: bytesToBase64url(new Uint8Array(credential.rawId)),
      publicKeySpki: pk ? bytesToBase64(new Uint8Array(pk)) : '',
      createdAt: Date.now(),
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')
    return true
  } catch {
    return false
  }
}

// --- Authentication ---

/** WebAuthn ECDSA signatures are DER; WebCrypto verifies raw r||s (P1363). */
function derToRawEcdsa(der: Uint8Array): Uint8Array {
  // SEQUENCE { INTEGER r, INTEGER s }, each possibly 0x00-padded or shorter than 32.
  let i = 2
  if (der[1] & 0x80) i += der[1] & 0x7f
  const readInt = (): Uint8Array => {
    if (der[i] !== 0x02) throw new Error('bad DER')
    const len = der[i + 1]
    let v = der.slice(i + 2, i + 2 + len)
    i += 2 + len
    while (v.length > 32 && v[0] === 0) v = v.slice(1)
    const out = new Uint8Array(32)
    out.set(v, 32 - v.length)
    return out
  }
  const r = readInt()
  const sv = readInt()
  const raw = new Uint8Array(64)
  raw.set(r, 0)
  raw.set(sv, 32)
  return raw
}

async function verifyAssertionSignature(spkiB64: string, signed: Uint8Array, sig: Uint8Array): Promise<boolean> {
  const spki = base64ToBytes(spkiB64) as BufferSource
  try {
    const ec = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, ec, derToRawEcdsa(sig) as BufferSource, signed as BufferSource)
  } catch {
    const rsa = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', rsa, sig as BufferSource, signed as BufferSource)
  }
}

export async function verifyBiometric(): Promise<boolean> {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (!json) return false
    const stored: StoredCredential = JSON.parse(json)

    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          type: 'public-key',
          id: base64urlToBytes(stored.credentialId).buffer as ArrayBuffer,
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential | null

    if (!assertion) return false
    if (bytesToBase64url(new Uint8Array(assertion.rawId)) !== stored.credentialId) return false

    const response = assertion.response as AuthenticatorAssertionResponse
    const authData = new Uint8Array(response.authenticatorData)
    // UV (User Verified) flag
    if ((authData[32] & 0x04) === 0) return false

    // The assertion must answer THIS challenge from THIS origin and be signed by the
    // enrolled key; checking only the UV bit accepts any replayed or injected response.
    const clientDataBytes = new Uint8Array(response.clientDataJSON)
    const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes)) as { type?: string; challenge?: string; origin?: string }
    if (clientData.type !== 'webauthn.get') return false
    if (clientData.challenge !== bytesToBase64url(challenge)) return false
    if (clientData.origin !== window.location.origin) return false

    // Enrolments from browsers without getPublicKey() stored no key; they keep the
    // UV + challenge checks above rather than being locked out.
    if (!stored.publicKeySpki) return true
    const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))
    const signed = new Uint8Array(authData.length + clientHash.length)
    signed.set(authData)
    signed.set(clientHash, authData.length)
    return await verifyAssertionSignature(stored.publicKeySpki, signed, new Uint8Array(response.signature))
  } catch {
    return false
  }
}

// --- Removal ---

export function removeBiometric(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY)
  } catch { /* fail silently */ }
}

