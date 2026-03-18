/**
 * AdminUserForm.tsx
 *
 * Unified create/edit form for admin user management.
 * When `user` is null the form operates in create mode; when a user
 * object is provided it operates in edit mode.  The parent component
 * (AdminDrawer) owns the header/back button -- this component renders
 * only the form body.
 */

import { useState, useEffect, useCallback } from 'react'
import { TextInput, SelectInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { credentials, components, ranksByComponent } from '../../Data/User'
import type { Component } from '../../Data/User'
import {
  createUser,
  updateUserProfile,
  addUserRole,
  removeUserRole,
  setUserClinic,
  listClinics,
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'

// ─── Props ────────────────────────────────────────────────────────────

interface AdminUserFormProps {
  /** Pass null for create mode, or an existing user for edit mode. */
  user: AdminUser | null
  onBack: () => void
  onSaved: () => void
}

// ─── Available roles ──────────────────────────────────────────────────

const AVAILABLE_ROLES = ['medic', 'supervisor', 'dev', 'provider'] as const
type Role = (typeof AVAILABLE_ROLES)[number]

// ─── Helpers ──────────────────────────────────────────────────────────

/** Build the initial roles state from an optional role list. */
const buildRolesState = (existing?: string[]): Record<Role, boolean> => ({
  medic: existing?.includes('medic') ?? true,
  supervisor: existing?.includes('supervisor') ?? false,
  dev: existing?.includes('dev') ?? false,
  provider: existing?.includes('provider') ?? false,
})

/** Extract selected role keys from the roles record. */
const selectedRoles = (roles: Record<Role, boolean>): Role[] =>
  AVAILABLE_ROLES.filter((r) => roles[r])

// ─── Component ────────────────────────────────────────────────────────

const AdminUserForm = ({ user, onBack, onSaved }: AdminUserFormProps) => {
  const isEditMode = user !== null

  // ── Shared fields ───────────────────────────────────────────────────
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [middleInitial, setMiddleInitial] = useState(user?.middle_initial || '')
  const [credential, setCredential] = useState(user?.credential || '')
  const [component, setComponent] = useState(user?.component || '')
  const [rank, setRank] = useState(user?.rank || '')
  const [uic, setUic] = useState(user?.uic || '')
  const [roles, setRoles] = useState<Record<Role, boolean>>(() => buildRolesState(user?.roles))

  // ── Create-only fields ──────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [tempPassword, setTempPassword] = useState('')

  // ── Edit-only fields ────────────────────────────────────────────────
  const [selectedClinicId, setSelectedClinicId] = useState(user?.clinic_id || '')
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [noteIncludeHPI, setNoteIncludeHPI] = useState(user?.note_include_hpi ?? true)
  const [noteIncludePE, setNoteIncludePE] = useState(user?.note_include_pe ?? false)
  const [peDepth, setPeDepth] = useState(user?.pe_depth ?? 'standard')

  // ── Shared UI state ─────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────
  const componentRanks = component ? ranksByComponent[component as Component] : []

  // ── Load clinics for the edit-mode dropdown ─────────────────────────
  useEffect(() => {
    if (!isEditMode) return
    let cancelled = false
    listClinics().then((data) => {
      if (!cancelled) setClinics(data)
    })
    return () => { cancelled = true }
  }, [isEditMode])

  // ── Handlers ────────────────────────────────────────────────────────

  const handleComponentChange = useCallback(
    (val: string) => {
      setComponent(val)
      if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
        setRank('')
      }
    },
    [rank],
  )

  const toggleRole = useCallback((role: Role) => {
    setRoles((prev) => ({ ...prev, [role]: !prev[role] }))
  }, [])

  // ── Create submit ───────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!email || !firstName || !lastName) {
      setError('Email, first name, and last name are required')
      return
    }
    if (tempPassword.length < 12) {
      setError('Temporary password must be at least 12 characters')
      return
    }

    const chosen = selectedRoles(roles)
    if (chosen.length === 0) {
      setError('At least one role must be selected')
      return
    }

    setSubmitting(true)
    const result = await createUser({
      email,
      tempPassword,
      firstName,
      lastName,
      middleInitial: middleInitial || undefined,
      credential: credential || undefined,
      component: component || undefined,
      rank: rank || undefined,
      uic: uic || undefined,
      roles: chosen,
    })
    setSubmitting(false)

    if (result.success) {
      onSaved()
    } else {
      setError(result.error || 'Failed to create user')
    }
  }

  // ── Edit submit ─────────────────────────────────────────────────────

  const handleEdit = async () => {
    if (!user) return

    const chosen = selectedRoles(roles)
    if (chosen.length === 0) {
      setError('At least one role must be selected')
      return
    }

    setSubmitting(true)

    // 1. Update profile fields
    const profileResult = await updateUserProfile(user.id, {
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

    if (!profileResult.success) {
      setError(profileResult.error || 'Failed to update profile')
      setSubmitting(false)
      return
    }

    // 2. Reconcile roles -- add new, remove old
    const oldRoles = new Set(user.roles || [])
    const newRoles = new Set<string>(chosen)

    for (const role of chosen) {
      if (!oldRoles.has(role)) {
        const result = await addUserRole(user.id, role)
        if (!result.success) {
          setError(`Failed to add role ${role}: ${result.error}`)
          setSubmitting(false)
          return
        }
      }
    }

    for (const role of user.roles || []) {
      if (!newRoles.has(role)) {
        const result = await removeUserRole(user.id, role as Role)
        if (!result.success) {
          setError(`Failed to remove role ${role}: ${result.error}`)
          setSubmitting(false)
          return
        }
      }
    }

    // 3. Update clinic assignment if changed
    const originalClinicId = user.clinic_id || ''
    if (selectedClinicId !== originalClinicId) {
      const clinicResult = await setUserClinic(user.id, selectedClinicId || null)
      if (!clinicResult.success) {
        setError(clinicResult.error || 'Failed to update clinic')
        setSubmitting(false)
        return
      }
    }

    setSubmitting(false)
    onSaved()
  }

  // ── Unified submit ─────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isEditMode) {
      await handleEdit()
    } else {
      await handleCreate()
    }
  }

  // ── Selected clinic metadata (edit mode) ────────────────────────────

  const selectedClinic = clinics.find((c) => c.id === selectedClinicId)

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <>
      <h3 className="text-base font-semibold text-primary mb-1">
        {isEditMode ? 'Edit User' : 'Create New User'}
      </h3>

      {isEditMode && user && (
        <p className="text-sm text-tertiary/60 mb-4">{user.email}</p>
      )}

      {!isEditMode && <div className="mb-4" />}

      {error && <ErrorDisplay message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Create-only: email & password ─────────────────────────── */}
        {!isEditMode && (
          <>
            <TextInput label="Email" value={email} onChange={setEmail} placeholder="user@mail.mil" type="email" required />
            <TextInput label="Temporary Password" value={tempPassword} onChange={setTempPassword} placeholder="Min 12 characters" required />
          </>
        )}

        {/* ── Name fields ───────────────────────────────────────────── */}
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

        {/* ── Service details ───────────────────────────────────────── */}
        <SelectInput label="Credential" value={credential} onChange={setCredential} options={credentials} />
        <SelectInput label="Component" value={component} onChange={handleComponentChange} options={components} />
        {component && <SelectInput label="Rank" value={rank} onChange={setRank} options={componentRanks} />}
        <TextInput label="UIC" value={uic} onChange={(v) => setUic(v.toUpperCase())} maxLength={6} />

        {/* ── Edit-only: clinic assignment ───────────────────────────── */}
        {isEditMode && (
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Clinic</span>
            <select
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                         border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                         transition-colors appearance-none"
            >
              <option value="">No clinic assigned</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name} ({clinic.uics.join(', ')})
                </option>
              ))}
            </select>
            {selectedClinic?.location && (
              <p className="mt-1 text-xs text-tertiary/50">{selectedClinic.location}</p>
            )}
          </label>
        )}

        {/* ── Roles ─────────────────────────────────────────────────── */}
        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Roles</span>
          <div className="flex gap-3 mt-2">
            {AVAILABLE_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roles[role]}
                  onChange={() => toggleRole(role)}
                  className="w-4 h-4 rounded border-tertiary/30"
                />
                <span className="text-sm text-primary capitalize">{role}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Edit-only: note content defaults ──────────────────────── */}
        {isEditMode && (
          <div>
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Note Content Defaults</span>
            <div className="mt-2 space-y-2">
              <label className="flex items-center justify-between cursor-pointer px-3 py-2.5 rounded-lg bg-themewhite2 border border-tertiary/10">
                <span className="text-sm text-primary">Include HPI</span>
                <input
                  type="checkbox"
                  checked={noteIncludeHPI}
                  onChange={() => setNoteIncludeHPI(!noteIncludeHPI)}
                  className="w-4 h-4 rounded border-tertiary/30"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer px-3 py-2.5 rounded-lg bg-themewhite2 border border-tertiary/10">
                <span className="text-sm text-primary">Include PE</span>
                <input
                  type="checkbox"
                  checked={noteIncludePE}
                  onChange={() => setNoteIncludePE(!noteIncludePE)}
                  className="w-4 h-4 rounded border-tertiary/30"
                />
              </label>
              <SelectInput
                label="PE Depth"
                value={peDepth}
                onChange={setPeDepth}
                options={['focused', 'standard', 'comprehensive'] as const}
              />
            </div>
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full px-4 py-3 rounded-lg text-white font-medium transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isEditMode
                        ? 'bg-themeblue3 hover:bg-themeblue3/90'
                        : 'bg-themegreen hover:bg-themegreen/90'
                      }`}
        >
          {submitting
            ? isEditMode ? 'Saving...' : 'Creating User...'
            : isEditMode ? 'Save Changes' : 'Create User'
          }
        </button>
      </form>
    </>
  )
}

export default AdminUserForm
