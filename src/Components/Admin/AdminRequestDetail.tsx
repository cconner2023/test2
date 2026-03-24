/**
 * AdminRequestDetail — editable detail view for an account request.
 *
 * Pending requests render a full editable form so the admin can
 * review/modify profile data, assign roles and clinic, then approve
 * or reject in one pass.  Rejected requests show a read-only summary
 * with a reopen action.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Building2 } from 'lucide-react'
import { TextInput, PickerInput, UicPinInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { credentials, components, ranksByComponent } from '../../Data/User'
import type { Component } from '../../Data/User'
import {
  approveAccountRequest,
  rejectAccountRequest,
  reopenAccountRequest,
  updateUserProfile,
  addUserRole,
  setUserClinic,
  listClinics,
} from '../../lib/adminService'
import type { AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'

// ─── Constants ───────────────────────────────────────────────────────

const AVAILABLE_ROLES = ['medic', 'supervisor', 'dev', 'provider'] as const
type Role = (typeof AVAILABLE_ROLES)[number]

// ─── Props ───────────────────────────────────────────────────────────

interface AdminRequestDetailProps {
  request: AccountRequest
  /** Called after successful approval — passes the new user ID */
  onApproved: (userId: string) => void
  /** Called after successful rejection — navigates back to list */
  onRejected: () => void
  /** Called after reopening a rejected request — navigates back to list */
  onReopened: () => void
}

// ─── Component ───────────────────────────────────────────────────────

