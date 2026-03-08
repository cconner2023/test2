/**
 * AdminUserDetail -- detailed view for a single user in the admin panel.
 *
 * Displays profile header, metadata grid, certifications, and admin
 * action buttons (edit, reset password, force logout, delete).
 * Extracted from the monolithic UsersTab in AdminPanel.tsx.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { KeyRound, Trash2, AlertTriangle, LogOut } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { UserAvatar } from '../Settings/UserAvatar'
import { AdminCertsSection } from './AdminCertsSection'
import { formatLastActive, lastActiveColor, RoleBadge } from './adminUtils'
import {
  listAllUsers,
  listClinics,
  deleteUser,
  resetUserPassword,
  forceLogoutUser,
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { fetchAllCertifications } from '../../lib/certificationService'
import { supabase } from '../../lib/supabase'
import { UI_TIMING } from '../../Utilities/constants'

// ─── Types ────────────────────────────────────────────────────────────

interface AdminUserDetailProps {
  user: AdminUser
  onEdit: (user: AdminUser) => void
  onBack: () => void
  onUserUpdated: (user: AdminUser) => void
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

// ─── Component ────────────────────────────────────────────────────────

export function AdminUserDetail({ user, onEdit: _onEdit, onBack, onUserUpdated }: AdminUserDetailProps) {
  // ── Data state ──────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // ── UI state ────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Reset password inline
  const [resetPwActive, setResetPwActive] = useState(false)
  const [resetPwValue, setResetPwValue] = useState('')
  const [resetPwProcessing, setResetPwProcessing] = useState(false)
  const [resetPwSuccess, setResetPwSuccess] = useState(false)

  // Delete user inline
  const [deleteActive, setDeleteActive] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // Force logout
  const [forceLogoutProcessing, setForceLogoutProcessing] = useState(false)

  // ── Derived data ────────────────────────────────────────────────────
  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics])

  const userCerts = useMemo(() => {
    return allCerts.filter((cert) => cert.user_id === user.id)
  }, [allCerts, user.id])

  // ── Data loading ────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [userData, clinicData, certData] = await Promise.all([
      listAllUsers(),
      listClinics(),
      fetchAllCertifications(),
    ])
    setUsers(userData)
    setClinics(clinicData)
    setAllCerts(certData)

    // Sync user prop with latest data so parent stays current
    const refreshed = userData.find((u) => u.id === user.id)
    if (refreshed) onUserUpdated(refreshed)
  }, [user.id, onUserUpdated])

  useEffect(() => { loadData() }, [loadData])

  // Fetch current user ID once to prevent self-deletion / self-logout
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) setCurrentUserId(authUser.id)
    })
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────

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

  const handleDeleteUser = async () => {
    if (deleteConfirmEmail !== user.email) return
    setDeleteProcessing(true)
    const result = await deleteUser(user.id)
    setDeleteProcessing(false)

    if (result.success) {
      setDeleteActive(false)
      setDeleteConfirmEmail('')
      setFeedback({ type: 'success', message: 'User deleted successfully' })
      // Navigate back to the user list after deletion
      onBack()
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to delete user' })
    }
  }

  const openResetPassword = () => {
    setResetPwActive(true)
    setResetPwValue('')
    setResetPwSuccess(false)
  }

  const openDelete = () => {
    setDeleteActive(true)
    setDeleteConfirmEmail('')
    setResetPwActive(false)
  }

  // ── Full name helper ────────────────────────────────────────────────
  const fullName = [user.first_name, user.middle_initial, user.last_name]
    .filter(Boolean)
    .join(' ')

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <>
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

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            avatarId={user.avatar_id}
            firstName={user.first_name}
            lastName={user.last_name}
            className="w-12 h-12"
          />
          <div>
            <h3 className="text-base font-semibold text-primary">{fullName}</h3>
            <p className="text-sm text-tertiary/70">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {user.roles?.map((role) => <RoleBadge key={role} role={role} />)}
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        {user.rank && (
          <div>
            <span className="text-tertiary/60">Rank:</span>{' '}
            <span className="text-primary font-medium">{user.rank}</span>
          </div>
        )}
        {user.credential && (
          <div>
            <span className="text-tertiary/60">Credential:</span>{' '}
            <span className="text-primary font-medium">{user.credential}</span>
          </div>
        )}
        {user.component && (
          <div>
            <span className="text-tertiary/60">Component:</span>{' '}
            <span className="text-primary font-medium">{user.component}</span>
          </div>
        )}
        {user.uic && (
          <div>
            <span className="text-tertiary/60">UIC:</span>{' '}
            <span className="text-primary font-medium">{user.uic}</span>
          </div>
        )}
        {user.clinic_id && clinicMap.has(user.clinic_id) && (
          <div>
            <span className="text-tertiary/60">Clinic:</span>{' '}
            <span className="text-primary font-medium">{clinicMap.get(user.clinic_id)!.name}</span>
          </div>
        )}
        <div>
          <span className="text-tertiary/60">Last Active:</span>{' '}
          <span className="inline-flex items-center gap-1 text-primary font-medium">
            <span className={`inline-block w-2 h-2 rounded-full ${lastActiveColor(user.last_active_at)}`} />
            {formatLastActive(user.last_active_at)}
          </span>
        </div>
      </div>

      {/* Reset password inline */}
      {resetPwActive ? (
        <div className="p-3 bg-themeyellow/10 rounded-lg mb-3">
          <p className="text-sm text-themeyellow font-medium mb-2">Set new password:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={resetPwValue}
              onChange={(e) => setResetPwValue(e.target.value)}
              placeholder="New password (min 12 chars)..."
              className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeyellow/30 text-sm"
            />
            <button
              onClick={handleResetPassword}
              disabled={resetPwProcessing || resetPwValue.length < 12}
              className="px-3 py-2 rounded-lg bg-themeyellow text-white text-sm font-medium hover:bg-themeyellow/90 disabled:opacity-50"
            >
              {resetPwProcessing ? 'Resetting...' : 'Reset'}
            </button>
            <button
              onClick={() => { setResetPwActive(false); setResetPwValue('') }}
              className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
            >
              Cancel
            </button>
          </div>
          {resetPwValue.length > 0 && resetPwValue.length < 12 && (
            <p className="text-xs text-themeredred mt-1">Password must be at least 12 characters</p>
          )}
        </div>
      ) : resetPwSuccess ? (
        <div className="p-2 bg-themegreen/10 rounded-lg mb-3 text-sm text-themegreen font-medium">
          Password reset successfully
        </div>
      ) : null}

      {/* Delete user inline confirmation */}
      {deleteActive && (
        <div className="p-3 bg-themeredred/10 rounded-lg mb-3 border border-themeredred/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-themeredred shrink-0" />
            <p className="text-sm text-themeredred font-semibold">Permanently delete this user?</p>
          </div>
          <p className="text-xs text-themeredred mb-3">
            This will delete <span className="font-semibold">{user.first_name} {user.last_name}</span> and all
            associated data (notes, training, sync queue). This action cannot be undone.
          </p>
          <p className="text-xs text-themeredred mb-2">
            Type <span className="font-mono font-semibold bg-themeredred/10 px-1 py-0.5 rounded">{user.email}</span> to confirm:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder="Type email to confirm..."
              className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeredred/30 text-sm
                         focus:border-themeredred focus:outline-none transition-colors placeholder:text-tertiary/30"
              autoComplete="off"
            />
            <button
              onClick={handleDeleteUser}
              disabled={deleteProcessing || deleteConfirmEmail !== user.email}
              className="px-3 py-2 rounded-lg bg-themeredred text-white text-sm font-medium
                         hover:bg-themeredred/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleteProcessing ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => { setDeleteActive(false); setDeleteConfirmEmail('') }}
              className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Certifications */}
      <AdminCertsSection
        userId={user.id}
        certs={userCerts}
        currentUserId={currentUserId}
        allUsers={users}
        onChanged={loadData}
      />

      {/* Action menu — consistent with CardActionBar style, rendered at bottom */}
      <div className="mt-5 border-t border-tertiary/10 pt-4">
        <p className="text-[10px] text-tertiary/50 uppercase tracking-wide mb-2">Actions</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openResetPassword}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeyellow/10 text-themeyellow text-sm font-medium
                       hover:bg-themeyellow/20 border border-themeyellow/20 transition-colors"
          >
            <KeyRound size={14} /> Reset Password
          </button>
          {currentUserId !== user.id && (
            <button
              onClick={handleForceLogout}
              disabled={forceLogoutProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary/10 text-primary text-sm font-medium hover:bg-tertiary/20 transition-colors disabled:opacity-50"
            >
              <LogOut size={14} /> {forceLogoutProcessing ? 'Logging out...' : 'Force Logout'}
            </button>
          )}
          {currentUserId !== user.id && (
            <button
              onClick={openDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeredred/10 text-themeredred text-sm font-medium
                         hover:bg-themeredred/20 border border-themeredred/20 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>
    </>
  )
}
