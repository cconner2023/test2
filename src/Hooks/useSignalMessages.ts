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
import { fetchUnreadMessages } from '../lib/signal/signalService'
import { receiveInitialMessage, decryptMessage } from '../lib/signal/session'
import type { SignalMessageRow, DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { InitialMessage, EncryptedMessage } from '../lib/signal/types'
import { parseMessageContent } from '../lib/signal/messageContent'

const logger = createLogger('RealtimeSignal')

interface UseSignalMessagesOptions {
  userId: string | null
  localDeviceId: string | null
  isAuthenticated: boolean
  isPageVisible: boolean
  onMessage: (message: DecryptedSignalMessage) => void
}

async function decryptRow(row: SignalMessageRow): Promise<DecryptedSignalMessage | null> {
  try {
    // Requests are encrypted via X3DH (InitialMessage) — decrypt + establish session
    if (row.message_type === 'request') {
      const senderDeviceId = row.sender_device_id ?? 'unknown'
      const payload = row.payload as unknown as InitialMessage
      const rawPlaintext = await receiveInitialMessage(row.sender_id, senderDeviceId, payload)
      const { plaintext, content } = parseMessageContent(rawPlaintext)
      return {
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        plaintext,
        content,
        messageType: row.message_type,
        createdAt: row.created_at,
        readAt: row.read_at,
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
    const { plaintext, content } = parseMessageContent(rawPlaintext)

    return {
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      plaintext,
      content,
      messageType: row.message_type,
      createdAt: row.created_at,
      readAt: row.read_at,
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
}: UseSignalMessagesOptions): void {
  const onMessageRef = useRef(onMessage)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const localDeviceIdRef = useRef(localDeviceId)
  useEffect(() => {
    localDeviceIdRef.current = localDeviceId
  }, [localDeviceId])

  // Track whether catch-up has already run to avoid re-fetching on re-subscribe
  const catchUpDone = useRef(false)

  // Offline catch-up: fetch unread messages on mount (filtered by device)
  useEffect(() => {
    if (!isAuthenticated || !userId || catchUpDone.current) return
    catchUpDone.current = true

    ;(async () => {
      const result = await fetchUnreadMessages(userId, localDeviceIdRef.current ?? undefined)
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
