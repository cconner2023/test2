/**
 * useMessages — Orchestration hook for Signal Protocol messaging UI.
 *
 * Wires up Supabase realtime subscriptions, decryption routing, send logic,
 * and sync — delegating ALL state to useMessagingStore.
 *
 * Multi-device: messages are fan-out encrypted to all recipient devices.
 * State lives in useMessagingStore. This hook is mounted once in MessagesContext.
 */

import { useCallback, useRef, useEffect } from 'react'
import { createLogger } from '../Utilities/Logger'
import { useAuth } from './useAuth'
import { usePageVisibility } from './usePageVisibility'
import { useSignalMessages } from './useSignalMessages'
import {
  fetchPeerBundle,
  fetchPeerBundleForDevice,
  sendMessage as sendSignalMessage,
  sendMessageFanOut,
  sendRawGroupMessage,
  fetchPeerDevices,
  fetchOwnDevices,
  fetchGroupConversation,
  markMessagesRead,
  hardDeleteByOriginId,
} from '../lib/signal/signalService'
import {
  fetchMyGroups as fetchMyGroupsRpc,
  createGroup as createGroupRpc,
  leaveGroup as leaveGroupRpc,
  renameGroup as renameGroupRpc,
  addGroupMember as addGroupMemberRpc,
  removeGroupMember as removeGroupMemberRpc,
  fetchGroupMembers as fetchGroupMembersRpc,
} from '../lib/signal/groupService'
import type { GroupInfo, GroupMember } from '../lib/signal/groupTypes'
import {
  createOutboundSession,
  encryptMessage,
  hasSession,
  deleteSessionsForPeer,
} from '../lib/signal/session'
import {
  getLocalDeviceId,
} from '../lib/signal/keyManager'
import {
  generateSenderKey,
  createDistribution,
  processSenderKeyDistribution,
  senderKeyEncrypt,
  senderKeyDecrypt,
} from '../lib/signal/senderKey'
import {
  loadSenderKey,
  deleteSenderKeysForGroup,
} from '../lib/signal/senderKeyStore'
import type { SenderKeyMessage, SenderKeyDistribution } from '../lib/signal/types'
import {
  saveMessage,
  updateReadAt,
  updateMessageText,
  updateMessageStatus as updateMessageStatusInDb,
  deleteMessages as deleteMessagesFromDb,
  deleteMessagesByOriginId as deleteMessagesByOriginIdFromDb,
} from '../lib/signal/messageStore'
import {
  serializeContent,
} from '../lib/signal/messageContent'
import type { MessageContent, ImageContent, VoiceContent, ReplyTo } from '../lib/signal/messageContent'
import { useCalendarStore } from '../stores/useCalendarStore'
import { isCalendarEvent, routeCalendarEvent } from '../lib/calendarRouting'
import { uploadEncryptedAttachment } from '../lib/signal/attachmentService'
import { createBackup, markHydrationComplete, scheduleBackup } from '../lib/signal/backupService'
import { ok as okResult, err as errResult, type Result } from '../lib/result'
import { errorBus } from '../lib/errorBus'
import { ErrorCode } from '../lib/errorCodes'
import { resizeImage, getImageDimensions, generateThumbnail, dataUrlToBlob } from '../Utilities/imageUtils'
import type { VoiceRecordingResult } from '../Utilities/voiceUtils'
import type { DecryptedSignalMessage, PeerDevice, FanOutMessageInput, SyncMessagePayload } from '../lib/signal/transportTypes'
import type { PublicKeyBundle } from '../lib/signal/types'
import type { PeerBundleRpcResult } from '../lib/signal/transportTypes'
import { useMessagingStore } from '../stores/useMessagingStore'

const logger = createLogger('Messages')

export type RequestStatus = 'none' | 'sent' | 'received' | 'accepted'

/** Scan a message array to determine the request status with a peer. */
export function getRequestStatus(
  msgs: DecryptedSignalMessage[] | undefined,
  userId: string
): RequestStatus {
  if (!msgs || msgs.length === 0) return 'none'
  // Explicit accept always wins
  for (const m of msgs) {
    if (m.messageType === 'request-accepted') return 'accepted'
  }
  // Check for request direction
  let weSentRequest = false
  let peerSentRequest = false
  for (const m of msgs) {
    if (m.messageType === 'request' && m.senderId === userId) weSentRequest = true
    if (m.messageType === 'request' && m.senderId !== userId) peerSentRequest = true
  }
  // Implicit acceptance: peer replied with a regular message after our request
  if (weSentRequest) {
    for (const m of msgs) {
      if (m.senderId !== userId && m.messageType === 'message') return 'accepted'
    }
    return 'sent'
  }
  if (peerSentRequest) return 'received'
  return 'none'
}

/** Convert the RPC result shape to the PublicKeyBundle shape that session.ts expects. */
function rpcResultToBundle(rpc: PeerBundleRpcResult): PublicKeyBundle {
  return {
    userId: rpc.userId,
    deviceId: rpc.deviceId,
    identitySigningKey: rpc.identitySigningKey,
    identityDhKey: rpc.identityDhKey,
    signedPreKey: {
      keyId: rpc.signedPreKeyId,
      publicKey: rpc.signedPreKey,
      signature: rpc.signedPreKeySig,
    },
    oneTimePreKeys: rpc.oneTimePreKey ? [rpc.oneTimePreKey] : [],
  }
}

/**
 * Encrypt a serialized payload for all of a peer's devices.
 * For each device: if no session exists, performs X3DH first.
 * Returns FanOutMessageInput[] ready for sendMessageFanOut.
 */
async function encryptForAllDevices(
  peerId: string,
  peerDevices: PeerDevice[],
  serialized: string,
  senderUuid: string
): Promise<FanOutMessageInput[]> {
  const results: FanOutMessageInput[] = []

  for (const device of peerDevices) {
    try {
      const sessionExists = await hasSession(peerId, device.deviceId)

      if (!sessionExists) {
        const bundleResult = await fetchPeerBundleForDevice(peerId, device.deviceId)
        if (!bundleResult.ok) {
          logger.warn(`No bundle for ${peerId}:${device.deviceId}, skipping`)
          continue
        }

        const bundle = rpcResultToBundle(bundleResult.data)
        const sealedEnvelope = await createOutboundSession(peerId, device.deviceId, bundle, serialized, senderUuid)
        results.push({
          recipientDeviceId: device.deviceId,
          payload: sealedEnvelope as unknown as Record<string, unknown>,
          messageType: 'initial',
        })
      } else {
        const sealedEnvelope = await encryptMessage(peerId, device.deviceId, serialized, senderUuid)
        results.push({
          recipientDeviceId: device.deviceId,
          payload: sealedEnvelope as unknown as Record<string, unknown>,
          messageType: 'message',
        })
      }
    } catch (e) {
      logger.warn(`Failed to encrypt for ${peerId}:${device.deviceId}:`, e instanceof Error ? e.message : e)
    }
  }

  return results
}

/**
 * Send a sync message to all own devices (except the current one).
 * Fire-and-forget — errors are silently swallowed.
 */
async function sendSyncToOwnDevices(
  userId: string,
  localDeviceId: string,
  syncPayload: SyncMessagePayload,
  forGroupId?: string,
  originId?: string
): Promise<void> {
  if (forGroupId) syncPayload.forGroupId = forGroupId
  if (originId) syncPayload.originId = originId
  const devicesResult = await fetchOwnDevices(userId)
  if (!devicesResult.ok) return

  const otherDevices = devicesResult.data.filter(d => d.deviceId !== localDeviceId)
  if (otherDevices.length === 0) return

  const serialized = JSON.stringify(syncPayload)
  const fanOutInputs = await encryptForAllDevices(userId, otherDevices, serialized, userId)

  for (const input of fanOutInputs) {
    input.messageType = 'sync'
  }

  if (fanOutInputs.length === 0) return

  await sendMessageFanOut(userId, localDeviceId, userId, fanOutInputs, undefined, originId)
}

