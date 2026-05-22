/**
 * Dev-only compose popover for sending a system-authored notice to either a
 * single user (1:1) or a clinic (system group). Mounted from
 * AdminUserDetail / AdminClinicDetail next to the other corner actions.
 *
 * The send path lives in useMessages (sendSystemMessageToUser /
 * sendSystemMessageToClinic). This component only owns the compose UX.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'

interface Props {
  anchorRect: DOMRect | null
  title: string
  onClose: () => void
  onSend: (text: string) => Promise<boolean>
}

export function SystemMessageComposePopover({ anchorRect, title, onClose, onSend }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset on close so reopening starts clean.
  useEffect(() => {
    if (!anchorRect) {
      setText('')
      setSending(false)
    } else {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [anchorRect])

  const trimmed = text.trim()
  const canSend = trimmed.length > 0 && !sending

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    const ok = await onSend(trimmed)
    setSending(false)
    if (ok) onClose()
  }

  return (
    <PreviewOverlay
      isOpen={!!anchorRect}
      onClose={onClose}
      anchorRect={anchorRect}
      title={title}
      maxWidth={360}
      footer={
        anchorRect ? (
          <ActionPill shadow="sm">
            <ActionButton
              icon={sending ? RefreshCw : Check}
              label={sending ? 'Sending…' : 'Send'}
              variant={canSend ? 'success' : 'disabled'}
              onClick={handleSend}
            />
          </ActionPill>
        ) : undefined
      }
    >
      {anchorRect && (
        <div className="p-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a system message…"
            rows={4}
            maxLength={500}
            className="w-full bg-themewhite2 rounded-lg px-3 py-2 text-[12pt] text-tertiary outline-none border border-primary/10 focus:border-themeblue3/40 resize-none"
          />
          <p className="text-[9pt] text-tertiary/70 mt-1">
            Sent as a system notice. The recipient can&apos;t reply.
          </p>
        </div>
      )}
    </PreviewOverlay>
  )
}
