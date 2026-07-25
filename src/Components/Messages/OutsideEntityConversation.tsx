import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ChevronLeft, Clock, MoreHorizontal, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { OutsideEntityMessageEntry } from '../../lib/signal/messageContent'
import type { OutsideEntityChannel } from '../../lib/outsideEntityChannelStore'
import { pollOutsideEntityInbound, sendOutsideEntityReply } from '../../lib/outsideEntityService'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { saveMessage } from '../../lib/signal/messageStore'
import { useAuth } from '../../Hooks/useAuth'
import { ContextMenu, type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'

interface Props {
  /** Channel record — key + metadata. Outlives the messages by design. */
  channel: OutsideEntityChannel
  /** Cluster name shown as the conversation header (the sender the recipient sees). */
  clusterName: string
  /** Kill switch: revokes server-side, drops the local key, tombstones the thread. */
  deleteConversation: (conversationKey: string) => void
  /** Clear the conversation's unread state on open. */
  markAsRead: (conversationKey: string) => void
  onBack?: () => void
}

/** Liveness poll only — message delivery rides the signal transport. */
const LIVENESS_MS = 30000

/**
 * Full-conversation medic-side surface for an OUTBOUND outside-contact (email) 1:1.
 *
 * Messages here are ORDINARY messages in the store, keyed by the channel's entity_id:
 * inbound replies arrive as per-device Signal envelopes (outside-entity-relay →
 * routeOutsideEntityReply) and outbound sends are authored locally alongside the
 * send_outside_entity_message post. That is why this component no longer owns a
 * thread: unread counts, the notification toast, the conversation preview, backup and
 * per-message delete are all the stock paths, and this file only supplies the chrome
 * and the composer.
 *
 * It is still NOT wired through ChatDetailView, because the channel is not a Signal
 * peer — sends go out ECIES-sealed via RPC, not through the ratchet.
 *
 * The polling that remains is deliberately narrow: a LIVENESS check (has the channel
 * been revoked or expired?) plus a one-shot catch-up drain on open for anything
 * authored while this device had no keyed bundle. Neither is the delivery path.
 */
export function OutsideEntityConversation({ channel, clusterName, deleteConversation, markAsRead, onBack }: Props) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const peerId = channel.entity_id

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const messages = useMessagingStore(s => s.conversations[peerId])
  const thread = useMemo(
    () => (messages ?? []).filter(m => m.content?.type !== 'outside_entity'),
    [messages],
  )

  const expired = ended || new Date(channel.expires_at).getTime() <= Date.now()
  const active = !expired

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  // Clear unread on open.
  useEffect(() => { markAsRead(peerId) }, [peerId, markAsRead])

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

  // Auto-resize composer + keep the thread pinned to the newest message.
  useEffect(() => {
    const el = inputRef.current
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px` }
  }, [text])
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [thread.length])

  const onSend = useCallback(async () => {
    const body = text.trim()
    if (!body || sending || !active) return
    setSending(true)
    setError(null)
    const res = await sendOutsideEntityReply(channel, body)
    setSending(false)
    if (!res.ok) { setError(res.error ?? 'Could not send.'); return }
    setText('')
    fileMessage(res.data)
    inputRef.current?.focus()
  }, [text, sending, active, channel, fileMessage])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend() }
  }, [onSend])

  const menuItems: ContextMenuItem[] = useMemo(() => ([
    { key: 'delete', label: 'Delete conversation', icon: Trash2, destructive: true, onAction: () => setConfirmDelete(true) },
  ]), [])

  const bubbles = thread.length > 0 && (
    <div className="space-y-2">
      {thread.map((m) => {
        const mine = m.senderId === userId
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-themeblue3 text-white rounded-br-md' : 'bg-themewhite2 text-primary rounded-bl-md'}`}>
              <p className="text-[11pt] leading-snug whitespace-pre-wrap break-words">{m.plaintext}</p>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col h-full relative">
      {/* Mobile header — cluster name is the sender the outside recipient sees.
          Desktop chrome is provided by the drawer (title also = cluster name). */}
      <div className="md:hidden shrink-0 px-3 py-2 pt-[max(0.5rem,var(--sat,0px))] flex items-center">
        <div className="rounded-full border border-tertiary/20 bg-themewhite p-0.5 overflow-hidden shrink-0">
          <button onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <ChevronLeft className="w-6 h-6 text-tertiary" />
          </button>
        </div>
        <div className="flex-1 min-w-0 mx-3">
          <p className="text-sm font-medium text-primary truncate">{clusterName}</p>
          <p className="text-[9pt] text-tertiary truncate flex items-center gap-1">
            <ShieldCheck size={11} className="text-themeblue2 shrink-0" />
            {active ? 'Secure • end-to-end encrypted' : 'Ended'}
          </p>
        </div>
        <button
          onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}
          aria-label="Conversation actions"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-28 md:pb-3">
        {thread.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10pt] text-tertiary text-center max-w-[80%] leading-relaxed">
              No messages yet. Anything you send is private to you and {channel.recipient_email}.
            </p>
          </div>
        ) : bubbles}
      </div>

      {/* Composer (pinned on mobile, static on desktop) — or an ended notice. */}
      {active ? (
        <div className="absolute inset-x-0 bottom-0 z-10 pb-[max(0rem,var(--sab,0px))] bg-themewhite3/80 backdrop-blur-sm md:static md:inset-auto md:bottom-auto md:shrink-0 md:pb-0 md:bg-transparent md:backdrop-blur-none">
          <div className="px-4 pt-2 pb-3">
            <div className="flex items-end gap-2">
              <div className="chat-input-bar relative flex flex-1 items-center rounded-2xl border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type a message..."
                  maxLength={2000}
                  className="w-full bg-transparent outline-none text-[12pt] text-tertiary px-3.5 py-2.5 rounded-2xl min-w-0 placeholder:text-tertiary resize-none leading-snug"
                  disabled={sending}
                />
              </div>
              {text.trim() && (
                <button
                  onClick={() => void onSend()}
                  disabled={sending}
                  className="animate-spring-in w-10 h-10 rounded-full bg-themeblue3 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
                  aria-label="Send message"
                >
                  {sending ? <RefreshCw size={16} className="animate-spin text-white" /> : <ArrowUp size={18} className="text-white" />}
                </button>
              )}
            </div>
            {error && <p className="px-1 pt-1.5 text-[9pt] text-themeredred">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="shrink-0 px-4 py-3 border-t border-primary/10 flex items-center justify-center gap-1.5 text-[10pt] text-tertiary">
          <Clock size={13} /> This secure contact has ended.
        </div>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={menuItems} />
      )}
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this secure contact for everyone?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { setConfirmDelete(false); deleteConversation(peerId); onBack?.() }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
