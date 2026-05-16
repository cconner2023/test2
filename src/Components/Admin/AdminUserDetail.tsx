/**
 * AdminUserDetail -- detailed view for a single user in the admin panel.
 *
 * Displays profile header, metadata grid, certifications, and admin
 * actions (email, reset password, force logout) as an ActionPill in
 * the user-card corner. Edit is inline via the Settings-pattern
 * toolbar (editing/saveRequested props). Delete lives in the header.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KeyRound, LogOut, Building2, ChevronRight, Mail, Check, RefreshCw, X, Trash2 } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import type { Component } from '../../Data/User'
import { UserAvatar } from '../Settings/UserAvatar'
import { UserRow } from '../UserRow'
import { AdminCertsSection } from './AdminCertsSection'
import { TextInput, PickerInput, MultiPickerInput, UicPinInput, PasswordInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { ConfirmDialog } from '../ConfirmDialog'
import { Z } from '../BaseOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { PreviewOverlay } from '../PreviewOverlay'
import { formatLastActive, RoleBadge, SupervisorCreatedBadge } from './adminUtils'
import { useResetPasswordFlow } from '../../Hooks/useResetPasswordFlow'
import {
  listAllUsers,
  listClinics,
  forceLogoutUser,
  updateUserProfile,
  setUserRoles,
  setUserClinic,
  setUserLoans,
  createUser,
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { ClinicPickerInput, ClinicMultiPickerInput } from './AdminPickers'
import { fetchAllCertifications } from '../../lib/certificationService'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../lib/supabase'
import { UI_TIMING } from '../../Utilities/constants'
import { invalidate } from '../../stores/useInvalidationStore'
import { sameStringSet } from '../../Utilities/arrayEquals'

// ─── Types ────────────────────────────────────────────────────────────

interface AdminUserDetailProps {
  user: AdminUser | null
  onUserUpdated: (user: AdminUser) => void
  onCreated?: (userId: string) => void
  onSelectClinic?: (clinic: AdminClinic) => void
  // Edit toolbar props (Settings pattern) — for edit on existing users,
  // the editing flag is now internal (tap-to-overlay). These remain for
  // the create flow until Phase 3 of the overlay conversion.
  editing: boolean
  onEditingChange: (editing: boolean) => void
  saveRequested: boolean
  onSaveComplete: () => void
  onPendingChangesChange?: (hasPending: boolean) => void
  /** Called when the user requests deletion from the edit overlay footer. */
  onRequestDelete?: () => void
}

const AVAILABLE_ROLES = ['medic', 'supervisor', 'dev', 'provider'] as const

// ─── Component ────────────────────────────────────────────────────────

