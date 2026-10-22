/**
 * useSignalMessages — inbound Signal Protocol pipeline.
 *
 * Realtime INSERTs are a doorbell only: the payload is ignored and a drain is
 * scheduled. Two single-flight drains are the ONLY code that fetches, decrypts,
 * applies, acks (marks read) and moves the vault cursor:
 *   - personal: the user's vault tail from this device's cursor, then the
 *     per-device unread rows (edge-authored and plaintext 'system' rows).
 *   - clinic: per-device unread rows for every clinic (home ∪ loans), acked
 *     with the clinic as recipient.
 * Lifecycle triggers (ready, visible again, online, backup restored, vault
 * unlocked, channel rejoin) run both. A failed fetch retries on a backoff while
 * the page is visible. Server read state is a transport ack, not user-read.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createLogger } from '../Utilities/Logger'
import { useSupabaseSubscription } from './useSupabaseSubscription'
import { fetchUnreadMessages, fetchVaultTail, markMessagesRead, deleteMessages as hardDeleteMessages, hardDeleteByOriginId } from '../lib/signal/signalService'
import { deleteMessagesByOriginId as deleteMessagesByOriginIdFromDb, hasMessage } from '../lib/signal/messageStore'
import { scheduleBackup, whenRestoreSettled, getRestoredVaultWatermark } from '../lib/signal/backupService'
import { processIncomingMessage, openVaultEnvelope, DuplicateMessageError } from '../lib/signal/session'
import { getVaultDecryptKeys, VaultLockedError, VaultUnavailableError, VAULT_DEVICE_ID, VAULT_UNLOCKED_EVENT } from '../lib/signal/vaultDevice'
import {
  loadVaultCursor, seedVaultCursor, currentVaultCursor, advanceVaultCursor, flushVaultCursor,
  wasVaultRowProcessed, markVaultRowProcessed, CURSOR_OVERLAP_MS,
} from '../lib/signal/vaultCursor'
import { sendToUser } from '../lib/signal/vaultSend'
import { useAuthStore } from '../stores/useAuthStore'
import { processClinicIncomingMessage } from '../lib/signal/clinicSession'
import { drainSystemInbox, SYSTEM_USER_ID } from '../lib/signal/systemIdentity'
import { getGroupSecretMeta, setGroupSecret } from '../lib/signal/groupNameCrypto'
import { emitGroupRefresh } from '../lib/signal/groupRefreshBus'
import type { SealedEnvelope } from '../lib/signal/sealedSender'
import type { SignalMessageRow, DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { SyncMessagePayload } from '../lib/signal/transportTypes'
import { parseMessageContent } from '../lib/signal/messageContent'
import type { MessageContent, OutsideSessionContent, OutsideSessionUpdate } from '../lib/signal/messageContent'
import { emitCallSignal, type CallSignalBody } from '../lib/webrtc/callSignalBus'
import { emitOncallRing } from '../lib/webrtc/oncallSignalBus'
import { emitOutsideCallSignal } from '../lib/webrtc/outsideSessionCallBus'
import { isCalendarEvent, routeCalendarEvent } from '../lib/calendarRouting'
import { isMapOverlay, isMapFeature, routeMapOverlay, routeMapFeature } from '../lib/mapOverlayRouting'
import { errorBus } from '../lib/errorBus'
import { ErrorCode } from '../lib/errorCodes'

const logger = createLogger('RealtimeSignal')

/**
 * A clinic message that can NEVER be decrypted on this device: the sender device
 * is gone (no bundle) or we never got the bootstrapping X3DH initial, so a ratchet
 * packet has no session to open — or the signed pre-key it targets was rotated
 * away. Such a row must be marked read so it drops out of the unread catch-up
 * delta; otherwise every reconnect re-fetches and re-logs it forever (the dead-
 * device "No clinic session" spam). Clinic STATE is authoritative via the clinic
 * vault snapshot, so dropping a member↔member packet loses no data.
 */
function isUnrecoverableClinicDecrypt(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e)
  return m.includes('No clinic session') ||
    m.includes('has no peerIdentityDhKey') ||
    /pre-key\b.*not found/i.test(m)
}

/** Send a delivery receipt to the original sender's vault (every one of their
 *  devices sees it). Fire-and-forget — never throws. Silent: no push wake. */
async function sendDeliveryReceipt(
  senderUuid: string,
  messageIds: string[],
  myUuid: string,
  myDeviceId: string,
  originIds?: string[],
): Promise<void> {
  try {
    const payload = JSON.stringify({
      __type: 'delivery-receipt',
      messageIds,
      ...(originIds && originIds.length > 0 && { originIds }),
      deliveredAt: new Date().toISOString(),
    })
    await sendToUser(myUuid, myDeviceId, senderUuid, payload, 'receipt', { silent: true })
  } catch {
    // Delivery receipts are best-effort — silently ignore failures
  }
}

