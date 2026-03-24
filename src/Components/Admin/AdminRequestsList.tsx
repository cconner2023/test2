import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, Building2, Trash2, UserCheck, Eye, X, HelpCircle } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { CardContextMenu } from '../CardContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useLongPress } from '../../Hooks/useLongPress'
import {
  getAllAccountRequests,
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
  /** When true, renders items without wrapper chrome (for unified search results) */
  bare?: boolean
  onSelectRequest?: (request: AccountRequest) => void
}

// ─── Per-card long-press wrapper ────────────────────────────
function RequestCard({
  request,
  expandedId,
  setExpandedId,
  setConfirmDeleteId,
  matchedClinic,
  isExistingUser,
  setContextMenu,
  onSelectRequest,
}: {
  request: AccountRequest
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  setConfirmDeleteId: (id: string | null) => void
  matchedClinic: AdminClinic | undefined
  isExistingUser: boolean
  setContextMenu: (v: { requestId: string; x: number; y: number } | null) => void
  onSelectRequest?: (request: AccountRequest) => void
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
    if (!isSupport && onSelectRequest) {
      onSelectRequest(request)
      return
    }
    if (!hasActions) return
    setExpandedId(isExpanded ? null : request.id)
  }, [isSupport, onSelectRequest, request, hasActions, isExpanded, setExpandedId])

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

      {/* Expanded detail section — support requests only */}
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
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────
export function AdminRequestsList({ searchQuery: searchQueryProp, bare, onSelectRequest }: AdminRequestsListProps) {
  const searchQuery = searchQueryProp ?? ''

  // Data
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [userEmails, setUserEmails] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

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
  if (showLoading && !bare) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner className="text-tertiary" />
      </div>
    )
  }

  // ── Bare mode: just the items (no wrapper chrome) ──────
  if (bare) {
    if (filteredRequests.length === 0) return null
    return (
      <>
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
              setConfirmDeleteId={setConfirmDeleteId}
              matchedClinic={matchedClinic}
              isExistingUser={isExistingUser}
              setContextMenu={setContextMenu}
              onSelectRequest={onSelectRequest}
            />
          )
        })}

        {contextMenu && (() => {
          const ctxRequest = requests.find(r => r.id === contextMenu.requestId)
          const ctxItems = ctxRequest?.request_type === 'support' ? [
            { key: 'view', label: 'View', icon: Eye, onAction: () => setExpandedId(contextMenu.requestId) },
            { key: 'delete', label: 'Dismiss', icon: Trash2, destructive: true, onAction: () => setConfirmDeleteId(contextMenu.requestId) },
          ] : ctxRequest?.status === 'rejected' ? [
            { key: 'view', label: 'View', icon: Eye, onAction: () => { if (onSelectRequest) { const r = requests.find(r => r.id === contextMenu.requestId); if (r) onSelectRequest(r) } } },
            { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDeleteId(contextMenu.requestId) },
          ] : [
            { key: 'view', label: 'View', icon: Eye, onAction: () => { if (onSelectRequest) { const r = requests.find(r => r.id === contextMenu.requestId); if (r) onSelectRequest(r) } } },
            { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDeleteId(contextMenu.requestId) },
          ]
          return <CardContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} items={ctxItems} />
        })()}

        <ConfirmDialog
          visible={!!confirmDeleteId}
          title="Delete this request?"
          subtitle="This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          processing={deleteProcessing}
          onConfirm={() => { if (confirmDeleteId) handleDeleteRequest(confirmDeleteId) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      </>
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
                  setConfirmDeleteId={setConfirmDeleteId}
                  matchedClinic={matchedClinic}
                  isExistingUser={isExistingUser}
                  setContextMenu={setContextMenu}
                  onSelectRequest={onSelectRequest}
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
            onAction: () => { if (onSelectRequest) { const r = requests.find(r => r.id === contextMenu.requestId); if (r) onSelectRequest(r) } },
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
            onAction: () => { if (onSelectRequest) { const r = requests.find(r => r.id === contextMenu.requestId); if (r) onSelectRequest(r) } },
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            onAction: () => setConfirmDeleteId(contextMenu.requestId),
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
