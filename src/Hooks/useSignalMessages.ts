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
import { processClinicIncomingMessage } from '../lib/signal/clinicSession'
import { drainSystemInbox, SYSTEM_USER_ID } from '../lib/signal/systemIdentity'
import { processSenderKeyDistribution, senderKeyDecrypt } from '../lib/signal/senderKey'
import { useMessagingStore } from '../stores/useMessagingStore'
import type { SealedEnvelope } from '../lib/signal/sealedSender'
import type { SignalMessageRow, DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { SyncMessagePayload } from '../lib/signal/transportTypes'
import type { SenderKeyMessage, SenderKeyDistribution } from '../lib/signal/types'
import { parseMessageContent } from '../lib/signal/messageContent'
import type { OutsideSessionContent, OutsideSessionUpdate } from '../lib/signal/messageContent'
import { emitCallSignal, type CallSignalBody } from '../lib/webrtc/callSignalBus'
import { emitOncallRing } from '../lib/webrtc/oncallSignalBus'
import { emitOutsideCallSignal } from '../lib/webrtc/outsideSessionCallBus'
import { isCalendarEvent, routeCalendarEvent } from '../lib/calendarRouting'
import { isMapOverlay, isMapFeature, routeMapOverlay, routeMapFeature } from '../lib/mapOverlayRouting'
import { errorBus } from '../lib/errorBus'
import { ErrorCode } from '../lib/errorCodes'

const logger = createLogger('RealtimeSignal')

// Minimum gap between 'online'-triggered catch-ups. A flapping connection fires
// discrete online events per flap; without this a bad link could spam the
// unread-delta fetch. Visibility/backup triggers stay unthrottled (user-paced).
const ONLINE_CATCHUP_THROTTLE_MS = 15_000

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
  clinicId: string | null
  clinicDeviceId: string | null
  /** Dev-only: subscribe to SYSTEM-recipient rows and kick `drainSystemInbox`. */
  isDevRole: boolean
  isAuthenticated: boolean
  isPageVisible: boolean
  onMessage: (message: DecryptedSignalMessage) => void
  onDelete?: (messageIds: string[]) => void
}

