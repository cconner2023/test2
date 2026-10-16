/**
 * Two-party session tests for the X3DH handshake and pairwise session lifecycle.
 *
 * Each party gets its own fresh module graph (vi.resetModules) so session.ts /
 * keyManager.ts module state and the in-memory keyStore are fully isolated —
 * the same way two real devices are. Real Web Crypto throughout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PublicKeyBundle, InitialMessage } from '../types'
import type { SealedEnvelope } from '../sealedSender'
import { x3dhInitiate } from '../x3dh'
import { initSender, ratchetEncrypt } from '../ratchet'
import { seal } from '../sealedSender'
import { importDhPublicKey } from '../keyPrimitives'
import { uint8ToBase64 } from '../../base64Utils'
import { encryptAsSystemWith } from '../systemSender'

vi.mock('../../../Utilities/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))

// Shared "server" directory of published identities, keyed by userId. Lives on
// globalThis so every party's fresh signalService mock sees the same directory.
interface Directory { identities: Map<string, Array<{ signing: string; dh: string }>> }
const g = globalThis as unknown as { __dir: Directory }
g.__dir = { identities: new Map() }

vi.mock('../signalService', () => ({
  uploadKeyBundle: vi.fn(async () => ({ ok: true, data: undefined })),
  fetchPublishedIdentities: vi.fn(async (userId: string) => {
    const d = (globalThis as unknown as { __dir: Directory }).__dir
    return { ok: true, data: d.identities.get(userId) ?? [] }
  }),
}))

// In-memory keyStore — a fresh one is doMock'd per party (see makeParty).
function makeStore() {
  const identity: { v: unknown } = { v: null }
  const preKeys = new Map<number, unknown>()
  const spks = new Map<number, { createdAt: string }>()
  const peers = new Map<string, unknown>()
  const sessions = new Map<string, { peerId: string }>()
  return {
    loadLocalIdentity: async () => identity.v,
    saveLocalIdentity: async (i: unknown) => { identity.v = i },
    loadPreKey: async (id: number) => preKeys.get(id) ?? null,
    savePreKeys: async (list: Array<{ keyId: number }>) => { for (const k of list) preKeys.set(k.keyId, k) },
    removePreKey: async (id: number) => { preKeys.delete(id) },
    consumePreKeyAtomic: async (id: number) => { const k = preKeys.get(id) ?? null; preKeys.delete(id); return k },
    getAllPreKeyIds: async () => [...preKeys.keys()],
    loadSignedPreKey: async (id: number) => spks.get(id) ?? null,
    saveSignedPreKey: async (s: { keyId: number; createdAt: string }) => { spks.set(s.keyId, s) },
    getLatestSignedPreKeyId: async () => (spks.size ? Math.max(...spks.keys()) : 0),
    loadLatestSignedPreKey: async () => (spks.size ? spks.get(Math.max(...spks.keys())) : null),
    pruneOldSignedPreKeys: async () => 0,
    loadPeerIdentity: async (k: string) => peers.get(k) ?? null,
    savePeerIdentity: async (p: { identityKey: string }) => { peers.set(p.identityKey, p) },
    getAllPeerIdentities: async () => [...peers.values()],
    loadSession: async (k: string) => sessions.get(k) ?? null,
    saveSession: async (s: { sessionKey: string; peerId: string }) => { sessions.set(s.sessionKey, structuredClone(s)) },
    deleteSession: async (k: string) => { sessions.delete(k) },
    loadSessionsForPeer: async (p: string) => [...sessions.values()].filter(s => s.peerId === p),
    clearSignalStore: async () => {},
    destroySignalStore: async () => {},
    getDb: async () => { throw new Error('no idb in tests') },
    __sessions: sessions,
  }
}

type SessionMod = typeof import('../session')
type KeyManagerMod = typeof import('../keyManager')

interface Party {
  userId: string
  deviceId: string
  session: SessionMod
  km: KeyManagerMod
  /** Server-side copy of this party's OTPK list (popped on fetch). */
  serverOtpks: PublicKeyBundle['oneTimePreKeys']
  bundle: PublicKeyBundle
  store: ReturnType<typeof makeStore>
}

/** Simulate an app reload/update: fresh module graph over the same persisted store. */
async function reload(p: Party): Promise<void> {
  vi.resetModules()
  vi.doMock('../keyStore', () => p.store)
  p.km = await import('../keyManager')
  p.session = await import('../session')
}

async function makeParty(userId: string, otpkCount = 5): Promise<Party> {
  vi.resetModules()
  const store = makeStore()
  vi.doMock('../keyStore', () => store)
  localStorage.clear()
  const km = await import('../keyManager')
  const session = await import('../session')
  const identity = await km.ensureLocalIdentity()
  await km.generateSignedPreKey()
  if (otpkCount > 0) await km.generatePreKeys(otpkCount)
  const bundle = (await km.assemblePublicKeyBundle(userId, identity.deviceId))!
  const list = g.__dir.identities.get(userId) ?? []
  list.push({ signing: bundle.identitySigningKey, dh: bundle.identityDhKey })
  g.__dir.identities.set(userId, list)
  return { userId, deviceId: identity.deviceId, session, km, serverOtpks: [...bundle.oneTimePreKeys], bundle, store }
}

