import { useEffect, useState, useCallback, useRef } from 'react'
import { Building2, Check, Pencil, Trash2, Loader2, Camera, Send, ArrowRightLeft, KeyRound, AlertCircle, Home } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorPill } from '../ErrorPill'
import { PickerInput } from '../FormInputs'
import { ResetPasswordForm } from '../Admin/ResetPasswordForm'
import {
  getMemberProfile,
  updateMemberProfile,
  setMemberRoles,
  removeSoldierFromClinic,
  loanSoldierToClinic,
  loanSoldierToAssociatedClinic,
  transferSoldierToClinic,
  setSoldierHomeClinic,
  endLoanFromClinic,
  supervisorResetUserPassword,
  type MemberProfileData,
} from '../../lib/supervisorService'
import { getAssociatedClinicCode } from '../../lib/clinicAssociationService'
import { supabase } from '../../lib/supabase'
import { useResetPasswordFlow } from '../../Hooks/useResetPasswordFlow'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { invalidate } from '../../stores/useInvalidationStore'
import { useAuthStore } from '../../stores/useAuthStore'

type Role = 'medic' | 'supervisor' | 'provider'

interface MemberEditPopoverProps {
  isOpen: boolean
  anchorRect: DOMRect | null
  memberId: string | null
  clinicId: string | null
  /** Used if the live profile fetch fails — typically built from the roster row */
  fallbackProfile?: MemberProfileData
  /**
   * Loan state from the viewer's perspective. Determines remove semantics and
   * whether loan/transfer actions are shown. Omit (or 'home') for non-loan-aware
   * callers (e.g. admin views) — they get the plain remove path.
   */
  loanState?: 'loaned-in' | 'loaned-out' | 'home'
  /**
   * The soldier's current active loans. Pre-populates the unified Loans
   * overlay's selection state and the cap-of-4 counter. Fetched in-component
   * when omitted.
   */
  loans?: { clinicId: string; clinicName: string }[]
  /**
   * Optional list of clinics the caller is already associated with. When
   * provided, the loan/transfer overlay shows them as tappable quick-picks
   * above the code input so the supervisor doesn't have to copy a code.
   */
  associatedClinics?: { clinicId: string; clinicName: string; uics: string[]; location: string | null }[]
  onClose: () => void
  /** Called after rank/roles save succeeds OR after delete/loan/transfer succeeds */
  onChanged: () => void
}

