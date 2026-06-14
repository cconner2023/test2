import { useCallback, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { OutsideMessageContent } from '../../lib/signal/messageContent'
import { useLongPress } from '../../Hooks/useLongPress'

interface Props {
  content: OutsideMessageContent
  createdAt: string
  messageId?: string
  onLongPress?: (x: number, y: number, rect?: DOMRect, html?: string) => void
}

/**
 * Outside→cluster one-way message — rendered as a normal inbound chat bubble:
 * sender name as the header, the note as the message body. No icon, no timestamp.
 * Authored by the `outside-message-submit` edge fn as a real per-device SYSTEM
 * Signal envelope, so the body is already decrypted by the normal group pipeline
 * (parseMessageContent t:'om') by the time it reaches here — no unseal, no
 * per-clinic key. Delete/Copy ride the existing long-press context menu.
 */
export function OutsideMessageCard({ content, messageId, onLongPress }: Props) {
  // Snapshot the bubble's rect + markup so the lifted menu clones the whole card
  // (text included) instead of opening cloneless at the cursor/icon.
  const rowRef = useRef<HTMLDivElement>(null)
  const captureCard = useCallback((): { rect?: DOMRect; html?: string } => {
    const el = rowRef.current
    if (!el) return {}
    return { rect: el.getBoundingClientRect(), html: el.outerHTML }
  }, [])
  // Touch long-press opens the context menu (Delete/Copy) on mobile — desktop
  // gets it via onContextMenu. iOS Safari can't rely on onContextMenu alone.
  const longPress = useLongPress((x, y) => { const s = captureCard(); onLongPress?.(x, y, s.rect, s.html) })
  // Desktop hover ellipsis — lifts the whole card (matching MessageBubble), not
  // a cloneless menu anchored to the icon.
  const onEllipsis = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const s = captureCard()
    const r = s.rect ?? (e.currentTarget as HTMLElement).getBoundingClientRect()
    onLongPress?.(r.left + r.width / 2, r.top + r.height / 2, s.rect, s.html)
  }
  return (
    <div className="group flex justify-start items-center px-1 mb-1.5" data-message-id={messageId}>
      <div
        ref={rowRef}
        className="max-w-[65%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-themewhite2 text-primary select-none"
        style={{ touchAction: 'pan-y' }}
        onContextMenu={(e) => { e.preventDefault(); const s = captureCard(); onLongPress?.(e.clientX, e.clientY, s.rect, s.html) }}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        onTouchCancel={longPress.onTouchCancel}
      >
        {/* In-bubble sender header — name + separator, like a group chat bubble. */}
        <div className="pb-1.5 mb-1.5 border-b border-current/10">
          <span className="text-[9pt] font-semibold text-themeblue2 truncate">
            {content.requester_name || 'Outside sender'}
          </span>
        </div>
        {content.text && (
          <p className="text-sm whitespace-pre-wrap break-words">{content.text}</p>
        )}
      </div>
      {onLongPress && (
        <button
          onClick={onEllipsis}
          aria-label="Message actions"
          className="hidden md:flex shrink-0 ml-1.5 w-7 h-7 rounded-full hover:bg-primary/10
                     items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal size={14} className="text-tertiary" />
        </button>
      )}
    </div>
  )
}
