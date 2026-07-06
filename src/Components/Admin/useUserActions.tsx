/**
 * useUserActions — the ONE source of truth for the admin user context/action
 * menu. Both the Directory tree (AdminSummary, lifted-row menu) and the user
 * detail (AdminUserDetail, corner OverlayActionMenu) build their user actions
 * from `buildItems` here, so the two surfaces stay in lockstep by construction
 * ("same things whether from the detail view or the tree").
 *
 * The hook owns every stateful flow the operational actions need — the
 * reset-password popover + confirm, the force-logout confirm, the "no vault
 * yet" guard, and the shared notify toast — and returns them as one `overlays`
 * node the caller drops into its tree. Callers only supply the list-nav
 * actions (View/Edit/Delete) that make sense for their surface.
 */

import { useCallback, useState, type ReactNode } from 'react'
import { KeyRound, LogOut, Mail, MessageSquare, Eye, Pencil, Trash2, Check, RefreshCw } from 'lucide-react'
import { forceLogoutUser } from '../../lib/adminService'
import type { AdminUser } from '../../lib/adminService'
import { buildMailtoHref } from '../../lib/mailto'
import { useResetPasswordFlow } from '../../Hooks/useResetPasswordFlow'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { PasswordInput } from '@/Components/primitives/FormInputs'
import { Z } from '@/Components/primitives/BaseOverlay'
import { UI_TIMING } from '../../Utilities/constants'

const userName = (u: AdminUser | null): string =>
  u ? ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'user') : 'user'

interface UseUserActionsArgs {
  /** Excludes the acting admin from their own menu (self-actions are nonsense). */
  currentUserId: string | null
  /** Open an in-app system conversation (dev-gated by the caller — passed only
   *  for dev role). Absent ⇒ the Message action is omitted. */
  onOpenConversation?: (userId: string) => void
}

interface BuildOpts {
  /** Where the reset-password popover anchors — the pill rect (detail) or the
   *  lifted row rect (tree). Resolved lazily at click time so it isn't stale. */
  resetAnchor?: () => DOMRect | null
  /** List-nav actions — supply only what the surface needs. The tree passes all
   *  three; the detail (already showing the user) passes only onDelete. */
  onView?: (user: AdminUser) => void
  onEdit?: (user: AdminUser) => void
  onDelete?: (user: AdminUser) => void
}

