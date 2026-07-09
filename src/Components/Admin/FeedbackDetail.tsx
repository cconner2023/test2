import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'
import { Star, Trash2, Mail, MessageCircle } from 'lucide-react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { HeaderPill } from '@/Components/primitives/HeaderPill'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { deleteFeedback, type FeedbackRow } from '../../lib/feedbackService'
import { listAllUsers } from '../../lib/adminService'
import { buildMailtoHref } from '../../lib/mailto'
import { invalidate, useInvalidation } from '../../stores/useInvalidationStore'
import { useMessagesContext } from '../../Hooks/MessagesContext'

export interface FeedbackDetailProps {
  feedback: FeedbackRow
  /** Return to the list / close the detail pane after delete. */
  onClose: () => void
  /** Dev-only — opens the full system-conversation thread with the feedback author. */
  onOpenConversation?: (peerId: string) => void
  /** Publish header actions (ellipsis extras) so the drawer renders them. */
  onHeaderActions?: (node: ReactNode | null) => void
}

/**
 * Feedback detail — the user-feedback read-out (rating + free-text sections),
 * rendered in the admin drawer's detail pane / Sheet. Actions (Email author,
 * Message author, Delete) live in the header ellipsis.
 */
export function FeedbackDetail({ feedback, onClose, onOpenConversation, onHeaderActions }: FeedbackDetailProps) {
  const gen = useInvalidation('users')
  const [email, setEmail] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const messagesCtx = useMessagesContext()

  useEffect(() => {
    if (!feedback.user_id) { setEmail(null); return }
    let cancelled = false
    void (async () => {
      const users = await listAllUsers()
      if (cancelled) return
      setEmail(users.find(u => u.id === feedback.user_id)?.email ?? null)
    })()
    return () => { cancelled = true }
  }, [feedback.user_id, gen])

  const handleDelete = useCallback(async () => {
    setProcessing(true)
    const result = await deleteFeedback(feedback.id)
    setProcessing(false)
    if (result.success) {
      setConfirmDelete(false)
      invalidate('requests')
      onClose()
    } else {
      setError(`Failed to delete: ${result.error}`)
    }
  }, [feedback.id, onClose])

  const canMessage = !!(messagesCtx && feedback.user_id && onOpenConversation)

  const headerActions = useMemo(() => {
    const items: ContextMenuItem[] = []
    if (email) {
      items.push({
        key: 'email',
        label: 'Email',
        icon: Mail,
        href: buildMailtoHref({ to: email, subject: '[feedback] -  Medical Operations Web Application', body: `${feedback.display_name || ''},\n\nThanks for the feedback.\n\n` }),
      })
    }
    if (canMessage) {
      items.push({ key: 'message', label: 'Message user', icon: MessageCircle, onAction: () => feedback.user_id && onOpenConversation!(feedback.user_id) })
    }
    items.push({ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDelete(true) })
    return (
      <HeaderPill>
        <OverlayHeaderMenu items={items} />
      </HeaderPill>
    )
  }, [email, canMessage, feedback.display_name, feedback.user_id, onOpenConversation])

  useEffect(() => {
    onHeaderActions?.(headerActions)
    return () => onHeaderActions?.(null)
  }, [headerActions, onHeaderActions])

  const stars = feedback.rating != null
    ? Array.from({ length: 5 }, (_, i) => i < feedback.rating!)
    : null

  return (
    <>
    <div className={processing ? 'opacity-50 pointer-events-none' : undefined}>
      {error && <div className="pb-3"><ErrorDisplay message={error} /></div>}

      <div className="rounded-2xl bg-themewhite2 px-4 py-3 space-y-3">
        <p className="text-sm font-medium text-primary">{feedback.display_name || 'Anonymous'}</p>

        {stars && (
          <div className="flex items-center gap-1">
            {stars.map((filled, i) => (
              <Star key={i} size={16} className={filled ? 'text-themeblue2 fill-themeblue2' : 'text-themeblue2/20'} />
            ))}
          </div>
        )}

        {feedback.most_useful_feature && (
          <div>
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Most useful</p>
            <p className="text-[10pt] text-primary whitespace-pre-wrap">{feedback.most_useful_feature}</p>
          </div>
        )}
        {feedback.desired_feature && (
          <div>
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Desired feature</p>
            <p className="text-[10pt] text-primary whitespace-pre-wrap">{feedback.desired_feature}</p>
          </div>
        )}
        {feedback.needs_improvement && (
          <div>
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Needs improvement</p>
            <p className="text-[10pt] text-primary whitespace-pre-wrap">{feedback.needs_improvement}</p>
          </div>
        )}
        {feedback.comments && (
          <div>
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Comments</p>
            <p className="text-[10pt] text-primary whitespace-pre-wrap">{feedback.comments}</p>
          </div>
        )}

        <p className="text-[10pt] font-normal text-tertiary">
          Submitted: {new Date(feedback.created_at).toLocaleString()}
        </p>
      </div>
    </div>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this feedback?"
        subtitle="Permanent."
        confirmLabel="Delete"
        variant="danger"
        processing={processing}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
