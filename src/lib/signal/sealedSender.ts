/**
 * Sealed Sender — ECIES envelope encryption with sender certificate.
 *
 * Hides the sender's identity from the server while allowing the recipient
 * to cryptographically verify who sent the message.
 *
 * Construction:
 *   1. Issue a SenderCertificate binding sender → recipient (signed by sender's identity key)
 *   2. Seal { cert, inner } via ECIES:
 *      - Ephemeral ECDH P-256 key pair
 *      - ECDH(ephemeral_priv, recipient_dh_pub) → raw shared secret
 *      - HKDF-SHA256(raw_shared, info='sealed-sender-v1') → AES-256-GCM key
 *      - AES-256-GCM(plaintext) with random 12-byte IV
 *
 * Only the recipient (who holds the matching DH private key) can unseal.
 * The cert signature is verified on unseal to authenticate the sender.
 */

import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import { importDhPublicKey, importSigningPublicKey, verifySignature, performDh } from './keyManager'
import type { StoredLocalIdentity } from './types'

// ---- Internal Crypto Helpers ----

/**
 * HKDF-SHA256 from raw ECDH output → AES-256-GCM CryptoKey.
 *
 * Uses an empty salt (zero-length Uint8Array) and the provided info string
 * as the HKDF context label. Derives a non-extractable 256-bit AES-GCM key.
 */
async function hkdf(rawSecret: ArrayBuffer, info: string, length = 32): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawSecret,
    'HKDF',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    baseKey,
    { name: 'AES-GCM', length: length * 8 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * AES-256-GCM encrypt → IV(12) || ciphertext.
 *
 * Generates a random 12-byte IV, encrypts plaintext, and returns the
 * concatenation of IV and ciphertext as a single Uint8Array.
 */
async function aesGcmEncrypt(key: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return new Uint8Array([...iv, ...new Uint8Array(ct)])
}

/**
 * AES-256-GCM decrypt from IV(12) || ciphertext → plaintext.
 *
 * Splits the input at byte 12 to extract the IV and ciphertext, then
 * decrypts. Throws a DOMException if authentication fails (tampered data).
 */
async function aesGcmDecrypt(key: CryptoKey, ivAndCt: Uint8Array): Promise<Uint8Array> {
  const iv = ivAndCt.slice(0, 12)
  const ct = ivAndCt.slice(12)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new Uint8Array(pt)
}

// ---- Exported Interfaces ----

/**
 * A short-lived certificate that binds the sender's identity to this
 * specific message exchange. Signed by the sender's ECDSA identity key
 * so the recipient can verify authenticity after unsealing.
 *
 * The signature covers canonical JSON of all fields except `signature`
 * itself, with keys in the exact order defined by the cert signing spec.
 */
export interface SenderCertificate {
  /** UUID of the sending user. */
  senderUuid: string
  /** Sender's ECDSA P-256 identity key in SPKI base64 (used to verify the cert signature). */
  senderIdentitySigningKey: string
  /** Sender's ECDH P-256 identity key in raw base64 (65-byte uncompressed point). */
  senderIdentityDhKey: string
  /** UUID of the intended recipient. */
  recipientUuid: string
  /** Recipient's ECDH P-256 identity key in raw base64 (used to detect re-targeting). */
  recipientIdentityDhKey: string
  /** ISO 8601 timestamp when the cert was issued. */
  issuedAt: string
  /** ISO 8601 timestamp when the cert expires (issuedAt + 24 h). */
  expires: string
  /** ECDSA P-256 SHA-256 signature over canonical JSON of the above fields (base64). */
  signature: string
}

/**
 * The sealed envelope — what the server sees.
 *
 * The server cannot read the ciphertext without the recipient's private DH
 * key, and cannot identify the sender (the SenderCertificate is inside
 * the encrypted payload).
 */
export interface SealedEnvelope {
  /** Protocol version. Always 1 for this implementation. */
  v: 1
  /** Ephemeral ECDH P-256 public key used for ECIES (raw base64, uncompressed 65 bytes). */
  ephemeralKey: string
  /** base64-encoded IV(12) || AES-256-GCM( UTF-8(JSON({ cert, inner })) ). */
  ciphertext: string
}

// ---- Internal Interface ----

/** The plaintext payload sealed inside the envelope. NOT exported. */
interface SealedPayload {
  cert: SenderCertificate
  inner: Record<string, unknown>
}

// ---- Exported Functions ----

/**
 * Seal an inner payload into a SealedEnvelope for a specific recipient.
 *
 * The sender's identity is hidden from the server — only the recipient's
 * DH private key can decrypt the envelope and reveal the SenderCertificate.
 *
 * @param inner              - Arbitrary payload to encrypt (e.g., a Signal message).
 * @param senderUuid         - UUID of the sending user.
 * @param myIdentity         - Caller's local identity (provides signing key + DH keys).
 * @param recipientUuid      - UUID of the intended recipient.
 * @param recipientDhKeyBase64 - Recipient's ECDH P-256 identity key (raw base64).
 * @returns A SealedEnvelope safe to hand to the server.
 */
export async function seal(
  inner: Record<string, unknown>,
  senderUuid: string,
  myIdentity: StoredLocalIdentity,
  recipientUuid: string,
  recipientDhKeyBase64: string
): Promise<SealedEnvelope> {
  // 1. Build timestamps
  const issuedAt = new Date().toISOString()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // 2. Build canonical JSON object — key order is part of the spec
  const canonicalObj = {
    senderUuid,
    senderIdentitySigningKey: myIdentity.signingPublicKeyBase64,
    senderIdentityDhKey: myIdentity.dhPublicKeyBase64,
    recipientUuid,
    recipientIdentityDhKey: recipientDhKeyBase64,
    issuedAt,
    expires,
  }
  const canonicalJson = JSON.stringify(canonicalObj)

  // 3. Sign canonical JSON bytes with sender's ECDSA identity key
  const canonicalBytes = new TextEncoder().encode(canonicalJson)
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    myIdentity.signingPrivateKey,
    canonicalBytes
  )
  const signature = uint8ToBase64(new Uint8Array(signatureBuffer))

  // 4. Build the full SenderCertificate
  const cert: SenderCertificate = {
    ...canonicalObj,
    signature,
  }

  // 5. Build SealedPayload
  const payload: SealedPayload = { cert, inner }

  // 6. Serialize payload to UTF-8 bytes
  const ptBytes = new TextEncoder().encode(JSON.stringify(payload))

  // 7. Generate ephemeral ECDH P-256 key pair
  const ephemeralPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )

  // 8. Import recipient's public DH key
  const recipientPubKey = await importDhPublicKey(recipientDhKeyBase64)

  // 9. ECDH: ephemeral_priv × recipient_pub → raw shared secret
  const rawShared = await performDh(ephemeralPair.privateKey, recipientPubKey)

  // 10. HKDF: derive AES-256-GCM key
  const aesKey = await hkdf(rawShared, 'sealed-sender-v1')

  // 11. Encrypt: AES-256-GCM( ptBytes ) → IV(12) || ciphertext
  const ivAndCt = await aesGcmEncrypt(aesKey, ptBytes)

  // 12. Export ephemeral public key as raw base64
  const ephemeralPubRaw = await crypto.subtle.exportKey('raw', ephemeralPair.publicKey)
  const ephemeralKey = uint8ToBase64(new Uint8Array(ephemeralPubRaw))

  // 13. Assemble and return the sealed envelope
  return {
    v: 1,
    ephemeralKey,
    ciphertext: uint8ToBase64(ivAndCt),
  }
}

