/**
 * Dev-only compose popover for sending a system-authored notice to either a
 * single user (1:1) or a clinic (system group). Mounted from
 * AdminUserDetail / AdminClinicDetail next to the other corner actions.
 *
 * The send path lives in useMessages (sendSystemMessageToUser /
 * sendSystemMessageToClinic). This component only owns the compose UX.
 */

import { useEffect, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { TextInput } from '../FormInputs'

interface Props {
  anchorRect: DOMRect | null
  title: string
  onClose: () => void
  onSend: (text: string) => Promise<boolean>
}

export function SystemMessageComposePopover({ anchorRect, title, onClose, onSend }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  // Reset on close so reopening starts clean.
  useEffect(() => {
    if (!anchorRect) {
      setText('')
      setSending(false)
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
        <TextInput
          value={text}
          onChange={setText}
          placeholder="Type a system message…"
          maxLength={500}
        />
      )}
    </PreviewOverlay>
  )
}
