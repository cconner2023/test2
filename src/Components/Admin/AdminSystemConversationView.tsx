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
 * Thread-level actions (Delete thread) publish up via onHeaderActions.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { HeaderPill } from '@/Components/primitives/HeaderPill'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
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
  /** Publishes the thread's header actions (Delete thread) to the host pane. */
  onHeaderActions?: (node: ReactNode | null) => void
  /** Fired after the thread is deleted — the host closes the detail. */
  onDeleted?: () => void
}

// Stable empty-array reference: returning a fresh `?? []` from a Zustand
// selector makes useSyncExternalStore see a new snapshot every render →
// "Maximum update depth exceeded" when the conversation is empty.
const EMPTY_MESSAGES: DecryptedSignalMessage[] = []

export function AdminSystemConversationView({ peerId, onBack, onHeaderActions, onDeleted }: AdminSystemConversationViewProps) {
  const ctx = useMessagesContext()
  const rawMessages = useMessagingStore(s => s.conversations[peerId] ?? EMPTY_MESSAGES)
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
        avatarBlob={peerProfile?.avatarBlob ?? null}
        userId={peerProfile?.id ?? null}
        firstName={peerProfile?.firstName ?? null}
        lastName={peerProfile?.lastName ?? null}
        className="w-7 h-7"
      />
    )
  }, [peerProfile])

  // Delete every system message in the thread (both sides, via deleteMessages'
  // wire-framed fanout). Personal messages keyed under the same peer stay.
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const handleDelete = useCallback(async () => {
    if (!ctx) return
    setDeleting(true)
    const ids = filteredMessages.map(m => m.id)
    if (ids.length > 0) await ctx.deleteMessages(peerId, ids)
    setDeleting(false)
    setConfirmDelete(false)
    onDeleted?.()
  }, [ctx, filteredMessages, peerId, onDeleted])

  useEffect(() => {
    onHeaderActions?.(ctx ? (
      <HeaderPill>
        <OverlayHeaderMenu items={[{ key: 'delete', label: 'Delete thread', icon: Trash2, destructive: true, onAction: () => setConfirmDelete(true) }]} />
      </HeaderPill>
    ) : null)
    return () => onHeaderActions?.(null)
  }, [ctx, onHeaderActions])

  return (
    <>
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
      canReact={false}
      emptyText="No system messages yet"
      mobileHeader={null}
      desktopHeader={null}
    />
    <ConfirmDialog
      visible={confirmDelete}
      title="Delete this system thread?"
      subtitle="Removes the thread from both sides. Permanent."
      confirmLabel="Delete"
      variant="danger"
      processing={deleting}
      onConfirm={handleDelete}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  )
}
