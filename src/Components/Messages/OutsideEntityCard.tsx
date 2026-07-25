import { ShieldCheck } from 'lucide-react'
import type { OutsideEntityContent } from '../../lib/signal/messageContent'
import { useLongPress } from '../../Hooks/useLongPress'

interface Props {
  content: OutsideEntityContent
  messageId: string
  onLongPress?: (x: number, y: number, rect?: DOMRect, html?: string) => void
}

/**
 * Anchor marker for an OUTBOUND outside-entity 1:1 (the medic emailed a secure
 * invite). Static by design.
 *
 * This used to be a whole chat card — its own thread, its own composer, its own poll —
 * because the channel's messages lived inside this message's content and the channel
 * key lived here too. Both moved out: replies are now ordinary messages in the
 * conversation (delivered as Signal envelopes via outside-entity-relay) and the key
 * lives in outsideEntityChannelStore. What remains is a marker saying the channel was
 * opened, so a freshly-minted channel has something in its thread.
 *
 * It is deletable like any other message. Deleting it blanks the marker and does NOT
 * end the channel — that is deleteConversation's job. The conversation surface is
 * OutsideEntityConversation, reached from the channel record, not from this message.
 */
export function OutsideEntityCard({ content, onLongPress }: Props) {
  const { isPressing, ...longPress } = useLongPress((x, y) => onLongPress?.(x, y))

  return (
    <div {...longPress} className={`flex justify-center py-1.5 transition-opacity ${isPressing ? 'opacity-60' : ''}`}>
      <div className="max-w-[85%] rounded-full bg-themewhite2 px-3.5 py-1.5 flex items-center gap-1.5">
        <ShieldCheck size={12} className="text-themeblue2 shrink-0" />
        <p className="text-[9pt] text-tertiary truncate">
          Secure email sent to {content.recipient_email}
        </p>
      </div>
    </div>
  )
}
