/**
 * useMessages — Orchestration hook for Signal Protocol messaging UI.
 *
 * Combines useSignalMessages (realtime incoming) with signalService CRUD
 * and session encrypt/decrypt to provide a single API for the MessagesPanel.
 *
 * Multi-device: messages are fan-out encrypted to all recipient devices.
 * State lives in this hook (no Zustand store). Mounted once in MessagesPanel.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { createLogger } from '../Utilities/Logger'
import { useAuth } from './useAuth'
import { usePageVisibility } from './usePageVisibility'
import { useSignalMessages } from './useSignalMessages'
import {
  fetchPeerBundle,
  fetchPeerBundleForDevice,
  sendMessage as sendSignalMessage,
  sendMessageFanOut,
  fetchPeerDevices,
  fetchOwnDevices,
  fetchConversation,
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
} from '../lib/signal/session'
import {
  getLocalDeviceId,
} from '../lib/signal/keyManager'
import {
  saveMessage,
  loadAllConversations,
  loadUnreadCounts,
  updateReadAt,
  updateMessageText,
  deleteMessages as deleteMessagesFromDb,
  deleteConversation as deleteConversationFromDb,
} from '../lib/signal/messageStore'
import {
  serializeContent,
  parseMessageContent,
} from '../lib/signal/messageContent'
import type { MessageContent, ImageContent, ReplyTo } from '../lib/signal/messageContent'
import { uploadEncryptedAttachment } from '../lib/signal/attachmentService'
import { ok as okResult, err as errResult, type Result } from '../lib/result'
import { resizeImage, getImageDimensions, generateThumbnail, dataUrlToBlob } from '../Utilities/imageUtils'
import type { DecryptedSignalMessage, PeerDevice, FanOutMessageInput, SyncMessagePayload } from '../lib/signal/transportTypes'
import type { PublicKeyBundle } from '../lib/signal/types'
import type { PeerBundleRpcResult } from '../lib/signal/transportTypes'

const logger = createLogger('Messages')

export type RequestStatus = 'none' | 'sent' | 'received' | 'accepted'

/** Scan a message array to determine the request status with a peer. */
export function getRequestStatus(
  msgs: DecryptedSignalMessage[] | undefined,
  userId: string
): RequestStatus {
  if (!msgs || msgs.length === 0) return 'none'
  for (const m of msgs) {
    if (m.messageType === 'request-accepted') return 'accepted'
  }
  for (const m of msgs) {
    if (m.messageType === 'request' && m.senderId === userId) return 'sent'
    if (m.messageType === 'request' && m.senderId !== userId) return 'received'
  }
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
 *
 * `serialized` should already be the output of serializeContent().
 * `senderUuid` is the current user's UUID — required for sealed sender envelope.
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
        // X3DH for this device
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
        // Existing session — encrypt
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

  // Tag all as sync
  for (const input of fanOutInputs) {
    input.messageType = 'sync'
  }

  if (fanOutInputs.length === 0) return

  await sendMessageFanOut(userId, localDeviceId, userId, fanOutInputs, undefined, originId)
}

/**
 * Encrypt serialized content and send to a single peer's devices.
 * Handles multi-device fan-out and legacy single-device fallback.
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
    // Tag as 'request' if needed (X3DH creates 'initial' type, but requests need the tag)
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
 * Encrypt and send serialized content to all group members (pairwise fan-out).
 * Returns the first server message ID on success.
 */
async function encryptAndSendToGroupMembers(
  userId: string,
  localDeviceId: string,
  groupId: string,
  serialized: string,
  originId: string,
  members: GroupMember[],
): Promise<Result<string>> {
  const otherMembers = members.filter(m => m.userId !== userId)
  let firstServerId: string | null = null

  for (const member of otherMembers) {
    const devicesResult = await fetchPeerDevices(member.userId)
    const peerDevices = devicesResult.ok ? devicesResult.data : []

    if (peerDevices.length > 0) {
      const fanOutInputs = await encryptForAllDevices(member.userId, peerDevices, serialized, userId)
      if (fanOutInputs.length === 0) {
        logger.warn(`Could not encrypt group message for ${member.userId}`)
        continue
      }
      const sendResult = await sendMessageFanOut(userId, localDeviceId, member.userId, fanOutInputs, groupId, originId)
      if (sendResult.ok && !firstServerId) {
        firstServerId = sendResult.data[0]
      }
    }
  }

  return firstServerId ? okResult(firstServerId) : errResult('All group sends failed')
}

