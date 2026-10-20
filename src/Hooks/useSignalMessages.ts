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
import { fetchUnreadMessages, fetchVaultTail, markMessagesRead, deleteMessages as hardDeleteMessages, hardDeleteByOriginId, onLoRaMessage } from '../lib/signal/signalService'
import { deleteMessagesByOriginId as deleteMessagesByOriginIdFromDb, updateReadAt, hasMessage } from '../lib/signal/messageStore'
import { scheduleBackup, whenRestoreSettled, getRestoredVaultWatermark } from '../lib/signal/backupService'
import { LORA_MESH_ENABLED } from '../lib/featureFlags'
import { processIncomingMessage, openVaultEnvelope, unsealOnly, NoSessionError, SessionMismatchError, DuplicateMessageError } from '../lib/signal/session'
import { getVaultDecryptKeys, VaultLockedError, VAULT_DEVICE_ID, VAULT_UNLOCKED_EVENT } from '../lib/signal/vaultDevice'
import {
  loadVaultCursor, seedVaultCursor, currentVaultCursor, advanceVaultCursor, flushVaultCursor,
  wasVaultRowProcessed, markVaultRowProcessed, CURSOR_OVERLAP_MS,
} from '../lib/signal/vaultCursor'
import { sendToUser } from '../lib/signal/vaultSend'
import { useAuthStore } from '../stores/useAuthStore'
import { processClinicIncomingMessage } from '../lib/signal/clinicSession'
import { drainSystemInbox, SYSTEM_USER_ID } from '../lib/signal/systemIdentity'
import { processSenderKeyDistribution, senderKeyDecrypt, SenderKeyMissingError } from '../lib/signal/senderKey'
import { getGroupSecretMeta, setGroupSecret } from '../lib/signal/groupNameCrypto'
import { emitGroupRefresh } from '../lib/signal/groupRefreshBus'
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

// Minimum gap between 'online'-triggered catch-ups. A flapping connection fires
// discrete online events per flap; without this a bad link could spam the
// unread-delta fetch. Visibility/backup triggers stay unthrottled (user-paced).
const ONLINE_CATCHUP_THROTTLE_MS = 15_000

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
  /** We received a group message we can't decrypt for lack of a sender key —
   *  ask the sender (peerId) to re-distribute for this group. */
  onSenderKeyMissing?: (groupId: string, peerId: string) => void
  /** A peer (requesterId) asked us to re-distribute our sender key for a group. */
  onSenderKeyRequest?: (groupId: string, requesterId: string) => void
  /** See DecryptSideEffects.onSessionMissing. */
  onSessionMissing?: (peerId: string, peerDeviceId: string, rowId: string, originId?: string) => void
  /** See DecryptSideEffects.onSessionReset. */
  onSessionReset?: (peerId: string, peerDeviceId: string, originIds: string[]) => void
}

/** Control-plane side-effects decryptRow may trigger (retry-receipt flow). */
interface DecryptSideEffects {
  onSenderKeyMissing?: (groupId: string, peerId: string) => void
  onSenderKeyRequest?: (groupId: string, requesterId: string) => void
  /** A ratchet packet arrived from a peer device we hold no session with.
   *  originId is set only for 1:1 conversation content the peer can re-send. */
  onSessionMissing?: (peerId: string, peerDeviceId: string, rowId: string, originId?: string) => void
  /** A peer device rebuilt its session with us and asks us to re-send these. */
  onSessionReset?: (peerId: string, peerDeviceId: string, originIds: string[]) => void
  /** The row could not be decrypted (decryptRow returned null because of a
   *  failure, not because the row is control-plane). */
  onDecryptFailed?: (rowId: string) => void
}

/**
 * Wire types that never become conversation content: a null decryptRow result
 * for these is final, so the row is marked read. Everything else stays unread
 * so catch-up retries it. 'receipt' is here because the session-reset request
 * rides that type (decryptRow returns null for it) and must not be re-applied
 * — i.e. re-sent — on every catch-up.
 */
const CONTROL_PLANE_TYPES = new Set(['sender-key-distribution', 'call-signal', 'sender-key-request', 'receipt'])

/** A ratchet packet no held session can open — our half is missing
 *  (NoSessionError) or diverged from the peer's (SessionMismatchError). Either
 *  way only a fresh handshake recovers it: request a session reset. */
