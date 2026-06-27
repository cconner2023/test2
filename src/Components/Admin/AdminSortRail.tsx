import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Settings, ChevronRight } from 'lucide-react'
import { listClinics, listAllUsers } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { AdminSystemConversationsList } from './AdminSystemConversationsList'
import { AdminRequestsList } from './AdminRequestsList'
import type { AccountRequest } from '../../lib/accountRequestService'

interface AdminSortRailProps {
  /** Open the admin settings sheet (locations management). */
  onOpenSettings: () => void
  /** Open a system-conversation thread (detail pane / view). */
  onSelectSystemPeer: (peerId: string) => void
  /** Fired after a request approval succeeds — opens the new user. */
  onApproved: (
    userId: string,
    request: AccountRequest,
    configured: { roles: string[]; clinicId: string | null; warnings: string[] },
  ) => void
  /** Shared search — filters every section. */
  searchQuery?: string
  /** Highlights the currently-open system thread. */
  activeSystemPeerId?: string | null
}

// Stable kind filters — module constants so they don't re-trigger the lists'
// feedItems memo on every rail render.
const REQUEST_KINDS = ['request'] as const
const FEEDBACK_KINDS = ['suggestion', 'feedback'] as const

/** Section header — the conversation-panel label treatment (uppercase, tracked). */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1.5">
      <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider">{children}</p>
    </div>
  )
}

/**
 * The admin drawer's standing inbox (desktop left pane + mobile nav sheet).
 * NOT the directory tree — that's the main content list (AdminSummary). The
 * rail reads like the chat conversation panel: a single scroller of labelled
 * sections of rows. Top to bottom: Settings, the standing counts, then the
 * three triage queues grouped by kind — Requests, Feedback, Messages.
 */
export function AdminSortRail({
  onOpenSettings,
  onSelectSystemPeer,
  onApproved,
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
        {/* Settings — opens the locations management sheet. */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-themeblue2/5 active:scale-[0.99] transition-all"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <Settings size={16} className="text-tertiary" />
          </div>
          <span className="flex-1 min-w-0 text-sm font-medium text-primary">Settings</span>
          <ChevronRight size={16} className="text-tertiary shrink-0" />
        </button>

        <div className="border-b border-primary/10 mx-4" />

        {/* Standing counts */}
        <div className="px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2 w-full text-left">
            <span className="text-[10pt] text-primary flex-1">Users</span>
            <span className="text-[10pt] font-semibold text-primary tabular-nums">{userCount}</span>
          </div>
          <div className="flex items-center gap-2 w-full text-left">
            <span className="text-[10pt] text-primary flex-1">Clusters</span>
            <span className="text-[10pt] font-semibold text-primary tabular-nums">{clinicCount}</span>
          </div>
        </div>

        <div className="border-b border-primary/10 mx-4" />

        {/* Requests — pending account requests (bare rows, conversation visual). */}
        <SectionLabel>Requests</SectionLabel>
        <AdminRequestsList
          bare
          kinds={REQUEST_KINDS}
          bareEmptyText="No pending requests"
          searchQuery={searchQuery}
          onApproved={onApproved}
        />

        {/* Feedback — user suggestions + feedback submissions. */}
        <SectionLabel>Feedback</SectionLabel>
        <AdminRequestsList
          bare
          kinds={FEEDBACK_KINDS}
          bareEmptyText="No feedback"
          searchQuery={searchQuery}
        />

        {/* Messages — dev↔user system conversation threads. */}
        <SectionLabel>Messages</SectionLabel>
        <AdminSystemConversationsList
          onSelectSystemPeer={onSelectSystemPeer}
          searchQuery={searchQuery}
          activePeerId={activeSystemPeerId}
        />
      </div>
    </div>
  )
}
