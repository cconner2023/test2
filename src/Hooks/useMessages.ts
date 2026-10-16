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
  fetchPeerBundleForDevice,
  fetchPeerBundlePublic,
  sendMessageFanOut,
  fetchGroupConversation,
  markMessagesRead,
  hardDeleteByOriginId,
  hardDeleteRecipientOrigin,
  hardDeleteSystemOrigin,
} from '../lib/signal/signalService'
import {
  fetchMyGroups as fetchMyGroupsRpc,
  createGroup as createGroupRpc,
  leaveGroup as leaveGroupRpc,
  renameGroup as renameGroupRpc,
  addGroupMember as addGroupMemberRpc,
  removeGroupMember as removeGroupMemberRpc,
  promoteGroupMember as promoteGroupMemberRpc,
  demoteGroupMember as demoteGroupMemberRpc,
  purgeGroup as purgeGroupRpc,
  fetchGroupMembers as fetchGroupMembersRpc,
} from '../lib/signal/groupService'
import type { GroupInfo, GroupMember } from '../lib/signal/groupTypes'
import { createOutboundSession } from '../lib/signal/session'
import {
  getLocalDeviceId,
} from '../lib/signal/keyManager'
import { sendToUser } from '../lib/signal/vaultSend'
import { deleteSenderKeysForGroup } from '../lib/signal/senderKeyStore'
import {
  getGroupSecretMeta,
  setGroupSecret,
  deleteGroupSecret,
  generateGroupSecret,
} from '../lib/signal/groupNameCrypto'
import { onGroupRefresh } from '../lib/signal/groupRefreshBus'
import { VAULT } from '../lib/constants'
import {
  saveMessage,
  updateReadAt,
  updateMessageText,
  markDelivered,
  deleteMessages as deleteMessagesFromDb,
  deleteMessagesByOriginId as deleteMessagesByOriginIdFromDb,
} from '../lib/signal/messageStore'
import {
  serializeContent,
} from '../lib/signal/messageContent'
import type { MessageContent, ImageContent, VoiceContent, ReplyTo, OutsideSessionContent } from '../lib/signal/messageContent'
import type { CallSignalBody } from '../lib/webrtc/callSignalBus'
import { getOrCreateClinicSystemGroup } from '../lib/systemMessageService'
import { revokeOutsideEntity } from '../lib/outsideEntityService'
import { routeOutsideEntityReply } from '../lib/outsideEntityRouting'
import { getOutsideEntityChannel, removeOutsideEntityChannel } from '../lib/outsideEntityChannelStore'
import {
  SYSTEM_USER_ID,
  ensureSystemIdentity,
  encryptAsSystem,
  sendSystemEnvelopeToDevice,
} from '../lib/signal/systemIdentity'
import { useCalendarStore } from '../stores/useCalendarStore'
import { isCalendarEvent, routeCalendarEvent } from '../lib/calendarRouting'
import { isMapOverlay, isMapFeature, routeMapOverlay, routeMapFeature } from '../lib/mapOverlayRouting'
import { isPropertyEvent, routePropertyEvent } from '../lib/propertyEventRouting'
import { uploadEncryptedAttachment } from '../lib/signal/attachmentService'
import { createBackup, markHydrationComplete, scheduleBackup } from '../lib/signal/backupService'
import { ok as okResult, err as errResult, type Result } from '../lib/result'
import { errorBus } from '../lib/errorBus'
import { ErrorCode } from '../lib/errorCodes'
import { resizeImage, getImageDimensions, generateThumbnail, dataUrlToBlob } from '../Utilities/imageUtils'
import type { VoiceRecordingResult } from '../Utilities/voiceUtils'
import type { DecryptedSignalMessage, FanOutMessageInput, SyncMessagePayload } from '../lib/signal/transportTypes'
import type { PublicKeyBundle } from '../lib/signal/types'
import type { PeerBundleRpcResult } from '../lib/signal/transportTypes'
import { useMessagingStore } from '../stores/useMessagingStore'

const logger = createLogger('Messages')

/** Session-reset recovery (see requestSessionReset). Failures from one peer
 *  device are batched for SESSION_RESET_BATCH_MS so a catch-up burst sends one
 *  reset; resets per device are throttled to one per SESSION_RESET_THROTTLE_MS
 *  (each one consumes a one-time pre-key). Resend lists are capped. */
const SESSION_RESET_BATCH_MS = 1_500
const SESSION_RESET_THROTTLE_MS = 60_000
const SESSION_RESET_MAX_RESEND = 100

/** Membership-change announcements. These are ordinary group messages sent by
 *  the actor (the UI already labels the sender), so they read as "Doe: created
 *  this group". They exist for UX *and* to seed the per-group name secret: every
 *  group row carries it (wrapGroupPayload), so a new member gets it off this
 *  message and a post-removal rotation reaches the remaining members. Operational
 *  vocabulary only — no PHI. */
