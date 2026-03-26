import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, Building2, Trash2, UserCheck, Eye, X, HelpCircle, Check, RefreshCw } from 'lucide-react'
import { TextInput, PickerInput, MultiPickerInput, UicPinInput } from '../FormInputs'
import { EmptyState } from '../EmptyState'
import { CardContextMenu } from '../CardContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useLongPress } from '../../Hooks/useLongPress'
import { credentials, components, ranksByComponent } from '../../Data/User'
import type { Component } from '../../Data/User'
import {
  getAllAccountRequests,
  deleteAccountRequest,
  listClinics,
  listAllUsers,
  approveAccountRequest,
  rejectAccountRequest,
  reopenAccountRequest,
  updateUserProfile,
  setUserRoles,
  setUserClinic,
} from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { invalidate } from '../../stores/useInvalidationStore'
import { UI_TIMING } from '../../Utilities/constants'

// ─── Constants ──────────────────────────────────────────────
const AVAILABLE_ROLES = ['medic', 'supervisor', 'dev', 'provider'] as const
type Role = (typeof AVAILABLE_ROLES)[number]

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
  onApproved?: (userId: string, request: AccountRequest, configured: { roles: string[]; clinicId: string | null; noteIncludeHPI: boolean; noteIncludePE: boolean; peDepth: string }) => void
}