/**
 * Resize an image and generate a thumbnail for inline preview.
 * Returns intermediate data needed for both the optimistic placeholder and upload.
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
  /** All conversations keyed by peerId (or groupId for groups), messages sorted oldest-first. */
  conversations: Record<string, DecryptedSignalMessage[]>
  /** Unread count per peer/group. */
  unreadCounts: Record<string, number>
  /** Send a plaintext message to a peer. Handles session creation if needed. Optional threadId for thread replies. */
  sendMessage: (peerId: string, text: string, threadId?: string) => Promise<boolean>
  /** Send an image to a peer. Compresses, encrypts, uploads, and sends via Signal. */
  sendImage: (peerId: string, file: File) => Promise<boolean>
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
  /** Delete an entire conversation (state + unread + IndexedDB). */
  deleteConversation: (conversationKey: string) => void
  /** Whether a send is currently in progress. */
  sending: boolean
  /** Group metadata keyed by groupId. */
  groups: Record<string, GroupInfo>
  /** Send a text message to a group (encrypts to each member's devices). */
  sendGroupMessage: (groupId: string, text: string, threadId?: string) => Promise<boolean>
  /** Send an image to a group. */
  sendGroupImage: (groupId: string, file: File) => Promise<boolean>
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

export function useMessages(): UseMessagesReturn {
  const { user, isAuthenticated } = useAuth()
  const userId = user?.id ?? null
  const isPageVisible = usePageVisibility()

  const [conversations, setConversations] = useState<Record<string, DecryptedSignalMessage[]>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [sending, setSending] = useState(false)
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null)
  const [groups, setGroups] = useState<Record<string, GroupInfo>>({})

  // Track which peer's chat is currently open (for auto-mark-read)
  const activePeerRef = useRef<string | null>(null)

  // External listener ref — MessagesContext sets this to fire notifications
  const onIncomingRef = useRef<((msg: DecryptedSignalMessage) => void) | null>(null)

  // Load local device ID — retry until available (identity may not exist until after initSignalBundle)
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const load = async () => {
      const id = await getLocalDeviceId()
      if (cancelled) return
      if (id) {
        setLocalDeviceId(id)
      } else {
        timer = setTimeout(load, 300)
      }
    }

    load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [isAuthenticated])

  /** Add a decrypted message to the conversations map, deduplicating by ID. */
  const addMessage = useCallback((msg: DecryptedSignalMessage) => {
    // Route by conversation key: groupId for group messages, peerId for 1:1
    const conversationKey = msg.groupId ?? (msg.senderId === userId ? msg.recipientId : msg.senderId)

    setConversations(prev => {
      const existing = prev[conversationKey] ?? []
      // Deduplicate by ID
      if (existing.some(m => m.id === msg.id)) return prev

      // Deduplicate request-accepted by sender (fan-out creates one per device)
      if (msg.messageType === 'request-accepted') {
        if (existing.some(m => m.messageType === 'request-accepted' && m.senderId === msg.senderId)) {
          return prev
        }
      }

      const updated = [...existing, msg].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      return { ...prev, [conversationKey]: updated }
    })

    // Update unread count if it's an incoming message and not the active chat
    // Skip request-accepted — it's a signal, not user content
    if (msg.senderId !== userId && !msg.readAt && msg.messageType !== 'request-accepted') {
      const unreadKey = msg.groupId ?? msg.senderId
      if (activePeerRef.current !== unreadKey) {
        setUnreadCounts(prev => ({
          ...prev,
          [unreadKey]: (prev[unreadKey] ?? 0) + 1,
        }))
      }
    }

    // Skip IDB persist for optimistic messages — persist on confirmation
    if (msg.status === 'sending') return

    // Persist to IndexedDB (fire-and-forget)
    if (userId) {
      saveMessage(msg, userId).catch(() => {})
    }
  }, [userId])

  // Wrap addMessage to auto-mark incoming self-notes as read
  const handleIncomingMessage = useCallback((msg: DecryptedSignalMessage) => {
    if (msg.senderId === userId && msg.recipientId === userId && !msg.readAt) {
      msg.readAt = new Date().toISOString()
      markMessagesRead([msg.id]).catch(() => {})
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

  /** Remove messages by IDs from all conversations (delete callback). */
  const removeMessagesByIds = useCallback((messageIds: string[]) => {
    const idSet = new Set(messageIds)
    setConversations(prev => {
      let changed = false
      const next: Record<string, DecryptedSignalMessage[]> = {}
      for (const [key, msgs] of Object.entries(prev)) {
        const filtered = msgs.filter(m => !idSet.has(m.id))
        if (filtered.length !== msgs.length) changed = true
        if (filtered.length > 0) {
          next[key] = filtered
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  // Subscribe to realtime incoming messages (pass localDeviceId for filtering)
  // Require localDeviceId before subscribing to prevent unfiltered catch-up/realtime
  useSignalMessages({
    userId,
    localDeviceId,
    isAuthenticated: isAuthenticated && !!localDeviceId,
    isPageVisible,
    onMessage: handleIncomingMessage,
    onDelete: removeMessagesByIds,
  })

  // Hydrate conversations and unread counts from IndexedDB on mount
  useEffect(() => {
    if (!userId) return

    let cancelled = false

    async function hydrate() {
      const [convos, counts] = await Promise.all([
        loadAllConversations(),
        loadUnreadCounts(userId!),
      ])
      if (cancelled) return

      if (Object.keys(convos).length > 0) {
        setConversations(convos)
      }
      if (Object.keys(counts).length > 0) {
        setUnreadCounts(counts)
      }
      logger.info(`Hydrated ${Object.keys(convos).length} conversations from IDB`)
    }

    hydrate().catch(err => logger.warn('IDB hydration failed:', err))

    return () => { cancelled = true }
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
    setGroups(map)
  }, [])

  useEffect(() => {
    if (!userId) return
    refreshGroups().catch(e => logger.warn('Group hydration failed:', e))
  }, [userId, refreshGroups])

  // Ref to track latest conversations without adding to callback deps
  const conversationsRef = useRef(conversations)
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  /** Update an optimistic message's ID and status after server confirms, then persist. */
  const updateMessageStatus = useCallback((
    peerId: string,
    localId: string,
    serverId: string,
  ) => {
    setConversations(prev => {
      const msgs = prev[peerId]
      if (!msgs) return prev
      const updated = msgs.map(m => {
        if (m.id === localId) {
          const confirmed = { ...m, id: serverId, status: undefined }
          // Persist confirmed message to IDB directly from the updater where we
          // have the data. db.put is idempotent so harmless if called twice.
          if (userId) {
            saveMessage(confirmed, userId).catch(() => {})
          }
          return confirmed
        }
        return m
      })
      return { ...prev, [peerId]: updated }
    })
  }, [userId])

  /** Remove an optimistic message from state (on send failure). */
  const removeOptimisticMessage = useCallback((peerId: string, localId: string) => {
    setConversations(prev => {
      const msgs = prev[peerId]
      if (!msgs) return prev
      const filtered = msgs.filter(m => m.id !== localId)
      if (filtered.length === 0) {
        const next = { ...prev }
        delete next[peerId]
        return next
      }
      return { ...prev, [peerId]: filtered }
    })
  }, [])

  /** Build replyTo metadata from a threadId by looking up the root message. */
  const buildReplyTo = useCallback((peerId: string, threadId: string): ReplyTo | undefined => {
    const msgs = conversationsRef.current[peerId]
    const root = msgs?.find(m => m.id === threadId)
    if (!root) return undefined
    const preview = (root.plaintext || 'Photo').slice(0, 50)
    return { messageId: threadId, preview }
  }, [])

  /** Send a plaintext message to a peer. */
  const sendMessage = useCallback(async (peerId: string, text: string, threadId?: string): Promise<boolean> => {
    if (!userId || !localDeviceId) {
      logger.error('sendMessage blocked: userId=', userId, 'localDeviceId=', localDeviceId)
      return false
    }

    // Build replyTo if this is a thread reply
    const replyTo = threadId ? buildReplyTo(peerId, threadId) : undefined

    // Self-notes: encrypt to own devices (E2EE even for notes to self)
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
        // Exclude current device — we already have the message locally (optimistic + IDB).
        // Only encrypt to OTHER devices, same pattern as sendSyncToOwnDevices.
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

        // Confirm optimistic message (local-only, no server row targets this device)
        const confirmedId = crypto.randomUUID()
        updateMessageStatus(userId, localId, confirmedId)

        // Persist directly to IDB — updateMessageStatus relies on a setTimeout
        // that reads conversationsRef, which may not have flushed yet (race condition).
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
        }, userId).catch(() => {})

        return true
      } catch (e) {
        logger.error('Self-note error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(userId, localId)
        return false
      }
    }

    // Request gate: check if we need to send a request first
    const status = getRequestStatus(conversationsRef.current[peerId], userId)

    if (status === 'sent') {
      // Already sent a request — don't allow another message until accepted
      return false
    }

    if (status === 'none') {
      // No prior interaction — send as an encrypted request (X3DH)
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

      setSending(true)
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
        }, undefined, originId).catch(() => {})
        return true
      } catch (e) {
        logger.error('sendMessage (request) error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(peerId, localId)
        return false
      } finally {
        setSending(false)
      }
    }

    // status === 'received' or 'accepted' — fall through to X3DH / encrypt path
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

    setSending(true)
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
      }, undefined, originId).catch(() => {})
      return true
    } catch (e) {
      logger.error('sendMessage error:', e instanceof Error ? e.message : e)
      removeOptimisticMessage(peerId, localId)
      return false
    } finally {
      setSending(false)
    }
  }, [userId, localDeviceId, addMessage, updateMessageStatus, removeOptimisticMessage, buildReplyTo])

  /** Send an image message to a peer. Compresses, encrypts, uploads, then sends via Signal. */
  const sendImage = useCallback(async (peerId: string, file: File): Promise<boolean> => {
    if (!userId || !localDeviceId) return false

    // Self-notes: encrypt to own devices (E2EE even for notes to self)
    if (peerId === userId) {
      const localId = crypto.randomUUID()
      const originId = crypto.randomUUID()
      const now = new Date().toISOString()
      setSending(true)
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

        // Update optimistic message with real path/key
        setConversations(prev => {
          const msgs = prev[userId]
          if (!msgs) return prev
          return { ...prev, [userId]: msgs.map(m => m.id === localId ? { ...m, content: imageContent } : m) }
        })

        // Fan out to OTHER own devices only
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

        // Confirm optimistic message
        const confirmedId = crypto.randomUUID()
        updateMessageStatus(userId, localId, confirmedId)

        // Persist directly to IDB
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
        }, userId).catch(() => {})

        return true
      } catch (e) {
        logger.error('Self-note image error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(userId, localId)
        return false
      } finally {
        setSending(false)
      }
    }

    // Images require an accepted conversation (not allowed in requests)
    const status = getRequestStatus(conversationsRef.current[peerId], userId)
    if (status !== 'accepted' && status !== 'received') {
      logger.warn('Cannot send image: conversation not yet accepted')
      return false
    }

    let localId: string | null = null
    const originId = crypto.randomUUID()
    setSending(true)
    try {
      // 1. Resize + thumbnail for immediate placeholder
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

      // 2. Encrypt + upload to Supabase Storage
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

      // Update optimistic message with real path/key
      setConversations(prev => {
        const msgs = prev[peerId]
        if (!msgs) return prev
        return { ...prev, [peerId]: msgs.map(m => m.id === localId ? { ...m, content: imageContent } : m) }
      })

      // 3. Encrypt + send
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
      }, undefined, originId).catch(() => {})
      return true
    } catch (e) {
      logger.error('sendImage error:', e instanceof Error ? e.message : e)
      if (localId) removeOptimisticMessage(peerId, localId)
      return false
    } finally {
      setSending(false)
    }
  }, [userId, localDeviceId, addMessage, updateMessageStatus, removeOptimisticMessage])

  /** Fetch conversation history from Supabase, decrypt locally, merge into state. */
  const fetchHistory = useCallback(async (peerId: string) => {
    if (!userId) return

    // Self-notes are encrypted per-device — Supabase rows target OTHER devices.
    // The current device's copies live in IDB (hydrated on mount). Nothing to fetch.
    if (peerId === userId) return

    const result = await fetchConversation(userId, peerId)
    if (!result.ok) {
      logger.warn('fetchHistory failed:', result.error)
      return
    }

    // Rows come newest-first from the DB — reverse for chronological order.
    // We only add "sent" messages (where we are the sender) from history,
    // because received messages need decryption which mutates ratchet state.
    // Received messages are handled by useSignalMessages catch-up on mount.
    const rows = result.data.reverse()

    for (const row of rows) {
      if (row.sender_id === userId) {
        // Our own sent messages — we can't decrypt them (no session state for self),
        // but we don't have the plaintext stored. Skip for now.
        // They'll appear from the addMessage call when we send.
      }
      // Received messages are decrypted by useSignalMessages catch-up
    }

    logger.info(`fetchHistory: ${rows.length} rows for peer ${peerId}`)
  }, [userId, addMessage])

  /** Mark messages from a peer as read. */
  const markAsRead = useCallback((peerId: string) => {
    activePeerRef.current = peerId

    // Clear local unread count
    setUnreadCounts(prev => {
      if (!prev[peerId]) return prev
      const next = { ...prev }
      delete next[peerId]
      return next
    })

    // Mark on server — use ref to avoid conversations dependency cascade
    const msgs = conversationsRef.current[peerId]
    if (!msgs) return

    const unreadIds = msgs
      .filter(m => m.senderId !== userId && !m.readAt)
      .map(m => m.id)

    if (unreadIds.length > 0) {
      const readAtTs = new Date().toISOString()

      markMessagesRead(unreadIds).then(result => {
        if (!result.ok) logger.warn('markMessagesRead failed:', result.error)
      })

      // Persist readAt to IndexedDB (fire-and-forget)
      updateReadAt(unreadIds, readAtTs).catch(() => {})

      // Update local state to reflect read status
      setConversations(prev => {
        const updated = (prev[peerId] ?? []).map(m =>
          unreadIds.includes(m.id) ? { ...m, readAt: readAtTs } : m
        )
        return { ...prev, [peerId]: updated }
      })
    }
  }, [userId])

  // Guard against concurrent acceptRequest calls
  const acceptingRef = useRef<Set<string>>(new Set())

  /** Accept a message request from a peer (fan out to all peer devices). */
  const acceptRequest = useCallback(async (peerId: string): Promise<void> => {
    if (!userId || !localDeviceId) return

    // Idempotency: skip if already accepted or accept in-flight
    const status = getRequestStatus(conversationsRef.current[peerId], userId)
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
      // Encrypt the accept signal through established sessions (created when
      // the inbound request was decrypted via X3DH).
      const serialized = serializeContent({ type: 'text', text: '' })
      const originId = crypto.randomUUID()
      const devicesResult = await fetchPeerDevices(peerId)
      const peerDevices = devicesResult.ok ? devicesResult.data : []

      let messageId: string

      if (peerDevices.length > 0) {
        const fanOutInputs = await encryptForAllDevices(peerId, peerDevices, serialized, userId)
        // Tag all as request-accepted (encryptForAllDevices sets 'initial' or 'message')
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
        // Legacy single-device fallback: encrypt through existing session
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

      // Sync accept to own devices
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: peerId, serialized, originalMessageType: 'request-accepted',
        originalTimestamp: new Date().toISOString(), originalMessageId: messageId,
      }).catch(() => {})
    } catch (e) {
      logger.error('acceptRequest error:', e instanceof Error ? e.message : e)
    } finally {
      acceptingRef.current.delete(peerId)
    }
  }, [userId, localDeviceId, addMessage])

  /** Get request status for a specific peer. */
  const getRequestStatusForPeer = useCallback((peerId: string): RequestStatus => {
    return getRequestStatus(conversations[peerId], userId ?? '')
  }, [conversations, userId])

  /** Edit a message's plaintext locally (state + IndexedDB). */
  const editMessage = useCallback((peerId: string, messageId: string, newText: string) => {
    setConversations(prev => {
      const msgs = prev[peerId]
      if (!msgs) return prev
      const updated = msgs.map(m => m.id === messageId ? { ...m, plaintext: newText } : m)
      return { ...prev, [peerId]: updated }
    })

    // Persist to IndexedDB (fire-and-forget)
    updateMessageText(messageId, newText).catch(() => {})
  }, [])

  /** Delete messages via protocol-level 'delete' messages (state + IndexedDB + peer notification). */
  const deleteMessages = useCallback(async (peerId: string, messageIds: string[]) => {
    if (!userId || !localDeviceId) return

    // 1. Collect originIds from the messages being deleted
    const msgs = conversationsRef.current[peerId] ?? []
    const originIds = messageIds
      .map(id => msgs.find(m => m.id === id)?.originId)
      .filter((oid): oid is string => !!oid)

    // 2. Remove from React state
    const idSet = new Set(messageIds)
    setConversations(prev => {
      const existing = prev[peerId]
      if (!existing) return prev
      const filtered = existing.filter(m => !idSet.has(m.id))
      if (filtered.length === 0) {
        const next = { ...prev }
        delete next[peerId]
        return next
      }
      return { ...prev, [peerId]: filtered }
    })

    // 3. Delete from local IDB
    deleteMessagesFromDb(messageIds).catch(e =>
      logger.warn('Failed to delete messages from IDB:', e instanceof Error ? e.message : e)
    )

    if (originIds.length === 0) return

    const deletePayload = JSON.stringify({ originIds })
    const deleteOriginId = crypto.randomUUID()

    // 4. Send protocol-level 'delete' to peer's devices
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

    // 5. Send 'delete' to own other devices (sync)
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

    // 6. Hard-delete both sent and received rows from Supabase by origin_id
    hardDeleteByOriginId(originIds).catch(e =>
      logger.warn('Failed to hard-delete from Supabase:', e instanceof Error ? e.message : e)
    )
  }, [userId, localDeviceId])

  /** Delete an entire conversation from state, unread counts, and IndexedDB. */
  const deleteConversation = useCallback((conversationKey: string) => {
    setConversations(prev => {
      if (!prev[conversationKey]) return prev
      const next = { ...prev }
      delete next[conversationKey]
      return next
    })
    setUnreadCounts(prev => {
      if (!prev[conversationKey]) return prev
      const next = { ...prev }
      delete next[conversationKey]
      return next
    })
    deleteConversationFromDb(conversationKey).catch(e =>
      logger.warn('Failed to delete conversation from IDB:', e instanceof Error ? e.message : e)
    )
  }, [])

  // ── Group messaging ────────────────────────────────────────────────────

  /** Send a text message to a group (pairwise fan-out to each member's devices). */
  const sendGroupMessage = useCallback(async (groupId: string, text: string, threadId?: string): Promise<boolean> => {
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

    setSending(true)
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
      }, groupId, originId).catch(() => {})
      return true
    } catch (e) {
      logger.error('sendGroupMessage error:', e instanceof Error ? e.message : e)
      removeOptimisticMessage(groupId, localId)
      return false
    } finally {
      setSending(false)
    }
  }, [userId, localDeviceId, addMessage, updateMessageStatus, removeOptimisticMessage, buildReplyTo])

  /** Send an image to a group. */
  const sendGroupImage = useCallback(async (groupId: string, file: File): Promise<boolean> => {
    if (!userId || !localDeviceId) return false

    let localId: string | null = null
    const originId = crypto.randomUUID()
    setSending(true)
    try {
      // 1. Resize + thumbnail for immediate placeholder
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

      // 2. Encrypt + upload
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

      // Update optimistic message with real path/key
      setConversations(prev => {
        const msgs = prev[groupId]
        if (!msgs) return prev
        return { ...prev, [groupId]: msgs.map(m => m.id === localId ? { ...m, content: imageContent } : m) }
      })

      // 3. Encrypt + send to group members
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
      }, groupId, originId).catch(() => {})
      return true
    } catch (e) {
      logger.error('sendGroupImage error:', e instanceof Error ? e.message : e)
      if (localId) removeOptimisticMessage(groupId, localId)
      return false
    } finally {
      setSending(false)
    }
  }, [userId, localDeviceId, addMessage, updateMessageStatus, removeOptimisticMessage])

  /** Create a new group. Returns the groupId on success, null on failure. */
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
    // Remove from local state
    setGroups(prev => {
      const next = { ...prev }
      delete next[groupId]
      return next
    })
    setConversations(prev => {
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }, [])

  /** Rename a group. */
  const renameGroupFn = useCallback(async (groupId: string, name: string): Promise<void> => {
    const result = await renameGroupRpc(groupId, name)
    if (!result.ok) {
      logger.error('renameGroup failed:', result.error)
      return
    }
    setGroups(prev => ({
      ...prev,
      [groupId]: { ...prev[groupId], name },
    }))
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

    // Rows come newest-first — reverse for chronological order
    // Like 1:1, we can't re-decrypt received messages here (ratchet state)
    // They come through the realtime subscription catch-up instead
    logger.info(`fetchGroupHistory: ${result.data.length} rows for group ${groupId}`)
  }, [userId])

  // Clear active peer when unmounting
  useEffect(() => {
    return () => { activePeerRef.current = null }
  }, [])

  return {
    conversations,
    unreadCounts,
    sendMessage,
    sendImage,
    acceptRequest,
    getRequestStatusForPeer,
    fetchHistory,
    markAsRead,
    editMessage,
    deleteMessages,
    deleteConversation,
    sending,
    groups,
    sendGroupMessage,
    sendGroupImage,
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
