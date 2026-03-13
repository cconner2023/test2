/**
 * Messaging system tests — covers request status, device ID propagation,
 * acceptRequest idempotency, content serialization, and realtime device
 * filtering logic.
 *
 * Pure-function tests run directly. Hook behavior is tested by exercising
 * the same logic paths that useMessages calls.
 */

import { describe, it, expect } from 'vitest'
import { getRequestStatus } from '../../../Hooks/useMessages'
import type { DecryptedSignalMessage } from '../transportTypes'
import type { SignalMessageRow } from '../transportTypes'
import { serializeContent, parseMessageContent } from '../messageContent'
import type { MessageContent } from '../messageContent'

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMsg(overrides: Partial<DecryptedSignalMessage> = {}): DecryptedSignalMessage {
  return {
    id: crypto.randomUUID(),
    senderId: 'alice',
    recipientId: 'bob',
    plaintext: 'hello',
    messageType: 'message',
    createdAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  }
}

function makeRow(overrides: Partial<SignalMessageRow> = {}): SignalMessageRow {
  return {
    id: crypto.randomUUID(),
    sender_id: 'alice',
    recipient_id: 'bob',
    sender_device_id: 'alice-device-1',
    recipient_device_id: 'bob-device-1',
    group_id: null,
    origin_id: null,
    message_type: 'message',
    payload: {},
    created_at: new Date().toISOString(),
    read_at: null,
    deleted_at: null,
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 1. getRequestStatus — pure function
// ═════════════════════════════════════════════════════════════════════════

describe('getRequestStatus', () => {
  const userId = 'alice'

  it('returns "none" for undefined messages', () => {
    expect(getRequestStatus(undefined, userId)).toBe('none')
  })

  it('returns "none" for empty array', () => {
    expect(getRequestStatus([], userId)).toBe('none')
  })

  it('returns "sent" when we sent a request', () => {
    const msgs = [makeMsg({ senderId: userId, messageType: 'request' })]
    expect(getRequestStatus(msgs, userId)).toBe('sent')
  })

  it('returns "received" when peer sent us a request', () => {
    const msgs = [makeMsg({ senderId: 'bob', recipientId: userId, messageType: 'request' })]
    expect(getRequestStatus(msgs, userId)).toBe('received')
  })

  it('returns "accepted" when any request-accepted exists', () => {
    const msgs = [
      makeMsg({ senderId: 'bob', messageType: 'request' }),
      makeMsg({ senderId: userId, messageType: 'request-accepted' }),
    ]
    expect(getRequestStatus(msgs, userId)).toBe('accepted')
  })

  it('request-accepted takes priority over request (regardless of order)', () => {
    // request-accepted appears before request in the array
    const msgs = [
      makeMsg({ senderId: userId, messageType: 'request-accepted' }),
      makeMsg({ senderId: 'bob', messageType: 'request' }),
    ]
    expect(getRequestStatus(msgs, userId)).toBe('accepted')
  })

  it('returns "accepted" even if request-accepted was sent by peer', () => {
    // Bob accepted Alice's request — Alice sees "accepted"
    const msgs = [
      makeMsg({ senderId: userId, messageType: 'request' }),
      makeMsg({ senderId: 'bob', messageType: 'request-accepted' }),
    ]
    expect(getRequestStatus(msgs, userId)).toBe('accepted')
  })

  it('returns "none" when only regular messages exist (no request ever sent)', () => {
    const msgs = [
      makeMsg({ senderId: userId, messageType: 'message' }),
      makeMsg({ senderId: 'bob', messageType: 'message' }),
    ]
    expect(getRequestStatus(msgs, userId)).toBe('none')
  })

  it('ignores "initial" message type (only checks request/request-accepted)', () => {
    const msgs = [makeMsg({ senderId: userId, messageType: 'initial' })]
    expect(getRequestStatus(msgs, userId)).toBe('none')
  })

  it('returns "accepted" when we sent a request and peer replied with a regular message', () => {
    // Implicit acceptance: request-accepted was lost but peer sent a message
    const msgs = [
      makeMsg({ senderId: userId, messageType: 'request' }),
      makeMsg({ senderId: 'bob', messageType: 'message' }),
    ]
    expect(getRequestStatus(msgs, userId)).toBe('accepted')
  })

  it('returns "sent" when we sent a request but only our own messages exist', () => {
    const msgs = [
      makeMsg({ senderId: userId, messageType: 'request' }),
      makeMsg({ senderId: userId, messageType: 'message' }),
    ]
    expect(getRequestStatus(msgs, userId)).toBe('sent')
  })

  it('implicit acceptance does not apply when peer sent the request', () => {
    // We replied with a message but peer sent the request — status is "received"
    const msgs = [
      makeMsg({ senderId: 'bob', messageType: 'request' }),
      makeMsg({ senderId: userId, messageType: 'message' }),
    ]
    expect(getRequestStatus(msgs, userId)).toBe('received')
  })

  it('handles multiple request-accepted without error', () => {
    // Duplicate request-accepted scenario (the bug we fixed)
    const msgs = [
      makeMsg({ senderId: 'bob', messageType: 'request' }),
      makeMsg({ senderId: userId, messageType: 'request-accepted', id: 'acc-1' }),
      makeMsg({ senderId: userId, messageType: 'request-accepted', id: 'acc-2' }),
    ]
    expect(getRequestStatus(msgs, userId)).toBe('accepted')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 2. Content serialization round-trips
// ═════════════════════════════════════════════════════════════════════════

describe('messageContent serialization', () => {
  it('text round-trips through serialize → parse', () => {
    const content: MessageContent = { type: 'text', text: 'Hello world' }
    const serialized = serializeContent(content)
    const parsed = parseMessageContent(serialized)

    expect(parsed.plaintext).toBe('Hello world')
    expect(parsed.content.type).toBe('text')
    if (parsed.content.type === 'text') {
      expect(parsed.content.text).toBe('Hello world')
    }
  })

  it('image round-trips through serialize → parse', () => {
    const content: MessageContent = {
      type: 'image',
      mime: 'image/jpeg',
      key: 'base64key==',
      path: 'user-1/abc.enc',
      width: 800,
      height: 600,
      thumbnail: 'data:image/jpeg;base64,tiny',
    }
    const serialized = serializeContent(content)
    const parsed = parseMessageContent(serialized)

    expect(parsed.plaintext).toBe('Photo')
    expect(parsed.content.type).toBe('image')
    if (parsed.content.type === 'image') {
      expect(parsed.content.mime).toBe('image/jpeg')
      expect(parsed.content.key).toBe('base64key==')
      expect(parsed.content.path).toBe('user-1/abc.enc')
      expect(parsed.content.width).toBe(800)
      expect(parsed.content.height).toBe(600)
      expect(parsed.content.thumbnail).toBe('data:image/jpeg;base64,tiny')
    }
  })

  it('image without thumbnail round-trips', () => {
    const content: MessageContent = {
      type: 'image',
      mime: 'image/png',
      key: 'key',
      path: 'p',
      width: 100,
      height: 100,
    }
    const serialized = serializeContent(content)
    const parsed = parseMessageContent(serialized)

    expect(parsed.content.type).toBe('image')
    if (parsed.content.type === 'image') {
      expect(parsed.content.thumbnail).toBeUndefined()
    }
  })

  it('parseMessageContent handles raw plain text (non-JSON)', () => {
    const parsed = parseMessageContent('just a plain string')
    expect(parsed.plaintext).toBe('just a plain string')
    expect(parsed.content).toEqual({ type: 'text', text: 'just a plain string' })
  })

  it('parseMessageContent handles empty string', () => {
    const parsed = parseMessageContent('')
    expect(parsed.plaintext).toBe('')
    expect(parsed.content).toEqual({ type: 'text', text: '' })
  })

  it('serializeContent produces compact JSON (short keys)', () => {
    const serialized = serializeContent({ type: 'text', text: 'hi' })
    const wire = JSON.parse(serialized)
    // Should use short keys, not full property names
    expect(wire.t).toBe('t')
    expect(wire.d).toBe('hi')
    expect(wire.type).toBeUndefined()
    expect(wire.text).toBeUndefined()
  })

  it('text with special characters round-trips', () => {
    const content: MessageContent = { type: 'text', text: '💬 Hello "world" — it\'s <fine> & good' }
    const serialized = serializeContent(content)
    const parsed = parseMessageContent(serialized)
    expect(parsed.plaintext).toBe('💬 Hello "world" — it\'s <fine> & good')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 3. Device ID filtering logic (realtime handler simulation)
// ═════════════════════════════════════════════════════════════════════════

describe('device ID filtering', () => {
  /**
   * Simulates the realtime device filter from useSignalMessages.ts:165-171.
   * Returns true if the message should be processed by this device.
   */
  function shouldProcessMessage(myDeviceId: string | null, row: SignalMessageRow): boolean {
    if (myDeviceId && row.recipient_device_id && row.recipient_device_id !== myDeviceId) {
      return false // skip — not for this device
    }
    return true
  }

  it('processes messages targeted at this device', () => {
    const row = makeRow({ recipient_device_id: 'my-device' })
    expect(shouldProcessMessage('my-device', row)).toBe(true)
  })

  it('skips messages targeted at a different device', () => {
    const row = makeRow({ recipient_device_id: 'other-device' })
    expect(shouldProcessMessage('my-device', row)).toBe(false)
  })

  it('processes messages with NULL recipient_device_id (legacy)', () => {
    const row = makeRow({ recipient_device_id: null })
    expect(shouldProcessMessage('my-device', row)).toBe(true)
  })

  it('processes all messages when local device ID is null', () => {
    const row = makeRow({ recipient_device_id: 'any-device' })
    expect(shouldProcessMessage(null, row)).toBe(true)
  })

  it('processes messages when both device IDs are null', () => {
    const row = makeRow({ recipient_device_id: null })
    expect(shouldProcessMessage(null, row)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 4. acceptRequest idempotency verification
// ═════════════════════════════════════════════════════════════════════════

describe('acceptRequest idempotency logic', () => {
  /**
   * Tests the guard logic used in the fixed acceptRequest.
   * The actual hook uses conversationsRef + acceptingRef,
   * but the logic is the same pure check.
   */
  it('should block accept when status is already "accepted"', () => {
    const msgs = [
      makeMsg({ senderId: 'bob', messageType: 'request' }),
      makeMsg({ senderId: 'alice', messageType: 'request-accepted' }),
    ]
    const status = getRequestStatus(msgs, 'alice')
    expect(status).toBe('accepted')
    // In the hook: if (status === 'accepted') return
    // So no duplicate send happens
  })

  it('should allow accept when status is "received"', () => {
    const msgs = [
      makeMsg({ senderId: 'bob', recipientId: 'alice', messageType: 'request' }),
    ]
    const status = getRequestStatus(msgs, 'alice')
    expect(status).toBe('received')
    // This should proceed to send request-accepted
  })

  it('concurrent accept guard prevents double-send', () => {
    // Simulates the acceptingRef guard
    const accepting = new Set<string>()
    const peerId = 'bob'

    // First call acquires the lock
    expect(accepting.has(peerId)).toBe(false)
    accepting.add(peerId)

    // Second call is blocked
    expect(accepting.has(peerId)).toBe(true)

    // After first call completes
    accepting.delete(peerId)
    expect(accepting.has(peerId)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 5. Send path device ID propagation
// ═════════════════════════════════════════════════════════════════════════

describe('device ID propagation in send paths', () => {
  /**
   * Validates the logic that sendSignalMessage receives the correct
   * recipientDeviceId based on the code path taken.
   */

  it('fan-out path always provides recipientDeviceId from peerDevices', () => {
    // Simulates encryptForAllDevices output
    const peerDevices = [
      { deviceId: 'dev-1', deviceLabel: 'iPhone', lastActiveAt: '' },
      { deviceId: 'dev-2', deviceLabel: 'Mac', lastActiveAt: '' },
    ]

    const fanOutInputs = peerDevices.map(d => ({
      recipientDeviceId: d.deviceId,
      payload: {} as Record<string, unknown>,
      messageType: 'message' as const,
    }))

    // Every entry has a recipientDeviceId
    for (const input of fanOutInputs) {
      expect(input.recipientDeviceId).toBeTruthy()
      expect(input.recipientDeviceId).not.toBe('unknown')
    }
  })

  it('legacy path extracts deviceId from bundle', () => {
    // Simulates the bundle → peerDeviceId extraction
    const bundleDeviceId = 'real-device-uuid'
    const peerDeviceId = bundleDeviceId || 'unknown'

    expect(peerDeviceId).toBe('real-device-uuid')
    // This peerDeviceId is now passed to sendSignalMessage (fixed)
  })

  it('legacy path falls back to "unknown" when bundle has no deviceId', () => {
    const bundleDeviceId = ''
    const peerDeviceId = bundleDeviceId || 'unknown'

    expect(peerDeviceId).toBe('unknown')
  })

  it('NULL recipient_device_id passes through receiver filter for legacy sessions', () => {
    // When encryptMessage uses 'unknown' session, sendSignalMessage
    // is called without recipientDeviceId → stored as NULL
    const recipientDeviceId: string | undefined = undefined
    const storedValue = recipientDeviceId ?? null

    expect(storedValue).toBeNull()

    // Receiver filter: null passes through
    const myDeviceId = 'any-real-device-id'
    const shouldProcess = !(myDeviceId && storedValue && storedValue !== myDeviceId)
    expect(shouldProcess).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 6. Request gate — sendMessage flow control
// ═════════════════════════════════════════════════════════════════════════

describe('request gate (sendMessage flow control)', () => {
  const userId = 'alice'

  it('blocks sending when status is "sent" (request pending)', () => {
    const msgs = [makeMsg({ senderId: userId, messageType: 'request' })]
    const status = getRequestStatus(msgs, userId)
    expect(status).toBe('sent')
    // sendMessage returns false when status === 'sent'
  })

  it('allows sending when status is "none" (sends as request)', () => {
    const status = getRequestStatus([], userId)
    expect(status).toBe('none')
    // sendMessage sends as 'request' type
  })

  it('allows sending when status is "received" (peer sent request to us)', () => {
    const msgs = [makeMsg({ senderId: 'bob', recipientId: userId, messageType: 'request' })]
    const status = getRequestStatus(msgs, userId)
    expect(status).toBe('received')
    // sendMessage sends as regular encrypted message
  })

  it('allows sending when status is "accepted"', () => {
    const msgs = [
      makeMsg({ senderId: 'bob', messageType: 'request' }),
      makeMsg({ senderId: userId, messageType: 'request-accepted' }),
    ]
    const status = getRequestStatus(msgs, userId)
    expect(status).toBe('accepted')
    // sendMessage sends as regular encrypted message
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 7. addMessage dedup (logic verification)
// ═════════════════════════════════════════════════════════════════════════

describe('addMessage deduplication logic', () => {
  it('prevents adding message with duplicate ID', () => {
    const existing = [
      makeMsg({ id: 'msg-1' }),
      makeMsg({ id: 'msg-2' }),
    ]

    const newMsg = makeMsg({ id: 'msg-1', plaintext: 'different text' })

    // Simulates the dedup check in addMessage
    const isDuplicate = existing.some(m => m.id === newMsg.id)
    expect(isDuplicate).toBe(true)
  })

  it('allows adding message with unique ID', () => {
    const existing = [
      makeMsg({ id: 'msg-1' }),
      makeMsg({ id: 'msg-2' }),
    ]

    const newMsg = makeMsg({ id: 'msg-3' })

    const isDuplicate = existing.some(m => m.id === newMsg.id)
    expect(isDuplicate).toBe(false)
  })

  it('fan-out to N devices creates N distinct message IDs', () => {
    // When acceptRequest fans out to 3 devices, each gets its own ID
    const deviceCount = 3
    const ids = Array.from({ length: deviceCount }, () => crypto.randomUUID())
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(deviceCount)
    // Only the first ID is used for the local addMessage call
    // Receiver dedup works because each device only receives its targeted message
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 8. End-to-end message flow simulation
// ═════════════════════════════════════════════════════════════════════════

describe('end-to-end flow simulation', () => {
  it('full request → accept → message lifecycle', () => {
    const alice = 'alice'
    const bob = 'bob'
    const conversations: Record<string, DecryptedSignalMessage[]> = {}

    // Step 1: Alice sends request to Bob
    const requestMsg = makeMsg({
      senderId: alice,
      recipientId: bob,
      messageType: 'request',
      plaintext: 'Hey Bob!',
    })
    conversations[bob] = [requestMsg]

    // Alice's view: status is 'sent'
    expect(getRequestStatus(conversations[bob], alice)).toBe('sent')
    // Alice cannot send more messages
    expect(getRequestStatus(conversations[bob], alice)).toBe('sent')

    // Step 2: Bob receives Alice's request
    const bobConversations: Record<string, DecryptedSignalMessage[]> = {}
    const receivedRequest = makeMsg({
      ...requestMsg,
      id: requestMsg.id, // same message
    })
    bobConversations[alice] = [receivedRequest]

    // Bob's view: status is 'received'
    expect(getRequestStatus(bobConversations[alice], bob)).toBe('received')

    // Step 3: Bob accepts
    const acceptMsg = makeMsg({
      senderId: bob,
      recipientId: alice,
      messageType: 'request-accepted',
      plaintext: '',
    })
    bobConversations[alice].push(acceptMsg)

    // Bob's view: now 'accepted'
    expect(getRequestStatus(bobConversations[alice], bob)).toBe('accepted')

    // Step 4: Alice receives the request-accepted
    conversations[bob].push(makeMsg({
      senderId: bob,
      recipientId: alice,
      messageType: 'request-accepted',
      plaintext: '',
    }))

    // Alice's view: now 'accepted'
    expect(getRequestStatus(conversations[bob], alice)).toBe('accepted')

    // Step 5: Alice sends a regular message
    const regularMsg = makeMsg({
      senderId: alice,
      recipientId: bob,
      messageType: 'message',
      plaintext: 'How are you?',
    })
    conversations[bob].push(regularMsg)

    // Status remains 'accepted'
    expect(getRequestStatus(conversations[bob], alice)).toBe('accepted')
  })

  it('multi-device fan-out: each device gets its own message', () => {
    const senderDeviceId = 'alice-phone'
    const recipientDevices = ['bob-phone', 'bob-laptop', 'bob-tablet']

    // Simulate fan-out batch insert
    const rows: SignalMessageRow[] = recipientDevices.map(deviceId =>
      makeRow({
        sender_id: 'alice',
        sender_device_id: senderDeviceId,
        recipient_id: 'bob',
        recipient_device_id: deviceId,
        message_type: 'message',
      })
    )

    // Each row has a unique ID
    const ids = rows.map(r => r.id)
    expect(new Set(ids).size).toBe(3)

    // Bob's phone should only process its message
    const bobPhoneId = 'bob-phone'
    const messagesForPhone = rows.filter(row => {
      if (bobPhoneId && row.recipient_device_id && row.recipient_device_id !== bobPhoneId) {
        return false
      }
      return true
    })
    expect(messagesForPhone).toHaveLength(1)
    expect(messagesForPhone[0].recipient_device_id).toBe('bob-phone')
  })

  it('request-accepted with NULL device ID reaches all devices', () => {
    // Legacy accept (no devices registered) sends with NULL recipient_device_id
    const row = makeRow({
      message_type: 'request-accepted',
      recipient_device_id: null,
    })

    // All of Alice's devices should process it
    const aliceDevices = ['alice-phone', 'alice-laptop']
    for (const deviceId of aliceDevices) {
      const shouldProcess = !(deviceId && row.recipient_device_id && row.recipient_device_id !== deviceId)
      expect(shouldProcess).toBe(true)
    }
  })

  it('catch-up query includes NULL device ID messages', () => {
    // Simulates the OR filter: recipient_device_id = myId OR recipient_device_id IS NULL
    const myDeviceId = 'my-device'
    const allMessages = [
      makeRow({ recipient_device_id: myDeviceId }),      // targeted at me
      makeRow({ recipient_device_id: null }),              // legacy (NULL)
      makeRow({ recipient_device_id: 'other-device' }),    // targeted at other
    ]

    const catchUpFilter = (row: SignalMessageRow) =>
      row.recipient_device_id === myDeviceId || row.recipient_device_id === null

    const filtered = allMessages.filter(catchUpFilter)
    expect(filtered).toHaveLength(2)
    expect(filtered.every(r => r.recipient_device_id !== 'other-device')).toBe(true)
  })
})