const GROUP_ANNOUNCE = {
  created: 'created this group',
  memberAdded: 'added a member to this group',
  memberRemoved: 'removed a member from this group',
} as const

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
  // Implicit acceptance: peer replied with a regular message after our request.
  // Match both 'message' and 'initial' — peer replies arrive as 'initial' on the
  // wire whenever they need a fresh X3DH (e.g. peer is on a provisional tab with
  // no persisted session state, so every send is a new handshake). Mirrors the
  // isUserMessage definition in useSignalMessages.ts.
  if (weSentRequest) {
    for (const m of msgs) {
      if (m.senderId !== userId && (m.messageType === 'message' || m.messageType === 'initial')) return 'accepted'
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
 * Send a sync message to this user's own vault, where every other device of
 * the user reads it (this device skips its own rows on receive). One row,
 * regardless of how many devices the user has. Fire-and-forget.
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
  await sendToUser(userId, localDeviceId, userId, JSON.stringify(syncPayload), 'sync', { originId, silent: true })
}

/**
 * Send a read-sync message to this user's own vault.
 */
async function sendReadSyncToOwnDevices(
  userId: string,
  localDeviceId: string,
  serializedPayload: string,
): Promise<void> {
  await sendToUser(userId, localDeviceId, userId, serializedPayload, 'sync', { silent: true })
}

/**
 * Encrypt serialized content and send it to a peer's vault (one row).
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
  return sendToUser(userId, localDeviceId, peerId, serialized, messageType, { groupId, originId })
}

/**
 * Encrypt and send a WebRTC call-signal control message to a peer's vault.
 *
 * Stamped `message_type='call-signal'` so the receiver's decryptRow routes it to
 * the call layer (callSignalBus) and never surfaces it as a chat message; every
 * device of the peer sees the ring. `silent` suppresses local message
 * notifications/receipts (control-plane); background FCM wake is governed by the
 * out-of-repo dispatcher independently.
 */
async function encryptAndSendCallSignal(
  userId: string,
  localDeviceId: string,
  peerId: string,
  serialized: string,
): Promise<Result<string>> {
  return sendToUser(userId, localDeviceId, peerId, serialized, 'call-signal', { silent: true })
}

/**
 * Wrap group content with the per-group name secret ({ __g: { s, e }, c }) so
 * every member — including one added later — can decrypt the group name. This
 * replaces the sender-key distribution's piggyback; receivers adopt the secret
 * only when its epoch is newer (useSignalMessages.unwrapGroupPayload).
 */
async function wrapGroupPayload(groupId: string, serialized: string): Promise<string> {
  const secretMeta = await getGroupSecretMeta(groupId)
  if (!secretMeta) return serialized
  return JSON.stringify({ __g: { s: secretMeta.secret, e: secretMeta.epoch }, c: serialized })
}

/**
 * Encrypt content and deliver it to every group member's vault — one row per
 * member (vault-first). Each row is a self-contained X3DH envelope, so there is
 * no sender-key state to distribute, request, or rotate: a removed member simply
 * stops being a recipient. All rows share `originId` so delivery-receipt
 * matching and dedup are unaffected. Own devices get the content via
 * sendSyncToOwnDevices (called by each caller).
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
  const wrapped = await wrapGroupPayload(groupId, serialized)
  let firstServerId: string | null = null
  const unreachable: string[] = []
  for (const member of members) {
    if (member.userId === userId) continue
    const result = await sendToUser(userId, localDeviceId, member.userId, wrapped, 'message', { groupId, originId, silent })
    if (result.ok) {
      firstServerId ??= result.data
    } else {
      unreachable.push(member.userId)
    }
  }
  if (unreachable.length > 0) {
    // Not fatal: these members have no vault yet. usePeerAvailability drives the
    // user-facing "can't receive messages yet" banner independently.
    logger.info(`Group ${groupId}: ${unreachable.length} member(s) unreachable, skipped.`)
  }
  // No other members — still a successful send if nothing failed to encrypt.
  return okResult(firstServerId ?? crypto.randomUUID())
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
  /**
   * Send a structured-content message to a peer (1:1). Mirrors sendMessage's
   * accepted-conversation path but accepts arbitrary MessageContent + a
   * caller-supplied originId. Used for non-text payloads like shared object
   * references. Only valid in an open (received/accepted) conversation —
   * UNLESS `opts.openAsRequest` is set, in which case a 'none' conversation is
   * opened by sending the content as the first message REQUEST (used by the
   * cross-cluster bundle share, which starts a fresh thread with an out-cluster
   * peer). 'sent' (a pending outbound request already exists) still refuses.
   */
  sendStructured: (peerId: string, content: MessageContent, originId: string, preview: string, opts?: { openAsRequest?: boolean }) => Promise<boolean>
  /**
   * Toggle an emoji reaction on a message. Works for 1:1, self, and group
   * conversations (routes by the conversation key). Applies optimistically to
   * the local target + persists it, then fans a `reaction` envelope to the peer
   * / group members and own devices. Reactions fold onto the target's
   * `reactions` map and never render as a bubble. `emoji` is an opaque code.
   */
  reactToMessage: (conversationKey: string, message: DecryptedSignalMessage, emoji: string) => void
  /** Send a voice note to a peer. Encrypts, uploads, and sends via Signal. */
  sendVoice: (peerId: string, recording: VoiceRecordingResult) => Promise<boolean>
  /** Send a WebRTC call-signal control message to a peer over the Signal session
   *  (message_type='call-signal'). Control-plane — never surfaces as a chat message. */
  sendCallSignal: (peerId: string, signal: CallSignalBody) => Promise<boolean>
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
  /** Dev-only. Send a system-authored notice to a single user (1:1, `messageType='system'`). */
  sendSystemMessageToUser: (peerId: string, text: string) => Promise<boolean>
  /** Dev-only. Send a system-authored notice into a clinic system group, resolving/creating the group. */
  sendSystemMessageToClinic: (clinicId: string, text: string) => Promise<boolean>
  /**
   * Send a structured-content message to a group. Used for non-text replies.
   * Caller supplies a precomputed originId — used as the message's originId
   * on the wire so callers that need to address subsequent purge/delete
   * envelopes can do so deterministically. Preview is the plaintext label
   * derived from the content type.
   */
  sendGroupStructured: (groupId: string, content: MessageContent, originId: string, preview: string) => Promise<boolean>
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
  /** Remove a member from a group (primary only). */
  removeGroupMember: (groupId: string, userId: string) => Promise<void>
  /** Promote a member to primary (primary only). Returns an error string on failure. */
  promoteGroupMember: (groupId: string, userId: string) => Promise<{ ok: boolean; error?: string }>
  /** Demote a primary to member (primary only). Refuses to demote the last primary. */
  demoteGroupMember: (groupId: string, userId: string) => Promise<{ ok: boolean; error?: string }>
  /** Purge the entire group — messages + group (primary only). */
  purgeGroup: (groupId: string) => Promise<{ ok: boolean; error?: string }>
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

/**
 * Local teardown for a group we are no longer part of (purge / leave / removed).
 * Standard delete treatment: drop the conversation from state + IDB and write a
 * tombstone (blocks resurrection from a vault drain / realtime echo), remove the
 * group from the list, and delete its group-scoped crypto (sender keys + name
 * secret). Server-side rows are handled separately: purge_message_group deletes
 * them for a purge, and the reap_orphaned_group_messages cron sweeps a removed
 * member's undrained copies.
 */
async function purgeLocalGroup(groupId: string): Promise<void> {
  await store().deleteConversation(groupId).catch(() => {})
  store().removeGroup(groupId)
  await deleteSenderKeysForGroup(groupId).catch(() => {})
  await deleteGroupSecret(groupId).catch(() => {})
}

export function useMessages(): UseMessagesReturn {
  const { user, localSession, isAuthenticated, clinicId, surrogateClinicIds, isDevRole } = useAuth()
  const userId = user?.id ?? null
  // IDB is keyed by the stable account id, which the sync-hydrated local session
  // carries before the async auth round-trip sets `user`. Hydrate the message
  // cache off this so the home Messages widget paints from IDB on first mount
  // instead of waiting for the network. Same account guaranteed: localSession is
  // cleared on logout, so it can only be the returning user here. Realtime still
  // uses `userId` (it needs the live Supabase JWT, which only exists post-auth).
  const hydrationUserId = user?.id ?? localSession?.userId ?? null
  const isPageVisible = usePageVisibility()

  // System-inbox drain is admin-scoped: AdminDrawer / AdminUserDetail /
  // AdminClinicDetail trigger drainSystemInbox() on mount + visibility resume.
  // Sign-in still kicks an initial drain (useAuthStore) so the first admin
  // open after a fresh session isn't empty. Keeping system traffic off the
  // app-wide hook avoids the Realtime-RLS edge case where postgres_changes
  // doesn't propagate rows matched only via is_dev()-gated predicates.

  // Register clinic as a system group so its messages are excluded from unread totals
  useEffect(() => {
    if (clinicId) {
      useMessagingStore.getState().setSystemGroupIds(new Set([clinicId]))
    }
  }, [clinicId])

  // Track which peer's chat is currently open (for auto-mark-read)
  const activePeerRef = useRef<string | null>(null)

  // Group IDs seen in the last SUCCESSFUL fetch_my_groups. Purge-on-absence
  // diffs against this (not optimistic store state) so a group is only torn down
  // when it genuinely disappears between two server fetches — never when it's
  // merely newly-created locally or absent from a racing fetch.
  const serverGroupIdsRef = useRef<Set<string>>(new Set())

  // Session-reset recovery state, keyed `${peerId}:${peerDeviceId}`: failures
  // pending a batched reset, and the last reset attempt per device.
  const pendingSessionResetRef = useRef<Map<string, { rowIds: Set<string>; originIds: Set<string> }>>(new Map())
  const sessionResetAtRef = useRef<Map<string, number>>(new Map())

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
    // Delivery receipt — match by originId (shared across the group fan-out) so
    // EVERY member's receipt lands on the sender's copy, and accumulate the
    // delivering member into the persisted deliveredTo delta cache.
    if (msg._deliveryReceipt) {
      const { messageIds, originIds } = msg._deliveryReceipt
      const deliveredBy = msg.senderId
      const affected = store().applyDeliveryReceipt({ messageIds, originIds, deliveredBy })
      if (affected.length > 0) markDelivered(affected, deliveredBy).catch(() => {})
      markMessagesRead([msg.id]).catch(() => {})
      return
    }

    // Read-sync from another own device
    if (msg._readSync) {
      const { peerId, messageIds, readAt } = msg._readSync
      // The sender device's row ids don't exist here — resolve its originIds
      // (shared across the fan-out) to this device's local ids.
      let originIds: string[] = []
      try {
        const parsed = JSON.parse(msg.plaintext) as { originIds?: unknown }
        if (Array.isArray(parsed.originIds)) {
          originIds = parsed.originIds.filter((x): x is string => typeof x === 'string')
        }
      } catch { /* legacy payload without originIds */ }
      const idSet = new Set(messageIds)
      const originSet = new Set(originIds)
      const localIds = (store().conversations[peerId] ?? [])
        .filter(m => idSet.has(m.id) || (m.originId && originSet.has(m.originId)))
        .map(m => m.id)
      updateReadAt(localIds, readAt).catch(e =>
        errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.handleIncomingMessage', message: 'Failed to apply remote read sync to IDB', timestamp: Date.now(), metadata: { error: e } })
      )
      store().applyReadSync(peerId, localIds, readAt)
      markMessagesRead([msg.id]).catch(() => {})
      return
    }

    // Conversation-deleted sync from another own device
    if (msg.messageType === 'sync') {
      try {
        const parsed = JSON.parse(msg.plaintext) as Record<string, unknown>
        if (parsed.__syncType === 'conversation-deleted') {
          const conversationKey = parsed.conversationKey as string
          // Sessions + sender keys are kept — see deleteConversation.
          await store().deleteConversation(conversationKey)
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

    // Map overlays follow the same out-of-band routing as calendar events.
    // Awaited because overlay/feature routes share a single IDB row under
    // read-modify-write — parallel fire-and-forget would drop deltas.
    if (isMapOverlay(msg.content)) {
      await routeMapOverlay(msg.content).catch(() => {})
      return
    }

    // Single-feature overlay envelopes ride the same routing.
    if (isMapFeature(msg.content)) {
      await routeMapFeature(msg.content).catch(() => {})
      return
    }

    // Property entities (items/zones/custody/discrepancies/tags) ride the same
    // out-of-band clinic-vault fan-out as calendar/overlay.
    if (isPropertyEvent(msg.content)) {
      await routePropertyEvent(msg.content).catch(() => {})
      return
    }

    // Emoji reactions are folded onto the target message (out-of-band, like
    // calendar/overlay sync) — never surfaced as a bubble or counted unread.
    // The reactor identity is the reaction's senderId. Persist the mutated
    // target so the reaction survives reload.
    if (msg.content?.type === 'reaction') {
      const { targetId, emoji, remove } = msg.content
      const conversationKey = msg.groupId ?? (msg.senderId === userId ? msg.recipientId : msg.senderId)
      store().applyReaction(conversationKey, targetId, emoji, msg.senderId, !!remove)
      const updated = store().conversations[conversationKey]?.find(
        m => m.id === targetId || m.originId === targetId,
      )
      if (updated && userId) saveMessage(updated, userId).catch(() => {})
      markMessagesRead([msg.id]).catch(() => {})
      return
    }

    // Outside-session card lifecycle (lives in the on-call group conversation).
    // open → upsert the durable card; close/reply-sent → fold onto it (status +
    // appended replies), never a standalone bubble. De-duped by session_id.
    if (msg.content?.type === 'outside_session') {
      const c = msg.content
      const conversationKey = msg.groupId ?? msg.recipientId
      const exists = (store().conversations[conversationKey] ?? []).some(
        m => m.content?.type === 'outside_session' && m.content.session_id === c.session_id,
      )
      if (!exists) addMessage(msg)
      markMessagesRead([msg.id]).catch(() => {})
      return
    }
    if (msg.content?.type === 'outside_session_update') {
      const upd = msg.content
      const conversationKey = msg.groupId ?? msg.recipientId
      const card = store().conversations[conversationKey]?.find(
        m => m.content?.type === 'outside_session' && m.content.session_id === upd.session_id,
      )
      if (card && card.content?.type === 'outside_session') {
        const prev = card.content
        const replies = upd.reply && !(prev.replies ?? []).some(r => r.reply_id === upd.reply!.reply_id)
          ? [...(prev.replies ?? []), upd.reply]
          : prev.replies
        const merged: OutsideSessionContent = {
          ...prev,
          ...(upd.status === 'ended' ? { status: 'ended' as const } : {}),
          ...(upd.closed_reason ? { closed_reason: upd.closed_reason } : {}),
          ...(upd.closed_at ? { closed_at: upd.closed_at } : {}),
          ...(replies ? { replies } : {}),
        }
        store().updateMessageContent(conversationKey, card.id, merged)
        const updated = store().conversations[conversationKey]?.find(m => m.id === card.id)
        if (updated && userId) saveMessage(updated, userId).catch(() => {})
      }
      markMessagesRead([msg.id]).catch(() => {})
      return
    }

    // ── Outbound outside-contact: an outside party's reply, relayed onto this
    // transport by the outside-entity-relay edge fn. The signal envelope was only
    // delivery; the body is still ECIES-sealed to the channel key, which lives in
    // outsideEntityChannelStore (NOT in a message — deleting messages must not kill
    // the channel). Open it, then re-author as a NORMAL message so unread counts,
    // the notification toast, the list preview, backup and delete are all the stock
    // 1:1 paths rather than anything bespoke.
    if (msg.content?.type === 'outside_entity_reply') {
      const reply = msg.content
      // Ack the transport row regardless of whether we can read the body — an
      // un-ackable row would be redelivered forever.
      markMessagesRead([msg.id]).catch(() => {})
      const text = await routeOutsideEntityReply(reply)
      // No channel key ⇒ revoked, expired, or a device that never held it. Dropping
      // is correct: this is the kill switch and the 24h expiry working as designed.
      if (text === null) return

      // Identity is the outside_entity_messages row id, SHARED with the catch-up
      // drain — so the same reply can arrive by either path exactly once, and an
      // origin tombstone from a message-delete still blocks resurrection.
      // senderId = entity_id makes the store bucket this under the channel's
      // conversation (conversationKey = senderId when senderId !== userId).
      const relayed: DecryptedSignalMessage = {
        id: reply.message_id,
        senderId: reply.entity_id,
        recipientId: userId,
        plaintext: text,
        content: { type: 'text', text },
        messageType: 'message',
        createdAt: reply.created_at,
        readAt: activePeerRef.current === reply.entity_id ? new Date().toISOString() : null,
        originId: reply.message_id,
      }
      addMessage(relayed)
      if (activePeerRef.current !== reply.entity_id) onIncomingRef.current?.(relayed)
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

  // Session-reset recovery, receiver side. A peer device sent us a ratchet
  // packet but we hold no session with it (our half was lost while theirs
  // survived), so everything it sends fails. Reply with a fresh X3DH initial to
  // that one device: decrypting it replaces the peer's stale session, and the
  // payload lists the 1:1 content originIds that failed so the peer re-sends
  // them. Rides the 'receipt' wire type (see decryptRow). Failed rows are
  // marked read only once the reset is out — until then catch-up retries them.
  const requestSessionReset = useCallback((peerId: string, peerDeviceId: string, rowId: string, originId?: string) => {
    if (!userId || peerId === SYSTEM_USER_ID || peerDeviceId === 'unknown' || peerDeviceId === 'edge') return
    const key = `${peerId}:${peerDeviceId}`
    const pending = pendingSessionResetRef.current.get(key)
    if (pending) {
      pending.rowIds.add(rowId)
      if (originId) pending.originIds.add(originId)
      return
    }
    pendingSessionResetRef.current.set(key, {
      rowIds: new Set([rowId]),
      originIds: new Set(originId ? [originId] : []),
    })

    setTimeout(() => {
      void (async () => {
        const batch = pendingSessionResetRef.current.get(key)
        pendingSessionResetRef.current.delete(key)
        const localDeviceId = useMessagingStore.getState().localDeviceId
        if (!batch || !localDeviceId) return
        const now = Date.now()
        if (now - (sessionResetAtRef.current.get(key) ?? 0) < SESSION_RESET_THROTTLE_MS) return
        sessionResetAtRef.current.set(key, now)

        try {
          // messageIds:[] + no originIds makes this a no-op receipt on older clients.
          const body = JSON.stringify({
            __type: 'session-reset',
            messageIds: [],
            resendOriginIds: [...batch.originIds].slice(0, SESSION_RESET_MAX_RESEND),
            deliveredAt: new Date().toISOString(),
          })
          // Always a NEW handshake — a session may exist but have diverged
          // (SessionMismatchError), and re-using it would just fail again. The
          // superseded session is archived, not dropped.
          const bundleResult = await fetchPeerBundleForDevice(peerId, peerDeviceId)
          if (!bundleResult.ok) {
            sessionResetAtRef.current.delete(key)
            return
          }
          const envelope = await createOutboundSession(peerId, peerDeviceId, rpcResultToBundle(bundleResult.data), body, userId)
          const fanOutInputs: FanOutMessageInput[] = [{
            recipientDeviceId: peerDeviceId,
            payload: envelope as unknown as Record<string, unknown>,
            messageType: 'receipt',
          }]
          const sent = await sendMessageFanOut(userId, localDeviceId, peerId, fanOutInputs, undefined, undefined, true)
          if (!sent.ok) {
            sessionResetAtRef.current.delete(key)
            return
          }
          markMessagesRead([...batch.rowIds]).catch(() => {})
          logger.info(`Requested session reset from ${key} (${batch.originIds.size} to re-send)`)
        } catch (e) {
          sessionResetAtRef.current.delete(key)
          logger.warn('requestSessionReset failed:', e instanceof Error ? e.message : e)
        }
      })()
    }, SESSION_RESET_BATCH_MS)
  }, [userId])

  // Session-reset recovery, sender side (pre-vault-first per-device rows). A
  // peer device couldn't open 1:1 messages we sent before the vault-first cut;
  // re-send them to the peer's vault under their original originIds so receipts
  // and deletes still line up (their other devices dedupe by originId).
  const handleSessionReset = useCallback(async (requesterId: string, requesterDeviceId: string, originIds: string[]) => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId || requesterId === userId || originIds.length === 0) return
    const wanted = new Set(originIds.slice(0, SESSION_RESET_MAX_RESEND))
    const toResend = (store().conversations[requesterId] ?? [])
      .filter(m =>
        m.senderId === userId && !m.groupId && !!m.originId && wanted.has(m.originId) &&
        (m.messageType === 'message' || m.messageType === 'request'))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (toResend.length === 0) return

    for (const m of toResend) {
      try {
        const content: MessageContent = m.content ?? {
          type: 'text',
          text: m.plaintext,
          ...(m.threadId ? { replyTo: { messageId: m.threadId, preview: m.replyPreview ?? '' } } : {}),
        }
        const type = m.messageType === 'request' ? 'request' : 'message'
        await sendToUser(userId, localDeviceId, requesterId, serializeContent(content), type, { originId: m.originId })
      } catch (e) {
        logger.warn(`Session-reset re-send of ${m.originId} failed:`, e instanceof Error ? e.message : e)
      }
    }
    logger.info(`Re-sent ${toResend.length} message(s) to ${requesterId}:${requesterDeviceId} after session reset`)
  }, [userId])

  // Subscribe to realtime incoming messages
  useSignalMessages({
    userId,
    localDeviceId: useMessagingStore.getState().localDeviceId,
    clinicId: clinicId ?? null,
    surrogateClinicIds,
    clinicDeviceId: useMessagingStore.getState().clinicDeviceId,
    isDevRole,
    isAuthenticated: isAuthenticated && !!useMessagingStore.getState().localDeviceId,
    isPageVisible,
    onMessage: handleIncomingMessage,
    onDelete: removeMessagesByOriginIds,
    onSessionMissing: requestSessionReset,
    onSessionReset: handleSessionReset,
  })

  // Hydrate from IDB on mount and re-hydrate after backup restore. Keyed on the
  // eager id so the cache paints before the async auth round-trip completes.
  useEffect(() => {
    if (!hydrationUserId) return

    let cancelled = false

    async function hydrate() {
      await useMessagingStore.getState().hydrateFromIdb(hydrationUserId!)
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
  }, [hydrationUserId])

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
    const currentIds = new Set(result.data.map(g => g.groupId))

    // Purge-on-absence: a group present in the PREVIOUS successful server fetch
    // but gone from this one means we were removed (or left). Diffing against the
    // last server fetch — not optimistic store state — avoids tearing down a
    // freshly-created or not-yet-fetched group (which would wrongly tombstone it
    // and suppress its history via addMessage's tombstone guard). System groups
    // are auto-managed and never purged this way. First fetch after login has an
    // empty prev set, so nothing is purged on cold start.
    const prevServerIds = serverGroupIdsRef.current
    const prevGroups = store().groups
    const vanished = [...prevServerIds].filter(id => !currentIds.has(id))
    serverGroupIdsRef.current = currentIds

    useMessagingStore.getState().setGroups(map)

    for (const gid of vanished) {
      if (prevGroups[gid]?.systemType != null) continue // never purge system groups
      logger.info(`Group ${gid} no longer accessible — purging local group state`)
      await purgeLocalGroup(gid)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    refreshGroups().catch(e => logger.warn('Group hydration failed:', e))
  }, [userId, refreshGroups])

  // A piggybacked group-name secret just landed (or a group we don't know about
  // yet sent us one). Re-hydrate so the encrypted name resolves in this session.
  useEffect(() => {
    if (!userId) return
    return onGroupRefresh((groupId) => {
      refreshGroups().catch(e =>
        logger.warn(`Group re-hydration after secret adoption failed (${groupId}):`, e)
      )
    })
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
        // One row to our own vault — our other devices read it from there.
        const sendResult = await sendToUser(userId, localDeviceId, userId, serialized, 'message', { originId, silent: true })
        if (!sendResult.ok) {
          logger.error('Self-note fan-out failed:', sendResult.error)
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

    // System replies bypass the request gate: System initiates contact, the
    // user can reply freely. Every send is a self-contained X3DH to SYSTEM's
    // inbox device (vaultSend) — drainSystemInbox does NOT persist receiver
    // ratchet state across batches.
    if (peerId === SYSTEM_USER_ID) {
      const localId = crypto.randomUUID()
      const originId = crypto.randomUUID()
      const now = new Date().toISOString()
      const content: MessageContent = { type: 'text', text, ...(replyTo && { replyTo }) }
      addMessage({
        id: localId,
        senderId: userId,
        recipientId: SYSTEM_USER_ID,
        plaintext: text,
        content,
        messageType: 'message',
        createdAt: now,
        readAt: null,
        status: 'sending',
        originId,
        ...(replyTo && { threadId: replyTo.messageId, replyPreview: replyTo.preview }),
      })

      store().setSending(SYSTEM_USER_ID, true)
      try {
        const serialized = serializeContent(content)
        const result = await encryptAndSendToPeer(
          userId, localDeviceId, SYSTEM_USER_ID, serialized, 'message', undefined, originId,
        )
        if (!result.ok) {
          logger.error('System reply send failed:', result.error)
          removeOptimisticMessage(SYSTEM_USER_ID, localId)
          return false
        }
        updateMessageStatus(SYSTEM_USER_ID, localId, result.data)
        return true
      } catch (e) {
        logger.error('System reply error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(SYSTEM_USER_ID, localId)
        return false
      } finally {
        store().setSending(SYSTEM_USER_ID, false)
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

  /**
   * Send a structured-content message to a peer (1:1). The caller-supplied
   * originId is used as the message's originId on the wire. Only sends in an
   * open conversation (received/accepted) — refuses on 'none'/'sent' so a
   * shared-ref card can't open a fresh request thread.
   */
  const sendStructured = useCallback(async (
    peerId: string,
    content: MessageContent,
    originId: string,
    preview: string,
    opts?: { openAsRequest?: boolean },
  ): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false

    // Self-notes: encrypt to own devices only.
    if (peerId === userId) {
      const localId = crypto.randomUUID()
      const now = new Date().toISOString()
      addMessage({
        id: localId, senderId: userId, recipientId: userId, plaintext: preview,
        content, messageType: 'message', createdAt: now, readAt: now,
        status: 'sending', originId,
      })
      try {
        const serialized = serializeContent(content)
        await sendToUser(userId, localDeviceId, userId, serialized, 'message', { originId, silent: true })
        const confirmedId = crypto.randomUUID()
        updateMessageStatus(userId, localId, confirmedId)
        saveMessage({
          id: confirmedId, senderId: userId, recipientId: userId, plaintext: preview,
          content, messageType: 'message', createdAt: now, readAt: now, originId,
        }, userId).catch(() => {})
        return true
      } catch (e) {
        logger.error('sendStructured (self) error:', e instanceof Error ? e.message : e)
        removeOptimisticMessage(userId, localId)
        return false
      }
    }

    const status = getRequestStatus(useMessagingStore.getState().conversations[peerId], userId)
    if (status === 'sent') return false

    // Open a fresh thread by sending the structured content as the first
    // REQUEST (cross-cluster bundle share). Mirrors sendMessage's 'none' path
    // but carries structured content. Without openAsRequest a 'none'
    // conversation still refuses (a shared_ref must not open a request thread).
    const messageType: 'message' | 'request' = status === 'none' ? 'request' : 'message'
    if (status === 'none' && !opts?.openAsRequest) return false

    const localId = crypto.randomUUID()
    const now = new Date().toISOString()
    addMessage({
      id: localId, senderId: userId, recipientId: peerId, plaintext: preview,
      content, messageType, createdAt: now, readAt: null,
      status: 'sending', originId,
    })

    store().setSending(peerId, true)
    try {
      const serialized = serializeContent(content)
      const result = await encryptAndSendToPeer(userId, localDeviceId, peerId, serialized, messageType, undefined, originId)
      if (!result.ok) {
        logger.error('Failed to send structured message:', result.error)
        removeOptimisticMessage(peerId, localId)
        return false
      }
      updateMessageStatus(peerId, localId, result.data)
      sendSyncToOwnDevices(userId, localDeviceId, {
        forPeerId: peerId, serialized, originalMessageType: messageType,
        originalTimestamp: now, originalMessageId: result.data,
      }, undefined, originId).catch(e =>
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendStructured', message: 'Failed to sync structured message to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
      return true
    } catch (e) {
      logger.error('sendStructured error:', e instanceof Error ? e.message : e)
      removeOptimisticMessage(peerId, localId)
      return false
    } finally {
      store().setSending(peerId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage])

  /**
   * Toggle an emoji reaction on a message — see UseMessagesReturn. Routes by
   * conversation key (self / 1:1 / group). Optimistic-local then best-effort
   * wire send; no offline queue (matches structured sends). Reactions fold onto
   * the target and never render as bubbles.
   */
  const reactToMessage = useCallback((conversationKey: string, message: DecryptedSignalMessage, emoji: string) => {
    if (!userId) return
    const targetId = message.originId ?? message.id
    const remove = (message.reactions?.[emoji] ?? []).includes(userId)

    // Optimistic local fold + persist the mutated target so it survives reload.
    store().applyReaction(conversationKey, targetId, emoji, userId, remove)
    const updatedTarget = store().conversations[conversationKey]?.find(
      m => m.id === message.id || m.originId === targetId,
    )
    if (updatedTarget) saveMessage(updatedTarget, userId).catch(() => {})

    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!localDeviceId) return

    const content: MessageContent = { type: 'reaction', targetId, emoji, ...(remove ? { remove: true } : {}) }
    const serialized = serializeContent(content)
    const originId = crypto.randomUUID()
    const isGroup = !!useMessagingStore.getState().groups[conversationKey]

    void (async () => {
      try {
        // Self-chat: fan to own other devices only.
        if (conversationKey === userId) {
          await sendToUser(userId, localDeviceId, userId, serialized, 'message', { originId, silent: true })
          return
        }

        if (isGroup) {
          const membersResult = await fetchGroupMembersRpc(conversationKey)
          if (!membersResult.ok) return
          const result = await encryptAndSendToGroupMembers(userId, localDeviceId, conversationKey, serialized, originId, membersResult.data)
          if (!result.ok) return
          sendSyncToOwnDevices(userId, localDeviceId, {
            forPeerId: conversationKey, serialized, originalMessageType: 'message',
            originalTimestamp: new Date().toISOString(), originalMessageId: result.data,
          }, conversationKey, originId).catch(() => {})
          return
        }

        // 1:1
        const result = await encryptAndSendToPeer(userId, localDeviceId, conversationKey, serialized, 'message', undefined, originId)
        if (!result.ok) return
        sendSyncToOwnDevices(userId, localDeviceId, {
          forPeerId: conversationKey, serialized, originalMessageType: 'message',
          originalTimestamp: new Date().toISOString(), originalMessageId: result.data,
        }, undefined, originId).catch(() => {})
      } catch (e) {
        logger.error('reactToMessage error:', e instanceof Error ? e.message : e)
      }
    })()
  }, [userId])

  /**
   * Send a system-authored notice to a single user. Dev-only — the
   * `send_signal_message_as_system` RPC + `signal_messages_system_gate`
   * trigger enforce is_dev() on insert. The wire row carries
   * sender_id=SYSTEM_USER_ID and the sealed cert is signed by system's
   * identity key, so the recipient renders the message as "from System"
   * via the synthetic peerProfile mask. Renders as a centered card on the
   * recipient (MessageBubble.tsx).
   *
   * Crypto: every send is a fresh X3DH initiator from system → recipient
   * (no persistent ratchet state for system) so multiple devs can send
   * concurrently without ratchet desync.
   *
   * The dev's local copy is stored with senderId=userId so it appears in
   * the dev's own outgoing thread — the wire copy is sender=SYSTEM but
   * that row only exists for the recipient.
   */
  const sendSystemMessageToUser = useCallback(async (peerId: string, text: string): Promise<boolean> => {
    if (!userId) return false

    const ensure = await ensureSystemIdentity()
    if (!ensure.ok) {
      logger.error('System identity unavailable:', ensure.error)
      return false
    }

    const localId = crypto.randomUUID()
    const originId = crypto.randomUUID()
    const now = new Date().toISOString()
    const content: MessageContent = { type: 'text', text }

    addMessage({
      id: localId,
      senderId: userId,
      recipientId: peerId,
      plaintext: text,
      content,
      messageType: 'system',
      createdAt: now,
      readAt: null,
      status: 'sending',
      originId,
    })

    store().setSending(peerId, true)
    try {
      const serialized = serializeContent(content)
      // One SYSTEM-authored row to the user's vault (vault-first); every one of
      // their devices reads it. The bundle is read, not consumed.
      let firstServerId: string | null = null
      const bundleResult = await fetchPeerBundlePublic(peerId, VAULT.DEVICE_ID)
      if (bundleResult.ok) {
        const enc = await encryptAsSystem(peerId, VAULT.DEVICE_ID, rpcResultToBundle(bundleResult.data), serialized)
        if (enc.ok) {
          const sendRes = await sendSystemEnvelopeToDevice(peerId, VAULT.DEVICE_ID, enc.data, undefined, originId)
          if (sendRes.ok) firstServerId = sendRes.data
        } else {
          logger.warn(`encryptAsSystem failed for ${peerId}: ${enc.error}`)
        }
      } else {
        logger.warn(`No vault bundle for ${peerId}`)
      }

      if (!firstServerId) {
        removeOptimisticMessage(peerId, localId)
        return false
      }

      updateMessageStatus(peerId, localId, firstServerId)

      // Author a SYSTEM-addressed "sent copy" so drain_system_inbox can
      // reconstruct the operator's OUTBOUND side on any dev device. The
      // dev→user rows above are sealed to the USER (recipient_id=user) and are
      // never drained (drain fetches recipient_id=SYSTEM only), so without this
      // the admin thread only repopulates once the user replies. Mirrors the
      // System-reply transport: a self-contained X3DH InitialMessage to SYSTEM
      // (drain does not persist receiver ratchet state across batches). The wrapper carries forPeerId because the SYSTEM envelope's
      // sealed-sender is the dev, not the target user; reusing the SAME originId
      // lets the sending device de-dupe its own optimistic copy on a later
      // drain. Best-effort — the operator message is already delivered.
      const localDeviceId = useMessagingStore.getState().localDeviceId
      if (localDeviceId) {
        const sentCopy = JSON.stringify({
          __systemSentCopy: true,
          forPeerId: peerId,
          serialized,
          originalMessageId: firstServerId,
          originalTimestamp: now,
        })
        try {
          await encryptAndSendToPeer(userId, localDeviceId, SYSTEM_USER_ID, sentCopy, 'message', undefined, originId)
        } catch (e) {
          logger.warn('Failed to author system sent-copy:', e instanceof Error ? e.message : e)
        }
      }

      return true
    } catch (e) {
      logger.error('sendSystemMessageToUser error:', e instanceof Error ? e.message : e)
      removeOptimisticMessage(peerId, localId)
      return false
    } finally {
      store().setSending(peerId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage])

  /**
   * Send a system-authored notice into the clinic-scoped system group. Resolves
   * or creates the group via `get_or_create_clinic_system_group`, registers the
   * group id in `systemGroupIds` so it's suppressed from unread totals, and
   * sends one row to every current member's vault with `messageType='system'`. (v1 membership is dev-only, so this is effectively
   * a fan-out to the dev's own devices.)
   */
  const sendSystemMessageToClinic = useCallback(async (clinicId: string, text: string): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false

    const groupResolve = await getOrCreateClinicSystemGroup(clinicId)
    if (!groupResolve.ok) {
      logger.error('Failed to resolve clinic system group:', groupResolve.error)
      return false
    }
    const { groupId } = groupResolve.data

    // Note: we deliberately do NOT add this group to `systemGroupIds`. System
    // messages are visible, interactive notices — recipients should see unread
    // badges and be able to reply. (`systemGroupIds` is reserved for one-way
    // fanout groups like the outside-event-intake group, which lands later.)

    const localId = crypto.randomUUID()
    const originId = crypto.randomUUID()
    const now = new Date().toISOString()
    const content: MessageContent = { type: 'text', text }

    addMessage({
      id: localId,
      senderId: userId,
      recipientId: userId,
      plaintext: text,
      content,
      messageType: 'system',
      createdAt: now,
      readAt: now,
      status: 'sending',
      groupId,
      originId,
    })

    store().setSending(groupId, true)
    try {
      const serialized = serializeContent(content)

      const membersResult = await fetchGroupMembersRpc(groupId)
      if (!membersResult.ok) {
        logger.error('Failed to fetch system group members:', membersResult.error)
        removeOptimisticMessage(groupId, localId)
        return false
      }

      // One row per member's vault — including our own, which our other devices
      // read (this device skips its own rows).
      let firstServerId: string | null = null
      for (const member of membersResult.data) {
        const sendResult = await sendToUser(userId, localDeviceId, member.userId, serialized, 'system', { groupId, originId })
        if (sendResult.ok && !firstServerId) firstServerId = sendResult.data
      }

      const confirmedId = firstServerId ?? crypto.randomUUID()
      updateMessageStatus(groupId, localId, confirmedId)

      saveMessage({
        id: confirmedId,
        senderId: userId,
        recipientId: userId,
        plaintext: text,
        content,
        messageType: 'system',
        createdAt: now,
        readAt: now,
        groupId,
        originId,
      }, userId).catch(e =>
        errorBus.emit({ code: ErrorCode.STORAGE_ERROR, source: 'useMessages.sendSystemMessageToClinic', message: 'Failed to save system message locally', timestamp: Date.now(), metadata: { error: e } })
      )

      return true
    } catch (e) {
      logger.error('sendSystemMessageToClinic error:', e instanceof Error ? e.message : e)
      removeOptimisticMessage(groupId, localId)
      return false
    } finally {
      store().setSending(groupId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage])

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
        // One row to our own vault — our other devices read it from there.
        const sendResult = await sendToUser(userId, localDeviceId, userId, serialized, 'message', { originId, silent: true })
        if (!sendResult.ok) {
          logger.error('Self-note image fan-out failed:', sendResult.error)
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

  // Send a WebRTC call-signal control message to a peer. Rides the Signal
  // session (the authorization gate); never surfaces as a chat message.
  const sendCallSignal = useCallback(async (peerId: string, signal: CallSignalBody): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false
    try {
      const result = await encryptAndSendCallSignal(userId, localDeviceId, peerId, JSON.stringify(signal))
      if (!result.ok) {
        logger.warn('sendCallSignal failed:', result.error)
        return false
      }
      return true
    } catch (e) {
      logger.error('sendCallSignal error:', e instanceof Error ? e.message : e)
      return false
    }
  }, [userId])

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
        // One row to our own vault — our other devices read it from there.
        const sendResult = await sendToUser(userId, localDeviceId, userId, serialized, 'message', { originId, silent: true })
        if (!sendResult.ok) {
          logger.error('Self-note voice fan-out failed:', sendResult.error)
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

    const state = useMessagingStore.getState()
    const msgs = state.conversations[peerId]
    if (!msgs) return

    const unreadMsgs = msgs.filter(m => m.senderId !== userId && !m.readAt)
    const unreadIds = unreadMsgs.map(m => m.id)

    // No-op guard: nothing to mark + no stale unread count → skip the store
    // write entirely. The store mutates conversations/unreadCounts by reference
    // on every call, which re-renders subscribers and (when this is called
    // from a ChatDetailView useEffect) creates an infinite update loop.
    if (unreadIds.length === 0 && !(peerId in state.unreadCounts)) return

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
        // Row ids are per-device (fan-out writes one row per recipient device),
        // so other own devices can only match by the shared originId.
        const readSyncPayload = JSON.stringify({
          __syncType: 'read',
          peerId,
          messageIds: unreadIds,
          originIds: unreadMsgs.map(m => m.originId).filter(Boolean),
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
      const sendResult = await sendToUser(userId, localDeviceId, peerId, serialized, 'request-accepted', { originId })
      if (!sendResult.ok) {
        logger.error('Failed to send request-accepted:', sendResult.error)
        return
      }

      const messageId = sendResult.data

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

    // NOTE: deleting MESSAGES never revokes an outbound outside-contact channel.
    // Blanking a thread is not ending it — the channel key lives in
    // outsideEntityChannelStore, not in any message, so the conversation stays live
    // and keeps receiving. Ending a channel is deleteConversation's job (the kill
    // switch). This was previously a revoke here, which made emptying a thread
    // silently destroy the channel.
    const originIds = messageIds
      .map(id => msgs.find(m => m.id === id)?.originId)
      .filter((oid): oid is string => !!oid)

    store().deleteMessages(peerId, messageIds)

    // Tombstone-first: the by-originId delete writes per-message tombstones
    // atomically with the row removal. saveMessage's origin-tombstone guard
    // then blocks any later resurrection (realtime echo, backup restore,
    // vault drain on a new device). For legacy rows with no originId, fall
    // back to the by-id helper. Backup is scheduled after both complete.
    const deletedAt = new Date().toISOString()
    const idbDeletes: Promise<unknown>[] = []
    if (originIds.length > 0) {
      idbDeletes.push(deleteMessagesByOriginIdFromDb(originIds, deletedAt))
    }
    const messageIdsWithoutOrigin = messageIds.filter(id => {
      const m = msgs.find(m => m.id === id)
      return !m?.originId
    })
    if (messageIdsWithoutOrigin.length > 0) {
      idbDeletes.push(deleteMessagesFromDb(messageIdsWithoutOrigin))
    }
    Promise.all(idbDeletes)
      .then(() => createBackup(userId))
      .catch(e => logger.warn('Failed to delete/re-sync:', e instanceof Error ? e.message : e))

    if (originIds.length === 0) return

    const deletePayload = JSON.stringify({ originIds })
    const deleteOriginId = crypto.randomUUID()

    const isGroup = !!useMessagingStore.getState().groups[peerId]
    // SYSTEM-authored cluster cards (intake / outside-message / oncall-call) arrive
    // sealed-sender on the personal channel (group_id NULL, sender_id NULL) and bucket
    // under the SYSTEM conversation. They are NOT a 1:1 peer: fanning the delete only to
    // SYSTEM's device leaves every OTHER clinic member's copy alive, and the sender-scoped
    // server purge can't touch sender_id=NULL rows. Treat them as a cluster broadcast:
    // fan the 'delete' envelope to every cluster-group member and purge cluster-wide.
    const isSystemCard = peerId === SYSTEM_USER_ID

    try {
      if (isSystemCard) {
        // Resolve the cluster group(s) for the deleted cards' clinic(s). The card content
        // carries clinic_id; fall back to all cluster groups the user belongs to.
        const clinicIds = new Set<string>()
        for (const id of messageIds) {
          const c = (msgs.find(m => m.id === id)?.content as { clinic_id?: string } | undefined)?.clinic_id
          if (c) clinicIds.add(c)
        }
        // SYSTEM cards route to either the supervisor 'system' group (intake) or the
        // whole-cluster 'oncall' group (outside-message / oncall-call). Fan to members of
        // both so the right audience tombstones their local copy, regardless of card type.
        const groups = useMessagingStore.getState().groups
        const clusterGroups = Object.values(groups).filter(
          g => g.systemType === 'oncall' || g.systemType === 'system',
        )
        const targetGroups = clinicIds.size > 0
          ? clusterGroups.filter(g => clinicIds.has(g.clinicId))
          : clusterGroups

        // Unique member set across target groups (dedupe so a member in >1 group gets one fan).
        const memberIds = new Set<string>()
        for (const g of targetGroups) {
          const membersResult = await fetchGroupMembersRpc(g.groupId)
          if (!membersResult.ok) continue
          for (const member of membersResult.data) {
            if (member.userId !== userId) memberIds.add(member.userId)
          }
        }

        for (const memberUserId of memberIds) {
          const sent = await sendToUser(userId, localDeviceId, memberUserId, deletePayload, 'delete', { originId: deleteOriginId, silent: true })
          if (!sent.ok) logger.warn(`Failed to send cluster delete to ${memberUserId}:`, sent.error)
        }
      } else if (isGroup) {
        // Group delete: peerId is a groupId, not a user — send the 'delete' to
        // every OTHER member's vault (own devices are covered by the own-vault
        // sync below). messageType='delete' routes through the recipient's
        // delete branch (deleteMessagesByOriginId), never rendered as a bubble.
        const membersResult = await fetchGroupMembersRpc(peerId)
        if (membersResult.ok) {
          for (const member of membersResult.data) {
            if (member.userId === userId) continue
            const sent = await sendToUser(userId, localDeviceId, member.userId, deletePayload, 'delete', { groupId: peerId, originId: deleteOriginId, silent: true })
            if (!sent.ok) logger.warn(`Failed to send group delete to ${member.userId}:`, sent.error)
          }
        }
      } else {
        // 1:1 peer delete. (SYSTEM-bucketed cards are handled by the isSystemCard
        // branch above, so peerId is always a real user here.)
        const sent = await sendToUser(userId, localDeviceId, peerId, deletePayload, 'delete', { originId: deleteOriginId, silent: true })
        if (!sent.ok) logger.warn('Failed to send delete to peer:', sent.error)
      }
    } catch (e) {
      logger.warn('Failed to send delete to peer:', e instanceof Error ? e.message : e)
    }

    try {
      const synced = await sendToUser(userId, localDeviceId, userId, deletePayload, 'delete', { originId: deleteOriginId, silent: true })
      if (!synced.ok) logger.warn('Failed to sync delete to own devices:', synced.error)
    } catch (e) {
      logger.warn('Failed to sync delete to own devices:', e instanceof Error ? e.message : e)
    }

    // SYSTEM cards are sealed-sender (sender_id NULL) with one row per member, so the
    // sender-scoped hardDeleteByOriginId purges nothing and RLS clears only the caller's
    // own row. Use the recipient-authorized cluster purge for those; sender-scoped for 1:1.
    const purge = isSystemCard ? hardDeleteRecipientOrigin : hardDeleteByOriginId
    purge(originIds).catch(e =>
      logger.warn('Failed to hard-delete from Supabase:', e instanceof Error ? e.message : e)
    )

    // Operator outbound + system-direct messages (messageType='system') are
    // authored via send_signal_message_as_system, which stamps sender_id=SYSTEM.
    // Neither the sender-scoped (sender_id=auth.uid()=dev) nor the
    // recipient-scoped purge above touches them, so they'd survive server-side
    // and resurrect on a fresh device. Add a dev-gated SYSTEM-origin purge.
    // SYSTEM is a real device-backed identity (user_devices 'primary'); only a
    // dev holds its keys, so the RPC is is_dev() gated and harmlessly no-ops for
    // non-SYSTEM origins.
    const hasSystemAuthored = isDevRole && messageIds.some(
      id => msgs.find(m => m.id === id)?.messageType === 'system',
    )
    if (hasSystemAuthored) {
      hardDeleteSystemOrigin(originIds).catch(e =>
        logger.warn('Failed to hard-delete SYSTEM-authored rows:', e instanceof Error ? e.message : e)
      )
    }
  }, [userId, isDevRole])

  /** Delete an entire conversation from state, unread counts, IDB, Supabase, and write tombstone. */
  const deleteConversation = useCallback(async (conversationKey: string) => {
    const localDeviceId = useMessagingStore.getState().localDeviceId

    // Collect originIds BEFORE store().deleteConversation removes messages from state
    const msgs = useMessagingStore.getState().conversations[conversationKey] ?? []
    const originIds = msgs.map(m => m.originId).filter((oid): oid is string => !!oid)

    // OUTBOUND OUTSIDE-CONTACT KILL SWITCH. For these channels the conversation key
    // IS the entity id, so a conversation delete ends the channel for BOTH sides:
    // revoke_outside_entity hard-deletes the server row (destroying the outside
    // party's wrapped key, so their tab flips to the expired view on its next poll)
    // and the local record dies with it. Awaited, unlike the old fire-and-forget
    // revoke: once the local key is gone we can never retry, so a silent offline
    // failure here would leave the outside party talking into a channel nobody can
    // read until the 24h purge. A failed revoke aborts the delete instead.
    const channel = await getOutsideEntityChannel(conversationKey).catch(() => null)
    if (channel) {
      const revoked = await revokeOutsideEntity(conversationKey)
      if (!revoked.ok) {
        logger.warn('Aborting conversation delete — outside channel could not be revoked')
        errorBus.emit({
          code: ErrorCode.SYNC_FAILED,
          source: 'useMessages.deleteConversation',
          message: 'This secure contact could not be ended. Check your connection and try again.',
          timestamp: Date.now(),
          metadata: { conversationKey },
        })
        return
      }
      await removeOutsideEntityChannel(conversationKey).catch(() => {})
    }

    // Write tombstone to store + IDB, remove from state
    await store().deleteConversation(conversationKey)

    // No crypto cleanup: deleting a conversation clears history, it does not end
    // the relationship. 1:1 pairwise sessions and group sender keys are transport
    // state the peers still hold their halves of — dropping ours makes every later
    // message from them undecryptable ("No session" / "No sender key"). Leaving a
    // group tears its keys down separately (purgeLocalGroup).

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
  /**
   * Send a structured-content message to a group. Mirrors sendGroupMessage
   * but accepts arbitrary MessageContent + a caller-supplied originId. The
   * caller-supplied originId is what callers downstream (e.g. purge_intake)
   * use to address subsequent delete envelopes.
   */
  const sendGroupStructured = useCallback(async (
    groupId: string,
    content: MessageContent,
    originId: string,
    preview: string,
  ): Promise<boolean> => {
    const localDeviceId = useMessagingStore.getState().localDeviceId
    if (!userId || !localDeviceId) return false

    const localId = crypto.randomUUID()
    const now = new Date().toISOString()

    addMessage({
      id: localId,
      senderId: userId,
      recipientId: groupId,
      plaintext: preview,
      content,
      messageType: 'message',
      createdAt: now,
      readAt: now,
      status: 'sending',
      groupId,
      originId,
    })

    store().setSending(groupId, true)
    try {
      const serialized = serializeContent(content)

      const membersResult = await fetchGroupMembersRpc(groupId)
      if (!membersResult.ok) {
        logger.error('Failed to fetch group members for structured send:', membersResult.error)
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
        errorBus.emit({ code: ErrorCode.SYNC_FAILED, source: 'useMessages.sendGroupStructured', message: 'Failed to sync structured group message to own devices', timestamp: Date.now(), metadata: { error: e } })
      )
      return true
    } catch (e) {
      logger.error('sendGroupStructured error:', e instanceof Error ? e.message : e)
      removeOptimisticMessage(groupId, localId)
      return false
    } finally {
      store().setSending(groupId, false)
    }
  }, [userId, addMessage, updateMessageStatus, removeOptimisticMessage])

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
    // Announce the group as a real message. Beyond being the expected UX, this
    // is what carries the per-group name secret to every member: every group row
    // carries it (wrapGroupPayload). Without a first send, members hold no
    // secret and render the encrypted name. Best-effort — a failed announcement must not fail create.
    await sendGroupMessage(result.data.groupId, GROUP_ANNOUNCE.created).catch(e =>
      logger.warn('Group-created announcement failed:', e instanceof Error ? e.message : e)
    )
    return result.data.groupId
  }, [refreshGroups, sendGroupMessage])

  /** Leave a group. */
  const leaveGroupFn = useCallback(async (groupId: string): Promise<void> => {
    const result = await leaveGroupRpc(groupId)
    if (!result.ok) {
      logger.error('leaveGroup failed:', result.error)
      return
    }
    // We are no longer a member — tear down local conversation + crypto so old
    // messages don't linger in IDB and can't resurrect.
    await purgeLocalGroup(groupId)
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
    // Announce the add. Adding a member does NOT bump the key epoch, so this send
    // reuses our existing sender key and (post rate-limit fix) does not proactively
    // re-distribute. The new member instead self-heals off this very message: they
    // receive our undecryptable sender-key-message → onSenderKeyMissing →
    // sender-key-request → we redistribute our key + the group-name secret. One
    // round-trip, no per-send fan-out to the whole group.
    await sendGroupMessage(groupId, GROUP_ANNOUNCE.memberAdded).catch(e =>
      logger.warn('Member-added announcement failed:', e instanceof Error ? e.message : e)
    )
  }, [refreshGroups, sendGroupMessage])

  /** Remove a member from a group. */
  const removeGroupMemberFn = useCallback(async (groupId: string, memberId: string): Promise<void> => {
    const result = await removeGroupMemberRpc(groupId, memberId)
    if (!result.ok) {
      logger.error('removeGroupMember failed:', result.error)
      return
    }
    // Server bumped key_epoch; pull the new epoch + (still old-secret-decrypted) name.
    await refreshGroups()

    // Rotate the group-name secret to the new epoch so the removed member can no
    // longer decrypt future name changes. Best-effort and single-authored (only
    // the remover mints it, avoiding divergence): requires that we currently hold
    // the old secret and the current name decrypted cleanly. Message content
    // needs no rotation: each group row is its own X3DH to a member's vault, so
    // the removed member simply stops being a recipient.
    try {
      const g = useMessagingStore.getState().groups[groupId]
      const oldMeta = await getGroupSecretMeta(groupId)
      const newEpoch = g?.keyEpoch ?? 0
      if (g && oldMeta && g.name && !g.name.startsWith('genc:')) {
        const newSecret = generateGroupSecret()
        await setGroupSecret(groupId, newSecret, newEpoch)
        const renameResult = await renameGroupRpc(groupId, g.name)
        if (!renameResult.ok) {
          // Roll back so the name stays decryptable for everyone who had the old secret.
          await setGroupSecret(groupId, oldMeta.secret, oldMeta.epoch)
          logger.warn('Group-name secret rotation rename failed; rolled back:', renameResult.error)
        }
      }
    } catch (e) {
      logger.warn('Group-name secret rotation skipped:', e instanceof Error ? e.message : e)
    }

    // Announce AFTER the rotation so this send carries the NEW secret to the
    // remaining members (wrapGroupPayload reads it from IDB at send time).
    await sendGroupMessage(groupId, GROUP_ANNOUNCE.memberRemoved).catch(e =>
      logger.warn('Member-removed announcement failed:', e instanceof Error ? e.message : e)
    )
  }, [refreshGroups, sendGroupMessage])

  /** Promote a member to primary. */
  const promoteGroupMemberFn = useCallback(async (groupId: string, memberId: string): Promise<{ ok: boolean; error?: string }> => {
    const result = await promoteGroupMemberRpc(groupId, memberId)
    if (!result.ok) {
      logger.error('promoteGroupMember failed:', result.error)
      return { ok: false, error: result.error }
    }
    await refreshGroups()
    return { ok: true }
  }, [refreshGroups])

  /** Demote a primary back to member. */
  const demoteGroupMemberFn = useCallback(async (groupId: string, memberId: string): Promise<{ ok: boolean; error?: string }> => {
    const result = await demoteGroupMemberRpc(groupId, memberId)
    if (!result.ok) {
      logger.error('demoteGroupMember failed:', result.error)
      return { ok: false, error: result.error }
    }
    await refreshGroups()
    return { ok: true }
  }, [refreshGroups])

  /** Purge the entire group — messages + group. */
  const purgeGroupFn = useCallback(async (groupId: string): Promise<{ ok: boolean; error?: string }> => {
    const result = await purgeGroupRpc(groupId)
    if (!result.ok) {
      logger.error('purgeGroup failed:', result.error)
      return { ok: false, error: result.error }
    }
    // Server rows are gone (purge RPC); tear down all local traces so nothing
    // lingers in IDB or resurrects from a vault drain.
    await purgeLocalGroup(groupId)
    return { ok: true }
  }, [])

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
    sendStructured,
    reactToMessage,
    sendVoice,
    sendCallSignal,
    sendSystemMessageToUser,
    sendSystemMessageToClinic,
    acceptRequest,
    getRequestStatusForPeer,
    fetchHistory,
    markAsRead,
    editMessage,
    deleteMessages,
    deleteConversation,
    sendGroupMessage,
    sendGroupStructured,
    sendGroupImage,
    sendGroupVoice,
    createGroup,
    leaveGroup: leaveGroupFn,
    renameGroup: renameGroupFn,
    addGroupMember: addGroupMemberFn,
    removeGroupMember: removeGroupMemberFn,
    promoteGroupMember: promoteGroupMemberFn,
    demoteGroupMember: demoteGroupMemberFn,
    purgeGroup: purgeGroupFn,
    fetchGroupMembers: fetchGroupMembersFn,
    fetchGroupHistory,
    refreshGroups,
    onIncomingRef,
    activePeerRef,
  }
}
