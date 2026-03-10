/**
 * AdminCertsSection.tsx
 *
 * Manages certifications for a single user within the admin panel.
 * Supports inline editing, adding, deleting, and verification toggling
 * of certifications with badge-based UI and expandable forms.
 */

import { useState } from 'react'
import { Star, CheckCircle, X, Plus } from 'lucide-react'

import type { Certification } from '../../Data/User'
import type { AdminUser } from '../../lib/adminService'
import { credentials } from '../../Data/User'
import {
  updateCertification,
  verifyCertification,
  unverifyCertification,
  adminAddCertification,
  adminDeleteCertification,
  syncPrimaryToProfile,
} from '../../lib/certificationService'
import { getExpirationStatus, certBadgeColors } from './adminUtils'

interface AdminCertsSectionProps {
  userId: string
  certs: Certification[]
  currentUserId: string | null
  allUsers: AdminUser[]
  onChanged: () => void
}

/** Inline certification management section for admin user detail views */
export const AdminCertsSection = ({
  userId,
  certs,
  currentUserId,
  allUsers,
  onChanged,
}: AdminCertsSectionProps) => {
  const [editingCertId, setEditingCertId] = useState<string | null>(null)
  const [deletingCertId, setDeletingCertId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Edit-form state
  const [editTitle, setEditTitle] = useState('')
  const [editCertNumber, setEditCertNumber] = useState('')
  const [editIssueDate, setEditIssueDate] = useState('')
  const [editExpDate, setEditExpDate] = useState('')
  const [editIsPrimary, setEditIsPrimary] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add-form state
  const [addTitle, setAddTitle] = useState('')
  const [addCertNumber, setAddCertNumber] = useState('')
  const [addIssueDate, setAddIssueDate] = useState('')
  const [addExpDate, setAddExpDate] = useState('')
  const [addIsPrimary, setAddIsPrimary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const userMap = new Map(allUsers.map(u => [u.id, u]))

  const resolveName = (id: string): string => {
    const u = userMap.get(id)
    return u
      ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
      : id.slice(0, 8)
  }

  const openEdit = (cert: Certification) => {
    setDeletingCertId(null)
    setAdding(false)
    setEditingCertId(cert.id)
    setEditTitle(cert.title)
    setEditCertNumber(cert.cert_number || '')
    setEditIssueDate(cert.issue_date || '')
    setEditExpDate(cert.exp_date || '')
    setEditIsPrimary(cert.is_primary)
  }

  const openAdd = () => {
    setEditingCertId(null)
    setDeletingCertId(null)
    setAdding(true)
    setAddTitle('')
    setAddCertNumber('')
    setAddIssueDate('')
    setAddExpDate('')
    setAddIsPrimary(false)
    setAddError(null)
  }

  const handleSaveEdit = async () => {
    if (!editingCertId || !editTitle.trim()) return
    setSaving(true)
    const result = await updateCertification(editingCertId, {
      title: editTitle.trim(),
      cert_number: editCertNumber.trim() || null,
      issue_date: editIssueDate || null,
      exp_date: editExpDate || null,
      is_primary: editIsPrimary,
    })
    setSaving(false)
    if (result.success) {
      const cert = certs.find(c => c.id === editingCertId)
      if (cert && editIsPrimary !== cert.is_primary) {
        await syncPrimaryToProfile(cert.user_id)
      }
      setEditingCertId(null)
      onChanged()
    }
  }

  const handleVerify = async (certId: string) => {
    if (!currentUserId) return
    const result = await verifyCertification(certId, currentUserId)
    if (result.success) onChanged()
  }

  const handleUnverify = async (certId: string) => {
    const result = await unverifyCertification(certId)
    if (result.success) onChanged()
  }

  const handleDelete = async (certId: string, wasPrimary: boolean) => {
    const result = await adminDeleteCertification(certId, userId, wasPrimary)
    if (result.success) {
      setDeletingCertId(null)
      onChanged()
    }
  }

  const handleAdd = async () => {
    if (!addTitle.trim()) {
      setAddError('Title is required')
      return
    }
    setSubmitting(true)
    setAddError(null)
    const result = await adminAddCertification(userId, {
      title: addTitle.trim(),
      cert_number: addCertNumber.trim() || null,
      issue_date: addIssueDate || null,
      exp_date: addExpDate || null,
      is_primary: addIsPrimary,
    })
    setSubmitting(false)
    if (result.success) {
      setAdding(false)
      onChanged()
    } else {
      setAddError(result.error || 'Failed to add')
    }
  }

  return (
    <div className="mt-3 border-t border-tertiary/10 pt-2">
      {/* Badge row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {certs.map(cert => {
          const status = getExpirationStatus(cert.exp_date)
          const color = certBadgeColors[status]

          if (deletingCertId === cert.id) {
            return (
              <span
                key={cert.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-themeredred/10 text-themeredred border-themeredred/30"
              >
                Delete?
                <button
                  onClick={() => handleDelete(cert.id, cert.is_primary)}
                  className="font-semibold hover:underline"
                >
                  Yes
                </button>
                <span className="text-themeredred/40">/</span>
                <button
                  onClick={() => setDeletingCertId(null)}
                  className="font-semibold hover:underline"
                >
                  No
                </button>
              </span>
            )
          }

          return (
            <span
              key={cert.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${color}`}
            >
              <button onClick={() => openEdit(cert)} className="hover:underline">
                {cert.title}
              </button>
              {cert.is_primary && <Star size={9} className="fill-current" />}
              {cert.verified && <CheckCircle size={9} />}
              <button
                onClick={() => {
                  setEditingCertId(null)
                  setAdding(false)
                  setDeletingCertId(cert.id)
                }}
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <X size={10} />
              </button>
            </span>
          )
        })}

        {/* + Add badge */}
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-dashed border-tertiary/30 text-tertiary/50 hover:text-themeblue2 hover:border-themeblue2/40 transition-colors"
        >
          <Plus size={10} /> Add
        </button>
      </div>

      {/* Edit form (below badges) */}
      {editingCertId &&
        (() => {
          const cert = certs.find(c => c.id === editingCertId)
          if (!cert) return null
          const verifierName = cert.verified_by ? resolveName(cert.verified_by) : null
          return (
            <div className="mt-2 rounded-lg border border-themeblue2/30 bg-themewhite2 px-3 py-3 space-y-2.5">
              <p className="text-xs font-medium text-themeblue2 uppercase tracking-wide">
                Edit Certification
              </p>
              <label className="block">
                <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
                  Title
                </span>
                <input
                  type="text"
                  list={`cert-edit-sug-${userId}`}
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors"
                />
                <datalist id={`cert-edit-sug-${userId}`}>
                  {credentials.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
                  Cert Number
                </span>
                <input
                  type="text"
                  value={editCertNumber}
                  onChange={e => setEditCertNumber(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
                    Issue Date
                  </span>
                  <input
                    type="date"
                    value={editIssueDate}
                    onChange={e => setEditIssueDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
                    Exp Date
                  </span>
                  <input
                    type="date"
                    value={editExpDate}
                    onChange={e => setEditExpDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsPrimary}
                  onChange={e => setEditIsPrimary(e.target.checked)}
                  className="rounded border-tertiary/20 text-themeblue2 focus:ring-themeblue2/30"
                />
                <span className="text-sm text-primary">Primary certification</span>
              </label>
              {/* Verification status */}
              <div className="flex items-center gap-2 text-xs">
                {cert.verified ? (
                  <>
                    <span className="flex items-center gap-1 text-themegreen font-medium">
                      <CheckCircle size={11} /> Verified
                    </span>
                    {verifierName && (
                      <span className="text-tertiary/40">by {verifierName}</span>
                    )}
                    <button
                      onClick={() => handleUnverify(cert.id)}
                      className="text-tertiary/40 hover:text-themeredred transition-colors ml-auto"
                    >
                      Unverify
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-tertiary/50">Unverified</span>
                    <button
                      onClick={() => handleVerify(cert.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium bg-themeblue3 text-white hover:bg-themeblue3/90 transition-colors ml-auto"
                    >
                      <CheckCircle size={11} /> Verify
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editTitle.trim()}
                  className="flex-1 py-2 rounded-lg bg-themeblue3 text-white text-sm font-medium hover:bg-themeblue3/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingCertId(null)}
                  className="px-4 py-2 rounded-lg bg-tertiary/10 text-primary text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )
        })()}

      {/* Add form (below badges) */}
      {adding && (
        <div className="mt-2 rounded-lg border border-themeblue2/30 bg-themewhite px-3 py-3 space-y-2.5">
          <p className="text-xs font-medium text-themeblue2 uppercase tracking-wide">
            Add Certification
          </p>
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
              Title <span className="text-themeredred">*</span>
            </span>
            <input
              type="text"
              list={`cert-add-sug-${userId}`}
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              placeholder="e.g. EMT-B, ACLS, BSN"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30"
            />
            <datalist id={`cert-add-sug-${userId}`}>
              {credentials.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
              Cert Number
            </span>
            <input
              type="text"
              value={addCertNumber}
              onChange={e => setAddCertNumber(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
                Issue Date
              </span>
              <input
                type="date"
                value={addIssueDate}
                onChange={e => setAddIssueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
                Exp Date
              </span>
              <input
                type="date"
                value={addExpDate}
                onChange={e => setAddExpDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={addIsPrimary}
              onChange={e => setAddIsPrimary(e.target.checked)}
              className="rounded border-tertiary/20 text-themeblue2 focus:ring-themeblue2/30"
            />
            <span className="text-sm text-primary">Primary</span>
          </label>
          {addError && <p className="text-xs text-themeredred">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={submitting || !addTitle.trim()}
              className="flex-1 py-2 rounded-lg bg-themeblue3 text-white text-sm font-medium hover:bg-themeblue3/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-lg bg-tertiary/10 text-primary text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