/**
 * Send a read-sync message to all own devices (except the current one).
 */
async function sendReadSyncToOwnDevices(
  userId: string,
  localDeviceId: string,
  serializedPayload: string,
): Promise<void> {
  const devicesResult = await fetchOwnDevices(userId)
  if (!devicesResult.ok) return

  const otherDevices = devicesResult.data.filter(d => d.deviceId !== localDeviceId)
  if (otherDevices.length === 0) return

  const fanOutInputs = await encryptForAllDevices(userId, otherDevices, serializedPayload, userId)
  for (const input of fanOutInputs) input.messageType = 'sync'
  if (fanOutInputs.length === 0) return

  await sendMessageFanOut(userId, localDeviceId, userId, fanOutInputs)
}

/**
 * Encrypt serialized content and send to a single peer's devices.
 */
async function encryptAndSendToPeer(
  userId: string,
  localDeviceId: string,
  peerId: string,
  serialized: string,
  messageType: 'message' | 'request',
  groupId?: string,
  originId?: string,
): Promise<Result<string>> {
  const devicesResult = await fetchPeerDevices(peerId)
  const peerDevices = devicesResult.ok ? devicesResult.data : []

  if (peerDevices.length > 0) {
    const fanOutInputs = await encryptForAllDevices(peerId, peerDevices, serialized, userId)
    if (messageType === 'request') {
      for (const input of fanOutInputs) input.messageType = 'request'
    }
    if (fanOutInputs.length === 0) return errResult('Could not encrypt for any peer device')

    const sendResult = await sendMessageFanOut(userId, localDeviceId, peerId, fanOutInputs, groupId, originId)
    if (!sendResult.ok) return errResult(sendResult.error)
    return okResult(sendResult.data[0])
  }

  // Legacy single-device path
  const sessionExists = await hasSession(peerId, 'unknown')

  if (!sessionExists) {
    const bundleResult = await fetchPeerBundle(peerId)
    if (!bundleResult.ok) return errResult(bundleResult.error)
    const bundle = rpcResultToBundle(bundleResult.data)
    const peerDeviceId = bundle.deviceId || 'unknown'
    const initialMessage = await createOutboundSession(peerId, peerDeviceId, bundle, serialized, userId)
    const legacyType = messageType === 'request' ? 'request' : 'initial'
    return sendSignalMessage(userId, peerId, initialMessage, legacyType, localDeviceId, peerDeviceId, groupId, originId)
  }

  const encrypted = await encryptMessage(peerId, 'unknown', serialized, userId)
  return sendSignalMessage(userId, peerId, encrypted, 'message', localDeviceId, undefined, groupId, originId)
}

/**
 * Ensure we have a sender key for the group, generating and distributing one if needed.
 *
 * Distribution is sent via pairwise 1:1 sessions to every group member who does not
 * yet have our key. Returns the sender key state ready for encryption.
 */
async function ensureSenderKey(
  userId: string,
  localDeviceId: string,
  groupId: string,
  members: GroupMember[],
): Promise<void> {
  let senderKey = await loadSenderKey(groupId, userId, localDeviceId)

  if (!senderKey) {
    senderKey = await generateSenderKey(groupId, userId, localDeviceId)
    logger.info(`Generated new sender key for group ${groupId}`)
  }

  const dist = createDistribution(senderKey)
  const distJson = JSON.stringify(dist)

  // Distribute to all group members (excluding current device)
  const otherMembers = members.filter(m => m.userId !== userId)
  for (const member of otherMembers) {
    const devicesResult = await fetchPeerDevices(member.userId)
    if (!devicesResult.ok) continue

    const fanOutInputs = await encryptForAllDevices(member.userId, devicesResult.data, distJson, userId)
    for (const input of fanOutInputs) {
      input.messageType = 'sender-key-distribution'
    }
    if (fanOutInputs.length > 0) {
      await sendMessageFanOut(userId, localDeviceId, member.userId, fanOutInputs, groupId, undefined, true).catch(e =>
        logger.warn(`Failed to distribute sender key to ${member.userId}:`, e instanceof Error ? e.message : e)
      )
    }
  }

  // Distribute to own other devices so they can decrypt our future group messages
  const ownDevicesResult = await fetchOwnDevices(userId)
  if (ownDevicesResult.ok) {
    const otherOwnDevices = ownDevicesResult.data.filter(d => d.deviceId !== localDeviceId)
    if (otherOwnDevices.length > 0) {
      const fanOutInputs = await encryptForAllDevices(userId, otherOwnDevices, distJson, userId)
      for (const input of fanOutInputs) input.messageType = 'sender-key-distribution'
      if (fanOutInputs.length > 0) {
        await sendMessageFanOut(userId, localDeviceId, userId, fanOutInputs, groupId, undefined, true).catch(e =>
          logger.warn('Failed to distribute sender key to own devices:', e instanceof Error ? e.message : e)
        )
      }
    }
  }
}

/**
 * Encrypt content with sender key and deliver to all group members.
 *
 * New flow (Sender Keys):
 * 1. Load/generate sender key for (groupId, userId, localDeviceId)
 * 2. If missing: generate + distribute via pairwise 1:1 sessions
 * 3. Encrypt once with senderKeyEncrypt — O(1) encryption
 * 4. Fan-out the single ciphertext to every member as 'sender-key-message'
 */
async function encryptAndSendToGroupMembers(
  userId: string,
  localDeviceId: string,
  groupId: string,
  serialized: string,
  originId: string,
  members: GroupMember[],
  silent?: boolean,
): Promise<Result<string>> {
  // Ensure sender key exists and all members have a copy
  await ensureSenderKey(userId, localDeviceId, groupId, members)

  // Encrypt once with sender key
  const senderKeyMsg = await senderKeyEncrypt(groupId, userId, localDeviceId, serialized)
  const payload = senderKeyMsg as unknown as Record<string, unknown>

  // Fan out the same ciphertext to all group members (including ourselves for sync)
  let firstServerId: string | null = null
  const allRecipients = members.filter(m => m.userId !== userId)

  for (const member of allRecipients) {
    const result = await sendRawGroupMessage(
      userId, member.userId, payload,
      'sender-key-message', localDeviceId, groupId, originId, silent,
    ).catch(e => {
      logger.warn(`Failed to send sender-key-message to ${member.userId}:`, e instanceof Error ? e.message : e)
      return errResult<string>(e instanceof Error ? e.message : 'send failed')
    })
    if (result.ok && !firstServerId) {
      firstServerId = result.data
    }
  }

  // Own devices receive group content via sendSyncToOwnDevices (called by each caller).
  // Sender key distribution to own devices is handled by ensureSenderKey above.

  if (!firstServerId) {
    // No other members — still a successful send if we encrypted without error
    firstServerId = crypto.randomUUID()
  }

  return okResult(firstServerId)
}

/**
 * Resize an image and generate a thumbnail for inline preview.
 */
async function resizeAndThumbnail(file: File): Promise<{
  resizedDataUrl: string
  width: number
  height: number
  thumbnail: string
}> {
  const resizedDataUrl = await resizeImage(file, 800, 0.7)
  const { width, height } = await getImageDimensions(resizedDataUrl)
  const thumbnail = await generateThumbnail(resizedDataUrl, 60, 0.5)
  return { resizedDataUrl, width, height, thumbnail }
}

