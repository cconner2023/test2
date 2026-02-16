// Biometric Unlock Service — WebAuthn-based Face ID / Touch ID
// provides biometric as an alternative to 4-digit PIN
// Uses platform authenticator (secure enclave) for local-only verification

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
      credentialId: bufferToBase64url(credential.rawId),
      publicKeySpki: pk ? btoa(String.fromCharCode(...new Uint8Array(pk))) : '',
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

export async function verifyBiometric(): Promise<boolean> {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (!json) return false
    const stored: StoredCredential = JSON.parse(json)

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          type: 'public-key',
          id: base64urlToBuffer(stored.credentialId),
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential | null

    if (!assertion) return false

    // Confirm UV (User Verified) flag in authenticatorData
    const authData = new Uint8Array(
      (assertion.response as AuthenticatorAssertionResponse).authenticatorData
    )
    return (authData[32] & 0x04) !== 0
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

// --- Encoding helpers ---

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - b64url.length % 4) % 4)
  const bin = atob(padded)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr.buffer
}
