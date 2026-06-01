/**
 * AdminClinicDetail.tsx
 *
 * Displays the full detail view for a single clinic using the settings card
 * system: metadata rows for clinic info, then settings-style user rows for
 * assigned and additional users. Edit and delete are handled by AdminDrawer header.
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { X, Plus, RefreshCw, Check, Trash2, ChevronRight, Building2, Key, MessageSquare } from 'lucide-react'
import { UserRow } from '../UserRow'
import { ActionButton } from '../ActionButton'
import { listClinics, listAllUsers, listLocations, updateClinic, createClinic, rescueClinicAssociationsByLocation, listClinicLoans, clinicHasVault, rescueClinicVault } from '../../lib/adminService'
import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'
import { formatLastActive } from './adminUtils'
import { TextInput, UicPinInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { LocationPickerInput } from './AdminPickers'
import { invalidate, useInvalidation } from '../../stores/useInvalidationStore'
import { sameStringSet } from '../../Utilities/arrayEquals'
import { ActionPill } from '../ActionPill'
import { PreviewOverlay } from '../PreviewOverlay'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { useAuthStore } from '../../stores/useAuthStore'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { SystemMessageComposePopover } from './SystemMessageComposePopover'
import { drainSystemInbox } from '../../lib/signal/systemIdentity'
import { createLogger } from '../../Utilities/Logger'

const systemInboxLogger = createLogger('AdminClinicSystemInbox')

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
}: AdminClinicDetailProps) => {
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [locations, setLocations] = useState<AdminLocation[]>([])
  const [loanedInUserIds, setLoanedInUserIds] = useState<string[]>([])
  /** user_id -> loan target clinic_ids (only for users whose home is this clinic) */
  const [loanedOutMap, setLoanedOutMap] = useState<Map<string, string[]>>(new Map())
  const usersGen = useInvalidation('users')

  // Relationship sections — row tap opens a ContextMenu anchored at the
  // tap point; section FAB opens a PreviewOverlay picker (needs search).
  type RelAction =
    | { kind: 'parent-row' | 'child-row' | 'assoc-row'; x: number; y: number; target: AdminClinic }
    | { kind: 'add-parent' | 'add-child' | 'add-assoc'; rect: DOMRect }
  const [relAction, setRelAction] = useState<RelAction | null>(null)
  const [relBusy, setRelBusy] = useState(false)
  const parentFabRef = useRef<HTMLDivElement>(null)
  const childFabRef = useRef<HTMLDivElement>(null)
  const assocFabRef = useRef<HTMLDivElement>(null)

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
    const [fetchedClinics, fetchedUsers, fetchedLocations] = await Promise.all([
      listClinics(),
      listAllUsers(),
      listLocations(),
    ])
    setClinics(fetchedClinics)
    setUsers(fetchedUsers)
    setLocations(fetchedLocations)

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
  }, [loadData, usersGen])

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
    else setError(r.error || 'Failed to add sub-cluster')
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

  const renderUserRow = (user: AdminUser) => (
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
      right={<span className="text-[9pt] text-tertiary/50 shrink-0">{formatLastActive(user.last_active_at)}</span>}
      onClick={() => onSelectUser?.(user)}
    />
  )

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
        return (
          <div className="px-4 py-3 bg-themeblue2/5 border-b border-primary/6">
            <p className="text-[9pt] text-themeblue2 font-medium mb-1">
              {suggested.length} user{suggested.length !== 1 ? 's' : ''} self-report these UICs but aren't assigned here
            </p>
            <p className="text-[9pt] text-tertiary mb-1.5">
              Open a user to update their assigned clinic.
            </p>
            <div className="space-y-0.5">
              {suggested.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectUser?.(u)}
                  disabled={!onSelectUser}
                  className="w-full text-left text-[9pt] text-primary hover:text-themeblue2 transition-colors disabled:cursor-default"
                >
                  {[u.rank, u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
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
            <ActionPill shadow="sm" placement="overlay">
              {isDevRole && messagesCtx && (
                <ActionButton
                  icon={MessageSquare}
                  label="Send system message to this cluster"
                  onClick={() => {
                    const rect = sysMsgPillRef.current?.getBoundingClientRect() ?? null
                    setSysMsgAnchor(rect)
                  }}
                />
              )}
              {clinic.location_id && (
                <ActionButton
                  icon={RefreshCw}
                  label={rescuing ? 'Rescuing peers…' : 'Rescue peer associations at this location'}
                  variant={rescuing ? 'disabled' : 'default'}
                  onClick={handleRescueAssociations}
                />
              )}
              {vaultMissing && (
                <ActionButton
                  icon={vaultProvisioning ? RefreshCw : Key}
                  label={vaultProvisioning ? 'Provisioning vault…' : "Provision this cluster's encryption identity"}
                  variant={vaultProvisioning ? 'disabled' : 'danger'}
                  onClick={handleProvisionVault}
                />
              )}
            </ActionPill>
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
            <p className="text-[9pt] text-tertiary mt-2">
              {assignedUsers.length} member{assignedUsers.length !== 1 ? 's' : ''}
            </p>
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
          editAnchor && clinic ? (
            <ActionPill shadow="sm">
              {onRequestDelete && (
                <ActionButton
                  icon={Trash2}
                  label="Delete cluster"
                  variant="danger"
                  onClick={() => { setEditAnchor(null); onRequestDelete() }}
                />
              )}
              <ActionButton
                icon={saving ? RefreshCw : Check}
                label={saving ? 'Saving…' : 'Save'}
                variant={saving ? 'disabled' : 'success'}
                onClick={handleSave}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {editAnchor && clinic && editFormBody}
      </PreviewOverlay>

      {/* Assigned Users — always rendered (when not in create mode) so the
          "Create user" FAB has a home even when the cluster is empty. */}
      {!isCreateMode && clinic && (
        <section className="mt-4">
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
              Assigned Users ({assignedUsers.length})
            </p>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
              {assignedUsers.length === 0 ? (
                <div className="px-4 py-3.5 text-[10pt] text-tertiary">No users assigned.</div>
              ) : (
                assignedUsers.map(renderUserRow)
              )}
            </div>
            {onCreateUserInCluster && (
              <ActionPill shadow="sm" placement="overlay">
                <ActionButton
                  icon={Plus}
                  label="Create user"
                  onClick={() => onCreateUserInCluster(clinic.id)}
                />
              </ActionPill>
            )}
          </div>
        </section>
      )}

      {/* Loaned In — read-only reverse view of profile_clinic_loans rows
          targeting this clinic. Edits happen from AdminUserDetail. */}
      {!isCreateMode && !editing && loanedInUsers.length > 0 && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
            Loaned In ({loanedInUsers.length})
          </p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
            {loanedInUsers.map(renderUserRow)}
          </div>
        </div>
      )}

      {/* Loaned Out — assigned users (home here) currently loaned to another
          clinic. Each row shows target clinic chips. Edit via the user row. */}
      {!isCreateMode && !editing && loanedOutUsers.length > 0 && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
            Loaned Out ({loanedOutUsers.length})
          </p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
            {loanedOutUsers.map((user) => {
              const targetIds = loanedOutMap.get(user.id) ?? []
              const targets = targetIds
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
            })}
          </div>
        </div>
      )}

      {/* ── Parent cluster ───────────────────────────────────────────── */}
      {!isCreateMode && clinic && (
        <section className="mt-4">
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Parent</p>
          </div>
          <div className="relative">
            <div className={`rounded-2xl bg-themewhite2 overflow-hidden${relBusy ? ' opacity-50 pointer-events-none' : ''}`}>
              {parentClinic ? (
                <button
                  type="button"
                  onClick={(e) => {
                    setRelAction({ kind: 'parent-row', x: e.clientX, y: e.clientY, target: parentClinic })
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all active:scale-95 hover:bg-themeblue2/5"
                >
                  <span className="w-9 h-9 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-themeblue3" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{parentClinic.name}</p>
                    {parentClinic.uics.length > 0 && (
                      <p className="text-[9pt] text-tertiary mt-0.5 truncate">{parentClinic.uics.join(' · ')}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-tertiary shrink-0" />
                </button>
              ) : (
                <div className="px-4 py-3.5 text-[10pt] text-tertiary">No parent cluster.</div>
              )}
            </div>
            {!parentClinic && (
              <ActionPill ref={parentFabRef} shadow="sm" placement="overlay">
                <ActionButton
                  icon={Plus}
                  label="Set parent"
                  onClick={() => {
                    const rect = parentFabRef.current?.getBoundingClientRect() ?? null
                    if (rect) setRelAction({ kind: 'add-parent', rect })
                  }}
                />
              </ActionPill>
            )}
          </div>
        </section>
      )}

      {/* ── Sub-clusters ─────────────────────────────────────────────── */}
      {!isCreateMode && clinic && (
        <section className="mt-4">
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Sub-clusters</p>
          </div>
          <div className="relative">
            <div className={`rounded-2xl bg-themewhite2 overflow-hidden${relBusy ? ' opacity-50 pointer-events-none' : ''}`}>
              {subClinics.length === 0 ? (
                <div className="px-4 py-3.5 text-[10pt] text-tertiary">No sub-clusters.</div>
              ) : (
                subClinics.map((child, idx) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={(e) => {
                      setRelAction({ kind: 'child-row', x: e.clientX, y: e.clientY, target: child })
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all active:scale-95 hover:bg-themeblue2/5${idx < subClinics.length - 1 ? ' border-b border-primary/6' : ''}`}
                  >
                    <span className="w-9 h-9 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-themeblue2" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{child.name}</p>
                      {child.uics.length > 0 && (
                        <p className="text-[9pt] text-tertiary mt-0.5 truncate">{child.uics.join(' · ')}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-tertiary shrink-0" />
                  </button>
                ))
              )}
            </div>
            <ActionPill ref={childFabRef} shadow="sm" placement="overlay">
              <ActionButton
                icon={Plus}
                label="Add sub-cluster"
                onClick={() => {
                  const rect = childFabRef.current?.getBoundingClientRect() ?? null
                  if (rect) setRelAction({ kind: 'add-child', rect })
                }}
              />
            </ActionPill>
          </div>
        </section>
      )}

      {/* ── Associated clusters ──────────────────────────────────────── */}
      {!isCreateMode && clinic && (
        <section className="mt-4">
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Associated</p>
          </div>
          <div className="relative">
            <div className={`rounded-2xl bg-themewhite2 overflow-hidden${relBusy ? ' opacity-50 pointer-events-none' : ''}`}>
              {associatedClinics.length === 0 ? (
                <div className="px-4 py-3.5 text-[10pt] text-tertiary">No associated clusters.</div>
              ) : (
                associatedClinics.map((peer, idx) => (
                  <button
                    key={peer.id}
                    type="button"
                    onClick={(e) => {
                      setRelAction({ kind: 'assoc-row', x: e.clientX, y: e.clientY, target: peer })
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all active:scale-95 hover:bg-themeblue2/5${idx < associatedClinics.length - 1 ? ' border-b border-primary/6' : ''}`}
                  >
                    <span className="w-9 h-9 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-themeblue2" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{peer.name}</p>
                      {peer.uics.length > 0 && (
                        <p className="text-[9pt] text-tertiary mt-0.5 truncate">{peer.uics.join(' · ')}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-tertiary shrink-0" />
                  </button>
                ))
              )}
            </div>
            <ActionPill ref={assocFabRef} shadow="sm" placement="overlay">
              <ActionButton
                icon={Plus}
                label="Add associated"
                onClick={() => {
                  const rect = assocFabRef.current?.getBoundingClientRect() ?? null
                  if (rect) setRelAction({ kind: 'add-assoc', rect })
                }}
              />
            </ActionPill>
          </div>
        </section>
      )}

      {/* Row context menu — Open / Remove, anchored at tap point. */}
      {relAction && (relAction.kind === 'parent-row' || relAction.kind === 'child-row' || relAction.kind === 'assoc-row') && (() => {
        const target = relAction.target
        const removeLabel =
          relAction.kind === 'parent-row' ? 'Remove parent' :
          relAction.kind === 'child-row' ? 'Remove sub-cluster' :
          'Remove from associated'
        const onRemove = () => {
          if (relAction.kind === 'parent-row') return handleSetParent(null)
          if (relAction.kind === 'child-row') return handleRemoveChild(target.id)
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
          <ContextMenu
            x={relAction.x}
            y={relAction.y}
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
          relAction?.kind === 'add-child' ? 'Add sub-cluster' :
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
          <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5 flex flex-col">
            {onCreateRelatedCluster && clinic && relAction && (relAction.kind === 'add-parent' || relAction.kind === 'add-child' || relAction.kind === 'add-assoc') && (
              <ActionButton
                icon={Plus}
                label={
                  relAction.kind === 'add-parent' ? 'Create new parent cluster' :
                  relAction.kind === 'add-child' ? 'Create new sub-cluster' :
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
            <ActionButton icon={X} label="Cancel" onClick={() => setRelAction(null)} />
          </div>
        }
      />
    </div>
  )
}

export { AdminClinicDetail }
