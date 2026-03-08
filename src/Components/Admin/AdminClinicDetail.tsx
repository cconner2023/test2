/**
 * AdminClinicDetail.tsx
 *
 * Displays the full detail view for a single clinic, including UIC badges,
 * child clinic badges, additional/assigned user lists, and inline delete
 * confirmation. Used inside AdminDrawer's clinic management flow.
 */

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, AlertTriangle, MapPin } from 'lucide-react'
import { listClinics, listAllUsers, deleteClinic } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'

interface AdminClinicDetailProps {
  clinic: AdminClinic
  onEdit: (clinic: AdminClinic) => void
  onBack: () => void
  onClinicUpdated: (clinic: AdminClinic) => void
}

const AdminClinicDetail = ({ clinic, onEdit, onBack, onClinicUpdated }: AdminClinicDetailProps) => {
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  /** Load clinics and users so we can resolve names and counts. */
  const loadData = useCallback(async () => {
    const [fetchedClinics, fetchedUsers] = await Promise.all([listClinics(), listAllUsers()])
    setClinics(fetchedClinics)
    setUsers(fetchedUsers)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** Users whose clinic_id matches this clinic. */
  const assignedUsers = users.filter((u) => u.clinic_id === clinic.id)

  /** Format a user for display -- full name when available, email fallback, truncated ID last resort. */
  const formatUser = (uid: string): string => {
    const u = users.find((usr) => usr.id === uid)
    if (!u) return uid.slice(0, 8)
    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim()
    return fullName || u.email
  }

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

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-primary">{clinic.name}</h3>
          {clinic.location && (
            <p className="text-sm text-tertiary/70 flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {clinic.location}
            </p>
          )}
        </div>
        <span className="px-2 py-0.5 rounded text-xs font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
          {assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* UIC badges */}
      {clinic.uics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {clinic.uics.map((uic) => (
            <span key={uic} className="px-2 py-0.5 rounded text-xs font-medium bg-themeyellow/10 text-themeyellow border border-themeyellow/30">
              {uic}
            </span>
          ))}
        </div>
      )}

      {/* Child clinic badges */}
      {clinic.child_clinic_ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {clinic.child_clinic_ids.map((cid) => {
            const child = clinics.find((c) => c.id === cid)
            return (
              <span key={cid} className="px-2 py-0.5 rounded text-xs font-medium bg-themeblue2/10 text-themeblue2 border border-themeblue2/30">
                {child ? child.name : cid.slice(0, 8)}
              </span>
            )
          })}
        </div>
      )}

      {/* Additional users */}
      {clinic.additional_user_ids.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-tertiary/50">Additional users: </span>
          <span className="text-xs text-primary">
            {clinic.additional_user_ids.map(formatUser).join(', ')}
          </span>
        </div>
      )}

      {/* Assigned users */}
      {assignedUsers.length > 0 && (
        <div className="mb-3 text-xs text-tertiary/50">
          Assigned: {assignedUsers.map((u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email).join(', ')}
        </div>
      )}

      {/* Delete confirmation inline */}
      {deleteConfirming && (
        <div className="p-3 bg-themeredred/10 rounded-lg mb-3 border border-themeredred/20">
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

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
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
    </>
  )
}

export default AdminClinicDetail