/** Server consume_peer_bundle_for_device: hand out the bundle, popping one OTPK. */
function fetchBundle(p: Party): PublicKeyBundle {
  const otpk = p.serverOtpks.shift()
  return { ...p.bundle, oneTimePreKeys: otpk ? [otpk] : [] }
}

async function send(from: Party, to: Party, text: string): Promise<SealedEnvelope> {
  if (await from.session.hasSession(to.userId, to.deviceId)) {
    return from.session.encryptMessage(to.userId, to.deviceId, text, from.userId)
  }
  return from.session.createOutboundSession(to.userId, to.deviceId, fetchBundle(to), text, from.userId)
}

async function recv(at: Party, from: Party, env: SealedEnvelope): Promise<string> {
  const { plaintext } = await at.session.processIncomingMessage(from.deviceId, env, at.userId)
  return plaintext
}

beforeEach(() => {
  g.__dir.identities = new Map()
})

describe('1:1 handshake', () => {
  it('baseline: initiate, reply, continue', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob')
    expect(await recv(b, a, await send(a, b, 'hi'))).toBe('hi')
    expect(await recv(a, b, await send(b, a, 'yo'))).toBe('yo')
    expect(await recv(b, a, await send(a, b, 'again'))).toBe('again')
  })

  it('glare: both sides initiate before either receives — sessions converge', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob')
    const fromA = await send(a, b, 'a1')
    const fromB = await send(b, a, 'b1')
    expect(await recv(b, a, fromA)).toBe('a1')
    expect(await recv(a, b, fromB)).toBe('b1')
    // Subsequent traffic in both directions must decrypt.
    expect(await recv(b, a, await send(a, b, 'a2'))).toBe('a2')
    expect(await recv(a, b, await send(b, a, 'b2'))).toBe('b2')
    expect(await recv(b, a, await send(a, b, 'a3'))).toBe('a3')
  })

  it('replayed initial (no one-time pre-key) does not clobber the live session', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob', 0) // OTPK pool empty
    const first = await send(a, b, 'hi')
    expect(await recv(b, a, first)).toBe('hi')
    expect(await recv(a, b, await send(b, a, 'yo'))).toBe('yo')
    expect(await recv(b, a, await send(a, b, 'm2'))).toBe('m2')
    // Catch-up replays the original initial row after a reload.
    await recv(b, a, first).catch(() => {})
    expect(await recv(b, a, await send(a, b, 'm3'))).toBe('m3')
    expect(await recv(a, b, await send(b, a, 'r3'))).toBe('r3')
  })

  it('replayed ratchet message is reported as a duplicate', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob')
    await recv(b, a, await send(a, b, 'hi'))
    await recv(a, b, await send(b, a, 'yo'))
    const m = await send(a, b, 'm2')
    await recv(b, a, m)
    await expect(recv(b, a, m)).rejects.toBeInstanceOf(b.session.DuplicateMessageError)
  })

  it('out-of-order: second message arrives before the initial', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob')
    const m1 = await send(a, b, 'm1')
    const m2 = await send(a, b, 'm2')
    expect(await recv(b, a, m2)).toBe('m2')
    expect(await recv(b, a, m1)).toBe('m1')
    expect(await recv(a, b, await send(b, a, 'yo'))).toBe('yo')
  })

  it('failed initial decrypt does not burn the one-time pre-key', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob')
    const before = await b.km.getPreKeyCount()
    // Hand-build an initial whose ephemeral key is wrong: bob loads the OTPK,
    // derives a different secret, and the first ratchet message fails to open.
    const aId = await a.km.ensureLocalIdentity()
    const bundle = fetchBundle(b)
    const x = await x3dhInitiate(aId, bundle)
    const spk = await importDhPublicKey(bundle.signedPreKey.publicKey)
    const st = await initSender(x.sharedSecret, spk, bundle.signedPreKey.publicKey)
    const { message } = await ratchetEncrypt(st, new TextEncoder().encode('bad'), x.associatedData)
    const other = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const wrongEph = uint8ToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', other.publicKey)))
    const bad: InitialMessage = {
      identitySigningKey: aId.signingPublicKeyBase64, identityDhKey: aId.dhPublicKeyBase64,
      ephemeralKey: wrongEph, signedPreKeyId: x.signedPreKeyId, oneTimePreKeyId: x.oneTimePreKeyId, message,
    }
    const env = await seal(bad as unknown as Record<string, unknown>, a.userId, aId, b.userId, bundle.identityDhKey)
    await expect(recv(b, a, env)).rejects.toThrow()
    expect(await b.km.getPreKeyCount()).toBe(before)
    expect(await recv(b, a, await send(a, b, 'hi'))).toBe('hi')
    expect(await b.km.getPreKeyCount()).toBe(before - 1)
  })

  it('impersonation: a cert claiming another user with unpublished keys is rejected', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob')
    const m = await makeParty('mallory')
    // Mallory seals with her own keys but claims to be alice.
    const forged = await m.session.createOutboundSession(b.userId, b.deviceId, fetchBundle(b), 'i am alice', a.userId)
    await expect(b.session.processIncomingMessage(m.deviceId, forged, b.userId)).rejects.toThrow(/not published/i)
  })

  it('vault-style stateless sends open independently across drains', async () => {
    const a = await makeParty('alice')
    const vault = await makeParty('bob')
    const aId = await a.km.ensureLocalIdentity()
    const cachedBundle = { ...vault.bundle, oneTimePreKeys: [] } // read, never consumed
    const m1 = await encryptAsSystemWith(aId, a.userId, vault.userId, cachedBundle, 'one')
    expect(await recv(vault, a, m1)).toBe('one')
    // Next drain holds no ratchet state from the previous one.
    await vault.session.deleteSession(a.userId, a.deviceId)
    const m2 = await encryptAsSystemWith(aId, a.userId, vault.userId, cachedBundle, 'two')
    expect(await recv(vault, a, m2)).toBe('two')
    expect(await vault.km.getPreKeyCount()).toBe(5) // pool untouched
  })

  it('session saved before base keys existed still opens a repeated header', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob')
    expect(await recv(b, a, await send(a, b, 'm1'))).toBe('m1') // consumed bob's OTPK
    // Bob's session was written by the previous build: no baseKey recorded.
    for (const rec of b.store.__sessions.values()) delete (rec as { baseKey?: string }).baseKey
    await reload(b)
    // Alice's session is still pending, so m2 repeats the X3DH header.
    expect(await recv(b, a, await send(a, b, 'm2'))).toBe('m2')
    expect(await recv(a, b, await send(b, a, 'r1'))).toBe('r1')
  })

  it('vault-first: a device→vault row opens statelessly, repeatedly, on any device', async () => {
    const a = await makeParty('alice')
    const vault = await makeParty('bob')
    const aId = await a.km.ensureLocalIdentity()
    const vId = await vault.km.ensureLocalIdentity()
    const spk = (await vault.store.loadSignedPreKey(vault.bundle.signedPreKey.keyId)) as {
      keyId: number; publicKey: CryptoKey; privateKey: CryptoKey; publicKeyBase64: string
    }
    const keys = {
      dhPrivateKey: vId.dhPrivateKey,
      dhPublicKeyBase64: vId.dhPublicKeyBase64,
      signedPreKeys: [spk],
      preKeys: [],
    }
    const env = await encryptAsSystemWith(aId, a.userId, vault.userId, { ...vault.bundle, oneTimePreKeys: [] }, 'hello')
    // Two different devices of bob (fresh module graphs) both open the same row.
    expect((await vault.session.openVaultEnvelope(a.deviceId, env, vault.userId, keys)).plaintext).toBe('hello')
    const otherDevice = await makeParty('bob')
    expect((await otherDevice.session.openVaultEnvelope(a.deviceId, env, vault.userId, keys)).plaintext).toBe('hello')
  })

  it('vault-first: a vault row from an unpublished identity is rejected', async () => {
    const vault = await makeParty('bob')
    const m = await makeParty('mallory')
    const mId = await m.km.ensureLocalIdentity()
    const vId = await vault.km.ensureLocalIdentity()
    const spk = (await vault.store.loadSignedPreKey(vault.bundle.signedPreKey.keyId)) as {
      keyId: number; publicKey: CryptoKey; privateKey: CryptoKey; publicKeyBase64: string
    }
    const keys = { dhPrivateKey: vId.dhPrivateKey, dhPublicKeyBase64: vId.dhPublicKeyBase64, signedPreKeys: [spk], preKeys: [] }
    // Mallory claims to be alice.
    const forged = await encryptAsSystemWith(mId, 'alice', vault.userId, { ...vault.bundle, oneTimePreKeys: [] }, 'i am alice')
    await expect(vault.session.openVaultEnvelope(m.deviceId, forged, vault.userId, keys)).rejects.toThrow(/not published/i)
  })

  it('lost initial: the follow-up still carries the handshake', async () => {
    const a = await makeParty('alice')
    const b = await makeParty('bob')
    void await send(a, b, 'lost') // initial never delivered
    expect(await recv(b, a, await send(a, b, 'y'))).toBe('y')
    expect(await recv(a, b, await send(b, a, 'z'))).toBe('z')
  })
})
