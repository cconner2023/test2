import { MessageSquare, Star } from 'lucide-react'
import type { FeedbackRow } from '../../lib/feedbackService'

export interface FeedbackCardProps {
  feedback: FeedbackRow
  onOpen: (feedback: FeedbackRow) => void
}

/**
 * Feedback row — icon + author + rating + comment preview. Tapping opens the
 * feedback detail in the drawer's detail pane / Sheet.
 */
export function FeedbackCard({ feedback, onOpen }: FeedbackCardProps) {
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
    <button
      type="button"
      onClick={() => onOpen(feedback)}
      className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-themeblue2/5 active:scale-[0.99] transition-all select-none"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/10">
        <MessageSquare size={16} className="text-themeblue2" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{feedback.display_name || 'Anonymous'}</p>
        {stars && (
          <div className="flex items-center gap-1 mt-0.5">
            {stars.map((filled, i) => (
              <Star key={i} size={10} className={filled ? 'text-themeblue2 fill-themeblue2' : 'text-themeblue2/20'} />
            ))}
          </div>
        )}
        {summary && <p className="text-[9pt] text-tertiary mt-0.5 truncate">{summary}</p>}
      </div>
    </button>
  )
}
