import { useState, useEffect, useCallback, useMemo } from 'react'
import { UserPlus, Pencil, KeyRound, Trash2, LogOut, Eye, Check, X, Mail } from 'lucide-react'
import { UserRow } from '../UserRow'
import { EmptyState } from '../EmptyState'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { LoadingSpinner } from '../LoadingSpinner'
import { ErrorDisplay } from '../ErrorDisplay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useLongPress } from '../../Hooks/useLongPress'
import { formatLastActive, RoleBadge } from './adminUtils'
import {
  listAllUsers,
  deleteUser,
  resetUserPassword,
  forceLogoutUser,
} from '../../lib/adminService'
import type { AdminUser } from '../../lib/adminService'
import { useAuthStore } from '../../stores/useAuthStore'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { UI_TIMING } from '../../Utilities/constants'

// ─── Public Interface ────────────────────────────────────────────────────

export interface AdminUsersListProps {
  onSelectUser: (user: AdminUser) => void
  onEditUser: (user: AdminUser) => void
  onCreateUser: () => void
  filterUserId?: string | null
  searchQuery?: string
  /** When true, renders items without wrapper chrome (for unified search results) */
  bare?: boolean
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
      className="cursor-pointer"
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
  bare,
}: AdminUsersListProps) {
  const searchQuery = searchQueryProp ?? ''
  const gen = useInvalidation('users')
  const currentUser = useAuthStore(s => s.user)

  // Data
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)

  // Current user ID (to prevent self-deletion / self-logout)
  const currentUserId = currentUser?.id ?? null

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
    const userData = await listAllUsers()
    setUsers(userData)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers, gen])

  // ─── Derived Data ──────────────────────────────────────────────────────

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
        setFeedback({ type: 'success', message: 'Deleted.' })
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
        setFeedback({ type: 'success', message: 'Password reset.' })
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
        ...(user.email ? [{
          key: 'email',
          label: 'Email User',
          icon: Mail,
          onAction: () => { window.location.href = `mailto:${user.email}?subject=${encodeURIComponent('ADTMC Web App Inquiry')}&body=${encodeURIComponent(`${[user.rank, user.last_name].filter(Boolean).join(' ')},\n\n`)}` },
        }] : []),
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

  // ── Shared: render user row items ──────────────────────
  const renderUserItems = () => filteredUsers.map((user) => (
      <UserCard
        key={user.id}
        user={user}
        onTap={() => onSelectUser(user)}
        onContextMenu={(x, y) => setContextMenu({ userId: user.id, x, y })}
      >
        <UserRow
          avatarId={user.avatar_id}
          firstName={user.first_name}
          lastName={user.last_name}
          middleInitial={user.middle_initial}
          rank={user.rank}
          lastActiveAt={user.last_active_at}
          subtitle={[user.credential, user.uic, user.clinic_name, user.email].filter(Boolean).join(' · ')}
          meta={user.roles?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {user.roles.map(r => <RoleBadge key={r} role={r} />)}
            </div>
          )}
          right={<span className="text-[9pt] text-tertiary/50 shrink-0">{formatLastActive(user.last_active_at)}</span>}
        />

        {resetPwUserId === user.id && (
          <div className="px-4 pb-3.5 bg-tertiary/5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={resetPwValue}
                onChange={(e) => setResetPwValue(e.target.value)}
                placeholder="New password (min 12 chars)..."
                className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeyellow/30 text-sm focus:border-themeblue2 focus:outline-none transition-colors"
              />
              <button
                onClick={() => handleResetPassword(user.id)}
                disabled={resetPwProcessing || resetPwValue.length < 12}
                className="shrink-0 w-10 h-10 rounded-full bg-themeyellow text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                aria-label="Reset password"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => { setResetPwUserId(null); setResetPwValue('') }}
                className="shrink-0 w-10 h-10 rounded-full text-tertiary flex items-center justify-center active:scale-95 transition-all"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
            {resetPwValue.length > 0 && resetPwValue.length < 12 && (
              <p className="text-xs font-normal text-themeredred mt-1.5">Minimum 12 characters.</p>
            )}
          </div>
        )}
      </UserCard>
    )
  )

  // ── Shared: overlays (context menu + confirm dialog) ──
  const renderOverlays = () => (
    <>
      {contextMenu && (() => {
        const contextUser = users.find((u) => u.id === contextMenu.userId)
        if (!contextUser) return null
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={buildContextMenuItems(contextUser)}
          />
        )
      })()}

      <ConfirmDialog
        visible={!!confirmDeleteId}
        title={`Delete ${deleteTargetUser?.first_name || ''} ${deleteTargetUser?.last_name || ''}?`}
        subtitle="Permanent. All associated data removed."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={() => {
          if (confirmDeleteId) handleDeleteUser(confirmDeleteId)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  )

  // ── Bare mode: just the items (no wrapper chrome) ──────
  if (bare) {
    if (filteredUsers.length === 0) return null
    return (
      <>
        {renderUserItems()}
        {renderOverlays()}
      </>
    )
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-4 pb-2 space-y-5">
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
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {renderUserItems()}
          </div>
        )}
      </div>

      {renderOverlays()}
    </div>
  )
}
