import { useMemo } from 'react'
import { useMessagingStore } from '../stores/useMessagingStore'
import { SYSTEM_USER_ID } from '../lib/signal/systemIdentity'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

export interface AdminSystemConversation {
  peerId: string
  peerProfile: ClinicMedic | null
  lastMessage: DecryptedSignalMessage
  lastAt: string
  unreadCount: number
}

/**
 * Predicate that flags a message as system-channel traffic.
 *
 * Two shapes both qualify:
 *  - Dev-authored outbound: `messageType === 'system'` (gate-enforced in
 *    `signal_messages_system_gate` trigger; only dev users can produce it).
 *  - User-authored reply (drained by `drainSystemInbox`): `recipientId ===
 *    SYSTEM_USER_ID`. Users can't send `messageType='system'` (trigger blocks),
 *    so their replies arrive as regular `message` type with SYSTEM as recipient.
 */
export function isSystemMessage(msg: DecryptedSignalMessage): boolean {
  return msg.messageType === 'system' || msg.recipientId === SYSTEM_USER_ID
}

/**
 * Outside event-intake requests ride the system channel (`messageType='system'`)
 * but are NOT operator↔user system conversation traffic — they're clinic-scoped
 * group messages a supervisor (or the provisioning dev) triages in their normal
 * Messages drawer. They must never populate the dev's admin system console.
 */
export function isIntakeRequest(msg: DecryptedSignalMessage): boolean {
  return msg.content?.type === 'intake_request'
}

/**
 * Dev-only selector: per-peer system threads, sorted by most-recent activity.
 *
 * On the dev's side both directions of system traffic key under the OTHER
 * user's id in `useMessagingStore.conversations` (see addMessage's
 * `conversationKey` derivation). If a dev also has personal traffic with the
 * same peer, those messages share the conversation key — we filter per-message,
 * not per-conversation, so personal bubbles stay out of the admin surface.
 *
 * Conversations whose system-filtered messages are empty are dropped.
 *
 * Unread counts: the store's unreadCounts are conversation-wide and not
 * separable by message type. We surface the conversation-wide count when at
 * least one system message exists; close enough for the admin surface and
 * avoids a parallel unread store.
 */
export function useAdminSystemConversations(): AdminSystemConversation[] {
  const conversations = useMessagingStore(s => s.conversations)
  const peerProfiles = useMessagingStore(s => s.peerProfiles)
  const unreadCounts = useMessagingStore(s => s.unreadCounts)

  return useMemo(() => {
    const out: AdminSystemConversation[] = []
    for (const [peerId, msgs] of Object.entries(conversations)) {
      if (peerId === SYSTEM_USER_ID) continue
      let last: DecryptedSignalMessage | null = null
      for (const m of msgs) {
        if (!isSystemMessage(m)) continue
        if (isIntakeRequest(m)) continue // intake requests belong in normal Messages, not the admin console
        if (!last || m.createdAt > last.createdAt) last = m
      }
      if (!last) continue
      out.push({
        peerId,
        peerProfile: peerProfiles[peerId] ?? null,
        lastMessage: last,
        lastAt: last.createdAt,
        unreadCount: unreadCounts[peerId] ?? 0,
      })
    }
    out.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0))
    return out
  }, [conversations, peerProfiles, unreadCounts])
}
