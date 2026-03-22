import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, Building2, RotateCcw, Trash2, UserCheck, Eye, Check, X, HelpCircle } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { CardContextMenu } from '../CardContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useLongPress } from '../../Hooks/useLongPress'
import {
  getAllAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
  reopenAccountRequest,
  deleteAccountRequest,
  listClinics,
  listAllUsers,
} from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { UI_TIMING } from '../../Utilities/constants'

// ─── Status badge colors ────────────────────────────────────
function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':  return 'bg-themeyellow/10 text-themeyellow border-themeyellow/30'
    case 'approved': return 'bg-themegreen/10 text-themegreen border-themegreen/30'
    case 'rejected': return 'bg-themeredred/10 text-themeredred border-themeredred/30'
    default:         return 'bg-tertiary/10 text-tertiary border-tertiary/30'
  }
}

// ─── Public Interface ───────────────────────────────────────
interface AdminRequestsListProps {
  searchQuery?: string
  /** Called after a request is approved — passes the new user so the parent can open the edit form */
  onUserApproved?: (user: {
    id: string
    first_name: string
    last_name: string
    email: string
    supervisor?: boolean
    noteIncludeHPI?: boolean
    noteIncludePE?: boolean
    peDepth?: string
  }) => void
}

// ─── Per-card long-press wrapper ────────────────────────────
function RequestCard({
  request,
  expandedId,
  setExpandedId,
  approvingId,
  setApprovingId,
  rejectingId,
  setRejectingId,
  processingId,
  rejectReason,
  setRejectReason,
  handleApprove,
  handleReject,
  handleReopen,
  setConfirmDeleteId,
  matchedClinic,
  isExistingUser,
  setContextMenu,
  approvalSupervisor,
  setApprovalSupervisor,
  approvalIncludeHPI,
  setApprovalIncludeHPI,
  approvalIncludePE,
  setApprovalIncludePE,
  approvalPeDepth,
  setApprovalPeDepth,
}: {
  request: AccountRequest
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  approvingId: string | null
  setApprovingId: (id: string | null) => void
  rejectingId: string | null
  setRejectingId: (id: string | null) => void
  processingId: string | null
  rejectReason: string
  setRejectReason: (v: string) => void
  handleApprove: (id: string) => void
  handleReject: (id: string) => void
  handleReopen: (id: string) => void
  setConfirmDeleteId: (id: string | null) => void
  matchedClinic: AdminClinic | undefined
  isExistingUser: boolean
  setContextMenu: (v: { requestId: string; x: number; y: number } | null) => void
  approvalSupervisor: boolean
  setApprovalSupervisor: (v: boolean) => void
  approvalIncludeHPI: boolean
  setApprovalIncludeHPI: (v: boolean) => void
  approvalIncludePE: boolean
  setApprovalIncludePE: (v: boolean) => void
  approvalPeDepth: string
  setApprovalPeDepth: (v: string) => void
}) {
  const isSupport = request.request_type === 'support'
  const isPending = request.status === 'pending'
  const isRejected = request.status === 'rejected'
  const hasActions = isSupport ? true : (isPending || isRejected)
  const isExpanded = expandedId === request.id

  const longPress = useLongPress((x: number, y: number) => {
    if (!hasActions) return
    setContextMenu({ requestId: request.id, x, y })
  }, { delay: 500 })

  const handleTap = useCallback(() => {
    if (!hasActions) return
    setExpandedId(isExpanded ? null : request.id)
  }, [hasActions, isExpanded, request.id, setExpandedId])

  const iconBg = isSupport
    ? 'bg-themeblue2/10'
    : request.status === 'pending'  ? 'bg-themeyellow/10'
    : request.status === 'approved' ? 'bg-themegreen/10'
    : request.status === 'rejected' ? 'bg-themeredred/10'
    : 'bg-tertiary/10'

  const IconComponent = isSupport
    ? HelpCircle
    : request.status === 'pending'  ? Clock
    : request.status === 'approved' ? UserCheck
    : X

  const iconColor = isSupport
    ? 'text-themeblue2'
    : request.status === 'pending'  ? 'text-themeyellow'
    : request.status === 'approved' ? 'text-themegreen'
    : 'text-themeredred'

  return (
    <div
      {...longPress}
      onContextMenu={hasActions ? (e) => {
        e.preventDefault()
        setContextMenu({ requestId: request.id, x: e.clientX, y: e.clientY })
      } : undefined}
      onClick={handleTap}
      className="transition-all hover:bg-themeblue2/5 cursor-pointer select-none"
    >
      {/* Row 1: icon + name/subtitle + status badge */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <IconComponent size={16} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">
            {isSupport ? (
              `${request.first_name}${request.last_name ? ` ${request.last_name}` : ''}`
            ) : (
              <>
                {request.rank ? `${request.rank} ` : ''}
                {request.first_name}
                {request.middle_initial ? ` ${request.middle_initial}` : ''}{' '}
                {request.last_name}
              </>
            )}
          </p>
          <p className="text-[11px] text-tertiary/70 mt-0.5 truncate">
            {isSupport
              ? request.email
              : [request.credential, request.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${getStatusColor(request.status)}`}>
          {isSupport ? 'Help' : request.status}
        </span>
      </div>

      {/* Row 2: UIC + clinic */}
      {!isSupport && request.uic && (
        <div className="flex items-center gap-2 flex-wrap px-4 pb-2">
          <span className="text-[10pt] text-tertiary">{request.uic}</span>
          {matchedClinic ? (
            <span className="inline-flex items-center gap-1 text-[10pt] text-tertiary">
              <Building2 size={12} />
              {matchedClinic.name}
            </span>
          ) : (
            <span className="text-[10pt] text-tertiary">No clinic match</span>
          )}
        </div>
      )}

      {/* Support request: show message preview */}
      {isSupport && request.notes && !isExpanded && (
        <p className="text-[10pt] text-tertiary px-4 pb-2 line-clamp-2">{request.notes}</p>
      )}

      {/* Already a user note */}
      {isExistingUser && (
        <p className="text-[10pt] text-tertiary px-4 pb-2">Already a user — safe to clear this request</p>
      )}

      {/* Expanded detail section */}
      {isExpanded && isSupport && (
        <div className="px-4 pb-3.5 pt-3 border-t border-tertiary/10 space-y-2" onClick={(e) => e.stopPropagation()}>
          {request.notes && (
            <p className="text-[10pt] text-primary whitespace-pre-wrap">{request.notes}</p>
          )}
          <p className="text-[10pt] text-tertiary">
            Submitted: {new Date(request.requested_at).toLocaleString()}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setConfirmDeleteId(request.id)}
              className="text-[10pt] text-themeredred font-medium transition-colors active:scale-95"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isExpanded && !isSupport && (
        <div className="px-4 pb-3.5 pt-3 border-t border-tertiary/10 space-y-2" onClick={(e) => e.stopPropagation()}>
          {request.component && (
            <p className="text-[10pt] text-tertiary">
              Component: <span className="text-primary font-medium">{request.component}</span>
            </p>
          )}

          {matchedClinic ? (
            <p className="text-[10pt] text-tertiary">
              Suggested clinic: <span className="text-primary font-medium">{matchedClinic.name}</span>
              {matchedClinic.location ? ` — ${matchedClinic.location}` : ''}
            </p>
          ) : request.uic ? (
            <p className="text-[10pt] text-tertiary">
              No clinic found for UIC {request.uic} — assign manually after approval
            </p>
          ) : null}

          {request.notes && (
            <p className="text-[10pt] text-tertiary">
              Notes: <span className="text-primary">{request.notes}</span>
            </p>
          )}

          <p className="text-[10pt] text-tertiary">
            Requested: {new Date(request.requested_at).toLocaleString()}
          </p>

          {/* Approval confirmation panel */}
          {isPending && approvingId === request.id && (
            <div className="p-3 bg-themewhite rounded-lg border border-tertiary/10 space-y-3">
              <p className="text-[10pt] text-primary font-medium">
                Create account and send setup email to {request.email}?
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approvalSupervisor}
                    onChange={(e) => setApprovalSupervisor(e.target.checked)}
                    className="w-4 h-4 rounded border-tertiary/30"
                  />
                  <span className="text-[10pt] text-primary">Supervisor</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approvalIncludeHPI}
                    onChange={(e) => setApprovalIncludeHPI(e.target.checked)}
                    className="w-4 h-4 rounded border-tertiary/30"
                  />
                  <span className="text-[10pt] text-primary">Include HPI</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approvalIncludePE}
                    onChange={(e) => setApprovalIncludePE(e.target.checked)}
                    className="w-4 h-4 rounded border-tertiary/30"
                  />
                  <span className="text-[10pt] text-primary">Include PE</span>
                </label>

                {approvalIncludePE && (
                  <div className="pl-6">
                    <select
                      value={approvalPeDepth}
                      onChange={(e) => setApprovalPeDepth(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-themewhite2 border border-tertiary/10 text-[10pt] text-primary focus:border-themeblue2 focus:outline-none"
                    >
                      <option value="focused">Focused</option>
                      <option value="standard">Standard</option>
                      <option value="comprehensive">Comprehensive</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleApprove(request.id)}
                  disabled={processingId === request.id}
                  className="px-4 py-1.5 rounded-lg bg-themeblue3 text-white text-[10pt] font-medium disabled:opacity-50 transition-colors active:scale-95"
                >
                  {processingId === request.id ? 'Creating...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setApprovingId(null)}
                  className="text-[10pt] text-tertiary hover:text-primary transition-colors active:scale-95"
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
                className="flex-1 px-3 py-1.5 rounded-lg bg-themewhite border border-tertiary/10 text-[10pt] text-primary placeholder:text-tertiary/40 focus:outline-none focus:border-themeblue2"
              />
              <button
                onClick={() => handleReject(request.id)}
                disabled={processingId === request.id}
                className="px-3 py-1.5 rounded-lg bg-themeblue3 text-white text-[10pt] font-medium disabled:opacity-50 transition-colors active:scale-95"
              >
                Confirm
              </button>
              <button
                onClick={() => { setRejectingId(null); setRejectReason('') }}
                className="text-[10pt] text-tertiary hover:text-primary transition-colors active:scale-95"
              >
                Cancel
              </button>
            </div>
          )}

          {isPending && approvingId !== request.id && rejectingId !== request.id && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => { setApprovingId(request.id); setRejectingId(null) }}
                disabled={processingId === request.id}
                className="px-4 py-1.5 rounded-lg bg-themeblue3 text-white font-medium text-[10pt] disabled:opacity-50 transition-colors active:scale-95"
              >
                Approve
              </button>
              <button
                onClick={() => { setRejectingId(request.id); setApprovingId(null) }}
                disabled={processingId === request.id}
                className="text-[10pt] text-themeredred font-medium disabled:opacity-50 transition-colors active:scale-95"
              >
                Reject
              </button>
            </div>
          )}

          {request.status === 'approved' && (
            <p className="text-[10pt] text-tertiary">
              Account created — user can sign in with the password set during registration.
            </p>
          )}

          {request.status === 'rejected' && request.rejection_reason && (
            <p className="text-[10pt] text-tertiary">
              Rejected: <span className="text-primary">{request.rejection_reason}</span>
            </p>
          )}

          {isRejected && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => handleReopen(request.id)}
                disabled={processingId === request.id}
                className="px-4 py-1.5 rounded-lg bg-themeblue3 text-white font-medium text-[10pt] disabled:opacity-50 transition-colors active:scale-95"
              >
                Return to Pending
              </button>
              <button
                onClick={() => setConfirmDeleteId(request.id)}
                disabled={processingId === request.id}
                className="text-[10pt] text-themeredred font-medium disabled:opacity-50 transition-colors active:scale-95"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────
export function AdminRequestsList({ searchQuery: searchQueryProp, onUserApproved }: AdminRequestsListProps) {
  const searchQuery = searchQueryProp ?? ''

  // Data
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [userEmails, setUserEmails] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // Approval options — reset when approvingId changes
  const [approvalSupervisor, setApprovalSupervisor] = useState(false)
  const [approvalIncludeHPI, setApprovalIncludeHPI] = useState(true)
  const [approvalIncludePE, setApprovalIncludePE] = useState(false)
  const [approvalPeDepth, setApprovalPeDepth] = useState('standard')

  useEffect(() => {
    setApprovalSupervisor(false)
    setApprovalIncludeHPI(true)
    setApprovalIncludePE(false)
    setApprovalPeDepth('standard')
  }, [approvingId])

  // Status feedback
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Expand + context menu
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ requestId: string; x: number; y: number } | null>(null)

  // Clear status banner after a delay
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), UI_TIMING.FEEDBACK_DURATION)
    return () => clearTimeout(t)
  }, [status])

  // ── Data loading ────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setLoading(true)
    const [reqData, clinicData, userData] = await Promise.all([
      getAllAccountRequests(),
      listClinics(),
      listAllUsers(),
    ])
    setRequests(reqData)
    setClinics(clinicData)
    setUserEmails(new Set(userData.map(u => u.email?.toLowerCase()).filter(Boolean)))
    setLoading(false)
  }, [])

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

  // ── Search filtering + sorting (pending first, then by date) ──
  const filteredRequests = useMemo(() => {
    let result = requests.filter(r => r.status !== 'approved')

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((r) => {
        const fullName = `${r.first_name} ${r.middle_initial ?? ''} ${r.last_name}`.toLowerCase()
        return (
          fullName.includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.credential?.toLowerCase().includes(q) ?? false) ||
          (r.rank?.toLowerCase().includes(q) ?? false) ||
          (r.notes?.toLowerCase().includes(q) ?? false)
        )
      })
    }

    return [...result].sort((a, b) => {
      const aPending = a.status === 'pending' ? 0 : 1
      const bPending = b.status === 'pending' ? 0 : 1
      if (aPending !== bPending) return aPending - bPending
      return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    })
  }, [requests, searchQuery])

  // ── Approve handler ─────────────────────────────────────
  const handleApprove = useCallback(async (requestId: string) => {
    setProcessingId(requestId)
    const result = await approveAccountRequest(requestId)
    if (result.success) {
      setApprovingId(null)
      setStatus({ type: 'success', message: 'Account approved and setup email sent' })
      await loadRequests()

      if (onUserApproved && result.data?.userId) {
        onUserApproved({
          id: result.data.userId,
          first_name: result.data.firstName ?? '',
          last_name: result.data.lastName ?? '',
          email: result.data.email ?? '',
          supervisor: approvalSupervisor,
          noteIncludeHPI: approvalIncludeHPI,
          noteIncludePE: approvalIncludePE,
          peDepth: approvalPeDepth,
        })
      }
    } else {
      setStatus({ type: 'error', message: `Failed to approve: ${result.error}` })
    }
    setProcessingId(null)
  }, [loadRequests, onUserApproved, approvalSupervisor, approvalIncludeHPI, approvalIncludePE, approvalPeDepth])

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

  // ── Reopen handler ──────────────────────────────────────
  const handleReopen = useCallback(async (requestId: string) => {
    setProcessingId(requestId)
    const result = await reopenAccountRequest(requestId)
    if (result.success) {
      setStatus({ type: 'success', message: 'Request reopened — moved back to pending' })
      await loadRequests()
    } else {
      setStatus({ type: 'error', message: `Failed to reopen: ${result.error}` })
    }
    setProcessingId(null)
  }, [loadRequests])

  // ── Delete handler ──────────────────────────────────────
  const handleDeleteRequest = useCallback(async (requestId: string) => {
    setDeleteProcessing(true)
    const result = await deleteAccountRequest(requestId)
    if (result.success) {
      setConfirmDeleteId(null)
      setStatus({ type: 'success', message: 'Request permanently deleted' })
      await loadRequests()
    } else {
      setStatus({ type: 'error', message: `Failed to delete: ${result.error}` })
    }
    setDeleteProcessing(false)
  }, [loadRequests])

  // ── Loading state ───────────────────────────────────────
  if (showLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner className="text-tertiary" />
      </div>
    )
  }

  return (
    <div>
      <div className="px-5 pt-4 pb-2 space-y-5">
        {status && <ErrorDisplay type={status.type} message={status.message} />}
      </div>

      <div className="px-5 pb-4">
        {filteredRequests.length === 0 ? (
          <EmptyState
            icon={<Clock size={28} />}
            title={searchQuery ? 'No requests match your search' : 'No requests found'}
          />
        ) : (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-themeblue3/10">
            {filteredRequests.map((request) => {
              const isRejected = request.status === 'rejected'
              const matchedClinic = request.uic
                ? uicToClinic.get(request.uic.toUpperCase())
                : undefined
              const isExistingUser = isRejected && userEmails.has(request.email.toLowerCase())

              return (
                <RequestCard
                  key={request.id}
                  request={request}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  approvingId={approvingId}
                  setApprovingId={setApprovingId}
                  rejectingId={rejectingId}
                  setRejectingId={setRejectingId}
                  processingId={processingId}
                  rejectReason={rejectReason}
                  setRejectReason={setRejectReason}
                  handleApprove={handleApprove}
                  handleReject={handleReject}
                  handleReopen={handleReopen}
                  setConfirmDeleteId={setConfirmDeleteId}
                  matchedClinic={matchedClinic}
                  isExistingUser={isExistingUser}
                  setContextMenu={setContextMenu}
                  approvalSupervisor={approvalSupervisor}
                  setApprovalSupervisor={setApprovalSupervisor}
                  approvalIncludeHPI={approvalIncludeHPI}
                  setApprovalIncludeHPI={setApprovalIncludeHPI}
                  approvalIncludePE={approvalIncludePE}
                  setApprovalIncludePE={setApprovalIncludePE}
                  approvalPeDepth={approvalPeDepth}
                  setApprovalPeDepth={setApprovalPeDepth}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Right-click / long-press context menu */}
      {contextMenu && (() => {
        const ctxRequest = requests.find(r => r.id === contextMenu.requestId)
        const ctxItems = ctxRequest?.request_type === 'support' ? [
          {
            key: 'view',
            label: 'View',
            icon: Eye,
            onAction: () => setExpandedId(contextMenu.requestId),
          },
          {
            key: 'delete',
            label: 'Dismiss',
            icon: Trash2,
            destructive: true,
            onAction: () => setConfirmDeleteId(contextMenu.requestId),
          },
        ] : ctxRequest?.status === 'rejected' ? [
          {
            key: 'view',
            label: 'View',
            icon: Eye,
            onAction: () => setExpandedId(contextMenu.requestId),
          },
          {
            key: 'return',
            label: 'Return',
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
            key: 'view',
            label: 'View',
            icon: Eye,
            onAction: () => setExpandedId(contextMenu.requestId),
          },
          {
            key: 'approve',
            label: 'Approve',
            icon: Check,
            onAction: () => {
              setExpandedId(contextMenu.requestId)
              setApprovingId(contextMenu.requestId)
            },
          },
          {
            key: 'reject',
            label: 'Reject',
            icon: X,
            destructive: true,
            onAction: () => {
              setExpandedId(contextMenu.requestId)
              setRejectingId(contextMenu.requestId)
              setApprovingId(null)
            },
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
    </div>
  )
}
