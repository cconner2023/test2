import { useCallback, useRef, useState } from 'react'
import { Check, RefreshCw, Send, Phone, MoreHorizontal } from 'lucide-react'
import type { OutsideSessionContent } from '../../lib/signal/messageContent'
import { sendOutsideSessionReply } from '../../lib/outsideSessionService'
import { requestRingback } from '../../lib/webrtc/outsideSessionCallBus'
import { useLongPress } from '../../Hooks/useLongPress'

interface Props {
  content: OutsideSessionContent
  createdAt: string
  messageId: string
  onLongPress?: (x: number, y: number, rect?: DOMRect, html?: string) => void
}

/**
 * Durable cluster-side card for an OUTSIDE-SESSION reply lane. Shows the outside
 * party + live status, the reply history (fanned to every clinic member — see
 * send_outside_session_reply), and, while active, a composer to text the open
 * tab back. Sealing happens client-side in outsideSessionService (outsideSeal),
 * so the server never sees the reply plaintext destined for the outside tab.
 *
 * Ring-back (the call-side reply) lands in slice 5. No-PHI applies to the
 * composer — operational vocabulary only.
 */
export function OutsideSessionCard({ content, messageId, onLongPress }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active = content.status === 'active'
  const replies = content.replies ?? []

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

  const onSend = useCallback(async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    const res = await sendOutsideSessionReply(content.session_id, content.outside_pub, body)
    setSending(false)
    if (!res.ok) {
      setError(res.error ?? 'Could not send — the outside party may have disconnected.')
      return
    }
    setText('') // the bubble appears via the reply-sent fanout fold
  }, [text, sending, content.session_id, content.outside_pub])

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
        {/* Header: outside party + live status */}
        <div className="px-3.5 py-2 border-b border-current/10 flex items-center gap-2">
          {active ? (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-themegreen opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-themegreen" />
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-tertiary shrink-0" />
          )}
          <span className="text-[9pt] font-semibold text-themeblue2 truncate flex-1">
            {content.requester_name || 'Outside contact'}
          </span>
          <span className={`text-[8pt] font-semibold uppercase tracking-widest shrink-0 ${active ? 'text-themegreen' : 'text-tertiary'}`}>
            {active ? 'Active' : 'Ended'}
          </span>
        </div>

        {/* Reply history */}
        {replies.length > 0 && (
          <div className="px-3.5 py-2 space-y-2">
            {replies.map((r) => (
              <div key={r.reply_id} className="rounded-xl bg-themewhite px-3 py-1.5">
                <p className="text-[8pt] text-tertiary uppercase tracking-widest mb-0.5 truncate">{r.from_name}</p>
                <p className="text-[11pt] leading-snug whitespace-pre-wrap break-words">{r.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Composer (active only) */}
        {active ? (
          <div className="border-t border-current/10">
            <div className="flex items-center justify-end px-2.5 pt-2">
              <button
                type="button"
                onClick={() => requestRingback({ sessionId: content.session_id, outsidePub: content.outside_pub, requesterName: content.requester_name })}
                className="h-8 px-3 rounded-full flex items-center gap-1.5 bg-themeblue3/10 text-themeblue2 text-[9pt] font-medium active:scale-95 transition-all"
              >
                <Phone size={13} /> Call back
              </button>
            </div>
            <div className="flex items-end gap-2 px-2.5 py-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Reply…"
                rows={1}
                maxLength={2000}
                className="flex-1 bg-transparent px-1.5 py-1.5 text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
              />
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={sending || text.trim().length === 0}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white transition-all active:scale-95 ${text.trim().length === 0 ? 'opacity-40' : 'opacity-100'}`}
                aria-label="Send reply"
              >
                {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            {error && <p className="px-3.5 pb-2 text-[9pt] text-themeredred">{error}</p>}
          </div>
        ) : (
          <div className="px-3.5 py-2 border-t border-current/10 flex items-center gap-1.5 text-[9pt] text-tertiary">
            <Check size={12} /> Session closed — replies are no longer delivered.
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
