/**
 * AdminClinicDetail.tsx
 *
 * Displays the full detail view for a single clinic using the settings card
 * system: metadata rows for clinic info, then settings-style user rows for
 * assigned and additional users. Edit and delete are handled by AdminDrawer header.
 */

import { useEffect, useCallback, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { UserAvatar } from '../Settings/UserAvatar'
import { listClinics, listAllUsers, updateClinic } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { fetchAllCertifications } from '../../lib/certificationService'
import type { Certification } from '../../Data/User'
import {
  formatLastActive,
  lastActiveColor,
} from './adminUtils'
import { TextInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { ChipInput, UserPicker, ClinicPicker } from './AdminPickers'

interface AdminClinicDetailProps {
  clinic: AdminClinic
  onClinicUpdated: (clinic: AdminClinic) => void
  onSelectUser?: (user: AdminUser) => void
  editing: boolean
  onEditingChange: (editing: boolean) => void
  saveRequested: boolean
  onSaveComplete: () => void
  onPendingChangesChange?: (hasPending: boolean) => void
}

const AdminClinicDetail = ({
  clinic,
  onClinicUpdated,
  onSelectUser,
  editing,
  onEditingChange,
  saveRequested,
  onSaveComplete,
  onPendingChangesChange,
}: AdminClinicDetailProps) => {
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])

  // Edit state
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editUics, setEditUics] = useState<string[]>([])
  const [editChildClinicIds, setEditChildClinicIds] = useState<string[]>([])
  const [editAssociatedClinicIds, setEditAssociatedClinicIds] = useState<string[]>([])
  const [editAdditionalUserIds, setEditAdditionalUserIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Load clinics, users, and certifications. */
  const loadData = useCallback(async () => {
    const [fetchedClinics, fetchedUsers, certData] = await Promise.all([
      listClinics(),
      listAllUsers(),
      fetchAllCertifications(),
    ])
    setClinics(fetchedClinics)
    setUsers(fetchedUsers)
    setAllCerts(certData)

    // Keep parent in sync with latest clinic data
    const refreshed = fetchedClinics.find((c) => c.id === clinic.id)
    if (refreshed) onClinicUpdated(refreshed)
  }, [clinic.id, onClinicUpdated])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** Populate edit fields when entering edit mode. */
  useEffect(() => {
    if (editing) {
      setEditName(clinic.name)
      setEditLocation(clinic.location ?? '')
      setEditUics([...clinic.uics])
      setEditChildClinicIds([...clinic.child_clinic_ids])
      setEditAssociatedClinicIds([...clinic.associated_clinic_ids])
      setEditAdditionalUserIds([...clinic.additional_user_ids])
      setError(null)
    }
  }, [editing, clinic])

  /** Track pending changes. */
  useEffect(() => {
    if (!editing) { onPendingChangesChange?.(false); return }
    const changed =
      editName !== clinic.name ||
      editLocation !== (clinic.location ?? '') ||
      JSON.stringify(editUics) !== JSON.stringify(clinic.uics) ||
      JSON.stringify(editChildClinicIds) !== JSON.stringify(clinic.child_clinic_ids) ||
      JSON.stringify(editAssociatedClinicIds) !== JSON.stringify(clinic.associated_clinic_ids) ||
      JSON.stringify(editAdditionalUserIds) !== JSON.stringify(clinic.additional_user_ids)
    onPendingChangesChange?.(changed)
  }, [editing, editName, editLocation, editUics, editChildClinicIds, editAssociatedClinicIds, editAdditionalUserIds, clinic, onPendingChangesChange])

  const handleSave = useCallback(async () => {
    if (!editName.trim()) {
      setError('Clinic name is required')
      return
    }
    setSaving(true)
    setError(null)
    const result = await updateClinic(clinic.id, {
      name: editName.trim(),
      location: editLocation.trim() || null,
      uics: editUics,
      child_clinic_ids: editChildClinicIds,
      associated_clinic_ids: editAssociatedClinicIds,
      additional_user_ids: editAdditionalUserIds,
    })
    setSaving(false)
    if (result.success) {
      onEditingChange(false)
      loadData()
    } else {
      setError(result.error || 'Failed to update clinic')
    }
  }, [editName, editLocation, editUics, editChildClinicIds, editAssociatedClinicIds, editAdditionalUserIds, clinic.id, onEditingChange, loadData])

  useEffect(() => {
    if (saveRequested) {
      handleSave()
      onSaveComplete()
    }
  }, [saveRequested, handleSave, onSaveComplete])

  /** Users whose clinic_id matches this clinic. */
  const assignedUsers = useMemo(
    () => users.filter((u) => u.clinic_id === clinic.id),
    [users, clinic.id],
  )

  /** Users referenced by additional_user_ids (resolved from full user list). */
  const additionalUsers = useMemo(
    () => users.filter((u) => clinic.additional_user_ids.includes(u.id)),
    [users, clinic.additional_user_ids],
  )

  /** Additional users who are NOT already in assignedUsers. */
  const additionalOnly = useMemo(
    () => additionalUsers.filter((u) => u.clinic_id !== clinic.id),
    [additionalUsers, clinic.id],
  )

  /** All users to show (assigned + additional, deduplicated). */
  const allClinicUsers = useMemo(() => {
    const seen = new Set<string>()
    const result: AdminUser[] = []
    for (const u of [...assignedUsers, ...additionalUsers]) {
      if (!seen.has(u.id)) {
        seen.add(u.id)
        result.push(u)
      }
    }
    return result
  }, [assignedUsers, additionalUsers])

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

  const buildUserSubtitle = (user: AdminUser) => {
    const userCerts = certsByUser.get(user.id) || []
    const parts: string[] = []
    if (user.credential) parts.push(user.credential)
    userCerts.filter((c) => !c.is_primary).forEach((c) => parts.push(c.title))
    parts.push(formatLastActive(user.last_active_at))
    return parts.filter(Boolean).join(' · ')
  }

  const renderUserRow = (user: AdminUser) => (
    <button
      key={user.id}
      onClick={() => onSelectUser?.(user)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelectUser?.(user) }}
      tabIndex={0}
      className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5"
    >
      <UserAvatar
        avatarId={user.avatar_id}
        firstName={user.first_name}
        lastName={user.last_name}
        className="w-9 h-9"
      />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-primary truncate">
          {user.first_name || ''} {user.middle_initial || ''}{' '}
          {user.last_name || ''}
        </p>
        <p className="text-[11px] text-tertiary/70 mt-0.5 truncate flex items-center gap-1">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${lastActiveColor(user.last_active_at)}`}
          />
          {buildUserSubtitle(user)}
        </p>
      </div>
      <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
    </button>
  )

  return (
    <div className={saving ? 'opacity-50 pointer-events-none' : undefined}>
      {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}

      {/* Main card — consolidated info (view) or all edit fields (edit) */}
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
        {editing ? (
          <div className="px-4 py-3.5 space-y-3">
            <TextInput label="Name" value={editName} onChange={setEditName} placeholder="Clinic name..." />
            <TextInput label="Location" value={editLocation} onChange={setEditLocation} placeholder="Location..." />
            <ChipInput label="UICs" values={editUics} onChange={setEditUics} placeholder="Add UIC..." transform={v => v.toUpperCase()} />
            <ClinicPicker label="Sub-clinics" selectedIds={editChildClinicIds} allClinics={clinics} excludeId={clinic.id} onChange={setEditChildClinicIds} />
            <ClinicPicker label="Associated Clinics" selectedIds={editAssociatedClinicIds} allClinics={clinics} excludeId={clinic.id} onChange={setEditAssociatedClinicIds} />
            <UserPicker label="Additional Users" selectedIds={editAdditionalUserIds} allUsers={users} onChange={setEditAdditionalUserIds} />
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-primary">{clinic.name}</p>
            {clinic.location && (
              <p className="text-[11px] text-tertiary/60 mt-0.5">{clinic.location}</p>
            )}
            {clinic.uics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {clinic.uics.map((uic) => (
                  <span key={uic} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30">
                    {uic}
                  </span>
                ))}
              </div>
            )}
            {clinic.child_clinic_ids.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {clinic.child_clinic_ids.map((cid) => {
                  const child = clinics.find((c) => c.id === cid)
                  return (
                    <span key={cid} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
                      {child ? child.name : cid.slice(0, 8)}
                    </span>
                  )
                })}
              </div>
            )}
            <p className="text-[11px] text-tertiary/50 mt-2">
              {assignedUsers.length} member{assignedUsers.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Assigned Users */}
      {assignedUsers.length > 0 && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
            Assigned Users ({assignedUsers.length})
          </p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
            {assignedUsers.map(renderUserRow)}
          </div>
        </div>
      )}

      {/* Additional Users — view mode only (edit mode has UserPicker in main card) */}
      {!editing && additionalOnly.length > 0 && (
        <div className="mt-4">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
            Additional Users ({additionalOnly.length})
          </p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
            {additionalOnly.map(renderUserRow)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!editing && allClinicUsers.length === 0 && (
        <div className="text-center py-8 mt-4">
          <p className="text-tertiary/60 text-sm">No users assigned to this clinic</p>
        </div>
      )}
    </div>
  )
}

export default AdminClinicDetail
