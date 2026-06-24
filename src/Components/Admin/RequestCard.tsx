import { useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { Clock, Building2, Trash2, UserCheck, X, HelpCircle, Check, RefreshCw, Mail } from 'lucide-react'
import { TextInput, PickerInput, MultiPickerInput, UicPinInput } from '../FormInputs'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorDisplay } from '../ErrorDisplay'
import { PreviewOverlay } from '../PreviewOverlay'
import { Z } from '../BaseOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { StepResults, type StepResult } from './StepResults'
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
  updateAccountRequestEmail,
  isValidEmail,
} from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { buildMailtoHref } from '../../lib/mailto'
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
  setContextMenu: (v: { requestId: string; rect: DOMRect; clone: ReactNode } | null) => void
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

  // Anchor for PreviewOverlay positioning
  const cardRef = useRef<HTMLDivElement>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  // ── Form state (only used when expanded + pending) ──────
  const [email, setEmail] = useState(request.email || '')
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
  const [rejectReason, setRejectReason] = useState('')

  // Approve flow — once approveAccountRequest succeeds the account exists and
  // cannot be re-created; subsequent retries skip step 1 and only re-run the
  // subordinate steps (profile / roles / clinic / email) that failed.
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [approvedUserId, setApprovedUserId] = useState<string | null>(null)
  const [approvedEmail, setApprovedEmail] = useState<string | null>(null)

  // ── Derived ─────────────────────────────────────────────
  const componentRanks = (component ? ranksByComponent[component as Component] : []) ?? []

  const clinicOptions = useMemo(
    () => clinics.map((c) => ({ value: c.id, label: `${c.name} (${c.uics.join(', ')})` })),
    [clinics],
  )

  const formMatchedClinic = uic ? uicToClinic.get(uic.toUpperCase()) : undefined

  // ── Component → rank filtering ──────────────────────────
  const handleComponentChange = useCallback((val: string) => {
    setComponent(val)
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
      setRank('')
    }
  }, [rank])

  // ── Handlers ────────────────────────────────────────────
  const runApproveSteps = useCallback(async () => {
    const chosenRoles = roles
    const priorResults = stepResults
    const next: StepResult[] = [...priorResults]
    const upsert = (r: StepResult) => {
      const idx = next.findIndex(s => s.key === r.key)
      if (idx >= 0) next[idx] = r
      else next.push(r)
    }
    const alreadyOk = (key: string) => priorResults.find(s => s.key === key)?.ok === true

    setProcessing(true)
    setError(null)

    // Step 1: create account — non-idempotent, never retried once successful.
    let userId = approvedUserId
    let approvedEmailLocal = approvedEmail
    if (!alreadyOk('approve')) {
      // Persist any email correction first — approve_account_request bakes the
      // stored account_requests.email into auth.users, so fixing it here (before
      // the account exists) is the earliest, surgery-free catch for typos.
      const trimmedEmail = email.trim().toLowerCase()
      if (trimmedEmail !== (request.email || '').toLowerCase()) {
        const upd = await updateAccountRequestEmail(request.id, trimmedEmail)
        if (!upd.success) {
          setError(upd.error || 'Failed to update email')
          setProcessing(false)
          return
        }
      }
      const r = await approveAccountRequest(request.id)
      if (!r.success) {
        // Approval itself failed — surface as top-level error so the form
        // stays in pre-create state (nothing to retry yet).
        setError(r.error || 'Failed to approve request')
        setProcessing(false)
        return
      }
      userId = r.userId
      approvedEmailLocal = r.email
      setApprovedUserId(userId)
      setApprovedEmail(approvedEmailLocal)
      upsert({ key: 'approve', label: 'Account created', ok: true })
      setStepResults([...next])
    }

    if (!userId) {
      setProcessing(false)
      return
    }

    // Step 2: profile
    if (!alreadyOk('profile')) {
      const r = await updateUserProfile(userId, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        middleInitial,
        credential,
        component,
        rank,
        uic: uic || undefined,
      })
      upsert({
        key: 'profile',
        label: 'Profile fields applied',
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Profile update failed'),
      })
      setStepResults([...next])
    }

    // Step 3: roles
    if (!alreadyOk('roles')) {
      const r = await setUserRoles(userId, chosenRoles as ('medic' | 'supervisor' | 'dev' | 'provider')[])
      upsert({
        key: 'roles',
        label: `Roles set (${chosenRoles.join(', ')})`,
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Role assignment failed'),
      })
      setStepResults([...next])
    }

    // Step 4: clinic (optional — skip step entirely if admin chose none)
    if (selectedClinicId && !alreadyOk('clinic')) {
      const r = await setUserClinic(userId, selectedClinicId)
      upsert({
        key: 'clinic',
        label: 'Cluster assigned',
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Cluster assignment failed'),
      })
      setStepResults([...next])
    }

    // Step 5: approval email
    if (approvedEmailLocal && !alreadyOk('email')) {
      const r = await sendApprovalEmail(approvedEmailLocal)
      upsert({
        key: 'email',
        label: 'Approval email sent',
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Email delivery failed'),
      })
      setStepResults([...next])
    }

    setProcessing(false)

    const allOk = next.every(s => s.ok)
    invalidate('requests', 'users')
    onRefresh()
    if (allOk) {
      onApproved?.(userId, request, {
        roles: chosenRoles,
        clinicId: selectedClinicId,
        warnings: [],
      })
    }
  }, [
    request, email, firstName, lastName, middleInitial, credential, component, rank, uic,
    roles, selectedClinicId, onApproved, onRefresh,
    stepResults, approvedUserId, approvedEmail,
  ])

  const handleApprove = useCallback(() => {
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (uic.trim().length !== 6) {
      setError('UIC must be exactly 6 characters.')
      return
    }
    if (roles.length === 0) {
      setError('Select at least one role.')
      return
    }
    runApproveSteps()
  }, [email, uic, roles, runApproveSteps])

  const handleRetryFailed = useCallback(() => {
    setStepResults(prev => prev.map(s => s.ok ? s : { ...s, error: undefined }))
    runApproveSteps()
  }, [runApproveSteps])

  const handleReject = useCallback(async () => {
    const reason = rejectReason.trim()
    if (!reason) return
    setProcessing(true)
    setError(null)
    const result = await rejectAccountRequest(request.id, reason)
    setProcessing(false)
    if (result.success) {
      setConfirmReject(false)
      setRejectReason('')
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

  // ── Lifted-clone context menu (right-click + long-press) ──
  const longPressTimer = useRef<number | null>(null)
  const preventTap = useRef(false)
  const openMenu = () => {
    if (!hasActions || !cardRef.current) return
    setContextMenu({
      requestId: request.id,
      rect: cardRef.current.getBoundingClientRect(),
      clone: (
        <div className="bg-themewhite">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
              <IconComponent size={16} className={iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">
                {isSupport
                  ? `${request.first_name}${request.last_name ? ` ${request.last_name}` : ''}`
                  : [request.rank, request.first_name, request.middle_initial, request.last_name].filter(Boolean).join(' ')}
              </p>
              <p className="text-[9pt] text-tertiary mt-0.5 truncate">
                {isSupport ? request.email : [request.credential, request.email].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className={`text-[9pt] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${getRequestStatusColor(request.status)}`}>
              {isSupport ? 'Help' : request.status}
            </span>
          </div>
        </div>
      ),
    })
  }
  const clearLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  const handleTap = useCallback(() => {
    if (!hasActions) return
    setAnchorRect(cardRef.current?.getBoundingClientRect() ?? null)
    setExpandedId(isExpanded ? null : request.id)
  }, [hasActions, isExpanded, setExpandedId, request.id])

  const handleClose = useCallback(() => setExpandedId(null), [setExpandedId])

  const mailtoBody = `${(isSupport
    ? [request.first_name, request.last_name]
    : [request.rank, request.last_name]
  ).filter(Boolean).join(' ')},\n\n`
  const mailtoHref = buildMailtoHref({ to: request.email, subject: 'Medical Operations Inquiry', body: mailtoBody })

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

  const overlayTitle = isSupport
    ? 'Support request'
    : isPending
      ? 'Approve request'
      : 'Rejected request'

  const canApprove = isValidEmail(email) && uic.length === 6 && roles.length > 0 && !processing
  // Once the account is created, the form is locked into "post-approve" mode:
  // Reject is gone (account exists), Approve becomes Retry-failed or Done.
  const accountCreated = approvedUserId !== null
  const hasFailedSteps = stepResults.some(s => !s.ok)
  const allStepsOk = stepResults.length > 0 && !hasFailedSteps

  const overlayFooter = (
    <ActionPill>
      <a
        href={mailtoHref}
        onClick={(e) => e.stopPropagation()}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-themeblue2/8 text-primary active:scale-95 transition-all"
        aria-label="Email"
        title="Email"
      >
        <Mail size={16} />
      </a>
      {isSupport && (
        <ActionButton
          icon={Trash2}
          label="Dismiss"
          variant="danger"
          onClick={() => setConfirmDeleteId(request.id)}
        />
      )}
      {isPending && !isSupport && !accountCreated && (
        <>
          <ActionButton
            icon={Trash2}
            label="Reject"
            variant="danger"
            onClick={() => setConfirmReject(true)}
          />
          <ActionButton
            icon={processing ? RefreshCw : Check}
            label="Approve"
            variant={canApprove ? 'success' : 'disabled'}
            onClick={handleApprove}
          />
        </>
      )}
      {isPending && !isSupport && accountCreated && hasFailedSteps && (
        <ActionButton
          icon={RefreshCw}
          label={processing ? 'Retrying…' : 'Retry failed'}
          variant={processing ? 'disabled' : 'success'}
          onClick={handleRetryFailed}
        />
      )}
      {isPending && !isSupport && accountCreated && allStepsOk && (
        <ActionButton
          icon={Check}
          label="Done"
          variant="success"
          onClick={handleClose}
        />
      )}
      {isRejected && !isSupport && (
        <ActionButton
          icon={processing ? RefreshCw : Check}
          label="Reopen"
          variant={processing ? 'disabled' : 'success'}
          onClick={handleReopen}
        />
      )}
    </ActionPill>
  )

  return (
    <>
      <div
        ref={cardRef}
        onContextMenu={hasActions ? (e) => { e.preventDefault(); e.stopPropagation(); openMenu() } : undefined}
        onTouchStart={hasActions ? () => { preventTap.current = false; longPressTimer.current = window.setTimeout(() => { preventTap.current = true; openMenu() }, 500) } : undefined}
        onTouchEnd={hasActions ? clearLongPress : undefined}
        onTouchMove={hasActions ? clearLongPress : undefined}
        onClick={() => { if (preventTap.current) { preventTap.current = false; return } handleTap() }}
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

        {/* Row 2: UIC + clinic */}
        {!isSupport && request.uic && (
          <div className="flex items-center gap-2 flex-wrap px-4 pb-2">
            <span className="text-[10pt] font-normal text-tertiary">{request.uic}</span>
            {cardMatchedClinic ? (
              <span className="inline-flex items-center gap-1 text-[10pt] font-normal text-tertiary">
                <Building2 size={12} />
                {cardMatchedClinic.name}
              </span>
            ) : (
              <span className="text-[10pt] font-normal text-tertiary">No cluster match</span>
            )}
          </div>
        )}

        {/* Notes/justification preview */}
        {!isSupport && request.notes && (
          <p className="text-[10pt] font-normal text-tertiary italic px-4 pb-2 line-clamp-2">{request.notes}</p>
        )}

        {/* Support request: show message preview */}
        {isSupport && request.notes && (
          <p className="text-[10pt] font-normal text-tertiary px-4 pb-2 line-clamp-2">{request.notes}</p>
        )}

        {/* Already a user note */}
        {isExistingUser && (
          <p className="text-[10pt] font-normal text-tertiary px-4 pb-2">Already a user — safe to clear this request</p>
        )}
      </div>

      {/* ── Edit overlay ─────────────────────────────────────── */}
      <PreviewOverlay
        isOpen={isExpanded}
        onClose={handleClose}
        anchorRect={anchorRect}
        title={overlayTitle}
        maxWidth={420}
        previewMaxHeight="65dvh"
        footer={overlayFooter}
      >
        <div className={processing ? 'opacity-50 pointer-events-none' : undefined} onClick={(e) => e.stopPropagation()}>
          {error && <div className="px-4 pt-3"><ErrorDisplay message={error} /></div>}

          {stepResults.length > 0 && (
            <div className="px-4 pt-3">
              <StepResults
                steps={stepResults}
                onRetry={hasFailedSteps ? handleRetryFailed : undefined}
                retrying={processing}
              />
            </div>
          )}

          {/* Support request body */}
          {isSupport && (
            <div className="px-4 py-3 space-y-2">
              {request.notes && (
                <p className="text-[10pt] font-normal text-primary whitespace-pre-wrap">{request.notes}</p>
              )}
              <p className="text-[10pt] font-normal text-tertiary">
                Submitted: {new Date(request.requested_at).toLocaleString()}
              </p>
            </div>
          )}

          {/* Pending request: full edit form */}
          {isPending && !isSupport && (
            <>
              <div className="px-4 py-3 border-b border-primary/6">
                <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-1">Justification</p>
                <p className={`text-sm whitespace-pre-wrap ${request.notes ? 'text-primary' : 'text-tertiary italic'}`}>
                  {request.notes || 'No justification provided'}
                </p>
              </div>
              <TextInput
                value={email}
                onChange={setEmail}
                placeholder="Email *"
                type="email"
                required
                hint={email.length > 0 && !isValidEmail(email) ? 'Enter a valid email address.' : undefined}
              />
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
              <PickerInput value={selectedClinicId} onChange={setSelectedClinicId} options={clinicOptions} placeholder="Cluster" />
              {formMatchedClinic && selectedClinicId !== formMatchedClinic.id && (
                <button
                  type="button"
                  onClick={() => setSelectedClinicId(formMatchedClinic.id)}
                  className="w-full px-4 py-2 text-[9pt] text-themeblue2 flex items-center gap-1 border-b border-primary/6 hover:bg-themeblue2/5 active:bg-themeblue2/10 transition-colors text-left"
                >
                  <Building2 size={12} className="shrink-0" />
                  UIC matches {formMatchedClinic.name} — tap to use
                </button>
              )}
              {formMatchedClinic && selectedClinicId === formMatchedClinic.id && (
                <p className="px-4 py-2 text-[9pt] text-themegreen flex items-center gap-1 border-b border-primary/6">
                  <Building2 size={12} />
                  Matches UIC
                </p>
              )}
              <MultiPickerInput
                value={roles}
                onChange={setRoles}
                options={AVAILABLE_ROLES.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
                placeholder="Roles *"
                required
              />
            </>
          )}

          {/* Rejected request: read-only + reopen */}
          {isRejected && !isSupport && (
            <div className="px-4 py-3 space-y-3">
              <div>
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
            </div>
          )}
        </div>
      </PreviewOverlay>

      <ConfirmDialog
        visible={confirmReject}
        title={`Reject ${request.first_name ?? ''} ${request.last_name ?? 'this request'}?`}
        subtitle="The requester will see this reason."
        confirmLabel="Reject"
        variant="danger"
        processing={processing}
        zIndex={Z.POPOVER + 30}
        inputValue={rejectReason}
        onInputChange={setRejectReason}
        inputPlaceholder="Reason for rejection *"
        onConfirm={handleReject}
        onCancel={() => { setConfirmReject(false); setRejectReason('') }}
      />
    </>
  )
}
