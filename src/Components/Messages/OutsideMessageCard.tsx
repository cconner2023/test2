import { MoreHorizontal } from 'lucide-react'
import type { OutsideMessageContent } from '../../lib/signal/messageContent'
import { useLongPress } from '../../Hooks/useLongPress'

interface Props {
  content: OutsideMessageContent
  createdAt: string
  messageId?: string
  onLongPress?: (x: number, y: number) => void
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
  // Touch long-press opens the context menu (Delete/Copy) on mobile — desktop
  // gets it via onContextMenu. iOS Safari can't rely on onContextMenu alone.
  const longPress = useLongPress((x, y) => onLongPress?.(x, y))
  // Desktop hover ellipsis — anchors the context menu to its own rect, matching
  // the affordance on every other peer bubble (MessageBubble).
  const onEllipsis = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onLongPress?.(r.left + r.width / 2, r.top + r.height / 2)
  }
  return (
    <div className="group flex justify-start items-center px-1 mb-1.5" data-message-id={messageId}>
      <div
        className="max-w-[65%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-themewhite2 text-primary select-none"
        style={{ touchAction: 'pan-y' }}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(e.clientX, e.clientY) }}
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
