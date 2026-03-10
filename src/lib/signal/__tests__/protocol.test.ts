/**
 * Tests for Signal Protocol core crypto — KDF, Double Ratchet, Sealed Sender.
 *
 * Uses REAL Web Crypto API (no crypto mocking) for true integration-level
 * confidence in the cryptographic pipeline. Only Logger and keyStore are mocked.
 */

import { describe, it, expect, vi } from 'vitest'
import { uint8ToBase64, base64ToUint8 } from '../../base64Utils'
import { kdfX3dh, kdfRootKey, kdfChainKey } from '../kdf'
import { initSender, initReceiver, ratchetEncrypt, ratchetDecrypt } from '../ratchet'
import { seal, unseal } from '../sealedSender'
import { x3dhInitiate, x3dhRespond } from '../x3dh'
import { performDh, importDhPublicKey } from '../keyManager'
import type { StoredLocalIdentity, PublicKeyBundle, RatchetKeyPair } from '../types'

// ── Mocks (non-crypto only) ──

vi.mock('../../../Utilities/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))

vi.mock('../keyStore', () => ({
  getIdentity: vi.fn(async () => null),
  putIdentity: vi.fn(async () => {}),
  getSignedPreKey: vi.fn(async () => null),
  putSignedPreKey: vi.fn(async () => {}),
  getPreKey: vi.fn(async () => null),
  putPreKey: vi.fn(async () => {}),
  deletePreKey: vi.fn(async () => {}),
  getPeerIdentity: vi.fn(async () => null),
  putPeerIdentity: vi.fn(async () => {}),
}))

// ── Key generation helpers ──

async function generateDhKeyPair(): Promise<RatchetKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' } as EcKeyGenParams,
    true,
    ['deriveBits'],
  )
  const pubRaw = await crypto.subtle.exportKey('raw', pair.publicKey)
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    publicKeyBase64: uint8ToBase64(new Uint8Array(pubRaw)),
  }
}

async function generateSigningKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' } as EcKeyGenParams,
    true,
    ['sign', 'verify'],
  )
  const pubSpki = await crypto.subtle.exportKey('spki', pair.publicKey)
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    publicKeyBase64: uint8ToBase64(new Uint8Array(pubSpki)),
  }
}

/** Build a full StoredLocalIdentity with real key material. */
async function buildIdentity(deviceId = 'dev-1'): Promise<StoredLocalIdentity> {
  const signing = await generateSigningKeyPair()
  const dh = await generateDhKeyPair()
  return {
    deviceId,
    signingPublicKey: signing.publicKey,
    signingPrivateKey: signing.privateKey,
    dhPublicKey: dh.publicKey,
    dhPrivateKey: dh.privateKey,
    signingPublicKeyBase64: signing.publicKeyBase64,
    dhPublicKeyBase64: dh.publicKeyBase64,
    nextPreKeyId: 1,
    createdAt: new Date().toISOString(),
  }
}

/** Build a signed pre-key pair, signed by the identity signing key. */
async function buildSignedPreKey(
  identity: StoredLocalIdentity,
  keyId = 1,
): Promise<{ pair: RatchetKeyPair; signature: string }> {
  const pair = await generateDhKeyPair()
  const pubBytes = base64ToUint8(pair.publicKeyBase64)
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.signingPrivateKey,
    pubBytes,
  )
  return { pair, signature: uint8ToBase64(new Uint8Array(sigBuf)) }
}

/** Build a PublicKeyBundle for X3DH. */
async function buildBundle(
  identity: StoredLocalIdentity,
  userId: string,
  includeOtpk = true,
): Promise<{ bundle: PublicKeyBundle; spkPair: RatchetKeyPair; otpkPair?: RatchetKeyPair }> {
  const { pair: spkPair, signature } = await buildSignedPreKey(identity)
  let otpkPair: RatchetKeyPair | undefined
  const oneTimePreKeys: { keyId: number; publicKey: string }[] = []
  if (includeOtpk) {
    otpkPair = await generateDhKeyPair()
    oneTimePreKeys.push({ keyId: 1, publicKey: otpkPair.publicKeyBase64 })
  }
  return {
    bundle: {
      userId,
      deviceId: identity.deviceId,
      identitySigningKey: identity.signingPublicKeyBase64,
      identityDhKey: identity.dhPublicKeyBase64,
      signedPreKey: { keyId: 1, publicKey: spkPair.publicKeyBase64, signature },
      oneTimePreKeys,
    },
    spkPair,
    otpkPair,
  }
}