export interface UseMessagesReturn {
  /** Send a plaintext message to a peer. Handles session creation if needed. Optional threadId for thread replies. */
  sendMessage: (peerId: string, text: string, threadId?: string) => Promise<boolean>
  /** Send an image to a peer. Compresses, encrypts, uploads, and sends via Signal. */
  sendImage: (peerId: string, file: File) => Promise<boolean>
  /** Send a voice note to a peer. Encrypts, uploads, and sends via Signal. */
  sendVoice: (peerId: string, recording: VoiceRecordingResult) => Promise<boolean>
  /** Accept a message request from a peer, opening the conversation. */
  acceptRequest: (peerId: string) => Promise<void>
  /** Get the request status for a given peer. */
  getRequestStatusForPeer: (peerId: string) => RequestStatus
  /** Load conversation history from Supabase for a peer. */
  fetchHistory: (peerId: string) => Promise<void>
  /** Mark all messages from a peer as read. */
  markAsRead: (peerId: string) => void
  /** Edit a message's plaintext (local-only). */
  editMessage: (peerId: string, messageId: string, newText: string) => void
  /** Delete messages (state + IndexedDB + protocol-level delete to peer and own devices). */
  deleteMessages: (peerId: string, messageIds: string[]) => Promise<void>
  /** Delete an entire conversation (state + unread + IndexedDB + tombstone). */
  deleteConversation: (conversationKey: string) => Promise<void>
  /** Send a text message to a group (encrypts to each member's devices). */
  sendGroupMessage: (groupId: string, text: string, threadId?: string) => Promise<boolean>
  /** Send an image to a group. */
  sendGroupImage: (groupId: string, file: File) => Promise<boolean>
  /** Send a voice note to a group. */
  sendGroupVoice: (groupId: string, recording: VoiceRecordingResult) => Promise<boolean>
  /** Create a new group. */
  createGroup: (name: string, memberIds: string[]) => Promise<string | null>
  /** Leave a group. */
  leaveGroup: (groupId: string) => Promise<void>
  /** Rename a group (admin only). */
  renameGroup: (groupId: string, name: string) => Promise<void>
  /** Add a member to a group (admin only). */
  addGroupMember: (groupId: string, userId: string) => Promise<void>
  /** Remove a member from a group (admin only). */
  removeGroupMember: (groupId: string, userId: string) => Promise<void>
  /** Fetch group members. */
  fetchGroupMembers: (groupId: string) => Promise<GroupMember[]>
  /** Fetch group message history from Supabase. */
  fetchGroupHistory: (groupId: string) => Promise<void>
  /** Refresh group list from server. */
  refreshGroups: () => Promise<void>
  /** Ref for external listeners to receive qualifying incoming messages. */
  onIncomingRef: React.MutableRefObject<((msg: DecryptedSignalMessage) => void) | null>
  /** Ref tracking the currently-open conversation key (peerId or groupId). */
  activePeerRef: React.MutableRefObject<string | null>
}

// Stable module-level reference to Zustand getState — never changes, safe to omit from deps.
const store = useMessagingStore.getState

