/**
 * AdminRequestsList -- account request management with swipeable cards.
 *
 * Displays account requests (new or profile-change) with filter tabs,
 * swipe-to-approve/reject on mobile, right-click context menu on desktop,
 * and multi-select batch actions via CardActionBar.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, X, UserPlus, Clock, Building2, RotateCcw, Trash2 } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { SearchInput } from '../SearchInput'

import { SwipeableCard } from '../SwipeableCard'
import { CardContextMenu } from '../CardContextMenu'
import { CardActionBar } from '../CardActionBar'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import {
  getAllAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
  reopenAccountRequest,
  deleteAccountRequest,
  listClinics,
} from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
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
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [searchQuery, setSearchQuery] = useState('')

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)

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
    const [reqData, clinicData] = await Promise.all([
      getAllAccountRequests(filter === 'all' ? undefined : filter),
      listClinics(),
    ])
    setRequests(reqData)
    setClinics(clinicData)
    setLoading(false)
  }, [filter])

  useEffect(() => { loadRequests() }, [loadRequests])

  // ── UIC → clinic lookup ────────────────────────────────
  const uicToClinic = useMemo(() => {
    const map = new Map<string, AdminClinic>()
    for (const clinic of clinics) {
      for (const uic of clinic.uics) {
        map.set(uic.toUpperCase(), clinic)
      }
    }
    return map
  }, [clinics])

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

  // ── Reopen handler ──────────────────────────────────────
  const handleReopen = useCallback(async (requestId: string) => {
    setProcessingId(requestId)
    const result = await reopenAccountRequest(requestId)
    if (result.success) {
      setStatus({ type: 'success', message: 'Request reopened — moved back to pending' })
      setSelectedIds(new Set())
      await loadRequests()
    } else {
      setStatus({ type: 'error', message: `Failed to reopen: ${result.error}` })
    }
    setProcessingId(null)
  }, [loadRequests])

  // ── Delete handler (called from ConfirmDialog) ─────────
  const handleDeleteRequest = useCallback(async (requestId: string) => {
    setDeleteProcessing(true)
    const result = await deleteAccountRequest(requestId)
    if (result.success) {
      setConfirmDeleteId(null)
      setStatus({ type: 'success', message: 'Request permanently deleted' })
      setSelectedIds(new Set())
      await loadRequests()
    } else {
      setStatus({ type: 'error', message: `Failed to delete: ${result.error}` })
    }
    setDeleteProcessing(false)
  }, [loadRequests])

  // ── Batch reopen (multi-select) ────────────────────────
  const handleBatchReopen = useCallback(async () => {
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    for (const id of ids) {
      setProcessingId(id)
      await reopenAccountRequest(id)
      setProcessingId(null)
    }
    setStatus({ type: 'success', message: `Reopened ${ids.length} request(s)` })
    await loadRequests()
  }, [selectedIds, loadRequests])

  // ── Batch delete (called from ConfirmDialog) ───────────
  const handleBatchDelete = useCallback(async () => {
    setDeleteProcessing(true)
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    for (const id of ids) {
      await deleteAccountRequest(id)
    }
    setConfirmBatchDelete(false)
    setDeleteProcessing(false)
    setStatus({ type: 'success', message: `Deleted ${ids.length} request(s)` })
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

        {status && <ErrorDisplay type={status.type} message={status.message} />}

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
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, email, credential..."
        />
      </div>

      {/* Card list — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {filteredRequests.length === 0 ? (
          <EmptyState
            icon={<Clock size={28} />}
            title={`No ${filter !== 'all' ? filter + ' ' : ''}requests found`}
          />
        ) : (
          <div className={`grid gap-3 ${
            filteredRequests.length === 1
              ? 'grid-cols-1'
              : filteredRequests.length === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}>
            {filteredRequests.map((request) => {
              const isPending = request.status === 'pending'
              const isRejected = request.status === 'rejected'
              const hasActions = isPending || isRejected
              const isSelected = selectedIds.has(request.id)
              const matchedClinic = request.uic
                ? uicToClinic.get(request.uic.toUpperCase())
                : undefined

              const swipeActions = isPending ? [
                {
                  key: 'approve',
                  label: 'Approve',
                  icon: Check,
                  iconBg: 'bg-themegreen/15',
                  iconColor: 'text-themegreen',
                  onAction: () => {
                    setSelectedIds(new Set([request.id]))
                    setApprovingId(request.id)
                    setRejectingId(null)
                    setOpenSwipeId(null)
                  },
                },
                {
                  key: 'reject',
                  label: 'Reject',
                  icon: X,
                  iconBg: 'bg-themeredred/15',
                  iconColor: 'text-themeredred',
                  onAction: () => {
                    setSelectedIds(new Set([request.id]))
                    setRejectingId(request.id)
                    setApprovingId(null)
                    setOpenSwipeId(null)
                  },
                },
              ] : isRejected ? [
                {
                  key: 'reopen',
                  label: 'Reopen',
                  icon: RotateCcw,
                  iconBg: 'bg-themeblue2/15',
                  iconColor: 'text-themeblue2',
                  onAction: () => {
                    setOpenSwipeId(null)
                    handleReopen(request.id)
                  },
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  iconBg: 'bg-themeredred/15',
                  iconColor: 'text-themeredred',
                  onAction: () => {
                    setOpenSwipeId(null)
                    setConfirmDeleteId(request.id)
                  },
                },
              ] : []

              return (
                <SwipeableCard
                  key={request.id}
                  isOpen={openSwipeId === request.id}
                  enabled={hasActions && !multiSelectMode}
                  actions={swipeActions}
                  onOpen={() => setOpenSwipeId(request.id)}
                  onClose={() => { if (openSwipeId === request.id) setOpenSwipeId(null) }}
                  onContextMenu={hasActions ? (e) => {
                    e.preventDefault()
                    setContextMenu({ requestId: request.id, x: e.clientX, y: e.clientY })
                  } : undefined}
                  onTap={hasActions ? () => {
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
                    className={`rounded-xl border px-4 py-3.5 transition-colors space-y-2 ${
                      isSelected
                        ? 'border-themeblue2/30 bg-themeblue2/5'
                        : 'border-tertiary/15 bg-themewhite2'
                    }`}
                  >
                    {/* Row 1: Avatar/check + name + email + 1-letter badges */}
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
                        <p className="text-sm font-semibold text-primary truncate">
                          {request.rank ? `${request.rank} ` : ''}
                          {request.first_name}
                          {request.middle_initial ? ` ${request.middle_initial}` : ''}{' '}
                          {request.last_name}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {request.credential && (
                            <p className="text-[9pt] text-tertiary/50 truncate">{request.credential}</p>
                          )}
                          {request.email && (
                            <p className="text-[9pt] text-tertiary/50 truncate">{request.email}</p>
                          )}
                        </div>
                      </div>

                      {/* Right: 1-letter type + status badges matching RoleBadge pattern */}
                      <div className="flex flex-wrap gap-0.5 shrink-0 max-w-[48px] justify-end">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${
                          request.request_type === 'profile_change'
                            ? 'bg-themeblue2/15 text-themeblue2'
                            : 'bg-themepurple/15 text-themepurple'
                        }`} title={request.request_type === 'profile_change' ? 'Profile Change' : 'New Account'}>
                          {request.request_type === 'profile_change' ? 'C' : 'N'}
                        </span>
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${getStatusColor(request.status)}`}
                          title={request.status.charAt(0).toUpperCase() + request.status.slice(1)}>
                          {request.status.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: UIC + matched clinic suggestion (prominent on card face) */}
                    {request.uic && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
                          {request.uic}
                        </span>
                        {matchedClinic ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themegreen/10 text-themegreen border-themegreen/30">
                            <Building2 size={9} />
                            {matchedClinic.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30">
                            <Building2 size={9} />
                            No clinic match
                          </span>
                        )}
                      </div>
                    )}

                    {isSelected && !multiSelectMode && (
                      <div className="mt-3 pt-3 border-t border-tertiary/10 space-y-2">
                        {/* Component / extra details */}
                        {(request.component) && (
                          <div className="text-[10pt]">
                            {request.component && (
                              <span className="text-tertiary/60">Component: <span className="text-primary font-medium">{request.component}</span></span>
                            )}
                          </div>
                        )}

                        {/* Clinic suggestion — expanded with location detail */}
                        {matchedClinic ? (
                          <div className="flex items-center gap-2 p-2 bg-themegreen/10 rounded-lg text-[10pt]">
                            <Building2 size={14} className="text-themegreen shrink-0" />
                            <div>
                              <span className="text-themegreen font-medium">Suggested clinic for UIC {request.uic}</span>
                              <p className="text-themegreen/80 text-[9pt]">
                                {matchedClinic.name}
                                {matchedClinic.location ? ` — ${matchedClinic.location}` : ''}
                              </p>
                            </div>
                          </div>
                        ) : request.uic ? (
                          <div className="flex items-center gap-2 p-2 bg-themeyellow/10 rounded-lg text-[10pt]">
                            <Building2 size={14} className="text-themeyellow shrink-0" />
                            <span className="text-themeyellow/80">
                              No clinic found for UIC {request.uic} — assign manually after approval
                            </span>
                          </div>
                        ) : null}

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

                        {isRejected && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReopen(request.id)}
                              disabled={processingId === request.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-themeblue3 text-white font-medium text-[10pt] hover:bg-themeblue3/90 disabled:opacity-50 transition-colors"
                            >
                              <RotateCcw size={16} /> Reopen
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(request.id)}
                              disabled={processingId === request.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-themeredred text-white font-medium text-[10pt] hover:bg-themeredred/90 disabled:opacity-50 transition-colors"
                            >
                              <Trash2 size={16} /> Delete
                            </button>
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
      {multiSelectMode && (() => {
        const selectedStatuses = new Set(
          [...selectedIds].map(id => requests.find(r => r.id === id)?.status).filter(Boolean)
        )
        const allPending = selectedStatuses.size === 1 && selectedStatuses.has('pending')
        const allRejected = selectedStatuses.size === 1 && selectedStatuses.has('rejected')

        const batchActions = allPending ? [
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
        ] : allRejected ? [
          {
            key: 'reopen',
            label: 'Reopen',
            icon: RotateCcw,
            iconBg: 'bg-themeblue2/15',
            iconColor: 'text-themeblue2',
            onAction: handleBatchReopen,
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            iconBg: 'bg-themeredred/15',
            iconColor: 'text-themeredred',
            onAction: () => setConfirmBatchDelete(true),
          },
        ] : []

        return (
          <div className="shrink-0">
            <CardActionBar
              selectedCount={selectedIds.size}
              onClear={() => setSelectedIds(new Set())}
              actions={batchActions}
            />
          </div>
        )
      })()}

      {/* Right-click context menu */}
      {contextMenu && (() => {
        const ctxRequest = requests.find(r => r.id === contextMenu.requestId)
        const ctxItems = ctxRequest?.status === 'rejected' ? [
          {
            key: 'reopen',
            label: 'Reopen',
            icon: RotateCcw,
            onAction: () => handleReopen(contextMenu.requestId),
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            onAction: () => setConfirmDeleteId(contextMenu.requestId),
          },
        ] : [
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
        ]

        return (
          <CardContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={ctxItems}
          />
        )
      })()}

      {/* Single delete confirmation */}
      <ConfirmDialog
        visible={!!confirmDeleteId}
        title="Permanently delete this request?"
        subtitle="This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={() => { if (confirmDeleteId) handleDeleteRequest(confirmDeleteId) }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Batch delete confirmation */}
      <ConfirmDialog
        visible={confirmBatchDelete}
        title={`Delete ${selectedIds.size} request(s)?`}
        subtitle="This will permanently remove the selected requests. This action cannot be undone."
        confirmLabel="Delete All"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={handleBatchDelete}
        onCancel={() => setConfirmBatchDelete(false)}
      />
    </div>
  )
}
