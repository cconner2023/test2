/**
 * useSignalMessages — Realtime subscription for incoming Signal Protocol messages.
 *
 * Subscribes to INSERT events on `signal_messages` filtered by recipient_id.
 * On mount: fetches unread messages for offline catch-up.
 * On realtime INSERT: decrypts via processIncomingMessage (sealed sender).
 *
 * Multi-device: filters messages by recipient_device_id to only process
 * messages targeted at this device (or null for legacy messages).
 *
 * Follows the same pattern as useRealtimeTrainingCompletions.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createLogger } from '../Utilities/Logger'
import { useSupabaseSubscription } from './useSupabaseSubscription'
import { fetchUnreadMessages, markMessagesRead, deleteMessages as hardDeleteMessages, hardDeleteByOriginId, onLoRaMessage, sendMessage as sendSignalMessage } from '../lib/signal/signalService'
import { deleteMessagesByOriginId as deleteMessagesByOriginIdFromDb, updateReadAt } from '../lib/signal/messageStore'
import { scheduleBackup } from '../lib/signal/backupService'
import { LORA_MESH_ENABLED } from '../lib/featureFlags'
import { processIncomingMessage, encryptMessage } from '../lib/signal/session'
import type { SealedEnvelope } from '../lib/signal/sealedSender'
import type { SignalMessageRow, DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { SyncMessagePayload } from '../lib/signal/transportTypes'
import { parseMessageContent } from '../lib/signal/messageContent'
import { isCalendarEvent } from '../lib/calendarRouting'
import { errorBus } from '../lib/errorBus'
import { ErrorCode } from '../lib/errorCodes'

const logger = createLogger('RealtimeSignal')

/** Send a delivery receipt back to the original sender. Fire-and-forget — never throws. */
async function sendDeliveryReceipt(
  senderUuid: string,
  senderDeviceId: string,
  messageIds: string[],
  myUuid: string,
  myDeviceId: string,
): Promise<void> {
  try {
    const payload = JSON.stringify({
      __type: 'delivery-receipt',
      messageIds,
      deliveredAt: new Date().toISOString(),
    })
    const envelope = await encryptMessage(senderUuid, senderDeviceId, payload, myUuid)
    await sendSignalMessage(
      myUuid,
      senderUuid,
      envelope as unknown as Record<string, never>,
      'receipt',
      myDeviceId,
      senderDeviceId,
    )
  } catch {
    // Delivery receipts are best-effort — silently ignore failures
  }
}

interface UseSignalMessagesOptions {
  userId: string | null
  localDeviceId: string | null
  isAuthenticated: boolean
  isPageVisible: boolean
  onMessage: (message: DecryptedSignalMessage) => void
  onDelete?: (messageIds: string[]) => void
}

