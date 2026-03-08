/**
 * AdminClinicDetail.tsx
 *
 * Displays the full detail view for a single clinic as a styled card,
 * followed by a responsive grid of user cards for all assigned and
 * additional users. Keeps existing delete/edit actions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Pencil, Trash2, AlertTriangle, MapPin, Building2 } from 'lucide-react'
import { UserAvatar } from '../Settings/UserAvatar'
import { listClinics, listAllUsers, deleteClinic } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { fetchAllCertifications } from '../../lib/certificationService'
import type { Certification } from '../../Data/User'
import {
  formatLastActive,
  lastActiveColor,
  RoleBadge,
  CertBadges,
} from './adminUtils'

interface AdminClinicDetailProps {
  clinic: AdminClinic
  onEdit: (clinic: AdminClinic) => void
  onBack: () => void
  onClinicUpdated: (clinic: AdminClinic) => void
}

const AdminClinicDetail = ({ clinic, onEdit, onBack, onClinicUpdated }: AdminClinicDetailProps) => {
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleteProcessing, setDeleteProcessing] = useState(false)

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
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** Users whose clinic_id matches this clinic. */
  const assignedUsers = users.filter((u) => u.clinic_id === clinic.id)

  /** Users referenced by additional_user_ids (resolved from full user list). */
  const additionalUsers = users.filter((u) => clinic.additional_user_ids.includes(u.id))

  /** All users to show in the grid (assigned + additional, deduplicated). */
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

  /** Handle delete with name-confirmation guard. */
  const handleDelete = useCallback(async () => {
    if (deleteConfirmName !== clinic.name) return

    setDeleteProcessing(true)
    const result = await deleteClinic(clinic.id)
    setDeleteProcessing(false)

    if (result.success) {
      setDeleteConfirming(false)
      setDeleteConfirmName('')
      setFeedback({ type: 'success', message: 'Clinic deleted successfully' })
      onBack()
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to delete clinic' })
    }
  }, [deleteConfirmName, clinic.id, clinic.name, onBack])

  return (
    <>
      {/* Feedback banner */}
      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-themegreen/10 border border-themegreen/20 text-themegreen'
            : 'bg-themeredred/10 border border-themeredred/20 text-themeredred'
        }`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="float-right text-xs opacity-60 hover:opacity-100">
            dismiss
          </button>
        </div>
      )}

      {/* ── Clinic card ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-tertiary/15 bg-themewhite2 px-4 py-3.5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <Building2 size={18} className="text-tertiary/50" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{clinic.name}</p>
            {clinic.location && (
              <p className="text-[9pt] text-tertiary/50 flex items-center gap-1">
                <MapPin size={10} /> {clinic.location}
              </p>
            )}
          </div>

          <span className="shrink-0 px-2 py-0.5 rounded text-[9px] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
            {assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {clinic.uics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {clinic.uics.map((uic) => (
              <span
                key={uic}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30"
              >
                {uic}
              </span>
            ))}
          </div>
        )}

        {clinic.child_clinic_ids.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
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

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onEdit(clinic)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeblue2 text-white text-sm font-medium hover:bg-themeblue2/90 transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => { setDeleteConfirming(true); setDeleteConfirmName('') }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeredred/10 text-themeredred text-sm font-medium
                       hover:bg-themeredred/20 border border-themeredred/20 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation inline */}
      {deleteConfirming && (
        <div className="p-3 bg-themeredred/10 rounded-lg mb-4 border border-themeredred/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-themeredred shrink-0" />
            <p className="text-sm text-themeredred font-semibold">Delete this clinic?</p>
          </div>
          <p className="text-xs text-themeredred mb-2">
            Type <span className="font-mono font-semibold bg-themeredred/10 px-1 py-0.5 rounded">{clinic.name}</span> to confirm:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Type clinic name to confirm..."
              className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeredred/30 text-sm
                         focus:border-themeredred focus:outline-none transition-colors placeholder:text-tertiary/30"
              autoComplete="off"
            />
            <button
              onClick={handleDelete}
              disabled={deleteProcessing || deleteConfirmName !== clinic.name}
              className="px-3 py-2 rounded-lg bg-themeredred text-white text-sm font-medium
                         hover:bg-themeredred/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleteProcessing ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => { setDeleteConfirming(false); setDeleteConfirmName('') }}
              className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── User cards grid ─────────────────────────────────────── */}
      {allClinicUsers.length > 0 && (
        <>
          <p className="text-xs text-tertiary/50 mb-2">
            {allClinicUsers.length} member{allClinicUsers.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {allClinicUsers.map((user) => {
              const userCerts = certsByUser.get(user.id) || []
              const isAdditional = clinic.additional_user_ids.includes(user.id) && user.clinic_id !== clinic.id

              return (
                <div
                  key={user.id}
                  className="rounded-xl border border-tertiary/15 bg-themewhite2 px-4 py-3.5 space-y-2"
                >
                  {/* Row 1: Avatar + name + credential + last active + roles */}
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarId={user.avatar_id}
                      firstName={user.first_name}
                      lastName={user.last_name}
                      className="w-9 h-9"
                    />

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

                    <div className="flex gap-1 shrink-0">
                      {user.roles?.map((role) => (
                        <RoleBadge key={role} role={role} />
                      ))}
                    </div>
                  </div>

                  {/* Cert badges (non-primary only; primary is already shown as credential) */}
                  {userCerts.filter(c => !c.is_primary).length > 0 && (
                    <CertBadges certs={userCerts.filter(c => !c.is_primary)} />
                  )}

                  {/* UIC badge */}
                  {user.uic && (
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30">
                        {user.uic}
                      </span>
                      {isAdditional && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-tertiary/10 text-tertiary border-tertiary/30">
                          additional
                        </span>
                      )}
                    </div>
                  )}

                  {/* Show additional tag if no UIC but is additional user */}
                  {!user.uic && isAdditional && (
                    <div className="flex items-center">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-tertiary/10 text-tertiary border-tertiary/30">
                        additional
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {allClinicUsers.length === 0 && (
        <div className="text-center py-8">
          <p className="text-tertiary/60 text-sm">No users assigned to this clinic</p>
        </div>
      )}
    </>
  )
}

export default AdminClinicDetail