export function MemberEditPopover({
  isOpen,
  anchorRect,
  memberId,
  clinicId,
  fallbackProfile,
  loanState = 'home',
  loans,
  associatedClinics,
  onClose,
  onChanged,
}: MemberEditPopoverProps) {
  // If the caller doesn't pass `loans`, fetch them when the popover opens so
  // the recall sub-overlay and cap-of-4 logic always reflect server state.
  const [fetchedLoans, setFetchedLoans] = useState<{ clinicId: string; clinicName: string }[]>([])
  useEffect(() => {
    if (loans || !isOpen || !memberId) return
    let cancelled = false
    supabase
      .from('profile_clinic_loans')
      .select('clinic_id, clinic:clinics(name)')
      .eq('user_id', memberId)
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data ?? []) as Array<{ clinic_id: string; clinic: { name: string } | null }>
        setFetchedLoans(rows
          .filter((r) => !!r.clinic)
          .map((r) => ({ clinicId: r.clinic_id, clinicName: r.clinic!.name })))
      })
    return () => { cancelled = true }
  }, [loans, isOpen, memberId])
  const activeLoans = loans ?? fetchedLoans
  const [profile, setProfile] = useState<MemberProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rank, setRank] = useState('')
  const [roles, setRoles] = useState<Role[]>(['medic'])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ranksByComponent, setRanksByComponent] = useState<Record<string, string[]> | null>(null)

  // Lazy-load rank tables on first open
  useEffect(() => {
    if (isOpen && !ranksByComponent) {
      import('../../Data/User').then((mod) => setRanksByComponent(mod.ranksByComponent))
    }
  }, [isOpen, ranksByComponent])

  // Fetch profile when popover opens
  useEffect(() => {
    if (!isOpen || !memberId) return
    setLoading(true)
    setEditMode(false)
    setError(null)
    getMemberProfile(memberId).then((result) => {
      const next: MemberProfileData = result.success
        ? {
            firstName: result.firstName,
            lastName: result.lastName,
            middleInitial: result.middleInitial,
            credential: result.credential,
            component: result.component,
            rank: result.rank,
            uic: result.uic,
            roles: result.roles,
            // Backstop with the cached medic row — the RPC only returns home
            // fields if the home-clinic migration is applied, and even when it
            // is, loaned-in supervisors hit the RPC's clinic-mismatch path.
            homeClinicId: result.homeClinicId ?? fallbackProfile?.homeClinicId ?? null,
            homeClinicName: result.homeClinicName ?? fallbackProfile?.homeClinicName ?? null,
          }
        : (fallbackProfile ?? {
            firstName: null,
            lastName: null,
            middleInitial: null,
            credential: null,
            component: null,
            rank: null,
            uic: null,
            roles: ['medic'],
            homeClinicId: null,
            homeClinicName: null,
          })
      setProfile(next)
      setRank(next.rank ?? '')
      setRoles((next.roles ?? ['medic']) as Role[])
      setLoading(false)
    })
  }, [isOpen, memberId, fallbackProfile])

  const handleClose = useCallback(() => {
    setEditMode(false)
    setSaving(false)
    setError(null)
    onClose()
  }, [onClose])

  const handleSave = useCallback(async () => {
    if (!memberId || !profile) return
    setSaving(true)
    setError(null)

    const rankChanged = (rank || null) !== (profile.rank ?? null)
    const origRoles = (profile.roles ?? ['medic']).slice().sort().join(',')
    const currRoles = roles.slice().sort().join(',')
    const rolesChanged = origRoles !== currRoles

    if (rankChanged) {
      const r = await updateMemberProfile(memberId, { rank: rank || undefined })
      if (!r.success) {
        setSaving(false)
        setError(r.error)
        return
      }
    }
    if (rolesChanged) {
      const r = await setMemberRoles(memberId, roles)
      if (!r.success) {
        setSaving(false)
        setError(r.error)
        return
      }
    }

    invalidate('users', 'clinics')
    setSaving(false)
    onChanged()
    handleClose()
  }, [memberId, profile, rank, roles, onChanged, handleClose])

  const handleConfirmDelete = useCallback(async () => {
    if (!memberId) return
    setSaving(true)
    setError(null)
    // Loaned-in: the danger action ends the loan FROM this clinic explicitly,
    // rather than relying on server context resolution.
    const r = loanState === 'loaned-in' && clinicId
      ? await endLoanFromClinic(memberId, clinicId)
      : await removeSoldierFromClinic(memberId)
    setSaving(false)
    setConfirmDelete(false)
    if (!r.success) {
      setError(r.error)
      return
    }
    invalidate('users', 'clinics')
    onChanged()
    handleClose()
  }, [memberId, clinicId, loanState, onChanged, handleClose])

  // ─── Loans (unified multi-select) ─────────────────────────────────────
  // Single overlay replaces the prior Loan + Recall paths. Rows = union of
  // associated clinics and the soldier's current loans, plus an "Add by code"
  // row for ad-hoc loans. Save commits the diff one-by-one with per-row
  // progress (partial success OK). Cap-of-4 evaluated on the post-save state.
  const [loansMode, setLoansMode] = useState(false)
  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<string>>(new Set())
  const [rowState, setRowState] = useState<Map<string, 'idle' | 'busy' | 'done' | 'error'>>(new Map())
  const [rowError, setRowError] = useState<Map<string, string>>(new Map())
  const [loansApplying, setLoansApplying] = useState(false)
  const [pendingCode, setPendingCode] = useState('')
  // Promote-to-home: target clinic id pending confirmation; only the home-clinic
  // supervisor (loanState === 'home') ever sees the inline action.
  const [promoteTarget, setPromoteTarget] = useState<{ clinicId: string; clinicName: string } | null>(null)
  const [promoting, setPromoting] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)

  // Reset the multi-select state every time the overlay opens.
  useEffect(() => {
    if (!loansMode) return
    setSelectedLoanIds(new Set(activeLoans.map((l) => l.clinicId)))
    setRowState(new Map())
    setRowError(new Map())
    setPendingCode('')
  }, [loansMode, activeLoans])

  const toggleLoanSelection = useCallback((cId: string) => {
    if (loansApplying) return
    setSelectedLoanIds((prev) => {
      const next = new Set(prev)
      if (next.has(cId)) next.delete(cId)
      else next.add(cId)
      return next
    })
  }, [loansApplying])

  // The row list = associated ∪ current loans, deduplicated by clinicId.
  // Each row carries the clinic name and a flag indicating whether the row
  // is toggleable by *this* supervisor (loaned-in supervisors can only flip
  // their own clinic; everything else is read-only for them). The soldier's
  // home clinic never appears in this list — it renders as a separate static
  // row at the top of the overlay.
  const homeClinicId = profile?.homeClinicId ?? null
  const homeClinicName = profile?.homeClinicName ?? null
  const loanRows = (() => {
    const map = new Map<string, { clinicId: string; clinicName: string; subtitle?: string }>()
    for (const c of activeLoans) {
      if (c.clinicId === homeClinicId) continue
      map.set(c.clinicId, { clinicId: c.clinicId, clinicName: c.clinicName })
    }
    for (const c of associatedClinics ?? []) {
      if (c.clinicId === homeClinicId) continue
      if (!map.has(c.clinicId)) {
        const subtitle = [c.uics.join(', '), c.location].filter(Boolean).join(' · ')
        map.set(c.clinicId, { clinicId: c.clinicId, clinicName: c.clinicName, subtitle: subtitle || undefined })
      }
    }
    return Array.from(map.values())
  })()

  const isLoanedInView = loanState === 'loaned-in'
  const canToggleRow = useCallback((cId: string) => {
    if (loansApplying) return false
    if (isLoanedInView) return cId === clinicId
    return true
  }, [loansApplying, isLoanedInView, clinicId])

  const postSaveCount = selectedLoanIds.size + (pendingCode ? 1 : 0)
  const overCap = postSaveCount > 4

  const applyLoanChanges = useCallback(async () => {
    if (!memberId || loansApplying) return
    if (overCap) return
    setLoansApplying(true)

    const original = new Set(activeLoans.map((l) => l.clinicId))
    const additions = Array.from(selectedLoanIds).filter((id) => !original.has(id))
    const removals = Array.from(original).filter((id) => !selectedLoanIds.has(id))

    const markRow = (cId: string, state: 'idle' | 'busy' | 'done' | 'error', err?: string) => {
      setRowState((prev) => new Map(prev).set(cId, state))
      if (err) setRowError((prev) => new Map(prev).set(cId, err))
    }

    // Removals first — frees cap headroom in case additions would have tipped over.
    for (const cId of removals) {
      markRow(cId, 'busy')
      const r = await endLoanFromClinic(memberId, cId)
      markRow(cId, r.success ? 'done' : 'error', r.success ? undefined : r.error)
    }
    // Additions: associated clinics get the direct-id RPC (no code dance).
    for (const cId of additions) {
      markRow(cId, 'busy')
      const r = await loanSoldierToAssociatedClinic(memberId, cId)
      markRow(cId, r.success ? 'done' : 'error', r.success ? undefined : r.error)
    }
    // Ad-hoc code add — clinicId unknown until the server resolves it; track
    // under the synthetic '__pending__' row id.
    if (pendingCode) {
      markRow('__pending__', 'busy')
      const r = await loanSoldierToClinic(memberId, pendingCode)
      markRow('__pending__', r.success ? 'done' : 'error', r.success ? undefined : r.error)
      if (r.success) setPendingCode('')
    }

    invalidate('users', 'clinics')
    onChanged()
    // Refresh the in-component loan cache so the overlay reflects committed state.
    const { data } = await supabase
      .from('profile_clinic_loans')
      .select('clinic_id, clinic:clinics(name)')
      .eq('user_id', memberId)
    const rows = (data ?? []) as Array<{ clinic_id: string; clinic: { name: string } | null }>
    const refreshed = rows
      .filter((r) => !!r.clinic)
      .map((r) => ({ clinicId: r.clinic_id, clinicName: r.clinic!.name }))
    setFetchedLoans(refreshed)
    setSelectedLoanIds(new Set(refreshed.map((l) => l.clinicId)))
    setLoansApplying(false)
  }, [memberId, loansApplying, overCap, activeLoans, selectedLoanIds, pendingCode, onChanged])

  // ─── Promote loan → home cluster ─────────────────────────────────────
  // Supervisor is a global user quality, not per-clinic, and auth_clinic_ids()
  // returns home + every loan clinic — so a loaned supervisor may legitimately
  // be authorized over the soldier's home cluster from any viewing context.
  // Gate the action on the global supervisor flag and let the server enforce
  // actual home-clinic authority via supervisor_set_home_clinic.
  const isSupervisorRole = useAuthStore((s) => s.isSupervisorRole)
  const canPromoteHome = isSupervisorRole && !!homeClinicId
  const confirmPromote = useCallback(async () => {
    if (!memberId || !promoteTarget || promoting) return
    setPromoting(true)
    setPromoteError(null)
    const r = await setSoldierHomeClinic(memberId, promoteTarget.clinicId)
    setPromoting(false)
    if (!r.success) {
      setPromoteError(r.error)
      return
    }
    invalidate('users', 'clinics')
    setPromoteTarget(null)
    onChanged()
    handleClose()
  }, [memberId, promoteTarget, promoting, onChanged, handleClose])

  // ─── Reset Password ──────────────────────────────────────────────────
  const [resetMode, setResetMode] = useState(false)
  const resetPw = useResetPasswordFlow(supervisorResetUserPassword)
  const [resetError, setResetError] = useState<string | null>(null)

  const closeReset = useCallback(() => {
    setResetMode(false)
    setResetError(null)
    resetPw.reset()
    resetPw.cancelConfirm()
  }, [resetPw])

  const handleResetSubmit = useCallback(async () => {
    if (!resetPw.confirmingUserId) return
    const r = await resetPw.submit()
    if (!r.success) {
      setResetError(r.error)
      return
    }
    closeReset()
  }, [resetPw, closeReset])

  // ─── Loan / Transfer ─────────────────────────────────────────────────
  const [moveMode, setMoveMode] = useState<'loan' | 'transfer' | null>(null)
  const [moveCode, setMoveCode] = useState('')
  const [moveSaving, setMoveSaving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const {
    isScanning,
    error: scanError,
    result: scanResult,
    startScanning,
    stopScanning,
    clearResult,
  } = useBarcodeScanner()

  const closeMove = useCallback(() => {
    if (scanning) {
      stopScanning()
      setScanning(false)
    }
    setMoveMode(null)
    setMoveCode('')
    setMoveError(null)
    setMoveSaving(false)
  }, [scanning, stopScanning])

  const [pickingClinicId, setPickingClinicId] = useState<string | null>(null)

  const submitMove = useCallback(async (code: string) => {
    if (!memberId || !moveMode || !code) return
    setMoveSaving(true)
    setMoveError(null)
    const fn = moveMode === 'loan' ? loanSoldierToClinic : transferSoldierToClinic
    const r = await fn(memberId, code)
    setMoveSaving(false)
    if (!r.success) {
      setMoveError(r.error ?? 'Failed to update soldier')
      return
    }
    invalidate('users', 'clinics')
    onChanged()
    closeMove()
    handleClose()
  }, [memberId, moveMode, onChanged, closeMove, handleClose])

  const pickAssociatedClinic = useCallback(async (targetClinicId: string) => {
    if (!moveMode || pickingClinicId) return
    setPickingClinicId(targetClinicId)
    setMoveError(null)
    const r = await getAssociatedClinicCode(targetClinicId)
    if (!r.success || !r.code) {
      setPickingClinicId(null)
      setMoveError(r.success ? 'No active code for that cluster — ask their supervisor to refresh it.' : r.error)
      return
    }
    await submitMove(r.code)
    setPickingClinicId(null)
  }, [moveMode, pickingClinicId, submitMove])

  const handleToggleScan = useCallback(() => {
    if (scanning) {
      setScanning(false)
      stopScanning()
    } else {
      setScanning(true)
      requestAnimationFrame(() => {
        if (videoRef.current) startScanning(videoRef.current)
      })
    }
  }, [scanning, startScanning, stopScanning])

  useEffect(() => {
    if (!scanResult) return
    setScanning(false)
    stopScanning()
    submitMove(scanResult).finally(() => clearResult())
  }, [scanResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const removeLabel = loanState === 'loaned-in' ? 'End loan' : 'Remove'
  const removeSubtitle =
    loanState === 'loaned-in'
      ? 'Sends this soldier back to their home cluster.'
      : loanState === 'loaned-out'
        ? 'Recalls the loan and removes this soldier from the cluster.'
        : 'They will no longer be associated with this cluster.'

  const title = (() => {
    if (!profile) return ''
    const last = profile.lastName ?? ''
    const first = profile.firstName ?? ''
    const mi = profile.middleInitial ? ` ${profile.middleInitial}.` : ''
    return `${profile.rank ? profile.rank + ' ' : ''}${last}, ${first}${mi}`
  })()

  return (
    <>
      <PreviewOverlay
        isOpen={isOpen}
        onClose={handleClose}
        anchorRect={anchorRect}
        title={title}
        maxWidth={360}
        previewMaxHeight="55dvh"
        footer={
          isOpen && profile ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton
                icon={editMode ? Check : Pencil}
                label={editMode ? (saving ? 'Saving…' : 'Save') : 'Edit'}
                variant={editMode ? (saving ? 'disabled' : 'success') : 'default'}
                onClick={() => {
                  if (editMode) handleSave()
                  else setEditMode(true)
                }}
              />
              {!editMode && (
                <ActionButton
                  icon={Send}
                  label={activeLoans.length > 0 ? `Loans (${activeLoans.length}/4)` : 'Loans'}
                  onClick={() => setLoansMode(true)}
                />
              )}
              {loanState !== 'loaned-in' && !editMode && (
                <ActionButton icon={ArrowRightLeft} label="Transfer" onClick={() => setMoveMode('transfer')} />
              )}
              {!editMode && (
                <ActionButton
                  icon={KeyRound}
                  label="Reset password"
                  onClick={() => {
                    resetPw.reset()
                    setResetError(null)
                    setResetMode(true)
                  }}
                />
              )}
              <ActionButton
                icon={Trash2}
                label={removeLabel}
                variant="danger"
                onClick={() => setConfirmDelete(true)}
              />
            </div>
          ) : undefined
        }
      >
        {isOpen && (
          loading || !profile ? (
            <div className="flex items-center justify-center py-4 text-tertiary">
              <Loader2 size={14} className="animate-spin mr-2" />
              <span className="text-[10pt]">Loading…</span>
            </div>
          ) : (
            <div>
              {[
                { label: 'Credential', value: profile.credential || '—' },
                { label: 'Component', value: profile.component || '—' },
                { label: 'UIC', value: profile.uic || '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b border-primary/6 px-4 py-3">
                  <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">{row.label}</span>
                  <span className="text-sm text-primary truncate ml-3">{row.value}</span>
                </div>
              ))}

              {/* Rank — editable in edit mode */}
              <div className="flex items-center justify-between gap-3 border-b border-primary/6 px-4 py-3">
                <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Rank</span>
                {editMode ? (
                  profile.component && ranksByComponent ? (
                    <div className="flex-1 min-w-0 max-w-[200px]">
                      <PickerInput
                        value={rank}
                        onChange={setRank}
                        options={ranksByComponent[profile.component] ?? []}
                        placeholder="Rank"
                      />
                    </div>
                  ) : (
                    <span className="text-[9pt] text-tertiary italic">component required</span>
                  )
                ) : (
                  <span className="text-sm text-primary truncate">{profile.rank || '—'}</span>
                )}
              </div>

              {/* Roles — editable in edit mode */}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Roles</span>
                {editMode ? (
                  <div className="flex items-center gap-3">
                    {(['supervisor', 'provider'] as const).map((role) => {
                      const has = roles.includes(role)
                      return (
                        <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10pt] text-primary capitalize">{role}</span>
                          <div
                            onClick={() => {
                              setRoles(has ? roles.filter((r) => r !== role) : [...roles, role])
                            }}
                            className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
                              has ? 'bg-themeblue3' : 'bg-tertiary/20'
                            }`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              has ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-primary truncate capitalize">
                    {(profile.roles ?? ['medic']).join(', ')}
                  </span>
                )}
              </div>

              {error && (
                <div className="px-4 py-2">
                  <ErrorPill>{error}</ErrorPill>
                </div>
              )}
            </div>
          )
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={confirmDelete}
        title={`${removeLabel}?`}
        subtitle={removeSubtitle}
        confirmLabel={removeLabel}
        variant="danger"
        processing={saving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        visible={!!promoteTarget}
        title={promoteTarget ? `Make ${promoteTarget.clinicName} the home cluster?` : ''}
        subtitle={
          promoteError
            ? promoteError
            : `${homeClinicName ?? 'The current home'} becomes a loan; other active loans stay in place.`
        }
        confirmLabel="Make home"
        processing={promoting}
        onConfirm={confirmPromote}
        onCancel={() => {
          if (promoting) return
          setPromoteError(null)
          setPromoteTarget(null)
        }}
      />

      {/* Transfer — code + scan, mirrors clinic-association flow. Home-clinic
          change; trigger ends every active loan automatically. */}
      <PreviewOverlay
        isOpen={moveMode === 'transfer'}
        onClose={closeMove}
        anchorRect={anchorRect}
        title="Transfer to cluster"
        maxWidth={360}
        previewMaxHeight="60dvh"
        footer={
          moveMode ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton
                icon={Camera}
                label={scanning ? 'Stop scan' : 'Scan QR'}
                variant={scanning ? 'success' : 'default'}
                onClick={handleToggleScan}
              />
              <ActionButton
                icon={moveSaving ? Loader2 : Check}
                label="Transfer"
                variant={!moveCode || moveSaving ? 'disabled' : 'success'}
                onClick={() => submitMove(moveCode)}
              />
            </div>
          ) : undefined
        }
      >
        {moveMode && (
          <div>
            {associatedClinics && associatedClinics.length > 0 && (
              <div className="border-b border-primary/6">
                <p className="px-4 pt-3 pb-1 text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Associated</p>
                <div className="px-2 pb-2 space-y-1">
                  {associatedClinics.map((c) => {
                    const busy = pickingClinicId === c.clinicId
                    const disabled = !!pickingClinicId && !busy
                    return (
                      <button
                        key={c.clinicId}
                        type="button"
                        disabled={disabled}
                        onClick={() => pickAssociatedClinic(c.clinicId)}
                        className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left transition-all ${
                          disabled ? 'opacity-40' : 'hover:bg-secondary/5 active:scale-95'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                          {busy
                            ? <Loader2 size={14} className="text-tertiary animate-spin" />
                            : <Building2 size={14} className="text-tertiary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{c.clinicName}</p>
                          {(c.uics.length > 0 || c.location) && (
                            <p className="text-[9pt] text-tertiary truncate">
                              {[c.uics.join(', '), c.location].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center border-b border-primary/6 px-4 py-3">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Code</span>
              <input
                type="text"
                value={moveCode}
                onChange={(e) =>
                  setMoveCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && moveCode.length > 0) submitMove(moveCode)
                }}
                placeholder="Enter cluster code"
                maxLength={8}
                className="flex-1 bg-transparent font-mono tracking-[0.15em] text-primary placeholder:font-sans placeholder:tracking-normal placeholder:text-tertiary focus:outline-none text-sm min-w-0"
              />
            </div>

            {scanning && (
              <div className="px-4 py-3">
                <div className="relative w-full aspect-4/3 rounded-lg overflow-hidden bg-black/5 border border-tertiary/10">
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {!isScanning && !scanError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-[10pt] text-tertiary">Starting camera…</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(moveError || scanError) && (
              <p className="px-4 py-2 text-[10pt] text-themeredred">{moveError ?? scanError}</p>
            )}

            <p className="px-4 py-2 text-[9pt] text-tertiary border-t border-primary/6">
              Enter or scan the destination cluster’s code. The soldier’s home cluster changes and every active loan ends.
            </p>
          </div>
        )}
      </PreviewOverlay>

      {/* Loans — unified multi-select. Toggle associated/current rows + an
          ad-hoc code field. Save commits the diff one-by-one with per-row
          progress; loaned-in supervisors can only flip their own clinic row. */}
      <PreviewOverlay
        isOpen={loansMode}
        onClose={() => { if (!loansApplying) setLoansMode(false) }}
        anchorRect={anchorRect}
        title="Loans"
        maxWidth={360}
        previewMaxHeight="60dvh"
        footer={
          loansMode ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton
                icon={loansApplying ? Loader2 : Check}
                label={overCap ? `Over limit (${postSaveCount}/4)` : 'Save'}
                variant={overCap || loansApplying ? 'disabled' : 'success'}
                onClick={applyLoanChanges}
              />
            </div>
          ) : undefined
        }
      >
        {loansMode && (
          <div>
            <p className="px-4 pt-3 pb-1 text-[9pt] font-semibold text-tertiary uppercase tracking-widest">
              {`Loans (${postSaveCount}/4)`}
            </p>
            {homeClinicId && homeClinicName && (
              <div className="px-2 pb-1">
                <div className="w-full flex items-center gap-3 py-2 px-2 rounded-lg bg-themeblue3/5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-themeblue3/15 shrink-0">
                    <Home size={14} className="text-themeblue3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{homeClinicName}</p>
                  </div>
                  <span className="shrink-0 text-[9pt] font-semibold text-themeblue3 uppercase tracking-widest">Home</span>
                </div>
              </div>
            )}
            {loanRows.length === 0 ? (
              <p className="px-4 py-3 text-[10pt] text-tertiary">No clusters available. Use the code field below to loan to an unrelated cluster.</p>
            ) : (
              <div className="px-2 pb-2 space-y-1">
                {loanRows.map((c) => {
                  const checked = selectedLoanIds.has(c.clinicId)
                  const toggleable = canToggleRow(c.clinicId)
                  const state = rowState.get(c.clinicId) ?? 'idle'
                  const err = rowError.get(c.clinicId)
                  // Inline promote only when the row is an actual loan (selected
                  // pre-edit) and the viewer is the home-cluster supervisor.
                  const isActiveLoan = activeLoans.some((l) => l.clinicId === c.clinicId)
                  const showPromote = canPromoteHome && isActiveLoan && !loansApplying
                  // Row is a div (not a button) so the inline promote
                  // ActionButton isn't nested in a button — mobile would
                  // swallow the inner tap otherwise.
                  const handleRowActivate = () => {
                    if (!toggleable) return
                    toggleLoanSelection(c.clinicId)
                  }
                  return (
                    <div
                      key={c.clinicId}
                      role="button"
                      tabIndex={toggleable ? 0 : -1}
                      aria-disabled={!toggleable}
                      onClick={handleRowActivate}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleRowActivate()
                        }
                      }}
                      className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left transition-all ${
                        toggleable ? 'cursor-pointer hover:bg-secondary/5 active:scale-95' : 'opacity-60'
                      } ${checked ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                        {state === 'busy'
                          ? <Loader2 size={14} className="text-tertiary animate-spin" />
                          : state === 'error'
                            ? <AlertCircle size={14} className="text-themeredred" />
                            : <Building2 size={14} className="text-tertiary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{c.clinicName}</p>
                        {(c.subtitle || err) && (
                          <p className={`text-[9pt] truncate ${err ? 'text-themeredred' : 'text-tertiary'}`}>
                            {err ?? c.subtitle}
                          </p>
                        )}
                      </div>
                      {showPromote && (
                        <ActionButton
                          icon={Home}
                          label="Make home cluster"
                          onClick={() => setPromoteTarget({ clinicId: c.clinicId, clinicName: c.clinicName })}
                        />
                      )}
                      {checked && <Check size={14} className="text-themeblue2 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}

            {!isLoanedInView && (
              <div className="border-t border-primary/6">
                <p className="px-4 pt-3 pb-1 text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Add by code</p>
                <div className="flex items-center border-b border-primary/6 px-4 py-3">
                  <input
                    type="text"
                    value={pendingCode}
                    onChange={(e) =>
                      setPendingCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8))
                    }
                    placeholder="Cluster code"
                    maxLength={8}
                    disabled={loansApplying}
                    className="flex-1 bg-transparent font-mono tracking-[0.15em] text-primary placeholder:font-sans placeholder:tracking-normal placeholder:text-tertiary focus:outline-none text-sm min-w-0 disabled:opacity-40"
                  />
                  {rowState.get('__pending__') === 'busy' && <Loader2 size={14} className="text-tertiary animate-spin ml-2" />}
                </div>
                {rowError.get('__pending__') && (
                  <p className="px-4 py-2 text-[10pt] text-themeredred">{rowError.get('__pending__')}</p>
                )}
              </div>
            )}

            <p className="px-4 py-2 text-[9pt] text-tertiary border-t border-primary/6">
              {isLoanedInView
                ? 'You can only end the loan from your own cluster. The home-cluster supervisor manages other loans.'
                : 'Toggle a row to add or end a loan. Save applies changes one at a time; failed rows show their error.'}
            </p>
          </div>
        )}
      </PreviewOverlay>

      {/* Reset password — sibling overlay, mirrors loan/transfer pattern */}
      <PreviewOverlay
        isOpen={resetMode}
        onClose={closeReset}
        anchorRect={anchorRect}
        title="Reset password"
        maxWidth={380}
      >
        {resetMode && memberId && (
          <div>
            <ResetPasswordForm
              value={resetPw.value}
              onChange={resetPw.setValue}
              onSubmit={() => resetPw.requestConfirm(memberId)}
              onCancel={closeReset}
              processing={resetPw.processing}
            />
            {resetError && (
              <div className="px-4 py-2">
                <ErrorPill>{resetError}</ErrorPill>
              </div>
            )}
            <p className="px-4 py-2 text-[9pt] text-tertiary border-t border-primary/6">
              The new password takes effect immediately. The user is not notified.
            </p>
          </div>
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!resetPw.confirmingUserId}
        title={`Reset password for ${title || 'this user'}?`}
        subtitle="The new password takes effect immediately. The user is not notified."
        confirmLabel="Reset"
        variant="danger"
        processing={resetPw.processing}
        onConfirm={handleResetSubmit}
        onCancel={resetPw.cancelConfirm}
      />
    </>
  )
}
