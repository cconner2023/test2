/**
 * AdminUserDetail -- detailed view for a single user in the admin panel.
 *
 * Displays profile header, metadata grid, certifications, and admin
 * actions (email, reset password, force logout) as an ActionPill in
 * the user-card corner. Edit is inline via the Settings-pattern
 * toolbar (editing/saveRequested props). Delete lives in the header.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KeyRound, LogOut, Building2, ChevronRight, Mail, Check, RefreshCw, X, Trash2, Home, Plus, ArrowRightLeft, MessageSquare } from 'lucide-react'
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
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { OverlayActionMenu } from '../OverlayActionMenu'
import { formatLastActive, RoleBadge, SupervisorCreatedBadge } from './adminUtils'
import { StepResults, type StepResult } from './StepResults'
import { useResetPasswordFlow } from '../../Hooks/useResetPasswordFlow'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { SystemMessageComposePopover } from './SystemMessageComposePopover'
import { drainSystemInbox } from '../../lib/signal/systemIdentity'
import { createLogger } from '../../Utilities/Logger'

const systemInboxLogger = createLogger('AdminUserSystemInbox')
import {
  listAllUsers,
  listClinics,
  forceLogoutUser,
  updateUserProfile,
  setUserRoles,
  setUserClinic,
  setUserLoans,
  listUserLoans,
  createUser,
  updateUserEmail,
  isValidEmail,
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { ClinicPickerInput } from './AdminPickers'
import { fetchAllCertifications } from '../../lib/certificationService'
import { useAuthStore } from '../../stores/useAuthStore'
import { UI_TIMING } from '../../Utilities/constants'
import { invalidate } from '../../stores/useInvalidationStore'
import { sameStringSet } from '../../Utilities/arrayEquals'

// ─── Types ────────────────────────────────────────────────────────────

interface AdminUserDetailProps {
  user: AdminUser | null
  onUserUpdated: (user: AdminUser) => void
  /** Receives an optimistic AdminUser built from the create form so the parent
   * can switch to view mode without a round-trip — AdminUserDetail.loadData
   * replaces it with the canonical record on the next refresh. */
  onCreated?: (user: AdminUser) => void
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
  /** Create-mode prefill — when launched from a cluster's "Create user"
   *  action, seeds editClinicId so the new user lands assigned to that
   *  cluster on save (setUserClinic runs after createUser in handleSave). */
  prefillClinicId?: string | null
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
  prefillClinicId,
}: AdminUserDetailProps) {
  const currentUser = useAuthStore(s => s.user)
  const currentUserId = currentUser?.id ?? null
  const isDevRole = useAuthStore(s => s.isDevRole)

  // Refresh the SYSTEM inbox on each user-detail open so replies from this
  // user surface in their thread immediately. AdminDrawer drains on open too;
  // this is the per-navigation freshness pass.
  useEffect(() => {
    if (!isDevRole || !user?.id) return
    drainSystemInbox().catch(e =>
      systemInboxLogger.warn('user-detail drain failed:', e instanceof Error ? e.message : e)
    )
  }, [isDevRole, user?.id])

  // ── Data state ──────────────────────────────────────────────────────
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])
  const [viewLoanClinicIds, setViewLoanClinicIds] = useState<string[]>([])

  // ── UI state ────────────────────────────────────────────────────────
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Reset password popover (anchored to KeyRound action button via pill ref)
  const pillRef = useRef<HTMLDivElement>(null)
  // Clusters "+ Add loan" FAB anchor
  const addLoanFabRef = useRef<HTMLDivElement>(null)
  const [resetPwAnchor, setResetPwAnchor] = useState<DOMRect | null>(null)
  const resetPw = useResetPasswordFlow()

  // System-message compose popover (dev-only). Reuses the same pillRef anchor
  // as the reset-password popover so it lands next to the other actions.
  const [sysMsgAnchor, setSysMsgAnchor] = useState<DOMRect | null>(null)
  const [vaultMissingOpen, setVaultMissingOpen] = useState(false)
  const messagesCtx = useMessagesContext()

  // Edit overlay — tap user card → PreviewOverlay anchored to card rect.
  const cardWrapperRef = useRef<HTMLDivElement>(null)
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null)

  // Force logout
  const [forceLogoutProcessing, setForceLogoutProcessing] = useState(false)
  const [confirmForceLogout, setConfirmForceLogout] = useState(false)

  // Clusters section — tap-to-overlay edit surface for home/loan. Replaces
  // the cluster pickers that used to live in the edit overlay.
  type ClusterAction =
    | { kind: 'loan-row'; x: number; y: number; clinic: AdminClinic }
    | { kind: 'home-row'; x: number; y: number; rect: DOMRect; clinic: AdminClinic }
    | { kind: 'pick-home'; rect: DOMRect }
    | { kind: 'add-loan'; rect: DOMRect }
  const [clusterAction, setClusterAction] = useState<ClusterAction | null>(null)
  const [clusterBusy, setClusterBusy] = useState(false)

  // ── Edit state ──────────────────────────────────────────────────────
  const [editEmail, setEditEmail] = useState('')
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
  // Per-step save outcomes. Persisted across retries so already-successful
  // steps are skipped — admin sees what stuck and only the failures re-run.
  const [stepResults, setStepResults] = useState<StepResult[]>([])

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
    const [userData, clinicData, certData, loanData] = await Promise.all([
      listAllUsers(),
      listClinics(),
      fetchAllCertifications(),
      user?.id ? listUserLoans(user.id) : Promise.resolve<string[]>([]),
    ])
    setClinics(clinicData)
    setAllCerts(certData)
    setViewLoanClinicIds(loanData)

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
    setStepResults([])
    onEditingChange(false)
  }, [onEditingChange])

  // ── Edit mode initialization (only on false→true transition) ─────────
  const prevEditingRef = useRef(false)
  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      setEditEmail(user?.email || '')
      setEditFirstName(user?.first_name || '')
      setEditLastName(user?.last_name || '')
      setEditMiddleInitial(user?.middle_initial || '')
      setEditCredential(user?.credential || '')
      setEditComponent(user?.component || '')
      setEditRank(user?.rank || '')
      setEditUic(user?.uic || '')
      // Create-mode: prefer prefillClinicId (launched from a cluster's
      // "Create user"); existing-user edit keeps the current assignment.
      setEditClinicId(user?.clinic_id || (user === null ? (prefillClinicId || '') : ''))
      setEditRoles(user?.roles?.filter(r => AVAILABLE_ROLES.includes(r as typeof AVAILABLE_ROLES[number])) ?? ['medic'])
      // Hydrate current loans for the multi-select. Goes through the dev
      // RPC so loans show even when caller doesn't share a clinic with target.
      if (user?.id) {
        listUserLoans(user.id).then((ids) => {
          const set = new Set<string>(ids)
          setEditLoanClinicIds(set)
          setOriginalLoanClinicIds(set)
        })
      } else {
        setEditLoanClinicIds(new Set())
        setOriginalLoanClinicIds(new Set())
      }

      setCreateEmail('')
      setCreatePassword('')
      setError(null)
      setStepResults([])
    }
    prevEditingRef.current = editing
  }, [editing, user, prefillClinicId])

  // ── Pending changes detection ────────────────────────────────────────
  useEffect(() => {
    if (!editing) { onPendingChangesChange?.(false); return }
    const sameLoans = editLoanClinicIds.size === originalLoanClinicIds.size
      && Array.from(editLoanClinicIds).every((id) => originalLoanClinicIds.has(id))
    const changed = editEmail !== (user?.email || '')
      || editFirstName !== (user?.first_name || '')
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
  }, [editing, editEmail, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editLoanClinicIds, originalLoanClinicIds, editRoles, user, onPendingChangesChange])

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
        const clinicName = editClinicId
          ? clinics.find(c => c.id === editClinicId)?.name ?? null
          : null
        // Optimistic — parent switches to view mode immediately. The detail
        // view's loadData refresh overwrites these fields with the canonical
        // record once the next listAllUsers lands.
        const optimistic: AdminUser = {
          id: result.userId,
          email: createEmail,
          first_name: editFirstName,
          last_name: editLastName,
          middle_initial: editMiddleInitial || null,
          credential: editCredential || null,
          component: editComponent || null,
          rank: editRank || null,
          uic: editUic || null,
          roles: chosenRoles,
          clinic_id: editClinicId || null,
          clinic_name: clinicName,
          surrogate_clinic_id: null,
          surrogate_clinic_name: null,
          created_at: new Date().toISOString(),
          last_active_at: null,
          avatar_id: null,
          supervisor_created: false,
        }
        onCreated?.(optimistic)
        invalidate('users', 'clinics')
      } else {
        setError(result.error || 'Failed to create user')
      }
      return
    }

    if (!user) return

    const trimmedEmail = editEmail.trim().toLowerCase()
    const emailChanged = trimmedEmail !== (user.email || '').toLowerCase()
    if (emailChanged && !isValidEmail(editEmail)) {
      setError('Enter a valid email address.')
      return
    }

    setSaving(true)
    setError(null)

    // Compute diff up front so the morphed overlay can pre-list every step
    // it intends to run as pending — admin sees the full plan before the
    // first await resolves, not just whatever has finished so far.
    const oldSorted = [...(user.roles || [])].sort().join(',')
    const newSorted = [...chosenRoles].sort().join(',')
    const rolesChanged = oldSorted !== newSorted

    const originalClinicId = user.clinic_id || ''
    const clinicChanged = editClinicId !== originalClinicId

    const sameLoans = editLoanClinicIds.size === originalLoanClinicIds.size
      && Array.from(editLoanClinicIds).every((id) => originalLoanClinicIds.has(id))
    const loansChanged = clinicChanged || !sameLoans

    const plan: StepResult[] = [
      { key: 'profile', label: 'Profile fields applied', ok: false, pending: true },
    ]
    if (emailChanged) {
      plan.push({ key: 'email', label: 'Email updated', ok: false, pending: true })
    }
    if (rolesChanged) {
      plan.push({ key: 'roles', label: `Roles set (${chosenRoles.join(', ')})`, ok: false, pending: true })
    }
    if (clinicChanged) {
      plan.push({
        key: 'clinic',
        label: editClinicId ? 'Cluster assignment updated' : 'Cluster assignment cleared',
        ok: false,
        pending: true,
      })
    }
    if (loansChanged) {
      plan.push({ key: 'loans', label: 'Loans updated', ok: false, pending: true })
    }

    // Carry forward already-succeeded steps from a prior partial save —
    // retry only re-runs the failures.
    const prior = stepResults
    const next: StepResult[] = plan.map(p => {
      const priorRow = prior.find(s => s.key === p.key)
      return priorRow?.ok ? priorRow : p
    })
    setStepResults([...next])

    const upsert = (r: StepResult) => {
      const idx = next.findIndex(s => s.key === r.key)
      if (idx >= 0) next[idx] = r
      else next.push(r)
      setStepResults([...next])
    }
    const alreadyOk = (key: string) => next.find(s => s.key === key)?.ok === true

    if (!alreadyOk('profile')) {
      const r = await updateUserProfile(user.id, {
        firstName: editFirstName || undefined,
        lastName: editLastName || undefined,
        middleInitial: editMiddleInitial,
        credential: editCredential,
        component: editComponent,
        rank: editRank,
        uic: editUic || undefined,
      })
      upsert({
        key: 'profile',
        label: 'Profile fields applied',
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Failed to update profile'),
      })
    }

    if (emailChanged && !alreadyOk('email')) {
      const r = await updateUserEmail(user.id, trimmedEmail)
      upsert({
        key: 'email',
        label: 'Email updated',
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Failed to update email'),
      })
    }

    if (rolesChanged && !alreadyOk('roles')) {
      const r = await setUserRoles(user.id, chosenRoles as ('medic' | 'supervisor' | 'dev' | 'provider')[])
      upsert({
        key: 'roles',
        label: `Roles set (${chosenRoles.join(', ')})`,
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Failed to update roles'),
      })
    }

    // DB trigger wipes loans when clinic_id changes — the loans step
    // re-applies the editor's selection (minus the new home) in that case.
    if (clinicChanged && !alreadyOk('clinic')) {
      const r = await setUserClinic(user.id, editClinicId || null)
      upsert({
        key: 'clinic',
        label: editClinicId ? 'Cluster assignment updated' : 'Cluster assignment cleared',
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Failed to update clinic'),
      })
    }

    if (loansChanged && !alreadyOk('loans')) {
      const loanIds = clinicChanged
        ? Array.from(editLoanClinicIds).filter((id) => id !== editClinicId)
        : Array.from(editLoanClinicIds)
      const r = await setUserLoans(user.id, loanIds)
      upsert({
        key: 'loans',
        label: loanIds.length === 0 ? 'Loans cleared' : `Loans set (${loanIds.length})`,
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Failed to update loans'),
      })
    }

    invalidate('users', 'clinics')

    const anyFailed = next.some(s => !s.ok)
    if (!anyFailed) {
      // Brief pause so the admin sees the all-green panel before the overlay
      // dismisses — confirms every step stuck.
      await new Promise(resolve => setTimeout(resolve, 600))
      setStepResults([])
      setSaving(false)
      onEditingChange(false)
      loadData()
      return
    }

    setSaving(false)
    // Partial failure — overlay reverts from modal mode to form+steps so the
    // admin can adjust and retry. The alreadyOk() guard skips the successes.
  }, [user, editEmail, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editLoanClinicIds, originalLoanClinicIds, editRoles, onEditingChange, loadData, isCreateMode, createEmail, createPassword, onCreated, stepResults])

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

  // ── Cluster mutations ──────────────────────────────────────────────────
  // All four go through the existing dev RPCs (setUserClinic, setUserLoans)
  // and then invalidate+reload. Promote-loan-to-home also clears the other
  // loans via the DB trigger on profiles.clinic_id change.
  const refreshClusters = useCallback(async () => {
    invalidate('users', 'clinics')
    await loadData()
  }, [loadData])

  // Swap semantics: setUserClinic fires a DB trigger that wipes every loan
  // for this user. To avoid losing the old home + existing loans on a home
  // change, capture them up front and re-apply via setUserLoans afterward
  // (minus newId, which is now the home).
  const handlePickHome = useCallback(async (newId: string) => {
    if (!user) return
    setClusterBusy(true)
    const oldHomeId = user.clinic_id
    const preservedLoans = viewLoanClinicIds
    const r = await setUserClinic(user.id, newId)
    if (r.success) {
      const nextLoans = [
        ...preservedLoans.filter(id => id !== newId),
        ...(oldHomeId && oldHomeId !== newId ? [oldHomeId] : []),
      ]
      if (nextLoans.length > 0) await setUserLoans(user.id, nextLoans)
    }
    setClusterBusy(false)
    setClusterAction(null)
    if (r.success) refreshClusters()
    else setNotify({ type: 'error', message: r.error || 'Failed to set home cluster' })
  }, [user, viewLoanClinicIds, refreshClusters])

  const handleEndLoan = useCallback(async (clinicId: string) => {
    if (!user) return
    setClusterBusy(true)
    const next = viewLoanClinicIds.filter(id => id !== clinicId)
    const r = await setUserLoans(user.id, next)
    setClusterBusy(false)
    setClusterAction(null)
    if (r.success) refreshClusters()
    else setNotify({ type: 'error', message: r.error || 'Failed to end loan' })
  }, [user, viewLoanClinicIds, refreshClusters])

  const handlePromoteLoan = useCallback(async (clinicId: string) => {
    if (!user) return
    setClusterBusy(true)
    const oldHomeId = user.clinic_id
    const preservedLoans = viewLoanClinicIds
    const r = await setUserClinic(user.id, clinicId)
    if (r.success) {
      const nextLoans = [
        ...preservedLoans.filter(id => id !== clinicId),
        ...(oldHomeId && oldHomeId !== clinicId ? [oldHomeId] : []),
      ]
      if (nextLoans.length > 0) await setUserLoans(user.id, nextLoans)
    }
    setClusterBusy(false)
    setClusterAction(null)
    if (r.success) refreshClusters()
    else setNotify({ type: 'error', message: r.error || 'Failed to promote loan to home' })
  }, [user, viewLoanClinicIds, refreshClusters])

  const handleAddLoan = useCallback(async (clinicId: string) => {
    if (!user) return
    setClusterBusy(true)
    const next = [...viewLoanClinicIds, clinicId]
    const r = await setUserLoans(user.id, next)
    setClusterBusy(false)
    setClusterAction(null)
    if (r.success) refreshClusters()
    else setNotify({ type: 'error', message: r.error || 'Failed to add loan' })
  }, [user, viewLoanClinicIds, refreshClusters])

  const closeResetPassword = () => {
    setResetPwAnchor(null)
    resetPw.reset()
  }

  // ── Full name helper ────────────────────────────────────────────────
  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="pt-5">
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
              avatarBlob={user.avatar_blob}
              userId={user.id}
              firstName={user.first_name}
              lastName={user.last_name}
              middleInitial={user.middle_initial}
              rank={user.rank}
              lastActiveAt={user.last_active_at}
              subtitle={[
                user.credential,
                user.uic,
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
            <OverlayActionMenu
              ref={pillRef}
              items={[
                ...(user.email ? [{
                  key: 'email',
                  label: 'Email user',
                  icon: Mail,
                  onAction: () => {
                    window.location.href = `mailto:${user.email}?subject=${encodeURIComponent('Beacon Inquiry')}&body=${encodeURIComponent(`${[user.rank, user.last_name].filter(Boolean).join(' ')},\n\n`)}`
                  },
                }] as ContextMenuItem[] : []),
                ...(isDevRole && messagesCtx ? [{
                  key: 'send-msg',
                  label: 'Send system message',
                  icon: MessageSquare,
                  onAction: () => {
                    if (!user?.last_active_at) {
                      setVaultMissingOpen(true)
                      return
                    }
                    const rect = pillRef.current?.getBoundingClientRect() ?? null
                    setSysMsgAnchor(rect)
                  },
                }] as ContextMenuItem[] : []),
                { key: 'reset-pw', label: 'Reset password', icon: KeyRound, onAction: openResetPassword },
                {
                  key: 'force-logout',
                  label: forceLogoutProcessing ? 'Logging out' : 'Force logout',
                  icon: LogOut,
                  variant: forceLogoutProcessing ? 'disabled' : 'default',
                  onAction: () => setConfirmForceLogout(true),
                },
              ]}
            />
          </div>
        )}
      </div>

      {/* System message compose popover — dev-only, anchored to corner ActionPill. */}
      {user && messagesCtx && (
        <SystemMessageComposePopover
          anchorRect={sysMsgAnchor}
          title={`Message ${userName}`}
          onClose={() => setSysMsgAnchor(null)}
          onSend={async (text) => messagesCtx.sendSystemMessageToUser(user.id, text)}
        />
      )}

      <ConfirmDialog
        visible={vaultMissingOpen}
        notifyOnly
        variant="warning"
        title="No vault yet"
        subtitle={`${userName} hasn't signed in yet, so no message vault exists. They need to sign in once before they can receive system messages.`}
        onCancel={() => setVaultMissingOpen(false)}
      />

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

      {/* Edit overlay — tap user card → form fields here. Footer owns Save+Delete.
          During an in-flight save (or while any step is still pending) the
          overlay morphs to a modal-style loading view: form + footer hide and
          only the StepResults remain. On full success a 600ms pause shows the
          all-green panel before the overlay auto-closes. */}
      {(() => {
        const overlayPending = saving || stepResults.some(s => s.pending)
        return (
      <PreviewOverlay
        isOpen={!!editAnchor && !isCreateMode}
        onClose={closeEditOverlay}
        anchorRect={editAnchor}
        title={`Edit ${userName}`}
        maxWidth={400}
        previewMaxHeight="70dvh"
        footer={
          editAnchor && user && !overlayPending ? (
            <ActionPill shadow="sm">
              {onRequestDelete && currentUserId !== user.id && (
                <ActionButton
                  icon={Trash2}
                  label="Delete user"
                  variant="danger"
                  onClick={onRequestDelete}
                />
              )}
              <ActionButton
                icon={stepResults.some(s => !s.ok) ? RefreshCw : Check}
                label={stepResults.some(s => !s.ok) ? 'Retry failed' : 'Save'}
                variant="success"
                onClick={handleSave}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {editAnchor && user && (
          <div>
            {stepResults.length > 0 && (
              <div className="px-4 pt-3 pb-3">
                <StepResults
                  steps={stepResults}
                  onRetry={!overlayPending && stepResults.some(s => !s.ok) ? handleSave : undefined}
                  retrying={saving}
                />
              </div>
            )}
            {!overlayPending && (
              <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-primary/6">
              <UserAvatar
                avatarId={user.avatar_id}
                avatarBlob={user.avatar_blob}
                userId={user.id}
                firstName={user.first_name}
                lastName={user.last_name}
                className="w-11 h-11"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{userName}</p>
              </div>
            </div>
            <TextInput
              value={editEmail}
              onChange={setEditEmail}
              placeholder="Email *"
              type="email"
              required
              currentValue={editEmail !== (user.email || '') ? user.email : undefined}
              hint={editEmail.length > 0 && !isValidEmail(editEmail) ? 'Enter a valid email address.' : undefined}
            />
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
            {/* Cluster + loan management moved to the Clusters section below
                — tap a row or the section '+' to act. The pencil-edit overlay
                only covers profile fields + roles now. */}

            <MultiPickerInput
              value={editRoles}
              onChange={setEditRoles}
              options={AVAILABLE_ROLES.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
              placeholder="Roles *"
              required
            />
              </>
            )}
          </div>
        )}
      </PreviewOverlay>
        )
      })()}

      {/* Clusters section — tap a row to act on it (change home, end loan,
          promote loan to home, open cluster). Section "+ Add loan" lives in
          the header. Replaces the cluster pickers from the edit overlay. */}
      {!editing && !isCreateMode && user && (() => {
        const homeClinic = user.clinic_id ? clinics.find(c => c.id === user.clinic_id) ?? null : null
        const loanClinics = viewLoanClinicIds
          .map(id => clinics.find(c => c.id === id))
          .filter((c): c is AdminClinic => !!c)
        const rowCount = 1 + loanClinics.length
        return (
          <section className="mt-4">
            <div className="pb-2">
              <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Clusters</p>
            </div>
            <div className="relative">
            <div className={`rounded-2xl bg-themewhite2 overflow-hidden${clusterBusy ? ' opacity-50 pointer-events-none' : ''}`}>
              <button
                type="button"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  if (homeClinic) {
                    setClusterAction({ kind: 'home-row', x: e.clientX, y: e.clientY, rect, clinic: homeClinic })
                  } else {
                    setClusterAction({ kind: 'pick-home', rect })
                  }
                }}
                className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all active:scale-95 hover:bg-themeblue2/5${rowCount > 1 ? ' border-b border-primary/6' : ''}`}
              >
                <span className={`w-9 h-9 rounded-full ${homeClinic ? 'bg-themeblue2/10' : 'bg-themeblue2/5'} flex items-center justify-center shrink-0`}>
                  <Building2 size={18} className={homeClinic ? 'text-themeblue2' : 'text-tertiary'} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${homeClinic ? 'text-primary' : 'text-tertiary'}`}>
                    {homeClinic ? homeClinic.name : 'Assign home cluster'}
                  </p>
                  <p className="text-[9pt] text-tertiary mt-0.5 truncate">
                    Home{homeClinic && homeClinic.uics.length > 0 ? ` · ${homeClinic.uics.join(', ')}` : ''}
                  </p>
                </div>
                <ChevronRight size={16} className="text-tertiary shrink-0" />
              </button>
              {loanClinics.map((c, idx) => {
                const isLast = idx === loanClinics.length - 1
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      setClusterAction({ kind: 'loan-row', x: e.clientX, y: e.clientY, clinic: c })
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all active:scale-95 hover:bg-themeblue2/5${isLast ? '' : ' border-b border-primary/6'}`}
                  >
                    <span className="w-9 h-9 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-themeblue2" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{c.name}</p>
                      <p className="text-[9pt] text-tertiary mt-0.5 truncate">
                        Loan{c.uics.length > 0 ? ` · ${c.uics.join(', ')}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-tertiary shrink-0" />
                  </button>
                )
              })}
            </div>
            <ActionPill ref={addLoanFabRef} shadow="sm" placement="overlay">
              <ActionButton
                icon={Plus}
                label="Add loan"
                onClick={() => {
                  const rect = addLoanFabRef.current?.getBoundingClientRect() ?? null
                  if (rect) setClusterAction({ kind: 'add-loan', rect })
                }}
              />
            </ActionPill>
            </div>
          </section>
        )
      })()}

      {/* Home-row context menu — open the home cluster or swap it for another. */}
      {clusterAction?.kind === 'home-row' && (() => {
        const c = clusterAction.clinic
        const rect = clusterAction.rect
        const items: ContextMenuItem[] = []
        if (onSelectClinic) {
          items.push({
            key: 'open',
            label: 'Open cluster',
            icon: ChevronRight,
            onAction: () => { setClusterAction(null); onSelectClinic(c) },
          })
        }
        items.push({
          key: 'change',
          label: 'Change home',
          icon: ArrowRightLeft,
          onAction: () => setClusterAction({ kind: 'pick-home', rect }),
        })
        return (
          <ContextMenu
            x={clusterAction.x}
            y={clusterAction.y}
            items={items}
            // Functional update — ContextMenu fires onAction then onClose in the
            // same handler. "Change home" sets kind='pick-home'; a plain
            // setClusterAction(null) here would clobber it (last write wins in
            // a React batch). Only clear if we're still on the home-row menu.
            onClose={() => setClusterAction(curr => curr?.kind === 'home-row' ? null : curr)}
          />
        )
      })()}

      {/* Loan-row context menu — anchored at tap point. */}
      {clusterAction?.kind === 'loan-row' && (() => {
        const c = clusterAction.clinic
        const items: ContextMenuItem[] = [
          {
            key: 'end',
            label: 'End loan',
            icon: Trash2,
            destructive: true,
            onAction: () => handleEndLoan(c.id),
          },
          {
            key: 'promote',
            label: 'Make home cluster',
            icon: Home,
            onAction: () => handlePromoteLoan(c.id),
          },
        ]
        if (onSelectClinic) {
          items.push({
            key: 'open',
            label: 'Open cluster',
            icon: ChevronRight,
            onAction: () => { setClusterAction(null); onSelectClinic(c) },
          })
        }
        return (
          <ContextMenu
            x={clusterAction.x}
            y={clusterAction.y}
            items={items}
            onClose={() => setClusterAction(null)}
          />
        )
      })()}

      {/* Home picker — tap home row → pick a new home cluster. Changing home
          clears all loans via the DB trigger. */}
      <PreviewOverlay
        isOpen={clusterAction?.kind === 'pick-home'}
        onClose={() => setClusterAction(null)}
        anchorRect={clusterAction?.kind === 'pick-home' ? clusterAction.rect : null}
        maxWidth={320}
        title="Set home cluster"
        searchPlaceholder="Search by name or UIC..."
        preview={(filter) => {
          const q = filter.toLowerCase()
          const homeId = user?.clinic_id ?? null
          const filtered = clinics.filter(c => {
            if (c.id === homeId) return false
            if (!filter) return true
            return c.name.toLowerCase().includes(q) || c.uics.some(u => u.toLowerCase().includes(q))
          })
          if (filtered.length === 0) {
            return <p className="text-[9pt] text-tertiary text-center py-4">No clusters match.</p>
          }
          return (
            <div role="listbox">
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  onClick={() => handlePickHome(c.id)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <span className="w-7 h-7 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
                    <Building2 size={14} className="text-themeblue2" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{c.name}</p>
                    {c.uics.length > 0 && (
                      <p className="text-[9pt] text-tertiary truncate">{c.uics.join(' · ')}</p>
                    )}
                  </div>
                  <ArrowRightLeft size={14} className="text-tertiary shrink-0" />
                </button>
              ))}
            </div>
          )
        }}
        footer={
          <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton icon={X} label="Cancel" onClick={() => setClusterAction(null)} />
          </div>
        }
      />

      {/* Add-loan picker — section "+" → pick a clinic to loan to. Excludes
          the current home and existing loans. */}
      <PreviewOverlay
        isOpen={clusterAction?.kind === 'add-loan'}
        onClose={() => setClusterAction(null)}
        anchorRect={clusterAction?.kind === 'add-loan' ? clusterAction.rect : null}
        maxWidth={320}
        title="Add loan cluster"
        searchPlaceholder="Search by name or UIC..."
        preview={(filter) => {
          const q = filter.toLowerCase()
          const homeId = user?.clinic_id ?? null
          const taken = new Set<string>([
            ...(homeId ? [homeId] : []),
            ...viewLoanClinicIds,
          ])
          const filtered = clinics.filter(c => {
            if (taken.has(c.id)) return false
            if (!filter) return true
            return c.name.toLowerCase().includes(q) || c.uics.some(u => u.toLowerCase().includes(q))
          })
          if (filtered.length === 0) {
            return <p className="text-[9pt] text-tertiary text-center py-4">No clusters available.</p>
          }
          return (
            <div role="listbox">
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  onClick={() => handleAddLoan(c.id)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <span className="w-7 h-7 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
                    <Building2 size={14} className="text-themeblue2" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{c.name}</p>
                    {c.uics.length > 0 && (
                      <p className="text-[9pt] text-tertiary truncate">{c.uics.join(' · ')}</p>
                    )}
                  </div>
                  <Plus size={14} className="text-tertiary shrink-0" />
                </button>
              ))}
            </div>
          )
        }}
        footer={
          <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton icon={X} label="Cancel" onClick={() => setClusterAction(null)} />
          </div>
        }
      />

      {!isCreateMode && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">Certifications</p>
          <AdminCertsSection
            userId={user!.id}
            certs={userCerts}
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