/**
 * Unseal a SealedEnvelope using the recipient's DH private key.
 *
 * Performs ECDH with the ephemeral key, derives the AES key via HKDF,
 * decrypts and authenticates the ciphertext, then verifies the
 * SenderCertificate signature to authenticate the sender.
 *
 * Throws on:
 * - AES-GCM authentication failure (tampered envelope)
 * - Invalid cert signature (forged sender identity)
 * - Cert recipient mismatch (envelope targeted at a different recipient)
 *
 * @param envelope        - The SealedEnvelope received from the server.
 * @param myUuid          - UUID of the recipient (used for context; cert check uses DH key).
 * @param myDhPrivKey     - Recipient's ECDH P-256 identity private key.
 * @param myDhPubKeyBase64 - Recipient's ECDH P-256 identity public key (raw base64),
 *                          used to verify the cert was addressed to us.
 * @returns The decrypted inner payload, authenticated sender UUID, and cert.
 */
export async function unseal(
  envelope: SealedEnvelope,
  myUuid: string,
  myDhPrivKey: CryptoKey,
  myDhPubKeyBase64: string
): Promise<{ inner: Record<string, unknown>; senderUuid: string; cert: SenderCertificate }> {
  // 1. Import the ephemeral public key from the envelope
  const ephemeralPubKey = await importDhPublicKey(envelope.ephemeralKey)

  // 2. ECDH: my_dh_priv × ephemeral_pub → raw shared secret
  const rawShared = await performDh(myDhPrivKey, ephemeralPubKey)

  // 3. HKDF: derive AES-256-GCM key (same derivation as seal)
  const aesKey = await hkdf(rawShared, 'sealed-sender-v1')

  // 4. Decode ciphertext from base64
  const ivAndCt = base64ToUint8(envelope.ciphertext)

  // 5. Decrypt (throws DOMException on auth tag failure — do not catch here)
  const ptBytes = await aesGcmDecrypt(aesKey, ivAndCt)

  // 6. Parse plaintext JSON into SealedPayload
  const payload = JSON.parse(new TextDecoder().decode(ptBytes)) as SealedPayload
  const { cert, inner } = payload

  // 7. Verify the SenderCertificate signature
  //    a. Reconstruct canonical JSON with keys in the same order used during seal
  const canonicalObj = {
    senderUuid: cert.senderUuid,
    senderIdentitySigningKey: cert.senderIdentitySigningKey,
    senderIdentityDhKey: cert.senderIdentityDhKey,
    recipientUuid: cert.recipientUuid,
    recipientIdentityDhKey: cert.recipientIdentityDhKey,
    issuedAt: cert.issuedAt,
    expires: cert.expires,
  }
  const canonicalJson = JSON.stringify(canonicalObj)

  //    b. Import sender's signing public key (SPKI base64)
  const signingKey = await importSigningPublicKey(cert.senderIdentitySigningKey)

  //    c. Verify signature
  const valid = await verifySignature(
    signingKey,
    cert.signature,
    new TextEncoder().encode(canonicalJson)
  )
  if (!valid) {
    throw new Error('Sealed sender: invalid cert signature')
  }

  // 8. Check sender certificate expiration
  if (new Date(cert.expires).getTime() < Date.now()) {
    throw new Error('Sealed sender: sender certificate has expired')
  }

  // 9. Verify the cert was addressed to us (prevents re-targeting AND reflection attacks).
  //    This single check suffices: a reflected message would have a different recipient DH key
  //    than ours, so it would fail here. We intentionally allow senderUuid === myUuid because
  //    multi-device sync messages and self-notes are sent between devices of the same user.
  if (cert.recipientIdentityDhKey !== myDhPubKeyBase64) {
    throw new Error('Sealed sender: cert recipient mismatch')
  }

  // 10. Return the authenticated payload
  return { inner, senderUuid: cert.senderUuid, cert }
}