async function decryptRow(row: SignalMessageRow, myUuid: string): Promise<DecryptedSignalMessage | null> {
  try {
    const envelope = row.payload as unknown as SealedEnvelope
    const senderDeviceId = row.sender_device_id ?? 'unknown'

    // Delete messages: decrypt through session, extract originIds
    if (row.message_type === 'delete') {
      const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
        senderDeviceId, envelope, myUuid
      )
      const { originIds } = JSON.parse(rawPlaintext) as { originIds: string[] }
      return {
        id: row.id,
        senderId: senderUuid,
        recipientId: row.recipient_id,
        plaintext: JSON.stringify({ originIds }),
        messageType: 'delete' as const,
        createdAt: row.created_at,
        readAt: row.read_at,
      }
    }

    // Sync messages: sealed envelope containing a SyncMessagePayload or ReadSyncPayload
    if (row.message_type === 'sync') {
      const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
        senderDeviceId, envelope, myUuid
      )

      // Check for read-sync (cross-device read status update)
      try {
        const parsed = JSON.parse(rawPlaintext) as Record<string, unknown>
        if (parsed.__syncType === 'read') {
          const peerId = parsed.peerId as string
          const messageIds = parsed.messageIds as string[]
          const readAt = parsed.readAt as string
          updateReadAt(messageIds, readAt).catch(() => {})
          return {
            id: row.id,
            senderId: senderUuid,
            recipientId: row.recipient_id,
            plaintext: rawPlaintext,
            messageType: 'sync' as const,
            createdAt: row.created_at,
            readAt: new Date().toISOString(),
            _readSync: { peerId, messageIds, readAt },
          }
        }
      } catch { /* not JSON or not read-sync, fall through */ }

      const sync = JSON.parse(rawPlaintext) as SyncMessagePayload
      const { plaintext, content, replyTo } = parseMessageContent(sync.serialized)

      return {
        id: sync.originalMessageId,
        senderId: senderUuid,
        recipientId: sync.forPeerId,
        plaintext,
        content,
        messageType: sync.originalMessageType,
        createdAt: sync.originalTimestamp,
        readAt: new Date().toISOString(), // auto-read (own sent message)
        ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
        ...(sync.forGroupId && { groupId: sync.forGroupId }),
        originId: sync.originId ?? row.origin_id ?? undefined,
      }
    }

    // Requests: sealed envelope (X3DH InitialMessage inside)
    if (row.message_type === 'request') {
      const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
        senderDeviceId, envelope, myUuid
      )
      const { plaintext, content, replyTo } = parseMessageContent(rawPlaintext)
      return {
        id: row.id,
        senderId: senderUuid,
        recipientId: row.recipient_id,
        plaintext,
        content,
        messageType: row.message_type,
        createdAt: row.created_at,
        readAt: row.read_at,
        ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
        ...(row.group_id && { groupId: row.group_id }),
        originId: row.origin_id ?? undefined,
      }
    }

    // Request-accepted: decrypt through session to get senderUuid
    if (row.message_type === 'request-accepted') {
      const { senderUuid } = await processIncomingMessage(
        senderDeviceId, envelope, myUuid
      )
      return {
        id: row.id,
        senderId: senderUuid,
        recipientId: row.recipient_id,
        plaintext: '',
        messageType: row.message_type,
        createdAt: row.created_at,
        readAt: row.read_at,
        ...(row.group_id && { groupId: row.group_id }),
        originId: row.origin_id ?? undefined,
      }
    }

    // Delivery receipt: dedicated protocol type — decrypt and surface as _deliveryReceipt
    if (row.message_type === 'receipt') {
      const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
        senderDeviceId, envelope, myUuid
      )
      const parsed = JSON.parse(rawPlaintext) as Record<string, unknown>
      return {
        id: row.id,
        senderId: senderUuid,
        recipientId: row.recipient_id,
        plaintext: rawPlaintext,
        messageType: row.message_type,
        createdAt: row.created_at,
        readAt: row.read_at,
        _deliveryReceipt: {
          messageIds: parsed.messageIds as string[],
          deliveredAt: parsed.deliveredAt as string,
        },
      }
    }

    // Initial and message types: both go through processIncomingMessage
    const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
      senderDeviceId, envelope, myUuid
    )

    // Legacy: receipts sent as 'message' before protocol upgrade — still handle gracefully
    try {
      const parsed = JSON.parse(rawPlaintext) as Record<string, unknown>
      if (parsed.__type === 'delivery-receipt') {
        return {
          id: row.id,
          senderId: senderUuid,
          recipientId: row.recipient_id,
          plaintext: rawPlaintext,
          messageType: row.message_type,
          createdAt: row.created_at,
          readAt: row.read_at,
          _deliveryReceipt: {
            messageIds: parsed.messageIds as string[],
            deliveredAt: parsed.deliveredAt as string,
          },
        }
      }
    } catch { /* not a receipt — continue as normal message */ }

    // Parse structured content (text or image) from the decrypted payload
    const { plaintext, content, replyTo } = parseMessageContent(rawPlaintext)

    return {
      id: row.id,
      senderId: senderUuid,
      recipientId: row.recipient_id,
      plaintext,
      content,
      messageType: row.message_type,
      createdAt: row.created_at,
      readAt: row.read_at,
      ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
      ...(row.group_id && { groupId: row.group_id }),
      originId: row.origin_id ?? undefined,
    }
  } catch (e) {
    logger.error(`Failed to decrypt message ${row.id}:`, e instanceof Error ? e.message : e)
    errorBus.emit({
      code: ErrorCode.DECRYPT_FAILED,
      source: 'decryptRow',
      message: 'A message could not be decrypted and was skipped.',
      timestamp: Date.now(),
      metadata: { messageId: row.id, messageType: row.message_type },
    })
    return null
  }
}

