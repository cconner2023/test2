import { useMemo } from 'react'
import { MapPin, ChevronRight } from 'lucide-react'
import { AdminSystemConversationsList } from './AdminSystemConversationsList'
import { AdminInboxSection } from './AdminInboxSection'
import { useAdminInbox, selectFeedItems } from '../../Hooks/useAdminInbox'
import type { AccountRequest } from '../../lib/accountRequestService'
import type { FeedbackRow } from '../../lib/feedbackService'
import type { FeatureVoteSuggestion } from '../../lib/featureVotingService'

interface AdminSortRailProps {
  /** Open the admin settings sheet (locations management). */
  onOpenSettings: () => void
  /** Open a system-conversation thread (detail pane / view). */
  onSelectSystemPeer: (peerId: string) => void
  /** Open a triage item in the drawer detail pane / Sheet. */
  onOpenRequest: (request: AccountRequest) => void
  onOpenFeedback: (feedback: FeedbackRow) => void
  onOpenSuggestion: (suggestion: FeatureVoteSuggestion) => void
  /** Shared search — filters every section. */
  searchQuery?: string
  /** Highlights the currently-open system thread. */
  activeSystemPeerId?: string | null
  /** Own the scroll (default). Set false when the host is a fit-height surface
   *  (the mobile inbox Sheet) that must HUG this content — an internal
   *  flex-1/overflow scroller inside an auto-height parent has no height to
   *  resolve against and the rail's own scroll would fight the Sheet's. */
  scroll?: boolean
}

// Requests get their own section; suggestions and feedback share one, since
// both are "a user told us something" rather than "a user needs an account".
const REQUEST_KINDS = ['request'] as const
const FEEDBACK_KINDS = ['suggestion', 'feedback'] as const

/**
 * The admin drawer's standing inbox (desktop left pane + mobile nav sheet).
 * NOT the directory tree — that's the main content list (AdminSummary). The
 * rail reads like the chat conversation panel: a single scroller of labelled
 * sections of rows: Locations, then the three triage queues grouped by kind —
 * Requests, Feedback, Messages.
 *
 * No tallies. A section renders only when it has items, so its presence is the
 * signal; a number on top of that is noise the operator can't act on — and the
 * standing users/clusters line it replaced cost a full user-list read per mount.
 */
export function AdminSortRail({
  onOpenSettings,
  onSelectSystemPeer,
  onOpenRequest,
  onOpenFeedback,
  onOpenSuggestion,
  searchQuery,
  activeSystemPeerId,
  scroll = true,
}: AdminSortRailProps) {
  // One read for the whole rail — the sections are a grouping of a single feed,
  // not independent queues.
  const { items, uicToClinic } = useAdminInbox()
  const q = searchQuery ?? ''
  const requestItems = useMemo(() => selectFeedItems(items, REQUEST_KINDS, q), [items, q])
  const feedbackItems = useMemo(() => selectFeedItems(items, FEEDBACK_KINDS, q), [items, q])

  return (
    <div className={scroll ? 'flex flex-col h-full min-h-0' : 'flex flex-col'}>
      <div className={scroll ? 'flex-1 min-h-0 overflow-y-auto pb-6' : 'pb-6'}>
        {/* Locations — opens the locations management sheet. */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-themeblue2/5 active:scale-[0.99] transition-all"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <MapPin size={16} className="text-tertiary" />
          </div>
          <span className="flex-1 min-w-0 text-sm font-medium text-primary">Locations</span>
          <ChevronRight size={16} className="text-tertiary shrink-0" />
        </button>

        <div className="border-b border-primary/10 mx-4" />

        {/* The three triage queues. Each section self-labels and renders nothing
            (label included) when empty — so the rail only shows what's there. */}
        <AdminInboxSection
          label="Requests"
          items={requestItems}
          uicToClinic={uicToClinic}
          onOpenRequest={onOpenRequest}
          onOpenFeedback={onOpenFeedback}
          onOpenSuggestion={onOpenSuggestion}
        />

        <AdminInboxSection
          label="Feedback"
          items={feedbackItems}
          uicToClinic={uicToClinic}
          onOpenRequest={onOpenRequest}
          onOpenFeedback={onOpenFeedback}
          onOpenSuggestion={onOpenSuggestion}
        />

        <AdminSystemConversationsList
          onSelectSystemPeer={onSelectSystemPeer}
          searchQuery={searchQuery}
          activePeerId={activeSystemPeerId}
          label="Messages"
        />
      </div>
    </div>
  )
}