function reportNoSession(e: unknown, row: SignalMessageRow, sideEffects?: DecryptSideEffects): void {
  if (!(e instanceof NoSessionError) && !(e instanceof SessionMismatchError)) return
  const resendable = !row.group_id && !!row.origin_id &&
    (row.message_type === 'message' || row.message_type === 'request')
  sideEffects?.onSessionMissing?.(e.peerId, e.peerDeviceId, row.id, resendable ? row.origin_id ?? undefined : undefined)
}

/**
 * Vault-first group content carries the per-group name secret alongside the
 * payload ({ __g: { s, e }, c }) — the job the sender-key distribution used to
 * do. Adopt the secret when its epoch is newer than ours (a post-removal
 * rotation supersedes), then return the inner payload. Non-wrapped input is
 * returned unchanged.
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

async function decryptRow(
  row: SignalMessageRow,
  myUuid: string,
  sideEffects?: DecryptSideEffects,
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

    const envelope = row.payload as unknown as SealedEnvelope
    const senderDeviceId = row.sender_device_id ?? 'unknown'

    // Vault-first rows are stateless X3DH envelopes to the user's vault, opened
    // with the vault keys; per-device rows (pre-vault-first senders) still go
    // through the pairwise session.
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
      // Session-reset request: rides the 'receipt' type because the server's
      // message_type CHECK admits it (no migration) and older clients treat the
      // empty messageIds as a no-op receipt. Decrypting it (X3DH initial) has
      // already replaced our stale session with this device.
      if (parsed.__type === 'session-reset') {
        const originIds = Array.isArray(parsed.resendOriginIds)
          ? parsed.resendOriginIds.filter((x): x is string => typeof x === 'string')
          : []
        sideEffects?.onSessionReset?.(senderUuid, senderDeviceId, originIds)
        return null
      }
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

    // Sender key distribution: arrives via pairwise 1:1 session (Double Ratchet encrypted).
    // Decrypt through the session, then store the distribution for future group decryption.
    if (row.message_type === 'sender-key-distribution') {
      const { plaintext: rawPlaintext, senderUuid } = await openRow()
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
        const stored = await processSenderKeyDistribution(dist, memberIds, { userId: senderUuid, deviceId: senderDeviceId })
        if (!stored) return null
        logger.debug(`Stored sender key distribution from ${senderUuid} for group ${groupId}`)

        // Adopt the piggybacked group-name secret. Epoch-gated: only take it when
        // its epoch exceeds our stored one (or we have none), so the creator's
        // baseline propagates and a post-removal rotated secret supersedes it.
        if (dist.groupSecret && groupId) {
          const incomingEpoch = dist.secretEpoch ?? 0
          const existing = await getGroupSecretMeta(groupId)
          if (!existing || incomingEpoch > existing.epoch) {
            await setGroupSecret(groupId, dist.groupSecret, incomingEpoch)
            logger.debug(`Adopted group-name secret for ${groupId} at epoch ${incomingEpoch}`)
            // Names are decrypted once, at fetch time — whatever is in the store
            // right now is still ciphertext. Re-hydrate so the name resolves in
            // this session instead of waiting for the next mount.
            emitGroupRefresh(groupId)
          }
        }
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
        const { plaintext: rawPlaintext, senderUuid } = await openRow()
        const body = JSON.parse(rawPlaintext) as CallSignalBody
        emitCallSignal({ ...body, senderId: senderUuid })
      } catch (e) {
        if (e instanceof VaultLockedError) throw e
        logger.warn(`Failed to process call-signal ${row.id}:`, e instanceof Error ? e.message : e)
        reportNoSession(e, row, sideEffects)
      }
      // Never user-visible.
      return null
    }

    // Sender-key re-distribution request (retry-receipt): a group member who
    // could not decrypt one of OUR group messages asks us to re-send our sender
    // key. Rides the pairwise session as control-plane (like sender-key-
    // distribution / call-signal). Decrypt, route to the re-distribution handler,
    // never surface as a chat message.
    if (row.message_type === 'sender-key-request') {
      try {
        const { plaintext: rawPlaintext, senderUuid } = await openRow()
        const body = JSON.parse(rawPlaintext) as { type?: string; groupId?: string }
        if (body.groupId) sideEffects?.onSenderKeyRequest?.(body.groupId, senderUuid)
      } catch (e) {
        if (e instanceof VaultLockedError) throw e
        logger.warn(`Failed to process sender-key-request ${row.id}:`, e instanceof Error ? e.message : e)
        reportNoSession(e, row, sideEffects)
      }
      return null
    }

    // Legacy clinic-vault messages (V1 symmetric encryption) — skip, handled elsewhere.
    if (row.message_type === 'clinic-vault') {
      return null
    }

    // Group content. Two wire shapes coexist during the sealed-sender rollout:
    //   • SealedEnvelope {v,ephemeralKey,ciphertext} — operator-blind (current):
    //     unseal (ECIES, NO ratchet) → inner SenderKeyMessage; sender is
    //     authenticated by the cert. Fanned PER DEVICE, so a row addressed to a
    //     sibling device fails unseal with 'cert recipient mismatch' — benign.
    //   • legacy raw SenderKeyMessage {groupId,senderId,...} — pre-sealing rows
    //     and un-updated senders: decrypt directly (back-compat).
    if (row.message_type === 'sender-key-message') {
      const rawPayload = row.payload as unknown as Record<string, unknown>
      const isSealed = !!rawPayload && typeof rawPayload === 'object'
        && 'ephemeralKey' in rawPayload && 'ciphertext' in rawPayload

      let senderKeyMsg: SenderKeyMessage
      if (isSealed) {
        try {
          const { inner, senderUuid } = await unsealOnly(rawPayload as unknown as SealedEnvelope, myUuid, row.sender_device_id ?? 'unknown')
          senderKeyMsg = inner as unknown as SenderKeyMessage
          // Authenticity: the inner sender MUST match the cert-authenticated
          // sender (and the device it sent from). Pre-sealing, senderId was
          // attacker-settable cleartext; the cert now binds it, so a mismatch is
          // a forgery attempt — reject.
          if (
            senderKeyMsg.senderId !== senderUuid ||
            (row.sender_device_id && senderKeyMsg.senderDeviceId !== row.sender_device_id)
          ) {
            logger.error(`sender-key-message ${row.id}: inner senderId ${senderKeyMsg.senderId} != cert ${senderUuid} — rejecting`)
            return null
          }
        } catch (e) {
          // Addressed to a SIBLING device (per-device fan-out) — not ours. Skip
          // silently: no retry, no error surface. The target device opens its copy.
          if (e instanceof Error && e.message.includes('cert recipient mismatch')) {
            return null
          }
          // Genuine envelope failure (tamper / expiry / forged cert).
          logger.error(`Failed to unseal sender-key-message ${row.id}:`, e instanceof Error ? e.message : e)
          errorBus.emit({
            code: ErrorCode.DECRYPT_FAILED,
            source: 'decryptRow:sender-key-message:unseal',
            message: 'A group message envelope could not be opened.',
            timestamp: Date.now(),
            metadata: { messageId: row.id, groupId: row.group_id },
          })
          return null
        }
      } else {
        senderKeyMsg = rawPayload as unknown as SenderKeyMessage
      }

      try {
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
        // We hold no sender-key state for this sender, or a different key than
        // the message was sent under ⇒ we missed their (re-)distribution. Fire
        // the retry-receipt so the sender re-distributes (Signal-style). Only
        // meaningful now that we KNOW the row was addressed to us (sealed rows
        // already passed the recipient check on unseal).
        if (row.group_id && senderKeyMsg.senderId && e instanceof SenderKeyMissingError) {
          sideEffects?.onSenderKeyMissing?.(row.group_id, senderKeyMsg.senderId)
        }
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

    // Initial and message types (1:1 and vault-first group content)
    const { plaintext: opened, senderUuid } = await openRow()
    const rawPlaintext = await unwrapGroupPayload(opened, row.group_id ?? null)

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
    // The vault is locked on this device — not a row failure; the vault inbox
    // stops here and prompts for the password.
    if (e instanceof VaultLockedError) throw e
    // Re-delivery of a packet we already opened (catch-up replay of a row that
    // stays unread until its conversation is opened). Nothing to do — ack it so
    // it stops coming back, and never treat it as a broken session.
    if (e instanceof DuplicateMessageError) {
      logger.debug(`Duplicate delivery of ${row.id} — acking`)
      markMessagesRead([row.id]).catch(() => {})
      return null
    }
    logger.error(`Failed to decrypt message ${row.id}:`, e instanceof Error ? e.message : e)
    sideEffects?.onDecryptFailed?.(row.id)
    reportNoSession(e, row, sideEffects)
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

/** Vault rows fetched per catch-up page. */
const VAULT_PAGE_SIZE = 200

