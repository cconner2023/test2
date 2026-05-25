import { useCallback, useRef, useState } from 'react'
import { MessageSquare, Star, Trash2, Mail, MessageCircle } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { useLongPress } from '../../Hooks/useLongPress'
import type { FeedbackRow } from '../../lib/feedbackService'

export interface FeedbackCardProps {
  feedback: FeedbackRow
  email: string | null
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  setConfirmDeleteId: (id: string | null) => void
  setContextMenu: (v: { feedbackId: string; x: number; y: number } | null) => void
  /** Open an in-app system-message compose for this feedback's author. Only
   *  wired for authed feedback (user_id present) when messaging is available. */
  onChat?: (anchorRect: DOMRect | null) => void
}

export function FeedbackCard({
  feedback,
  email,
  expandedId,
  setExpandedId,
  setConfirmDeleteId,
  setContextMenu,
  onChat,
}: FeedbackCardProps) {
  const isExpanded = expandedId === feedback.id
  const cardRef = useRef<HTMLDivElement>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const { isPressing, ...longPress } = useLongPress((x: number, y: number) => {
    setContextMenu({ feedbackId: feedback.id, x, y })
  }, { delay: 500 })

  const handleTap = useCallback(() => {
    setAnchorRect(cardRef.current?.getBoundingClientRect() ?? null)
    setExpandedId(isExpanded ? null : feedback.id)
  }, [isExpanded, setExpandedId, feedback.id])

  const handleClose = useCallback(() => setExpandedId(null), [setExpandedId])

  const summary =
    feedback.comments ||
    feedback.most_useful_feature ||
    feedback.desired_feature ||
    feedback.needs_improvement ||
    null

  const stars = feedback.rating != null
    ? Array.from({ length: 5 }, (_, i) => i < feedback.rating!)
    : null

  return (
    <>
      <div
        ref={cardRef}
        onClick={handleTap}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ feedbackId: feedback.id, x: e.clientX, y: e.clientY })
        }}
        {...longPress}
        className={`transition-all hover:bg-themeblue2/5 cursor-pointer select-none ${isPressing ? 'scale-[0.98]' : ''}`}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/10">
            <MessageSquare size={16} className="text-themeblue2" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">
              {feedback.display_name || 'Anonymous'}
            </p>
            {stars && (
              <div className="flex items-center gap-1 mt-0.5">
                {stars.map((filled, i) => (
                  <Star
                    key={i}
                    size={10}
                    className={filled ? 'text-themeblue2 fill-themeblue2' : 'text-themeblue2/20'}
                  />
                ))}
              </div>
            )}
          </div>
          <span className="text-[9pt] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
            Feedback
          </span>
        </div>

        {summary && (
          <p className="text-[10pt] font-normal text-tertiary px-4 pb-2 line-clamp-2">{summary}</p>
        )}
      </div>

      <PreviewOverlay
        isOpen={isExpanded}
        onClose={handleClose}
        anchorRect={anchorRect}
        title="User feedback"
        maxWidth={420}
        previewMaxHeight="65dvh"
        footer={
          <ActionPill>
            {email && (
              <ActionButton
                icon={Mail}
                label="Email"
                onClick={() => {
                  const name = feedback.display_name || ''
                  window.location.href = `mailto:${email}?subject=${encodeURIComponent('ADTMC Web App Feedback')}&body=${encodeURIComponent(`${name},\n\nThanks for the feedback.\n\n`)}`
                }}
              />
            )}
            {onChat && (
              <ActionButton
                icon={MessageCircle}
                label="Chat"
                onClick={() => {
                  const rect = cardRef.current?.getBoundingClientRect() ?? null
                  handleClose()
                  onChat(rect)
                }}
              />
            )}
            <ActionButton
              icon={Trash2}
              label="Delete"
              variant="danger"
              onClick={() => setConfirmDeleteId(feedback.id)}
            />
          </ActionPill>
        }
      >
        <div className="px-4 py-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          {stars && (
            <div className="flex items-center gap-1">
              {stars.map((filled, i) => (
                <Star
                  key={i}
                  size={16}
                  className={filled ? 'text-themeblue2 fill-themeblue2' : 'text-themeblue2/20'}
                />
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
      </PreviewOverlay>
    </>
  )
}
