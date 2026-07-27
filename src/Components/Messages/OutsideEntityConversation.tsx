import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Info } from 'lucide-react'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { OutsideEntityMessageEntry } from '../../lib/signal/messageContent'
import type { OutsideEntityChannel } from '../../lib/outsideEntityChannelStore'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import { pollOutsideEntityInbound, sendOutsideEntityReply } from '../../lib/outsideEntityService'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { saveMessage } from '../../lib/signal/messageStore'
import { useAuth } from '../../Hooks/useAuth'
import { ChatDetailView, type ParticipantStatus } from '../ChatDetailView'
import { ConversationInfoPanel } from '../Settings/ConversationInfoPanel'
import { UserAvatar } from '../Settings/UserAvatar'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { ErrorPill } from '@/Components/primitives/ErrorPill'

interface Props {
  /** Channel record — key + metadata. Outlives the messages by design. */
  channel: OutsideEntityChannel
  /** Cluster name shown as the conversation header (the sender the recipient sees). */
  clusterName: string
  /** Every conversation, not just this one: the thread renders from the channel's
   * entity_id, the rest backs the forward picker. */
  conversations: Record<string, DecryptedSignalMessage[]>
  medics: ClinicMedic[]
  /** Send to a REAL signal peer — reached only by forward, never by the composer. */
  sendMessage: (peerId: string, text: string, threadId?: string) => Promise<boolean>
  editMessage: (peerId: string, messageId: string, newText: string) => void
  deleteMessages: (peerId: string, messageIds: string[]) => void
  fetchHistory: (peerId: string) => Promise<void>
  /** Kill switch: revokes server-side, drops the local key, tombstones the thread. */
  deleteConversation: (conversationKey: string) => void
  /** Clear the conversation's unread state on open. */
  markAsRead: (conversationKey: string) => void
  /** Info card visibility — controlled, because the desktop drawer header owns the
   * Info affordance (the mobile header inside this view owns the other one). */
  showInfo: boolean
  onShowInfo: (show: boolean) => void
  scrollToMessageId?: string | null
  onScrollConsumed?: () => void
  registerThreadBack?: (closer: (() => boolean) | null) => void
  onBack?: () => void
}

/** Liveness poll only — message delivery rides the signal transport. */
const LIVENESS_MS = 30000

/** Stable empty list: an email recipient has no availability to report, and an
 *  empty participants array is what suppresses the unavailable banner. */
const NO_PARTICIPANTS: ParticipantStatus[] = []

/**
 * Full-conversation medic-side surface for an OUTBOUND outside-contact (email) 1:1.
 *
 * Messages here are ORDINARY messages in the store, keyed by the channel's entity_id:
 * inbound replies arrive as per-device Signal envelopes (outside-entity-relay →
 * routeOutsideEntityReply) and outbound sends are authored locally alongside the
 * send_outside_entity_message post. That is why this component does not own a
 * thread: unread counts, the notification toast, the conversation preview, backup and
 * per-message delete are all the stock paths.
 *
 * It renders through ChatDetailView, so the medic gets the ordinary conversation —
 * same bubbles, lifted-row menu, reply, forward, info panel, headers. Only the
 * transport differs: the composer send is swapped for an ECIES-sealed RPC because
 * the channel is not a Signal peer and never rides the ratchet. A send to any OTHER
 * id (the forward path) falls through to the real peer sender untouched.
 *
 * The polling that remains is deliberately narrow: a LIVENESS check (has the channel
 * been revoked or expired?) plus a one-shot catch-up drain on open for anything
 * authored while this device had no keyed bundle. Neither is the delivery path.
 */
