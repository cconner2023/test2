/**
 * AdminUserDetail -- detailed view for a single user in the admin panel.
 *
 * Displays profile header, metadata grid, certifications, and admin
 * actions (email, reset password, force logout) as an ActionPill in
 * the user-card corner. Edit is inline via the Settings-pattern
 * toolbar (editing/saveRequested props). Delete lives in the header.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { KeyRound, LogOut, Building2, ChevronRight, Mail, Check, RefreshCw, Trash2, Home, Plus, ArrowRightLeft, MessageSquare } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import type { Component } from '../../Data/User'
import { UserAvatar } from '../Settings/UserAvatar'
import { UserRow } from '../UserRow'
import { AdminCertsSection } from './AdminCertsSection'
import { UserTimeline } from '../Timeline/UserTimeline'
import { TextInput, PickerInput, MultiPickerInput, PasswordInput } from '@/Components/primitives/FormInputs'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { UicPinInput } from '@/Components/DomainInputs'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { Z } from '@/Components/primitives/BaseOverlay'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { PreviewOverlay } from '../PreviewOverlay'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu'
import { formatLastActive, RoleBadge, SupervisorCreatedBadge } from './adminUtils'
import { HudLoader } from '@/Components/primitives/HudLoader'
import type { StepResult } from './StepResults'
import { useResetPasswordFlow } from '../../Hooks/useResetPasswordFlow'
import { useEntityForm } from '../../Hooks/useEntityForm'
import { rankForComponent } from '../../Utilities/rank'
import { ASSIGNABLE_ROLES, roleOptions, type AssignableRole } from '../../Utilities/roles'
import { useMessagesContext } from '../../Hooks/MessagesContext'
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
import { fetchClinicSubClusters, adminSetMemberSubCluster } from '../../lib/subClusterService'
import { supabase } from '../../lib/supabase'
import { buildMailtoHref } from '../../lib/mailto'
import { useAuthStore } from '../../stores/useAuthStore'
import { UI_TIMING } from '../../Utilities/constants'
import { invalidate } from '../../stores/useInvalidationStore'

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
  /** Dev-only — opens the full system-conversation chat panel with this user.
   *  Wired by AdminDrawer to handleSelectSystemPeer. When provided, the
   *  "Message user" action navigates here instead of the inline compose popover. */
  onOpenConversation?: (peerId: string) => void
}

/** Everything the edit overlay / create form mutates, as one record. */
interface UserEditForm extends Record<string, unknown> {
  email: string
  firstName: string
  lastName: string
  middleInitial: string
  credential: string
  component: string
  rank: string
  uic: string
  clinicId: string
  loanClinicIds: Set<string>
  roles: string[]
  /** Sub-cluster (platoon/squad) assignment — a user attribute edited
   *  alongside rank/roles, mirroring the supervisor member card. */
  section: string
}

