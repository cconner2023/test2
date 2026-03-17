import { useState, useEffect, useCallback, useMemo } from 'react'
import { UserPlus, Pencil, KeyRound, Trash2, LogOut, Eye, Building2 } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { CardContextMenu } from '../CardContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useLongPress } from '../../Hooks/useLongPress'
import { formatLastActive } from './adminUtils'
import {
  listAllUsers,
  listClinics,
  deleteUser,
  resetUserPassword,
  forceLogoutUser,
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { fetchAllCertifications } from '../../lib/certificationService'
import type { Certification } from '../../Data/User'
import { supabase } from '../../lib/supabase'
import { UI_TIMING } from '../../Utilities/constants'

// ─── Public Interface ────────────────────────────────────────────────────

export interface AdminUsersListProps {
  onSelectUser: (user: AdminUser) => void
  onEditUser: (user: AdminUser) => void
  onCreateUser: () => void
  filterUserId?: string | null
  searchQuery?: string
}

// ─── Per-card wrapper with long-press support ─────────────────────────────

interface UserCardProps {
  user: AdminUser
  onTap: () => void
  onContextMenu: (x: number, y: number) => void
  children: React.ReactNode
}

function UserCard({ user, onTap, onContextMenu, children }: UserCardProps) {
  const longPress = useLongPress((x, y) => onContextMenu(x, y))

  return (
    <div
      key={user.id}
      onClick={onTap}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
      {...longPress}
      className="cursor-pointer active:scale-95 transition-transform"
    >
      {children}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────

export function AdminUsersList({
  onSelectUser,
  onEditUser,
  onCreateUser,
  filterUserId,
  searchQuery: searchQueryProp,
}: AdminUsersListProps) {
  const searchQuery = searchQueryProp ?? ''

  // Data
  const [users, setUsers] = useState<AdminUser[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // Current user ID (to prevent self-deletion / self-logout)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    userId: string
    x: number
    y: number
  } | null>(null)

  // Inline reset password
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null)
  const [resetPwValue, setResetPwValue] = useState('')
  const [resetPwProcessing, setResetPwProcessing] = useState(false)

  // Confirm dialog
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Auto-dismiss feedback
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), UI_TIMING.FEEDBACK_DURATION)
    return () => clearTimeout(t)
  }, [feedback])

  // ─── Data Loading ──────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const [userData, clinicData, certData] = await Promise.all([
      listAllUsers(),
      listClinics(),
      fetchAllCertifications(),
    ])
    setUsers(userData)
    setClinics(clinicData)
    setAllCerts(certData)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Fetch current user ID once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  // ─── Derived Data ──────────────────────────────────────────────────────

  /** Clinic lookup by ID */
  const clinicById = useMemo(() => {
    const map = new Map<string, AdminClinic>()
    for (const c of clinics) map.set(c.id, c)
    return map
  }, [clinics])

  /** Certifications grouped by user_id for O(1) lookup */
  const certsByUser = useMemo(() => {
    const map = new Map<string, Certification[]>()
    for (const cert of allCerts) {
      const arr = map.get(cert.user_id) || []
      arr.push(cert)
      map.set(cert.user_id, arr)
    }
    return map
  }, [allCerts])

  /** Filtered user list based on search query and optional tree filter */
  const filteredUsers = useMemo(() => {
    let result = users

    if (filterUserId) {
      result = result.filter((u) => u.id === filterUserId)
    }

    if (!searchQuery) return result

    const q = searchQuery.toLowerCase()
    return result.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.uic?.toLowerCase().includes(q),
    )
  }, [users, searchQuery, filterUserId])

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleDeleteUser = useCallback(
    async (userId: string) => {
      setDeleteProcessing(true)
      const result = await deleteUser(userId)
      setDeleteProcessing(false)
      setConfirmDeleteId(null)

      if (result.success) {
        setFeedback({ type: 'success', message: 'User deleted successfully' })
        await loadUsers()
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'Failed to delete user',
        })
      }
    },
    [loadUsers],
  )

  const handleResetPassword = useCallback(
    async (userId: string) => {
      if (resetPwValue.length < 12) return
      setResetPwProcessing(true)
      const result = await resetUserPassword(userId, resetPwValue)
      setResetPwProcessing(false)

      if (result.success) {
        setResetPwUserId(null)
        setResetPwValue('')
        setFeedback({ type: 'success', message: 'Password reset successfully' })
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'Failed to reset password',
        })
      }
    },
    [resetPwValue],
  )

  const handleForceLogout = useCallback(async (userId: string) => {
    const result = await forceLogoutUser(userId)
    if (result.success) {
      setFeedback({
        type: 'success',
        message: `Force logout complete: ${result.sessionsDeleted} session(s), ${result.devicesDeleted} device(s), ${result.bundlesDeleted} key bundle(s) cleared`,
      })
    } else {
      setFeedback({
        type: 'error',
        message: result.error || 'Failed to force logout user',
      })
    }
  }, [])

  // ─── Helpers ───────────────────────────────────────────────────────────

  const isSelf = (userId: string) => userId === currentUserId

  /** Build right-click / long-press context menu items for a given user */
  const buildContextMenuItems = useCallback(
    (user: AdminUser) => {
      if (isSelf(user.id)) return []
      return [
        {
          key: 'view',
          label: 'View',
          icon: Eye,
          onAction: () => onSelectUser(user),
        },
        {
          key: 'edit',
          label: 'Edit',
          icon: Pencil,
          onAction: () => onEditUser(user),
        },
        {
          key: 'changepw',
          label: 'Change Password',
          icon: KeyRound,
          onAction: () => {
            setResetPwUserId(user.id)
            setResetPwValue('')
          },
        },
        {
          key: 'logout',
          label: 'Log Out',
          icon: LogOut,
          onAction: () => handleForceLogout(user.id),
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          destructive: true,
          onAction: () => setConfirmDeleteId(user.id),
        },
      ]
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, onEditUser, onSelectUser, handleForceLogout],
  )

  // ─── Render ────────────────────────────────────────────────────────────

  const deleteTargetUser = confirmDeleteId
    ? users.find((u) => u.id === confirmDeleteId)
    : null

  return (
    <div>
      <div className="px-5 pt-4 pb-2 space-y-3">
        <div className="flex items-center">
          <p className="text-sm text-tertiary/60">Manage user accounts</p>
        </div>

        {feedback && <ErrorDisplay type={feedback.type} message={feedback.message} />}
      </div>

      <div className="px-5 pb-4">
        {showLoading ? (
          <LoadingSpinner label="Loading users..." className="py-12 text-tertiary" />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={28} />}
            title={searchQuery ? 'No users match your search' : 'No users found'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredUsers.map((user) => {
              const userCerts = certsByUser.get(user.id) || []

              return (
                <UserCard
                  key={user.id}
                  user={user}
                  onTap={() => onSelectUser(user)}
                  onContextMenu={(x, y) =>
                    setContextMenu({ userId: user.id, x, y })
                  }
                >
                  <div className="rounded-xl border px-4 py-3.5 transition-colors border-tertiary/15 bg-themewhite2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">
                          {user.rank ? `${user.rank} ` : ''}{user.first_name || ''} {user.middle_initial || ''}{' '}
                          {user.last_name || ''}
                        </p>
                        <p className="text-[10pt] text-tertiary truncate">
                          {[
                            user.credential,
                            ...userCerts.filter(c => !c.is_primary).map(c => c.title),
                          ].filter(Boolean).join(' · ') || user.email || ''}
                        </p>
                      </div>

                      <span className="text-[10pt] text-tertiary shrink-0">
                        {formatLastActive(user.last_active_at)}
                      </span>
                    </div>

                    {/* Roles as plain text + UIC/Clinic badges */}
                    {(user.roles?.length || user.uic || user.clinic_id) && (
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {user.roles && user.roles.length > 0 && (
                          <span className="text-[10pt] text-tertiary">
                            {user.roles.join(' · ')}
                          </span>
                        )}
                        {user.uic && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10pt] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
                            {user.uic}
                          </span>
                        )}
                        {user.clinic_id && clinicById.get(user.clinic_id) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10pt] font-medium border bg-themegreen/10 text-themegreen border-themegreen/30">
                            <Building2 size={12} />
                            {clinicById.get(user.clinic_id)!.name}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Inline: Reset password form */}
                    {resetPwUserId === user.id && (
                      <div
                        className="mt-3 p-3 bg-tertiary/5 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-[10pt] text-primary font-medium mb-2">
                          Set new password:
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={resetPwValue}
                            onChange={(e) => setResetPwValue(e.target.value)}
                            placeholder="New password (min 12 chars)..."
                            className="flex-1 px-3 py-1.5 rounded-lg bg-themewhite2 border border-tertiary/20 text-[10pt]
                                       focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30"
                          />
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            disabled={resetPwProcessing || resetPwValue.length < 12}
                            className="px-4 py-1.5 rounded-lg bg-themeblue3 text-white text-[10pt] font-medium disabled:opacity-50 active:scale-95"
                          >
                            {resetPwProcessing ? 'Resetting...' : 'Reset'}
                          </button>
                          <button
                            onClick={() => {
                              setResetPwUserId(null)
                              setResetPwValue('')
                            }}
                            className="px-3 py-1.5 rounded-lg bg-tertiary/10 text-primary text-[10pt] active:scale-95"
                          >
                            Cancel
                          </button>
                        </div>
                        {resetPwValue.length > 0 && resetPwValue.length < 12 && (
                          <p className="text-[10pt] text-themeredred mt-1">
                            Password must be at least 12 characters
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </UserCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Right-click / long-press context menu */}
      {contextMenu && (() => {
        const contextUser = users.find((u) => u.id === contextMenu.userId)
        if (!contextUser) return null
        return (
          <CardContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={buildContextMenuItems(contextUser)}
          />
        )
      })()}

      {/* Single-user delete confirmation */}
      <ConfirmDialog
        visible={!!confirmDeleteId}
        title={`Delete ${deleteTargetUser?.first_name || ''} ${deleteTargetUser?.last_name || ''}?`}
        subtitle="This will permanently remove the user and all associated data. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={() => {
          if (confirmDeleteId) handleDeleteUser(confirmDeleteId)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
