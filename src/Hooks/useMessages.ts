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
  fetchConversation,
  markMessagesRead,
  deleteMessages as deleteMessagesFromSupabase,
} from '../lib/signal/signalService'
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
} from '../lib/signal/messageStore'
import {
  serializeContent,
  parseMessageContent,
} from '../lib/signal/messageContent'
import type { MessageContent, ImageContent } from '../lib/signal/messageContent'
import { uploadEncryptedAttachment } from '../lib/signal/attachmentService'
import { resizeImage, getImageDimensions, generateThumbnail, dataUrlToBlob } from '../Utilities/imageUtils'
import type { DecryptedSignalMessage, PeerDevice, FanOutMessageInput } from '../lib/signal/transportTypes'
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
 */
async function encryptForAllDevices(
  peerId: string,
  peerDevices: PeerDevice[],
  serialized: string
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
        const initialMessage = await createOutboundSession(peerId, device.deviceId, bundle, serialized)
        results.push({
          recipientDeviceId: device.deviceId,
          payload: initialMessage as unknown as Record<string, unknown>,
          messageType: 'initial',
        })
      } else {
        // Existing session — encrypt
        const encrypted = await encryptMessage(peerId, device.deviceId, serialized)
        results.push({
          recipientDeviceId: device.deviceId,
          payload: encrypted as unknown as Record<string, unknown>,
          messageType: 'message',
        })
      }
    } catch (e) {
      logger.warn(`Failed to encrypt for ${peerId}:${device.deviceId}:`, e instanceof Error ? e.message : e)
    }
  }

  return results
}

export interface UseMessagesReturn {
  /** All conversations keyed by peerId, messages sorted oldest-first. */
  conversations: Record<string, DecryptedSignalMessage[]>
  /** Unread count per peer. */
  unreadCounts: Record<string, number>
  /** Send a plaintext message to a peer. Handles session creation if needed. */
  sendMessage: (peerId: string, text: string) => Promise<boolean>
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
  /** Delete messages locally (state + IndexedDB). */
  deleteMessages: (peerId: string, messageIds: string[]) => void
  /** Whether a send is currently in progress. */
  sending: boolean
}

