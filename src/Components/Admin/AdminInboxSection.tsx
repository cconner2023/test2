import { RequestCard } from './RequestCard'
import { SuggestionCard } from './SuggestionCard'
import { FeedbackCard } from './FeedbackCard'
import type { FeedItem } from '../../Hooks/useAdminInbox'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import type { FeedbackRow } from '../../lib/feedbackService'
import type { FeatureVoteSuggestion } from '../../lib/featureVotingService'

interface AdminInboxSectionProps {
  /** Section heading, rendered only when the section has items. */
  label: string
  /** Already narrowed to this section's kinds — see selectFeedItems. */
  items: FeedItem[]
  /** UIC → cluster, so a request row can show the cluster it self-reports into. */
  uicToClinic: Map<string, AdminClinic>
  onOpenRequest: (request: AccountRequest) => void
  onOpenFeedback: (feedback: FeedbackRow) => void
  onOpenSuggestion: (suggestion: FeatureVoteSuggestion) => void
}

/**
 * One labelled section of the admin inbox rail (Requests, Feedback).
 *
 * Renders NOTHING — heading included — when it has no items, so the rail only
 * shows what is actually there and an empty queue doesn't leave a dangling
 * label. No count badge and no skeleton: presence is the signal, and the rail
 * paints the moment the shared feed resolves.
 */
export function AdminInboxSection({
  label,
  items,
  uicToClinic,
  onOpenRequest,
  onOpenFeedback,
  onOpenSuggestion,
}: AdminInboxSectionProps) {
  if (items.length === 0) return null

  return (
    <>
      <div className="px-4 pt-3 pb-1.5">
        <p className="text-[10pt] font-semibold text-tertiary uppercase tracking-wider">{label}</p>
      </div>
      {items.map(item => {
        if (item.kind === 'request') {
          const matchedClinic = item.data.uic ? uicToClinic.get(item.data.uic.toUpperCase()) : undefined
          return <RequestCard key={item.key} request={item.data} matchedClinic={matchedClinic} onOpen={onOpenRequest} />
        }
        if (item.kind === 'suggestion') {
          return <SuggestionCard key={item.key} suggestion={item.data} onOpen={onOpenSuggestion} />
        }
        return <FeedbackCard key={item.key} feedback={item.data} onOpen={onOpenFeedback} />
      })}
    </>
  )
}