/** Attempts before an undecryptable vault row is skipped so it can't pin the
 *  cursor (and the server reap) forever. Persisted per user+device so the count
 *  survives reloads — in memory, a permanently undecryptable row (pre-cut
 *  ratchet packet) reset to 0 on every reload and held the cursor forever. */
const VAULT_ROW_MAX_ATTEMPTS = 3

/** Minimum spacing between counted attempts on one row, so the burst of
 *  catch-ups at startup (mount, backup-restored, vault-unlocked) can't burn
 *  every attempt on one transient failure. */
const VAULT_ROW_ATTEMPT_SPACING_MS = 60_000

type VaultRowFailures = Record<string, { n: number; at: number }>

const vaultFailuresKey = (userId: string, deviceId: string) => `vault_failures:${userId}:${deviceId}`

function readVaultFailures(userId: string, deviceId: string): VaultRowFailures {
  try {
    const raw = localStorage.getItem(vaultFailuresKey(userId, deviceId))
    return raw ? JSON.parse(raw) as VaultRowFailures : {}
  } catch { return {} }
}

function writeVaultFailures(userId: string, deviceId: string, map: VaultRowFailures): void {
  try {
    if (Object.keys(map).length === 0) localStorage.removeItem(vaultFailuresKey(userId, deviceId))
    else localStorage.setItem(vaultFailuresKey(userId, deviceId), JSON.stringify(map))
  } catch { /* ignore */ }
}