/** Content routed out-of-band by useMessages.handleIncomingMessage — folded into
 *  other state (calendar, map, property, reactions, outside-session cards,
 *  outside-entity relays), never a chat bubble of its own. */
const OUT_OF_BAND_CONTENT_TYPES: ReadonlySet<string> = new Set<MessageContent['type']>([
  'calendar_event', 'map_overlay', 'map_feature', 'property_event', 'reaction',
  'outside_session', 'outside_session_update', 'outside_entity_reply',
])

/** A chat message from someone else — the only kind that earns a delivery receipt. */
function isConversationContent(msg: DecryptedSignalMessage, myUuid: string): boolean {
  if (msg.senderId === myUuid || msg._deliveryReceipt || msg._readSync) return false
  if (msg.messageType !== 'message' && msg.messageType !== 'initial' && msg.messageType !== 'request') return false
  return !msg.content || !OUT_OF_BAND_CONTENT_TYPES.has(msg.content.type)
}

interface UseSignalMessagesOptions {
  userId: string | null
  localDeviceId: string | null
  /** Primary/home clinic. */
  clinicId: string | null
  /** Loan (surrogate) clinics. Realtime + catch-up cover home ∪ these. */
  surrogateClinicIds: string[]
  clinicDeviceId: string | null
  /** Dev-only: subscribe to SYSTEM-recipient rows and kick `drainSystemInbox`. */
  isDevRole: boolean
  isAuthenticated: boolean
  isPageVisible: boolean
  onMessage: (message: DecryptedSignalMessage) => void
  onDelete?: (messageIds: string[]) => void
}

/**
 * Vault-first group content carries the per-group name secret alongside the
 * payload ({ __g: { s, e }, c }). Adopt the secret when its epoch is newer than
 * ours (a post-removal rotation supersedes), then return the inner payload.
 * Non-wrapped input is returned unchanged.
 */
async function unwrapGroupPayload(raw: string, groupId: string | null): Promise<string> {
  if (!groupId || !raw.startsWith('{"__g"')) return raw
  try {
    const parsed = JSON.parse(raw) as { __g?: { s?: string; e?: number }; c?: string }
    if (typeof parsed.c !== 'string') return raw
    const secret = parsed.__g?.s
    if (secret) {
      const incomingEpoch = parsed.__g?.e ?? 0
      const existing = await getGroupSecretMeta(groupId)
      if (!existing || incomingEpoch > existing.epoch) {
        await setGroupSecret(groupId, secret, incomingEpoch)
        emitGroupRefresh(groupId)
      }
    }
    return parsed.c
  } catch {
    return raw
  }
}

/** A failure caused by the link, not the row: retried without counting
 *  against the row's attempt cap, or a flaky connection would burn every
 *  attempt and skip messages that would have opened fine. */
function isTransientFailure(e: unknown): boolean {
  if (e instanceof VaultUnavailableError) return true
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return e instanceof TypeError && /fetch|load failed|network/i.test(e.message)
}

/** Call signals older than this are dropped unopened — a late offer would ring
 *  for a call that is long over (drains replay rows after resume/reconnect). */
const CALL_SIGNAL_MAX_AGE_MS = 60_000

/**
 * Decrypt one row. A null result is final (control-plane, or nothing to show);
 * onFailed fires when null means the row could not be opened, so the drain can
 * retry it. VaultLockedError and transient failures propagate.
 */
