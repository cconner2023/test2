import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, Building2, Trash2, UserCheck, X, HelpCircle, Check, RefreshCw, Mail } from 'lucide-react'
import { TextInput, PickerInput, MultiPickerInput, UicPinInput } from '../FormInputs'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorDisplay } from '../ErrorDisplay'
import { useLongPress } from '../../Hooks/useLongPress'
import { credentials, components, ranksByComponent } from '../../Data/User'
import type { Component } from '../../Data/User'
import {
  approveAccountRequest,
  rejectAccountRequest,
  reopenAccountRequest,
  updateUserProfile,
  setUserRoles,
  setUserClinic,
  sendApprovalEmail,
} from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { invalidate } from '../../stores/useInvalidationStore'

const AVAILABLE_ROLES = ['medic', 'supervisor', 'dev', 'provider'] as const

export function getRequestStatusColor(status: string): string {
  switch (status) {
    case 'pending':  return 'bg-themeyellow/10 text-themeyellow border-themeyellow/30'
    case 'approved': return 'bg-themegreen/10 text-themegreen border-themegreen/30'
    case 'rejected': return 'bg-themeredred/10 text-themeredred border-themeredred/30'
    default:         return 'bg-tertiary/10 text-tertiary border-tertiary/30'
  }
}

export interface RequestCardProps {
  request: AccountRequest
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  setConfirmDeleteId: (id: string | null) => void
  matchedClinic: AdminClinic | undefined
  isExistingUser: boolean
  setContextMenu: (v: { requestId: string; x: number; y: number } | null) => void
  clinics: AdminClinic[]
  uicToClinic: Map<string, AdminClinic>
  onApproved?: (userId: string, request: AccountRequest, configured: { roles: string[]; clinicId: string | null; warnings: string[] }) => void
  onRefresh: () => void
}

