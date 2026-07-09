import { useState, useEffect, useCallback } from 'react'
import { MapPin, ChevronRight } from 'lucide-react'
import { listClinics, listAllUsers } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { AdminSystemConversationsList } from './AdminSystemConversationsList'
import { AdminRequestsList } from './AdminRequestsList'
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
}

// Stable kind filters — module constants so they don't re-trigger the lists'
// feedItems memo on every rail render.
const REQUEST_KINDS = ['request'] as const
const FEEDBACK_KINDS = ['suggestion', 'feedback'] as const

/**
 * The admin drawer's standing inbox (desktop left pane + mobile nav sheet).
 * NOT the directory tree — that's the main content list (AdminSummary). The
 * rail reads like the chat conversation panel: a single scroller of labelled
 * sections of rows. Top to bottom: Locations, the standing counts, then the
 * three triage queues grouped by kind — Requests, Feedback, Messages.
 */
export function AdminSortRail({
  onOpenSettings,
  onSelectSystemPeer,
  onOpenRequest,
  onOpenFeedback,
  onOpenSuggestion,
  searchQuery,
  activeSystemPeerId,
}: AdminSortRailProps) {
  const gen = useInvalidation('users', 'clinics')
  const [userCount, setUserCount] = useState(0)
  const [clinicCount, setClinicCount] = useState(0)

  const loadCounts = useCallback(async () => {
    const [clinics, users] = await Promise.all([listClinics(), listAllUsers()])
    setClinicCount(clinics.length)
    setUserCount(users.length)
  }, [])

  useEffect(() => { loadCounts() }, [loadCounts, gen])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pb-6">
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

        {/* Standing counts — one muted line. The conversation list has no such
            block, so keep it to a single glance instead of a stacked header. */}
        <p className="px-4 py-2 text-[9.5pt] text-tertiary tabular-nums">
          {userCount} users · {clinicCount} clusters
        </p>

        <div className="border-b border-primary/10 mx-4" />

        {/* The three triage queues. Each section self-labels and renders nothing
            (label included) when empty — so the rail only shows what's there. */}
        <AdminRequestsList
          bare
          bareLabel="Requests"
          kinds={REQUEST_KINDS}
          searchQuery={searchQuery}
          onOpenRequest={onOpenRequest}
          onOpenFeedback={onOpenFeedback}
          onOpenSuggestion={onOpenSuggestion}
        />

        <AdminRequestsList
          bare
          bareLabel="Feedback"
          kinds={FEEDBACK_KINDS}
          searchQuery={searchQuery}
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
