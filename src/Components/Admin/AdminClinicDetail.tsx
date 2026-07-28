/**
 * AdminClinicDetail.tsx
 *
 * Displays the full detail view for a single clinic using the settings card
 * system: metadata rows for clinic info, then settings-style user rows for
 * assigned and additional users. Edit and delete are handled by AdminDrawer header.
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { X, Plus, RefreshCw, Check, Trash2, ChevronRight, Building2, Key, MessageSquare, ArrowUp, ArrowDown, Link2, UserPlus } from 'lucide-react'
import { UserRow } from '../UserRow'
import { formatLastActive } from './adminUtils'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { listClinics, listAllUsers, listLocations, updateClinic, createClinic, rescueClinicAssociationsByLocation, listClinicLoans, clinicHasVault, rescueClinicVault, setUserClinic, getAllAccountRequests } from '../../lib/adminService'
import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { TextInput } from '@/Components/primitives/FormInputs'
import { UicPinInput } from '@/Components/DomainInputs'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { LocationPickerInput } from './AdminPickers'
import { invalidate, useInvalidation } from '../../stores/useInvalidationStore'
import { sameStringSet } from '../../Utilities/arrayEquals'
import { PreviewOverlay } from '../PreviewOverlay'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu'
import { useAuthStore } from '../../stores/useAuthStore'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { SystemMessageComposePopover } from './SystemMessageComposePopover'
import { drainSystemInbox } from '../../lib/signal/systemIdentity'
import { createLogger } from '../../Utilities/Logger'
import { ClusterRosterSection, type ExtraRosterGroup } from '../ClusterRosterSection'
import {
  fetchClinicSubClusters,
  adminCreateSubCluster,
  adminRenameSubCluster,
  adminDeleteSubCluster,
  type SubCluster,
} from '../../lib/subClusterService'

const systemInboxLogger = createLogger('AdminClinicSystemInbox')

/** Roster buckets that aren't sub-units — tenure, not structure. */
const LOANED_IN = '__loaned_in__'
const LOANED_OUT = '__loaned_out__'
/** Module-scope so it's referentially stable as a ClusterRosterSection prop. */
const subUnitIdOf = (u: AdminUser) => u.sub_cluster_id

/** Prefill for the create flow when launched from another cluster's
 *  relationship picker. The new cluster is seeded with the right linkage so
 *  saving it lands already-related without a separate edit step.
 *  - `sub-of`        : new clinic.parent_clinic_id = parentId
 *  - `parent-of`     : after create, child.parent_clinic_id = newId
 *  - `associated-with`: new clinic.associated_clinic_ids = [clinicId] (createClinic syncs reciprocally) */
export type ClusterCreatePrefill =
  | { kind: 'sub-of'; parentId: string }
  | { kind: 'parent-of'; childId: string }
  | { kind: 'associated-with'; clinicId: string }

interface AdminClinicDetailProps {
  clinic: AdminClinic | null
  onClinicUpdated: (clinic: AdminClinic) => void
  onSelectUser?: (user: AdminUser) => void
  onSelectClinic?: (clinic: AdminClinic) => void
  editing: boolean
  onEditingChange: (editing: boolean) => void
  saveRequested: boolean
  onSaveComplete: () => void
  onPendingChangesChange?: (hasPending: boolean) => void
  onCreated?: (clinicId: string) => void
  /** Called when the user requests deletion from the edit overlay footer. */
  onRequestDelete?: () => void
  /** Create-mode prefill — when the create flow was launched from another
   *  cluster's relationship picker, seeds the linkage. */
  createPrefill?: ClusterCreatePrefill | null
  /** Called from a relationship picker footer when the user wants to create
   *  a NEW cluster of that kind instead of selecting an existing one. */
  onCreateRelatedCluster?: (prefill: ClusterCreatePrefill) => void
  /** Called from the Assigned Users section "Create user" action — opens the
   *  AdminUserDetail create flow with clinic_id prefilled to this cluster. */
  onCreateUserInCluster?: (clinicId: string) => void
  /** Called from the UIC-matched pending-requests list — opens the account
   *  request in the approve flow so it can be pulled into this cluster. */
  onSelectRequest?: (request: AccountRequest) => void
}

