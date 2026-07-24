import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Send, ShieldCheck, MoreHorizontal, Clock } from 'lucide-react'
import type { OutsideEntityContent, OutsideEntityMessageEntry } from '../../lib/signal/messageContent'
import { sendOutsideEntityReply, pollOutsideEntityInbound } from '../../lib/outsideEntityService'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { saveMessage } from '../../lib/signal/messageStore'
import { useAuth } from '../../Hooks/useAuth'
import { useLongPress } from '../../Hooks/useLongPress'

interface Props {
  content: OutsideEntityContent
  messageId: string
  onLongPress?: (x: number, y: number, rect?: DOMRect, html?: string) => void
}

const POLL_MS = 4000

/**
 * Durable medic-side card for an OUTBOUND outside-entity 1:1 (the reverse of the
 * inbound QR lanes — the medic emailed a secure invite). Renders the thread (both
 * directions), a composer that dual-seals + posts via send_outside_entity_message,
 * and polls poll_outside_entity_inbound for the outside party's replies. All folds
 * persist through the store + saveMessage (IDB + encrypted backup) — the card holds
 * the ONLY copy of the channel key (content.medic_priv_jwk), so this persistence is
 * load-bearing. No-PHI applies to the composer (operational vocabulary only).
 *
 * Deletion is the standard long-press → delete (tombstone path), which also revokes
 * the server row (see useMessages.deleteMessages) — destroying the key everywhere.
 */
export function OutsideEntityCard({ content, messageId, onLongPress }: Props) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)

  const replies = content.replies ?? []
  const expired = ended || new Date(content.expires_at).getTime() <= Date.now()
  const active = !expired

  // Highest to_medic timestamp already folded — the poll cursor.
  const lastSeenRef = useRef<string | null>(null)

  const rowRef = useRef<HTMLDivElement>(null)
  const captureCard = useCallback((): { rect?: DOMRect; html?: string } => {
    const el = rowRef.current
    if (!el) return {}
    return { rect: el.getBoundingClientRect(), html: el.outerHTML }
  }, [])
  const longPress = useLongPress((x, y) => { const s = captureCard(); onLongPress?.(x, y, s.rect, s.html) })
  const onEllipsis = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const s = captureCard()
    const r = s.rect ?? (e.currentTarget as HTMLElement).getBoundingClientRect()
    onLongPress?.(r.left + r.width / 2, r.top + r.height / 2, s.rect, s.html)
  }, [onLongPress, captureCard])

  // Fold new entries onto the card content and persist (store + IDB/backup). Reads
  // the LIVE store content so concurrent send/poll folds don't clobber each other.
  const foldEntries = useCallback((entries: OutsideEntityMessageEntry[]) => {
    if (entries.length === 0) return
    const store = useMessagingStore.getState()
    const key = content.entity_id
    const existing = store.conversations[key]?.find((m) => m.id === messageId)
    const cur = (existing?.content as OutsideEntityContent | undefined) ?? content
    const have = new Set(cur.replies.map((r) => r.id))
    const add = entries.filter((e) => !have.has(e.id))
    if (add.length === 0) return
    const merged: OutsideEntityContent = { ...cur, replies: [...cur.replies, ...add] }
    store.updateMessageContent(key, messageId, merged)
    const updated = store.conversations[key]?.find((m) => m.id === messageId)
    if (updated && userId) void saveMessage(updated, userId).catch(() => {})
  }, [content, messageId, userId])

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

  const onSend = useCallback(async () => {
    const body = text.trim()
    if (!body || sending || !active) return
    setSending(true)
    setError(null)
    const res = await sendOutsideEntityReply(content, body)
    setSending(false)
    if (!res.ok) {
      setError(res.error ?? 'Could not send.')
      return
    }
    setText('')
    foldEntries([res.data])
  }, [text, sending, active, content, foldEntries])

  return (
    <div className="group flex justify-start items-start px-1 mb-1.5" data-message-id={messageId}>
      <div
        ref={rowRef}
        className="max-w-[80%] w-full rounded-2xl rounded-bl-md bg-themewhite2 text-primary overflow-hidden select-none"
        style={{ touchAction: 'pan-y' }}
        onContextMenu={(e) => { e.preventDefault(); const s = captureCard(); onLongPress?.(e.clientX, e.clientY, s.rect, s.html) }}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        onTouchCancel={longPress.onTouchCancel}
      >
        {/* Header: recipient + secure/status */}
        <div className="px-3.5 py-2 border-b border-current/10 flex items-center gap-2">
          <ShieldCheck size={13} className="text-themeblue2 shrink-0" />
          <span className="text-[9pt] font-semibold text-themeblue2 truncate flex-1">
            {content.recipient_email || content.from_label || 'Outside contact'}
          </span>
          <span className={`text-[8pt] font-semibold uppercase tracking-widest shrink-0 ${active ? 'text-themegreen' : 'text-tertiary'}`}>
            {active ? 'Secure' : 'Ended'}
          </span>
        </div>

        {/* Thread */}
        {replies.length > 0 && (
          <div className="px-3.5 py-2 space-y-2">
            {replies.map((r) => (
              <div key={r.id} className={`flex ${r.dir === 'to_outside' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-1.5 ${r.dir === 'to_outside' ? 'bg-themeblue3 text-white' : 'bg-themewhite text-primary'}`}>
                  <p className="text-[11pt] leading-snug whitespace-pre-wrap break-words">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {active ? (
          <div className="border-t border-current/10">
            <div className="px-3.5 pt-1.5 text-[8pt] text-themeyellow leading-relaxed">
              Operational details only — no patient names or medical details.
            </div>
            <div className="flex items-end gap-2 px-2.5 py-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message…"
                rows={1}
                maxLength={2000}
                className="flex-1 bg-transparent px-1.5 py-1.5 text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
              />
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={sending || text.trim().length === 0}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white transition-all active:scale-95 ${text.trim().length === 0 ? 'opacity-40' : 'opacity-100'}`}
                aria-label="Send message"
              >
                {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            {error && <p className="px-3.5 pb-2 text-[9pt] text-themeredred">{error}</p>}
          </div>
        ) : (
          <div className="px-3.5 py-2 border-t border-current/10 flex items-center gap-1.5 text-[9pt] text-tertiary">
            <Clock size={12} /> This secure contact has ended.
          </div>
        )}
      </div>

      {onLongPress && (
        <button
          onClick={onEllipsis}
          aria-label="Message actions"
          className="hidden md:flex shrink-0 ml-1.5 mt-1 w-7 h-7 rounded-full hover:bg-primary/10
                     items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal size={14} className="text-tertiary" />
        </button>
      )}
    </div>
  )
}