export function useUserActions({ currentUserId, onOpenConversation }: UseUserActionsArgs) {
  const messagesCtx = useMessagesContext()
  const resetPw = useResetPasswordFlow()
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [resetPwUser, setResetPwUser] = useState<AdminUser | null>(null)
  const [resetPwAnchor, setResetPwAnchor] = useState<DOMRect | null>(null)
  const [vaultMissingUser, setVaultMissingUser] = useState<AdminUser | null>(null)
  const [forceLogoutTarget, setForceLogoutTarget] = useState<AdminUser | null>(null)
  const [forceLogoutProcessing, setForceLogoutProcessing] = useState(false)

  const openResetPassword = useCallback((user: AdminUser, rect: DOMRect | null) => {
    setResetPwUser(user)
    resetPw.reset()
    setResetPwAnchor(rect)
  }, [resetPw])

  const closeResetPassword = useCallback(() => {
    setResetPwAnchor(null)
    resetPw.reset()
  }, [resetPw])

  const handleResetConfirm = useCallback(async () => {
    const result = await resetPw.submit()
    const name = userName(resetPwUser)
    if (result.success) {
      setResetPwAnchor(null)
      setNotify({ type: 'success', message: `Password reset for ${name}.` })
    } else {
      setNotify({ type: 'error', message: result.error || `Failed to reset password for ${name}` })
    }
  }, [resetPw, resetPwUser])

  const handleForceLogout = useCallback(async () => {
    const target = forceLogoutTarget
    if (!target) return
    setForceLogoutTarget(null)
    setForceLogoutProcessing(true)
    const result = await forceLogoutUser(target.id)
    setForceLogoutProcessing(false)
    const name = userName(target)
    if (result.success) {
      setNotify({
        type: 'success',
        message: `Force logout ${name}: ${result.sessionsDeleted} session(s), ${result.devicesDeleted} device(s), ${result.bundlesDeleted} key bundle(s) cleared`,
      })
    } else {
      setNotify({ type: 'error', message: result.error || `Failed to force logout ${name}` })
    }
  }, [forceLogoutTarget])

  /** Build the user's context-menu items. Identical Email / Message / Reset /
   *  Force-logout tail on every surface; View/Edit/Delete gate on `opts`. */
  const buildItems = useCallback((user: AdminUser, opts: BuildOpts = {}): ContextMenuItem[] => {
    if (user.id === currentUserId) return []
    const items: ContextMenuItem[] = []
    if (opts.onView) items.push({ key: 'view', label: 'View', icon: Eye, onAction: () => opts.onView!(user) })
    if (opts.onEdit) items.push({ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => opts.onEdit!(user) })
    if (user.email) {
      items.push({
        key: 'email',
        label: 'Email user',
        icon: Mail,
        href: buildMailtoHref({ to: user.email, subject: '[inquiry] -  Medical Operations Web Application', body: `${[user.rank, user.last_name].filter(Boolean).join(' ')},\n\n` }),
      })
    }
    if (messagesCtx && onOpenConversation) {
      items.push({
        key: 'message',
        label: 'Message user',
        icon: MessageSquare,
        onAction: () => {
          // No sign-in yet ⇒ no message vault exists to deliver to.
          if (!user.last_active_at) { setVaultMissingUser(user); return }
          onOpenConversation(user.id)
        },
      })
    }
    items.push({
      key: 'reset-pw',
      label: 'Reset password',
      icon: KeyRound,
      onAction: () => openResetPassword(user, opts.resetAnchor?.() ?? null),
    })
    items.push({
      key: 'force-logout',
      label: forceLogoutProcessing ? 'Logging out' : 'Force logout',
      icon: LogOut,
      variant: forceLogoutProcessing ? 'disabled' : 'default',
      onAction: () => setForceLogoutTarget(user),
    })
    if (opts.onDelete) items.push({ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => opts.onDelete!(user) })
    return items
  }, [currentUserId, messagesCtx, onOpenConversation, openResetPassword, forceLogoutProcessing])

  const overlays: ReactNode = (
    <>
      {/* Reset-password popover — anchored to the pill (detail) or row (tree). */}
      <PreviewOverlay
        isOpen={!!resetPwAnchor}
        onClose={closeResetPassword}
        anchorRect={resetPwAnchor}
        title="Reset password"
        maxWidth={340}
        rightFooter={
          resetPwAnchor && resetPwUser ? (
            <ActionPill shadow="sm">
              <ActionButton
                icon={resetPw.processing ? RefreshCw : Check}
                label={resetPw.processing ? 'Submitting…' : 'Reset password'}
                variant={resetPw.processing || resetPw.value.length < 12 ? 'disabled' : 'success'}
                onClick={() => resetPwUser && resetPw.requestConfirm(resetPwUser.id)}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {resetPwAnchor && resetPwUser && (
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

      <ConfirmDialog
        visible={!!resetPw.confirmingUserId}
        title={`Reset password for ${userName(resetPwUser)}?`}
        subtitle="The new password takes effect immediately. The user is not notified."
        confirmLabel="Reset"
        variant="danger"
        processing={resetPw.processing}
        onConfirm={handleResetConfirm}
        onCancel={resetPw.cancelConfirm}
        zIndex={Z.POPOVER + 30}
      />

      <ConfirmDialog
        visible={!!forceLogoutTarget}
        title={`Force logout ${userName(forceLogoutTarget)}?`}
        subtitle="Clears all sessions, device registrations, and Signal key bundles. The user must re-authenticate and re-register on every device."
        confirmLabel="Force Logout"
        variant="warning"
        processing={forceLogoutProcessing}
        onConfirm={handleForceLogout}
        onCancel={() => setForceLogoutTarget(null)}
      />

      <ConfirmDialog
        visible={!!vaultMissingUser}
        notifyOnly
        variant="warning"
        title="No vault yet"
        subtitle={`${userName(vaultMissingUser)} hasn't signed in yet, so no message vault exists. They need to sign in once before they can receive system messages.`}
        onCancel={() => setVaultMissingUser(null)}
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

  return { buildItems, overlays }
}