export function useSignalMessages({
  userId,
  localDeviceId,
  isAuthenticated,
  isPageVisible,
  onMessage,
  onDelete,
}: UseSignalMessagesOptions): void {
  const onMessageRef = useRef(onMessage)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const onDeleteRef = useRef(onDelete)
  useEffect(() => {
    onDeleteRef.current = onDelete
  }, [onDelete])

  const localDeviceIdRef = useRef(localDeviceId)
  useEffect(() => {
    localDeviceIdRef.current = localDeviceId
  }, [localDeviceId])

  // Track userId via ref so callbacks with empty deps can always read the latest value
  const userIdRef = useRef(userId)
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  // Track whether catch-up has already run to avoid re-fetching on re-subscribe
  const catchUpDone = useRef(false)

  const processedIds = useRef(new Set<string>())
  const trackProcessed = (id: string) => {
    processedIds.current.add(id)
    if (processedIds.current.size > 2000) {
      const entries = Array.from(processedIds.current)
      processedIds.current = new Set(entries.slice(-1000))
    }
  }

  // Counter to trigger catch-up re-run when visibility restores
  const [catchUpTrigger, setCatchUpTrigger] = useState(0)

  // Reset catch-up when page visibility restores (messages may have been missed while hidden)
  const prevVisibleRef = useRef(isPageVisible)
  useEffect(() => {
    if (isPageVisible && !prevVisibleRef.current) {
      // Immediate catch-up for messages missed while hidden
      catchUpDone.current = false
      setCatchUpTrigger(t => t + 1)

      // Safety-net catch-up: only fires if the immediate catch-up
      // hasn't already delivered messages (covers slow reconnects
      // on mobile Safari where tabs are aggressively suspended)
      const timer = setTimeout(() => {
        if (!catchUpDone.current) {
          catchUpDone.current = false
          setCatchUpTrigger(t => t + 1)
        }
      }, 2000)

      prevVisibleRef.current = isPageVisible
      return () => clearTimeout(timer)
    }
    prevVisibleRef.current = isPageVisible
  }, [isPageVisible])

  // Re-trigger catch-up after backup restore (backup may have established sessions
  // needed for decryption, and new messages may have arrived since the backup)
  useEffect(() => {
    const onBackupRestored = () => {
      catchUpDone.current = false
      setCatchUpTrigger(t => t + 1)
    }
    window.addEventListener('backup-restored', onBackupRestored)
    return () => window.removeEventListener('backup-restored', onBackupRestored)
  }, [])

  // Offline catch-up: fetch unread messages on mount (filtered by device)
  // Gated on localDeviceId to prevent unfiltered queries
  useEffect(() => {
    if (!isAuthenticated || !userId || !localDeviceId || catchUpDone.current) return

    ;(async () => {
      const result = await fetchUnreadMessages(userId, localDeviceId)
      if (!result.ok) {
        logger.warn('Offline catch-up failed:', result.error)
        return
      }

      // Mark done only after a successful fetch so transient failures retry
      catchUpDone.current = true

      logger.info(`Catch-up: ${result.data.length} unread messages`)

      // Collect processed row IDs so we can mark them as read on the server
      // afterwards, preventing the same rows from being re-fetched on the
      // next catch-up (especially sync rows which are never user-read).
      const processedRowIds: string[] = []

      // Decrypt sequentially to preserve ratchet state ordering
      for (const row of result.data) {
        if (processedIds.current.has(row.id)) continue
        trackProcessed(row.id)
        const decrypted = await decryptRow(row, userId)
        if (decrypted) {
          processedRowIds.push(row.id)
          if (decrypted.messageType === 'delete') {
            try {
              const { originIds } = JSON.parse(decrypted.plaintext) as { originIds: string[] }
              await deleteMessagesByOriginIdFromDb(originIds).catch(e => errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useSignalMessages.catchUp', message: 'Failed to delete messages from local DB', timestamp: Date.now(), metadata: { error: e } }))
              onDeleteRef.current?.(originIds)
              hardDeleteByOriginId(originIds).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.catchUp', message: 'Failed to hard-delete origin messages from server', timestamp: Date.now(), metadata: { error: e } }))
              await hardDeleteMessages([decrypted.id]).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.catchUp', message: 'Failed to hard-delete processed message from server', timestamp: Date.now(), metadata: { error: e } }))
              if (userIdRef.current) scheduleBackup(userIdRef.current)
            } catch { /* ignore parse errors */ }
          } else {
            onMessageRef.current(decrypted)
            const isUserMessage =
              decrypted.messageType === 'message' ||
              decrypted.messageType === 'initial' ||
              decrypted.messageType === 'request'
            const isFromOther = decrypted.senderId !== userId
            const isConversationContent =
              isUserMessage && isFromOther &&
              !decrypted._deliveryReceipt &&
              !isCalendarEvent(decrypted.content)
            if (
              isConversationContent &&
              !decrypted.plaintext.includes('"__type":"delivery-receipt"') &&
              userIdRef.current &&
              localDeviceId
            ) {
              sendDeliveryReceipt(
                decrypted.senderId,
                row.sender_device_id ?? 'unknown',
                [row.id],
                userIdRef.current,
                localDeviceId,
              ).catch(() => {})
            }
          }
        }
      }

      // Mark all processed rows as read so they aren't re-fetched
      if (processedRowIds.length > 0) {
        markMessagesRead(processedRowIds).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.catchUp', message: 'Failed to mark catch-up messages as read', timestamp: Date.now(), metadata: { error: e } }))
      }

      // Pruning handled by trackProcessed()
    })()
  }, [isAuthenticated, userId, localDeviceId, catchUpTrigger])

  // LoRa push subscription — process messages arriving via LoRa mesh
  useEffect(() => {
    if (!LORA_MESH_ENABLED || !isAuthenticated || !userId) return

    const unsub = onLoRaMessage((row) => {
      // Multi-device filter (same as Supabase realtime handler)
      const myDeviceId = localDeviceIdRef.current
      const myUuid = userIdRef.current
      if (!myUuid) return
      if (myDeviceId && row.recipient_device_id && row.recipient_device_id !== myDeviceId) {
        return
      }

      if (processedIds.current.has(row.id)) return
      trackProcessed(row.id)

      decryptRow(row, myUuid).then((decrypted) => {
        if (!decrypted) return
        if (decrypted.messageType === 'delete') {
          try {
            const { originIds } = JSON.parse(decrypted.plaintext) as { originIds: string[] }
            deleteMessagesByOriginIdFromDb(originIds).catch(e => errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useSignalMessages.loRa', message: 'Failed to delete messages from local DB', timestamp: Date.now(), metadata: { error: e } }))
            onDeleteRef.current?.(originIds)
            hardDeleteByOriginId(originIds).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.loRa', message: 'Failed to hard-delete origin messages from server', timestamp: Date.now(), metadata: { error: e } }))
            hardDeleteMessages([decrypted.id]).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.loRa', message: 'Failed to hard-delete processed message from server', timestamp: Date.now(), metadata: { error: e } }))
            if (userIdRef.current) scheduleBackup(userIdRef.current)
          } catch { /* ignore parse errors */ }
          return
        }
        const isUserMessage =
          decrypted.messageType === 'message' ||
          decrypted.messageType === 'initial' ||
          decrypted.messageType === 'request'
        const isFromOther = decrypted.senderId !== myUuid
        const isConversationContent =
          isUserMessage && isFromOther &&
          !decrypted._deliveryReceipt &&
          !isCalendarEvent(decrypted.content)

        if (!isConversationContent) {
          markMessagesRead([row.id]).catch(() => {})
        }

        onMessageRef.current(decrypted)

        if (isConversationContent && !decrypted.plaintext.includes('"__type":"delivery-receipt"') && myUuid && myDeviceId) {
          sendDeliveryReceipt(
            decrypted.senderId,
            row.sender_device_id ?? 'unknown',
            [row.id],
            myUuid,
            myDeviceId,
          ).catch(() => {})
        }
      })
    })

    return unsub
  }, [isAuthenticated, userId])

  // Handle realtime INSERT events — filter by recipient_device_id
  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<SignalMessageRow>) => {
      if (payload.eventType !== 'INSERT') return

      const row = payload.new as SignalMessageRow
      logger.debug(`Realtime INSERT: ${row.id} (type=${row.message_type})`)

      // Multi-device filter: skip messages not targeted at this device
      // Allow null recipient_device_id for legacy messages
      const myDeviceId = localDeviceIdRef.current
      const myUuid = userIdRef.current
      if (!myUuid) return
      if (myDeviceId && row.recipient_device_id && row.recipient_device_id !== myDeviceId) {
        logger.debug(`Skipping message ${row.id}: for device ${row.recipient_device_id}, not ${myDeviceId}`)
        return
      }

      if (processedIds.current.has(row.id)) {
        logger.debug(`Skipping duplicate message ${row.id}`)
        return
      }
      trackProcessed(row.id)

      decryptRow(row, myUuid).then((decrypted) => {
        if (!decrypted) return
        if (decrypted.messageType === 'delete') {
          try {
            const { originIds } = JSON.parse(decrypted.plaintext) as { originIds: string[] }
            deleteMessagesByOriginIdFromDb(originIds).catch(e => errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useSignalMessages.realtime', message: 'Failed to delete messages from local DB', timestamp: Date.now(), metadata: { error: e } }))
            onDeleteRef.current?.(originIds)
            hardDeleteByOriginId(originIds).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.realtime', message: 'Failed to hard-delete origin messages from server', timestamp: Date.now(), metadata: { error: e } }))
            hardDeleteMessages([decrypted.id]).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.realtime', message: 'Failed to hard-delete processed message from server', timestamp: Date.now(), metadata: { error: e } }))
            if (userIdRef.current) scheduleBackup(userIdRef.current)
          } catch { /* ignore parse errors */ }
          return
        }
        // Determine if this is a user-visible message from another person (the only
        // kind that should remain unread until the user opens the conversation).
        const isUserMessage =
          decrypted.messageType === 'message' ||
          decrypted.messageType === 'initial' ||
          decrypted.messageType === 'request'
        const isFromOther = decrypted.senderId !== myUuid
        const isConversationContent =
          isUserMessage && isFromOther &&
          !decrypted._deliveryReceipt &&
          !isCalendarEvent(decrypted.content)

        // Mark all non-conversation rows as read so the cron cleanup can purge them.
        // User messages are marked read later when the conversation is opened.
        if (!isConversationContent) {
          markMessagesRead([row.id]).catch(() => {})
        }

        onMessageRef.current(decrypted)

        // Send delivery receipt only for user-visible messages from others
        if (isConversationContent && !decrypted.plaintext.includes('"__type":"delivery-receipt"') && myUuid && myDeviceId) {
          sendDeliveryReceipt(
            decrypted.senderId,
            row.sender_device_id ?? 'unknown',
            [row.id],
            myUuid,
            myDeviceId,
          ).catch(() => {})
        }
      })
    },
    [],
  )

  const postgresFilter = useMemo(
    () => ({
      table: 'signal_messages',
      filter: `recipient_id=eq.${userId}`,
    }),
    [userId],
  )

  useSupabaseSubscription<SignalMessageRow>({
    shouldSubscribe: isAuthenticated && !!userId && isPageVisible,
    channelName: `signal-messages:${userId}`,
    postgresFilter,
    onPayload: handlePayload,
    logger,
  })
}
