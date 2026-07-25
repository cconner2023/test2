import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ChevronLeft, Clock, MoreHorizontal, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import type { OutsideEntityContent, OutsideEntityMessageEntry } from '../../lib/signal/messageContent'
import { pollOutsideEntityInbound, sendOutsideEntityReply } from '../../lib/outsideEntityService'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { saveMessage } from '../../lib/signal/messageStore'
import { useAuth } from '../../Hooks/useAuth'
import { ContextMenu, type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'

interface Props {
  /** The single local control message that owns the channel key + reply thread. */
  content: OutsideEntityContent
  /** Its local id (conversation key === content.entity_id). */
  messageId: string
  /** Cluster name shown as the conversation header (the sender the recipient sees). */
  clusterName: string
  /** Delete + revoke the channel (routes through useMessages.deleteMessages). */
  deleteMessages: (conversationKey: string, messageIds: string[]) => void
  /** Clear the conversation's unread state on open. */
  markAsRead: (conversationKey: string) => void
  onBack?: () => void
}

const POLL_MS = 4000

/**
 * Full-conversation medic-side surface for an OUTBOUND outside-contact (email) 1:1.
 * Replaces the old nested `OutsideEntityCard` (a chat card rendered inside a chat) —
 * this reads like a normal 1:1: cluster-name header, plain reply bubbles, one pinned
 * composer. It is NOT wired through ChatDetailView because the channel isn't a Signal
 * peer: sends dual-seal + post via send_outside_entity_message and inbound is drained
 * by poll_outside_entity_inbound. All folds persist through the store + saveMessage
 * (IDB + encrypted backup) — the control message holds the ONLY copy of the channel
 * key (content.medic_priv_jwk), so this persistence is load-bearing. No-PHI applies to
 * the composer (operational vocabulary only). Imports NOTHING from src/lib/signal/*
 * beyond the shared message store.
 */
export function OutsideEntityConversation({ content, messageId, clusterName, deleteMessages, markAsRead, onBack }: Props) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const peerId = content.entity_id

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const replies = content.replies ?? []
  const expired = ended || new Date(content.expires_at).getTime() <= Date.now()
  const active = !expired

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Highest to_medic timestamp already folded — the poll cursor.
  const lastSeenRef = useRef<string | null>(null)

  // Fold new entries onto the control message and persist (store + IDB/backup). Reads
  // the LIVE store content so concurrent send/poll folds don't clobber each other.
  const foldEntries = useCallback((entries: OutsideEntityMessageEntry[]) => {
    if (entries.length === 0) return
    const store = useMessagingStore.getState()
    const existing = store.conversations[peerId]?.find((m) => m.id === messageId)
    const cur = (existing?.content as OutsideEntityContent | undefined) ?? content
    const have = new Set(cur.replies.map((r) => r.id))
    const add = entries.filter((e) => !have.has(e.id))
    if (add.length === 0) return
    const merged: OutsideEntityContent = { ...cur, replies: [...cur.replies, ...add] }
    store.updateMessageContent(peerId, messageId, merged)
    const updated = store.conversations[peerId]?.find((m) => m.id === messageId)
    if (updated && userId) void saveMessage(updated, userId).catch(() => {})
  }, [content, messageId, peerId, userId])

  // Clear unread on open.
  useEffect(() => { markAsRead(peerId) }, [peerId, markAsRead])

  // Seed the poll cursor from any to_medic replies already on the card.
  useEffect(() => {
    for (const r of replies) {
      if (r.dir === 'to_medic' && r.created_at && (!lastSeenRef.current || r.created_at > lastSeenRef.current)) {
        lastSeenRef.current = r.created_at
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll inbound while the channel is live.
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const tick = async () => {
      const res = await pollOutsideEntityInbound(content, lastSeenRef.current)
      if (cancelled || !res) return
      if (!res.active) { setEnded(true); return }
      for (const e of res.entries) {
        if (e.created_at && (!lastSeenRef.current || e.created_at > lastSeenRef.current)) lastSeenRef.current = e.created_at
      }
      foldEntries(res.entries)
    }
    const timer = setInterval(() => { void tick() }, POLL_MS)
    void tick()
    return () => { cancelled = true; clearInterval(timer) }
  }, [active, content, foldEntries])

  // Auto-resize composer + keep the thread pinned to the newest message.
  useEffect(() => {
    const el = inputRef.current
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px` }
  }, [text])
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [replies.length])

  const onSend = useCallback(async () => {
    const body = text.trim()
    if (!body || sending || !active) return
    setSending(true)
    setError(null)
    const res = await sendOutsideEntityReply(content, body)
    setSending(false)
    if (!res.ok) { setError(res.error ?? 'Could not send.'); return }
    setText('')
    foldEntries([res.data])
    inputRef.current?.focus()
  }, [text, sending, active, content, foldEntries])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend() }
  }, [onSend])

  const menuItems: ContextMenuItem[] = useMemo(() => ([
    { key: 'delete', label: 'Delete conversation', icon: Trash2, destructive: true, onAction: () => setConfirmDelete(true) },
  ]), [])

  const bubbles = replies.length > 0 && (
    <div className="space-y-2">
      {replies.map((r) => {
        const mine = r.dir === 'to_outside'
        return (
          <div key={r.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-themeblue3 text-white rounded-br-md' : 'bg-themewhite2 text-primary rounded-bl-md'}`}>
              <p className="text-[11pt] leading-snug whitespace-pre-wrap break-words">{r.text}</p>
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
        {replies.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10pt] text-tertiary text-center max-w-[80%] leading-relaxed">
              No messages yet. Anything you send is private to you and {content.recipient_email}.
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
        onConfirm={() => { setConfirmDelete(false); deleteMessages(peerId, [messageId]); onBack?.() }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
