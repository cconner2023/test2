/**
 * AdminUserDetail -- detailed view for a single user in the admin panel.
 *
 * Displays profile header, metadata grid, certifications, and admin
 * action buttons (reset password, force logout). Edit is inline via
 * the Settings-pattern toolbar (editing/saveRequested props).
 * Delete has moved to the header.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KeyRound, LogOut, X, Check } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import type { Component } from '../../Data/User'
import { UserAvatar } from '../Settings/UserAvatar'
import { UserRow } from '../UserRow'
import { AdminCertsSection } from './AdminCertsSection'
import { RoleBadge } from './adminUtils'
import { TextInput, PickerInput, MultiPickerInput, UicPinInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import {
  listAllUsers,
  listClinics,
  resetUserPassword,
  forceLogoutUser,
  updateUserProfile,
  addUserRole,
  removeUserRole,
  setUserClinic,
  createUser,
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { fetchAllCertifications } from '../../lib/certificationService'
import { useAuthStore } from '../../stores/useAuthStore'
import { UI_TIMING } from '../../Utilities/constants'
import { invalidate } from '../../stores/useInvalidationStore'

// ─── Types ────────────────────────────────────────────────────────────

interface AdminUserDetailProps {
  user: AdminUser | null
  onBack: () => void
  onUserUpdated: (user: AdminUser) => void
  onCreated?: (userId: string) => void
  // Edit toolbar props (Settings pattern)
  editing: boolean
  onEditingChange: (editing: boolean) => void
  saveRequested: boolean
  onSaveComplete: () => void
  onPendingChangesChange?: (hasPending: boolean) => void
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

const AVAILABLE_ROLES = ['medic', 'supervisor', 'dev', 'provider'] as const

// ─── Component ────────────────────────────────────────────────────────

export function AdminUserDetail({
  user,
  onBack: _onBack,
  onUserUpdated,
  onCreated,
  editing,
  onEditingChange,
  saveRequested,
  onSaveComplete,
  onPendingChangesChange,
}: AdminUserDetailProps) {
  const currentUser = useAuthStore(s => s.user)
  const currentUserId = currentUser?.id ?? null

  // ── Data state ──────────────────────────────────────────────────────
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])

  // ── UI state ────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Reset password inline
  const [resetPwActive, setResetPwActive] = useState(false)
  const [resetPwValue, setResetPwValue] = useState('')
  const [resetPwProcessing, setResetPwProcessing] = useState(false)
  const [resetPwSuccess, setResetPwSuccess] = useState(false)

  // Force logout
  const [forceLogoutProcessing, setForceLogoutProcessing] = useState(false)

  // ── Edit state ──────────────────────────────────────────────────────
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editMiddleInitial, setEditMiddleInitial] = useState('')
  const [editCredential, setEditCredential] = useState('')
  const [editComponent, setEditComponent] = useState('')
  const [editRank, setEditRank] = useState('')
  const [editUic, setEditUic] = useState('')
  const [editClinicId, setEditClinicId] = useState('')
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [editPeDepth, setEditPeDepth] = useState('standard')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreateMode = user === null
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')

  // ── Derived data ────────────────────────────────────────────────────
  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics])

  const userCerts = useMemo(() => {
    if (!user) return []
    return allCerts.filter((cert) => cert.user_id === user.id)
  }, [allCerts, user])

  const componentRanks = editComponent ? ranksByComponent[editComponent as Component] : []

  // ── Clinic options for edit PickerInput ─────────────────────────────
  const clinicOptions = useMemo(
    () => clinics.map(c => ({ value: c.id, label: `${c.name} (${c.uics.join(', ')})` })),
    [clinics],
  )

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
      setEditPeDepth(user?.pe_depth ?? 'standard')
      setCreateEmail('')
      setCreatePassword('')
      setError(null)
    }
    prevEditingRef.current = editing
  }, [editing, user])

  // ── Pending changes detection ────────────────────────────────────────
  useEffect(() => {
    if (!editing) { onPendingChangesChange?.(false); return }
    const changed = editFirstName !== (user?.first_name || '')
      || editLastName !== (user?.last_name || '')
      || editMiddleInitial !== (user?.middle_initial || '')
      || editCredential !== (user?.credential || '')
      || editComponent !== (user?.component || '')
      || editRank !== (user?.rank || '')
      || editUic !== (user?.uic || '')
      || editClinicId !== (user?.clinic_id || '')
      || JSON.stringify([...editRoles].sort()) !== JSON.stringify([...(user?.roles ?? ['medic'])].sort())
      || editPeDepth !== (user?.pe_depth ?? 'standard')
    onPendingChangesChange?.(changed)
  }, [editing, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editRoles, editPeDepth, user, onPendingChangesChange])

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
      peDepth: editPeDepth,
    })
    if (!profileResult.success) {
      setError(profileResult.error || 'Failed to update profile')
      setSaving(false)
      return
    }

    // 2. Reconcile roles
    const oldRoles = new Set(user.roles || [])
    const newRoles = new Set<string>(chosenRoles)
    for (const role of chosenRoles) {
      if (!oldRoles.has(role)) {
        const result = await addUserRole(user.id, role)
        if (!result.success) {
          setError(`Failed to add role ${role}: ${result.error}`)
          setSaving(false)
          return
        }
      }
    }
    for (const role of user.roles || []) {
      if (!newRoles.has(role)) {
        const result = await removeUserRole(user.id, role)
        if (!result.success) {
          setError(`Failed to remove role ${role}: ${result.error}`)
          setSaving(false)
          return
        }
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
    }

    setSaving(false)
    onEditingChange(false)
    loadData()
    invalidate('users', 'clinics')
  }, [user, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editRoles, editPeDepth, onEditingChange, loadData, isCreateMode, createEmail, createPassword, onCreated])

  // ── Save requested trigger ───────────────────────────────────────────
  useEffect(() => {
    if (saveRequested) {
      handleSave()
      onSaveComplete()
    }
  }, [saveRequested, handleSave, onSaveComplete])

  const handleResetPassword = async () => {
    if (!user || resetPwValue.length < 12) return
    setResetPwProcessing(true)
    const result = await resetUserPassword(user.id, resetPwValue)
    setResetPwProcessing(false)

    if (result.success) {
      setResetPwActive(false)
      setResetPwValue('')
      setResetPwSuccess(true)
      setTimeout(() => setResetPwSuccess(false), UI_TIMING.SAVE_ERROR_DURATION)
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to reset password' })
    }
  }

  const handleForceLogout = async () => {
    if (!user) return
    setForceLogoutProcessing(true)
    const result = await forceLogoutUser(user.id)
    setForceLogoutProcessing(false)

    if (result.success) {
      setFeedback({
        type: 'success',
        message: `Force logout complete: ${result.sessionsDeleted} session(s), ${result.devicesDeleted} device(s), ${result.bundlesDeleted} key bundle(s) cleared`,
      })
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to force logout user' })
    }
  }

  const openResetPassword = () => {
    setResetPwActive(true)
    setResetPwValue('')
    setResetPwSuccess(false)
  }

  // ── Full name helper ────────────────────────────────────────────────
  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className={saving ? 'opacity-50 pointer-events-none' : undefined}>
      {/* Feedback banner */}
      {feedback && (
        <div className={`mb-4 px-4 py-3 rounded-2xl border text-sm flex items-center justify-between gap-2 ${
          feedback.type === 'success'
            ? 'bg-themegreen/10 border-themegreen/20 text-themegreen'
            : 'bg-themeredred/10 border-themeredred/20 text-themeredred'
        }`}>
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all hover:bg-white/20"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && <div className="mb-4"><ErrorDisplay message={error} /></div>}

      {/* Main card — compact card in view, form inputs in edit */}
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        {editing ? (
          <div className="px-4 py-3.5 space-y-3">
            {isCreateMode ? (
              <>
                <TextInput value={createEmail} onChange={setCreateEmail} placeholder="Email *" type="email" required />
                <TextInput value={createPassword} onChange={setCreatePassword} placeholder="Temporary Password *" required />
              </>
            ) : (
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatarId={user!.avatar_id}
                  firstName={user!.first_name}
                  lastName={user!.last_name}
                  className="w-11 h-11"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-normal text-tertiary/70">{user!.email}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <TextInput value={editFirstName} onChange={setEditFirstName} placeholder="First Name *" required />
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <TextInput value={editLastName} onChange={setEditLastName} placeholder="Last Name *" required />
                </div>
                <div className="w-11 shrink-0">
                  <TextInput value={editMiddleInitial} onChange={v => setEditMiddleInitial(v.toUpperCase().slice(0, 1))} placeholder="MI" maxLength={1} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PickerInput value={editCredential} onChange={setEditCredential} options={credentials} placeholder="Credential" />
              <PickerInput value={editComponent} onChange={handleComponentChange} options={components} placeholder="Component" />
            </div>
            {editComponent && <PickerInput value={editRank} onChange={setEditRank} options={componentRanks} placeholder="Rank" />}
            <div>
              <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-1.5 block">UIC</span>
              <UicPinInput value={editUic} onChange={setEditUic} spread />
            </div>
            <PickerInput value={editClinicId} onChange={setEditClinicId} options={clinicOptions} placeholder="Clinic" />
            <MultiPickerInput
              label="Roles"
              value={editRoles}
              onChange={setEditRoles}
              options={AVAILABLE_ROLES.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
              placeholder="Roles"
              required
            />
            <PickerInput value={editPeDepth} onChange={setEditPeDepth} options={['focused', 'standard', 'comprehensive']} placeholder="PE Depth" />
          </div>
        ) : user ? (
          <div>
            <UserRow
              avatarId={user.avatar_id}
              firstName={user.first_name}
              lastName={user.last_name}
              middleInitial={user.middle_initial}
              rank={user.rank}
              lastActiveAt={user.last_active_at}
              subtitle={[user.credential, user.roles?.join(' · '), user.clinic_id && clinicMap.has(user.clinic_id) ? clinicMap.get(user.clinic_id)!.name : null].filter(Boolean).join(' · ') || user.email}
              size="md"
              showChevron={false}
              right={
                <div className="flex gap-1 flex-wrap justify-end shrink-0">
                  {user.roles?.map((role) => <RoleBadge key={role} role={role} />)}
                </div>
              }
            />
            {user.email && (
              <p className="text-[11px] font-normal text-tertiary/50 -mt-1.5 mb-3 pl-[3.75rem] px-4">{user.email}</p>
            )}
          </div>
        ) : null}
      </div>

      {!isCreateMode && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">Certifications</p>
          <AdminCertsSection
            userId={user!.id}
            certs={userCerts}
            editing={editing}
            onChanged={loadData}
          />
        </div>
      )}

      {/* Actions section — hidden during edit mode */}
      {!editing && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">Actions</p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">

            {/* Reset Password row */}
            <div>
              <button
                onClick={openResetPassword}
                className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5 text-left"
              >
                <span className="w-9 h-9 rounded-full bg-themeyellow/15 flex items-center justify-center shrink-0">
                  <KeyRound size={18} className="text-themeyellow" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">Reset Password</p>
                  <p className="text-[11px] text-tertiary/70 mt-0.5">Set a new password for this user</p>
                </div>
                {resetPwSuccess && (
                  <span className="text-xs font-medium text-themegreen shrink-0">Reset.</span>
                )}
              </button>
              {resetPwActive && (
                <div className="px-4 pb-3.5 bg-tertiary/5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={resetPwValue}
                      onChange={(e) => setResetPwValue(e.target.value)}
                      placeholder="New password (min 12 chars)..."
                      className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeyellow/30 text-sm focus:border-themeblue2 focus:outline-none"
                    />
                    <button
                      onClick={handleResetPassword}
                      disabled={resetPwProcessing || resetPwValue.length < 12}
                      aria-label="Reset password"
                      className="shrink-0 w-10 h-10 rounded-full bg-themeyellow text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => { setResetPwActive(false); setResetPwValue('') }}
                      aria-label="Cancel"
                      className="shrink-0 w-10 h-10 rounded-full text-tertiary flex items-center justify-center active:scale-95 transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {resetPwValue.length > 0 && resetPwValue.length < 12 && (
                    <p className="text-xs text-themeredred mt-1.5">Minimum 12 characters.</p>
                  )}
                </div>
              )}
            </div>

            {/* Force Logout row */}
            {currentUserId !== user?.id && (
              <button
                onClick={handleForceLogout}
                disabled={forceLogoutProcessing}
                className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5 disabled:opacity-50 text-left"
              >
                <span className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
                  <LogOut size={18} className="text-tertiary/50" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">
                    {forceLogoutProcessing ? 'Logging out' : 'Force Logout'}
                  </p>
                </div>
              </button>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