/** Run full X3DH handshake and initialize ratchet states for Alice and Bob. */
async function setupSession() {
  const alice = await buildIdentity('alice-dev')
  const bob = await buildIdentity('bob-dev')
  const { bundle: bobBundle, spkPair: bobSpk, otpkPair: bobOtpk } = await buildBundle(bob, 'bob-uuid')

  // Alice initiates X3DH
  const initResult = await x3dhInitiate(alice, bobBundle)

  // Bob responds
  const bobOtpkKeyPair = bobOtpk
    ? { publicKey: bobOtpk.publicKey, privateKey: bobOtpk.privateKey }
    : null
  const respResult = await x3dhRespond(
    bob,
    { publicKey: bobSpk.publicKey, privateKey: bobSpk.privateKey },
    bobOtpkKeyPair,
    alice.dhPublicKeyBase64,
    initResult.ephemeralPublicKeyBase64,
  )

  // Verify shared secrets match
  expect(uint8ToBase64(initResult.sharedSecret)).toBe(uint8ToBase64(respResult.sharedSecret))
  expect(uint8ToBase64(initResult.associatedData)).toBe(uint8ToBase64(respResult.associatedData))

  // Initialize ratchet
  const peerSpk = await importDhPublicKey(bobBundle.signedPreKey.publicKey)
  const aliceState = await initSender(initResult.sharedSecret, peerSpk, bobBundle.signedPreKey.publicKey)
  const bobState = await initReceiver(respResult.sharedSecret, bobSpk)
  const ad = initResult.associatedData

  return { alice, bob, aliceState, bobState, ad }
}

// ═══════════════════════════════════════════════════════════════════════
// KDF Tests
// ═══════════════════════════════════════════════════════════════════════

describe('kdfX3dh', () => {
  it('produces 32-byte output from 96 bytes (3 DH ops)', async () => {
    const input = crypto.getRandomValues(new Uint8Array(96))
    const result = await kdfX3dh(input)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(32)
  })

  it('produces 32-byte output from 128 bytes (4 DH ops)', async () => {
    const input = crypto.getRandomValues(new Uint8Array(128))
    const result = await kdfX3dh(input)
    expect(result.length).toBe(32)
  })

  it('is deterministic — same input produces same output', async () => {
    const input = crypto.getRandomValues(new Uint8Array(96))
    const a = await kdfX3dh(input)
    const b = await kdfX3dh(input)
    expect(uint8ToBase64(a)).toBe(uint8ToBase64(b))
  })
})

describe('kdfRootKey', () => {
  it('produces rootKey and chainKey as base64 strings', async () => {
    const rootKey = uint8ToBase64(crypto.getRandomValues(new Uint8Array(32)))
    const dhOutput = crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer
    const { rootKey: newRk, chainKey } = await kdfRootKey(rootKey, dhOutput)
    // Both should be base64-encoded 32-byte values
    expect(base64ToUint8(newRk).length).toBe(32)
    expect(base64ToUint8(chainKey).length).toBe(32)
  })
})

