import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { Building2, Trash2, X, Check, Mail } from 'lucide-react'
import { TextInput, PickerInput, MultiPickerInput } from '@/Components/primitives/FormInputs'
import { UicPinInput } from '@/Components/DomainInputs'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { HudLoader } from '@/Components/primitives/HudLoader'
import type { StepResult } from './StepResults'
import { credentials, components, ranksByComponent } from '../../Data/User'
import { rankForComponent } from '../../Utilities/rank'
import { ASSIGNABLE_ROLES, roleOptions } from '../../Utilities/roles'
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
  deleteAccountRequest,
  listClinics,
  listAllUsers,
  isValidEmail,
} from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { buildMailtoHref } from '../../lib/mailto'
import { invalidate, useInvalidation } from '../../stores/useInvalidationStore'


export interface RequestDetailProps {
  request: AccountRequest
  /** Fired after a full-success approval — parent opens the new user. */
  onApproved?: (userId: string, request: AccountRequest, configured: { roles: string[]; clinicId: string | null; warnings: string[] }) => void
  /** Return to the list / close the detail pane (reject, reopen, delete, dismiss). */
  onClose: () => void
  /** Publish this detail's header actions (primary commit + ellipsis extras) so the
   *  drawer renders them in the pane / sheet header. Cleared on unmount. */
  onHeaderActions?: (node: ReactNode | null) => void
}

/**
 * Request detail — the approve / reject / reopen / support flow, rendered inside
 * the admin drawer's detail pane (desktop) or Sheet (mobile) instead of an
 * anchored PreviewOverlay. Self-contained: owns its form + step state, its
 * reject / delete confirmations, and publishes its header actions upward.
 */