export function RequestCard({
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
}: RequestCardProps) {
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
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)

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
    if (uic.trim().length !== 6) {
      setError('UIC must be exactly 6 characters.')
      return
    }
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
    })
    if (!profileResult.success) warnings.push('Profile update failed')

    const rolesResult = await setUserRoles(userId, chosenRoles as ('medic' | 'supervisor' | 'dev' | 'provider')[])
    if (!rolesResult.success) warnings.push('Role assignment failed')

    if (selectedClinicId) {
      const clinicResult = await setUserClinic(userId, selectedClinicId)
      if (!clinicResult.success) warnings.push('Clinic assignment failed')
    }

    const emailResult = await sendApprovalEmail(approveResult.email)
    if (!emailResult.success) warnings.push('Approval email not delivered')

    setProcessing(false)

    if (warnings.length > 0) {
      setError(`Account created but: ${warnings.join(', ')}. Edit user to fix.`)
    }

    onApproved?.(userId, request, {
      roles: chosenRoles,
      clinicId: selectedClinicId,
      warnings,
    })
    invalidate('requests', 'users')
    onRefresh()
  }, [
    request, firstName, lastName, middleInitial, credential, component, rank, uic,
    roles, selectedClinicId, onApproved, onRefresh,
  ])

  const handleReject = useCallback(async () => {
    setConfirmReject(false)
    setProcessing(true)
    setError(null)
    const result = await rejectAccountRequest(request.id, '')
    setProcessing(false)
    if (result.success) {
      setExpandedId(null)
      invalidate('requests')
      onRefresh()
    } else {
      setError(result.error || 'Failed to reject request')
    }
  }, [request.id, setExpandedId, onRefresh])

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
  const { isPressing, ...longPress } = useLongPress((x: number, y: number) => {
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
      className={`transition-all hover:bg-themeblue2/5 cursor-pointer select-none ${isPressing ? 'opacity-60' : ''}`}
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
          <p className="text-[9pt] text-tertiary mt-0.5 truncate">
            {isSupport
              ? request.email
              : [request.credential, request.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`text-[9pt] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${getRequestStatusColor(request.status)}`}>
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
        <p className="text-[10pt] font-normal text-tertiary italic px-4 pb-2 line-clamp-2">{request.notes}</p>
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
            <a
              href={`mailto:${request.email}?subject=${encodeURIComponent('ADTMC Web App Inquiry')}&body=${encodeURIComponent(`${[request.first_name, request.last_name].filter(Boolean).join(' ')},\n\n`)}`}
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-themeblue2 active:scale-95 transition-all"
              aria-label="Email"
              title="Email"
            >
              <Mail size={16} />
            </a>
            <button
              onClick={() => setConfirmDeleteId(request.id)}
              className="shrink-0 w-10 h-10 rounded-full text-themeredred flex items-center justify-center active:scale-95 transition-all"
              aria-label="Dismiss"
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
          <div className={processing ? 'opacity-50 pointer-events-none' : undefined}>
            {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}

            {/* User justification */}
            <div className="rounded-xl bg-themeblue2/5 border border-themeblue2/10 px-3.5 py-2.5 mb-3">
              <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-1">Justification</p>
              <p className={`text-sm whitespace-pre-wrap ${request.notes ? 'text-primary' : 'text-tertiary italic'}`}>
                {request.notes || 'No justification provided'}
              </p>
            </div>

            <div className="rounded-2xl bg-themewhite overflow-hidden">
              <TextInput value={firstName} onChange={setFirstName} placeholder="First Name *" required />
              <div className="flex items-stretch border-b border-primary/6">
                <div className="flex-1 min-w-0">
                  <TextInput value={lastName} onChange={setLastName} placeholder="Last Name *" required />
                </div>
                <div className="w-16 shrink-0 border-l border-primary/6">
                  <TextInput value={middleInitial} onChange={(v) => setMiddleInitial(v.toUpperCase().slice(0, 1))} placeholder="MI" maxLength={1} />
                </div>
              </div>
              <PickerInput value={credential} onChange={setCredential} options={credentials} placeholder="Credential" />
              <PickerInput value={component} onChange={handleComponentChange} options={components} placeholder="Component" />
              {component && (
                <PickerInput value={rank} onChange={setRank} options={componentRanks} placeholder="Rank" />
              )}
              <UicPinInput value={uic} onChange={setUic} spread />
              <PickerInput value={selectedClinicId} onChange={setSelectedClinicId} options={clinicOptions} placeholder="Clinic" />
              {formMatchedClinic && selectedClinicId === formMatchedClinic.id && (
                <p className="px-4 py-2 text-[9pt] text-themegreen flex items-center gap-1 border-b border-primary/6">
                  <Building2 size={12} />
                  Auto-matched from UIC
                </p>
              )}
              <MultiPickerInput
                value={roles}
                onChange={setRoles}
                options={AVAILABLE_ROLES.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
                placeholder="Roles *"
                required
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 mt-2">
              <a
                href={`mailto:${request.email}?subject=${encodeURIComponent('ADTMC Web App Inquiry')}&body=${encodeURIComponent(`${[request.rank, request.last_name].filter(Boolean).join(' ')},\n\n`)}`}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-themeblue2 active:scale-95 transition-all"
                aria-label="Email"
                title="Email"
              >
                <Mail size={16} />
              </a>
              <button
                onClick={() => setConfirmReject(true)}
                disabled={processing}
                aria-label="Reject"
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-themeredred active:scale-95 transition-all disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={handleApprove}
                disabled={processing}
                aria-label="Approve"
                className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 disabled:opacity-30 ${uic.length === 6 && roles.length > 0 ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
              >
                {processing ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        visible={confirmReject}
        title={`Reject ${request.first_name ?? ''} ${request.last_name ?? 'this request'}?`}
        subtitle="The requester will see their account was rejected."
        confirmLabel="Reject"
        variant="danger"
        processing={processing}
        onConfirm={handleReject}
        onCancel={() => setConfirmReject(false)}
      />

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
              <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-1">Justification</p>
              <p className={`text-sm whitespace-pre-wrap ${request.notes ? 'text-primary' : 'text-tertiary italic'}`}>
                {request.notes || 'No justification provided'}
              </p>
            </div>

            {request.rejection_reason && (
              <div className="rounded-xl border border-themeredred/10 bg-themeredred/5 px-3.5 py-2.5">
                <p className="text-[9pt] font-semibold text-themeredred/60 tracking-widest uppercase mb-1">Rejection Reason</p>
                <p className="text-sm text-themeredred">{request.rejection_reason}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <a
                href={`mailto:${request.email}?subject=${encodeURIComponent('ADTMC Web App Inquiry')}&body=${encodeURIComponent(`${[request.rank, request.last_name].filter(Boolean).join(' ')},\n\n`)}`}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-themeblue2 active:scale-95 transition-all"
                aria-label="Email"
                title="Email"
              >
                <Mail size={18} />
              </a>
              <button
                onClick={handleReopen}
                disabled={processing}
                aria-label="Reopen"
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
