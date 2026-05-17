/**
 * AdminClinicDetail.tsx
 *
 * Displays the full detail view for a single clinic using the settings card
 * system: metadata rows for clinic info, then settings-style user rows for
 * assigned and additional users. Edit and delete are handled by AdminDrawer header.
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { X, Plus, RefreshCw } from 'lucide-react'
import { UserRow } from '../UserRow'
import { ActionButton } from '../ActionButton'
import { listClinics, listAllUsers, listLocations, updateClinic, createClinic, rescueClinicAssociationsByLocation } from '../../lib/adminService'
import type { AdminUser, AdminClinic, AdminLocation, ClinicRoom } from '../../lib/adminService'
import { formatLastActive } from './adminUtils'
import { TextInput, UicPinInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { ClinicMultiPickerInput, ClinicParentPickerInput, LocationPickerInput } from './AdminPickers'
import { invalidate } from '../../stores/useInvalidationStore'
import { sameStringSet } from '../../Utilities/arrayEquals'
import { ActionPill } from '../ActionPill'
import { EmptyState } from '../EmptyState'

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
}: AdminClinicDetailProps) => {
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [locations, setLocations] = useState<AdminLocation[]>([])

  // Edit state
  const [editName, setEditName] = useState('')
  const [editLocationId, setEditLocationId] = useState<string | null>(null)
  const [editUics, setEditUics] = useState<string[]>([])
  const [editParentClinicId, setEditParentClinicId] = useState<string | null>(null)
  const [editAssociatedClinicIds, setEditAssociatedClinicIds] = useState<string[]>([])
  const [editRooms, setEditRooms] = useState<ClinicRoom[]>([])
  const [roomDraft, setRoomDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uicDraft, setUicDraft] = useState('')
  const [uicError, setUicError] = useState<string | null>(null)
  const [uicOwner, setUicOwner] = useState<AdminClinic | null>(null)
  const [rescuing, setRescuing] = useState(false)
  const [rescueResult, setRescueResult] = useState<string | null>(null)

  const isCreateMode = clinic === null

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

    if (!isCreateMode) {
      const refreshed = fetchedClinics.find((c) => c.id === clinic?.id)
      if (refreshed) onClinicUpdatedRef.current(refreshed)
    }
  }, [isCreateMode, clinic?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** Populate edit fields only when entering edit mode (not on every clinic ref change). */
  const prevEditingRef = useRef(false)
  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      setEditName(clinic?.name ?? '')
      setEditLocationId(clinic?.location_id ?? null)
      setEditUics([...(clinic?.uics ?? [])])
      setEditParentClinicId(clinic?.parent_clinic_id ?? null)
      setEditAssociatedClinicIds([...(clinic?.associated_clinic_ids ?? [])])
      setEditRooms((clinic?.rooms ?? []).map(r => ({ ...r })))
      setRoomDraft('')
      setError(null)
    }
    prevEditingRef.current = editing
  }, [editing, clinic])

  /** Track pending changes. */
  useEffect(() => {
    if (!editing) { onPendingChangesChange?.(false); return }
    const roomsChanged =
      JSON.stringify(editRooms) !== JSON.stringify(clinic?.rooms ?? [])
    const changed =
      editName !== (clinic?.name ?? '') ||
      editLocationId !== (clinic?.location_id ?? null) ||
      !sameStringSet(editUics, clinic?.uics ?? []) ||
      editParentClinicId !== (clinic?.parent_clinic_id ?? null) ||
      !sameStringSet(editAssociatedClinicIds, clinic?.associated_clinic_ids ?? []) ||
      roomsChanged
    onPendingChangesChange?.(changed)
  }, [editing, editName, editLocationId, editUics, editParentClinicId, editAssociatedClinicIds, editRooms, clinic, onPendingChangesChange])

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
      rooms: editRooms,
    }

    if (isCreateMode) {
      const result = await createClinic({ ...payload, location_id: editLocationId })
      setSaving(false)
      if (result.success && result.id) {
        if (result.warnings?.length) {
          setError(`Cluster created, but: ${result.warnings.join('; ')}`)
        }
        onCreated?.(result.id)
      } else {
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
  }, [editName, editLocationId, editUics, editParentClinicId, editAssociatedClinicIds, editRooms, isCreateMode, clinic, onEditingChange, loadData, onCreated])

  const handleAddRoom = useCallback(() => {
    const trimmed = roomDraft.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    if (editRooms.some(r => r.name.toLowerCase() === lower)) return
    const nextSort = editRooms.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1
    setEditRooms(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed, sort_order: nextSort },
    ])
    setRoomDraft('')
  }, [roomDraft, editRooms])

  const handleRenameRoom = useCallback((id: string, name: string) => {
    setEditRooms(prev => prev.map(r => r.id === id ? { ...r, name } : r))
  }, [])

  const handleDeleteRoom = useCallback((id: string) => {
    setEditRooms(prev => prev.filter(r => r.id !== id))
  }, [])

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

  /** Users currently loaned IN to this clinic (their surrogate_clinic_id matches). */
  const loanedInUsers = useMemo(
    () => isCreateMode ? [] : users.filter((u) => u.surrogate_clinic_id === clinic?.id),
    [users, clinic?.id, isCreateMode],
  )

  /** All users to show (assigned + loaned-in, deduplicated). */
  const allClinicUsers = useMemo(() => {
    const seen = new Set<string>()
    const result: AdminUser[] = []
    for (const u of [...assignedUsers, ...loanedInUsers]) {
      if (!seen.has(u.id)) {
        seen.add(u.id)
        result.push(u)
      }
    }
    return result
  }, [assignedUsers, loanedInUsers])

  const renderUserRow = (user: AdminUser) => (
    <UserRow
      key={user.id}
      avatarId={user.avatar_id}
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

  return (
    <div className={saving ? 'opacity-50 pointer-events-none' : undefined}>
      {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}

      {/* Main card — compact card in view, form inputs in edit */}
      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        {editing ? (
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

            <ClinicParentPickerInput
              value={editParentClinicId}
              allClinics={clinics}
              excludeId={clinic?.id ?? null}
              onChange={setEditParentClinicId}
            />
            <ClinicMultiPickerInput selectedIds={editAssociatedClinicIds} allClinics={clinics} excludeId={clinic?.id} onChange={setEditAssociatedClinicIds} placeholder="Add associated cluster" />

            {editRooms.length > 0 && (
              <div className="px-4 py-3 space-y-1.5 border-b border-primary/6">
                {[...editRooms]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((room) => (
                    <div key={room.id} className="flex items-center gap-2 rounded-md border border-themeblue3/20 bg-themeblue3/5 px-2 py-1">
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => handleRenameRoom(room.id, e.target.value)}
                        className="flex-1 bg-transparent text-sm text-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(room.id)}
                        className="shrink-0 text-tertiary hover:text-themeredred transition-colors"
                        title="Delete"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
            <div className="flex items-center border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <TextInput value={roomDraft} onChange={setRoomDraft} placeholder="Room name" />
              </div>
              <button
                type="button"
                onClick={handleAddRoom}
                disabled={!roomDraft.trim()}
                className="shrink-0 w-9 h-9 mr-3 rounded-full bg-themeblue3 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
            <p className="px-4 py-2 text-[9pt] text-tertiary">
              Deleting a room won't affect past events — they'll just stop showing the room pill.
            </p>
          </div>
        ) : clinic ? (
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-primary">{clinic.name}</p>
            {(() => {
              const loc = clinic.location_id ? locations.find(l => l.id === clinic.location_id) : null
              if (loc) {
                return (
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="text-[9pt] text-tertiary flex-1 min-w-0">
                      {loc.display_name}
                      {loc.command && <span className="ml-1.5">· {loc.command}</span>}
                    </p>
                    <button
                      type="button"
                      onClick={handleRescueAssociations}
                      disabled={rescuing}
                      title="Re-associate all clusters at this location"
                      aria-label="Rescue associations for this location"
                      className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9pt] text-tertiary hover:text-themeblue2 hover:bg-themeblue2/5 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw size={11} className={rescuing ? 'animate-spin' : ''} />
                      <span>{rescuing ? 'Rescuing…' : 'Rescue peers'}</span>
                    </button>
                  </div>
                )
              }
              if (clinic.location) {
                return <p className="text-[9pt] text-tertiary mt-0.5">{clinic.location}</p>
              }
              return null
            })()}
            {rescueResult && (
              <p className="mt-1 text-[9pt] text-themeblue2">{rescueResult}</p>
            )}
            {clinic.uics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {clinic.uics.map((uic) => (
                  <span key={uic} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9pt] md:text-[9pt] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30">
                    {uic}
                  </span>
                ))}
              </div>
            )}
            {(parentClinic || subClinics.length > 0) && (
              <div className="mt-2 space-y-1.5">
                {parentClinic && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[8pt] uppercase tracking-wider text-tertiary mr-1 shrink-0">Parent</span>
                    <button
                      type="button"
                      onClick={() => onSelectClinic?.(parentClinic)}
                      disabled={!onSelectClinic}
                      aria-label={`Open parent cluster ${parentClinic.name}`}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9pt] font-medium border bg-themeblue3/10 text-themeblue3 border-themeblue3/30 hover:bg-themeblue3/20 transition-colors active:scale-95 disabled:cursor-default disabled:hover:bg-themeblue3/10"
                    >
                      {parentClinic.name}
                    </button>
                  </div>
                )}
                {subClinics.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[8pt] uppercase tracking-wider text-tertiary mr-1 shrink-0">Sub-clusters</span>
                    {subClinics.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onSelectClinic?.(child)}
                        disabled={!onSelectClinic}
                        aria-label={`Open sub-cluster ${child.name}`}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9pt] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30 hover:bg-themeblue2/20 transition-colors active:scale-95 disabled:cursor-default disabled:hover:bg-themeblue2/10"
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {clinic.rooms.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[...clinic.rooms]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((room) => (
                    <span key={room.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9pt] font-medium border bg-themeblue3/10 text-themeblue3 border-themeblue3/30">
                      {room.name}
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

      {/* Assigned Users */}
      {!isCreateMode && assignedUsers.length > 0 && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
            Assigned Users ({assignedUsers.length})
          </p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
            {assignedUsers.map(renderUserRow)}
          </div>
        </div>
      )}

      {/* Loaned In — read-only reverse view of profiles.surrogate_clinic_id == this.id.
          Edits happen from the user side (AdminUserDetail surrogate picker). */}
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

      {!isCreateMode && !editing && allClinicUsers.length === 0 && (
        <EmptyState
          className="mt-4"
          title="No users assigned — set each user's home cluster from the Users tab."
        />
      )}
    </div>
  )
}

export { AdminClinicDetail }