export function RequestDetail({ request, onApproved, onClose, onHeaderActions }: RequestDetailProps) {
  const isSupport = request.request_type === 'support'
  const isPending = request.status === 'pending'
  const isRejected = request.status === 'rejected'

  // ── Reference data (cheap — cached behind the invalidation gen) ─────────
  const gen = useInvalidation('clinics', 'users')
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [userEmails, setUserEmails] = useState<Set<string>>(new Set())
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [clinicData, userData] = await Promise.all([listClinics(), listAllUsers()])
      if (cancelled) return
      setClinics(clinicData)
      setUserEmails(new Set(userData.map(u => u.email?.toLowerCase()).filter(Boolean) as string[]))
    })()
    return () => { cancelled = true }
  }, [gen])

  // ── Form state (pending edit form) ──────────────────────
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
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Approve flow — once approveAccountRequest succeeds the account exists and
  // cannot be re-created; retries skip step 1 and only re-run the failures.
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [approvedUserId, setApprovedUserId] = useState<string | null>(null)
  const [approvedEmail, setApprovedEmail] = useState<string | null>(null)

  // ── Derived ─────────────────────────────────────────────
  const componentRanks = (component ? ranksByComponent[component as Component] : []) ?? []

  const uicToClinic = useMemo(() => {
    const map = new Map<string, AdminClinic>()
    for (const clinic of clinics) {
      for (const u of clinic.uics) map.set(u.toUpperCase(), clinic)
    }
    return map
  }, [clinics])

  const clinicOptions = useMemo(
    () => clinics.map((c) => ({ value: c.id, label: `${c.name} (${c.uics.join(', ')})` })),
    [clinics],
  )

  const formMatchedClinic = uic ? uicToClinic.get(uic.toUpperCase()) : undefined
  const isExistingUser = isRejected && userEmails.has(request.email.toLowerCase())

  const handleComponentChange = useCallback((val: string) => {
    setComponent(val)
    setRank(prev => rankForComponent(ranksByComponent[val as Component], prev))
  }, [rank])

  // ── Approve ─────────────────────────────────────────────
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

    // Step 4: clinic (optional)
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

    const failed = next.filter(s => !s.ok)
    invalidate('requests', 'users')
    if (failed.length === 0) {
      // Full success — parent morphs the surface into the created user; no
      // checklist. The account already exists, so a re-tap of Approve skips the
      // done steps (alreadyOk) and only re-runs whatever failed.
      onApproved?.(userId, request, { roles: chosenRoles, clinicId: selectedClinicId, warnings: [] })
    } else {
      setError(`Couldn't finish: ${failed.map(s => s.label).join(', ')}. Tap Approve to retry the remaining steps.`)
    }
  }, [
    request, email, firstName, lastName, middleInitial, credential, component, rank, uic,
    roles, selectedClinicId, onApproved, stepResults, approvedUserId, approvedEmail,
  ])

  const handleApprove = useCallback(() => {
    if (processing) return
    if (!isValidEmail(email)) { setError('Enter a valid email address.'); return }
    if (uic.trim().length !== 6) { setError('UIC must be exactly 6 characters.'); return }
    if (roles.length === 0) { setError('Select at least one role.'); return }
    runApproveSteps()
  }, [processing, email, uic, roles, runApproveSteps])

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
      invalidate('requests')
      onClose()
    } else {
      setError(result.error || 'Failed to reject request')
    }
  }, [request.id, rejectReason, onClose])

  const handleReopen = useCallback(async () => {
    setProcessing(true)
    setError(null)
    const result = await reopenAccountRequest(request.id)
    setProcessing(false)
    if (result.success) {
      invalidate('requests')
      onClose()
    } else {
      setError(result.error || 'Failed to reopen request')
    }
  }, [request.id, onClose])

  const handleDelete = useCallback(async () => {
    setProcessing(true)
    const result = await deleteAccountRequest(request.id)
    setProcessing(false)
    if (result.success) {
      setConfirmDelete(false)
      invalidate('requests')
      onClose()
    } else {
      setError(`Failed to delete: ${result.error}`)
    }
  }, [request.id, onClose])

  const mailtoBody = `${(isSupport
    ? [request.first_name, request.last_name]
    : [request.rank, request.last_name]
  ).filter(Boolean).join(' ')},\n\n`
  const mailtoHref = buildMailtoHref({ to: request.email, subject: '[inquiry] -  Medical Operations Web Application', body: mailtoBody })

  // ── Header actions — primary commit + ellipsis extras. Handlers go through
  //    refs so typing in the form doesn't churn the published node. ────────
  const handleApproveRef = useRef(handleApprove)
  handleApproveRef.current = handleApprove
  const handleReopenRef = useRef(handleReopen)
  handleReopenRef.current = handleReopen

  const headerActions = useMemo(() => {
    const extras: ContextMenuItem[] = []
    if (request.email) {
      extras.push({ key: 'email', label: 'Email', icon: Mail, href: mailtoHref })
    }
    if (isSupport) {
      extras.push({ key: 'dismiss', label: 'Dismiss', icon: Trash2, destructive: true, onAction: () => setConfirmDelete(true) })
    } else if (isPending) {
      extras.push({ key: 'reject', label: 'Reject', icon: X, destructive: true, onAction: () => setConfirmReject(true) })
    } else if (isRejected) {
      extras.push({ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDelete(true) })
    }

    const primary = isPending && !isSupport
      ? <PillButton icon={Check} accent="success" label="Approve" onClick={() => handleApproveRef.current()} />
      : isRejected && !isSupport
        ? <PillButton icon={Check} accent="success" label="Reopen" onClick={() => handleReopenRef.current()} />
        : null

    return (
      <HeaderPill multi={!!primary}>
        {primary}
        <OverlayHeaderMenu items={extras} />
      </HeaderPill>
    )
  }, [request.email, mailtoHref, isSupport, isPending, isRejected])

  useEffect(() => {
    onHeaderActions?.(headerActions)
    return () => onHeaderActions?.(null)
  }, [headerActions, onHeaderActions])

  // ── Render ──────────────────────────────────────────────
  return (
    <>
    {/* While a commit is in flight the body IS the HUD (no step checklist — that
        pattern lives nowhere else in the app). On full-success approve the parent
        morphs the surface into the created user; any partial failure clears the
        HUD and surfaces inline (error above), with Approve as the retry. */}
    {processing ? (
      <div className="flex items-center justify-center py-16">
        <HudLoader size={120} />
      </div>
    ) : (
    <div>
      {error && <div className="pb-3"><ErrorDisplay message={error} /></div>}

      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
              options={roleOptions(ASSIGNABLE_ROLES)}
              placeholder="Roles *"
              required
            />
          </>
        )}

        {/* Rejected request: read-only + reopen (via header) */}
        {isRejected && !isSupport && (
          <div className="px-4 py-3 space-y-3">
            <div>
              <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-1">Justification</p>
              <p className={`text-sm whitespace-pre-wrap ${request.notes ? 'text-primary' : 'text-tertiary italic'}`}>
                {request.notes || 'No justification provided'}
              </p>
            </div>
            {isExistingUser && (
              <p className="text-[10pt] text-tertiary">Already a user — safe to clear this request.</p>
            )}
            {request.rejection_reason && (
              <div className="rounded-xl border border-themeredred/10 bg-themeredred/5 px-3.5 py-2.5">
                <p className="text-[9pt] font-semibold text-themeredred/60 tracking-widest uppercase mb-1">Rejection Reason</p>
                <p className="text-sm text-themeredred">{request.rejection_reason}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    )}

      <ConfirmDialog
        visible={confirmReject}
        title={`Reject ${request.first_name ?? ''} ${request.last_name ?? 'this request'}?`}
        subtitle="The requester will see this reason."
        confirmLabel="Reject"
        variant="danger"
        processing={processing}
        inputValue={rejectReason}
        onInputChange={setRejectReason}
        inputPlaceholder="Reason for rejection *"
        onConfirm={handleReject}
        onCancel={() => { setConfirmReject(false); setRejectReason('') }}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title={isSupport ? 'Dismiss this request?' : 'Permanently delete this request?'}
        subtitle="Permanent."
        confirmLabel={isSupport ? 'Dismiss' : 'Delete'}
        variant="danger"
        processing={processing}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