async function decryptRow(
  row: SignalMessageRow,
  myUuid: string,
  onFailed?: () => void,
): Promise<DecryptedSignalMessage | null> {
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

    // Sender keys are retired (groups are one vault row per member). A late row
    // from an old client must never fall through to the chat branch — a
    // distribution would render its key material as a message bubble.
    if (row.message_type.startsWith('sender-key')) return null

    const envelope = row.payload as unknown as SealedEnvelope
    const senderDeviceId = row.sender_device_id ?? 'unknown'

    // Vault-first rows are stateless X3DH envelopes to the user's vault, opened
    // with the vault keys; per-device rows (edge-authored) still go through the
    // pairwise session.
    const openRow = async (): Promise<{ plaintext: string; senderUuid: string }> => {
      if (row.recipient_device_id !== VAULT_DEVICE_ID) {
        return processIncomingMessage(senderDeviceId, envelope, myUuid)
      }
      const keys = await getVaultDecryptKeys(myUuid)
      if (!keys) throw new Error('No vault for this user')
      return openVaultEnvelope(senderDeviceId, envelope, myUuid, keys)
    }

    // Delete messages: decrypt through session, extract originIds
    if (row.message_type === 'delete') {
      const { plaintext: rawPlaintext, senderUuid } = await openRow()
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
      const { plaintext: rawPlaintext, senderUuid } = await openRow()

      // Read-sync (cross-device read status). The ids are the other device's;
      // useMessages resolves them to local ids by originId and applies them.
      try {
        const parsed = JSON.parse(rawPlaintext) as Record<string, unknown>
        if (parsed.__syncType === 'read') {
          const peerId = parsed.peerId as string
          const messageIds = parsed.messageIds as string[]
          const readAt = parsed.readAt as string
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
      const { plaintext: rawPlaintext, senderUuid } = await openRow()
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
      const { senderUuid } = await openRow()
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
      const { plaintext: rawPlaintext, senderUuid } = await openRow()
      const parsed = JSON.parse(rawPlaintext) as Record<string, unknown>
      // Older clients sent session-reset requests on this wire type. Never a
      // delivery receipt — drop it.
      if (parsed.__type === 'session-reset') return null
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
          originIds: parsed.originIds as string[] | undefined,
          deliveredAt: parsed.deliveredAt as string,
        },
      }
    }

    // Call signaling: WebRTC offer/answer/ICE/hangup/decline. Decrypt, route to
    // the call layer via the bus, and never surface as a chat message. A stale
    // signal is worthless, so a failure here is final rather than retried.
    if (row.message_type === 'call-signal') {
      if (Date.now() - Date.parse(row.created_at) > CALL_SIGNAL_MAX_AGE_MS) return null
      try {
        const { plaintext: rawPlaintext, senderUuid } = await openRow()
        const body = JSON.parse(rawPlaintext) as CallSignalBody
        emitCallSignal({ ...body, senderId: senderUuid })
      } catch (e) {
        if (e instanceof VaultLockedError) throw e
        logger.warn(`Failed to process call-signal ${row.id}:`, e instanceof Error ? e.message : e)
      }
      return null
    }

    // Legacy clinic-vault messages (V1 symmetric encryption) — skip, handled elsewhere.
    if (row.message_type === 'clinic-vault') {
      return null
    }

    // Initial and message types (1:1 and vault-first group content)
    const { plaintext: opened, senderUuid } = await openRow()
    const rawPlaintext = await unwrapGroupPayload(opened, row.group_id ?? null)

    // Legacy: receipts sent as 'message' before the 'receipt' type existed
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
            originIds: parsed.originIds as string[] | undefined,
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
    // The vault is locked on this device — not a row failure; the vault drain
    // stops here and prompts for the password. A transient failure is retried.
    if (e instanceof VaultLockedError || isTransientFailure(e)) throw e
    // Re-delivery of a packet we already opened. Nothing to do — the drain acks it.
    if (e instanceof DuplicateMessageError) {
      logger.debug(`Duplicate delivery of ${row.id} — acking`)
      return null
    }
    logger.error(`Failed to decrypt message ${row.id}:`, e instanceof Error ? e.message : e)
    onFailed?.()
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

/** Wire types whose decrypted message is persisted under the row id. */
const PERSISTED_CONTENT_TYPES = new Set(['message', 'initial', 'request'])

let decryptChain: Promise<unknown> = Promise.resolve()

/**
 * Single ordered inbound pipeline. Rows decrypt one at a time in arrival order:
 * run concurrently, a follow-up could win the session lock ahead of the
 * handshake that creates the session. Rows already persisted locally are
 * skipped instead of being decrypted again.
 */
function decryptRowInOrder(
  row: SignalMessageRow,
  myUuid: string,
  onFailed?: () => void,
): Promise<DecryptedSignalMessage | null> {
  const run = decryptChain.then(async () => {
    if (PERSISTED_CONTENT_TYPES.has(row.message_type) && await hasMessage(row.id)) return null
    return decryptRow(row, myUuid, onFailed)
  })
  decryptChain = run.catch(() => {})
  return run
}

type DecryptOutcome =
  | { kind: 'ok'; decrypted: DecryptedSignalMessage | null }
  | { kind: 'failed' }
  | { kind: 'transient' }
  | { kind: 'locked' }

/** Enqueues synchronously (keeps arrival order); resolves to what the drain does next. */
async function decryptForDrain(row: SignalMessageRow, myUuid: string): Promise<DecryptOutcome> {
  let failed = false
  try {
    const decrypted = await decryptRowInOrder(row, myUuid, () => { failed = true })
    return failed ? { kind: 'failed' } : { kind: 'ok', decrypted }
  } catch (e) {
    if (e instanceof VaultLockedError) return { kind: 'locked' }
    return isTransientFailure(e) ? { kind: 'transient' } : { kind: 'failed' }
  }
}

/** Vault rows fetched per catch-up page. */
const VAULT_PAGE_SIZE = 200

/** Attempts before an undecryptable row is given up on — skipped (vault: so it
 *  can't pin the cursor and the server reap forever) or acked (per-device and
 *  clinic: so it leaves the unread delta). Persisted so the count survives
 *  reloads; in memory, a permanently undecryptable row reset on every reload. */
const ROW_MAX_ATTEMPTS = 3

/** Minimum spacing between counted attempts on one row, so the burst of drains
 *  at startup (mount, backup-restored, vault-unlocked) can't burn every attempt
 *  on one transient failure. */
const ROW_ATTEMPT_SPACING_MS = 60_000

type RowFailures = Record<string, { n: number; at: number }>

/** scope = `${ownerId}:${deviceId}` — the user+device or clinic+clinic-device
 *  inbox the rows came from. */
const rowFailuresKey = (scope: string) => `vault_failures:${scope}`

function readRowFailures(scope: string): RowFailures {
  try {
    const raw = localStorage.getItem(rowFailuresKey(scope))
    return raw ? JSON.parse(raw) as RowFailures : {}
  } catch { return {} }
}

function writeRowFailures(scope: string, map: RowFailures): void {
  try {
    if (Object.keys(map).length === 0) localStorage.removeItem(rowFailuresKey(scope))
    else localStorage.setItem(rowFailuresKey(scope), JSON.stringify(map))
  } catch { /* ignore */ }
}

/** Count a failed attempt. Returns the attempt count, or null while the row
 *  still has attempts left (the caller leaves it to be retried). */
function recordRowFailure(scope: string, rowId: string): number | null {
  const stored = readRowFailures(scope)
  const now = Date.now()
  const prev = stored[rowId]
  const attempts = prev && now - prev.at < ROW_ATTEMPT_SPACING_MS ? prev.n : (prev?.n ?? 0) + 1
  if (attempts < ROW_MAX_ATTEMPTS) {
    if (attempts !== prev?.n) {
      stored[rowId] = { n: attempts, at: now }
      writeRowFailures(scope, stored)
    }
    return null
  }
  delete stored[rowId]
  writeRowFailures(scope, stored)
  return attempts
}

function clearRowFailure(scope: string, rowId: string): void {
  const stored = readRowFailures(scope)
  if (!(rowId in stored)) return
  delete stored[rowId]
  writeRowFailures(scope, stored)
}

/** Drain parts. A personal doorbell names the inbox it rang for; lifecycle
 *  triggers ask for everything. PART_VAULT_FULL widens the vault re-read to the
 *  full CURSOR_OVERLAP_MS — a doorbell drain only needs to cover commit skew
 *  between two inserts, not a resume or reconnect gap. */
const PART_VAULT = 1
const PART_DEVICE = 2
const PART_VAULT_FULL = 4
const ALL_PARTS = PART_VAULT | PART_DEVICE | PART_VAULT_FULL

/** Vault re-read window for a doorbell drain. Realtime fires after commit, so a
 *  row the cursor skipped past can only be one that committed out of
 *  created_at order — milliseconds apart, not minutes. */
const DOORBELL_OVERLAP_MS = 10_000

/** Retry delays after a drain's fetch fails while the page is visible. */
const RETRY_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

/**
 * Single-flight drain scheduler. A trigger during a run only records the parts
 * asked for; one rerun covers everything recorded, so a burst of doorbells
 * costs one drain plus at most one rerun. The run always comes from the latest
 * render. `run` resolves to the parts whose fetch failed; while the page is
 * visible those are retried on a capped backoff, reset by a clean run.
 */
function useDrainScheduler(
  label: string,
  run: (parts: number) => Promise<number>,
  isPageVisible: boolean,
): (parts?: number) => void {
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  }, [run])

  const state = useRef({
    alive: true,
    visible: isPageVisible,
    running: false,
    pending: 0,
    /** Parts awaiting a backoff retry; folded into the next run, whoever triggers it. */
    failed: 0,
    attempt: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
  })

  const clearRetry = useCallback(() => {
    const s = state.current
    if (s.timer) { clearTimeout(s.timer); s.timer = null }
  }, [])

  const trigger = useCallback((parts: number = ALL_PARTS) => {
    const s = state.current
    s.pending |= parts
    if (s.running || !s.alive || (s.pending | s.failed) === 0) return
    clearRetry()
    s.pending |= s.failed
    s.failed = 0
    s.running = true
    const todo = s.pending
    s.pending = 0
    void runRef.current(todo)
      .catch((e) => {
        logger.warn(`${label} drain threw:`, e instanceof Error ? e.message : e)
        return todo
      })
      .then((failed) => {
        s.running = false
        if (failed === 0) s.attempt = 0
        if (s.pending) {
          trigger(failed)
          return
        }
        if (failed && s.visible && s.alive) {
          s.failed |= failed
          const delay = RETRY_BACKOFF_MS[Math.min(s.attempt, RETRY_BACKOFF_MS.length - 1)]
          s.attempt++
          s.timer = setTimeout(() => {
            s.timer = null
            trigger(0)
          }, delay)
        }
      })
  }, [label, clearRetry])

  useEffect(() => {
    state.current.visible = isPageVisible
    if (!isPageVisible) {
      clearRetry()
      state.current.attempt = 0
    }
  }, [isPageVisible, clearRetry])

  useEffect(() => {
    const s = state.current
    s.alive = true
    return () => {
      s.alive = false
      clearRetry()
    }
  }, [clearRetry])

  return trigger
}