async function decryptRow(row: SignalMessageRow, myUuid: string): Promise<DecryptedSignalMessage | null> {
  try {
    // ─── Plaintext early-exit: SYSTEM-authored control messages ─────
    // Event-intake REQUESTS are now real per-device SealedEnvelopes authored by
    // the intake edge function (sender_device_id='edge'), so they have NO `kind`
    // field and fall through to processIncomingMessage like any group message.
    // Only the intake-DELETE control message stays plaintext (no session, just an
    // origin-id list), so it still needs this short-circuit.
    if (row.message_type === 'system') {
      const maybeIntake = row.payload as Record<string, unknown> | null
      // intake_action RPC fans out plaintext SYSTEM-authored delete envelopes
      // for the original intake-request fanout. Surface as a standard 'delete'
      // typed message so the existing onDelete pipeline strips local state by
      // origin_ids. No signal session involved — payload is plaintext.
      if (maybeIntake && maybeIntake.kind === 'intake-delete') {
        const rawOrigins = Array.isArray(maybeIntake.origin_ids) ? maybeIntake.origin_ids : []
        const originIds = rawOrigins.filter((x): x is string => typeof x === 'string')
        return {
          id: row.id,
          senderId: SYSTEM_USER_ID,
          recipientId: row.recipient_id,
          plaintext: JSON.stringify({ originIds }),
          messageType: 'delete' as const,
          createdAt: row.created_at,
          readAt: row.read_at,
        }
      }

      // ── Outside→on-call (SYSTEM-authored plaintext, anon-gated RPC fanout) ──
      // The LIVE ring rides the oncall signal bus (like call-signal), never a
      // chat card. request_oncall fans oncall-ring; accept_oncall fans
      // oncall-ring-cancel. Surface to the call layer and return null.
      if (maybeIntake && maybeIntake.kind === 'oncall-ring') {
        try {
          emitOncallRing({
            kind: 'ring',
            callId: String(maybeIntake.call_id),
            clinicId: String(maybeIntake.clinic_id),
            requesterName: String(maybeIntake.requester_name ?? ''),
            sdpOffer: maybeIntake.sdp_offer as RTCSessionDescriptionInit,
          })
        } catch (e) {
          logger.warn(`Failed to route oncall-ring ${row.id}:`, e instanceof Error ? e.message : e)
        }
        return null
      }
      if (maybeIntake && maybeIntake.kind === 'oncall-ring-cancel') {
        emitOncallRing({ kind: 'cancel', callId: String(maybeIntake.call_id) })
        return null
      }

      // ── Outside-session reply lane (SYSTEM-authored plaintext fanout) ──
      // open  → a durable OutsideSessionContent card (rendered in the on-call group).
      // close → an OutsideSessionUpdate(status:ended) folded onto that card.
      // reply-sent → an OutsideSessionUpdate(reply) appended to that card's history.
      // close/reply-sent NEVER render as their own bubble (folded like reactions).
      if (maybeIntake && maybeIntake.kind === 'outside-session-open') {
        return {
          id: row.id,
          senderId: SYSTEM_USER_ID,
          recipientId: row.recipient_id,
          plaintext: 'Outside session',
          content: {
            type: 'outside_session',
            session_id: String(maybeIntake.session_id),
            clinic_id: String(maybeIntake.clinic_id ?? ''),
            requester_name: String(maybeIntake.requester_name ?? ''),
            outside_pub: String(maybeIntake.outside_pub ?? ''),
            opened_at: String(maybeIntake.opened_at ?? row.created_at),
            status: 'active',
          } satisfies OutsideSessionContent,
          messageType: 'message' as const,
          createdAt: row.created_at,
          readAt: row.read_at,
          ...(row.group_id && { groupId: row.group_id }),
          originId: row.origin_id ?? undefined,
        }
      }
      if (maybeIntake && maybeIntake.kind === 'outside-session-close') {
        return {
          id: row.id,
          senderId: SYSTEM_USER_ID,
          recipientId: row.recipient_id,
          plaintext: 'Outside session ended',
          content: {
            type: 'outside_session_update',
            session_id: String(maybeIntake.session_id),
            status: 'ended',
            ...(maybeIntake.reason ? { closed_reason: String(maybeIntake.reason) } : {}),
            ...(maybeIntake.closed_at ? { closed_at: String(maybeIntake.closed_at) } : {}),
          } satisfies OutsideSessionUpdate,
          messageType: 'message' as const,
          createdAt: row.created_at,
          readAt: row.read_at,
          ...(row.group_id && { groupId: row.group_id }),
          originId: row.origin_id ?? undefined,
        }
      }
      if (maybeIntake && maybeIntake.kind === 'outside-session-reply-sent') {
        return {
          id: row.id,
          senderId: SYSTEM_USER_ID,
          recipientId: row.recipient_id,
          plaintext: String(maybeIntake.text ?? 'Reply'),
          content: {
            type: 'outside_session_update',
            session_id: String(maybeIntake.session_id),
            reply: {
              reply_id: String(maybeIntake.reply_id),
              from_name: String(maybeIntake.from_name ?? ''),
              text: String(maybeIntake.text ?? ''),
              created_at: String(maybeIntake.created_at ?? row.created_at),
            },
          } satisfies OutsideSessionUpdate,
          messageType: 'message' as const,
          createdAt: row.created_at,
          readAt: row.read_at,
          ...(row.group_id && { groupId: row.group_id }),
          originId: row.origin_id ?? undefined,
        }
      }
      // Ring-back signaling FROM the outside tab to the initiating medic
      // (answer / decline / hangup). Routes to the call overlay via the bus;
      // never a chat row. Non-trickle, so 'answer' carries the full SDP.
      if (maybeIntake && typeof maybeIntake.kind === 'string'
          && (maybeIntake.kind as string).startsWith('outside-session-call-')) {
        const k = (maybeIntake.kind as string).slice('outside-session-call-'.length)
        try {
          const callId = String(maybeIntake.call_id)
          const sessionId = String(maybeIntake.session_id)
          if (k === 'answer') {
            emitOutsideCallSignal({ kind: 'answer', callId, sessionId, sdp: maybeIntake.sdp as RTCSessionDescriptionInit })
          } else if (k === 'decline') {
            emitOutsideCallSignal({ kind: 'decline', callId, sessionId })
          } else if (k === 'hangup') {
            emitOutsideCallSignal({ kind: 'hangup', callId, sessionId })
          }
        } catch (e) {
          logger.warn(`Failed to route outside-session call signal ${row.id}:`, e instanceof Error ? e.message : e)
        }
        return null
      }
      // NOTE: the resolved CALL card and outside→cluster MESSAGES are no longer
      // plaintext kind rows. They are authored by the oncall-resolve /
      // outside-message-submit edge fns as real per-device Signal envelopes
      // (sender_device_id='edge', no `kind`), so they fall through to
      // processIncomingMessage → parseMessageContent (t:'oc' / t:'om') like any
      // group message. The seal-to-clinic-key voicemail subsystem (oncall-key-wrap)
      // is retired — the AES key now rides the envelope. Only the LIVE ring stays a
      // plaintext kind row (real-time WebRTC signaling, handled above).
    }

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

    // Sender key distribution: arrives via pairwise 1:1 session (Double Ratchet encrypted).
    // Decrypt through the session, then store the distribution for future group decryption.
    if (row.message_type === 'sender-key-distribution') {
      const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
        senderDeviceId, envelope, myUuid
      )
      try {
        const dist = JSON.parse(rawPlaintext) as SenderKeyDistribution
        const groupId = dist.groupId ?? row.group_id ?? ''
        // Fetch actual group members for membership verification.
        // Fallback to authenticated sender if offline/unavailable (distribution
        // already arrived via authenticated Double Ratchet session).
        let memberIds: string[] = [senderUuid]
        try {
          const { fetchGroupMembers } = await import('../lib/signal/groupService')
          const result = await fetchGroupMembers(groupId)
          if (result.ok && result.data.length > 0) {
            memberIds = result.data.map(m => m.userId)
          }
        } catch {
          logger.debug(`Offline or failed to fetch members for group ${groupId}, trusting authenticated sender`)
        }
        await processSenderKeyDistribution(dist, memberIds)
        logger.debug(`Stored sender key distribution from ${senderUuid} for group ${groupId}`)
      } catch (e) {
        logger.warn(`Failed to process sender-key-distribution from ${senderUuid}:`, e instanceof Error ? e.message : e)
      }
      // Do not surface as a user-visible message
      return null
    }

    // Call signaling: WebRTC offer/answer/ICE/hangup/decline ride the pairwise
    // session as control-plane (mirrors sender-key-distribution). Decrypt, route
    // to the call layer via the bus, and never surface as a chat message.
    if (row.message_type === 'call-signal') {
      try {
        const { plaintext: rawPlaintext, senderUuid } = await processIncomingMessage(
          senderDeviceId, envelope, myUuid
        )
        const body = JSON.parse(rawPlaintext) as CallSignalBody
        emitCallSignal({ ...body, senderId: senderUuid })
      } catch (e) {
        logger.warn(`Failed to process call-signal ${row.id}:`, e instanceof Error ? e.message : e)
      }
      // Never user-visible.
      return null
    }

    // Legacy clinic-vault messages (V1 symmetric encryption) — skip, handled elsewhere.
    if (row.message_type === 'clinic-vault') {
      return null
    }

    // Sender key message: payload IS the SenderKeyMessage JSON — NOT pairwise encrypted.
    // Parse and decrypt with senderKeyDecrypt.
    if (row.message_type === 'sender-key-message') {
      try {
        const senderKeyMsg = row.payload as unknown as SenderKeyMessage
        const rawPlaintext = await senderKeyDecrypt(senderKeyMsg)
        const { plaintext, content, replyTo } = parseMessageContent(rawPlaintext)
        return {
          id: row.id,
          senderId: senderKeyMsg.senderId,
          recipientId: row.recipient_id,
          plaintext,
          content,
          messageType: 'message' as const,
          createdAt: row.created_at,
          readAt: row.read_at,
          ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
          ...(row.group_id && { groupId: row.group_id }),
          originId: row.origin_id ?? undefined,
        }
      } catch (e) {
        logger.error(`Failed to decrypt sender-key-message ${row.id}:`, e instanceof Error ? e.message : e)
        errorBus.emit({
          code: ErrorCode.DECRYPT_FAILED,
          source: 'decryptRow:sender-key-message',
          message: 'A group message could not be decrypted. Sender key may need redistribution.',
          timestamp: Date.now(),
          metadata: { messageId: row.id, groupId: row.group_id },
        })
        return null
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
  clinicId,
  clinicDeviceId,
  isDevRole,
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

  const clinicIdRef = useRef(clinicId)
  useEffect(() => {
    clinicIdRef.current = clinicId
  }, [clinicId])

  const clinicDeviceIdRef = useRef(clinicDeviceId)
  useEffect(() => {
    clinicDeviceIdRef.current = clinicDeviceId
  }, [clinicDeviceId])

  // Track whether catch-up has already run to avoid re-fetching on re-subscribe
  const catchUpDone = useRef(false)
  // Separate completion flag for the clinic-device catch-up. It must NOT share
  // catchUpDone with the personal catch-up: the personal effect flips that flag
  // true on success, which would starve the clinic catch-up (the path that
  // consumes missed 'd' prune rows by clinic device id) if it runs afterward.
  const clinicCatchUpDone = useRef(false)
  // Throttle clock for the 'online' re-trigger (see ONLINE_CATCHUP_THROTTLE_MS).
  const lastOnlineCatchUpAt = useRef(0)

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
      clinicCatchUpDone.current = false
      setCatchUpTrigger(t => t + 1)

      // Safety-net catch-up: only fires if the immediate catch-up
      // hasn't already delivered messages (covers slow reconnects
      // on mobile Safari where tabs are aggressively suspended)
      const timer = setTimeout(() => {
        if (!catchUpDone.current) {
          catchUpDone.current = false
          clinicCatchUpDone.current = false
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
      clinicCatchUpDone.current = false
      setCatchUpTrigger(t => t + 1)
    }
    window.addEventListener('backup-restored', onBackupRestored)
    return () => window.removeEventListener('backup-restored', onBackupRestored)
  }, [])

  // Re-trigger catch-up on network reconnect. A long-lived, continuously-
  // foregrounded session fires no visibilitychange, so without this it never
  // re-drains its per-device inbox after a blip — a 'd' that arrived while
  // offline is never consumed and the deleted event resurrects in the local
  // cache. fetchUnread pulls only the unread delta (read_at IS NULL, within
  // horizon) and processed rows are marked read, so this re-fetches just what
  // actually arrived offline (egress-bounded). Throttled against link flap.
  useEffect(() => {
    const onOnline = () => {
      const now = Date.now()
      if (now - lastOnlineCatchUpAt.current < ONLINE_CATCHUP_THROTTLE_MS) return
      lastOnlineCatchUpAt.current = now
      catchUpDone.current = false
      clinicCatchUpDone.current = false
      setCatchUpTrigger(t => t + 1)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
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
        // Null return means non-visible (sender-key-distribution) or decrypt failure.
        // Only mark-read for non-recoverable types — leave handshake/session failures
        // unread so the next session's catch-up retries after pre-keys replenish,
        // sessions restore from backup, etc. Without this, a transient X3DH failure
        // (e.g. recipient on a fresh provisional tab) permanently loses the row,
        // which is exactly how request-accepted disappears and the gate sticks.
        if (!decrypted) {
          if (row.message_type === 'sender-key-distribution' || row.message_type === 'call-signal') {
            processedRowIds.push(row.id)
          }
          continue
        }
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
            !isCalendarEvent(decrypted.content) &&
            !isMapOverlay(decrypted.content) &&
            !isMapFeature(decrypted.content)
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

      // Mark all processed rows as read so they aren't re-fetched
      if (processedRowIds.length > 0) {
        markMessagesRead(processedRowIds).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.catchUp', message: 'Failed to mark catch-up messages as read', timestamp: Date.now(), metadata: { error: e } }))
      }

      // Pruning handled by trackProcessed()
    })()
  }, [isAuthenticated, userId, localDeviceId, catchUpTrigger])

  // Clinic device offline catch-up: fetch unread messages for this clinic device
  useEffect(() => {
    if (!isAuthenticated || !userId || !clinicId || !clinicDeviceId || clinicCatchUpDone.current) return

    ;(async () => {
      const result = await fetchUnreadMessages(clinicId, clinicDeviceId)
      if (!result.ok) {
        logger.warn('Clinic catch-up failed:', result.error)
        return
      }

      // Mark done only after a successful fetch so transient failures retry.
      clinicCatchUpDone.current = true

      logger.info(`Clinic catch-up: ${result.data.length} unread messages`)

      const processedRowIds: string[] = []

      for (const row of result.data) {
        if (processedIds.current.has(row.id)) continue
        trackProcessed(row.id)
        try {
          const envelope = row.payload as unknown as import('../lib/signal/sealedSender').SealedEnvelope
          const senderDeviceId = row.sender_device_id ?? 'unknown'
          const { plaintext: rawPlaintext } = await processClinicIncomingMessage(
            senderDeviceId, envelope, clinicId
          )
          processedRowIds.push(row.id)
          const { plaintext, content } = parseMessageContent(rawPlaintext)
          if (isCalendarEvent(content)) {
            routeCalendarEvent(content)
          } else if (isMapOverlay(content)) {
            // Serial await — overlay/feature routes share a single IDB row under RMW.
            await routeMapOverlay(content).catch(() => {})
          } else if (isMapFeature(content)) {
            await routeMapFeature(content).catch(() => {})
          }
        } catch (e) {
          logger.warn(`Failed to decrypt clinic message ${row.id}:`, e instanceof Error ? e.message : e)
        }
      }

      if (processedRowIds.length > 0) {
        markMessagesRead(processedRowIds).catch(() => {})
      }
    })()
  }, [isAuthenticated, userId, clinicId, clinicDeviceId, catchUpTrigger])

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
        if (!decrypted) {
          if (row.message_type === 'sender-key-distribution' || row.message_type === 'call-signal') {
            markMessagesRead([row.id]).catch(() => {})
          }
          return
        }
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
          !isCalendarEvent(decrypted.content) &&
          !isMapOverlay(decrypted.content) &&
          !isMapFeature(decrypted.content)

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
        if (!decrypted) {
          // Null means non-visible (sender-key-distribution) or decrypt failure.
          // Only mark-read for non-recoverable types — handshake/session failures
          // stay unread so catch-up retries on the next session (after sessions
          // restore from backup, pre-keys replenish, etc.). Marking them read here
          // is how request-accepted rows on fresh-X3DH paths disappear permanently.
          if (row.message_type === 'sender-key-distribution' || row.message_type === 'call-signal') {
            markMessagesRead([row.id]).catch(() => {})
          }
          return
        }
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
          !isCalendarEvent(decrypted.content) &&
          !isMapOverlay(decrypted.content) &&
          !isMapFeature(decrypted.content)

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
      // INSERT-only: handler discards non-inserts, and '*' would re-broadcast
      // the full encrypted payload over realtime on every markRead UPDATE.
      event: 'INSERT' as const,
    }),
    [userId],
  )

  // Handle clinic realtime INSERT events
  const handleClinicPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<SignalMessageRow>) => {
      if (payload.eventType !== 'INSERT') return

      const row = payload.new as SignalMessageRow
      const myClinicDeviceId = clinicDeviceIdRef.current
      const myClinicId = clinicIdRef.current
      if (!myClinicId || !myClinicDeviceId) return

      // Only process messages for this clinic device
      if (row.recipient_device_id && row.recipient_device_id !== myClinicDeviceId) return

      if (processedIds.current.has(row.id)) return
      trackProcessed(row.id)

      ;(async () => {
        try {
          const envelope = row.payload as unknown as SealedEnvelope
          const senderDeviceId = row.sender_device_id ?? 'unknown'
          const { plaintext: rawPlaintext } = await processClinicIncomingMessage(
            senderDeviceId, envelope, myClinicId
          )
          const { content } = parseMessageContent(rawPlaintext)
          if (isCalendarEvent(content)) {
            routeCalendarEvent(content)
          } else if (isMapOverlay(content)) {
            // Serial await — overlay/feature routes share a single IDB row under RMW.
            await routeMapOverlay(content).catch(() => {})
          } else if (isMapFeature(content)) {
            await routeMapFeature(content).catch(() => {})
          }
          markMessagesRead([row.id]).catch(() => {})
        } catch (e) {
          logger.warn(`Failed to decrypt clinic realtime message ${row.id}:`, e instanceof Error ? e.message : e)
        }
      })()
    },
    [],
  )

  const clinicPostgresFilter = useMemo(
    () => ({
      table: 'signal_messages',
      filter: `recipient_id=eq.${clinicId}`,
      event: 'INSERT' as const,
    }),
    [clinicId],
  )

  useSupabaseSubscription<SignalMessageRow>({
    shouldSubscribe: isAuthenticated && !!clinicId && !!clinicDeviceId && isPageVisible,
    channelName: `clinic-signal:${clinicId}`,
    postgresFilter: clinicPostgresFilter,
    onPayload: handleClinicPayload,
    logger,
  })

  useSupabaseSubscription<SignalMessageRow>({
    shouldSubscribe: isAuthenticated && !!userId && isPageVisible,
    channelName: `signal-messages:${userId}`,
    postgresFilter,
    onPayload: handlePayload,
    logger,
  })

  // ── Dev-only: SYSTEM-recipient realtime channel ──────────────────────────
  //
  // 20260522f_system_first_class_entity added SELECT RLS so devs can observe
  // recipient_id=SYSTEM rows; this hook is the client-side complement.
  // Without it, user replies sit in the DB until something polls
  // drainSystemInbox (sign-in, AdminDrawer mount, AdminUserDetail mount).
  // Realtime closes that gap: every new SYSTEM-recipient row pokes the drain
  // (single-flight inside drainSystemInbox), which decrypts + adds to the
  // messaging store + fires onSystemMessage listeners (MessagesContext picks
  // those up and renders the standard toast).

  const handleSystemPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<SignalMessageRow>) => {
      if (payload.eventType !== 'INSERT') return
      // drainSystemInbox is self-coalescing — rapid inserts collapse into a
      // single drain pass that picks up every new row past the cursor.
      drainSystemInbox().catch(e =>
        logger.warn('system realtime drain failed:', e instanceof Error ? e.message : e),
      )
    },
    [],
  )

  const systemPostgresFilter = useMemo(
    () => ({
      table: 'signal_messages',
      filter: `recipient_id=eq.${SYSTEM_USER_ID}`,
      event: 'INSERT' as const,
    }),
    [],
  )

  useSupabaseSubscription<SignalMessageRow>({
    shouldSubscribe: isAuthenticated && isDevRole && isPageVisible,
    channelName: `signal-system:${userId ?? 'anon'}`,
    postgresFilter: systemPostgresFilter,
    onPayload: handleSystemPayload,
    logger,
  })
}
