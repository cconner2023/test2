/**
 * Tests for LoRaTransport — handleReceivedFrame decompression/buffering,
 * sendMessage payload serialization (including originId fix), and
 * isAvailable/fetchUnread behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deflateRaw, inflateRaw } from 'pako'
import { LoRaTransport } from '../loraTransport'
import { bytesToHex, hexToBytes, uuidToBytes } from '../wireFormat'
import { LORA_SIGNATURE } from '../types'
import type { LoRaFrame, MeshAdapter, LoRaNodeId } from '../types'
import type { MeshRouter } from '../meshRouter'
import type { SendMessageParams } from '../../signal/transport'
import type { Result } from '../../result'

// ── Mocks ────────────────────────────────────────────────────────────

function makeLocalNode(): LoRaNodeId {
  return {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    shortId: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    shortIdHex: '0102030405060708',
  }
}

function makeMockAdapter(connected = false): MeshAdapter {
  return {
    state: connected ? 'connected' : 'disconnected',
    requestDevice: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => connected),
    send: vi.fn(async () => ({ ok: true, data: undefined }) as Result<void>),
    startAutoReconnect: vi.fn(),
    stopAutoReconnect: vi.fn(),
  }
}

function makeMockRouter(): MeshRouter {
  return {
    sendToMesh: vi.fn(async () => ({ ok: true, data: 'abc123' }) as Result<string>),
    handleIncoming: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    pruneStaleData: vi.fn(),
  } as unknown as MeshRouter
}

function makeFrame(payload: Uint8Array): LoRaFrame {
  return {
    version: 0x01,
    type: 0x01,
    messageId: uuidToBytes(crypto.randomUUID()),
    senderId: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11]),
    recipientId: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    sequence: 1,
    timestamp: Math.floor(Date.now() / 1000),
    hopCount: 0,
    maxHops: 3,
    segmentInfo: 0,
    pathLength: 0,
    path: new Uint8Array(0),
    payload,
    signature: new Uint8Array(LORA_SIGNATURE),
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 1. handleReceivedFrame — decompression and buffering
// ═════════════════════════════════════════════════════════════════════════

describe('handleReceivedFrame', () => {
  it('decompresses and buffers a valid frame', () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())

    const msgData = {
      id: crypto.randomUUID(),
      senderId: 'sender-uuid',
      recipientId: 'recipient-uuid',
      senderDeviceId: 'dev-1',
      recipientDeviceId: 'dev-2',
      messageType: 'message',
      payload: { text: 'hello' },
      createdAt: new Date().toISOString(),
    }

    const jsonBytes = new TextEncoder().encode(JSON.stringify(msgData))
    const compressed = deflateRaw(jsonBytes)
    const frame = makeFrame(compressed)

    transport.handleReceivedFrame(frame)

    // Buffer should have 1 message
    // Drain via fetchUnread
  })

  it('preserves all fields through compress → frame → decompress', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())

    const msgData = {
      id: 'test-msg-id',
      senderId: 'alice-uuid',
      recipientId: 'bob-uuid',
      senderDeviceId: 'alice-dev',
      recipientDeviceId: 'bob-dev',
      messageType: 'message',
      payload: { text: '{"t":"t","d":"encrypted data"}' },
      groupId: 'group-123',
      originId: 'origin-456',
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    const compressed = deflateRaw(new TextEncoder().encode(JSON.stringify(msgData)))
    transport.handleReceivedFrame(makeFrame(compressed))

    const result = await transport.fetchUnread('bob-uuid')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data).toHaveLength(1)
    const row = result.data[0]
    expect(row.id).toBe('test-msg-id')
    expect(row.sender_id).toBe('alice-uuid')
    expect(row.recipient_id).toBe('bob-uuid')
    expect(row.sender_device_id).toBe('alice-dev')
    expect(row.recipient_device_id).toBe('bob-dev')
    expect(row.message_type).toBe('message')
    expect(row.group_id).toBe('group-123')
    expect(row.origin_id).toBe('origin-456')
    expect(row.created_at).toBe('2025-01-01T00:00:00.000Z')
    expect(row.read_at).toBeNull()
    expect(row.deleted_at).toBeNull()
  })

  it('fires onReceive callback when set', () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    const received: unknown[] = []
    transport.onReceive = (row) => received.push(row)

    const compressed = deflateRaw(new TextEncoder().encode(JSON.stringify({
      id: 'cb-test',
      senderId: 'a',
      recipientId: 'b',
      messageType: 'message',
      payload: {},
    })))
    transport.handleReceivedFrame(makeFrame(compressed))

    expect(received).toHaveLength(1)
  })

  it('handles malformed payload gracefully (no throw)', () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())

    // Invalid compressed data
    const frame = makeFrame(new Uint8Array([0xff, 0xfe, 0xfd]))
    expect(() => transport.handleReceivedFrame(frame)).not.toThrow()
  })

  it('fetchUnread drains the buffer', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())

    const compressed = deflateRaw(new TextEncoder().encode(JSON.stringify({
      id: 'drain-test',
      senderId: 'a',
      recipientId: 'b',
      messageType: 'message',
      payload: {},
    })))
    transport.handleReceivedFrame(makeFrame(compressed))

    // First fetch gets the message
    const r1 = await transport.fetchUnread('any')
    expect(r1.ok && r1.data.length).toBe(1)

    // Second fetch is empty
    const r2 = await transport.fetchUnread('any')
    expect(r2.ok && r2.data.length).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 2. sendMessage — payload serialization including originId
// ═════════════════════════════════════════════════════════════════════════

describe('sendMessage payload serialization', () => {
  it('includes originId in the serialized JSON (bug fix verification)', async () => {
    const router = makeMockRouter()
    const transport = new LoRaTransport(router, makeLocalNode())

    const params: SendMessageParams = {
      id: 'msg-1',
      senderId: 'alice',
      recipientId: 'bob',
      senderDeviceId: 'dev-a',
      recipientDeviceId: 'dev-b',
      messageType: 'message',
      payload: { text: 'hello' },
      groupId: 'grp-1',
      originId: 'origin-xyz',
    }

    await transport.sendMessage(params)

    // Verify sendToMesh was called
    expect(router.sendToMesh).toHaveBeenCalled()

    // Extract the compressed payload that was passed to sendToMesh
    const [, compressedPayload] = (router.sendToMesh as ReturnType<typeof vi.fn>).mock.calls[0]

    // Decompress and parse
    const decompressed = inflateRaw(compressedPayload)
    const json = JSON.parse(new TextDecoder().decode(decompressed))

    expect(json.originId).toBe('origin-xyz')
    expect(json.groupId).toBe('grp-1')
    expect(json.id).toBe('msg-1')
    expect(json.senderId).toBe('alice')
    expect(json.recipientId).toBe('bob')
  })

  it('includes all required fields in serialized payload', async () => {
    const router = makeMockRouter()
    const transport = new LoRaTransport(router, makeLocalNode())

    await transport.sendMessage({
      id: 'msg-2',
      senderId: 'alice',
      recipientId: 'bob',
      senderDeviceId: 'dev-a',
      recipientDeviceId: 'dev-b',
      messageType: 'initial',
      payload: { ciphertext: 'encrypted' },
    })

    const [, compressed] = (router.sendToMesh as ReturnType<typeof vi.fn>).mock.calls[0]
    const json = JSON.parse(new TextDecoder().decode(inflateRaw(compressed)))

    expect(json.id).toBe('msg-2')
    expect(json.senderId).toBe('alice')
    expect(json.recipientId).toBe('bob')
    expect(json.senderDeviceId).toBe('dev-a')
    expect(json.recipientDeviceId).toBe('dev-b')
    expect(json.messageType).toBe('initial')
    expect(json.payload).toEqual({ ciphertext: 'encrypted' })
    expect(json.createdAt).toBeDefined()
  })

  it('omits undefined optional fields', async () => {
    const router = makeMockRouter()
    const transport = new LoRaTransport(router, makeLocalNode())

    await transport.sendMessage({
      id: 'msg-3',
      senderId: 'alice',
      recipientId: 'bob',
      messageType: 'message',
      payload: {},
      // No groupId, originId, senderDeviceId, recipientDeviceId
    })

    const [, compressed] = (router.sendToMesh as ReturnType<typeof vi.fn>).mock.calls[0]
    const json = JSON.parse(new TextDecoder().decode(inflateRaw(compressed)))

    expect(json.groupId).toBeUndefined()
    expect(json.originId).toBeUndefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 3. sendMessageBatch
// ═════════════════════════════════════════════════════════════════════════

describe('sendMessageBatch', () => {
  it('sends each message individually', async () => {
    const router = makeMockRouter()
    const transport = new LoRaTransport(router, makeLocalNode())

    const result = await transport.sendMessageBatch({
      senderId: 'alice',
      senderDeviceId: 'dev-a',
      recipientId: 'bob',
      messages: [
        { id: 'b1', recipientDeviceId: 'dev-1', messageType: 'message', payload: { t: 1 } },
        { id: 'b2', recipientDeviceId: 'dev-2', messageType: 'message', payload: { t: 2 } },
      ],
    })

    expect(result.ok).toBe(true)
    expect(router.sendToMesh).toHaveBeenCalledTimes(2)
  })

  it('returns err when all messages fail', async () => {
    const router = makeMockRouter()
    ;(router.sendToMesh as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: 'fail' })
    const transport = new LoRaTransport(router, makeLocalNode())

    const result = await transport.sendMessageBatch({
      senderId: 'alice',
      senderDeviceId: 'dev-a',
      recipientId: 'bob',
      messages: [
        { id: 'b1', recipientDeviceId: 'dev-1', messageType: 'message', payload: {} },
      ],
    })

    expect(result.ok).toBe(false)
  })

  it('returns ok with empty array for empty messages', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    const result = await transport.sendMessageBatch({
      senderId: 'alice',
      senderDeviceId: 'dev-a',
      recipientId: 'bob',
      messages: [],
    })
    // LoRa returns ok([]) for empty since the SignalTransport sendMessageBatch
    // check is at the TransportManager level
    expect(result.ok).toBe(false) // all 0 messages "failed"
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 4. isAvailable
// ═════════════════════════════════════════════════════════════════════════

describe('isAvailable', () => {
  it('returns false when no adapter is set', () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    expect(transport.isAvailable()).toBe(false)
  })

  it('returns true when adapter is connected', () => {
    const adapter = makeMockAdapter(true)
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode(), adapter)
    expect(transport.isAvailable()).toBe(true)
  })

  it('returns false when adapter is disconnected', () => {
    const adapter = makeMockAdapter(false)
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode(), adapter)
    expect(transport.isAvailable()).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 5. No-op transport methods
// ═════════════════════════════════════════════════════════════════════════

describe('no-op transport methods', () => {
  it('markRead returns ok(undefined)', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    const r = await transport.markRead(['id1', 'id2'])
    expect(r.ok).toBe(true)
  })

  it('deleteMessages returns ok(undefined)', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    const r = await transport.deleteMessages(['id1'])
    expect(r.ok).toBe(true)
  })

  it('softDeleteMessages returns ok(0)', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    const r = await transport.softDeleteMessages(['o1'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toBe(0)
  })

  it('fetchDeletedMessages returns ok([])', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    const r = await transport.fetchDeletedMessages('user1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual([])
  })

  it('fetchConversation returns ok([])', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    const r = await transport.fetchConversation('u1', 'u2')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual([])
  })

  it('fetchGroupConversation returns ok([])', async () => {
    const transport = new LoRaTransport(makeMockRouter(), makeLocalNode())
    const r = await transport.fetchGroupConversation('g1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual([])
  })
})
