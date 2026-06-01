import { useState, useEffect, useCallback, useMemo } from 'react'
import { Pencil, KeyRound, Trash2, LogOut, Eye, Mail } from 'lucide-react'
import { UserRow } from '../UserRow'
import { EmptyState } from '../EmptyState'
import { SectionCard } from '../Section'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { AdminListSkeleton } from './AdminSkeletons'
import { ResetPasswordForm } from './ResetPasswordForm'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useLongPress } from '../../Hooks/useLongPress'
import { useResetPasswordFlow } from '../../Hooks/useResetPasswordFlow'
import { formatLastActive, RoleBadge, SupervisorCreatedBadge } from './adminUtils'
import {
  listAllUsers,
  deleteUser,
  forceLogoutUser,
} from '../../lib/adminService'
import type { AdminUser } from '../../lib/adminService'
import { useAuthStore } from '../../stores/useAuthStore'
import { useInvalidation, invalidate } from '../../stores/useInvalidationStore'
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
  const { isPressing, ...longPressHandlers } = useLongPress((x, y) => onContextMenu(x, y))
  const label = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'user'

  return (
    <div
      key={user.id}
      role="button"
      tabIndex={0}
      aria-label={`Open ${label}`}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap()
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
      {...longPressHandlers}
      className={`cursor-pointer transition-opacity duration-100 ${isPressing ? 'opacity-60' : ''}`}
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
  const resetPw = useResetPasswordFlow()

  // Confirm dialog
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // Force logout confirm
  const [confirmLogoutId, setConfirmLogoutId] = useState<string | null>(null)
  const [logoutProcessing, setLogoutProcessing] = useState(false)

  // Notify modal
  const [notify, setNotify] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

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
        u.uic?.toLowerCase().includes(q) ||
        u.clinic_name?.toLowerCase().includes(q) ||
        u.surrogate_clinic_name?.toLowerCase().includes(q),
    )
  }, [users, searchQuery, filterUserId])

  /** Users grouped by clinic (cluster). Used when no search/filter is active. */
  const groupedUsers = useMemo(() => {
    const groups = new Map<string, AdminUser[]>()
    for (const u of filteredUsers) {
      const key = u.clinic_name ?? '__unassigned__'
      const arr = groups.get(key)
      if (arr) arr.push(u)
      else groups.set(key, [u])
    }
    const entries = [...groups.entries()]
    entries.sort(([a], [b]) => {
      if (a === '__unassigned__') return 1
      if (b === '__unassigned__') return -1
      return a.localeCompare(b)
    })
    return entries
  }, [filteredUsers])

  const useGrouping = !searchQuery && !filterUserId && !bare

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleDeleteUser = useCallback(
    async (userId: string) => {
      const target = users.find(u => u.id === userId)
      const targetName = [target?.first_name, target?.last_name].filter(Boolean).join(' ') || target?.email || 'user'
      setDeleteProcessing(true)
      const result = await deleteUser(userId)
      setDeleteProcessing(false)
      setConfirmDeleteId(null)

      if (result.success) {
        setNotify({ type: 'success', message: `Deleted ${targetName}.` })
        // Bust the listAllUsers cache and refetch (the gen bump re-runs the
        // loadUsers effect here and in every other mounted admin surface).
        // Mirrors AdminDrawer.handleDeleteUser — a delete also clears the user's
        // clinic membership and any account_requests.
        invalidate('users', 'clinics', 'requests')
      } else {
        setNotify({
          type: 'error',
          message: result.error || `Failed to delete ${targetName}`,
        })
      }
    },
    [users],
  )

  const handleResetPasswordConfirm = useCallback(async () => {
    const targetId = resetPw.confirmingUserId
    const target = targetId ? users.find(u => u.id === targetId) : null
    const targetName = [target?.first_name, target?.last_name].filter(Boolean).join(' ') || target?.email || 'user'
    const result = await resetPw.submit()
    if (result.success) {
      setResetPwUserId(null)
      setNotify({ type: 'success', message: `Password reset for ${targetName}.` })
    } else {
      setNotify({
        type: 'error',
        message: result.error || `Failed to reset password for ${targetName}`,
      })
    }
  }, [resetPw, users])

  const handleForceLogout = useCallback(async (userId: string) => {
    setLogoutProcessing(true)
    const result = await forceLogoutUser(userId)
    setLogoutProcessing(false)
    setConfirmLogoutId(null)

    if (result.success) {
      setNotify({
        type: 'success',
        message: `Force logout complete: ${result.sessionsDeleted} session(s), ${result.devicesDeleted} device(s), ${result.bundlesDeleted} key bundle(s) cleared`,
      })
    } else {
      setNotify({
        type: 'error',
        message: result.error || 'Failed to force logout user',
      })
    }
  }, [])

  // ─── Helpers ───────────────────────────────────────────────────────────

  /** Build right-click / long-press context menu items for a given user */
  const buildContextMenuItems = useCallback(
    (user: AdminUser): ContextMenuItem[] => {
      if (user.id === currentUserId) return []
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
          onAction: () => { window.open(`mailto:${user.email}?subject=${encodeURIComponent('Beacon Inquiry')}&body=${encodeURIComponent(`${[user.rank, user.last_name].filter(Boolean).join(' ')},\n\n`)}`) },
        }] : []),
        {
          key: 'changepw',
          label: 'Change Password',
          icon: KeyRound,
          onAction: () => {
            setResetPwUserId(user.id)
            resetPw.reset()
          },
        },
        {
          key: 'logout',
          label: 'Log Out',
          icon: LogOut,
          onAction: () => setConfirmLogoutId(user.id),
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
    [currentUserId, onEditUser, onSelectUser, resetPw],
  )

  // ─── Render ────────────────────────────────────────────────────────────

  const deleteTargetUser = confirmDeleteId
    ? users.find((u) => u.id === confirmDeleteId)
    : null

  const logoutTargetUser = confirmLogoutId
    ? users.find((u) => u.id === confirmLogoutId)
    : null

  // ── Shared: render a single user row ──────────────────
  // ResetPasswordForm renders as a SIBLING of UserCard, not a child — nesting
  // form inputs inside a role="button" element breaks focus on mobile and
  // misannounces to screen readers.
  const renderUserRow = (user: AdminUser) => (
    <div key={user.id}>
      <UserCard
        user={user}
        onTap={() => onSelectUser(user)}
        onContextMenu={(x, y) => setContextMenu({ userId: user.id, x, y })}
      >
        <UserRow
          avatarId={user.avatar_id}
          avatarBlob={user.avatar_blob}
          userId={user.id}
          firstName={user.first_name}
          lastName={user.last_name}
          middleInitial={user.middle_initial}
          rank={user.rank}
          lastActiveAt={user.last_active_at}
          subtitle={[user.credential, user.uic, user.clinic_name, user.email].filter(Boolean).join(' · ')}
          meta={(user.roles?.length > 0 || user.supervisor_created) && (
            <div className="flex flex-wrap items-center gap-1">
              {user.roles.map(r => <RoleBadge key={r} role={r} />)}
              {user.supervisor_created && <SupervisorCreatedBadge />}
            </div>
          )}
          right={<span className="text-[9pt] text-tertiary/50 shrink-0">{formatLastActive(user.last_active_at)}</span>}
        />
      </UserCard>

      {resetPwUserId === user.id && (
        <ResetPasswordForm
          value={resetPw.value}
          onChange={resetPw.setValue}
          onSubmit={() => resetPw.requestConfirm(user.id)}
          onCancel={() => { setResetPwUserId(null); resetPw.reset() }}
          processing={resetPw.processing}
        />
      )}
    </div>
  )

  const renderUserItems = () => filteredUsers.map(renderUserRow)

  const renderGroupedUsers = () => groupedUsers.map(([key, list]) => (
    <section key={key} className="space-y-1.5">
      <p className="px-1 text-[9pt] font-semibold text-tertiary uppercase tracking-widest">
        {key === '__unassigned__' ? 'Unassigned' : key}
      </p>
      <SectionCard>
        {list.map(renderUserRow)}
      </SectionCard>
    </section>
  ))

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
        title={`Delete ${[deleteTargetUser?.first_name, deleteTargetUser?.last_name].filter(Boolean).join(' ') || 'user'}?`}
        subtitle="Permanent. All associated data removed."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={() => {
          if (confirmDeleteId) handleDeleteUser(confirmDeleteId)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmDialog
        visible={!!resetPw.confirmingUserId}
        title={`Reset password for ${(() => {
          const u = users.find(u => u.id === resetPw.confirmingUserId)
          return [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'this user'
        })()}?`}
        subtitle="The new password takes effect immediately. The user is not notified."
        confirmLabel="Reset"
        variant="danger"
        processing={resetPw.processing}
        onConfirm={handleResetPasswordConfirm}
        onCancel={resetPw.cancelConfirm}
      />

      <ConfirmDialog
        visible={!!confirmLogoutId}
        title={`Force logout ${[logoutTargetUser?.first_name, logoutTargetUser?.last_name].filter(Boolean).join(' ') || 'user'}?`}
        subtitle="Clears all sessions, device registrations, and Signal key bundles. The user must re-authenticate and re-register on every device."
        confirmLabel="Force Logout"
        variant="warning"
        processing={logoutProcessing}
        onConfirm={() => {
          if (confirmLogoutId) handleForceLogout(confirmLogoutId)
        }}
        onCancel={() => setConfirmLogoutId(null)}
      />

      <ConfirmDialog
        visible={!!notify}
        title={notify?.message ?? ''}
        variant={notify?.type === 'success' ? 'success' : 'danger'}
        notifyOnly
        autoDismissMs={UI_TIMING.FEEDBACK_DURATION}
        onCancel={() => setNotify(null)}
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
      <div className="px-5 pt-4 pb-4">
        {showLoading ? (
          <AdminListSkeleton />
        ) : filteredUsers.length === 0 ? (
          <EmptyState title={searchQuery ? 'No users match your search.' : 'No users'} />
        ) : useGrouping ? (
          <div className="space-y-4">{renderGroupedUsers()}</div>
        ) : (
          <SectionCard>
            {renderUserItems()}
          </SectionCard>
        )}
      </div>

      {renderOverlays()}
    </div>
  )
}