const AdminClinicDetail = ({
  clinic,
  onClinicUpdated,
  onSelectUser,
  onSelectClinic,
  editing,
  onEditingChange,
  saveRequested,
  onSaveComplete,
  onPendingChangesChange,
  onCreated,
  onRequestDelete,
  createPrefill,
  onCreateRelatedCluster,
  onCreateUserInCluster,
  onSelectRequest,
}: AdminClinicDetailProps) => {
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [locations, setLocations] = useState<AdminLocation[]>([])
  const [pendingRequests, setPendingRequests] = useState<AccountRequest[]>([])
  const requestsGen = useInvalidation('requests')
  const [loanedInUserIds, setLoanedInUserIds] = useState<string[]>([])
  /** user_id -> loan target clinic_ids (only for users whose home is this clinic) */
  const [loanedOutMap, setLoanedOutMap] = useState<Map<string, string[]>>(new Map())
  const usersGen = useInvalidation('users')

  // Intra-clinic sub-units (platoons/squads) for THIS clinic — dev-managed via
  // clinic-targeted RPCs. NOTE: distinct from the "Sub-clusters" section below,
  // which is the clinic-to-clinic CHILD-CLINIC hierarchy (parent_clinic_id).
  const [subUnits, setSubUnits] = useState<SubCluster[]>([])
  const clinicIdForSubUnits = clinic?.id ?? null
  const loadSubUnits = useCallback(async () => {
    if (!clinicIdForSubUnits) { setSubUnits([]); return }
    const res = await fetchClinicSubClusters(clinicIdForSubUnits)
    if (res.ok) setSubUnits(res.data)
  }, [clinicIdForSubUnits])
  useEffect(() => { void loadSubUnits() }, [loadSubUnits])

  // Related clusters — ONE section for the whole cluster graph (parent, child,
  // peer). Row tap opens a no-clone AnchoredMenu anchored to the row rect; the
  // section "+" opens a kind menu, which opens a PreviewOverlay picker (search).
  type RelKind = 'parent' | 'child' | 'peer'
  type RelAction =
    | { kind: 'row'; rect: DOMRect; target: AdminClinic; rel: RelKind }
    | { kind: 'add-menu'; rect: DOMRect }
    | { kind: 'add-parent' | 'add-child' | 'add-assoc'; rect: DOMRect }
  const [relAction, setRelAction] = useState<RelAction | null>(null)
  const [relBusy, setRelBusy] = useState(false)
  // Suggested-user assignment (UIC match) — id of the row currently being
  // pulled in as a home-cluster swap, for per-row busy state.
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)
  const relAddRef = useRef<HTMLDivElement>(null)

  // Edit state
  const [editName, setEditName] = useState('')
  const [editLocationId, setEditLocationId] = useState<string | null>(null)
  const [editUics, setEditUics] = useState<string[]>([])
  const [editParentClinicId, setEditParentClinicId] = useState<string | null>(null)
  const [editAssociatedClinicIds, setEditAssociatedClinicIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uicDraft, setUicDraft] = useState('')
  const [uicError, setUicError] = useState<string | null>(null)
  const [uicOwner, setUicOwner] = useState<AdminClinic | null>(null)
  const [rescuing, setRescuing] = useState(false)
  const [rescueResult, setRescueResult] = useState<string | null>(null)
  const [vaultMissing, setVaultMissing] = useState(false)
  const [vaultProvisioning, setVaultProvisioning] = useState(false)

  // System-message compose popover (dev-only). Sends into the clinic-scoped
  // system group, creating it on first use via get_or_create_clinic_system_group.
  const isDevRole = useAuthStore(s => s.isDevRole)
  const messagesCtx = useMessagesContext()
  const sysMsgPillRef = useRef<HTMLDivElement>(null)
  const [sysMsgAnchor, setSysMsgAnchor] = useState<DOMRect | null>(null)
  const [vaultResult, setVaultResult] = useState<string | null>(null)

  // Refresh the SYSTEM inbox on each clinic-detail open so clinic-scoped
  // replies surface immediately. AdminDrawer drains on open too; this is the
  // per-navigation freshness pass.
  useEffect(() => {
    if (!isDevRole || !clinic?.id) return
    drainSystemInbox().catch(e =>
      systemInboxLogger.warn('clinic-detail drain failed:', e instanceof Error ? e.message : e)
    )
  }, [isDevRole, clinic?.id])

  const isCreateMode = clinic === null

  // Edit overlay — tap clinic card → PreviewOverlay anchored to card rect.
  const cardWrapperRef = useRef<HTMLDivElement>(null)
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null)

  const handleAddUic = useCallback(() => {
    if (uicDraft.length !== 6) return
    const upper = uicDraft.toUpperCase()
    if (editUics.includes(upper)) {
      setUicError('UIC already added.')
      setUicOwner(null)
      return
    }
    const owner = clinics.find(c => c.id !== clinic?.id && c.uics.includes(upper))
    if (owner) {
      setUicError(`UIC ${upper} is assigned to`)
      setUicOwner(owner)
      return
    }
    setEditUics(prev => [...prev, upper])
    setUicDraft('')
    setUicError(null)
    setUicOwner(null)
  }, [uicDraft, editUics, clinics, clinic?.id])

  /** Stable ref for onClinicUpdated to avoid recreating loadData on every render. */
  const onClinicUpdatedRef = useRef(onClinicUpdated)
  onClinicUpdatedRef.current = onClinicUpdated

  /** Load clinics, users, and the location taxonomy. */
  const loadData = useCallback(async () => {
    const [fetchedClinics, fetchedUsers, fetchedLocations, fetchedRequests] = await Promise.all([
      listClinics(),
      listAllUsers(),
      listLocations(),
      getAllAccountRequests('pending'),
    ])
    setClinics(fetchedClinics)
    setUsers(fetchedUsers)
    setLocations(fetchedLocations)
    setPendingRequests(fetchedRequests)

    if (!isCreateMode && clinic?.id) {
      const refreshed = fetchedClinics.find((c) => c.id === clinic.id)
      if (refreshed) onClinicUpdatedRef.current(refreshed)

      // Loan rows — profile_clinic_loans is canonical, but its RLS scopes to
      // the caller's own auth_clinic_ids(); a dev viewing arbitrary clinics
      // can't read it directly. listClinicLoans hits a SECURITY DEFINER RPC
      // (admin_list_clinic_loans) gated to the dev role.
      const { inUserIds, outMap } = await listClinicLoans(clinic.id)
      setLoanedInUserIds(inUserIds)
      setLoanedOutMap(outMap)

      const has = await clinicHasVault(clinic.id)
      setVaultMissing(!has)
    }
  }, [isCreateMode, clinic?.id])

  useEffect(() => {
    loadData()
  }, [loadData, usersGen, requestsGen])

  // ── Edit overlay ↔ editing prop sync ─────────────────────────────────
  // External editing=true opens the overlay (for existing records); editing=false
  // closes it. Create mode keeps the inline form path until the FAB-anchored
  // overlay lands.
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
    onEditingChange(false)
  }, [onEditingChange])

  /** Populate edit fields only when entering edit mode (not on every clinic ref change). */
  const prevEditingRef = useRef(false)
  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      setEditName(clinic?.name ?? '')
      setEditLocationId(clinic?.location_id ?? null)
      setEditUics([...(clinic?.uics ?? [])])
      // Create-mode prefill seeds the relationship the new cluster was
      // launched to fill. parent-of can't be seeded on the new clinic itself
      // (it's a reverse-lookup field on the child) — handled in handleSave.
      if (isCreateMode && createPrefill) {
        setEditParentClinicId(createPrefill.kind === 'sub-of' ? createPrefill.parentId : null)
        setEditAssociatedClinicIds(createPrefill.kind === 'associated-with' ? [createPrefill.clinicId] : [])
      } else {
        setEditParentClinicId(clinic?.parent_clinic_id ?? null)
        setEditAssociatedClinicIds([...(clinic?.associated_clinic_ids ?? [])])
      }
      setError(null)
    }
    prevEditingRef.current = editing
  }, [editing, clinic, isCreateMode, createPrefill])

  /** Track pending changes. */
  useEffect(() => {
    if (!editing) { onPendingChangesChange?.(false); return }
    const changed =
      editName !== (clinic?.name ?? '') ||
      editLocationId !== (clinic?.location_id ?? null) ||
      !sameStringSet(editUics, clinic?.uics ?? []) ||
      editParentClinicId !== (clinic?.parent_clinic_id ?? null) ||
      !sameStringSet(editAssociatedClinicIds, clinic?.associated_clinic_ids ?? [])
    onPendingChangesChange?.(changed)
  }, [editing, editName, editLocationId, editUics, editParentClinicId, editAssociatedClinicIds, clinic, onPendingChangesChange])

  const handleSave = useCallback(async () => {
    if (!editName.trim()) {
      setError('Cluster name required.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      name: editName.trim(),
      uics: editUics,
      parent_clinic_id: editParentClinicId,
      associated_clinic_ids: editAssociatedClinicIds,
    }

    if (isCreateMode) {
      const result = await createClinic({ ...payload, location_id: editLocationId })
      if (result.success && result.id) {
        const warnings = [...(result.warnings ?? [])]
        // parent-of prefill: this clinic was created to become the parent of
        // an existing child. createClinic can't set that (parent_clinic_id
        // lives on the child row) — fire a follow-up updateClinic.
        if (createPrefill?.kind === 'parent-of') {
          const reparent = await updateClinic(createPrefill.childId, { parent_clinic_id: result.id })
          if (!reparent.success) {
            warnings.push(`Parent link failed: ${reparent.error}`)
          }
        }
        setSaving(false)
        if (warnings.length) {
          setError(`Cluster created, but: ${warnings.join('; ')}`)
        }
        // Clear pending immediately — onCreated awaits listClinics before
        // flipping editing=false in the parent, leaving a window where the
        // discard guard would fire if the user tapped Close to verify.
        onPendingChangesChange?.(false)
        onEditingChange(false)
        onCreated?.(result.id)
      } else {
        setSaving(false)
        setError(!result.success ? result.error : 'Failed to create cluster')
      }
      return
    }

    const result = await updateClinic(clinic!.id, { ...payload, location_id: editLocationId })
    setSaving(false)
    if (result.success) {
      onEditingChange(false)
      loadData()
      invalidate('clinics', 'users')
      if (result.warnings?.length) {
        setError(`Saved, but: ${result.warnings.join('; ')}`)
      }
    } else {
      setError(result.error || 'Failed to update clinic')
    }
  }, [editName, editLocationId, editUics, editParentClinicId, editAssociatedClinicIds, isCreateMode, clinic, onEditingChange, loadData, onCreated, createPrefill, onPendingChangesChange])

  const handleProvisionVault = useCallback(async () => {
    if (!clinic?.id) return
    setVaultProvisioning(true)
    setVaultResult(null)
    const result = await rescueClinicVault(clinic.id)
    setVaultProvisioning(false)
    if (result.success) {
      setVaultMissing(false)
      setVaultResult('Vault provisioned.')
    } else {
      setVaultResult(`Vault provisioning failed: ${result.error}`)
    }
  }, [clinic?.id])

  const handleRescueAssociations = useCallback(async () => {
    if (!clinic?.location_id) return
    setRescuing(true)
    setRescueResult(null)
    const result = await rescueClinicAssociationsByLocation(clinic.location_id)
    setRescuing(false)
    if (result.success) {
      setRescueResult(`Re-associated ${result.touched} clinic${result.touched === 1 ? '' : 's'} at this location.`)
      invalidate('clinics')
      loadData()
    } else {
      setRescueResult(`Rescue failed: ${result.error}`)
    }
  }, [clinic?.location_id, loadData])

  useEffect(() => {
    if (saveRequested) {
      handleSave()
      onSaveComplete()
    }
  }, [saveRequested, handleSave, onSaveComplete])

  // ── Relationship mutations ────────────────────────────────────────────
  const refreshRel = useCallback(async () => {
    invalidate('clinics')
    await loadData()
  }, [loadData])

  // Pull a UIC-matched user into this cluster as a pure home-cluster swap —
  // no navigation away. setUserClinic replaces their home outright (the DB
  // trigger wipes loans); the row then drops off the suggested list on reload.
  const handleAssignSuggestedUser = useCallback(async (userId: string) => {
    if (!clinic?.id) return
    setAssigningUserId(userId)
    const r = await setUserClinic(userId, clinic.id)
    setAssigningUserId(null)
    if (r.success) {
      invalidate('users', 'clinics')
      loadData()
    } else {
      setError(r.error || 'Failed to set this cluster as the user’s home')
    }
  }, [clinic?.id, loadData])

  const handleSetParent = useCallback(async (newId: string | null) => {
    if (!clinic) return
    setRelBusy(true)
    const r = await updateClinic(clinic.id, { parent_clinic_id: newId })
    setRelBusy(false)
    setRelAction(null)
    if (r.success) refreshRel()
    else setError(r.error || 'Failed to update parent')
  }, [clinic, refreshRel])

  const handleAddChild = useCallback(async (childId: string) => {
    if (!clinic) return
    setRelBusy(true)
    const r = await updateClinic(childId, { parent_clinic_id: clinic.id })
    setRelBusy(false)
    setRelAction(null)
    if (r.success) refreshRel()
    else setError(r.error || 'Failed to add child cluster')
  }, [clinic, refreshRel])

  const handleRemoveChild = useCallback(async (childId: string) => {
    setRelBusy(true)
    const r = await updateClinic(childId, { parent_clinic_id: null })
    setRelBusy(false)
    setRelAction(null)
    if (r.success) refreshRel()
    else setError(r.error || 'Failed to remove sub-cluster')
  }, [refreshRel])

  const handleSetAssociated = useCallback(async (nextIds: string[]) => {
    if (!clinic) return
    setRelBusy(true)
    const r = await updateClinic(clinic.id, { associated_clinic_ids: nextIds })
    setRelBusy(false)
    setRelAction(null)
    if (r.success) refreshRel()
    else setError(r.error || 'Failed to update associated clusters')
  }, [clinic, refreshRel])

  /** Users whose clinic_id matches this clinic. */
  const assignedUsers = useMemo(
    () => isCreateMode ? [] : users.filter((u) => u.clinic_id === clinic?.id),
    [users, clinic?.id, isCreateMode],
  )

  /** Single parent resolved from parent_clinic_id (null = root). */
  const parentClinic = useMemo(() => {
    if (isCreateMode || !clinic?.parent_clinic_id) return null
    return clinics.find((c) => c.id === clinic.parent_clinic_id) ?? null
  }, [clinics, clinic, isCreateMode])

  /** Sub-clinics — derived from reverse lookup on parent_clinic_id. */
  const subClinics = useMemo(() => {
    if (isCreateMode || !clinic) return []
    return clinics
      .filter((c) => c.parent_clinic_id === clinic.id)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [clinics, clinic, isCreateMode])

  /** Associated clinics — derived from this clinic's associated_clinic_ids. */
  const associatedClinics = useMemo(() => {
    if (isCreateMode || !clinic) return []
    const ids = new Set(clinic.associated_clinic_ids ?? [])
    return clinics
      .filter((c) => ids.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [clinics, clinic, isCreateMode])

  /** Self + descendants set, for cycle-safe parent/sub-cluster pickers. */
  const blockedDescendantIds = useMemo(() => {
    const blocked = new Set<string>()
    if (!clinic) return blocked
    blocked.add(clinic.id)
    let added = true
    while (added) {
      added = false
      for (const c of clinics) {
        if (c.parent_clinic_id && blocked.has(c.parent_clinic_id) && !blocked.has(c.id)) {
          blocked.add(c.id)
          added = true
        }
      }
    }
    return blocked
  }, [clinics, clinic])

  /** Users currently loaned IN — read from profile_clinic_loans (canonical). */
  const loanedInUsers = useMemo(() => {
    if (isCreateMode) return []
    const idSet = new Set(loanedInUserIds)
    return users.filter(u => idSet.has(u.id) && u.clinic_id !== clinic?.id)
  }, [users, loanedInUserIds, clinic?.id, isCreateMode])

  /** Assigned users (home here) who have ≥1 active loan to another clinic. */
  const loanedOutUsers = useMemo(() => {
    if (isCreateMode) return []
    return assignedUsers.filter(u => (loanedOutMap.get(u.id)?.length ?? 0) > 0)
  }, [assignedUsers, loanedOutMap, isCreateMode])

  /** Loan buckets, appended after the sub-unit groups. Empty ones are dropped
   *  by ClusterRosterSection; both seed collapsed. */
  const loanGroups = useMemo<ExtraRosterGroup<AdminUser>[]>(() => [
    { id: LOANED_IN, name: 'Loaned in', items: loanedInUsers },
    { id: LOANED_OUT, name: 'Loaned out', items: loanedOutUsers },
  ], [loanedInUsers, loanedOutUsers])

  /** Roster row. Loaned-out members carry chips for their target clusters. */
  const renderRosterRow = useCallback((user: AdminUser, groupId: string) => {
    const targets = groupId !== LOANED_OUT ? [] : (loanedOutMap.get(user.id) ?? [])
      .map(id => clinics.find(c => c.id === id))
      .filter((c): c is AdminClinic => !!c)
    return (
      <UserRow
        key={user.id}
        avatarId={user.avatar_id}
        avatarBlob={user.avatar_blob}
        userId={user.id}
        firstName={user.first_name}
        lastName={user.last_name}
        middleInitial={user.middle_initial}
        rank={user.rank}
        lastActiveAt={user.last_active_at}
        subtitle={user.credential || user.email || ''}
        meta={targets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {targets.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelectClinic?.(t) }}
                disabled={!onSelectClinic}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9pt] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30 hover:bg-themeblue2/20 transition-colors disabled:cursor-default"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        right={<span className="text-[9pt] text-tertiary/50 shrink-0">{formatLastActive(user.last_active_at)}</span>}
        onClick={() => onSelectUser?.(user)}
      />
    )
  }, [loanedOutMap, clinics, onSelectClinic, onSelectUser])

  /** Second entry in the roster's ellipsis menu, alongside "New sub-unit". */
  const rosterAddActions = useMemo<ContextMenuItem[]>(() => (
    onCreateUserInCluster && clinic
      ? [{ key: 'user', label: 'Create user', icon: UserPlus, onAction: () => onCreateUserInCluster(clinic.id) }]
      : []
  ), [onCreateUserInCluster, clinic])

  /**
   * The whole cluster graph in one list — parent first, then children, then
   * peers. Was three near-identical card+FAB sections; the "Sub-clusters"
   * (child clinic, parent_clinic_id) one also collided by name with the
   * roster's sub-units (sub_cluster_id), which are a different concept.
   */
  const relatedClusters = useMemo(() => {
    const rows: { clinic: AdminClinic; rel: RelKind }[] = []
    if (parentClinic) rows.push({ clinic: parentClinic, rel: 'parent' })
    for (const c of subClinics) rows.push({ clinic: c, rel: 'child' })
    for (const c of associatedClinics) rows.push({ clinic: c, rel: 'peer' })
    return rows
  }, [parentClinic, subClinics, associatedClinics])

  // Edit form body — shared between inline create flow and the tap-to-edit
  // overlay used for existing records. Keeping it inline (rather than a child
  // component) preserves the closure over the many edit-state setters.
  const editFormBody = (
    <div>
      <TextInput value={editName} onChange={setEditName} placeholder="Cluster name" />
      <LocationPickerInput value={editLocationId} onChange={setEditLocationId} allLocations={locations} />
      {clinic?.location && editLocationId === null && (
        <p className="px-4 py-2 text-[9pt] text-tertiary border-b border-primary/6">
          Legacy location: <span className="text-primary">{clinic.location}</span>
        </p>
      )}

      {editUics.length > 0 && (
        <div className="px-4 py-3 flex flex-wrap gap-1.5 border-b border-primary/6">
          {editUics.map((val, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themeblue2/10 text-themeblue2 text-[10pt] font-medium border border-themeblue2/30">
              {val}
              <button type="button" onClick={() => setEditUics(prev => prev.filter((_, i) => i !== idx))} className="hover:text-themeredred transition-colors">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center border-b border-primary/6">
        <div className="flex-1 min-w-0">
          <UicPinInput value={uicDraft} onChange={(v) => { setUicDraft(v); setUicError(null); setUicOwner(null) }} spread />
        </div>
        <button
          type="button"
          onClick={handleAddUic}
          disabled={uicDraft.length !== 6}
          className="shrink-0 w-9 h-9 mr-3 rounded-full bg-themeblue3 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
        >
          <Plus size={16} />
        </button>
      </div>
      {uicError && (
        <p className="px-4 py-2 text-[10pt] text-themeredred border-b border-primary/6">
          {uicError}{' '}
          {uicOwner && (
            onSelectClinic ? (
              <button
                type="button"
                onClick={() => onSelectClinic(uicOwner)}
                className="font-semibold underline text-themeblue2"
              >
                {uicOwner.name}
              </button>
            ) : (
              <span className="font-semibold">{uicOwner.name}</span>
            )
          )}
        </p>
      )}
      {/* Users whose self-reported UIC matches one of this clinic's UICs but
          aren't assigned here — informational only; admin can click to edit
          that user's assigned clinic directly. */}
      {editUics.length > 0 && (() => {
        const uicSet = new Set(editUics)
        const suggested = users.filter(u => u.uic && uicSet.has(u.uic) && u.clinic_id !== clinic?.id)
        if (suggested.length === 0) return null
        // With a saved clinic, tapping a row is a direct home-cluster swap
        // (handleAssignSuggestedUser). In create mode the clinic has no id yet,
        // so fall back to opening the user to edit their assignment manually.
        const canAssign = !!clinic?.id
        return (
          <div className="px-4 py-3 bg-themeblue2/5 border-b border-primary/6">
            <p className="text-[9pt] text-themeblue2 font-medium mb-1">
              {suggested.length} user{suggested.length !== 1 ? 's' : ''} self-report these UICs but aren't assigned here
            </p>
            <p className="text-[9pt] text-tertiary mb-1.5">
              {canAssign
                ? 'Tap a user to set this cluster as their home.'
                : 'Open a user to update their assigned clinic.'}
            </p>
            <div className="space-y-0.5">
              {suggested.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => canAssign ? handleAssignSuggestedUser(u.id) : onSelectUser?.(u)}
                  disabled={canAssign ? assigningUserId !== null : !onSelectUser}
                  className="w-full text-left text-[9pt] text-primary hover:text-themeblue2 transition-colors disabled:opacity-50 disabled:cursor-default"
                >
                  {assigningUserId === u.id ? 'Assigning… ' : ''}
                  {[u.rank, u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Pending account requests whose self-reported UIC matches one of this
          cluster's UICs. Distinct from the suggested-users list above (those are
          already-created accounts) — these are unapproved requests. Tap a row to
          open the approve flow, where the UIC auto-selects this cluster. */}
      {editUics.length > 0 && onSelectRequest && (() => {
        const uicSet = new Set(editUics)
        const matches = pendingRequests.filter(
          r => r.request_type === 'new_account' && r.uic && uicSet.has(r.uic.toUpperCase()),
        )
        if (matches.length === 0) return null
        return (
          <div className="px-4 py-3 bg-themeyellow/5 border-b border-primary/6">
            <p className="text-[9pt] text-themeyellow font-medium mb-1">
              {matches.length} pending request{matches.length !== 1 ? 's' : ''} self-report these UICs
            </p>
            <p className="text-[9pt] text-tertiary mb-1.5">
              Tap a request to review and approve it into this cluster.
            </p>
            <div className="space-y-0.5">
              {matches.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectRequest(r)}
                  className="w-full text-left text-[9pt] text-primary hover:text-themeyellow transition-colors"
                >
                  {[r.rank, r.first_name, r.last_name].filter(Boolean).join(' ') || r.email}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Parent, sub-clusters, and associated clusters are managed in their
          own SectionCard sections below the main card — tap a row or the
          section "+" to act. */}
    </div>
  )

  const clinicLabel = clinic?.name || 'cluster'

  return (
    <div className={saving ? 'opacity-50 pointer-events-none' : undefined}>
      {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}

      {/* Main card — view-mode card for existing records (tap to open edit
          overlay), inline form during create mode until the FAB-anchored
          overlay lands. pt-0; the parent ScrollPane already gives padding. */}
      <div ref={cardWrapperRef} className="relative mt-6">
        {clinic && !isCreateMode && (clinic.location_id || vaultMissing || (isDevRole && messagesCtx)) && (
          <div ref={sysMsgPillRef} onClick={(e) => e.stopPropagation()}>
            <OverlayActionMenu
              items={[
                ...(isDevRole && messagesCtx ? [{
                  key: 'send-msg',
                  label: 'Send system message to this cluster',
                  icon: MessageSquare,
                  onAction: () => {
                    const rect = sysMsgPillRef.current?.getBoundingClientRect() ?? null
                    setSysMsgAnchor(rect)
                  },
                }] as ContextMenuItem[] : []),
                ...(clinic.location_id ? [{
                  key: 'rescue',
                  label: rescuing ? 'Rescuing peers…' : 'Rescue peer associations at this location',
                  icon: RefreshCw,
                  variant: rescuing ? 'disabled' : 'default',
                  onAction: handleRescueAssociations,
                }] as ContextMenuItem[] : []),
                ...(vaultMissing ? [{
                  key: 'provision',
                  label: vaultProvisioning ? 'Provisioning vault…' : "Provision this cluster's encryption identity",
                  icon: vaultProvisioning ? RefreshCw : Key,
                  variant: vaultProvisioning ? 'disabled' : 'danger',
                  onAction: handleProvisionVault,
                }] as ContextMenuItem[] : []),
              ]}
            />
          </div>
        )}

        {clinic && messagesCtx && (
          <SystemMessageComposePopover
            anchorRect={sysMsgAnchor}
            title={`Message ${clinic.name}`}
            onClose={() => setSysMsgAnchor(null)}
            onSend={async (text) => messagesCtx.sendSystemMessageToClinic(clinic.id, text)}
          />
        )}
        <div
          className={`rounded-2xl bg-themewhite2 overflow-hidden ${clinic && !isCreateMode ? 'cursor-pointer active:bg-themeblue2/5 transition-colors' : ''}`}
          onClick={clinic && !isCreateMode ? openEditOverlay : undefined}
          role={clinic && !isCreateMode ? 'button' : undefined}
          tabIndex={clinic && !isCreateMode ? 0 : undefined}
          aria-label={clinic && !isCreateMode ? `Edit ${clinicLabel}` : undefined}
          onKeyDown={clinic && !isCreateMode ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditOverlay() }
          } : undefined}
        >
        {isCreateMode && editing ? (
          editFormBody
        ) : clinic ? (
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-primary">{clinic.name}</p>
            {(() => {
              const loc = clinic.location_id ? locations.find(l => l.id === clinic.location_id) : null
              if (loc) {
                return (
                  <p className="text-[9pt] text-tertiary mt-0.5">
                    {loc.display_name}
                    {loc.command && <span className="ml-1.5">· {loc.command}</span>}
                  </p>
                )
              }
              if (clinic.location) {
                return <p className="text-[9pt] text-tertiary mt-0.5">{clinic.location}</p>
              }
              return null
            })()}
            {clinic.uics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {clinic.uics.map((uic) => (
                  <span key={uic} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9pt] md:text-[9pt] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30">
                    {uic}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}
        </div>
        {(rescueResult || vaultResult) && (
          <p className="mt-1 text-[9pt] text-themeblue2">{rescueResult || vaultResult}</p>
        )}
      </div>

      {/* Edit overlay — tap clinic card → form fields here. Footer owns Save+Delete. */}
      <PreviewOverlay
        isOpen={!!editAnchor && !isCreateMode}
        onClose={closeEditOverlay}
        anchorRect={editAnchor}
        title={`Edit ${clinicLabel}`}
        maxWidth={400}
        previewMaxHeight="70dvh"
        footer={
          editAnchor && clinic && onRequestDelete ? (
            <FooterPill>
              <ActionButton
                icon={Trash2}
                label="Delete cluster"
                variant="danger"
                onClick={() => { setEditAnchor(null); onRequestDelete() }}
              />
            </FooterPill>
          ) : undefined
        }
        rightFooter={
          editAnchor && clinic ? (
            <FooterPill side="right">
              <ActionButton
                icon={saving ? RefreshCw : Check}
                label={saving ? 'Saving…' : 'Save'}
                variant={saving ? 'disabled' : 'confirm'}
                onClick={handleSave}
              />
            </FooterPill>
          ) : undefined
        }
      >
        {editAnchor && clinic && editFormBody}
      </PreviewOverlay>

      {/* ── Roster ───────────────────────────────────────────────────────
          ONE section for everyone in this cluster: sub-unit groups (whose ⋯
          renames/deletes the group itself), HQ / Unassigned, and the two loan
          buckets. Replaces the old Assigned Users + Sub-units + Loaned In +
          Loaned Out stack, where the roster showed group headers but the group
          manager lived in a separate card below it. */}
      {/* No !editing gate — the edit surface is an anchored overlay now, so
          collapsing the page behind it would yank the layout out from under. */}
      {!isCreateMode && clinic && (
        <ClusterRosterSection
          subUnits={subUnits}
          members={assignedUsers}
          subUnitIdOf={subUnitIdOf}
          extraGroups={loanGroups}
          renderItem={renderRosterRow}
          itemsClassName="divide-y divide-tertiary/10"
          emptyText="No users assigned."
          addActions={rosterAddActions}
          onCreateSubUnit={async (name) => {
            const r = await adminCreateSubCluster(clinic.id, name)
            if (r.success) { await loadSubUnits(); invalidate('subClusters') }
            else setError(r.error)
            return r.success
          }}
          onRenameSubUnit={async (id, name) => {
            const r = await adminRenameSubCluster(id, name)
            if (r.success) { await loadSubUnits(); invalidate('subClusters') }
            else setError(r.error)
            return r.success
          }}
          onDeleteSubUnit={async (id) => {
            const r = await adminDeleteSubCluster(id)
            if (r.success) { await loadSubUnits(); invalidate('subClusters', 'users') }
            else setError(r.error)
            return r.success
          }}
        />
      )}

      {/* ── Related clusters ─────────────────────────────────────────────
          Parent, children, and peers in ONE list with a kind chip per row —
          they're all "another cluster this one is wired to", and three
          near-identical card+FAB sections read as three unrelated features.
          The chip also disambiguates a child cluster ("child") from the
          roster's sub-units above, which used to share the "sub-" name. */}
      {!isCreateMode && clinic && (
        <section className="mt-4">
          <div className="flex items-center gap-2 pb-2">
            <p className="flex-1 text-[9pt] font-semibold text-primary uppercase tracking-wider">Related clusters</p>
            <div ref={relAddRef} className="shrink-0">
              <button
                type="button"
                aria-label="Add related cluster"
                onClick={() => {
                  const rect = relAddRef.current?.getBoundingClientRect() ?? null
                  if (rect) setRelAction({ kind: 'add-menu', rect })
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className={`rounded-2xl bg-themewhite2 overflow-hidden${relBusy ? ' opacity-50 pointer-events-none' : ''}`}>
            {relatedClusters.length === 0 ? (
              <div className="px-4 py-3.5 text-[10pt] text-tertiary">No related clusters.</div>
            ) : (
              relatedClusters.map(({ clinic: node, rel: kind }, idx) => {
                const chip =
                  kind === 'parent' ? { label: 'parent', cls: 'bg-themeblue3/10 text-themeblue3 border-themeblue3/30', Icon: ArrowUp }
                  : kind === 'child' ? { label: 'child', cls: 'bg-themeblue2/10 text-themeblue2 border-themeblue2/30', Icon: ArrowDown }
                  : { label: 'peer', cls: 'bg-tertiary/10 text-tertiary border-tertiary/30', Icon: Link2 }
                return (
                  <button
                    key={`${kind}:${node.id}`}
                    type="button"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setRelAction({ kind: 'row', rect, target: node, rel: kind })
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all active:scale-95 hover:bg-themeblue2/5${idx < relatedClusters.length - 1 ? ' border-b border-primary/6' : ''}`}
                  >
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${kind === 'parent' ? 'bg-themeblue3/10' : kind === 'child' ? 'bg-themeblue2/10' : 'bg-tertiary/10'}`}>
                      <Building2 size={18} className={kind === 'parent' ? 'text-themeblue3' : kind === 'child' ? 'text-themeblue2' : 'text-tertiary'} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{node.name}</p>
                      {node.uics.length > 0 && (
                        <p className="text-[9pt] text-tertiary mt-0.5 truncate">{node.uics.join(' · ')}</p>
                      )}
                    </div>
                    <span
                      aria-label={chip.label}
                      title={chip.label}
                      className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded border ${chip.cls}`}
                    >
                      <chip.Icon size={12} />
                    </span>
                    <ChevronRight size={16} className="text-tertiary shrink-0" />
                  </button>
                )
              })
            )}
          </div>
        </section>
      )}

      {/* "+" kind menu — which relationship to add. "Set parent" is omitted
          (not disabled) once a parent exists; remove it from the row first. */}
      {relAction?.kind === 'add-menu' && (() => {
        const rect = relAction.rect
        const items: ContextMenuItem[] = []
        if (!parentClinic) {
          items.push({ key: 'parent', label: 'Set parent cluster', icon: ArrowUp, onAction: () => setRelAction({ kind: 'add-parent', rect }) })
        }
        items.push({ key: 'child', label: 'Add child cluster', icon: ArrowDown, onAction: () => setRelAction({ kind: 'add-child', rect }) })
        items.push({ key: 'peer', label: 'Add associated cluster', icon: Link2, onAction: () => setRelAction({ kind: 'add-assoc', rect }) })
        return (
          <AnchoredMenu
            isOpen
            anchorRect={rect}
            layout="list"
            items={items}
            // AnchoredMenu fires onAction then onClose in the same batch, and both
            // write relAction — a plain setRelAction(null) would clobber the picker
            // the item just opened. Clear only if still sitting on the kind menu.
            onClose={() => setRelAction(a => (a?.kind === 'add-menu' ? null : a))}
          />
        )
      })()}

      {/* Row context menu — Open / Remove, anchored to the row (no-clone lift). */}
      {relAction?.kind === 'row' && (() => {
        const { target, rel } = relAction
        const removeLabel =
          rel === 'parent' ? 'Remove parent' :
          rel === 'child' ? 'Remove child cluster' :
          'Remove from associated'
        const onRemove = () => {
          if (rel === 'parent') return handleSetParent(null)
          if (rel === 'child') return handleRemoveChild(target.id)
          return handleSetAssociated(
            (clinic?.associated_clinic_ids ?? []).filter(id => id !== target.id),
          )
        }
        const items: ContextMenuItem[] = []
        if (onSelectClinic) {
          items.push({
            key: 'open',
            label: 'Open cluster',
            icon: ChevronRight,
            onAction: () => { setRelAction(null); onSelectClinic(target) },
          })
        }
        items.push({
          key: 'remove',
          label: removeLabel,
          icon: Trash2,
          destructive: true,
          onAction: onRemove,
        })
        return (
          <AnchoredMenu
            isOpen
            anchorRect={relAction.rect}
            layout="list"
            items={items}
            onClose={() => setRelAction(null)}
          />
        )
      })()}

      {/* Add-relationship pickers — parent / sub-cluster / associated. */}
      <PreviewOverlay
        isOpen={relAction?.kind === 'add-parent' || relAction?.kind === 'add-child' || relAction?.kind === 'add-assoc'}
        onClose={() => setRelAction(null)}
        anchorRect={
          relAction && (relAction.kind === 'add-parent' || relAction.kind === 'add-child' || relAction.kind === 'add-assoc')
            ? relAction.rect
            : null
        }
        maxWidth={320}
        title={
          relAction?.kind === 'add-parent' ? 'Set parent cluster' :
          relAction?.kind === 'add-child' ? 'Add child cluster' :
          relAction?.kind === 'add-assoc' ? 'Add associated cluster' :
          ''
        }
        searchPlaceholder="Search by name or UIC..."
        preview={(filter) => {
          if (!relAction || !clinic) return null
          if (relAction.kind !== 'add-parent' && relAction.kind !== 'add-child' && relAction.kind !== 'add-assoc') return null
          const q = filter.toLowerCase()
          const associatedIds = new Set(clinic.associated_clinic_ids ?? [])
          const filtered = clinics.filter(c => {
            if (c.id === clinic.id) return false
            if (relAction.kind === 'add-parent') {
              // Block self + descendants (cycle guard).
              if (blockedDescendantIds.has(c.id)) return false
            }
            if (relAction.kind === 'add-child') {
              // Block self + descendants + clinics that already have a parent
              // (would steal them silently — require unparenting first).
              if (blockedDescendantIds.has(c.id)) return false
              if (c.parent_clinic_id) return false
            }
            if (relAction.kind === 'add-assoc') {
              if (associatedIds.has(c.id)) return false
            }
            if (!filter) return true
            return c.name.toLowerCase().includes(q) || c.uics.some(u => u.toLowerCase().includes(q))
          })
          if (filtered.length === 0) {
            return <p className="text-[9pt] text-tertiary text-center py-4">No clusters available.</p>
          }
          const onPick = (id: string) => {
            if (relAction.kind === 'add-parent') return handleSetParent(id)
            if (relAction.kind === 'add-child') return handleAddChild(id)
            return handleSetAssociated([...(clinic.associated_clinic_ids ?? []), id])
          }
          return (
            <div role="listbox">
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  onClick={() => onPick(c.id)}
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
          <FooterPill>
            {onCreateRelatedCluster && clinic && relAction && (relAction.kind === 'add-parent' || relAction.kind === 'add-child' || relAction.kind === 'add-assoc') && (
              <ActionButton
                icon={Plus}
                label={
                  relAction.kind === 'add-parent' ? 'Create new parent cluster' :
                  relAction.kind === 'add-child' ? 'Create new child cluster' :
                  'Create new associated cluster'
                }
                onClick={() => {
                  const kind = relAction.kind
                  setRelAction(null)
                  if (kind === 'add-parent') onCreateRelatedCluster({ kind: 'parent-of', childId: clinic.id })
                  else if (kind === 'add-child') onCreateRelatedCluster({ kind: 'sub-of', parentId: clinic.id })
                  else onCreateRelatedCluster({ kind: 'associated-with', clinicId: clinic.id })
                }}
              />
            )}
          </FooterPill>
        }
      />
    </div>
  )
}

export { AdminClinicDetail }
