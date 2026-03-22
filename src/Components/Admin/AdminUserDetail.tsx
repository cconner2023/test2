/**
 * AdminUserDetail -- detailed view for a single user in the admin panel.
 *
 * Displays profile header, metadata grid, certifications, and admin
 * action buttons (reset password, force logout). Edit is inline via
 * the Settings-pattern toolbar (editing/saveRequested props).
 * Delete has moved to the header.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { KeyRound, LogOut } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import type { Component } from '../../Data/User'
import { UserAvatar } from '../Settings/UserAvatar'
import { AdminCertsSection } from './AdminCertsSection'
import { formatLastActive, lastActiveColor, RoleBadge } from './adminUtils'
import { TextInput, SelectInput } from '../FormInputs'
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
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { fetchAllCertifications } from '../../lib/certificationService'
import { useAuthStore } from '../../stores/useAuthStore'
import { UI_TIMING } from '../../Utilities/constants'

// ─── Types ────────────────────────────────────────────────────────────

interface AdminUserDetailProps {
  user: AdminUser
  onBack: () => void
  onUserUpdated: (user: AdminUser) => void
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
  const [editRoles, setEditRoles] = useState<Record<string, boolean>>({})
  const [editNoteIncludeHPI, setEditNoteIncludeHPI] = useState(true)
  const [editNoteIncludePE, setEditNoteIncludePE] = useState(false)
  const [editPeDepth, setEditPeDepth] = useState('standard')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Derived data ────────────────────────────────────────────────────
  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics])

  const userCerts = useMemo(() => {
    return allCerts.filter((cert) => cert.user_id === user.id)
  }, [allCerts, user.id])

  const componentRanks = editComponent ? ranksByComponent[editComponent as Component] : []

  // ── Clinic options for edit SelectInput ─────────────────────────────
  const clinicOptions = useMemo(
    () => clinics.map(c => ({ value: c.id, label: `${c.name} (${c.uics.join(', ')})` })),
    [clinics],
  )

  // ── Data loading ────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [userData, clinicData, certData] = await Promise.all([
      listAllUsers(),
      listClinics(),
      fetchAllCertifications(),
    ])
    setClinics(clinicData)
    setAllCerts(certData)

    // Sync user prop with latest data so parent stays current
    const refreshed = userData.find((u) => u.id === user.id)
    if (refreshed) onUserUpdated(refreshed)
  }, [user.id, onUserUpdated])

  useEffect(() => { loadData() }, [loadData])

  // ── Edit mode initialization ─────────────────────────────────────────
  useEffect(() => {
    if (editing) {
      setEditFirstName(user.first_name || '')
      setEditLastName(user.last_name || '')
      setEditMiddleInitial(user.middle_initial || '')
      setEditCredential(user.credential || '')
      setEditComponent(user.component || '')
      setEditRank(user.rank || '')
      setEditUic(user.uic || '')
      setEditClinicId(user.clinic_id || '')
      setEditRoles({
        medic: user.roles?.includes('medic') ?? true,
        supervisor: user.roles?.includes('supervisor') ?? false,
        dev: user.roles?.includes('dev') ?? false,
        provider: user.roles?.includes('provider') ?? false,
      })
      setEditNoteIncludeHPI(user.note_include_hpi ?? true)
      setEditNoteIncludePE(user.note_include_pe ?? false)
      setEditPeDepth(user.pe_depth ?? 'standard')
      setError(null)
    }
  }, [editing, user])

  // ── Pending changes detection ────────────────────────────────────────
  useEffect(() => {
    if (!editing) { onPendingChangesChange?.(false); return }
    const changed = editFirstName !== (user.first_name || '')
      || editLastName !== (user.last_name || '')
      || editMiddleInitial !== (user.middle_initial || '')
      || editCredential !== (user.credential || '')
      || editComponent !== (user.component || '')
      || editRank !== (user.rank || '')
      || editUic !== (user.uic || '')
      || editClinicId !== (user.clinic_id || '')
      || JSON.stringify(editRoles) !== JSON.stringify({
        medic: user.roles?.includes('medic') ?? true,
        supervisor: user.roles?.includes('supervisor') ?? false,
        dev: user.roles?.includes('dev') ?? false,
        provider: user.roles?.includes('provider') ?? false,
      })
      || editNoteIncludeHPI !== (user.note_include_hpi ?? true)
      || editNoteIncludePE !== (user.note_include_pe ?? false)
      || editPeDepth !== (user.pe_depth ?? 'standard')
    onPendingChangesChange?.(changed)
  }, [editing, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editRoles, editNoteIncludeHPI, editNoteIncludePE, editPeDepth, user, onPendingChangesChange])

  // ── Handlers ────────────────────────────────────────────────────────

  const handleComponentChange = useCallback((val: string) => {
    setEditComponent(val)
    if (val && editRank && !ranksByComponent[val as Component]?.includes(editRank)) {
      setEditRank('')
    }
  }, [editRank])

  const handleSave = useCallback(async () => {
    const chosenRoles = AVAILABLE_ROLES.filter(r => editRoles[r])
    if (chosenRoles.length === 0) {
      setError('At least one role must be selected')
      return
    }
    setSaving(true)
    setError(null)

    // 1. Update profile fields
    const profileResult = await updateUserProfile(user.id, {
      firstName: editFirstName || undefined,
      lastName: editLastName || undefined,
      middleInitial: editMiddleInitial,
      credential: editCredential,
      component: editComponent,
      rank: editRank,
      uic: editUic || undefined,
      noteIncludeHPI: editNoteIncludeHPI,
      noteIncludePE: editNoteIncludePE,
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
  }, [user, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editRoles, editNoteIncludeHPI, editNoteIncludePE, editPeDepth, onEditingChange, loadData])

  // ── Save requested trigger ───────────────────────────────────────────
  useEffect(() => {
    if (saveRequested) {
      handleSave()
      onSaveComplete()
    }
  }, [saveRequested, handleSave, onSaveComplete])

  const handleResetPassword = async () => {
    if (resetPwValue.length < 12) return
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
  const fullName = [user.first_name, user.middle_initial, user.last_name]
    .filter(Boolean)
    .join(' ')

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className={saving ? 'opacity-50 pointer-events-none' : undefined}>
      {/* Feedback banner */}
      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-themegreen/10 border border-themegreen/20 text-themegreen'
            : 'bg-themeredred/10 border border-themeredred/20 text-themeredred'
        }`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="float-right text-xs opacity-60 hover:opacity-100">
            dismiss
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && <div className="mb-4"><ErrorDisplay message={error} /></div>}

      {/* Main card — consolidated profile + info (view) or all edit fields (edit) */}
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        {editing ? (
          <div className="px-4 py-3.5 space-y-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                avatarId={user.avatar_id}
                firstName={user.first_name}
                lastName={user.last_name}
                className="w-11 h-11"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-tertiary/70">{user.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="First Name" value={editFirstName} onChange={setEditFirstName} />
              <TextInput label="Last Name" value={editLastName} onChange={setEditLastName} />
            </div>
            <TextInput
              label="Middle Initial"
              value={editMiddleInitial}
              onChange={v => setEditMiddleInitial(v.toUpperCase().slice(0, 1))}
              maxLength={1}
            />
            <SelectInput label="Credential" value={editCredential} onChange={setEditCredential} options={credentials} />
            <SelectInput label="Component" value={editComponent} onChange={handleComponentChange} options={components} />
            {editComponent && <SelectInput label="Rank" value={editRank} onChange={setEditRank} options={componentRanks} />}
            <TextInput label="UIC" value={editUic} onChange={v => setEditUic(v.toUpperCase())} maxLength={6} />
            <SelectInput label="Clinic" value={editClinicId} onChange={setEditClinicId} options={clinicOptions} placeholder="No clinic assigned" />
            <div>
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Roles</span>
              <div className="flex gap-3 mt-2 flex-wrap">
                {AVAILABLE_ROLES.map(role => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editRoles[role] || false}
                      onChange={() => setEditRoles(prev => ({ ...prev, [role]: !prev[role] }))}
                      className="w-4 h-4 rounded border-tertiary/30"
                    />
                    <span className="text-sm text-primary capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-sm text-primary">Include HPI</span>
              <input type="checkbox" checked={editNoteIncludeHPI} onChange={() => setEditNoteIncludeHPI(!editNoteIncludeHPI)} className="w-4 h-4 rounded border-tertiary/30" />
            </label>
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-sm text-primary">Include PE</span>
              <input type="checkbox" checked={editNoteIncludePE} onChange={() => setEditNoteIncludePE(!editNoteIncludePE)} className="w-4 h-4 rounded border-tertiary/30" />
            </label>
            <SelectInput label="PE Depth" value={editPeDepth} onChange={setEditPeDepth} options={['focused', 'standard', 'comprehensive']} />
          </div>
        ) : (
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <UserAvatar
                  avatarId={user.avatar_id}
                  firstName={user.first_name}
                  lastName={user.last_name}
                  className="w-11 h-11"
                />
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-themewhite2 ${lastActiveColor(user.last_active_at)}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary truncate">
                  {user.rank ? `${user.rank} ` : ''}{fullName}
                </p>
                <p className="text-[11px] text-tertiary/70 mt-0.5 truncate">
                  {[user.credential, user.roles?.join(' · '), user.clinic_id && clinicMap.has(user.clinic_id) ? clinicMap.get(user.clinic_id)!.name : null].filter(Boolean).join(' · ') || user.email}
                </p>
              </div>
              <div className="flex gap-1 flex-wrap justify-end shrink-0">
                {user.roles?.map((role) => <RoleBadge key={role} role={role} />)}
              </div>
            </div>
            {user.email && (
              <p className="text-[11px] text-tertiary/50 mt-1.5 pl-14">{user.email}</p>
            )}
          </div>
        )}
      </div>

      {/* Certifications — always visible */}
      <div className="mt-4">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">Certifications</p>
        <AdminCertsSection
          userId={user.id}
          certs={userCerts}
          editing={editing}
          onChanged={loadData}
        />
      </div>

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
                  <span className="text-xs font-medium text-themegreen shrink-0">Reset successfully</span>
                )}
              </button>
              {resetPwActive && (
                <div className="px-4 pb-3.5 bg-tertiary/5">
                  <div className="flex gap-2">
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
                      className="px-3 py-2 rounded-lg bg-themeyellow text-white text-sm font-medium hover:bg-themeyellow/90 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {resetPwProcessing ? 'Resetting...' : 'Reset'}
                    </button>
                    <button
                      onClick={() => { setResetPwActive(false); setResetPwValue('') }}
                      className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                  {resetPwValue.length > 0 && resetPwValue.length < 12 && (
                    <p className="text-xs text-themeredred mt-1.5">Password must be at least 12 characters</p>
                  )}
                </div>
              )}
            </div>

            {/* Force Logout row */}
            {currentUserId !== user.id && (
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
                    {forceLogoutProcessing ? 'Logging out...' : 'Force Logout'}
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