const EMPTY_USER_FORM: UserEditForm = {
  email: '',
  firstName: '',
  lastName: '',
  middleInitial: '',
  credential: '',
  component: '',
  rank: '',
  uic: '',
  clinicId: '',
  loanClinicIds: new Set(),
  roles: [],
  section: '',
}

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
  onOpenConversation,
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
    | { kind: 'loan-row'; rect: DOMRect; clinic: AdminClinic }
    | { kind: 'home-row'; rect: DOMRect; clinic: AdminClinic }
    | { kind: 'pick-home'; rect: DOMRect }
    | { kind: 'add-loan'; rect: DOMRect }
  const [clusterAction, setClusterAction] = useState<ClusterAction | null>(null)
  const [clusterBusy, setClusterBusy] = useState(false)

  // Sub-cluster (platoon/squad) section — dev-side assignment. Options come from
  // the user's HOME clinic; current value read from the user's profile. Render-only.
  const [sectionOpts, setSectionOpts] = useState<{ value: string; label: string }[]>([])
  const [currentSection, setCurrentSection] = useState('')

  // ── Edit state ──────────────────────────────────────────────────────
  // One form object, not a useState per field: the seed, the dirty check, and
  // the loans baseline all come from it. See useEntityForm.
  const form = useEntityForm<UserEditForm>(EMPTY_USER_FORM)
  // Stable across renders, so effects can depend on them without re-running.
  const {
    set: setField,
    bind: bindField,
    reset: resetForm,
    hydrate: hydrateForm,
    commit: commitForm,
    isDirty: isFieldDirty,
  } = form
  const {
    email: editEmail,
    firstName: editFirstName,
    lastName: editLastName,
    middleInitial: editMiddleInitial,
    credential: editCredential,
    component: editComponent,
    rank: editRank,
    uic: editUic,
    clinicId: editClinicId,
    loanClinicIds: editLoanClinicIds,
    roles: editRoles,
    section: editSection,
  } = form.values
  const originalLoanClinicIds = form.baseline.loanClinicIds

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

  const componentRanks = (editComponent ? ranksByComponent[editComponent as Component] : []) ?? []

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

  // Load the user's home-clinic sub-clusters + their current section (dev console).
  const userClinicId = user?.clinic_id ?? null
  const userIdForSection = user?.id ?? null
  useEffect(() => {
    if (!userClinicId || !userIdForSection) { setSectionOpts([]); setCurrentSection(''); return }
    let cancelled = false
    void (async () => {
      const [listRes, profRes] = await Promise.all([
        fetchClinicSubClusters(userClinicId),
        supabase.from('profiles').select('sub_cluster_id').eq('id', userIdForSection).single(),
      ])
      if (cancelled) return
      setSectionOpts(listRes.ok ? listRes.data.map(s => ({ value: s.id, label: s.name })) : [])
      setCurrentSection((profRes.data?.sub_cluster_id as string | null) ?? '')
    })()
    return () => { cancelled = true }
  }, [userClinicId, userIdForSection])

  // The section read lands after the overlay can open, so keep the editable
  // value pinned to it until the dev actually picks one — otherwise a quick
  // Save would clear the section to HQ. `isDirty` replaces the ref that used to
  // track "has the dev touched this yet".
  useEffect(() => {
    if (editing && !isFieldDirty('section')) setField('section', currentSection)
  }, [currentSection, editing, isFieldDirty, setField])

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
    setError(null)
    onEditingChange(false)
  }, [onEditingChange])

  // ── Edit mode initialization (only on false→true transition) ─────────
  const prevEditingRef = useRef(false)
  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      resetForm({
        email: user?.email || '',
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
        middleInitial: user?.middle_initial || '',
        credential: user?.credential || '',
        component: user?.component || '',
        rank: user?.rank || '',
        uic: user?.uic || '',
        // Create-mode: prefer prefillClinicId (launched from a cluster's
        // "Create user"); existing-user edit keeps the current assignment.
        clinicId: user?.clinic_id || (user === null ? (prefillClinicId || '') : ''),
        loanClinicIds: new Set(),
        roles: user?.roles?.filter(r => ASSIGNABLE_ROLES.includes(r as AssignableRole)) ?? ['medic'],
        section: currentSection,
      })
      // Current loans for the multi-select. Goes through the dev RPC so loans
      // show even when the caller doesn't share a clinic with the target. Lands
      // as BASELINE, not as an edit — it arrives after the overlay opened.
      if (user?.id) {
        listUserLoans(user.id).then(ids => hydrateForm({ loanClinicIds: new Set<string>(ids) }))
      }

      setCreateEmail('')
      setCreatePassword('')
      setError(null)
      setStepResults([])
    }
    prevEditingRef.current = editing
  }, [editing, user, prefillClinicId, currentSection, resetForm, hydrateForm])

  // ── Pending changes detection ────────────────────────────────────────
  useEffect(() => {
    onPendingChangesChange?.(editing && form.dirty)
  }, [editing, form.dirty, onPendingChangesChange])

  // ── Handlers ────────────────────────────────────────────────────────

  const handleComponentChange = useCallback((val: string) => {
    setField('component', val)
    setField('rank', prev => rankForComponent(ranksByComponent[val as Component], prev))
  }, [setField])

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
          sub_cluster_id: null,
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

    // Section (platoon/squad) — runs after clinic so the section's clinic matches.
    if (editSection !== currentSection && !alreadyOk('section')) {
      const r = await adminSetMemberSubCluster(user.id, editSection || null)
      if (r.success) setCurrentSection(editSection)
      upsert({
        key: 'section',
        label: editSection ? 'Section updated' : 'Section cleared (HQ)',
        ok: r.success,
        error: r.success ? undefined : (r.error || 'Failed to update section'),
      })
    }

    invalidate('users', 'clinics')

    const anyFailed = next.some(s => !s.ok)
    if (!anyFailed) {
      // Everything landed — rebaseline so the form reads clean. Matters on the
      // retry path too: without it a step that succeeded would still count as an
      // unsaved change and re-run.
      commitForm()
      // Brief HUD hold so the save reads as deliberate before the overlay
      // dismisses, rather than blinking shut the instant the last write lands.
      await new Promise(resolve => setTimeout(resolve, 600))
      setStepResults([])
      setSaving(false)
      onEditingChange(false)
      loadData()
      return
    }

    setSaving(false)
    // Partial failure — the HUD clears and the form returns with an inline error
    // naming what didn't stick (no step checklist). Re-tapping Save retries only
    // the failures (alreadyOk() skips the successes).
    setError(`Couldn't finish: ${next.filter(s => !s.ok).map(s => s.label).join(', ')}. Tap Save to retry.`)
  }, [user, editEmail, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editClinicId, editLoanClinicIds, originalLoanClinicIds, editRoles, editSection, currentSection, onEditingChange, loadData, isCreateMode, createEmail, createPassword, onCreated, stepResults, commitForm])

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
  // and then invalidate+reload. Changing home is a pure swap — the old home is
  // dropped, never demoted to a loan.
  const refreshClusters = useCallback(async () => {
    invalidate('users', 'clinics')
    await loadData()
  }, [loadData])

  // Pure swap: changing home replaces the home cluster outright — the old home
  // is dropped, NOT demoted to a loan. setUserClinic fires a DB trigger that
  // wipes every loan, so re-apply only the user's OTHER existing loans (minus
  // newId, which is now the home) to keep those from being lost.
  const handlePickHome = useCallback(async (newId: string) => {
    if (!user) return
    setClusterBusy(true)
    const preservedLoans = viewLoanClinicIds
    const r = await setUserClinic(user.id, newId)
    if (r.success) {
      const nextLoans = preservedLoans.filter(id => id !== newId)
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

  // Promote a loan to home — pure swap, same as handlePickHome: the loan being
  // promoted becomes the new home, the old home is dropped (not kept as a
  // loan), and the user's other loans are preserved across the trigger wipe.
  const handlePromoteLoan = useCallback(async (clinicId: string) => {
    if (!user) return
    setClusterBusy(true)
    const preservedLoans = viewLoanClinicIds
    const r = await setUserClinic(user.id, clinicId)
    if (r.success) {
      const nextLoans = preservedLoans.filter(id => id !== clinicId)
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
          {isCreateMode && editing && saving ? (
            // Create runs behind the HUD (single step — no checklist).
            <div className="flex items-center justify-center py-16">
              <HudLoader size={120} />
            </div>
          ) : isCreateMode && editing ? (
            // Legacy inline create form — Phase 3 will move this to an overlay anchored to the FAB.
            <div>
              <TextInput value={createEmail} onChange={setCreateEmail} placeholder="Email *" type="email" required />
              <PasswordInput value={createPassword} onChange={setCreatePassword} placeholder="Temporary password (min 12 chars)" />
              <TextInput value={editFirstName} onChange={bindField('firstName')} placeholder="First Name *" required />
              <div className="flex items-stretch border-b border-primary/6">
                <div className="flex-1 min-w-0">
                  <TextInput value={editLastName} onChange={bindField('lastName')} placeholder="Last Name *" required />
                </div>
                <div className="w-16 shrink-0 border-l border-primary/6">
                  <TextInput value={editMiddleInitial} onChange={v => setField('middleInitial', v.toUpperCase().slice(0, 1))} placeholder="MI" maxLength={1} />
                </div>
              </div>
              <PickerInput value={editCredential} onChange={bindField('credential')} options={credentials} placeholder="Credential" />
              <PickerInput value={editComponent} onChange={handleComponentChange} options={components} placeholder="Component" />
              {editComponent && <PickerInput value={editRank} onChange={bindField('rank')} options={componentRanks} placeholder="Rank" />}
              <UicPinInput value={editUic} onChange={bindField('uic')} spread />
              <ClinicPickerInput value={editClinicId} onChange={bindField('clinicId')} allClinics={clinics} placeholder="Cluster" />
              <MultiPickerInput
                value={editRoles}
                onChange={bindField('roles')}
                options={roleOptions(ASSIGNABLE_ROLES)}
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
                  href: buildMailtoHref({ to: user.email!, subject: '[inquiry] -  Medical Operations Web Application', body: `${[user.rank, user.last_name].filter(Boolean).join(' ')},\n\n` }),
                }] as ContextMenuItem[] : []),
                ...(isDevRole && messagesCtx && onOpenConversation ? [{
                  key: 'send-msg',
                  label: 'Message user',
                  icon: MessageSquare,
                  onAction: () => {
                    if (!user?.last_active_at) {
                      setVaultMissingOpen(true)
                      return
                    }
                    if (user?.id) onOpenConversation(user.id)
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
                // Delete — parity with the Directory tree's user menu, which
                // carries Delete as its lifecycle action. Header/edit-overlay
                // Delete still exist; this just mirrors the tree.
                ...(onRequestDelete ? [{
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  destructive: true,
                  onAction: onRequestDelete,
                }] as ContextMenuItem[] : []),
              ]}
            />
          </div>
        )}
      </div>

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
        rightFooter={
          resetPwAnchor && user ? (
            <FooterPill side="right">
              <ActionButton
                icon={resetPw.processing ? RefreshCw : Check}
                label={resetPw.processing ? 'Submitting…' : 'Reset password'}
                variant={resetPw.processing || resetPw.value.length < 12 ? 'disabled' : 'confirm'}
                onClick={() => user && resetPw.requestConfirm(user.id)}
              />
            </FooterPill>
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
          During an in-flight save (or while any step is still pending) the form +
          footer hide and the HUD loader takes the body. On full success the
          overlay auto-closes; on partial failure the form returns with an inline
          error and Save re-runs only the failures. */}
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
          editAnchor && user && !overlayPending && onRequestDelete && currentUserId !== user.id ? (
            <FooterPill>
              <ActionButton
                icon={Trash2}
                label="Delete user"
                variant="danger"
                onClick={onRequestDelete}
              />
            </FooterPill>
          ) : undefined
        }
        rightFooter={
          editAnchor && user && !overlayPending ? (
            <FooterPill side="right">
              <ActionButton
                icon={stepResults.some(s => !s.ok) ? RefreshCw : Check}
                label={stepResults.some(s => !s.ok) ? 'Retry failed' : 'Save'}
                variant="confirm"
                onClick={handleSave}
              />
            </FooterPill>
          ) : undefined
        }
      >
        {editAnchor && user && (
          <div>
            {overlayPending && (
              // The save runs behind the HUD (no step checklist — that pattern
              // lives nowhere else in the app). On failure the HUD clears and the
              // form returns with an inline error; on success the overlay closes.
              <div className="flex items-center justify-center py-16">
                <HudLoader size={120} />
              </div>
            )}
            {!overlayPending && (
              <>
            {error && <div className="px-4 pt-3"><ErrorDisplay message={error} /></div>}
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
              onChange={bindField('email')}
              placeholder="Email *"
              type="email"
              required
              currentValue={editEmail !== (user.email || '') ? user.email : undefined}
              hint={editEmail.length > 0 && !isValidEmail(editEmail) ? 'Enter a valid email address.' : undefined}
            />
            <TextInput value={editFirstName} onChange={bindField('firstName')} placeholder="First Name *" required />
            <div className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <TextInput value={editLastName} onChange={bindField('lastName')} placeholder="Last Name *" required />
              </div>
              <div className="w-16 shrink-0 border-l border-primary/6">
                <TextInput value={editMiddleInitial} onChange={v => setField('middleInitial', v.toUpperCase().slice(0, 1))} placeholder="MI" maxLength={1} />
              </div>
            </div>
            <PickerInput value={editCredential} onChange={bindField('credential')} options={credentials} placeholder="Credential" />
            <PickerInput value={editComponent} onChange={handleComponentChange} options={components} placeholder="Component" />
            {editComponent && <PickerInput value={editRank} onChange={bindField('rank')} options={componentRanks} placeholder="Rank" />}
            <UicPinInput value={editUic} onChange={bindField('uic')} spread />
            {/* Cluster + loan management moved to the Clusters section below
                — tap a row or the section '+' to act. The pencil-edit overlay
                only covers profile fields + roles now. */}

            <MultiPickerInput
              value={editRoles}
              onChange={bindField('roles')}
              options={roleOptions(ASSIGNABLE_ROLES)}
              placeholder="Roles *"
              required
            />
            {/* Section (platoon/squad) — only when the user's home clinic has sub-units. */}
            {sectionOpts.length > 0 && (
              <PickerInput
                value={editSection}
                onChange={bindField('section')}
                options={[{ value: '', label: 'HQ / Unassigned' }, ...sectionOpts]}
                placeholder="Section"
              />
            )}
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
                    setClusterAction({ kind: 'home-row', rect, clinic: homeClinic })
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
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setClusterAction({ kind: 'loan-row', rect, clinic: c })
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
          <AnchoredMenu
            isOpen
            anchorRect={clusterAction.rect}
            layout="list"
            items={items}
            // Functional update — the menu fires onAction then onClose in the
            // same handler. "Change home" sets kind='pick-home'; a plain
            // setClusterAction(null) here would clobber it (last write wins in
            // a React batch). Only clear if we're still on the home-row menu.
            onClose={() => setClusterAction(curr => curr?.kind === 'home-row' ? null : curr)}
          />
        )
      })()}

      {/* Loan-row context menu — anchored to the row (no-clone lift). */}
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
          <AnchoredMenu
            isOpen
            anchorRect={clusterAction.rect}
            layout="list"
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

      {/* Provenance timeline — lifecycle spine from audit_log: cluster moves,
          training, certs. Answers the CREATED_SOURCE / "when assigned" question. */}
      {user?.clinic_id && (
        <div className="mt-4">
          <UserTimeline subjectId={user.id} clinicId={user.clinic_id} />
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