const PROCESSED_GUARD_MAX = 1000

function trackProcessed(guard: MutableRefObject<Set<string>>, id: string): void {
  guard.current.add(id)
  if (guard.current.size > PROCESSED_GUARD_MAX) {
    guard.current = new Set(Array.from(guard.current).slice(-PROCESSED_GUARD_MAX / 2))
  }
}

/** Transport ack — server read state, not user-read. Returns false when it
 *  failed (the drain retries; the processed guard keeps it from re-applying). */
async function ackRows(ids: string[], recipientId: string, source: string): Promise<boolean> {
  if (ids.length === 0) return true
  const result = await markMessagesRead(ids, recipientId)
  if (result.ok) return true
  errorBus.emit({ code: ErrorCode.SYNC_FAILED, source, message: 'Failed to mark processed messages as read', timestamp: Date.now(), metadata: { error: result.error } })
  return false
}

export function useSignalMessages({
  userId,
  localDeviceId,
  clinicId,
  surrogateClinicIds,
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

  const isAuthenticatedRef = useRef(isAuthenticated)
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated
  }, [isAuthenticated])

  const localDeviceIdRef = useRef(localDeviceId)
  useEffect(() => {
    localDeviceIdRef.current = localDeviceId
  }, [localDeviceId])

  const userIdRef = useRef(userId)
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  // All clinics this device belongs to (home ∪ loans), deduped. Keyed by a
  // joined string so the memo identity is stable across renders when the set is
  // unchanged — otherwise a fresh surrogateClinicIds array each render would
  // churn the realtime subscription.
  const surrogateKey = surrogateClinicIds.join(',')
  const clinicIds = useMemo(
    () => Array.from(new Set([clinicId, ...surrogateClinicIds].filter((x): x is string => !!x))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clinicId, surrogateKey],
  )
  const clinicIdsRef = useRef(clinicIds)
  useEffect(() => {
    clinicIdsRef.current = clinicIds
  }, [clinicIds])

  const clinicDeviceIdRef = useRef(clinicDeviceId)
  useEffect(() => {
    clinicDeviceIdRef.current = clinicDeviceId
  }, [clinicDeviceId])

  // Per-device and clinic rows processed in a drain whose ack may not have
  // landed yet (or failed). A later drain re-fetches them; this makes it re-ack
  // instead of re-applying (an oncall ring would ring again).
  const processedIds = useRef(new Set<string>())

  // The first vault drain waits for the backup restore (it may seed the cursor
  // watermark); later drains must not each sit out the wait when none runs.
  const restoreWaitedFor = useRef<string | null>(null)

  /**
   * Apply a decrypted personal row: deletes strip local state, everything else
   * goes to onMessage, and conversation content from others gets a delivery
   * receipt. Vault rows are NEVER hard-deleted here — the user's other devices
   * still read them from their own cursors; the server reap removes them once
   * every active device and a backup have them.
   */
  const applyDecrypted = useCallback((
    row: SignalMessageRow,
    decrypted: DecryptedSignalMessage,
    myUuid: string,
    myDeviceId: string,
  ) => {
    if (decrypted.messageType === 'delete') {
      try {
        const { originIds } = JSON.parse(decrypted.plaintext) as { originIds: string[] }
        deleteMessagesByOriginIdFromDb(originIds).catch(e => errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useSignalMessages.apply', message: 'Failed to delete messages from local DB', timestamp: Date.now(), metadata: { error: e } }))
        onDeleteRef.current?.(originIds)
        hardDeleteByOriginId(originIds).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.apply', message: 'Failed to hard-delete origin messages from server', timestamp: Date.now(), metadata: { error: e } }))
        if (row.recipient_device_id !== VAULT_DEVICE_ID) {
          hardDeleteMessages([decrypted.id]).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.apply', message: 'Failed to hard-delete processed message from server', timestamp: Date.now(), metadata: { error: e } }))
        }
        if (userIdRef.current) scheduleBackup(userIdRef.current)
      } catch { /* ignore parse errors */ }
      return
    }

    onMessageRef.current(decrypted)

    if (isConversationContent(decrypted, myUuid)) {
      sendDeliveryReceipt(
        decrypted.senderId,
        [row.id],
        myUuid,
        myDeviceId,
        row.origin_id ? [row.origin_id] : undefined,
      ).catch(() => {})
    }
  }, [])

  // ── Personal drain ────────────────────────────────────────────────────────

  /** Vault tail from this device's cursor (minus the overlap window), page by
   *  page. A device with no cursor starts from the restored backup's watermark —
   *  rows below it are in the snapshot. A retriable failure does NOT stop the
   *  tail: later rows are still applied, and the cursor is held behind the
   *  failed row so the next drain retries it. Stopping would wedge every newer
   *  message behind one undecryptable row. Returns false on a failed fetch. */
  const drainVault = useCallback(async (myUuid: string, myDeviceId: string, overlapMs: number): Promise<boolean> => {
    if (restoreWaitedFor.current !== myUuid) {
      await Promise.race([whenRestoreSettled(), new Promise(r => setTimeout(r, 15_000))])
      restoreWaitedFor.current = myUuid
      if (userIdRef.current !== myUuid) return true
    }

    let cursor
    try {
      cursor = await loadVaultCursor(myUuid, myDeviceId)
    } catch {
      return false
    }
    if (!cursor) {
      const watermark = getRestoredVaultWatermark()
      if (watermark) seedVaultCursor(myUuid, myDeviceId, watermark)
      cursor = currentVaultCursor()
    }
    let since = cursor
      ? new Date(Date.parse(cursor.createdAt) - overlapMs).toISOString()
      : null

    const scope = `${myUuid}:${myDeviceId}`
    let holdCursor = false
    try {
      for (;;) {
        const page = await fetchVaultTail(myUuid, since, VAULT_PAGE_SIZE)
        if (!page.ok) {
          logger.warn('Vault drain fetch failed:', page.error)
          return false
        }
        for (const row of page.data) {
          if (userIdRef.current !== myUuid) return true
          const advance = () => { if (!holdCursor) advanceVaultCursor(row) }

          if (wasVaultRowProcessed(row.id)) { advance(); continue }
          // This device's own row (own-device sync, own receipts): already applied here.
          if (row.sender_device_id === myDeviceId) {
            markVaultRowProcessed(row.id)
            advance()
            continue
          }

          const outcome = await decryptForDrain(row, myUuid)
          if (outcome.kind === 'locked') {
            useAuthStore.getState().setVaultKeyPromptNeeded(true)
            return true
          }
          // The link failed, not the row: stop (later rows would fail the same
          // way) and let the backoff retry from the held cursor.
          if (outcome.kind === 'transient') return false
          if (outcome.kind === 'failed') {
            const attempts = recordRowFailure(scope, row.id)
            if (attempts === null) {
              holdCursor = true
              continue
            }
            logger.warn(`Vault row ${row.id} undecryptable after ${attempts} attempts — skipping`)
          } else {
            clearRowFailure(scope, row.id)
          }

          markVaultRowProcessed(row.id)
          if (outcome.kind === 'ok' && outcome.decrypted) applyDecrypted(row, outcome.decrypted, myUuid, myDeviceId)
          advance()
        }
        if (page.data.length < VAULT_PAGE_SIZE) break
        const last = page.data[page.data.length - 1].created_at
        if (last === since) break // a full page sharing one timestamp — next trigger continues
        since = last
      }
    } finally {
      void flushVaultCursor()
    }
    // A held row retries on the backoff, not whenever the next message happens
    // to ring — on a quiet session that could be hours.
    return !holdCursor
  }, [applyDecrypted])

  /** Per-device unread rows (edge-authored and plaintext 'system' rows). Every
   *  handled row is acked; a retriable failure stays unread until its attempt
   *  cap, then is acked too. Returns false on a failed fetch or ack. */
  const drainDeviceInbox = useCallback(async (myUuid: string, myDeviceId: string): Promise<boolean> => {
    const result = await fetchUnreadMessages(myUuid, myDeviceId)
    if (!result.ok) {
      logger.warn('Device inbox fetch failed:', result.error)
      return false
    }
    if (result.data.length > 0) logger.debug(`Device inbox: ${result.data.length} unread`)

    const scope = `${myUuid}:${myDeviceId}`
    const ack: string[] = []
    let retry = false
    // Enqueue the whole batch at once, in server order.
    const queued = result.data
      .filter(row => {
        if (row.recipient_device_id === VAULT_DEVICE_ID) return false
        if (processedIds.current.has(row.id)) { ack.push(row.id); return false }
        return true
      })
      .map(row => ({ row, pending: decryptForDrain(row, myUuid) }))

    for (const { row, pending } of queued) {
      const outcome = await pending
      if (userIdRef.current !== myUuid) return true
      if (outcome.kind === 'transient' || outcome.kind === 'locked') { retry = true; continue }
      if (outcome.kind !== 'ok') {
        const attempts = recordRowFailure(scope, row.id)
        if (attempts === null) { retry = true; continue }
        logger.warn(`Device row ${row.id} undecryptable after ${attempts} attempts — acking`)
      } else {
        clearRowFailure(scope, row.id)
        if (outcome.decrypted) applyDecrypted(row, outcome.decrypted, myUuid, myDeviceId)
      }
      trackProcessed(processedIds, row.id)
      ack.push(row.id)
    }

    return (await ackRows(ack, myUuid, 'useSignalMessages.deviceInbox')) && !retry
  }, [applyDecrypted])

  const drainPersonal = useCallback(async (parts: number): Promise<number> => {
    const myUuid = userIdRef.current
    const myDeviceId = localDeviceIdRef.current
    if (!isAuthenticatedRef.current || !myUuid || !myDeviceId) return 0
    let failed = 0
    // Device inbox first: on-call rings ride it and must not sit behind the
    // vault drain's restore wait.
    if ((parts & PART_DEVICE) && !(await drainDeviceInbox(myUuid, myDeviceId))) failed |= PART_DEVICE
    const overlapMs = parts & PART_VAULT_FULL ? CURSOR_OVERLAP_MS : DOORBELL_OVERLAP_MS
    if ((parts & (PART_VAULT | PART_VAULT_FULL)) && !(await drainVault(myUuid, myDeviceId, overlapMs))) {
      failed |= PART_VAULT | PART_VAULT_FULL
    }
    return failed
  }, [drainVault, drainDeviceInbox])

  // ── Clinic drain ──────────────────────────────────────────────────────────

  /** Every clinic's inbox is addressed to the same clinicDeviceId; only
   *  recipient_id (the clinic) differs, so fetch per clinic, decrypt with that
   *  clinic's id, and ack with that clinic as recipient — read state is keyed
   *  by recipient, so an ack without it never lands and the row re-downloads. */
  const drainClinics = useCallback(async (): Promise<number> => {
    const myClinicDeviceId = clinicDeviceIdRef.current
    const ids = clinicIdsRef.current
    if (!isAuthenticatedRef.current || !userIdRef.current || !myClinicDeviceId || ids.length === 0) return 0

    const results = await Promise.all(
      ids.map(cId => fetchUnreadMessages(cId, myClinicDeviceId).then(r => ({ cId, r }))),
    )

    let failed = 0
    for (const { cId, r } of results) {
      if (!r.ok) {
        logger.warn(`Clinic drain ${cId} fetch failed:`, r.error)
        failed = ALL_PARTS
        continue
      }
      if (r.data.length > 0) logger.debug(`Clinic drain ${cId}: ${r.data.length} unread`)

      const scope = `${cId}:${myClinicDeviceId}`
      const ack: string[] = []
      for (const row of r.data) {
        if (processedIds.current.has(row.id)) { ack.push(row.id); continue }
        try {
          const envelope = row.payload as unknown as SealedEnvelope
          const senderDeviceId = row.sender_device_id ?? 'unknown'
          const { plaintext: rawPlaintext } = await processClinicIncomingMessage(senderDeviceId, envelope, cId)
          clearRowFailure(scope, row.id)
          const { content } = parseMessageContent(rawPlaintext)
          if (isCalendarEvent(content)) {
            routeCalendarEvent(content)
          } else if (isMapOverlay(content)) {
            // Serial await — overlay/feature routes share a single IDB row under RMW.
            await routeMapOverlay(content).catch(() => {})
          } else if (isMapFeature(content)) {
            await routeMapFeature(content).catch(() => {})
          }
        } catch (e) {
          if (isTransientFailure(e)) {
            failed = ALL_PARTS
            continue
          }
          if (isUnrecoverableClinicDecrypt(e)) {
            logger.warn(`Dropping undecryptable clinic message ${row.id} (marking read):`, e instanceof Error ? e.message : e)
          } else {
            const attempts = recordRowFailure(scope, row.id)
            if (attempts === null) {
              logger.warn(`Failed to decrypt clinic message ${row.id}:`, e instanceof Error ? e.message : e)
              failed = ALL_PARTS
              continue
            }
            logger.warn(`Clinic row ${row.id} undecryptable after ${attempts} attempts — acking`)
          }
        }
        trackProcessed(processedIds, row.id)
        ack.push(row.id)
      }

      if (!(await ackRows(ack, cId, 'useSignalMessages.clinicDrain'))) failed = ALL_PARTS
    }
    return failed
  }, [])

  const triggerPersonal = useDrainScheduler('personal', drainPersonal, isPageVisible)
  const triggerClinic = useDrainScheduler('clinic', drainClinics, isPageVisible)

  // ── Lifecycle triggers ────────────────────────────────────────────────────

  useEffect(() => {
    if (isAuthenticated && userId && localDeviceId) triggerPersonal()
  }, [isAuthenticated, userId, localDeviceId, triggerPersonal])

  useEffect(() => {
    if (isAuthenticated && userId && clinicIds.length > 0 && clinicDeviceId) triggerClinic()
  }, [isAuthenticated, userId, clinicIds, clinicDeviceId, triggerClinic])

  const prevVisibleRef = useRef(isPageVisible)
  useEffect(() => {
    if (isPageVisible && !prevVisibleRef.current) {
      triggerPersonal()
      triggerClinic()
    } else if (!isPageVisible) {
      // Persist the vault cursor before the page may be frozen/evicted.
      void flushVaultCursor()
    }
    prevVisibleRef.current = isPageVisible
  }, [isPageVisible, triggerPersonal, triggerClinic])

  // Network reconnect (a long-lived foregrounded session fires no
  // visibilitychange), backup restore (may have established state needed to
  // decrypt) and vault unlock (the vault drain stopped on the lock).
  useEffect(() => {
    const drainAll = () => {
      triggerPersonal()
      triggerClinic()
    }
    window.addEventListener('online', drainAll)
    window.addEventListener('backup-restored', drainAll)
    window.addEventListener(VAULT_UNLOCKED_EVENT, drainAll)
    return () => {
      window.removeEventListener('online', drainAll)
      window.removeEventListener('backup-restored', drainAll)
      window.removeEventListener(VAULT_UNLOCKED_EVENT, drainAll)
    }
  }, [triggerPersonal, triggerClinic])

  // Realtime does not replay rows inserted while a channel was down — or before
  // it first joined. Every SUBSCRIBED (mount, resume, silent-socket auto-rejoin
  // on a foregrounded page that fires no visibilitychange/online) drains, so the
  // gap between the last drain and the doorbell going live is always covered.
  const handlePersonalStatus = useCallback((status: string) => {
    if (status === 'SUBSCRIBED') triggerPersonal(PART_VAULT | PART_DEVICE)
  }, [triggerPersonal])
  const handleClinicStatus = useCallback((status: string) => {
    if (status === 'SUBSCRIBED') triggerClinic()
  }, [triggerClinic])

  // ── Realtime doorbells ────────────────────────────────────────────────────

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<SignalMessageRow>) => {
      if (payload.eventType !== 'INSERT') return
      const row = payload.new as SignalMessageRow
      const myDeviceId = localDeviceIdRef.current
      // Our own send (self-sync, own receipts) — nothing to apply; the next
      // drain moves the cursor over it.
      if (row.sender_device_id && row.sender_device_id === myDeviceId) return
      if (row.recipient_device_id === VAULT_DEVICE_ID) triggerPersonal(PART_VAULT)
      else if (!row.recipient_device_id || row.recipient_device_id === myDeviceId) triggerPersonal(PART_DEVICE)
    },
    [triggerPersonal],
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

  const handleClinicPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<SignalMessageRow>) => {
      if (payload.eventType !== 'INSERT') return
      const row = payload.new as SignalMessageRow
      const myClinicDeviceId = clinicDeviceIdRef.current
      if (!myClinicDeviceId) return
      if (!row.recipient_id || !clinicIdsRef.current.includes(row.recipient_id)) return
      if (row.recipient_device_id && row.recipient_device_id !== myClinicDeviceId) return
      triggerClinic()
    },
    [triggerClinic],
  )

  const clinicPostgresFilter = useMemo(
    () => ({
      table: 'signal_messages',
      // One clinic → proven eq path (the common case). Home + loans → in.(...) so
      // a single subscription covers every clinic the user belongs to. (Realtime
      // postgres_changes supports the `in` filter.)
      filter: clinicIds.length === 1
        ? `recipient_id=eq.${clinicIds[0]}`
        : `recipient_id=in.(${clinicIds.join(',')})`,
      event: 'INSERT' as const,
    }),
    [clinicIds],
  )

  useSupabaseSubscription<SignalMessageRow>({
    shouldSubscribe: isAuthenticated && clinicIds.length > 0 && !!clinicDeviceId && isPageVisible,
    channelName: `clinic-signal:${clinicIds.join('-')}`,
    postgresFilter: clinicPostgresFilter,
    onPayload: handleClinicPayload,
    logger,
    onStatus: handleClinicStatus,
  })

  useSupabaseSubscription<SignalMessageRow>({
    shouldSubscribe: isAuthenticated && !!userId && isPageVisible,
    channelName: `signal-messages:${userId}`,
    postgresFilter,
    onPayload: handlePayload,
    logger,
    onStatus: handlePersonalStatus,
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