export function useMessages(): UseMessagesReturn {
  const { user, isAuthenticated, clinicId } = useAuth()
  const userId = user?.id ?? null
  const isPageVisible = usePageVisibility()

  // Register clinic as a system group so its messages are excluded from unread totals
  useEffect(() => {
    if (clinicId) {
      useMessagingStore.getState().setSystemGroupIds(new Set([clinicId]))
    }
  }, [clinicId])

  // Track which peer's chat is currently open (for auto-mark-read)
  const activePeerRef = useRef<string | null>(null)

  // External listener ref — MessagesContext sets this to fire notifications
  const onIncomingRef = useRef<((msg: DecryptedSignalMessage) => void) | null>(null)

  // Load local device ID — retry until available
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const load = async () => {
      const id = await getLocalDeviceId()
      if (cancelled) return
      if (id) {
        useMessagingStore.getState().setLocalDeviceId(id)
      } else {
        timer = setTimeout(load, 300)
      }
    }

    load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [isAuthenticated])

  /** Add a message — delegates to store (which has the tombstone guard). */
  const addMessage = useCallback((msg: DecryptedSignalMessage) => {
    store().addMessage(msg)

    // Skip IDB persist for optimistic messages — persist on confirmation
    if (msg.status === 'sending') return

    if (userId) {
      saveMessage(msg, userId).catch(e =>
        errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.addMessage', message: 'Failed to save message locally', timestamp: Date.now(), metadata: { error: e } })
      )
    }
  }, [userId])

  /** Handle incoming message — delivery receipts, read-syncs, calendar routing, then addMessage. */
  const handleIncomingMessage = useCallback(async (msg: DecryptedSignalMessage) => {
    // Delivery receipt
    if (msg._deliveryReceipt) {
      const { messageIds } = msg._deliveryReceipt
      store().applyDeliveryReceipt(messageIds)
      updateMessageStatusInDb(messageIds, 'delivered').catch(() => {})
      markMessagesRead([msg.id]).catch(() => {})
      return
    }

    // Read-sync from another own device
    if (msg._readSync) {
      const { peerId, messageIds, readAt } = msg._readSync
      updateReadAt(messageIds, readAt).catch(e =>
        errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.handleIncomingMessage', message: 'Failed to apply remote read sync to IDB', timestamp: Date.now(), metadata: { error: e } })
      )
      store().applyReadSync(peerId, messageIds, readAt)
      markMessagesRead([msg.id]).catch(() => {})
      return
    }

    // Conversation-deleted sync from another own device
    if (msg.messageType === 'sync') {
      try {
        const parsed = JSON.parse(msg.plaintext) as Record<string, unknown>
        if (parsed.__syncType === 'conversation-deleted') {
          const conversationKey = parsed.conversationKey as string
          const { groups } = store()
          const isGroup = !!groups[conversationKey]
          await store().deleteConversation(conversationKey)
          if (isGroup) {
            deleteSenderKeysForGroup(conversationKey).catch(() => {})
          } else {
            deleteSessionsForPeer(conversationKey).catch(() => {})
          }
          markMessagesRead([msg.id]).catch(() => {})
          return
        }
      } catch { /* not JSON or not conversation-deleted sync — fall through */ }
    }

    // Calendar events are routed to the calendar store, not the messaging UI.
    // Mark as read (server-side already handled by useSignalMessages) and bail.
    if (isCalendarEvent(msg.content)) {
      routeCalendarEvent(msg.content)
      return
    }

    if (msg.senderId === userId && msg.recipientId === userId && !msg.readAt) {
      msg.readAt = new Date().toISOString()
      markMessagesRead([msg.id]).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.handleIncomingMessage', message: 'Failed to mark self-note as read', timestamp: Date.now(), metadata: { error: e } })
      )
    }

    // If the conversation is currently open, mark the message as read before storing
    if (
      msg.senderId !== userId &&
      !msg.readAt &&
      activePeerRef.current === (msg.groupId ?? msg.senderId)
    ) {
      const readAtTs = new Date().toISOString()
      msg.readAt = readAtTs
      markMessagesRead([msg.id]).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.handleIncomingMessage', message: 'Failed to mark message as read on server', timestamp: Date.now(), metadata: { error: e } })
      )
      updateReadAt([msg.id], readAtTs).catch(e =>
        errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.handleIncomingMessage', message: 'Failed to mark message as read in IDB', timestamp: Date.now(), metadata: { error: e } })
      )
    }

    addMessage(msg)

    // Fire external listener for qualifying incoming messages (notifications)
    if (
      msg.senderId !== userId &&
      msg.messageType !== 'request-accepted' &&
      msg.messageType !== 'sync'
    ) {
      onIncomingRef.current?.(msg)
    }
  }, [userId, addMessage])

  /** Remove messages by origin IDs from all conversations. */
  const removeMessagesByOriginIds = useCallback((originIds: string[]) => {
    store().removeMessagesByOriginIds(originIds)

    // Remove any calendar events whose originId matches a deleted message.
    const originSet = new Set(originIds)
    const calendarStore = useCalendarStore.getState()
    for (const event of calendarStore.events) {
      if (event.originId && originSet.has(event.originId)) {
        calendarStore.removeEvent(event.id)
      }
    }
  }, [])

  // Subscribe to realtime incoming messages
  useSignalMessages({
    userId,
    localDeviceId: useMessagingStore.getState().localDeviceId,
    isAuthenticated: isAuthenticated && !!useMessagingStore.getState().localDeviceId,
    isPageVisible,
    onMessage: handleIncomingMessage,
    onDelete: removeMessagesByOriginIds,
  })

  // Hydrate from IDB on mount and re-hydrate after backup restore
  useEffect(() => {
    if (!userId) return

    let cancelled = false

    async function hydrate() {
      await useMessagingStore.getState().hydrateFromIdb(userId!)
      if (!cancelled) markHydrationComplete()
    }

    hydrate().catch(err => logger.warn('IDB hydration failed:', err))

    const onBackupRestored = () => {
      hydrate().catch(err => logger.warn('Post-backup IDB hydration failed:', err))
    }
    window.addEventListener('backup-restored', onBackupRestored)

    return () => {
      cancelled = true
      window.removeEventListener('backup-restored', onBackupRestored)
    }
  }, [userId])

  // Hydrate groups from Supabase on mount
  const refreshGroups = useCallback(async () => {
    const result = await fetchMyGroupsRpc()
    if (!result.ok) {
      logger.warn('Failed to fetch groups:', result.error)
      return
    }
    const map: Record<string, GroupInfo> = {}
    for (const g of result.data) {
      map[g.groupId] = g
    }
    useMessagingStore.getState().setGroups(map)
  }, [])

  useEffect(() => {
    if (!userId) return
    refreshGroups().catch(e => logger.warn('Group hydration failed:', e))
  }, [userId, refreshGroups])

  /** Build replyTo metadata from a threadId by looking up the root message. */
  const buildReplyTo = useCallback((peerId: string, threadId: string): ReplyTo | undefined => {
    const msgs = useMessagingStore.getState().conversations[peerId]
    const root = msgs?.find(m => m.originId === threadId) ?? msgs?.find(m => m.id === threadId)
    if (!root) return undefined
    const preview = (root.plaintext || 'Photo').slice(0, 50)
    return { messageId: root.originId ?? root.id, preview }
  }, [])

  /** Update an optimistic message's ID and status after server confirms, then persist. */
  const updateMessageStatus = useCallback((
    peerId: string,
    localId: string,
    serverId: string,
  ) => {
    store().updateMessageStatus(peerId, localId, serverId)

    // Persist confirmed message to IDB
    if (userId) {
      const msgs = useMessagingStore.getState().conversations[peerId]
      const confirmed = msgs?.find(m => m.id === serverId)
      if (confirmed) {
        saveMessage(confirmed, userId).catch(e =>
          errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.updateMessageStatus', message: 'Failed to persist confirmed message', timestamp: Date.now(), metadata: { error: e } })
        )
      }
    }
  }, [userId])

  /** Remove an optimistic message from state (on send failure). */
  const removeOptimisticMessage = useCallback((peerId: string, localId: string) => {
    store().removeOptimisticMessage(peerId, localId)
  }, [])

  /** Send a plaintext message to a peer. */
  const sendMessage = useCallback(async (peerId: string, text: string, threadId?: string): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) {
      logger.error('sendMessage blocked: userId=', userId, 'localDeviceId=', localDeviceId)
      return false
    }

    const replyTo = threadId ? buildReplyTo(peerId, threadId) : undefined

    // Self-notes: encrypt to own devices
    if (peerId === userId) {
      const localId = crypto.randomUUID()
      const originId = crypto.randomUUID()
      const now = new Date().toISOString()
      addMessage({
        id: localId,
        senderId: userId,
        recipientId: userId,
        plaintext: text,
        content: { type: 'text', text, ...(replyTo && { replyTo }) },
        messageType: 'message',
        createdAt: now,
        readAt: now,
        status: 'sending',
        originId,
        ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
      })

      const serialized = serializeContent({ type: 'text', text, ...(replyTo && { replyTo }) })

      try {
        const devicesResult = await fetchOwnDevices(userId)
        const otherDevices = devicesResult.ok
          ? devicesResult.data.filter(d => d.deviceId !== localDeviceId)
          : []

        if (otherDevices.length > 0) {
          const fanOutInputs = await encryptForAllDevices(userId, otherDevices, serialized, userId)
          if (fanOutInputs.length > 0) {
            const sendResult = await sendMessageFanOut(userId, localDeviceId, userId, fanOutInputs, undefined, originId)
            if (!sendResult.ok) {
              logger.error('Self-note fan-out failed:', sendResult.error)
            }
          }
        }

        const confirmedId = crypto.randomUUID()
        updateMessageStatus(userId, localId, confirmedId)

        saveMessage({
          id: confirmedId,
          senderId: userId,
          recipientId: userId,
          plaintext: text,
          content: { type: 'text', text, ...(replyTo && { replyTo }) },
          messageType: 'message',
          createdAt: now,
          readAt: now,
          originId,
          ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
        }, userId).catch(e =>
          errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.sendSelfNote', message: 'Failed to save self-note locally', timestamp: Date.now(), metadata: { error: e } })
        )

        return true
      } catch (e) {
        logger.error('Self-note error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(userId, localId)
        return false
      }
    }

    // Request gate
    const status = getRequestStatus(useMessagingStore.getState().conversations[peerId], userId)

    if (status === 'sent') return false

    if (status === 'none') {
      const localId = crypto.randomUUID()
      const originId = crypto.randomUUID()
      addMessage({
        id: localId,
        senderId: userId,
        recipientId: peerId,
        plaintext: text,
        messageType: 'request',
        createdAt: new Date().toISOString(),
        readAt: null,
        status: 'sending',
        originId,
        ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
      })

      store().setSending(peerId, true)
      try {
        const serialized = serializeContent({ type: 'text', text, ...(replyTo && { replyTo }) })
        const result = await encryptAndSendToPeer(userId, localDeviceId, peerId, serialized, 'request', undefined, originId)
        if (!result.ok) {
          logger.error('Failed to send request:', result.error)
          removeOptimisticMessage(peerId, localId)
          return false
        }

        updateMessageStatus(peerId, localId, result.data)
        sendSyncToOwnDevices(userId, localDeviceId, {
          forPeerId: peerId, serialized, originalMessageType: 'request',
          originalTimestamp: new Date().toISOString(), originalMessageId: result.data,
        }, undefined, originId).catch(e =>
          errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendRequest', message: 'Failed to sync request to own devices', timestamp: Date.now(), metadata: { error: e } })
        )
        return true
      } catch (e) {
        logger.error('sendMessage (request) error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(peerId, localId)
        return false
      } finally {
        store().setSending(peerId, false)
      }
    }

    // status === 'received' or 'accepted'
    const localId = crypto.randomUUID()
    const originId = crypto.randomUUID()
    const textContent: MessageContent = { type: 'text', text, ...(replyTo && { replyTo }) }
    addMessage({
      id: localId,
      senderId: userId,
      recipientId: peerId,
      plaintext: text,
      content: textContent,
      messageType: 'message',
      createdAt: new Date().toISOString(),
      readAt: null,
      status: 'sending',
      originId,
      ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
    })

    store().setSending(peerId, true)
    try {
      const serialized = serializeContent(textContent)
      const result = await encryptAndSendToPeer(userId, localDeviceId, peerId, serialized, 'message', undefined, originId)
      if (!result.ok) {
        logger.error('Failed to send message:', result.error)
        removeOptimisticMessage(peerId, localId)
        return false
      }

      updateMessageStatus(peerId, localId, result.data)
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: peerId, serialized, originalMessageType: 'message',
        originalTimestamp: new Date().toISOString(), originalMessageId: result.data,
      }, undefined, originId).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendMessage', message: 'Failed to sync message to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
      return true
    } catch (e) {
      logger.error('sendMessage error:', e instanceof Error ? e.message : e)
      removeOptimisticMessage(peerId, localId)
      return false
    } finally {
      store().setSending(peerId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage, buildReplyTo])

  /** Send an image message to a peer. */
  const sendImage = useCallback(async (peerId: string, file: File): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false

    if (peerId === userId) {
      const localId = crypto.randomUUID()
      const originId = crypto.randomUUID()
      const now = new Date().toISOString()
      store().setSending(peerId, true)
      try {
        const { resizedDataUrl, width, height, thumbnail } = await resizeAndThumbnail(file)

        const placeholderContent: ImageContent = {
          type: 'image', mime: 'image/jpeg', key: '', path: '', width, height, thumbnail,
        }
        addMessage({
          id: localId,
          senderId: userId,
          recipientId: userId,
          plaintext: 'Photo',
          content: placeholderContent,
          messageType: 'message',
          createdAt: now,
          readAt: now,
          status: 'sending',
          originId,
        })

        const imageBlob = dataUrlToBlob(resizedDataUrl)
        const uploadResult = await uploadEncryptedAttachment(userId, imageBlob)
        if (!uploadResult.ok) {
          logger.error('Self-note image upload failed:', uploadResult.error)
          removeOptimisticMessage(userId, localId)
          return false
        }

        const { path, key } = uploadResult.data
        const imageContent: ImageContent = {
          type: 'image', mime: 'image/jpeg', key, path, width, height, thumbnail,
        }

        store().updateMessageContent(userId, localId, imageContent)

        const serialized = serializeContent(imageContent)
        const devicesResult = await fetchOwnDevices(userId)
        const otherDevices = devicesResult.ok
          ? devicesResult.data.filter(d => d.deviceId !== localDeviceId)
          : []

        if (otherDevices.length > 0) {
          const fanOutInputs = await encryptForAllDevices(userId, otherDevices, serialized, userId)
          if (fanOutInputs.length > 0) {
            const sendResult = await sendMessageFanOut(userId, localDeviceId, userId, fanOutInputs, undefined, originId)
            if (!sendResult.ok) {
              logger.error('Self-note image fan-out failed:', sendResult.error)
            }
          }
        }

        const confirmedId = crypto.randomUUID()
        updateMessageStatus(userId, localId, confirmedId)

        saveMessage({
          id: confirmedId,
          senderId: userId,
          recipientId: userId,
          plaintext: 'Photo',
          content: imageContent,
          messageType: 'message',
          createdAt: now,
          readAt: now,
          originId,
        }, userId).catch(e =>
          errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.sendSelfNoteImage', message: 'Failed to save self-note image locally', timestamp: Date.now(), metadata: { error: e } })
        )

        return true
      } catch (e) {
        logger.error('Self-note image error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(userId, localId)
        return false
      } finally {
        store().setSending(peerId, false)
      }
    }

    const status = getRequestStatus(useMessagingStore.getState().conversations[peerId], userId)
    if (status !== 'accepted' && status !== 'received') {
      logger.warn('Cannot send image: conversation not yet accepted')
      return false
    }

    let localId: string | null = null
    const originId = crypto.randomUUID()
    store().setSending(peerId, true)
    try {
      const { resizedDataUrl, width, height, thumbnail } = await resizeAndThumbnail(file)

      localId = crypto.randomUUID()
      const placeholderContent: ImageContent = {
        type: 'image', mime: 'image/jpeg', key: '', path: '', width, height, thumbnail,
      }
      addMessage({
        id: localId,
        senderId: userId,
        recipientId: peerId,
        plaintext: 'Photo',
        content: placeholderContent,
        messageType: 'message',
        createdAt: new Date().toISOString(),
        readAt: null,
        status: 'sending',
        originId,
      })

      const imageBlob = dataUrlToBlob(resizedDataUrl)
      const uploadResult = await uploadEncryptedAttachment(userId, imageBlob)
      if (!uploadResult.ok) {
        logger.error('Image upload failed:', uploadResult.error)
        removeOptimisticMessage(peerId, localId)
        return false
      }

      const { path, key } = uploadResult.data
      const imageContent: ImageContent = {
        type: 'image', mime: 'image/jpeg', key, path, width, height, thumbnail,
      }

      store().updateMessageContent(peerId, localId, imageContent)

      const serialized = serializeContent(imageContent)
      const result = await encryptAndSendToPeer(userId, localDeviceId, peerId, serialized, 'message', undefined, originId)
      if (!result.ok) {
        logger.error('Failed to send image:', result.error)
        removeOptimisticMessage(peerId, localId)
        return false
      }

      updateMessageStatus(peerId, localId, result.data)
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: peerId, serialized, originalMessageType: 'message',
        originalTimestamp: new Date().toISOString(), originalMessageId: result.data,
      }, undefined, originId).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendImage', message: 'Failed to sync image to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
      return true
    } catch (e) {
      logger.error('sendImage error:', e instanceof Error ? e.message : e)
      if (localId) removeOptimisticMessage(peerId, localId)
      return false
    } finally {
      store().setSending(peerId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage])

  const sendVoice = useCallback(async (peerId: string, recording: VoiceRecordingResult): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false

    if (peerId === userId) {
      const localId = crypto.randomUUID()
      const originId = crypto.randomUUID()
      const now = new Date().toISOString()
      store().setSending(peerId, true)
      try {
        const placeholderContent: VoiceContent = {
          type: 'voice', mime: recording.mime, key: '', path: '',
          duration: recording.duration, waveform: recording.waveform,
        }
        addMessage({
          id: localId, senderId: userId, recipientId: userId,
          plaintext: 'Voice message', content: placeholderContent,
          messageType: 'message', createdAt: now, readAt: now,
          status: 'sending', originId,
        })

        const uploadResult = await uploadEncryptedAttachment(userId, recording.blob)
        if (!uploadResult.ok) {
          logger.error('Self-note voice upload failed:', uploadResult.error)
          removeOptimisticMessage(userId, localId)
          return false
        }

        const { path, key } = uploadResult.data
        const voiceContent: VoiceContent = {
          type: 'voice', mime: recording.mime, key, path,
          duration: recording.duration, waveform: recording.waveform,
        }

        store().updateMessageContent(userId, localId, voiceContent)

        const serialized = serializeContent(voiceContent)
        const devicesResult = await fetchOwnDevices(userId)
        const otherDevices = devicesResult.ok
          ? devicesResult.data.filter(d => d.deviceId !== localDeviceId)
          : []

        if (otherDevices.length > 0) {
          const fanOutInputs = await encryptForAllDevices(userId, otherDevices, serialized, userId)
          if (fanOutInputs.length > 0) {
            const sendResult = await sendMessageFanOut(userId, localDeviceId, userId, fanOutInputs, undefined, originId)
            if (!sendResult.ok) {
              logger.error('Self-note voice fan-out failed:', sendResult.error)
            }
          }
        }

        const confirmedId = crypto.randomUUID()
        updateMessageStatus(userId, localId, confirmedId)

        saveMessage({
          id: confirmedId, senderId: userId, recipientId: userId,
          plaintext: 'Voice message', content: voiceContent,
          messageType: 'message', createdAt: now, readAt: now, originId,
        }, userId).catch(e =>
          errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.sendSelfNoteVoice', message: 'Failed to save self-note voice locally', timestamp: Date.now(), metadata: { error: e } })
        )

        return true
      } catch (e) {
        logger.error('Self-note voice error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(userId, localId)
        return false
      } finally {
        store().setSending(peerId, false)
      }
    }

    const status = getRequestStatus(useMessagingStore.getState().conversations[peerId], userId)
    if (status !== 'accepted' && status !== 'received') {
      logger.warn('Cannot send voice: conversation not yet accepted')
      return false
    }

    let localId: string | null = null
    const originId = crypto.randomUUID()
    store().setSending(peerId, true)
    try {
      localId = crypto.randomUUID()
      const placeholderContent: VoiceContent = {
        type: 'voice', mime: recording.mime, key: '', path: '',
        duration: recording.duration, waveform: recording.waveform,
      }
      addMessage({
        id: localId, senderId: userId, recipientId: peerId,
        plaintext: 'Voice message', content: placeholderContent,
        messageType: 'message', createdAt: new Date().toISOString(),
        readAt: null, status: 'sending', originId,
      })

      const uploadResult = await uploadEncryptedAttachment(userId, recording.blob)
      if (!uploadResult.ok) {
        logger.error('Voice upload failed:', uploadResult.error)
        removeOptimisticMessage(peerId, localId)
        return false
      }

      const { path, key } = uploadResult.data
      const voiceContent: VoiceContent = {
        type: 'voice', mime: recording.mime, key, path,
        duration: recording.duration, waveform: recording.waveform,
      }

      store().updateMessageContent(peerId, localId, voiceContent)

      const serialized = serializeContent(voiceContent)
      const result = await encryptAndSendToPeer(userId, localDeviceId, peerId, serialized, 'message', undefined, originId)
      if (!result.ok) {
        logger.error('Failed to send voice:', result.error)
        removeOptimisticMessage(peerId, localId)
        return false
      }

      updateMessageStatus(peerId, localId, result.data)
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: peerId, serialized, originalMessageType: 'message',
        originalTimestamp: new Date().toISOString(), originalMessageId: result.data,
      }, undefined, originId).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendVoice', message: 'Failed to sync voice to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
      return true
    } catch (e) {
      logger.error('sendVoice error:', e instanceof Error ? e.message : e)
      if (localId) removeOptimisticMessage(peerId, localId)
      return false
    } finally {
      store().setSending(peerId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage])

  /** Fetch conversation history — no-op, IDB + catch-up handle hydration. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchHistory = useCallback(async (_peerId: string) => {
    logger.debug('fetchHistory: no-op (IDB + catch-up handle hydration)')
  }, [])

  /** Mark messages from a peer as read. */
  const markAsRead = useCallback((peerId: string) => {
    activePeerRef.current = peerId

    const msgs = useMessagingStore.getState().conversations[peerId]
    if (!msgs) return

    const unreadIds = msgs
      .filter(m => m.senderId !== userId && !m.readAt)
      .map(m => m.id)

    // Clear local unread immediately
    store().markAsRead(peerId, unreadIds, new Date().toISOString())

    if (unreadIds.length > 0) {
      const readAtTs = new Date().toISOString()

      markMessagesRead(unreadIds).then(result => {
        if (!result.ok) logger.warn('markMessagesRead failed:', result.error)
      })

      updateReadAt(unreadIds, readAtTs).catch(e =>
        errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.markConversationRead', message: 'Failed to persist read status locally', timestamp: Date.now(), metadata: { error: e } })
      )

      const localDeviceId = useMessagingStore.getState().localDeviceId
      if (userId && localDeviceId) {
        const readSyncPayload = JSON.stringify({
          __syncType: 'read',
          peerId,
          messageIds: unreadIds,
          readAt: readAtTs,
        })
        sendReadSyncToOwnDevices(userId, localDeviceId, readSyncPayload).catch(() => {})
      }
    }
  }, [userId])

  // Guard against concurrent acceptRequest calls
  const acceptingRef = useRef<Set<string>>(new Set())

  /** Accept a message request from a peer. */
  const acceptRequest = useCallback(async (peerId: string): Promise<void> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return

    const status = getRequestStatus(useMessagingStore.getState().conversations[peerId], userId)
    if (status === 'accepted') {
      logger.info(`Request from ${peerId} already accepted, skipping`)
      return
    }
    if (acceptingRef.current.has(peerId)) {
      logger.info(`Accept already in-flight for ${peerId}, skipping`)
      return
    }
    acceptingRef.current.add(peerId)

    try {
      const serialized = serializeContent({ type: 'text', text: '' })
      const originId = crypto.randomUUID()
      const devicesResult = await fetchPeerDevices(peerId)
      const peerDevices = devicesResult.ok ? devicesResult.data : []

      let messageId: string

      if (peerDevices.length > 0) {
        const fanOutInputs = await encryptForAllDevices(peerId, peerDevices, serialized, userId)
        for (const input of fanOutInputs) {
          input.messageType = 'request-accepted'
        }

        if (fanOutInputs.length === 0) {
          logger.error('Could not encrypt request-accepted for any peer device')
          return
        }

        const sendResult = await sendMessageFanOut(userId, localDeviceId, peerId, fanOutInputs, undefined, originId)
        if (!sendResult.ok) {
          logger.error('Failed to send request-accepted fan-out:', sendResult.error)
          return
        }

        messageId = sendResult.data[0] ?? crypto.randomUUID()
      } else {
        const sessionExists = await hasSession(peerId, 'unknown')

        if (sessionExists) {
          const encrypted = await encryptMessage(peerId, 'unknown', serialized, userId)
          const sendResult = await sendSignalMessage(userId, peerId, encrypted, 'request-accepted', localDeviceId, undefined, undefined, originId)
          if (!sendResult.ok) {
            logger.error('Failed to send request-accepted:', sendResult.error)
            return
          }
          messageId = sendResult.data
        } else {
          const bundleResult = await fetchPeerBundle(peerId)
          if (!bundleResult.ok) {
            logger.error('Failed to fetch peer bundle for request-accepted:', bundleResult.error)
            return
          }
          const bundle = rpcResultToBundle(bundleResult.data)
          const peerDeviceId = bundle.deviceId || 'unknown'
          const sealedEnvelope = await createOutboundSession(peerId, peerDeviceId, bundle, serialized, userId)
          const sendResult = await sendSignalMessage(userId, peerId, sealedEnvelope, 'request-accepted', localDeviceId, peerDeviceId, undefined, originId)
          if (!sendResult.ok) {
            logger.error('Failed to send request-accepted:', sendResult.error)
            return
          }
          messageId = sendResult.data
        }
      }

      addMessage({
        id: messageId,
        senderId: userId,
        recipientId: peerId,
        plaintext: '',
        messageType: 'request-accepted',
        createdAt: new Date().toISOString(),
        readAt: null,
      })

      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: peerId, serialized, originalMessageType: 'request-accepted',
        originalTimestamp: new Date().toISOString(), originalMessageId: messageId,
      }).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.acceptRequest', message: 'Failed to sync accept to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
    } catch (e) {
      logger.error('acceptRequest error:', e instanceof Error ? e.message : e)
    } finally {
      acceptingRef.current.delete(peerId)
    }
  }, [userId, addMessage])

  /** Get request status for a specific peer. */
  const getRequestStatusForPeer = useCallback((peerId: string): RequestStatus => {
    return getRequestStatus(useMessagingStore.getState().conversations[peerId], userId ?? '')
  }, [userId])

  /** Edit a message's plaintext locally (state + IndexedDB). */
  const editMessage = useCallback((peerId: string, messageId: string, newText: string) => {
    // Update state
    const msgs = useMessagingStore.getState().conversations[peerId]
    if (msgs) {
      const updated = msgs.map(m => m.id === messageId ? { ...m, plaintext: newText } : m)
      useMessagingStore.setState(s => ({
        conversations: { ...s.conversations, [peerId]: updated },
      }))
    }

    updateMessageText(messageId, newText).catch(e =>
      errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.editMessage', message: 'Failed to persist message edit locally', timestamp: Date.now(), metadata: { error: e } })
    )
  }, [])

  /** Delete messages via protocol-level 'delete' messages. */
  const deleteMessages = useCallback(async (peerId: string, messageIds: string[]) => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return

    const msgs = useMessagingStore.getState().conversations[peerId] ?? []
    const originIds = messageIds
      .map(id => msgs.find(m => m.id === id)?.originId)
      .filter((oid): oid is string => !!oid)

    store().deleteMessages(peerId, messageIds)

    deleteMessagesFromDb(messageIds)
      .then(() => createBackup(userId))
      .catch(e => logger.warn('Failed to delete/re-sync:', e instanceof Error ? e.message : e))

    if (originIds.length === 0) return

    const deletePayload = JSON.stringify({ originIds })
    const deleteOriginId = crypto.randomUUID()

    try {
      const devicesResult = await fetchPeerDevices(peerId)
      if (devicesResult.ok && devicesResult.data.length > 0) {
        const fanOutInputs = await encryptForAllDevices(peerId, devicesResult.data, deletePayload, userId)
        for (const input of fanOutInputs) {
          input.messageType = 'delete'
        }
        if (fanOutInputs.length > 0) {
          await sendMessageFanOut(userId, localDeviceId, peerId, fanOutInputs, undefined, deleteOriginId).catch(e =>
            logger.warn('Failed to send delete to peer devices:', e instanceof Error ? e.message : e)
          )
        }
      }
    } catch (e) {
      logger.warn('Failed to send delete to peer:', e instanceof Error ? e.message : e)
    }

    try {
      const ownDevicesResult = await fetchOwnDevices(userId)
      if (ownDevicesResult.ok) {
        const otherDevices = ownDevicesResult.data.filter(d => d.deviceId !== localDeviceId)
        if (otherDevices.length > 0) {
          const syncInputs = await encryptForAllDevices(userId, otherDevices, deletePayload, userId)
          for (const input of syncInputs) {
            input.messageType = 'delete'
          }
          if (syncInputs.length > 0) {
            await sendMessageFanOut(userId, localDeviceId, userId, syncInputs, undefined, deleteOriginId).catch(e =>
              logger.warn('Failed to sync delete to own devices:', e instanceof Error ? e.message : e)
            )
          }
        }
      }
    } catch (e) {
      logger.warn('Failed to sync delete to own devices:', e instanceof Error ? e.message : e)
    }

    hardDeleteByOriginId(originIds).catch(e =>
      logger.warn('Failed to hard-delete from Supabase:', e instanceof Error ? e.message : e)
    )
  }, [userId])

  /** Delete an entire conversation from state, unread counts, IDB, Supabase, and write tombstone. */
  const deleteConversation = useCallback(async (conversationKey: string) => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    const { groups } = useMessagingStore.getState()
    const isGroup = !!groups[conversationKey]

    // Collect originIds BEFORE store().deleteConversation removes messages from state
    const msgs = useMessagingStore.getState().conversations[conversationKey] ?? []
    const originIds = msgs.map(m => m.originId).filter((oid): oid is string => !!oid)

    // Write tombstone to store + IDB, remove from state
    await store().deleteConversation(conversationKey)

    // Crypto cleanup
    if (isGroup) {
      // Group: delete sender keys only — pairwise sessions serve other groups + DMs
      deleteSenderKeysForGroup(conversationKey).catch(e =>
        logger.warn('Failed to delete sender keys for group:', e instanceof Error ? e.message : e)
      )
    } else {
      // 1:1: delete all pairwise sessions for this peer
      deleteSessionsForPeer(conversationKey).catch(e =>
        logger.warn('Failed to delete sessions for peer:', e instanceof Error ? e.message : e)
      )
    }

    // Hard-delete from Supabase
    if (originIds.length > 0) {
      hardDeleteByOriginId(originIds).catch(e =>
        logger.warn('Failed to hard-delete conversation from Supabase:', e instanceof Error ? e.message : e)
      )
    }

    // Multi-device sync — notify own devices to delete this conversation too
    if (userId && localDeviceId) {
      const deletedAt = new Date().toISOString()
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: conversationKey,
        serialized: JSON.stringify({ __syncType: 'conversation-deleted', conversationKey, deletedAt }),
        originalMessageType: 'sync',
        originalTimestamp: deletedAt,
        originalMessageId: crypto.randomUUID(),
      }).catch(() => {})
    }

    // Re-sync backup
    if (userId) {
      createBackup(userId).catch(e =>
        logger.warn('Failed to re-sync backup after conversation delete:', e instanceof Error ? e.message : e)
      )
    }
  }, [userId])

  // ── Group messaging ──────────────────────────────────────────────────────

  /** Send a text message to a group. */
  const sendGroupMessage = useCallback(async (groupId: string, text: string, threadId?: string): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false

    const replyTo = threadId ? buildReplyTo(groupId, threadId) : undefined

    const localId = crypto.randomUUID()
    const originId = crypto.randomUUID()
    const now = new Date().toISOString()
    const textContent: MessageContent = { type: 'text', text, ...(replyTo && { replyTo }) }

    addMessage({
      id: localId,
      senderId: userId,
      recipientId: groupId,
      plaintext: text,
      content: textContent,
      messageType: 'message',
      createdAt: now,
      readAt: now,
      status: 'sending',
      groupId,
      originId,
      ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
    })

    store().setSending(groupId, true)
    try {
      const serialized = serializeContent(textContent)

      const membersResult = await fetchGroupMembersRpc(groupId)
      if (!membersResult.ok) {
        logger.error('Failed to fetch group members:', membersResult.error)
        removeOptimisticMessage(groupId, localId)
        return false
      }

      const result = await encryptAndSendToGroupMembers(userId, localDeviceId, groupId, serialized, originId, membersResult.data)
      if (!result.ok) {
        removeOptimisticMessage(groupId, localId)
        return false
      }

      updateMessageStatus(groupId, localId, result.data)
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: groupId, serialized, originalMessageType: 'message',
        originalTimestamp: now, originalMessageId: result.data,
      }, groupId, originId).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendGroupMessage', message: 'Failed to sync group message to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
      return true
    } catch (e) {
      logger.error('sendGroupMessage error:', e instanceof Error ? e.message : e)
      removeOptimisticMessage(groupId, localId)
      return false
    } finally {
      store().setSending(groupId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage, buildReplyTo])

  /** Send an image to a group. */
  const sendGroupImage = useCallback(async (groupId: string, file: File): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false

    let localId: string | null = null
    const originId = crypto.randomUUID()
    store().setSending(groupId, true)
    try {
      const { resizedDataUrl, width, height, thumbnail } = await resizeAndThumbnail(file)

      localId = crypto.randomUUID()
      const placeholderContent: ImageContent = {
        type: 'image', mime: 'image/jpeg', key: '', path: '', width, height, thumbnail,
      }
      addMessage({
        id: localId,
        senderId: userId,
        recipientId: groupId,
        plaintext: 'Photo',
        content: placeholderContent,
        messageType: 'message',
        createdAt: new Date().toISOString(),
        readAt: new Date().toISOString(),
        status: 'sending',
        groupId,
        originId,
      })

      const imageBlob = dataUrlToBlob(resizedDataUrl)
      const uploadResult = await uploadEncryptedAttachment(userId, imageBlob)
      if (!uploadResult.ok) {
        logger.error('Group image upload failed:', uploadResult.error)
        removeOptimisticMessage(groupId, localId)
        return false
      }

      const { path, key } = uploadResult.data
      const imageContent: ImageContent = {
        type: 'image', mime: 'image/jpeg', key, path, width, height, thumbnail,
      }

      store().updateMessageContent(groupId, localId, imageContent)

      const serialized = serializeContent(imageContent)

      const membersResult = await fetchGroupMembersRpc(groupId)
      if (!membersResult.ok) {
        logger.error('Failed to fetch group members for image:', membersResult.error)
        removeOptimisticMessage(groupId, localId)
        return false
      }

      const result = await encryptAndSendToGroupMembers(userId, localDeviceId, groupId, serialized, originId, membersResult.data)
      if (!result.ok) {
        removeOptimisticMessage(groupId, localId)
        return false
      }

      updateMessageStatus(groupId, localId, result.data)
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: groupId, serialized, originalMessageType: 'message',
        originalTimestamp: new Date().toISOString(), originalMessageId: result.data,
      }, groupId, originId).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendGroupImage', message: 'Failed to sync group image to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
      return true
    } catch (e) {
      logger.error('sendGroupImage error:', e instanceof Error ? e.message : e)
      if (localId) removeOptimisticMessage(groupId, localId)
      return false
    } finally {
      store().setSending(groupId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage])

  const sendGroupVoice = useCallback(async (groupId: string, recording: VoiceRecordingResult): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false

    let localId: string | null = null
    const originId = crypto.randomUUID()
    store().setSending(groupId, true)
    try {
      localId = crypto.randomUUID()
      const placeholderContent: VoiceContent = {
        type: 'voice', mime: recording.mime, key: '', path: '',
        duration: recording.duration, waveform: recording.waveform,
      }
      addMessage({
        id: localId, senderId: userId, recipientId: groupId,
        plaintext: 'Voice message', content: placeholderContent,
        messageType: 'message', createdAt: new Date().toISOString(),
        readAt: new Date().toISOString(), status: 'sending',
        groupId, originId,
      })

      const uploadResult = await uploadEncryptedAttachment(userId, recording.blob)
      if (!uploadResult.ok) {
        logger.error('Group voice upload failed:', uploadResult.error)
        removeOptimisticMessage(groupId, localId)
        return false
      }

      const { path, key } = uploadResult.data
      const voiceContent: VoiceContent = {
        type: 'voice', mime: recording.mime, key, path,
        duration: recording.duration, waveform: recording.waveform,
      }

      store().updateMessageContent(groupId, localId, voiceContent)

      const serialized = serializeContent(voiceContent)

      const membersResult = await fetchGroupMembersRpc(groupId)
      if (!membersResult.ok) {
        logger.error('Failed to fetch group members for voice:', membersResult.error)
        removeOptimisticMessage(groupId, localId)
        return false
      }

      const result = await encryptAndSendToGroupMembers(userId, localDeviceId, groupId, serialized, originId, membersResult.data)
      if (!result.ok) {
        removeOptimisticMessage(groupId, localId)
        return false
      }

      updateMessageStatus(groupId, localId, result.data)
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: groupId, serialized, originalMessageType: 'message',
        originalTimestamp: new Date().toISOString(), originalMessageId: result.data,
      }, groupId, originId).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendGroupVoice', message: 'Failed to sync group voice to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
      return true
    } catch (e) {
      logger.error('sendGroupVoice error:', e instanceof Error ? e.message : e)
      if (localId) removeOptimisticMessage(groupId, localId)
      return false
    } finally {
      store().setSending(groupId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage])

  /** Create a new group. */
  const createGroup = useCallback(async (name: string, memberIds: string[]): Promise<string | null> => {
    const result = await createGroupRpc({ name, memberIds })
    if (!result.ok) {
      logger.error('createGroup failed:', result.error)
      return null
    }
    await refreshGroups()
    return result.data.groupId
  }, [refreshGroups])

  /** Leave a group. */
  const leaveGroupFn = useCallback(async (groupId: string): Promise<void> => {
    const result = await leaveGroupRpc(groupId)
    if (!result.ok) {
      logger.error('leaveGroup failed:', result.error)
      return
    }
    store().removeGroup(groupId)
  }, [])

  /** Rename a group. */
  const renameGroupFn = useCallback(async (groupId: string, name: string): Promise<void> => {
    const result = await renameGroupRpc(groupId, name)
    if (!result.ok) {
      logger.error('renameGroup failed:', result.error)
      return
    }
    const existing = useMessagingStore.getState().groups[groupId]
    if (existing) {
      store().addGroup({ ...existing, name })
    }
  }, [])

  /** Add a member to a group. */
  const addGroupMemberFn = useCallback(async (groupId: string, memberId: string): Promise<void> => {
    const result = await addGroupMemberRpc(groupId, memberId)
    if (!result.ok) {
      logger.error('addGroupMember failed:', result.error)
      return
    }
    await refreshGroups()
  }, [refreshGroups])

  /** Remove a member from a group. */
  const removeGroupMemberFn = useCallback(async (groupId: string, memberId: string): Promise<void> => {
    const result = await removeGroupMemberRpc(groupId, memberId)
    if (!result.ok) {
      logger.error('removeGroupMember failed:', result.error)
      return
    }
    await refreshGroups()
  }, [refreshGroups])

  /** Fetch group members. */
  const fetchGroupMembersFn = useCallback(async (groupId: string): Promise<GroupMember[]> => {
    const result = await fetchGroupMembersRpc(groupId)
    if (!result.ok) {
      logger.warn('fetchGroupMembers failed:', result.error)
      return []
    }
    return result.data
  }, [])

  /** Fetch group message history from Supabase. */
  const fetchGroupHistory = useCallback(async (groupId: string): Promise<void> => {
    if (!userId) return

    const result = await fetchGroupConversation(groupId)
    if (!result.ok) {
      logger.warn('fetchGroupHistory failed:', result.error)
      return
    }

    logger.info(`fetchGroupHistory: ${result.data.length} rows for group ${groupId}`)
  }, [userId])

  // Clear active peer when unmounting
  useEffect(() => {
    return () => { activePeerRef.current = null }
  }, [])

  return {
    sendMessage,
    sendImage,
    sendVoice,
    acceptRequest,
    getRequestStatusForPeer,
    fetchHistory,
    markAsRead,
    editMessage,
    deleteMessages,
    deleteConversation,
    sendGroupMessage,
    sendGroupImage,
    sendGroupVoice,
    createGroup,
    leaveGroup: leaveGroupFn,
    renameGroup: renameGroupFn,
    addGroupMember: addGroupMemberFn,
    removeGroupMember: removeGroupMemberFn,
    fetchGroupMembers: fetchGroupMembersFn,
    fetchGroupHistory,
    refreshGroups,
    onIncomingRef,
    activePeerRef,
  }
}