describe('kdfChainKey', () => {
  it('produces new chainKey (string) and messageKey (32 bytes)', async () => {
    const ck = uint8ToBase64(crypto.getRandomValues(new Uint8Array(32)))
    const { chainKey, messageKey } = await kdfChainKey(ck)
    expect(typeof chainKey).toBe('string')
    expect(base64ToUint8(chainKey).length).toBe(32)
    expect(messageKey).toBeInstanceOf(Uint8Array)
    expect(messageKey.length).toBe(32)
  })

  it('different chain keys produce different message keys', async () => {
    const ck1 = uint8ToBase64(crypto.getRandomValues(new Uint8Array(32)))
    const ck2 = uint8ToBase64(crypto.getRandomValues(new Uint8Array(32)))
    const r1 = await kdfChainKey(ck1)
    const r2 = await kdfChainKey(ck2)
    expect(uint8ToBase64(r1.messageKey)).not.toBe(uint8ToBase64(r2.messageKey))
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Double Ratchet Tests
// ═══════════════════════════════════════════════════════════════════════

describe('Ratchet initialization', () => {
  it('initSender produces valid state with sendingChainKey', async () => {
    const { aliceState } = await setupSession()
    expect(aliceState.sendingChainKey).toBeTruthy()
    expect(aliceState.receivingChainKey).toBeNull()
    expect(aliceState.sendingCount).toBe(0)
    expect(aliceState.receivingCount).toBe(0)
    expect(aliceState.previousSendingCount).toBe(0)
    expect(aliceState.skippedKeys).toEqual({})
  })

  it('initReceiver produces valid state with null chain keys', async () => {
    const { bobState } = await setupSession()
    expect(bobState.sendingChainKey).toBeNull()
    expect(bobState.receivingChainKey).toBeNull()
    expect(bobState.sendingCount).toBe(0)
  })
})

describe('Ratchet encrypt-decrypt', () => {
  it('round-trips a single message', async () => {
    const { aliceState, bobState, ad } = await setupSession()
    const plaintext = new TextEncoder().encode('Hello, Bob!')

    const { state: aliceAfter, message } = await ratchetEncrypt(aliceState, plaintext, ad)
    expect(aliceAfter.sendingCount).toBe(1)

    const { state: bobAfter, plaintext: decrypted } = await ratchetDecrypt(bobState, message, ad)
    expect(new TextDecoder().decode(decrypted)).toBe('Hello, Bob!')
    expect(bobAfter.receivingCount).toBe(1)
  })

  it('handles multiple messages in order', async () => {
    let { aliceState, bobState, ad } = await setupSession()
    const messages = ['Message 1', 'Message 2', 'Message 3']
    const encrypted = []

    for (const msg of messages) {
      const { state, message } = await ratchetEncrypt(aliceState, new TextEncoder().encode(msg), ad)
      aliceState = state
      encrypted.push(message)
    }
    expect(aliceState.sendingCount).toBe(3)

    for (let i = 0; i < encrypted.length; i++) {
      const { state, plaintext } = await ratchetDecrypt(bobState, encrypted[i], ad)
      bobState = state
      expect(new TextDecoder().decode(plaintext)).toBe(messages[i])
    }
  })

  it('supports bidirectional messaging with DH ratchet steps', async () => {
    let { aliceState, bobState, ad } = await setupSession()

    // Alice → Bob
    const { state: a1, message: m1 } = await ratchetEncrypt(aliceState, new TextEncoder().encode('A→B'), ad)
    aliceState = a1
    const { state: b1, plaintext: p1 } = await ratchetDecrypt(bobState, m1, ad)
    bobState = b1
    expect(new TextDecoder().decode(p1)).toBe('A→B')

    // Bob → Alice (triggers DH ratchet step)
    const { state: b2, message: m2 } = await ratchetEncrypt(bobState, new TextEncoder().encode('B→A'), ad)
    bobState = b2
    const { state: a2, plaintext: p2 } = await ratchetDecrypt(aliceState, m2, ad)
    aliceState = a2
    expect(new TextDecoder().decode(p2)).toBe('B→A')

    // Alice → Bob again (another DH ratchet step)
    const { state: a3, message: m3 } = await ratchetEncrypt(aliceState, new TextEncoder().encode('A→B again'), ad)
    aliceState = a3
    const { state: b3, plaintext: p3 } = await ratchetDecrypt(bobState, m3, ad)
    bobState = b3
    expect(new TextDecoder().decode(p3)).toBe('A→B again')
  })

  it('throws on wrong associated data', async () => {
    const { aliceState, bobState, ad } = await setupSession()
    const { message } = await ratchetEncrypt(aliceState, new TextEncoder().encode('secret'), ad)

    const wrongAd = crypto.getRandomValues(new Uint8Array(ad.length))
    await expect(ratchetDecrypt(bobState, message, wrongAd)).rejects.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Sealed Sender Tests
// ═══════════════════════════════════════════════════════════════════════

describe('Sealed Sender', () => {
  it('seal-unseal round-trip recovers inner payload', async () => {
    const sender = await buildIdentity('sender-dev')
    const recipient = await buildIdentity('recipient-dev')

    const inner = { type: 'message', body: 'Hello from sealed sender' }
    const envelope = await seal(
      inner,
      'sender-uuid',
      sender,
      'recipient-uuid',
      recipient.dhPublicKeyBase64,
    )

    expect(envelope.v).toBe(1)
    expect(envelope.ephemeralKey).toBeTruthy()
    expect(envelope.ciphertext).toBeTruthy()

    const result = await unseal(
      envelope,
      'recipient-uuid',
      recipient.dhPrivateKey,
      recipient.dhPublicKeyBase64,
    )

    expect(result.senderUuid).toBe('sender-uuid')
    expect(result.inner).toEqual(inner)
  })

  it('throws with wrong recipient key', async () => {
    const sender = await buildIdentity('sender-dev')
    const recipient = await buildIdentity('recipient-dev')
    const wrong = await buildIdentity('wrong-dev')

    const envelope = await seal(
      { data: 'secret' },
      'sender-uuid',
      sender,
      'recipient-uuid',
      recipient.dhPublicKeyBase64,
    )

    // Trying to unseal with wrong key should fail (AES-GCM auth failure)
    await expect(
      unseal(envelope, 'wrong-uuid', wrong.dhPrivateKey, wrong.dhPublicKeyBase64),
    ).rejects.toThrow()
  })

  it('cert contains correct sender/recipient UUIDs', async () => {
    const sender = await buildIdentity('sender-dev')
    const recipient = await buildIdentity('recipient-dev')

    const envelope = await seal(
      { msg: 'test' },
      'alice-uuid',
      sender,
      'bob-uuid',
      recipient.dhPublicKeyBase64,
    )

    const result = await unseal(
      envelope,
      'bob-uuid',
      recipient.dhPrivateKey,
      recipient.dhPublicKeyBase64,
    )

    expect(result.cert.senderUuid).toBe('alice-uuid')
    expect(result.cert.recipientUuid).toBe('bob-uuid')
    expect(result.cert.senderIdentityDhKey).toBe(sender.dhPublicKeyBase64)
    expect(result.cert.recipientIdentityDhKey).toBe(recipient.dhPublicKeyBase64)
    expect(result.cert.signature).toBeTruthy()
    // Verify cert hasn't expired
    expect(new Date(result.cert.expires).getTime()).toBeGreaterThan(Date.now())
  })
})

// ═══════════════════════════════════════════════════════════════════════
// X3DH Integration
// ═══════════════════════════════════════════════════════════════════════

describe('X3DH key agreement', () => {
  it('initiator and responder derive the same shared secret', async () => {
    // setupSession already verifies this, but let's be explicit
    const alice = await buildIdentity('alice-dev')
    const bob = await buildIdentity('bob-dev')
    const { bundle, spkPair, otpkPair } = await buildBundle(bob, 'bob-uuid')

    const initResult = await x3dhInitiate(alice, bundle)
    const respResult = await x3dhRespond(
      bob,
      { publicKey: spkPair.publicKey, privateKey: spkPair.privateKey },
      otpkPair ? { publicKey: otpkPair.publicKey, privateKey: otpkPair.privateKey } : null,
      alice.dhPublicKeyBase64,
      initResult.ephemeralPublicKeyBase64,
    )

    expect(uint8ToBase64(initResult.sharedSecret)).toBe(uint8ToBase64(respResult.sharedSecret))
    expect(initResult.sharedSecret.length).toBe(32)
  })

  it('works without one-time pre-key', async () => {
    const alice = await buildIdentity('alice-dev')
    const bob = await buildIdentity('bob-dev')
    const { bundle, spkPair } = await buildBundle(bob, 'bob-uuid', false /* no otpk */)

    const initResult = await x3dhInitiate(alice, bundle)
    expect(initResult.oneTimePreKeyId).toBeNull()

    const respResult = await x3dhRespond(
      bob,
      { publicKey: spkPair.publicKey, privateKey: spkPair.privateKey },
      null,
      alice.dhPublicKeyBase64,
      initResult.ephemeralPublicKeyBase64,
    )

    expect(uint8ToBase64(initResult.sharedSecret)).toBe(uint8ToBase64(respResult.sharedSecret))
  })
})
