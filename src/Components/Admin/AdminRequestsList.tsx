/**
 * AdminRequestsList -- account request management with swipeable cards.
 *
 * Displays account requests (new or profile-change) with filter tabs,
 * swipe-to-approve/reject on mobile, right-click context menu on desktop,
 * and multi-select batch actions via CardActionBar.
 */

import { useState, useEffect, useCallback } from 'react'
import { Check, X, UserPlus, Clock, Search } from 'lucide-react'

import { SwipeableCard } from '../SwipeableCard'
import { CardContextMenu } from '../CardContextMenu'
import { CardActionBar } from '../CardActionBar'
import { LoadingSpinner } from '../LoadingSpinner'
import { StatusBanner } from '../Settings/StatusBanner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import {
  getAllAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
} from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { UI_TIMING } from '../../Utilities/constants'

// ─── Filter type ────────────────────────────────────────────
type FilterTab = 'pending' | 'approved' | 'rejected' | 'all'
const FILTER_TABS: readonly FilterTab[] = ['pending', 'approved', 'rejected', 'all'] as const

// ─── Status badge colors ────────────────────────────────────
function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':  return 'bg-themeyellow/10 text-themeyellow border-themeyellow/30'
    case 'approved': return 'bg-themegreen/10 text-themegreen border-themegreen/30'
    case 'rejected': return 'bg-themeredred/10 text-themeredred border-themeredred/30'
    default:         return 'bg-tertiary/10 text-tertiary border-tertiary/30'
  }
}