export function AdminUserDetail({
  user,
  onUserUpdated,
  onCreated,
  onSelectClinic,
  editing,
  onEditingChange,
  saveRequested,
  onSaveComplete,
  onPendingChangesChange,
  onRequestDelete,
}: AdminUserDetailProps) {
  const currentUser = useAuthStore(s => s.user)
  const currentUserId = currentUser?.id ?? null

  // ── Data state ──────────────────────────────────────────────────────
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])

  // ── UI state ────────────────────────────────────────────────────────
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Reset password popover (anchored to KeyRound action button via pill ref)
  const pillRef = useRef<HTMLDivElement>(null)
  const [resetPwAnchor, setResetPwAnchor] = useState<DOMRect | null>(null)
  const resetPw = useResetPasswordFlow()

  // Edit overlay — tap user card → PreviewOverlay anchored to card rect.
  const cardWrapperRef = useRef<HTMLDivElement>(null)
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null)

  // Force logout
  const [forceLogoutProcessing, setForceLogoutProcessing] = useState(false)
  const [confirmForceLogout, setConfirmForceLogout] = useState(false)

  // ── Edit state ──────────────────────────────────────────────────────
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editMiddleInitial, setEditMiddleInitial] = useState('')
  const [editCredential, setEditCredential] = useState('')
  const [editComponent, setEditComponent] = useState('')
  const [editRank, setEditRank] = useState('')
  const [editUic, setEditUic] = useState('')
  const [editClinicId, setEditClinicId] = useState('')
  const [editLoanClinicIds, setEditLoanClinicIds] = useState<Set<string>>(new Set())
  const [originalLoanClinicIds, setOriginalLoanClinicIds] = useState<Set<string>>(new Set())
  const [editRoles, setEditRoles] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreateMode = user === null
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')

  // ── Derived data ────────────────────────────────────────────────────
  const userCerts = useMemo(() => {
    if (!user) return []
    return allCerts.filter((cert) => cert.user_id === user.id)
  }, [allCerts, user])

  const componentRanks = editComponent ? ranksByComponent[editComponent as Component] : []

  // ── Data loading ────────────────────────────────────────────────────

  /** Stable ref for onUserUpdated to avoid recreating loadData on every render. */
  const onUserUpdatedRef = useRef(onUserUpdated)
  onUserUpdatedRef.current = onUserUpdated

  const loadData = useCallback(async () => {
    if (isCreateMode) {
      const clinicData = await listClinics()
      setClinics(clinicData)
      return
    }
    const [userData, clinicData, certData] = await Promise.all([
      listAllUsers(),
      listClinics(),
      fetchAllCertifications(),
    ])
    setClinics(clinicData)
    setAllCerts(certData)

    // Sync user prop with latest data so parent stays current
    const refreshed = userData.find((u) => u.id === user?.id)
    if (refreshed) onUserUpdatedRef.current(refreshed)
  }, [isCreateMode, user?.id])

  useEffect(() => { loadData() }, [loadData])

  // ── Edit overlay ↔ editing prop sync ─────────────────────────────────
  // External editing=true (e.g. legacy header pencil path, still wired for
  // create flow until Phase 3) opens the overlay; editing=false closes it.
  // Skip auto-opening in create mode — that flow renders inline in the card
  // for now and will be converted to an overlay in Phase 3.
  useEffect(() => {
    if (editing && !isCreateMode) {
      if (!editAnchor) {
        const rect = cardWrapperRef.current?.getBoundingClientRect() ?? null
        if (rect) setEditAnchor(rect)
      }
    } else {
      setEditAnchor(null)
    }
  }, [editing, isCreateMode, editAnchor])

  const openEditOverlay = useCallback(() => {
    if (isCreateMode) return
    const rect = cardWrapperRef.current?.getBoundingClientRect() ?? null
    if (!rect) return
    setEditAnchor(rect)
    onEditingChange(true)
  }, [isCreateMode, onEditingChange])

  const closeEditOverlay = useCallback(() => {
    setEditAnchor(null)
    onEditingChange(false)
  }, [onEditingChange])

  // ── Edit mode initialization (only on false→true transition) ─────────
  const prevEditingRef = useRef(false)
  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      setEditFirstName(user?.first_name || '')
      setEditLastName(user?.last_name || '')
      setEditMiddleInitial(user?.middle_initial || '')
      setEditCredential(user?.credential || '')
      setEditComponent(user?.component || '')
      setEditRank(user?.rank || '')
      setEditUic(user?.uic || '')
      setEditClinicId(user?.clinic_id || '')
      setEditRoles(user?.roles?.filter(r => AVAILABLE_ROLES.includes(r as typeof AVAILABLE_ROLES[number])) ?? ['medic'])
      // Hydrate current loans for the multi-select. supabase is imported below.
      if (user?.id) {
        supabase
          .from('profile_clinic_loans')
          .select('clinic_id')
          .eq('user_id', user.id)
          .then(({ data }) => {
            const ids = new Set<string>((data ?? []).map((r: { clinic_id: string }) => r.clinic_id))
            setEditLoanClinicIds(ids)
            setOriginalLoanClinicIds(ids)
          })
      } else {
        setEditLoanClinicIds(new Set())
        setOriginalLoanClinicIds(new Set())
      }

      setCreateEmail('')
      setCreatePassword('')
      setError(null)
    }
    prevEditingRef.current = editing
  }, [editing, user])

  // ── Pending changes detection ────────────────────────────────────────
  useEffect(() => {
    if (!editing) { onPendingChangesChange?.(false); return }
    const sameLoans = editLoanClinicIds.size === originalLoanClinicIds.size
      && Array.from(editLoanClinicIds).every((id) => originalLoanClinicIds.has(id))
    const changed = editFirstName !== (user?.first_name || '')
      || editLastName !== (user?.last_name || '')
      || editMiddleInitial !== (user?.middle_initial || '')
      || editCredential !== (user?.credential || '')
      || editComponent !== (user?.component || '')
      || editRank !== (user?.rank || '')
      || editUic !== (user?.uic || '')
      || editClinicId !== (user?.clinic_id || '')
      || !sameLoans
      || !sameStringSet(editRoles, user?.roles ?? ['medic'])

    onPendingChangesChange?.(changed)
  }, [editing, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editLoanClinicIds, originalLoanClinicIds, editRoles, user, onPendingChangesChange])

  // ── Handlers ────────────────────────────────────────────────────────

  const handleComponentChange = useCallback((val: string) => {
    setEditComponent(val)
    if (val && editRank && !ranksByComponent[val as Component]?.includes(editRank)) {
      setEditRank('')
    }
  }, [editRank])

  const handleSave = useCallback(async () => {
    const chosenRoles = editRoles
    if (chosenRoles.length === 0) {
      setError('Select at least one role.')
      return
    }

    // ── Create mode ──
    if (isCreateMode) {
      if (!createEmail || !editFirstName || !editLastName) {
        setError('Email, first name, and last name required.')
        return
      }
      if (createPassword.length < 12) {
        setError('Minimum 12 characters.')
        return
      }
      setSaving(true)
      setError(null)
      const result = await createUser({
        email: createEmail,
        tempPassword: createPassword,
        firstName: editFirstName,
        lastName: editLastName,
        middleInitial: editMiddleInitial || undefined,
        credential: editCredential || undefined,
        component: editComponent || undefined,
        rank: editRank || undefined,
        uic: editUic || undefined,
        roles: chosenRoles,
      })
      setSaving(false)
      if (result.success && result.userId) {
        // Assign clinic if selected
        if (editClinicId) {
          await setUserClinic(result.userId, editClinicId)
        }
        onCreated?.(result.userId)
        invalidate('users', 'clinics')
      } else {
        setError(result.error || 'Failed to create user')
      }
      return
    }

    setSaving(true)
    setError(null)

    // 1. Update profile fields
    if (!user) return
    const profileResult = await updateUserProfile(user.id, {
      firstName: editFirstName || undefined,
      lastName: editLastName || undefined,
      middleInitial: editMiddleInitial,
      credential: editCredential,
      component: editComponent,
      rank: editRank,
      uic: editUic || undefined,

    })
    if (!profileResult.success) {
      setError(profileResult.error || 'Failed to update profile')
      setSaving(false)
      return
    }

    // 2. Reconcile roles — single RPC call with the final role set
    const oldSorted = [...(user.roles || [])].sort().join(',')
    const newSorted = [...chosenRoles].sort().join(',')
    if (oldSorted !== newSorted) {
      const result = await setUserRoles(user.id, chosenRoles as ('medic' | 'supervisor' | 'dev' | 'provider')[])
      if (!result.success) {
        setError(result.error || 'Failed to update roles')
        setSaving(false)
        return
      }
    }

    // 3. Update clinic assignment if changed
    const originalClinicId = user.clinic_id || ''
    if (editClinicId !== originalClinicId) {
      const clinicResult = await setUserClinic(user.id, editClinicId || null)
      if (!clinicResult.success) {
        setError(clinicResult.error || 'Failed to update clinic')
        setSaving(false)
        return
      }
      // The DB trigger clears surrogate when clinic_id changes — mirror that
      // here so the next save diff doesn't try to re-set the stale value.
    }

    // 4. Replace the entire loan set if it changed.
    // Skip if assigned clinic just changed (trigger already wiped all loans).
    const sameLoans = editLoanClinicIds.size === originalLoanClinicIds.size
      && Array.from(editLoanClinicIds).every((id) => originalLoanClinicIds.has(id))
    if (editClinicId !== originalClinicId) {
      // Trigger cascade nulled everything; re-apply the editor's selection
      // (filtered to exclude the new home clinic).
      const next = Array.from(editLoanClinicIds).filter((id) => id !== editClinicId)
      const loansResult = await setUserLoans(user.id, next)
      if (!loansResult.success) {
        setError(loansResult.error || 'Failed to update loans')
        setSaving(false)
        return
      }
    } else if (!sameLoans) {
      const loansResult = await setUserLoans(user.id, Array.from(editLoanClinicIds))
      if (!loansResult.success) {
        setError(loansResult.error || 'Failed to update loans')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onEditingChange(false)
    loadData()
    invalidate('users', 'clinics')
  }, [user, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editLoanClinicIds, originalLoanClinicIds, editRoles, onEditingChange, loadData, isCreateMode, createEmail, createPassword, onCreated])

  // ── Save requested trigger ───────────────────────────────────────────
  useEffect(() => {
    if (saveRequested) {
      handleSave()
      onSaveComplete()
    }
  }, [saveRequested, handleSave, onSaveComplete])

  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'user'

  const handleResetPasswordConfirm = async () => {
    const result = await resetPw.submit()
    if (result.success) {
      setResetPwAnchor(null)
      setNotify({ type: 'success', message: `Password reset for ${userName}.` })
    } else {
      setNotify({ type: 'error', message: result.error || `Failed to reset password for ${userName}` })
    }
  }

  const handleForceLogout = async () => {
    if (!user) return
    setConfirmForceLogout(false)
    setForceLogoutProcessing(true)
    const result = await forceLogoutUser(user.id)
    setForceLogoutProcessing(false)

    if (result.success) {
      setNotify({
        type: 'success',
        message: `Force logout ${userName}: ${result.sessionsDeleted} session(s), ${result.devicesDeleted} device(s), ${result.bundlesDeleted} key bundle(s) cleared`,
      })
    } else {
      setNotify({ type: 'error', message: result.error || `Failed to force logout ${userName}` })
    }
  }

  const openResetPassword = () => {
    const rect = pillRef.current?.getBoundingClientRect() ?? null
    resetPw.reset()
    setResetPwAnchor(rect)
  }

  const closeResetPassword = () => {
    setResetPwAnchor(null)
    resetPw.reset()
  }

  // ── Full name helper ────────────────────────────────────────────────
  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className={`pt-5${saving ? ' opacity-50 pointer-events-none' : ''}`}>
      {/* Error banner */}
      {error && <div className="mb-4"><ErrorDisplay message={error} /></div>}

      {/* Main card — view-mode UserRow for existing users (tap to open edit
          overlay), legacy inline form for create-mode until Phase 3.
          pt-5 above gives the overlay-pill -translate-y-1/2 protrusion room. */}
      <div ref={cardWrapperRef} className="relative">
        <div
          className={`rounded-2xl bg-themewhite2 overflow-hidden ${user && !isCreateMode ? 'cursor-pointer active:bg-themeblue2/5 transition-colors' : ''}`}
          onClick={user && !isCreateMode ? openEditOverlay : undefined}
          role={user && !isCreateMode ? 'button' : undefined}
          tabIndex={user && !isCreateMode ? 0 : undefined}
          aria-label={user && !isCreateMode ? `Edit ${userName}` : undefined}
          onKeyDown={user && !isCreateMode ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditOverlay() }
          } : undefined}
        >
          {isCreateMode && editing ? (
            // Legacy inline create form — Phase 3 will move this to an overlay anchored to the FAB.
            <div>
              <TextInput value={createEmail} onChange={setCreateEmail} placeholder="Email *" type="email" required />
              <PasswordInput value={createPassword} onChange={setCreatePassword} placeholder="Temporary password (min 12 chars)" />
              <TextInput value={editFirstName} onChange={setEditFirstName} placeholder="First Name *" required />
              <div className="flex items-stretch border-b border-primary/6">
                <div className="flex-1 min-w-0">
                  <TextInput value={editLastName} onChange={setEditLastName} placeholder="Last Name *" required />
                </div>
                <div className="w-16 shrink-0 border-l border-primary/6">
                  <TextInput value={editMiddleInitial} onChange={v => setEditMiddleInitial(v.toUpperCase().slice(0, 1))} placeholder="MI" maxLength={1} />
                </div>
              </div>
              <PickerInput value={editCredential} onChange={setEditCredential} options={credentials} placeholder="Credential" />
              <PickerInput value={editComponent} onChange={handleComponentChange} options={components} placeholder="Component" />
              {editComponent && <PickerInput value={editRank} onChange={setEditRank} options={componentRanks} placeholder="Rank" />}
              <UicPinInput value={editUic} onChange={setEditUic} spread />
              <ClinicPickerInput value={editClinicId} onChange={setEditClinicId} allClinics={clinics} placeholder="Cluster" />
              <MultiPickerInput
                value={editRoles}
                onChange={setEditRoles}
                options={AVAILABLE_ROLES.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
                placeholder="Roles *"
                required
              />
            </div>
          ) : user ? (
            <UserRow
              avatarId={user.avatar_id}
              firstName={user.first_name}
              lastName={user.last_name}
              middleInitial={user.middle_initial}
              rank={user.rank}
              lastActiveAt={user.last_active_at}
              subtitle={[
                user.credential,
                user.uic,
                user.clinic_name,
                user.surrogate_clinic_name ? `Loaned to ${user.surrogate_clinic_name}` : null,
                user.email,
              ].filter(Boolean).join(' · ')}
              meta={(user.roles?.length > 0 || user.supervisor_created) && (
                <div className="flex flex-wrap items-center gap-1">
                  {user.roles.map(r => <RoleBadge key={r} role={r} />)}
                  {user.supervisor_created && <SupervisorCreatedBadge />}
                </div>
              )}
              size="md"
              showChevron={false}
              right={<span className="text-[9pt] text-tertiary/50 shrink-0">{formatLastActive(user.last_active_at)}</span>}
            />
          ) : null}
        </div>

        {/* Corner action pill — non-self only. Edit no longer toggles this off,
            since edit happens in the overlay above. Stop propagation so card-tap
            doesn't fire when the user clicks an action button. */}
        {!isCreateMode && user && currentUserId !== user.id && (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionPill ref={pillRef} shadow="sm" placement="overlay">
              {user.email && (
                <a
                  href={`mailto:${user.email}?subject=${encodeURIComponent('Beacon Inquiry')}&body=${encodeURIComponent(`${[user.rank, user.last_name].filter(Boolean).join(' ')},\n\n`)}`}
                  aria-label="Email user"
                  title="Email user"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 bg-themeblue2/8 text-primary"
                >
                  <Mail size={16} />
                </a>
              )}
              <ActionButton
                icon={KeyRound}
                label="Reset password"
                onClick={openResetPassword}
              />
              <ActionButton
                icon={LogOut}
                label={forceLogoutProcessing ? 'Logging out' : 'Force logout'}
                variant={forceLogoutProcessing ? 'disabled' : 'default'}
                onClick={() => setConfirmForceLogout(true)}
              />
            </ActionPill>
          </div>
        )}
      </div>

      {/* Reset password popover — anchored to corner ActionPill, confirmation via ConfirmDialog */}
      <PreviewOverlay
        isOpen={!!resetPwAnchor}
        onClose={closeResetPassword}
        anchorRect={resetPwAnchor}
        title="Reset password"
        maxWidth={340}
        footer={
          resetPwAnchor && user ? (
            <ActionPill shadow="sm">
              <ActionButton
                icon={resetPw.processing ? RefreshCw : Check}
                label={resetPw.processing ? 'Submitting…' : 'Reset password'}
                variant={resetPw.processing || resetPw.value.length < 12 ? 'disabled' : 'success'}
                onClick={() => user && resetPw.requestConfirm(user.id)}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {resetPwAnchor && user && (
          <div>
            <PasswordInput
              value={resetPw.value}
              onChange={resetPw.setValue}
              placeholder="New password (min 12 chars)"
              hint={resetPw.value.length > 0 && resetPw.value.length < 12 ? 'Minimum 12 characters.' : undefined}
            />
          </div>
        )}
      </PreviewOverlay>

      {/* Edit overlay — tap user card → form fields here. Footer owns Save+Delete. */}
      <PreviewOverlay
        isOpen={!!editAnchor && !isCreateMode}
        onClose={closeEditOverlay}
        anchorRect={editAnchor}
        title={`Edit ${userName}`}
        maxWidth={400}
        previewMaxHeight="70dvh"
        footer={
          editAnchor && user ? (
            <ActionPill shadow="sm">
              {onRequestDelete && currentUserId !== user.id && (
                <ActionButton
                  icon={Trash2}
                  label="Delete user"
                  variant="danger"
                  onClick={() => { setEditAnchor(null); onRequestDelete() }}
                />
              )}
              <ActionButton
                icon={saving ? RefreshCw : Check}
                label={saving ? 'Saving…' : 'Save'}
                variant={saving ? 'disabled' : 'success'}
                onClick={handleSave}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {editAnchor && user && (
          <div>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-primary/6">
              <UserAvatar
                avatarId={user.avatar_id}
                firstName={user.first_name}
                lastName={user.last_name}
                className="w-11 h-11"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[9pt] font-normal text-tertiary">{user.email}</p>
              </div>
            </div>
            <TextInput value={editFirstName} onChange={setEditFirstName} placeholder="First Name *" required />
            <div className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <TextInput value={editLastName} onChange={setEditLastName} placeholder="Last Name *" required />
              </div>
              <div className="w-16 shrink-0 border-l border-primary/6">
                <TextInput value={editMiddleInitial} onChange={v => setEditMiddleInitial(v.toUpperCase().slice(0, 1))} placeholder="MI" maxLength={1} />
              </div>
            </div>
            <PickerInput value={editCredential} onChange={setEditCredential} options={credentials} placeholder="Credential" />
            <PickerInput value={editComponent} onChange={handleComponentChange} options={components} placeholder="Component" />
            {editComponent && <PickerInput value={editRank} onChange={setEditRank} options={componentRanks} placeholder="Rank" />}
            <UicPinInput value={editUic} onChange={setEditUic} spread />
            <ClinicPickerInput value={editClinicId} onChange={setEditClinicId} allClinics={clinics} placeholder="Cluster" />
            <ClinicMultiPickerInput
              selectedIds={[...editLoanClinicIds]}
              onChange={(ids) => setEditLoanClinicIds(new Set(ids))}
              allClinics={clinics}
              excludeId={editClinicId ?? undefined}
              placeholder={`Loans${editLoanClinicIds.size > 0 ? ` (${editLoanClinicIds.size})` : ''}`}
            />

            <MultiPickerInput
              value={editRoles}
              onChange={setEditRoles}
              options={AVAILABLE_ROLES.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
              placeholder="Roles *"
              required
            />
          </div>
        )}
      </PreviewOverlay>

      {/* Clinic card — view mode only, when user has a clinic */}
      {!editing && !isCreateMode && user?.clinic_id && (() => {
        const userClinic = clinics.find(c => c.id === user.clinic_id)
        if (!userClinic) return null
        return (
          <div className="mt-3 rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            <button
              type="button"
              onClick={() => onSelectClinic?.(userClinic)}
              disabled={!onSelectClinic}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all active:scale-95 hover:bg-themeblue2/5 disabled:cursor-default"
            >
              <span className="w-9 h-9 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-themeblue2" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{userClinic.name}</p>
                {userClinic.uics.length > 0 && (
                  <p className="text-[9pt] text-tertiary mt-0.5 truncate">{userClinic.uics.join(', ')}</p>
                )}
              </div>
              {onSelectClinic && <ChevronRight size={16} className="text-tertiary shrink-0" />}
            </button>
          </div>
        )
      })()}

      {!isCreateMode && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">Certifications</p>
          <AdminCertsSection
            userId={user!.id}
            certs={userCerts}
            editing={editing}
            onChanged={loadData}
          />
        </div>
      )}

      <ConfirmDialog
        visible={!!resetPw.confirmingUserId}
        title={`Reset password for ${userName}?`}
        subtitle="The new password takes effect immediately. The user is not notified."
        confirmLabel="Reset"
        variant="danger"
        processing={resetPw.processing}
        onConfirm={handleResetPasswordConfirm}
        onCancel={resetPw.cancelConfirm}
        zIndex={Z.POPOVER + 30}
      />

      <ConfirmDialog
        visible={confirmForceLogout}
        title={`Force logout ${userName}?`}
        subtitle="Clears all sessions, device registrations, and Signal key bundles. The user must re-authenticate and re-register on every device."
        confirmLabel="Force Logout"
        variant="warning"
        processing={forceLogoutProcessing}
        onConfirm={handleForceLogout}
        onCancel={() => setConfirmForceLogout(false)}
      />

      <ConfirmDialog
        visible={!!notify}
        title={notify?.message ?? ''}
        variant={notify?.type === 'success' ? 'success' : 'danger'}
        notifyOnly
        autoDismissMs={UI_TIMING.FEEDBACK_DURATION}
        onCancel={() => setNotify(null)}
      />
    </div>
  )
}