/** Wire types whose decrypted message is persisted under the row id. */
const PERSISTED_CONTENT_TYPES = new Set(['message', 'initial', 'request', 'sender-key-message'])

let decryptChain: Promise<unknown> = Promise.resolve()

/**
 * Single ordered inbound pipeline shared by realtime, catch-up and LoRa.
 * Rows decrypt one at a time in arrival order: run concurrently, a follow-up
 * could win the session lock ahead of the handshake that creates the session,
 * or a group message ahead of its key distribution. Rows already persisted
 * locally (a conversation row stays unread server-side until opened, so every
 * catch-up re-fetches it) are skipped instead of being decrypted again.
 */
function decryptRowInOrder(
  row: SignalMessageRow,
  myUuid: string,
  sideEffects?: DecryptSideEffects,
): Promise<DecryptedSignalMessage | null> {
  const run = decryptChain.then(async () => {
    if (PERSISTED_CONTENT_TYPES.has(row.message_type) && await hasMessage(row.id)) return null
    return decryptRow(row, myUuid, sideEffects)
  })
  decryptChain = run.catch(() => {})
  return run
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
  onSenderKeyMissing,
  onSenderKeyRequest,
  onSessionMissing,
  onSessionReset,
}: UseSignalMessagesOptions): void {
  const onMessageRef = useRef(onMessage)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const onDeleteRef = useRef(onDelete)
  useEffect(() => {
    onDeleteRef.current = onDelete
  }, [onDelete])

  const onSenderKeyMissingRef = useRef(onSenderKeyMissing)
  useEffect(() => {
    onSenderKeyMissingRef.current = onSenderKeyMissing
  }, [onSenderKeyMissing])

  const onSenderKeyRequestRef = useRef(onSenderKeyRequest)
  useEffect(() => {
    onSenderKeyRequestRef.current = onSenderKeyRequest
  }, [onSenderKeyRequest])

  const onSessionMissingRef = useRef(onSessionMissing)
  useEffect(() => {
    onSessionMissingRef.current = onSessionMissing
  }, [onSessionMissing])

  const onSessionResetRef = useRef(onSessionReset)
  useEffect(() => {
    onSessionResetRef.current = onSessionReset
  }, [onSessionReset])

  // Stable side-effects object handed to decryptRow — reads via refs so it never
  // goes stale across renders.
  const decryptSideEffectsRef = useRef<DecryptSideEffects>({
    onSenderKeyMissing: (g, p) => onSenderKeyMissingRef.current?.(g, p),
    onSenderKeyRequest: (g, r) => onSenderKeyRequestRef.current?.(g, r),
    onSessionMissing: (p, d, r, o) => onSessionMissingRef.current?.(p, d, r, o),
    onSessionReset: (p, d, o) => onSessionResetRef.current?.(p, d, o),
  })

  const localDeviceIdRef = useRef(localDeviceId)
  useEffect(() => {
    localDeviceIdRef.current = localDeviceId
  }, [localDeviceId])

  // Track userId via ref so callbacks with empty deps can always read the latest value
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
    window.addEventListener(VAULT_UNLOCKED_EVENT, onBackupRestored)
    return () => {
      window.removeEventListener('backup-restored', onBackupRestored)
      window.removeEventListener(VAULT_UNLOCKED_EVENT, onBackupRestored)
    }
  }, [])

  // Persist the vault cursor before the page may be frozen/evicted.
  useEffect(() => {
    if (!isPageVisible) {
      // Realtime drops while hidden — rows can land below the next realtime one.
      vaultTailSynced.current = false
      void flushVaultCursor()
    }
  }, [isPageVisible])

  // Re-trigger catch-up on network reconnect. A long-lived, continuously-
  // foregrounded session fires no visibilitychange, so without this it never
  // re-drains its per-device inbox after a blip — a 'd' that arrived while
  // offline is never consumed and the deleted event resurrects in the local
  // cache. fetchUnread pulls only the unread delta (read_at IS NULL, within
  // horizon) and processed rows are marked read, so this re-fetches just what
  // actually arrived offline (egress-bounded). Throttled against link flap.
  useEffect(() => {
    const onOnline = () => {
      vaultTailSynced.current = false
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

      // Enqueue the whole backlog at once, in server order, so realtime rows
      // arriving mid-drain line up behind it instead of jumping ahead.
      const queued = result.data
        .filter(row => !processedIds.current.has(row.id))
        .map(row => {
          trackProcessed(row.id)
          return { row, pending: decryptRowInOrder(row, userId, decryptSideEffectsRef.current) }
        })

      for (const { row, pending } of queued) {
        const decrypted = await pending
        // Null return means non-visible (sender-key-distribution) or decrypt failure.
        // Only mark-read for non-recoverable types — leave handshake/session failures
        // unread so the next session's catch-up retries after pre-keys replenish,
        // sessions restore from backup, etc. Without this, a transient X3DH failure
        // (e.g. recipient on a fresh provisional tab) permanently loses the row,
        // which is exactly how request-accepted disappears and the gate sticks.
        // Untrack it too, or the in-memory dedupe would block that retry until reload.
        if (!decrypted) {
          if (CONTROL_PLANE_TYPES.has(row.message_type)) {
            processedRowIds.push(row.id)
          } else {
            processedIds.current.delete(row.id)
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
              [row.id],
              userIdRef.current,
              localDeviceId,
              row.origin_id ? [row.origin_id] : undefined,
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

  /**
   * Apply a decrypted personal row: deletes strip local state, everything else
   * goes to onMessage, and conversation content from others gets a delivery
   * receipt. Vault rows are NEVER hard-deleted or read-marked here — the user's
   * other devices still read them from their own cursors; the server reap
   * removes them once every active device and a backup have them.
   */
  const applyDecrypted = useCallback((
    row: SignalMessageRow,
    decrypted: DecryptedSignalMessage,
    myUuid: string,
    myDeviceId: string | null,
  ) => {
    const isVaultRow = row.recipient_device_id === VAULT_DEVICE_ID
    if (decrypted.messageType === 'delete') {
      try {
        const { originIds } = JSON.parse(decrypted.plaintext) as { originIds: string[] }
        deleteMessagesByOriginIdFromDb(originIds).catch(e => errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useSignalMessages.apply', message: 'Failed to delete messages from local DB', timestamp: Date.now(), metadata: { error: e } }))
        onDeleteRef.current?.(originIds)
        hardDeleteByOriginId(originIds).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.apply', message: 'Failed to hard-delete origin messages from server', timestamp: Date.now(), metadata: { error: e } }))
        if (!isVaultRow) {
          hardDeleteMessages([decrypted.id]).catch(e => errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useSignalMessages.apply', message: 'Failed to hard-delete processed message from server', timestamp: Date.now(), metadata: { error: e } }))
        }
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

    // Mark per-device non-conversation rows as read so the cron cleanup can
    // purge them. User messages are marked read when the conversation is opened.
    if (!isConversationContent && !isVaultRow) {
      markMessagesRead([row.id]).catch(() => {})
    }

    onMessageRef.current(decrypted)

    // Send delivery receipt only for user-visible messages from others
    if (isConversationContent && !decrypted.plaintext.includes('"__type":"delivery-receipt"') && myDeviceId) {
      sendDeliveryReceipt(
        decrypted.senderId,
        [row.id],
        myUuid,
        myDeviceId,
        row.origin_id ? [row.origin_id] : undefined,
      ).catch(() => {})
    }
  }, [])

  // ── Vault inbox (vault-first) ─────────────────────────────────────────────
  // Every personal message is one row addressed to the user's vault. This
  // device reads them in order from its own cursor; realtime rows and the
  // catch-up share one chain so the cursor only moves over rows actually handled.
  const vaultChain = useRef<Promise<unknown>>(Promise.resolve())
  const vaultFailures = useRef(new Map<string, number>())
  const vaultCatchUpRunning = useRef(false)
  const vaultCatchUpAgain = useRef(false)
  // Latest effect's run(). A re-run queued while an older run was in flight must
  // start from the CURRENT effect — the older closure is cancelled by then.
  const vaultRunRef = useRef<(() => Promise<void>) | null>(null)
  // True only once a catch-up has read the tail to the end with nothing missed
  // since. Realtime rows may only advance the cursor while synced: on resume,
  // realtime reconnects before (or without) a catch-up, and advancing on a fresh
  // row would jump the cursor past the backlog that arrived while hidden.
  const vaultTailSynced = useRef(false)

  /** Handle one vault row. Returns false only when processing must stop (vault
   *  locked). A retriable decrypt failure does NOT stop the tail: later rows are
   *  still applied, and the cursor is held behind the failed row (see advance)
   *  so the next catch-up retries it. Stopping here would wedge every newer
   *  message behind one undecryptable row (e.g. a pre-cut ratchet packet). */
  const processVaultRow = useCallback(async (row: SignalMessageRow, fromTail: boolean): Promise<boolean> => {
    const myUuid = userIdRef.current
    const myDeviceId = localDeviceIdRef.current
    if (!myUuid || !myDeviceId) return false

    const advance = () => {
      // Hold the cursor while an earlier row is still retrying, and never let a
      // realtime row move it while unread backlog may sit below it.
      if (!fromTail && !vaultTailSynced.current) return
      if (vaultFailures.current.size === 0) advanceVaultCursor(row)
    }

    if (wasVaultRowProcessed(row.id)) {
      advance()
      return true
    }
    // This device's own row (own-device sync, own receipts): already applied here.
    if (row.sender_device_id === myDeviceId) {
      markVaultRowProcessed(row.id)
      advance()
      return true
    }

    let failed = false
    let decrypted: DecryptedSignalMessage | null = null
    try {
      decrypted = await decryptRowInOrder(row, myUuid, {
        ...decryptSideEffectsRef.current,
        onDecryptFailed: () => { failed = true },
      })
    } catch (e) {
      if (e instanceof VaultLockedError) {
        useAuthStore.getState().setVaultKeyPromptNeeded(true)
        return false
      }
      failed = true
    }

    const stored = readVaultFailures(myUuid, myDeviceId)
    if (failed) {
      const now = Date.now()
      const prev = stored[row.id]
      const attempts = prev && now - prev.at < VAULT_ROW_ATTEMPT_SPACING_MS ? prev.n : (prev?.n ?? 0) + 1
      if (attempts < VAULT_ROW_MAX_ATTEMPTS) {
        if (attempts !== prev?.n) {
          stored[row.id] = { n: attempts, at: now }
          writeVaultFailures(myUuid, myDeviceId, stored)
        }
        vaultFailures.current.set(row.id, attempts)
        return true
      }
      delete stored[row.id]
      writeVaultFailures(myUuid, myDeviceId, stored)
      vaultFailures.current.delete(row.id)
      logger.warn(`Vault row ${row.id} undecryptable after ${attempts} attempts — skipping`)
    } else {
      if (row.id in stored) {
        delete stored[row.id]
        writeVaultFailures(myUuid, myDeviceId, stored)
      }
      vaultFailures.current.delete(row.id)
    }

    trackProcessed(row.id)
    markVaultRowProcessed(row.id)
    if (decrypted) applyDecrypted(row, decrypted, myUuid, myDeviceId)
    advance()
    return true
  }, [applyDecrypted])

  const enqueueVaultRow = useCallback((row: SignalMessageRow, fromTail = false): Promise<boolean> => {
    const run = vaultChain.current.then(() => processVaultRow(row, fromTail))
    vaultChain.current = run.catch(() => {})
    return run
  }, [processVaultRow])

  // Vault catch-up: read the vault tail from this device's cursor (minus the
  // overlap window), page by page. A device with no cursor starts from the
  // restored backup's watermark — rows below it are in the snapshot.
  useEffect(() => {
    if (!isAuthenticated || !userId || !localDeviceId) return
    let cancelled = false

    const run = async () => {
      if (vaultCatchUpRunning.current) {
        vaultCatchUpAgain.current = true
        return
      }
      vaultCatchUpRunning.current = true
      vaultTailSynced.current = false
      try {
        await Promise.race([whenRestoreSettled(), new Promise(r => setTimeout(r, 15_000))])
        if (cancelled) return

        let cursor = await loadVaultCursor(userId, localDeviceId)
        if (!cursor) {
          const watermark = getRestoredVaultWatermark()
          if (watermark) seedVaultCursor(userId, localDeviceId, watermark)
          cursor = currentVaultCursor()
        }
        let since = cursor
          ? new Date(Date.parse(cursor.createdAt) - CURSOR_OVERLAP_MS).toISOString()
          : null

        for (;;) {
          const page = await fetchVaultTail(userId, since, VAULT_PAGE_SIZE)
          if (!page.ok || cancelled) return
          for (const row of page.data) {
            if (!(await enqueueVaultRow(row, true))) return
          }
          if (page.data.length < VAULT_PAGE_SIZE) {
            if (!vaultCatchUpAgain.current) vaultTailSynced.current = true
            break
          }
          const last = page.data[page.data.length - 1].created_at
          if (last === since) break // a full page sharing one timestamp — next trigger continues
          since = last
        }
        void flushVaultCursor()
      } finally {
        vaultCatchUpRunning.current = false
        // A trigger that landed mid-run cancelled THIS closure and queued itself;
        // run it from the current effect, or the catch-up is silently dropped.
        if (vaultCatchUpAgain.current) {
          vaultCatchUpAgain.current = false
          void vaultRunRef.current?.()
        }
      }
    }

    vaultRunRef.current = run
    void run()
    return () => {
      cancelled = true
      if (vaultRunRef.current === run) vaultRunRef.current = null
    }
  }, [isAuthenticated, userId, localDeviceId, catchUpTrigger, enqueueVaultRow])

  // Clinic device offline catch-up: drain unread messages for EVERY clinic the
  // user belongs to (home ∪ loans). Each clinic's inbox is addressed to the same
  // clinicDeviceId; only recipient_id (the clinic) differs, so fetch per clinic
  // and decrypt with that clinic's id. Delta-only (fetchUnread = read_at IS NULL,
  // within horizon, then marked read), so re-firing stays egress-bounded.
  useEffect(() => {
    if (!isAuthenticated || !userId || clinicIds.length === 0 || !clinicDeviceId || clinicCatchUpDone.current) return

    ;(async () => {
      const results = await Promise.all(
        clinicIds.map(cId => fetchUnreadMessages(cId, clinicDeviceId).then(r => ({ cId, r }))),
      )

      // Mark done only when every clinic drained cleanly — a partial failure
      // leaves the flag false so the next trigger retries the failed clinic(s).
      // The succeeded clinics still process below; their rows get marked read, so
      // the retry re-fetches only the genuinely-missing delta.
      if (results.every(({ r }) => r.ok)) clinicCatchUpDone.current = true
      else logger.warn('Clinic catch-up: one or more clinics failed; will retry on next trigger')

      const processedRowIds: string[] = []

      for (const { cId, r } of results) {
        if (!r.ok) continue
        logger.info(`Clinic catch-up ${cId}: ${r.data.length} unread messages`)
        for (const row of r.data) {
          if (processedIds.current.has(row.id)) continue
          trackProcessed(row.id)
          try {
            const envelope = row.payload as unknown as import('../lib/signal/sealedSender').SealedEnvelope
            const senderDeviceId = row.sender_device_id ?? 'unknown'
            const { plaintext: rawPlaintext } = await processClinicIncomingMessage(
              senderDeviceId, envelope, cId
            )
            processedRowIds.push(row.id)
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
            if (isUnrecoverableClinicDecrypt(e)) {
              // Undeliverable forever — mark read so it leaves the unread delta
              // instead of re-draining (and re-logging) on every reconnect.
              processedRowIds.push(row.id)
              logger.warn(`Dropping undecryptable clinic message ${row.id} (marking read):`, e instanceof Error ? e.message : e)
            } else {
              logger.warn(`Failed to decrypt clinic message ${row.id}:`, e instanceof Error ? e.message : e)
            }
          }
        }
      }

      if (processedRowIds.length > 0) {
        markMessagesRead(processedRowIds).catch(() => {})
      }
    })()
  }, [isAuthenticated, userId, clinicIds, clinicDeviceId, catchUpTrigger])

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

      decryptRowInOrder(row, myUuid, decryptSideEffectsRef.current).then((decrypted) => {
        if (!decrypted) {
          if (CONTROL_PLANE_TYPES.has(row.message_type)) {
            markMessagesRead([row.id]).catch(() => {})
          } else {
            processedIds.current.delete(row.id)
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
            [row.id],
            myUuid,
            myDeviceId,
            row.origin_id ? [row.origin_id] : undefined,
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

      // Vault-first rows: every device of the user reads them, in order, via
      // the vault chain (which owns dedupe and the cursor).
      if (row.recipient_device_id === VAULT_DEVICE_ID) {
        void enqueueVaultRow(row)
        return
      }

      if (myDeviceId && row.recipient_device_id && row.recipient_device_id !== myDeviceId) {
        logger.debug(`Skipping message ${row.id}: for device ${row.recipient_device_id}, not ${myDeviceId}`)
        return
      }

      if (processedIds.current.has(row.id)) {
        logger.debug(`Skipping duplicate message ${row.id}`)
        return
      }
      trackProcessed(row.id)

      decryptRowInOrder(row, myUuid, decryptSideEffectsRef.current).then((decrypted) => {
        if (!decrypted) {
          // Null means non-visible (sender-key-distribution) or decrypt failure.
          // Only mark-read for non-recoverable types — handshake/session failures
          // stay unread (and untracked) so catch-up retries them (after sessions
          // restore from backup, pre-keys replenish, etc.). Marking them read here
          // is how request-accepted rows on fresh-X3DH paths disappear permanently.
          if (CONTROL_PLANE_TYPES.has(row.message_type)) {
            markMessagesRead([row.id]).catch(() => {})
          } else {
            processedIds.current.delete(row.id)
          }
          return
        }
        applyDecrypted(row, decrypted, myUuid, myDeviceId)
      })
    },
    [applyDecrypted, enqueueVaultRow],
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
      if (!myClinicDeviceId) return

      // The clinic this row was addressed to (home or a loan). The eq/in filter
      // already scopes recipient_id to our clinics; re-check defensively and use
      // THIS clinic's id to decrypt — never the primary, or a loan message would
      // decrypt under the wrong clinic session.
      const rowClinicId = row.recipient_id
      if (!rowClinicId || !clinicIdsRef.current.includes(rowClinicId)) return

      // Only process messages for this clinic device
      if (row.recipient_device_id && row.recipient_device_id !== myClinicDeviceId) return

      if (processedIds.current.has(row.id)) return
      trackProcessed(row.id)

      ;(async () => {
        try {
          const envelope = row.payload as unknown as SealedEnvelope
          const senderDeviceId = row.sender_device_id ?? 'unknown'
          const { plaintext: rawPlaintext } = await processClinicIncomingMessage(
            senderDeviceId, envelope, rowClinicId
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
          if (isUnrecoverableClinicDecrypt(e)) {
            // Undeliverable forever — mark read so catch-up doesn't re-drain it.
            markMessagesRead([row.id]).catch(() => {})
            logger.warn(`Dropping undecryptable clinic realtime message ${row.id} (marking read):`, e instanceof Error ? e.message : e)
          } else {
            logger.warn(`Failed to decrypt clinic realtime message ${row.id}:`, e instanceof Error ? e.message : e)
          }
        }
      })()
    },
    [],
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
