/**
 * Admin-side wrapper around ChatDetailView for the dev↔user system thread.
 *
 * - Filters the dev's local conversation to system-channel traffic only
 *   (predicate from useAdminSystemConversations.isSystemMessage), so personal
 *   messages with the same peer don't leak into the admin surface.
 * - Routes outbound through `sendSystemMessageToUser` — that's the gate-aware
 *   path (`messageType='system'`, trigger-enforced is_dev() + sender_id NOT
 *   NULL). The regular peer sendMessage is intentionally NOT wired here.
 * - Image upload + Forward are hidden — v1 system channel is text-only.
 * - Embedded intake-request cards render read-only (intakeActionable=false):
 *   Approve/Decline/Email belong to supervisors in the clinic system group,
 *   not the dev acting from their drawer.
 *
 * AdminDrawer owns the surrounding chrome (mobile header via BaseDrawer,
 * desktop header via the right-pane), so mobileHeader/desktopHeader are null.
 */

import { useCallback, useMemo } from 'react'
import { ChatDetailView, type ParticipantStatus } from '../ChatDetailView'
import { UserAvatar } from '../Settings/UserAvatar'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { isSystemMessage } from '../../Hooks/useAdminSystemConversations'
import { getDisplayName } from '../../Utilities/nameUtils'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'

export interface AdminSystemConversationViewProps {
  peerId: string
  onBack?: () => void
}

export function AdminSystemConversationView({ peerId, onBack }: AdminSystemConversationViewProps) {
  const ctx = useMessagesContext()
  const rawMessages = useMessagingStore(s => s.conversations[peerId] ?? [])
  const sending = useMessagingStore(s => s.sendingMap[peerId] ?? false)
  const peerProfile = useMessagingStore(s => s.peerProfiles[peerId] ?? null)

  // Filter to system traffic only — personal bubbles (if any) keyed under the
  // same peer stay hidden from the admin surface.
  const filteredMessages = useMemo(
    () => rawMessages.filter(isSystemMessage),
    [rawMessages],
  )

  const conversations = useMemo<Record<string, DecryptedSignalMessage[]>>(
    () => ({ [peerId]: filteredMessages }),
    [peerId, filteredMessages],
  )

  const peerName = peerProfile ? getDisplayName(peerProfile) : 'Unknown user'

  const sendMessage = useCallback(async (_id: string, text: string): Promise<boolean> => {
    if (!ctx) return false
    return ctx.sendSystemMessageToUser(peerId, text)
  }, [ctx, peerId])

  const sendImage = useCallback(async (): Promise<boolean> => false, [])

  const editMessage = useCallback((_id: string, msgId: string, text: string) => {
    if (!ctx) return
    ctx.editMessage(peerId, msgId, text)
  }, [ctx, peerId])

  const deleteMessages = useCallback((_id: string, msgIds: string[]) => {
    if (!ctx) return
    ctx.deleteMessages(peerId, msgIds)
  }, [ctx, peerId])

  const markAsRead = useCallback(() => {
    if (!ctx) return
    ctx.markAsRead(peerId)
  }, [ctx, peerId])

  // History for system threads catches up via drainSystemInbox on admin open,
  // not via a per-conversation fetch — make this a no-op.
  const fetchHistory = useCallback(async () => { /* no-op */ }, [])

  const participants = useMemo<ParticipantStatus[]>(
    () => [{ userId: peerId, displayName: peerName, available: true }],
    [peerId, peerName],
  )

  const resolveAvatar = useCallback((_msg: DecryptedSignalMessage, isOwn: boolean) => {
    if (isOwn) return undefined
    return (
      <UserAvatar
        avatarId={peerProfile?.avatarId ?? null}
        firstName={peerProfile?.firstName ?? null}
        lastName={peerProfile?.lastName ?? null}
        className="w-7 h-7"
      />
    )
  }, [peerProfile])

  return (
    <ChatDetailView
      conversationId={peerId}
      conversations={conversations}
      medics={[]}
      sendMessage={sendMessage}
      sendImage={sendImage}
      editMessage={editMessage}
      deleteMessages={deleteMessages}
      markAsRead={markAsRead}
      fetchHistory={fetchHistory}
      sending={sending}
      onBack={onBack}
      participants={participants}
      resolveAvatar={resolveAvatar}
      isSelfChat={false}
      showForward={false}
      hideImageUpload
      intakeActionable={false}
      emptyText="No system messages yet"
      mobileHeader={null}
      desktopHeader={null}
    />
  )
}
