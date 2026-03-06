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
import { fetchUnreadMessages, deleteMessages as hardDeleteMessages, hardDeleteByOriginId, onLoRaMessage } from '../lib/signal/signalService'
import { deleteMessages as deleteMessagesFromDb } from '../lib/signal/messageStore'
import { LORA_MESH_ENABLED } from '../lib/featureFlags'
import { processIncomingMessage } from '../lib/signal/session'
import type { SealedEnvelope } from '../lib/signal/sealedSender'
import type { SignalMessageRow, DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { SyncMessagePayload } from '../lib/signal/transportTypes'
import { parseMessageContent } from '../lib/signal/messageContent'

const logger = createLogger('RealtimeSignal')

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

    // Sync messages: sealed envelope containing a SyncMessagePayload
    if (row.message_type === 'sync') {
      const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
        senderDeviceId, envelope, myUuid
      )
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

    // Initial and message types: both go through processIncomingMessage
    const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
      senderDeviceId, envelope, myUuid
    )

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

  // Counter to trigger catch-up re-run when visibility restores
  const [catchUpTrigger, setCatchUpTrigger] = useState(0)

  // Reset catch-up when page visibility restores (messages may have been missed while hidden)
  const prevVisibleRef = useRef(isPageVisible)
  useEffect(() => {
    if (isPageVisible && !prevVisibleRef.current) {
      catchUpDone.current = false
      setCatchUpTrigger(t => t + 1)
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

      // Decrypt sequentially to preserve ratchet state ordering
      for (const row of result.data) {
        const decrypted = await decryptRow(row, userId)
        if (decrypted) {
          if (decrypted.messageType === 'delete') {
            try {
              const { originIds } = JSON.parse(decrypted.plaintext) as { originIds: string[] }
              await deleteMessagesFromDb(originIds).catch(() => {})
              onDeleteRef.current?.(originIds)
              hardDeleteByOriginId(originIds).catch(() => {})
              await hardDeleteMessages([decrypted.id]).catch(() => {})
            } catch { /* ignore parse errors */ }
          } else {
            onMessageRef.current(decrypted)
          }
        }
      }
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

      decryptRow(row, myUuid).then((decrypted) => {
        if (!decrypted) return
        if (decrypted.messageType === 'delete') {
          try {
            const { originIds } = JSON.parse(decrypted.plaintext) as { originIds: string[] }
            deleteMessagesFromDb(originIds).catch(() => {})
            onDeleteRef.current?.(originIds)
            hardDeleteByOriginId(originIds).catch(() => {})
            hardDeleteMessages([decrypted.id]).catch(() => {})
          } catch { /* ignore parse errors */ }
          return
        }
        onMessageRef.current(decrypted)
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

      decryptRow(row, myUuid).then((decrypted) => {
        if (!decrypted) return
        if (decrypted.messageType === 'delete') {
          try {
            const { originIds } = JSON.parse(decrypted.plaintext) as { originIds: string[] }
            deleteMessagesFromDb(originIds).catch(() => {})
            onDeleteRef.current?.(originIds)
            hardDeleteByOriginId(originIds).catch(() => {})
            hardDeleteMessages([decrypted.id]).catch(() => {})
          } catch { /* ignore parse errors */ }
          return
        }
        onMessageRef.current(decrypted)
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