// ─── Component ──────────────────────────────────────────────
export function AdminRequestsList() {
  // Data
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [searchQuery, setSearchQuery] = useState('')

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Status feedback
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Swipe + selection
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ requestId: string; x: number; y: number } | null>(null)
  const multiSelectMode = selectedIds.size > 0

  // Clear status banner after a delay
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), UI_TIMING.FEEDBACK_DURATION)
    return () => clearTimeout(t)
  }, [status])

  // ── Data loading ────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setLoading(true)
    const data = await getAllAccountRequests(filter === 'all' ? undefined : filter)
    setRequests(data)
    setLoading(false)
  }, [filter])

  useEffect(() => { loadRequests() }, [loadRequests])

  // ── Search filtering ────────────────────────────────────
  const filteredRequests = searchQuery.trim()
    ? requests.filter((r) => {
        const q = searchQuery.toLowerCase()
        const fullName = `${r.first_name} ${r.middle_initial ?? ''} ${r.last_name}`.toLowerCase()
        return (
          fullName.includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.credential?.toLowerCase().includes(q) ?? false) ||
          (r.rank?.toLowerCase().includes(q) ?? false)
        )
      })
    : requests

  // ── Approve handler ─────────────────────────────────────
  const handleApprove = useCallback(async (requestId: string) => {
    setProcessingId(requestId)
    const result = await approveAccountRequest(requestId)
    if (result.success) {
      setApprovingId(null)
      setStatus({ type: 'success', message: 'Account approved and setup email sent' })
      await loadRequests()
    } else {
      setStatus({ type: 'error', message: `Failed to approve: ${result.error}` })
    }
    setProcessingId(null)
  }, [loadRequests])

  // ── Reject handler ──────────────────────────────────────
  const handleReject = useCallback(async (requestId: string) => {
    if (!rejectReason.trim()) {
      setStatus({ type: 'error', message: 'Please provide a rejection reason' })
      return
    }
    setProcessingId(requestId)
    const result = await rejectAccountRequest(requestId, rejectReason)
    if (result.success) {
      setRejectingId(null)
      setRejectReason('')
      setStatus({ type: 'success', message: 'Request rejected' })
      await loadRequests()
    } else {
      setStatus({ type: 'error', message: `Failed to reject: ${result.error}` })
    }
    setProcessingId(null)
  }, [rejectReason, loadRequests])

  // ── Batch approve (multi-select) ────────────────────────
  const handleBatchApprove = useCallback(async () => {
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    for (const id of ids) {
      await handleApprove(id)
    }
  }, [selectedIds, handleApprove])

  // ── Batch reject (multi-select) ─────────────────────────
  const handleBatchReject = useCallback(async () => {
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    // Batch reject uses a generic reason
    for (const id of ids) {
      setProcessingId(id)
      await rejectAccountRequest(id, 'Batch rejected by admin')
      setProcessingId(null)
    }
    setStatus({ type: 'success', message: `Rejected ${ids.length} request(s)` })
    await loadRequests()
  }, [selectedIds, loadRequests])

  // ── Toggle selection ────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Loading state ───────────────────────────────────────
  if (showLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner className="text-tertiary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header: description, filter tabs, search — pinned at top */}
      <div className="shrink-0 px-5 pt-4 pb-2 space-y-3">
        <p className="text-xs text-tertiary leading-relaxed">
          Review and approve account requests. Swipe left or right-click for actions.
        </p>

        {status && <StatusBanner type={status.type} message={status.message} />}

        {/* Filter tabs */}
        <div className="flex gap-1 p-0.5 bg-themewhite2 rounded-lg overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                filter === tab
                  ? 'bg-themeblue2 text-white shadow-sm'
                  : 'text-tertiary/70 hover:text-primary'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, credential..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-themewhite2 border border-tertiary/10 text-sm text-primary placeholder:text-tertiary/40 focus:outline-none focus:border-themeblue2/40"
          />
        </div>
      </div>

      {/* Card list — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={28} className="mx-auto mb-3 text-tertiary/30" />
            <p className="text-tertiary/60 text-sm">
              No {filter !== 'all' ? filter : ''} requests found
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const isPending = request.status === 'pending'
              const isSelected = selectedIds.has(request.id)

              return (
                <SwipeableCard
                  key={request.id}
                  isOpen={openSwipeId === request.id}
                  enabled={isPending && !multiSelectMode}
                  actions={isPending ? [
                    {
                      key: 'approve',
                      label: 'Approve',
                      icon: Check,
                      iconBg: 'bg-themegreen/15',
                      iconColor: 'text-themegreen',
                      onAction: () => setApprovingId(request.id),
                    },
                    {
                      key: 'reject',
                      label: 'Reject',
                      icon: X,
                      iconBg: 'bg-themeredred/15',
                      iconColor: 'text-themeredred',
                      onAction: () => { setRejectingId(request.id); setApprovingId(null) },
                    },
                  ] : []}
                  onOpen={() => setOpenSwipeId(request.id)}
                  onClose={() => { if (openSwipeId === request.id) setOpenSwipeId(null) }}
                  onContextMenu={isPending ? (e) => {
                    e.preventDefault()
                    setContextMenu({ requestId: request.id, x: e.clientX, y: e.clientY })
                  } : undefined}
                  onTap={isPending ? () => {
                    if (multiSelectMode) {
                      toggleSelect(request.id)
                      return
                    }
                    setOpenSwipeId(null)
                    const isTogglingOff = selectedIds.has(request.id)
                    setSelectedIds(isTogglingOff ? new Set() : new Set([request.id]))
                  } : undefined}
                >
                  <div
                    className={`rounded-xl border px-4 py-3.5 transition-colors ${
                      isSelected
                        ? 'border-themeblue2/30 bg-themeblue2/5'
                        : 'border-tertiary/15 bg-themewhite2'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2">
                          <Check size={16} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/10">
                          <UserPlus size={18} className="text-themeblue2" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10pt] font-semibold text-primary truncate">
                            {request.first_name}
                            {request.middle_initial ? ` ${request.middle_initial}` : ''}{' '}
                            {request.last_name}
                          </span>
                        </div>
                        <p className="text-[10pt] text-tertiary/70 truncate mt-0.5">
                          {request.email}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {request.credential && (
                            <span className="text-[10pt] text-primary/80">{request.credential}</span>
                          )}
                          {request.credential && request.rank && (
                            <span className="text-tertiary/30">&middot;</span>
                          )}
                          {request.rank && (
                            <span className="text-[10pt] text-primary/80">{request.rank}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[9pt] font-medium border ${
                          request.request_type === 'profile_change'
                            ? 'bg-themeblue2/10 text-themeblue2 border-themeblue2/30'
                            : 'bg-themepurple/10 text-themepurple border-themepurple/30'
                        }`}>
                          {request.request_type === 'profile_change' ? 'CHANGE' : 'NEW'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9pt] font-medium border ${getStatusColor(request.status)}`}>
                          {request.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {isSelected && !multiSelectMode && (
                      <div className="mt-3 pt-3 border-t border-tertiary/10 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-[10pt]">
                          {request.component && (
                            <div>
                              <span className="text-tertiary/60">Component:</span>{' '}
                              <span className="text-primary font-medium">{request.component}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-tertiary/60">UIC:</span>{' '}
                            <span className="text-primary font-medium">{request.uic}</span>
                          </div>
                        </div>

                        {request.notes && (
                          <div className="p-2 bg-themewhite rounded-lg text-[10pt]">
                            <span className="text-tertiary/60">Notes:</span>{' '}
                            <span className="text-primary">{request.notes}</span>
                          </div>
                        )}

                        <p className="text-[9pt] text-tertiary/50">
                          Requested: {new Date(request.requested_at).toLocaleString()}
                        </p>

                        {isPending && approvingId === request.id && (
                          <div className="p-3 bg-themegreen/10 rounded-lg">
                            <p className="text-[10pt] text-themegreen font-medium mb-2">
                              Create account and send setup email to {request.email}?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(request.id)}
                                disabled={processingId === request.id}
                                className="flex-1 px-3 py-2 rounded-lg bg-themegreen text-white text-[10pt] font-medium hover:bg-themegreen/90 disabled:opacity-50 transition-colors"
                              >
                                {processingId === request.id ? 'Creating...' : 'Confirm & Send Email'}
                              </button>
                              <button
                                onClick={() => setApprovingId(null)}
                                className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-[10pt] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {isPending && rejectingId === request.id && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Rejection reason..."
                              className="flex-1 px-3 py-2 rounded-lg bg-themewhite border border-tertiary/10 text-[10pt] text-primary placeholder:text-tertiary/40 focus:outline-none focus:border-themeredred/40"
                            />
                            <button
                              onClick={() => handleReject(request.id)}
                              disabled={processingId === request.id}
                              className="px-3 py-2 rounded-lg bg-themeredred text-white text-[10pt] font-medium hover:bg-themeredred/90 disabled:opacity-50 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => { setRejectingId(null); setRejectReason('') }}
                              className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-[10pt] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {isPending && approvingId !== request.id && rejectingId !== request.id && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setApprovingId(request.id); setRejectingId(null) }}
                              disabled={processingId === request.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-themegreen text-white font-medium text-[10pt] hover:bg-themegreen/90 disabled:opacity-50 transition-colors"
                            >
                              <Check size={16} /> Approve
                            </button>
                            <button
                              onClick={() => { setRejectingId(request.id); setApprovingId(null) }}
                              disabled={processingId === request.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-themeredred text-white font-medium text-[10pt] hover:bg-themeredred/90 disabled:opacity-50 transition-colors"
                            >
                              <X size={16} /> Reject
                            </button>
                          </div>
                        )}

                        {request.status === 'approved' && (
                          <div className="p-3 bg-themegreen/10 rounded-lg text-[10pt]">
                            <div className="flex items-center gap-2 text-themegreen">
                              <UserPlus size={16} />
                              <span className="font-medium">Account created</span>
                            </div>
                            <p className="text-themegreen text-[9pt] mt-1">
                              User can now sign in with the password they set during registration.
                            </p>
                          </div>
                        )}

                        {request.status === 'rejected' && request.rejection_reason && (
                          <div className="p-3 bg-themeredred/10 rounded-lg text-[10pt]">
                            <span className="text-themeredred font-medium">Reason:</span>
                            <p className="text-themeredred text-[9pt] mt-1">{request.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SwipeableCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Multi-select action bar — pinned at bottom, outside scroll */}
      {multiSelectMode && (
        <div className="shrink-0">
          <CardActionBar
            selectedCount={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            actions={[
              {
                key: 'approve',
                label: 'Approve',
                icon: Check,
                iconBg: 'bg-themegreen/15',
                iconColor: 'text-themegreen',
                onAction: handleBatchApprove,
              },
              {
                key: 'reject',
                label: 'Reject',
                icon: X,
                iconBg: 'bg-themeredred/15',
                iconColor: 'text-themeredred',
                onAction: handleBatchReject,
              },
            ]}
          />
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              key: 'approve',
              label: 'Approve',
              icon: Check,
              onAction: () => setApprovingId(contextMenu.requestId),
            },
            {
              key: 'reject',
              label: 'Reject',
              icon: X,
              destructive: true,
              onAction: () => { setRejectingId(contextMenu.requestId); setApprovingId(null) },
            },
          ]}
        />
      )}
    </div>
  )
}