// ─── Per-card component ─────────────────────────────────────
function RequestCard({
  request,
  expandedId,
  setExpandedId,
  setConfirmDeleteId,
  matchedClinic: cardMatchedClinic,
  isExistingUser,
  setContextMenu,
  clinics,
  uicToClinic,
  onApproved,
  onRefresh,
}: {
  request: AccountRequest
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  setConfirmDeleteId: (id: string | null) => void
  matchedClinic: AdminClinic | undefined
  isExistingUser: boolean
  setContextMenu: (v: { requestId: string; x: number; y: number } | null) => void
  clinics: AdminClinic[]
  uicToClinic: Map<string, AdminClinic>
  onApproved?: (userId: string, request: AccountRequest, configured: { roles: string[]; clinicId: string | null; noteIncludeHPI: boolean; noteIncludePE: boolean; peDepth: string }) => void
  onRefresh: () => void
}) {
  const isSupport = request.request_type === 'support'
  const isPending = request.status === 'pending'
  const isRejected = request.status === 'rejected'
  const hasActions = isSupport ? true : (isPending || isRejected)
  const isExpanded = expandedId === request.id

  // ── Form state (only used when expanded + pending) ──────
  const [firstName, setFirstName] = useState(request.first_name || '')
  const [lastName, setLastName] = useState(request.last_name || '')
  const [middleInitial, setMiddleInitial] = useState(request.middle_initial || '')
  const [credential, setCredential] = useState(request.credential || '')
  const [component, setComponent] = useState(request.component || '')
  const [rank, setRank] = useState(request.rank || '')
  const [uic, setUic] = useState(request.uic || '')
  const [roles, setRoles] = useState<string[]>(['medic'])
  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [noteIncludeHPI, setNoteIncludeHPI] = useState(true)
  const [noteIncludePE, setNoteIncludePE] = useState(true)
  const [peDepth, setPeDepth] = useState('standard')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // ── Derived ─────────────────────────────────────────────
  const componentRanks = component ? ranksByComponent[component as Component] : []

  const clinicOptions = useMemo(
    () => clinics.map((c) => ({ value: c.id, label: `${c.name} (${c.uics.join(', ')})` })),
    [clinics],
  )

  const formMatchedClinic = uic ? uicToClinic.get(uic.toUpperCase()) : undefined

  // ── Auto-set clinic from UIC ────────────────────────────
  useEffect(() => {
    if (!isExpanded || !isPending || !uic || selectedClinicId) return
    const matched = uicToClinic.get(uic.toUpperCase())
    if (matched) setSelectedClinicId(matched.id)
  }, [isExpanded, isPending, uic, uicToClinic, selectedClinicId])

  // ── Component → rank filtering ──────────────────────────
  const handleComponentChange = useCallback((val: string) => {
    setComponent(val)
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
      setRank('')
    }
  }, [rank])

  // ── Handlers ────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    const chosenRoles = roles
    if (chosenRoles.length === 0) {
      setError('Select at least one role.')
      return
    }

    setProcessing(true)
    setError(null)

    const approveResult = await approveAccountRequest(request.id)
    if (!approveResult.success) {
      setError(approveResult.error || 'Failed to approve request')
      setProcessing(false)
      return
    }

    const userId = approveResult.userId
    const warnings: string[] = []

    const profileResult = await updateUserProfile(userId, {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      middleInitial,
      credential,
      component,
      rank,
      uic: uic || undefined,
      noteIncludeHPI,
      noteIncludePE,
      peDepth,
    })
    if (!profileResult.success) warnings.push('Profile update failed')

    const rolesResult = await setUserRoles(userId, chosenRoles as ('medic' | 'supervisor' | 'dev' | 'provider')[])
    if (!rolesResult.success) warnings.push('Role assignment failed')

    if (selectedClinicId) {
      const clinicResult = await setUserClinic(userId, selectedClinicId)
      if (!clinicResult.success) warnings.push('Clinic assignment failed')
    }

    setProcessing(false)

    if (warnings.length > 0) {
      setError(`Account created but: ${warnings.join(', ')}. Edit user to fix.`)
    }

    onApproved?.(userId, request, {
      roles: chosenRoles,
      clinicId: selectedClinicId,
      noteIncludeHPI,
      noteIncludePE,
      peDepth,
    })
    invalidate('requests', 'users')
    onRefresh()
  }, [
    request, firstName, lastName, middleInitial, credential, component, rank, uic,
    roles, selectedClinicId, noteIncludeHPI, noteIncludePE, peDepth, onApproved, onRefresh,
  ])

  const handleReject = useCallback(async () => {
    if (!rejectReason.trim()) {
      setError('Rejection reason required.')
      return
    }
    setProcessing(true)
    setError(null)
    const result = await rejectAccountRequest(request.id, rejectReason.trim())
    setProcessing(false)
    if (result.success) {
      setExpandedId(null)
      invalidate('requests')
      onRefresh()
    } else {
      setError(result.error || 'Failed to reject request')
    }
  }, [request.id, rejectReason, setExpandedId, onRefresh])

  const handleReopen = useCallback(async () => {
    setProcessing(true)
    setError(null)
    const result = await reopenAccountRequest(request.id)
    setProcessing(false)
    if (result.success) {
      setExpandedId(null)
      invalidate('requests')
      onRefresh()
    } else {
      setError(result.error || 'Failed to reopen request')
    }
  }, [request.id, setExpandedId, onRefresh])

  // ── Long press ──────────────────────────────────────────
  const longPress = useLongPress((x: number, y: number) => {
    if (!hasActions) return
    setContextMenu({ requestId: request.id, x, y })
  }, { delay: 500 })

  const handleTap = useCallback(() => {
    if (!hasActions) return
    setExpandedId(isExpanded ? null : request.id)
  }, [hasActions, isExpanded, setExpandedId, request.id])

  // ── Icon styling ────────────────────────────────────────
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

      {/* Row 2: UIC + clinic (hidden when expanded — form has these fields) */}
      {!isSupport && !isExpanded && request.uic && (
        <div className="flex items-center gap-2 flex-wrap px-4 pb-2">
          <span className="text-[10pt] font-normal text-tertiary">{request.uic}</span>
          {cardMatchedClinic ? (
            <span className="inline-flex items-center gap-1 text-[10pt] font-normal text-tertiary">
              <Building2 size={12} />
              {cardMatchedClinic.name}
            </span>
          ) : (
            <span className="text-[10pt] font-normal text-tertiary">No clinic match</span>
          )}
        </div>
      )}

      {/* Notes/justification preview (collapsed only) */}
      {!isSupport && !isExpanded && request.notes && (
        <p className="text-[10pt] font-normal text-tertiary/70 italic px-4 pb-2 line-clamp-2">{request.notes}</p>
      )}

      {/* Support request: show message preview (collapsed only) */}
      {isSupport && !isExpanded && request.notes && (
        <p className="text-[10pt] font-normal text-tertiary px-4 pb-2 line-clamp-2">{request.notes}</p>
      )}

      {/* Already a user note */}
      {!isExpanded && isExistingUser && (
        <p className="text-[10pt] font-normal text-tertiary px-4 pb-2">Already a user — safe to clear this request</p>
      )}

      {/* ── Expanded: support request (simple) ─────────────── */}
      {isExpanded && isSupport && (
        <div className="px-4 pb-3.5 pt-3 border-t border-tertiary/10 space-y-2" onClick={(e) => e.stopPropagation()}>
          {request.notes && (
            <p className="text-[10pt] font-normal text-primary whitespace-pre-wrap">{request.notes}</p>
          )}
          <p className="text-[10pt] font-normal text-tertiary">
            Submitted: {new Date(request.requested_at).toLocaleString()}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setConfirmDeleteId(request.id)}
              className="shrink-0 w-10 h-10 rounded-full text-themeredred flex items-center justify-center active:scale-95 transition-all"
              title="Dismiss"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Expanded: pending request (full edit form) ──────── */}
      {isExpanded && isPending && !isSupport && (
        <div
          className="border-t border-tertiary/10 px-4 pb-4 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`space-y-3 ${processing ? 'opacity-50 pointer-events-none' : ''}`}>
            {error && <ErrorDisplay message={error} />}

            {/* User justification */}
            <div className="rounded-xl bg-themeblue2/5 border border-themeblue2/10 px-3.5 py-2.5">
              <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-1">Justification</p>
              <p className={`text-sm whitespace-pre-wrap ${request.notes ? 'text-primary' : 'text-tertiary/40 italic'}`}>
                {request.notes || 'No justification provided'}
              </p>
            </div>

            {/* Profile — mirrors AccountRequestForm layout */}
            <div className="space-y-3">
                <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Edit Account</p>

                <div className="grid grid-cols-2 gap-2">
                  <TextInput value={firstName} onChange={setFirstName} placeholder="First Name *" required />
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <TextInput value={lastName} onChange={setLastName} placeholder="Last Name *" required />
                    </div>
                    <div className="w-11 shrink-0">
                      <TextInput value={middleInitial} onChange={(v) => setMiddleInitial(v.toUpperCase().slice(0, 1))} placeholder="MI" maxLength={1} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <PickerInput value={credential} onChange={setCredential} options={credentials} placeholder="Credential" />
                  <PickerInput value={component} onChange={handleComponentChange} options={components} placeholder="Component" />
                </div>

                {component && (
                  <PickerInput value={rank} onChange={setRank} options={componentRanks} placeholder="Rank" />
                )}

                <div>
                  <span className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-1.5 block">UIC</span>
                  <UicPinInput value={uic} onChange={setUic} spread />
                </div>

                <PickerInput value={selectedClinicId} onChange={setSelectedClinicId} options={clinicOptions} placeholder="Clinic" />
                {formMatchedClinic && selectedClinicId === formMatchedClinic.id && (
                  <p className="-mt-2 text-[11px] text-themegreen flex items-center gap-1">
                    <Building2 size={12} />
                    Auto-matched from UIC
                  </p>
                )}

                <MultiPickerInput
                  label="Roles"
                  value={roles}
                  onChange={setRoles}
                  options={AVAILABLE_ROLES.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
                  placeholder="Roles"
                  required
                />

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span className="text-sm text-primary">Include HPI</span>
                  <input type="checkbox" checked={noteIncludeHPI} onChange={() => setNoteIncludeHPI(!noteIncludeHPI)} className="w-4 h-4 rounded border-tertiary/30" />
                </label>
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span className="text-sm text-primary">Include PE</span>
                  <input type="checkbox" checked={noteIncludePE} onChange={() => setNoteIncludePE(!noteIncludePE)} className="w-4 h-4 rounded border-tertiary/30" />
                </label>
                <PickerInput value={peDepth} onChange={setPeDepth} options={['focused', 'standard', 'comprehensive']} placeholder="PE Depth" />
            </div>

            {/* Action buttons */}
            {rejectMode ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason..."
                  className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-themewhite2 border border-tertiary/10 text-sm text-primary placeholder:text-tertiary/40 focus:outline-none focus:border-themeblue2 transition-colors"
                />
                <button
                  onClick={() => { setRejectMode(false); setRejectReason('') }}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectReason.trim()}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeredred text-white disabled:opacity-30 active:scale-95 transition-all"
                >
                  {processing ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setRejectMode(true)}
                  disabled={processing}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-themeredred active:scale-95 transition-all disabled:opacity-30"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                >
                  {processing ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Expanded: rejected request (read-only + reopen) ── */}
      {isExpanded && isRejected && !isSupport && (
        <div
          className="border-t border-tertiary/10 px-4 pb-4 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`space-y-3 ${processing ? 'opacity-50 pointer-events-none' : ''}`}>
            {error && <ErrorDisplay message={error} />}

            {/* User justification */}
            <div className="rounded-xl bg-themeblue2/5 border border-themeblue2/10 px-3.5 py-2.5">
              <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-1">Justification</p>
              <p className={`text-sm whitespace-pre-wrap ${request.notes ? 'text-primary' : 'text-tertiary/40 italic'}`}>
                {request.notes || 'No justification provided'}
              </p>
            </div>

            {request.rejection_reason && (
              <div className="rounded-xl border border-themeredred/10 bg-themeredred/5 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold text-themeredred/60 tracking-widest uppercase mb-1">Rejection Reason</p>
                <p className="text-sm text-themeredred">{request.rejection_reason}</p>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                onClick={handleReopen}
                disabled={processing}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
              >
                {processing ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────
export function AdminRequestsList({ searchQuery: searchQueryProp, bare, onApproved }: AdminRequestsListProps) {
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
      invalidate('requests')
    } else {
      setStatus({ type: 'error', message: `Failed to delete: ${result.error}` })
    }
    setDeleteProcessing(false)
  }, [loadRequests])

  // ── Context menu helper: expand the card ────────────────
  const handleContextView = useCallback((requestId: string) => {
    setExpandedId(requestId)
  }, [])

  // ── Loading state ───────────────────────────────────────
  if (showLoading && !bare) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner className="text-tertiary" />
      </div>
    )
  }

  // ── Shared context menu items builder ───────────────────
  const buildContextItems = (ctxRequest: AccountRequest | undefined, requestId: string) => {
    if (!ctxRequest) return []
    if (ctxRequest.request_type === 'support') {
      return [
        { key: 'view', label: 'View', icon: Eye, onAction: () => handleContextView(requestId) },
        { key: 'delete', label: 'Dismiss', icon: Trash2, destructive: true, onAction: () => setConfirmDeleteId(requestId) },
      ]
    }
    return [
      { key: 'view', label: 'View', icon: Eye, onAction: () => handleContextView(requestId) },
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDeleteId(requestId) },
    ]
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
              clinics={clinics}
              uicToClinic={uicToClinic}
              onApproved={onApproved}
              onRefresh={loadRequests}
            />
          )
        })}

        {contextMenu && (() => {
          const ctxRequest = requests.find(r => r.id === contextMenu.requestId)
          const ctxItems = buildContextItems(ctxRequest, contextMenu.requestId)
          return <CardContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} items={ctxItems} />
        })()}

        <ConfirmDialog
          visible={!!confirmDeleteId}
          title="Delete this request?"
          subtitle="Permanent."
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
    <div className="pb-24">
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
                  clinics={clinics}
                  uicToClinic={uicToClinic}
                  onApproved={onApproved}
                  onRefresh={loadRequests}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Right-click / long-press context menu */}
      {contextMenu && (() => {
        const ctxRequest = requests.find(r => r.id === contextMenu.requestId)
        const ctxItems = buildContextItems(ctxRequest, contextMenu.requestId)

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
        subtitle="Permanent."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={() => { if (confirmDeleteId) handleDeleteRequest(confirmDeleteId) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
