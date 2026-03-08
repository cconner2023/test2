/**
 * AdminUsersList -- swipeable card list for managing user accounts.
 *
 * Displays all users with search/filter support, swipe-to-reveal actions,
 * right-click context menus, and multi-select batch operations. Follows the
 * same card patterns established in SessionsDevicesPanel.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, Search, UserPlus, Pencil, KeyRound, Trash2, LogOut } from 'lucide-react'
import { SwipeableCard, type SwipeAction } from '../SwipeableCard'
import { CardContextMenu } from '../CardContextMenu'
import { CardActionBar } from '../CardActionBar'
import { ConfirmDialog } from '../ConfirmDialog'
import { UserAvatar } from '../Settings/UserAvatar'
import { LoadingSpinner } from '../LoadingSpinner'
import { StatusBanner } from '../Settings/StatusBanner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import {
  formatLastActive,
  lastActiveColor,
  RoleBadge,
  CertBadges,
} from './adminUtils'
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
  /** When set, auto-filter to just this user (from tree selection) */
  filterUserId?: string | null
}

// ─── Component ───────────────────────────────────────────────────────────

export function AdminUsersList({
  onSelectUser,
  onEditUser,
  onCreateUser,
  filterUserId,
}: AdminUsersListProps) {
  // Data
  const [users, setUsers] = useState<AdminUser[]>([])
  const [_clinics, setClinics] = useState<AdminClinic[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Current user ID (to prevent self-deletion / self-logout)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Swipe / selection state
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const multiSelectMode = selectedUserIds.size > 0

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

  // Batch confirm dialog
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)
  const [confirmBatchLogout, setConfirmBatchLogout] = useState(false)

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

    // If a specific user is selected from the tree, show only that user
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

  /** Batch delete all selected users */
  const handleBatchDelete = useCallback(async () => {
    setConfirmBatchDelete(false)
    const ids = [...selectedUserIds]
    setSelectedUserIds(new Set())

    let successCount = 0
    let failCount = 0
    for (const id of ids) {
      const result = await deleteUser(id)
      if (result.success) successCount++
      else failCount++
    }

    if (failCount === 0) {
      setFeedback({ type: 'success', message: `${successCount} user(s) deleted` })
    } else {
      setFeedback({
        type: 'error',
        message: `${successCount} deleted, ${failCount} failed`,
      })
    }
    await loadUsers()
  }, [selectedUserIds, loadUsers])

  /** Batch force-logout all selected users */
  const handleBatchLogout = useCallback(async () => {
    setConfirmBatchLogout(false)
    const ids = [...selectedUserIds]
    setSelectedUserIds(new Set())

    let successCount = 0
    let failCount = 0
    for (const id of ids) {
      const result = await forceLogoutUser(id)
      if (result.success) successCount++
      else failCount++
    }

    if (failCount === 0) {
      setFeedback({ type: 'success', message: `${successCount} user(s) logged out` })
    } else {
      setFeedback({
        type: 'error',
        message: `${successCount} logged out, ${failCount} failed`,
      })
    }
  }, [selectedUserIds])

  // ─── Helpers ───────────────────────────────────────────────────────────

  const isSelf = (userId: string) => userId === currentUserId

  /** Build swipe actions for a given user */
  const buildSwipeActions = useCallback(
    (user: AdminUser): SwipeAction[] => {
      if (isSelf(user.id)) return []
      return [
        {
          key: 'edit',
          label: 'Edit',
          icon: Pencil,
          iconBg: 'bg-themeblue2/15',
          iconColor: 'text-themeblue2',
          onAction: () => onEditUser(user),
        },
        {
          key: 'reset',
          label: 'Reset',
          icon: KeyRound,
          iconBg: 'bg-themeyellow/15',
          iconColor: 'text-themeyellow',
          onAction: () => {
            setResetPwUserId(user.id)
            setResetPwValue('')
          },
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          iconBg: 'bg-themeredred/15',
          iconColor: 'text-themeredred',
          onAction: () => setConfirmDeleteId(user.id),
        },
      ]
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, onEditUser],
  )

  /** Build right-click context menu items for a given user */
  const buildContextMenuItems = useCallback(
    (user: AdminUser) => {
      if (isSelf(user.id)) return []
      return [
        {
          key: 'edit',
          label: 'Edit',
          icon: Pencil,
          onAction: () => onEditUser(user),
        },
        {
          key: 'reset',
          label: 'Reset Password',
          icon: KeyRound,
          onAction: () => {
            setResetPwUserId(user.id)
            setResetPwValue('')
          },
        },
        {
          key: 'logout',
          label: 'Force Logout',
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
    [currentUserId, onEditUser, handleForceLogout],
  )

  /** Handle a tap on a user card */
  const handleCardTap = useCallback(
    (user: AdminUser) => {
      // Multi-select mode: toggle selection
      if (multiSelectMode) {
        setSelectedUserIds((prev) => {
          const next = new Set(prev)
          if (next.has(user.id)) next.delete(user.id)
          else next.add(user.id)
          return next
        })
        return
      }

      // First tap on a non-self user: select (shows action bar)
      if (!isSelf(user.id)) {
        setOpenSwipeId(null)
        const isTogglingOff = selectedUserIds.has(user.id)
        setSelectedUserIds(isTogglingOff ? new Set() : new Set([user.id]))
        return
      }

      // Self user: navigate to detail view
      onSelectUser(user)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [multiSelectMode, selectedUserIds, currentUserId, onSelectUser],
  )

  // ─── Render ────────────────────────────────────────────────────────────

  // Resolve the user targeted by the delete confirmation dialog
  const deleteTargetUser = confirmDeleteId
    ? users.find((u) => u.id === confirmDeleteId)
    : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header: subtitle + create button */}
      <div className="shrink-0 px-5 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-tertiary/60">Manage user accounts</p>
          <button
            onClick={onCreateUser}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themegreen text-white text-sm font-medium hover:bg-themegreen/90 transition-colors"
          >
            <UserPlus size={14} /> Create User
          </button>
        </div>

        {/* Feedback banner */}
        {feedback && <StatusBanner type={feedback.type} message={feedback.message} />}

        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary/40"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or UIC..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-sm
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30"
          />
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {showLoading ? (
          <LoadingSpinner label="Loading users..." className="py-12 text-tertiary" />
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-tertiary/60">
              {searchQuery ? 'No users match your search' : 'No users found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredUsers.map((user) => {
              const userCerts = certsByUser.get(user.id) || []
              const isSelected = selectedUserIds.has(user.id)
              const canSwipe = !isSelf(user.id)
              const swipeActions = buildSwipeActions(user)

              return (
                <SwipeableCard
                  key={user.id}
                  isOpen={openSwipeId === user.id}
                  enabled={canSwipe && !multiSelectMode}
                  actions={swipeActions}
                  onOpen={() => setOpenSwipeId(user.id)}
                  onClose={() => {
                    if (openSwipeId === user.id) setOpenSwipeId(null)
                  }}
                  onTap={() => handleCardTap(user)}
                  onContextMenu={
                    canSwipe
                      ? (e) => {
                          e.preventDefault()
                          setContextMenu({
                            userId: user.id,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                      : undefined
                  }
                >
                  <div
                    className={`rounded-xl border px-4 py-3.5 transition-colors space-y-2 ${
                      isSelected
                        ? 'border-themeblue2/30 bg-themeblue2/5'
                        : 'border-tertiary/15 bg-themewhite2'
                    }`}
                  >
                    {/* Row 1: Avatar / check + name + credential + last active + roles */}
                    <div className="flex items-center gap-3">
                      {/* Left: Avatar or selection check */}
                      {isSelected ? (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2">
                          <Check size={16} className="text-white" />
                        </div>
                      ) : (
                        <UserAvatar
                          avatarId={user.avatar_id}
                          firstName={user.first_name}
                          lastName={user.last_name}
                          className="w-9 h-9"
                        />
                      )}

                      {/* Center: Name, credential, last-active */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">
                          {user.first_name || ''} {user.middle_initial || ''}{' '}
                          {user.last_name || ''}
                        </p>
                        <div className="flex items-center gap-2">
                          {user.credential && (
                            <p className="text-[9pt] text-tertiary/50">{user.credential}</p>
                          )}
                          <span className="flex items-center gap-1 text-[9pt] text-tertiary/50">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${lastActiveColor(user.last_active_at)}`}
                            />
                            {formatLastActive(user.last_active_at)}
                          </span>
                        </div>
                      </div>

                      {/* Right: Role badges */}
                      <div className="flex gap-1 shrink-0">
                        {user.roles?.map((role) => (
                          <RoleBadge key={role} role={role} />
                        ))}
                      </div>
                    </div>

                    {/* Row 2: Cert badges (non-primary only; primary is already shown as credential) */}
                    {userCerts.filter(c => !c.is_primary).length > 0 && (
                      <CertBadges certs={userCerts.filter(c => !c.is_primary)} />
                    )}

                    {/* UIC badge */}
                    {user.uic && (
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30">
                          {user.uic}
                        </span>
                      </div>
                    )}

                    {/* Inline: Reset password form (shown under this card) */}
                    {resetPwUserId === user.id && (
                      <div
                        className="p-3 bg-themeyellow/10 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-sm text-themeyellow font-medium mb-2">
                          Set new password:
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={resetPwValue}
                            onChange={(e) => setResetPwValue(e.target.value)}
                            placeholder="New password (min 12 chars)..."
                            className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeyellow/30 text-sm
                                       focus:border-themeyellow focus:outline-none transition-colors placeholder:text-tertiary/30"
                          />
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            disabled={resetPwProcessing || resetPwValue.length < 12}
                            className="px-3 py-2 rounded-lg bg-themeyellow text-white text-sm font-medium hover:bg-themeyellow/90 disabled:opacity-50"
                          >
                            {resetPwProcessing ? 'Resetting...' : 'Reset'}
                          </button>
                          <button
                            onClick={() => {
                              setResetPwUserId(null)
                              setResetPwValue('')
                            }}
                            className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                        {resetPwValue.length > 0 && resetPwValue.length < 12 && (
                          <p className="text-xs text-themeredred mt-1">
                            Password must be at least 12 characters
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </SwipeableCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Multi-select action bar — pinned at bottom, outside scroll */}
      {multiSelectMode && (
        <div className="shrink-0">
          <CardActionBar
            selectedCount={selectedUserIds.size}
            onClear={() => setSelectedUserIds(new Set())}
            actions={[
              {
                key: 'logout',
                label: 'Logout',
                icon: LogOut,
                iconBg: 'bg-themeyellow/15',
                iconColor: 'text-themeyellow',
                onAction: () => setConfirmBatchLogout(true),
              },
              {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                iconBg: 'bg-themeredred/15',
                iconColor: 'text-themeredred',
                onAction: () => setConfirmBatchDelete(true),
              },
            ]}
          />
        </div>
      )}

      {/* Right-click context menu */}
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

      {/* Batch delete confirmation */}
      <ConfirmDialog
        visible={confirmBatchDelete}
        title={`Delete ${selectedUserIds.size} user(s)?`}
        subtitle="This will permanently remove all selected users and their associated data."
        confirmLabel="Delete All"
        variant="danger"
        onConfirm={handleBatchDelete}
        onCancel={() => setConfirmBatchDelete(false)}
      />

      {/* Batch force-logout confirmation */}
      <ConfirmDialog
        visible={confirmBatchLogout}
        title={`Force logout ${selectedUserIds.size} user(s)?`}
        subtitle="This will clear all sessions, devices, and key bundles for the selected users."
        confirmLabel="Logout All"
        variant="warning"
        onConfirm={handleBatchLogout}
        onCancel={() => setConfirmBatchLogout(false)}
      />
    </div>
  )
}
