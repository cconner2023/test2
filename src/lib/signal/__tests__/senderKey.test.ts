/**
 * Sender-key (group) correctness: distribution binding, no chain rewind,
 * rotated-key detection, and out-of-order keys surviving a reload.
 * Real Web Crypto; the IDB store is an in-memory Map shared across reloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../Utilities/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))

const g = globalThis as unknown as { __sk: Map<string, unknown> }
g.__sk = new Map()

vi.mock('../senderKeyStore', () => {
  const db = () => (globalThis as unknown as { __sk: Map<string, unknown> }).__sk
  const id = (gid: string, m: string, d: string) => `${gid}:${m}:${d}`
  return {
    saveSenderKey: async (k: { senderKeyId: string }) => { db().set(k.senderKeyId, structuredClone(k)) },
    loadSenderKey: async (gid: string, m: string, d: string) => db().get(id(gid, m, d)) ?? null,
  }
})

type SenderKeyMod = typeof import('../senderKey')

/** Fresh module instance = a page reload (module-scoped state gone, store kept). */
async function load(): Promise<SenderKeyMod> {
  vi.resetModules()
  return import('../senderKey')
}

/** Separate devices: each gets its own store. */
function useStore(store: Map<string, unknown>) { g.__sk = store }

const G = 'group-1'
const members = ['alice', 'bob', 'mallory']

beforeEach(() => { g.__sk = new Map() })

describe('sender keys', () => {
  it('rejects a distribution for a member other than the authenticated sender', async () => {
    const aliceStore = new Map<string, unknown>()
    const bobStore = new Map<string, unknown>()
    useStore(aliceStore)
    const sk = await load()
    const aliceKey = await sk.generateSenderKey(G, 'alice', 'dev-a')
    const forged = sk.createDistribution(aliceKey)

    useStore(bobStore)
    // Mallory relays a distribution claiming to be alice's key.
    expect(await sk.processSenderKeyDistribution(forged, members, { userId: 'mallory', deviceId: 'dev-m' })).toBe(false)
    expect(await sk.processSenderKeyDistribution(forged, members, { userId: 'alice', deviceId: 'dev-a' })).toBe(true)
  })

  it('a re-delivered distribution does not rewind the chain', async () => {
    const aliceStore = new Map<string, unknown>()
    const bobStore = new Map<string, unknown>()
    useStore(aliceStore)
    const sk = await load()
    await sk.generateSenderKey(G, 'alice', 'dev-a')
    const dist0 = sk.createDistribution((aliceStore.values().next().value) as never)
    const m0 = await sk.senderKeyEncrypt(G, 'alice', 'dev-a', 'zero')
    const m1 = await sk.senderKeyEncrypt(G, 'alice', 'dev-a', 'one')

    useStore(bobStore)
    await sk.processSenderKeyDistribution(dist0, members, { userId: 'alice', deviceId: 'dev-a' })
    expect(await sk.senderKeyDecrypt(m0)).toBe('zero')
    // Stale copy of the same distribution arrives again (catch-up replay).
    await sk.processSenderKeyDistribution(dist0, members, { userId: 'alice', deviceId: 'dev-a' })
    expect(await sk.senderKeyDecrypt(m1)).toBe('one')
  })

  it('a message under a rotated key raises SenderKeyMissingError', async () => {
    const aliceStore = new Map<string, unknown>()
    const bobStore = new Map<string, unknown>()
    useStore(aliceStore)
    const sk = await load()
    const k1 = await sk.generateSenderKey(G, 'alice', 'dev-a')
    const dist1 = sk.createDistribution(k1)
    for (let i = 0; i < 3; i++) await sk.senderKeyEncrypt(G, 'alice', 'dev-a', `old ${i}`)
    await sk.rotateSenderKey(G, 'alice', 'dev-a', 1)
    const fresh = await sk.senderKeyEncrypt(G, 'alice', 'dev-a', 'new')

    useStore(bobStore)
    await sk.processSenderKeyDistribution(dist1, members, { userId: 'alice', deviceId: 'dev-a' })
    await expect(sk.senderKeyDecrypt(fresh)).rejects.toBeInstanceOf(sk.SenderKeyMissingError)
  })

  it('skipped (out-of-order) keys survive a reload', async () => {
    const aliceStore = new Map<string, unknown>()
    const bobStore = new Map<string, unknown>()
    useStore(aliceStore)
    let sk = await load()
    const k = await sk.generateSenderKey(G, 'alice', 'dev-a')
    const dist = sk.createDistribution(k)
    const m0 = await sk.senderKeyEncrypt(G, 'alice', 'dev-a', 'zero')
    const m1 = await sk.senderKeyEncrypt(G, 'alice', 'dev-a', 'one')

    useStore(bobStore)
    await sk.processSenderKeyDistribution(dist, members, { userId: 'alice', deviceId: 'dev-a' })
    expect(await sk.senderKeyDecrypt(m1)).toBe('one')
    sk = await load() // reload before the late message arrives
    expect(await sk.senderKeyDecrypt(m0)).toBe('zero')
  })
})