export function useMessages(): UseMessagesReturn {
  const { user, isAuthenticated } = useAuth()
  const userId = user?.id ?? null
  const isPageVisible = usePageVisibility()

  const [conversations, setConversations] = useState<Record<string, DecryptedSignalMessage[]>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [sending, setSending] = useState(false)
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null)

  // Track which peer's chat is currently open (for auto-mark-read)
  const activePeerRef = useRef<string | null>(null)

  // Load local device ID on mount
  useEffect(() => {
    getLocalDeviceId().then(id => {
      if (id) setLocalDeviceId(id)
    }).catch(() => {})
  }, [])

  /** Add a decrypted message to the conversations map, deduplicating by ID. */
  const addMessage = useCallback((msg: DecryptedSignalMessage) => {
    const peerId = msg.senderId === userId ? msg.recipientId : msg.senderId

    setConversations(prev => {
      const existing = prev[peerId] ?? []
      // Deduplicate
      if (existing.some(m => m.id === msg.id)) return prev

      const updated = [...existing, msg].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      return { ...prev, [peerId]: updated }
    })

    // Update unread count if it's an incoming message and not the active chat
    // Skip request-accepted — it's a signal, not user content
    if (msg.senderId !== userId && !msg.readAt && msg.messageType !== 'request-accepted') {
      if (activePeerRef.current !== msg.senderId) {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] ?? 0) + 1,
        }))
      }
    }

    // Persist to IndexedDB (fire-and-forget)
    if (userId) {
      saveMessage(msg, userId).catch(() => {})
    }
  }, [userId])

  // Subscribe to realtime incoming messages (pass localDeviceId for filtering)
  useSignalMessages({
    userId,
    localDeviceId,
    isAuthenticated,
    isPageVisible,
    onMessage: addMessage,
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

  // Ref to track latest conversations without adding to callback deps
  const conversationsRef = useRef(conversations)
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  /** Send a plaintext message to a peer. */
  const sendMessage = useCallback(async (peerId: string, text: string): Promise<boolean> => {
    if (!userId || !localDeviceId) return false

    // Self-notes: store locally only, no crypto or network
    if (peerId === userId) {
      const selfNote: DecryptedSignalMessage = {
        id: crypto.randomUUID(),
        senderId: userId,
        recipientId: userId,
        plaintext: text,
        messageType: 'message',
        createdAt: new Date().toISOString(),
        readAt: new Date().toISOString(),
      }
      addMessage(selfNote)
      return true
    }

    // Request gate: check if we need to send a request first
    const status = getRequestStatus(conversationsRef.current[peerId], userId)

    if (status === 'sent') {
      // Already sent a request — don't allow another message until accepted
      return false
    }

    if (status === 'none') {
      // No prior interaction — send as an encrypted request (X3DH)
      setSending(true)
      try {
        const serialized = serializeContent({ type: 'text', text })
        const devicesResult = await fetchPeerDevices(peerId)
        const peerDevices = devicesResult.ok ? devicesResult.data : []

        if (peerDevices.length > 0) {
          // Encrypt via X3DH for each device, then tag as 'request'
          const fanOutInputs = await encryptForAllDevices(peerId, peerDevices, serialized)
          for (const input of fanOutInputs) {
            input.messageType = 'request'
          }

          if (fanOutInputs.length === 0) {
            logger.error('Could not encrypt request for any peer device')
            return false
          }

          const sendResult = await sendMessageFanOut(userId, localDeviceId, peerId, fanOutInputs)
          if (!sendResult.ok) {
            logger.error('Failed to send request fan-out:', sendResult.error)
            return false
          }

          addMessage({
            id: sendResult.data[0],
            senderId: userId,
            recipientId: peerId,
            plaintext: text,
            messageType: 'request',
            createdAt: new Date().toISOString(),
            readAt: null,
          })
        } else {
          // No devices registered — legacy single-device X3DH
          const bundleResult = await fetchPeerBundle(peerId)
          if (!bundleResult.ok) {
            logger.error('Failed to fetch peer bundle for request:', bundleResult.error)
            return false
          }

          const bundle = rpcResultToBundle(bundleResult.data)
          const peerDeviceId = bundle.deviceId || 'unknown'
          const initialMessage = await createOutboundSession(peerId, peerDeviceId, bundle, serialized)

          const sendResult = await sendSignalMessage(userId, peerId, initialMessage, 'request', localDeviceId)
          if (!sendResult.ok) {
            logger.error('Failed to send request:', sendResult.error)
            return false
          }

          addMessage({
            id: sendResult.data,
            senderId: userId,
            recipientId: peerId,
            plaintext: text,
            messageType: 'request',
            createdAt: new Date().toISOString(),
            readAt: null,
          })
        }

        return true
      } catch (e) {
        logger.error('sendMessage (request) error:', e instanceof Error ? e.message : e)
        return false
      } finally {
        setSending(false)
      }
    }

    // status === 'received' or 'accepted' — fall through to X3DH / encrypt path
    setSending(true)
    try {
      // Wrap text in structured content format before encryption
      const serialized = serializeContent({ type: 'text', text })
      const textContent: MessageContent = { type: 'text', text }

      // Fetch peer devices for fan-out
      const devicesResult = await fetchPeerDevices(peerId)
      const peerDevices = devicesResult.ok ? devicesResult.data : []

      if (peerDevices.length > 0) {
        // Multi-device fan-out
        const fanOutInputs = await encryptForAllDevices(peerId, peerDevices, serialized)

        if (fanOutInputs.length === 0) {
          logger.error('Could not encrypt for any peer device')
          return false
        }

        const sendResult = await sendMessageFanOut(userId, localDeviceId, peerId, fanOutInputs)
        if (!sendResult.ok) {
          logger.error('Failed to send fan-out message:', sendResult.error)
          return false
        }

        // Add first copy to local conversations
        addMessage({
          id: sendResult.data[0],
          senderId: userId,
          recipientId: peerId,
          plaintext: text,
          content: textContent,
          messageType: fanOutInputs[0].messageType,
          createdAt: new Date().toISOString(),
          readAt: null,
        })
      } else {
        // No devices registered — legacy single-device path
        const sessionExists = await hasSession(peerId, 'unknown')

        if (!sessionExists) {
          // Try old fetchPeerBundle for legacy
          const bundleResult = await fetchPeerBundle(peerId)
          if (!bundleResult.ok) {
            logger.error('Failed to fetch peer bundle:', bundleResult.error)
            return false
          }

          const bundle = rpcResultToBundle(bundleResult.data)
          const peerDeviceId = bundle.deviceId || 'unknown'
          const initialMessage = await createOutboundSession(peerId, peerDeviceId, bundle, serialized)

          const sendResult = await sendSignalMessage(userId, peerId, initialMessage, 'initial', localDeviceId)
          if (!sendResult.ok) {
            logger.error('Failed to send initial message:', sendResult.error)
            return false
          }

          addMessage({
            id: sendResult.data,
            senderId: userId,
            recipientId: peerId,
            plaintext: text,
            content: textContent,
            messageType: 'initial',
            createdAt: new Date().toISOString(),
            readAt: null,
          })
        } else {
          const encrypted = await encryptMessage(peerId, 'unknown', serialized)
          const sendResult = await sendSignalMessage(userId, peerId, encrypted, 'message', localDeviceId)
          if (!sendResult.ok) {
            logger.error('Failed to send message:', sendResult.error)
            return false
          }

          addMessage({
            id: sendResult.data,
            senderId: userId,
            recipientId: peerId,
            plaintext: text,
            content: textContent,
            messageType: 'message',
            createdAt: new Date().toISOString(),
            readAt: null,
          })
        }
      }

      return true
    } catch (e) {
      logger.error('sendMessage error:', e instanceof Error ? e.message : e)
      return false
    } finally {
      setSending(false)
    }
  }, [userId, localDeviceId, addMessage])

  /** Send an image message to a peer. Compresses, encrypts, uploads, then sends via Signal. */
  const sendImage = useCallback(async (peerId: string, file: File): Promise<boolean> => {
    if (!userId || !localDeviceId) return false

    // Images require an accepted conversation (not allowed in requests)
    const status = getRequestStatus(conversationsRef.current[peerId], userId)
    if (status !== 'accepted' && status !== 'received') {
      logger.warn('Cannot send image: conversation not yet accepted')
      return false
    }

    setSending(true)
    try {
      // 1. Resize image
      const resizedDataUrl = await resizeImage(file, 800, 0.7)
      const { width, height } = await getImageDimensions(resizedDataUrl)

      // 2. Generate tiny thumbnail for inline preview
      const thumbnail = await generateThumbnail(resizedDataUrl, 60, 0.5)

      // 3. Convert resized image to blob for upload
      const imageBlob = dataUrlToBlob(resizedDataUrl)

      // 4. Encrypt + upload to Supabase Storage
      const uploadResult = await uploadEncryptedAttachment(userId, imageBlob)
      if (!uploadResult.ok) {
        logger.error('Image upload failed:', uploadResult.error)
        return false
      }

      const { path, key } = uploadResult.data

      // 5. Build ImageContent
      const imageContent: ImageContent = {
        type: 'image',
        mime: 'image/jpeg',
        key,
        path,
        width,
        height,
        thumbnail,
      }

      // 6. Serialize for encryption
      const serialized = serializeContent(imageContent)

      // 7. Encrypt + send via existing fan-out flow
      const devicesResult = await fetchPeerDevices(peerId)
      const peerDevices = devicesResult.ok ? devicesResult.data : []

      if (peerDevices.length > 0) {
        const fanOutInputs = await encryptForAllDevices(peerId, peerDevices, serialized)
        if (fanOutInputs.length === 0) {
          logger.error('Could not encrypt image for any peer device')
          return false
        }

        const sendResult = await sendMessageFanOut(userId, localDeviceId, peerId, fanOutInputs)
        if (!sendResult.ok) {
          logger.error('Failed to send image fan-out:', sendResult.error)
          return false
        }

        addMessage({
          id: sendResult.data[0],
          senderId: userId,
          recipientId: peerId,
          plaintext: '\u{1F4F7} Photo',
          content: imageContent,
          messageType: fanOutInputs[0].messageType,
          createdAt: new Date().toISOString(),
          readAt: null,
        })
      } else {
        // Legacy single-device path
        const sessionExists = await hasSession(peerId, 'unknown')

        if (!sessionExists) {
          const bundleResult = await fetchPeerBundle(peerId)
          if (!bundleResult.ok) {
            logger.error('Failed to fetch peer bundle for image:', bundleResult.error)
            return false
          }
          const bundle = rpcResultToBundle(bundleResult.data)
          const peerDeviceId = bundle.deviceId || 'unknown'
          const initialMessage = await createOutboundSession(peerId, peerDeviceId, bundle, serialized)
          const sendResult = await sendSignalMessage(userId, peerId, initialMessage, 'initial', localDeviceId)
          if (!sendResult.ok) {
            logger.error('Failed to send image initial:', sendResult.error)
            return false
          }
          addMessage({
            id: sendResult.data,
            senderId: userId,
            recipientId: peerId,
            plaintext: '\u{1F4F7} Photo',
            content: imageContent,
            messageType: 'initial',
            createdAt: new Date().toISOString(),
            readAt: null,
          })
        } else {
          const encrypted = await encryptMessage(peerId, 'unknown', serialized)
          const sendResult = await sendSignalMessage(userId, peerId, encrypted, 'message', localDeviceId)
          if (!sendResult.ok) {
            logger.error('Failed to send image message:', sendResult.error)
            return false
          }
          addMessage({
            id: sendResult.data,
            senderId: userId,
            recipientId: peerId,
            plaintext: '\u{1F4F7} Photo',
            content: imageContent,
            messageType: 'message',
            createdAt: new Date().toISOString(),
            readAt: null,
          })
        }
      }

      return true
    } catch (e) {
      logger.error('sendImage error:', e instanceof Error ? e.message : e)
      return false
    } finally {
      setSending(false)
    }
  }, [userId, localDeviceId, addMessage])

  /** Fetch conversation history from Supabase, decrypt locally, merge into state. */
  const fetchHistory = useCallback(async (peerId: string) => {
    if (!userId) return
    // Self-notes are IDB-only — no Supabase history to fetch
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
  }, [userId])

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

  /** Accept a message request from a peer (fan out to all peer devices). */
  const acceptRequest = useCallback(async (peerId: string): Promise<void> => {
    if (!userId || !localDeviceId) return

    try {
      // Fan out request-accepted to all peer devices
      const devicesResult = await fetchPeerDevices(peerId)
      const peerDevices = devicesResult.ok ? devicesResult.data : []

      let messageId: string

      if (peerDevices.length > 0) {
        const fanOutInputs: FanOutMessageInput[] = peerDevices.map(d => ({
          recipientDeviceId: d.deviceId,
          payload: {} as Record<string, unknown>,
          messageType: 'request-accepted' as const,
        }))

        const sendResult = await sendMessageFanOut(userId, localDeviceId, peerId, fanOutInputs)
        if (!sendResult.ok) {
          logger.error('Failed to send request-accepted fan-out:', sendResult.error)
          return
        }

        messageId = sendResult.data[0] ?? crypto.randomUUID()
      } else {
        // Fallback: single send
        const sendResult = await sendSignalMessage(userId, peerId, {} as Record<string, never>, 'request-accepted', localDeviceId)
        if (!sendResult.ok) {
          logger.error('Failed to send request-accepted:', sendResult.error)
          return
        }

        messageId = sendResult.data
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
    } catch (e) {
      logger.error('acceptRequest error:', e instanceof Error ? e.message : e)
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

  /** Delete messages (state + IndexedDB + Supabase). */
  const deleteMessages = useCallback((peerId: string, messageIds: string[]) => {
    const idSet = new Set(messageIds)
    setConversations(prev => {
      const msgs = prev[peerId]
      if (!msgs) return prev
      const filtered = msgs.filter(m => !idSet.has(m.id))
      if (filtered.length === 0) {
        const next = { ...prev }
        delete next[peerId]
        return next
      }
      return { ...prev, [peerId]: filtered }
    })

    // Persist to IndexedDB (fire-and-forget)
    deleteMessagesFromDb(messageIds).catch(() => {})

    // Delete from Supabase (fire-and-forget)
    deleteMessagesFromSupabase(messageIds).catch(() => {})
  }, [])

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
    sending,
  }
}