export function OutsideEntityConversation({
  channel,
  clusterName,
  conversations,
  medics,
  sendMessage,
  editMessage,
  deleteMessages,
  fetchHistory,
  deleteConversation,
  markAsRead,
  showInfo,
  onShowInfo,
  scrollToMessageId,
  onScrollConsumed,
  registerThreadBack,
  onBack,
}: Props) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const peerId = channel.entity_id
  const isDevRole = useAuthStore(s => s.isDevRole)

  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)
  const [mediaJumpId, setMediaJumpId] = useState<string | null>(null)

  const expired = ended || new Date(channel.expires_at).getTime() <= Date.now()
  const active = !expired

  // The outside_entity record is the channel anchor, not a chat message — hide it
  // from the thread while leaving every other conversation intact for forwarding.
  const thread = useMemo(
    () => (conversations[peerId] ?? []).filter(m => m.content?.type !== 'outside_entity'),
    [conversations, peerId],
  )
  const viewConversations = useMemo(
    () => ({ ...conversations, [peerId]: thread }),
    [conversations, peerId, thread],
  )

  /** Author a channel message into the store + IDB as a normal 1:1 message. */
  const fileMessage = useCallback((entry: OutsideEntityMessageEntry) => {
    if (!userId) return
    const mine = entry.dir === 'to_outside'
    const msg: DecryptedSignalMessage = {
      id: entry.id,
      senderId: mine ? userId : peerId,
      recipientId: mine ? peerId : userId,
      plaintext: entry.text,
      content: { type: 'text', text: entry.text },
      messageType: 'message',
      createdAt: entry.created_at || new Date().toISOString(),
      readAt: new Date().toISOString(),
      status: mine ? 'sent' : undefined,
      // Row id doubles as the origin: shared with the relayed envelope so the two
      // delivery paths converge on one message, and tombstoned by a message delete.
      originId: entry.id,
    }
    useMessagingStore.getState().addMessage(msg)
    void saveMessage(msg, userId).catch(() => {})
  }, [peerId, userId])

  // Liveness + catch-up. The drain recovers replies stored while this device had no
  // keyed bundle (or whose envelope failed to decrypt); addMessage de-dupes by id, so
  // anything already delivered by envelope is a no-op.
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const lastSeen = () => {
      let latest: string | null = null
      for (const m of useMessagingStore.getState().conversations[peerId] ?? []) {
        if (m.senderId === peerId && m.createdAt && (!latest || m.createdAt > latest)) latest = m.createdAt
      }
      return latest
    }
    const tick = async () => {
      const res = await pollOutsideEntityInbound(channel, lastSeen())
      if (cancelled || !res) return
      if (!res.active) { setEnded(true); return }
      for (const e of res.entries) fileMessage(e)
    }
    const timer = setInterval(() => { void tick() }, LIVENESS_MS)
    void tick()
    return () => { cancelled = true; clearInterval(timer) }
  }, [active, channel, peerId, fileMessage])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error])

  /**
   * Composer send. Only the channel's own id goes out over the sealed RPC; every
   * other id is a forward target and belongs to the ordinary peer sender.
   * `threadId` is dropped — an email recipient has no thread to reply into, so a
   * threaded send would strand the reply out of the main view.
   */
  const handleSend = useCallback(async (id: string, text: string, threadId?: string) => {
    if (id !== peerId) return sendMessage(id, text, threadId)
    if (!active) return false
    setSending(true)
    setError(null)
    const res = await sendOutsideEntityReply(channel, text)
    setSending(false)
    if (!res.ok) { setError(res.error ?? 'Could not send.'); return false }
    fileMessage(res.data)
    return true
  }, [peerId, sendMessage, active, channel, fileMessage])

  // Attachments have no delivery path to an email recipient — the RPC seals text
  // only — so the + entry point is hidden and this can never be reached.
  const handleSendImage = useCallback(async () => false, [])

  const resolveAvatar = useCallback((_msg: DecryptedSignalMessage, isOwn: boolean) => {
    if (isOwn) return undefined
    return <UserAvatar avatarId={null} firstName={channel.recipient_email} lastName={null} className="w-7 h-7" />
  }, [channel.recipient_email])

  const mobileHeader = (
    <div className="md:hidden shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center">
      <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
        <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6 text-tertiary" />
        </button>
      </div>
      <p className="flex-1 text-sm font-medium text-primary truncate mx-3">{clusterName}</p>
      {/* Info is unconditional here (a 1:1 dev-gates it) because the info card is
          where this channel's kill switch lives — same slot as a group's Purge. */}
      <HeaderPill>
        <PillButton icon={Info} onClick={() => onShowInfo(true)} label="Conversation info" />
      </HeaderPill>
    </div>
  )

  return (
    <ChatDetailView
      conversationId={peerId}
      conversations={viewConversations}
      medics={medics}
      sendMessage={handleSend}
      sendImage={handleSendImage}
      editMessage={editMessage}
      deleteMessages={deleteMessages}
      markAsRead={markAsRead}
      fetchHistory={fetchHistory}
      sending={sending}
      onBack={onBack}
      participants={NO_PARTICIPANTS}
      resolveAvatar={resolveAvatar}
      showForward
      emptyText={`No messages yet. Anything you send is private to you and ${channel.recipient_email}.`}
      mobileHeader={mobileHeader}
      desktopHeader={null}
      registerThreadBack={registerThreadBack}
      hideImageUpload
      canReact={false}
      conversationIsGroup={false}
      conversationPeerName={clusterName}
      composerBlockedReason={active ? undefined : 'This secure contact has ended.'}
      scrollToMessageId={mediaJumpId ?? scrollToMessageId}
      onScrollConsumed={() => { setMediaJumpId(null); onScrollConsumed?.() }}
    >
      {error && (
        <div className="absolute inset-x-0 bottom-[calc(4.75rem+var(--sab,0px))] md:bottom-[4.5rem] z-20 flex justify-center px-4 pointer-events-none">
          <ErrorPill>{error}</ErrorPill>
        </div>
      )}
      <ConversationInfoPanel
        isOpen={showInfo}
        onClose={() => onShowInfo(false)}
        messages={thread}
        isDevRole={isDevRole}
        onJumpToMessage={setMediaJumpId}
        peer={{
          userId: peerId,
          name: clusterName,
          sub: channel.recipient_email,
          avatarId: null,
          firstName: channel.recipient_email,
          lastName: null,
        }}
        directAction={{
          label: 'Delete contact',
          confirmTitle: 'Delete this secure contact for everyone?',
          confirmSubtitle: 'The channel is revoked, the key is destroyed, and the thread is removed on both sides. This can\'t be undone.',
          confirmLabel: 'Delete',
          onConfirm: () => { deleteConversation(peerId); onBack?.() },
        }}
      />
    </ChatDetailView>
  )
}
