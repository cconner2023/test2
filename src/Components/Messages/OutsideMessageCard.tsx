import { MessageSquare } from 'lucide-react'
import type { OutsideMessageContent } from '../../lib/signal/messageContent'

interface Props {
  content: OutsideMessageContent
  createdAt: string
  messageId?: string
  onLongPress?: (x: number, y: number) => void
}

/**
 * Outside→cluster one-way message card — the durable record of a text note an outside
 * party dropped to the cluster. Authored by the `outside-message-submit` edge fn as a
 * real per-device SYSTEM Signal envelope, so the body is already decrypted by the normal
 * group pipeline (parseMessageContent t:'om') by the time it reaches here — no unseal,
 * no per-clinic key. Delete/Copy ride the existing long-press context menu.
 */
export function OutsideMessageCard({ content, createdAt, messageId, onLongPress }: Props) {
  const when = createdAt ? new Date(createdAt).toLocaleString() : ''

  return (
    <div className="w-full flex justify-center px-4 my-2" data-message-id={messageId}>
      <div
        className="max-w-[85%] w-full px-3 py-2.5 rounded-2xl bg-primary/5 border border-primary/10"
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(e.clientX, e.clientY) }}
      >
        <div className="flex items-center gap-2.5">
          <MessageSquare size={18} className="text-themeblue3" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{content.requester_name || 'Outside sender'}</p>
            <p className="text-[10pt] text-tertiary">Message{when ? ` · ${when}` : ''}</p>
          </div>
        </div>
        {content.text && (
          <p className="mt-1.5 text-sm text-primary whitespace-pre-wrap break-words">{content.text}</p>
        )}
      </div>
    </div>
  )
}