export function AdminRequestDetail({
  request,
  onApproved,
  onRejected,
  onReopened,
}: AdminRequestDetailProps) {
  const isPending = request.status === 'pending'
  const isRejected = request.status === 'rejected'

  // ── Editable fields (pre-filled from request) ─────────────────────
  const [firstName, setFirstName] = useState(request.first_name || '')
  const [lastName, setLastName] = useState(request.last_name || '')
  const [middleInitial, setMiddleInitial] = useState(request.middle_initial || '')
  const [credential, setCredential] = useState(request.credential || '')
  const [component, setComponent] = useState(request.component || '')
  const [rank, setRank] = useState(request.rank || '')
  const [uic, setUic] = useState(request.uic || '')

  // ── Account setup fields ──────────────────────────────────────────
  const [roles, setRoles] = useState<Record<Role, boolean>>({
    medic: true,
    supervisor: false,
    dev: false,
    provider: false,
  })
  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [noteIncludeHPI, setNoteIncludeHPI] = useState(true)
  const [noteIncludePE, setNoteIncludePE] = useState(false)
  const [peDepth, setPeDepth] = useState('standard')

  // ── Data ──────────────────────────────────────────────────────────
  const [clinics, setClinics] = useState<AdminClinic[]>([])

  // ── UI state ──────────────────────────────────────────────────────
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // ── Derived ───────────────────────────────────────────────────────
  const componentRanks = component ? ranksByComponent[component as Component] : []

  // ── Load clinics ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    listClinics().then((data) => {
      if (!cancelled) setClinics(data)
    })
    return () => { cancelled = true }
  }, [])

  // ── UIC → clinic lookup ───────────────────────────────────────────
  const uicToClinic = useMemo(() => {
    const map = new Map<string, AdminClinic>()
    for (const clinic of clinics) {
      for (const u of clinic.uics) {
        map.set(u.toUpperCase(), clinic)
      }
    }
    return map
  }, [clinics])

  // Auto-set clinic when UIC changes or clinics load
  useEffect(() => {
    if (!uic || selectedClinicId) return
    const matched = uicToClinic.get(uic.toUpperCase())
    if (matched) setSelectedClinicId(matched.id)
  }, [uic, uicToClinic, selectedClinicId])

  const clinicOptions = useMemo(
    () => clinics.map((c) => ({ value: c.id, label: `${c.name} (${c.uics.join(', ')})` })),
    [clinics],
  )

  const matchedClinic = uic ? uicToClinic.get(uic.toUpperCase()) : undefined

  // ── Handlers ──────────────────────────────────────────────────────

  const handleComponentChange = useCallback(
    (val: string) => {
      setComponent(val)
      if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
        setRank('')
      }
    },
    [rank],
  )

  const handleApprove = useCallback(async () => {
    const chosenRoles = AVAILABLE_ROLES.filter((r) => roles[r])
    if (chosenRoles.length === 0) {
      setError('At least one role must be selected')
      return
    }

    setProcessing(true)
    setError(null)

    // 1. Approve — creates auth user + base profile via RPC
    const approveResult = await approveAccountRequest(request.id)
    if (!approveResult.success || !approveResult.data?.userId) {
      setError(approveResult.error || 'Failed to approve request')
      setProcessing(false)
      return
    }

    const userId = approveResult.data.userId

    // 2. Update profile with edited fields
    await updateUserProfile(userId, {
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

    // 3. Set roles
    for (const role of chosenRoles) {
      if (role !== 'medic') {
        await addUserRole(userId, role)
      }
    }

    // 4. Set clinic
    if (selectedClinicId) {
      await setUserClinic(userId, selectedClinicId)
    }

    setProcessing(false)
    onApproved(userId)
  }, [
    request.id,
    firstName, lastName, middleInitial, credential, component, rank, uic,
    roles, selectedClinicId, noteIncludeHPI, noteIncludePE, peDepth,
    onApproved,
  ])

  const handleReject = useCallback(async () => {
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason')
      return
    }
    setProcessing(true)
    setError(null)
    const result = await rejectAccountRequest(request.id, rejectReason.trim())
    setProcessing(false)
    if (result.success) {
      onRejected()
    } else {
      setError(result.error || 'Failed to reject request')
    }
  }, [request.id, rejectReason, onRejected])

  const handleReopen = useCallback(async () => {
    setProcessing(true)
    setError(null)
    const result = await reopenAccountRequest(request.id)
    setProcessing(false)
    if (result.success) {
      onReopened()
    } else {
      setError(result.error || 'Failed to reopen request')
    }
  }, [request.id, onReopened])

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className={processing ? 'opacity-50 pointer-events-none' : undefined}>
      {error && <div className="mb-4"><ErrorDisplay message={error} /></div>}

      {/* Request metadata */}
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-3.5 mb-4">
        <p className="text-sm text-tertiary/60">{request.email}</p>
        <p className="text-[11px] text-tertiary/40 mt-1">
          Submitted {new Date(request.requested_at).toLocaleString()}
        </p>
        {request.notes && (
          <p className="text-[11px] text-tertiary/50 mt-2 italic">{request.notes}</p>
        )}
        {isRejected && request.rejection_reason && (
          <p className="text-xs text-themeredred mt-2">
            Rejected: {request.rejection_reason}
          </p>
        )}
      </div>

      {/* ── Pending: full editable form ────────────────────────────── */}
      {isPending && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="First Name" value={firstName} onChange={setFirstName} required />
              <TextInput label="Last Name" value={lastName} onChange={setLastName} required />
            </div>
            <TextInput
              label="Middle Initial"
              value={middleInitial}
              onChange={(v) => setMiddleInitial(v.toUpperCase().slice(0, 1))}
              maxLength={1}
            />
            <div className="grid grid-cols-2 gap-3">
              <PickerInput label="Credential" value={credential} onChange={setCredential} options={credentials} inline />
              <PickerInput label="Component" value={component} onChange={handleComponentChange} options={components} inline />
            </div>
            {component && (
              <PickerInput label="Rank" value={rank} onChange={setRank} options={componentRanks} inline />
            )}
            <UicPinInput label="UIC" value={uic} onChange={setUic} spread />

            <PickerInput
              label="Clinic"
              value={selectedClinicId}
              onChange={setSelectedClinicId}
              options={clinicOptions}
              placeholder="No clinic assigned"
              inline
            />
            {matchedClinic && selectedClinicId === matchedClinic.id && (
              <p className="-mt-2 text-[11px] text-themegreen flex items-center gap-1">
                <Building2 size={12} />
                Auto-matched from UIC
              </p>
            )}
          </div>

          {/* Roles */}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-3.5">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Roles</span>
            <div className="flex gap-3 mt-2 flex-wrap">
              {AVAILABLE_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roles[role]}
                    onChange={() => setRoles((prev) => ({ ...prev, [role]: !prev[role] }))}
                    className="w-4 h-4 rounded border-tertiary/30"
                  />
                  <span className="text-sm text-primary capitalize">{role}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Note defaults */}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-3.5 space-y-2">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Note Defaults</span>
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-sm text-primary">Include HPI</span>
              <input
                type="checkbox"
                checked={noteIncludeHPI}
                onChange={() => setNoteIncludeHPI(!noteIncludeHPI)}
                className="w-4 h-4 rounded border-tertiary/30"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-sm text-primary">Include PE</span>
              <input
                type="checkbox"
                checked={noteIncludePE}
                onChange={() => setNoteIncludePE(!noteIncludePE)}
                className="w-4 h-4 rounded border-tertiary/30"
              />
            </label>
            <PickerInput
              label="PE Depth"
              value={peDepth}
              onChange={setPeDepth}
              options={['focused', 'standard', 'comprehensive']}
              inline
            />
          </div>

          {/* Action buttons */}
          {rejectMode ? (
            <div className="space-y-2">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason..."
                className="w-full px-3 py-2.5 rounded-lg bg-themewhite2 border border-tertiary/10 text-sm text-primary placeholder:text-tertiary/40 focus:outline-none focus:border-themeblue2"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectReason.trim()}
                  className="flex-1 px-4 py-3 rounded-lg bg-themeredred text-white font-medium text-sm disabled:opacity-50 active:scale-95 transition-all"
                >
                  {processing ? 'Rejecting...' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => { setRejectMode(false); setRejectReason('') }}
                  className="px-4 py-3 rounded-lg bg-tertiary/10 text-tertiary font-medium text-sm active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 px-4 py-3 rounded-lg bg-themegreen text-white font-medium transition-colors disabled:opacity-50 active:scale-95"
              >
                {processing ? 'Creating Account...' : 'Approve'}
              </button>
              <button
                onClick={() => setRejectMode(true)}
                disabled={processing}
                className="px-4 py-3 rounded-lg bg-themeredred/10 text-themeredred font-medium text-sm disabled:opacity-50 active:scale-95 transition-all"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Rejected: read-only summary + reopen ───────────────────── */}
      {isRejected && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-3.5 space-y-2">
            <p className="text-sm font-medium text-primary">
              {request.rank ? `${request.rank} ` : ''}
              {request.first_name}
              {request.middle_initial ? ` ${request.middle_initial}` : ''}{' '}
              {request.last_name}
            </p>
            {request.credential && (
              <p className="text-xs text-tertiary/60">
                Credential: <span className="text-primary">{request.credential}</span>
              </p>
            )}
            {request.component && (
              <p className="text-xs text-tertiary/60">
                Component: <span className="text-primary">{request.component}</span>
              </p>
            )}
            {request.uic && (
              <p className="text-xs text-tertiary/60">
                UIC: <span className="text-primary">{request.uic}</span>
              </p>
            )}
          </div>

          <button
            onClick={handleReopen}
            disabled={processing}
            className="w-full px-4 py-3 rounded-lg bg-themeblue3 text-white font-medium text-sm disabled:opacity-50 active:scale-95 transition-all"
          >
            {processing ? 'Reopening...' : 'Return to Pending'}
          </button>
        </div>
      )}
    </div>
  )
}
