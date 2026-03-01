/**
 * useSignalMessages — Realtime subscription for incoming Signal Protocol messages.
 *
 * Subscribes to INSERT events on `signal_messages` filtered by recipient_id.
 * On mount: fetches unread messages for offline catch-up.
 * On realtime INSERT: decrypts via receiveInitialMessage or decryptMessage.
 *
 * Multi-device: filters messages by recipient_device_id to only process
 * messages targeted at this device (or null for legacy messages).
 *
 * Follows the same pattern as useRealtimeTrainingCompletions.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createLogger } from '../Utilities/Logger'
import { useSupabaseSubscription } from './useSupabaseSubscription'
import { fetchUnreadMessages, fetchDeletedMessages, deleteMessages as hardDeleteMessages, onLoRaMessage } from '../lib/signal/signalService'
import { deleteMessages as deleteMessagesFromDb } from '../lib/signal/messageStore'
import { LORA_MESH_ENABLED } from '../lib/featureFlags'
import { receiveInitialMessage, decryptMessage } from '../lib/signal/session'
import type { SignalMessageRow, DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { InitialMessage, EncryptedMessage } from '../lib/signal/types'
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

async function decryptRow(row: SignalMessageRow): Promise<DecryptedSignalMessage | null> {
  try {
    // Sync messages: encrypted envelope containing a SyncMessagePayload
    if (row.message_type === 'sync') {
      const senderDeviceId = row.sender_device_id ?? 'unknown'
      const payload = row.payload
      let rawPlaintext: string

      if ('identitySigningKey' in payload) {
        rawPlaintext = await receiveInitialMessage(row.sender_id, senderDeviceId, payload as unknown as InitialMessage)
      } else {
        rawPlaintext = await decryptMessage(row.sender_id, senderDeviceId, payload as unknown as EncryptedMessage)
      }

      const sync = JSON.parse(rawPlaintext) as SyncMessagePayload
      const { plaintext, content, replyTo } = parseMessageContent(sync.serialized)

      return {
        id: sync.originalMessageId,
        senderId: row.sender_id,
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

    // Self-notes: encrypted like any other message — fall through to normal decryption

    // Requests are encrypted via X3DH (InitialMessage) — decrypt + establish session
    if (row.message_type === 'request') {
      const senderDeviceId = row.sender_device_id ?? 'unknown'
      const payload = row.payload as unknown as InitialMessage
      const rawPlaintext = await receiveInitialMessage(row.sender_id, senderDeviceId, payload)
      const { plaintext, content, replyTo } = parseMessageContent(rawPlaintext)
      return {
        id: row.id,
        senderId: row.sender_id,
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
    if (row.message_type === 'request-accepted') {
      return {
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        plaintext: '',
        messageType: row.message_type,
        createdAt: row.created_at,
        readAt: row.read_at,
        ...(row.group_id && { groupId: row.group_id }),
        originId: row.origin_id ?? undefined,
      }
    }

    // Use sender_device_id for session lookup; fall back to 'unknown' for legacy
    const senderDeviceId = row.sender_device_id ?? 'unknown'
    let rawPlaintext: string

    if (row.message_type === 'initial') {
      const payload = row.payload as unknown as InitialMessage
      rawPlaintext = await receiveInitialMessage(row.sender_id, senderDeviceId, payload)
    } else {
      const payload = row.payload as unknown as EncryptedMessage
      rawPlaintext = await decryptMessage(row.sender_id, senderDeviceId, payload)
    }

    // Parse structured content (text or image) from the decrypted payload
    const { plaintext, content, replyTo } = parseMessageContent(rawPlaintext)

    return {
      id: row.id,
      senderId: row.sender_id,
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

  // Track whether catch-up has already run to avoid re-fetching on re-subscribe
  const catchUpDone = useRef(false)

  // Reset catch-up when page visibility restores (messages may have been missed while hidden)
  const prevVisibleRef = useRef(isPageVisible)
  useEffect(() => {
    if (isPageVisible && !prevVisibleRef.current) {
      catchUpDone.current = false
    }
    prevVisibleRef.current = isPageVisible
  }, [isPageVisible])

  // Offline catch-up: fetch unread messages on mount (filtered by device)
  // Gated on localDeviceId to prevent unfiltered queries
  useEffect(() => {
    if (!isAuthenticated || !userId || !localDeviceId || catchUpDone.current) return
    catchUpDone.current = true

    ;(async () => {
      const result = await fetchUnreadMessages(userId, localDeviceId)
      if (!result.ok) {
        logger.warn('Offline catch-up failed:', result.error)
        return
      }

      logger.info(`Catch-up: ${result.data.length} unread messages`)

      // Decrypt sequentially to preserve ratchet state ordering
      for (const row of result.data) {
        const decrypted = await decryptRow(row)
        if (decrypted) {
          onMessageRef.current(decrypted)
        }
      }
    })()
  }, [isAuthenticated, userId, localDeviceId])

  // Tombstone cleanup: process pending deletions on mount
  useEffect(() => {
    if (!isAuthenticated || !userId) return

    ;(async () => {
      const result = await fetchDeletedMessages(userId)
      if (!result.ok || result.data.length === 0) return

      const deletedIds = result.data.map(r => r.id)
      logger.info(`Tombstone cleanup: ${deletedIds.length} deleted messages`)

      // 1. Remove from IDB
      await deleteMessagesFromDb(deletedIds).catch(() => {})

      // 2. Remove from React state
      onDeleteRef.current?.(deletedIds)

      // 3. Hard-delete from Supabase (tombstone cleanup)
      await hardDeleteMessages(deletedIds).catch(() => {})
    })()
  }, [isAuthenticated, userId])

  // LoRa push subscription — process messages arriving via LoRa mesh
  useEffect(() => {
    if (!LORA_MESH_ENABLED || !isAuthenticated || !userId) return

    const unsub = onLoRaMessage((row) => {
      // Multi-device filter (same as Supabase realtime handler)
      const myDeviceId = localDeviceIdRef.current
      if (myDeviceId && row.recipient_device_id && row.recipient_device_id !== myDeviceId) {
        return
      }

      decryptRow(row).then((decrypted) => {
        if (decrypted) {
          onMessageRef.current(decrypted)
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
      if (myDeviceId && row.recipient_device_id && row.recipient_device_id !== myDeviceId) {
        logger.debug(`Skipping message ${row.id}: for device ${row.recipient_device_id}, not ${myDeviceId}`)
        return
      }

      decryptRow(row).then((decrypted) => {
        if (decrypted) {
          onMessageRef.current(decrypted)
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
