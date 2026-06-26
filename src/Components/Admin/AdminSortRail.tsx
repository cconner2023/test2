import { useState, useEffect, useCallback } from 'react'
import { listClinics, listAllUsers, getAllAccountRequests } from '../../lib/adminService'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { AdminSystemConversationsList } from './AdminSystemConversationsList'

interface AdminSortRailProps {
  /** Pending Requests → requests tab. */
  onSwitchTab: (tab: 'requests') => void
  /** Open a system-conversation thread (detail pane / view). */
  onSelectSystemPeer: (peerId: string) => void
  /** Shared search — filters the system conversations list. */
  searchQuery?: string
  /** Highlights the currently-open system thread. */
  activeSystemPeerId?: string | null
}

/**
 * The admin drawer's sort/summary surface (desktop left pane + mobile nav
 * sheet). NOT the directory tree — that's the main content list now
 * (AdminSummary). This rail holds the standing counts (Users / Clusters /
 * Pending) and the dev↔user system conversations.
 */
export function AdminSortRail({ onSwitchTab, onSelectSystemPeer, searchQuery, activeSystemPeerId }: AdminSortRailProps) {
  const gen = useInvalidation('users', 'clinics', 'requests')
  const [userCount, setUserCount] = useState(0)
  const [clinicCount, setClinicCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  const loadCounts = useCallback(async () => {
    const [clinics, users, requests] = await Promise.all([
      listClinics(),
      listAllUsers(),
      getAllAccountRequests('pending'),
    ])
    setClinicCount(clinics.length)
    setUserCount(users.length)
    setPendingCount(requests.length)
  }, [])

  useEffect(() => { loadCounts() }, [loadCounts, gen])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Counts */}
      <div className="px-4 py-3 space-y-1.5 shrink-0">
        <div className="flex items-center gap-2 w-full text-left">
          <span className="text-[10pt] text-primary flex-1">Users</span>
          <span className="text-[10pt] font-semibold text-primary tabular-nums">{userCount}</span>
        </div>
        <div className="flex items-center gap-2 w-full text-left">
          <span className="text-[10pt] text-primary flex-1">Clusters</span>
          <span className="text-[10pt] font-semibold text-primary tabular-nums">{clinicCount}</span>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={() => onSwitchTab('requests')}
            className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
          >
            <span className="text-[10pt] text-themeyellow flex-1">Pending Requests</span>
            <span className="text-[10pt] font-semibold text-themeyellow tabular-nums">{pendingCount}</span>
          </button>
        )}
      </div>

      <div className="border-b border-primary/10 mx-4" />

      {/* System conversations */}
      <div className="px-4 py-2.5 shrink-0">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Conversations</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AdminSystemConversationsList
          onSelectSystemPeer={onSelectSystemPeer}
          searchQuery={searchQuery}
          activePeerId={activeSystemPeerId}
        />
      </div>
    </div>
  )
}
