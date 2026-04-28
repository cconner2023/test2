/**
 * AdminCertsSection — certs for a single user inside the admin panel.
 * Thin wrapper around the shared CertificationRow / CertificationForm
 * primitives in Components/Certifications/. CRUD is gated behind the
 * parent's edit mode (header toolbar).
 */

import { useState, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { ConfirmDialog } from '../ConfirmDialog'
import {
  updateCertification,
  adminAddCertification,
  adminDeleteCertification,
  syncPrimaryToProfile,
} from '../../lib/certificationService'
import { CertificationRow } from '../Certifications/CertificationRow'
import { CertificationForm } from '../Certifications/CertificationForm'
import { emptyCertForm } from '../Certifications/certHelpers'
import type { CertFormData } from '../Certifications/certHelpers'
import { EmptyState } from '../EmptyState'

interface AdminCertsSectionProps {
  userId: string
  certs: Certification[]
  editing: boolean
  onChanged: () => void
}

export function AdminCertsSection({ userId, certs, editing, onChanged }: AdminCertsSectionProps) {
  const [mode, setMode] = useState<'view' | 'editing' | 'adding'>('view')
  const [editingCertId, setEditingCertId] = useState<string | null>(null)
  const [form, setForm] = useState<CertFormData>(emptyCertForm)
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDeletePrimary, setPendingDeletePrimary] = useState(false)

  const resetForm = useCallback(() => {
    setForm(emptyCertForm)
    setMode('view')
    setEditingCertId(null)
    setSaving(false)
  }, [])

  // Exit inline edit/add when parent exits edit mode
  useEffect(() => {
    if (!editing) resetForm()
  }, [editing, resetForm])

  const startEditing = useCallback((cert: Certification) => {
    setMode('editing')
    setEditingCertId(cert.id)
    setForm({
      title: cert.title,
      cert_number: cert.cert_number ?? '',
      issue_date: cert.issue_date ?? '',
      exp_date: cert.exp_date ?? '',
      is_primary: cert.is_primary,
    })
  }, [])

  const handleAdd = useCallback(async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const result = await adminAddCertification(userId, {
      title: form.title.trim(),
      cert_number: form.cert_number.trim() || null,
      issue_date: form.issue_date || null,
      exp_date: form.exp_date || null,
      is_primary: form.is_primary,
    })
    if (result.success) {
      resetForm()
      onChanged()
    } else {
      setSaving(false)
    }
  }, [form, userId, resetForm, onChanged])

  const handleEdit = useCallback(async (certId: string) => {
    if (!form.title.trim()) return
    setSaving(true)
    const result = await updateCertification(certId, {
      title: form.title.trim(),
      cert_number: form.cert_number.trim() || null,
      issue_date: form.issue_date || null,
      exp_date: form.exp_date || null,
      is_primary: form.is_primary,
    })
    if (result.success) {
      const cert = certs.find(c => c.id === certId)
      if (cert && form.is_primary !== cert.is_primary) {
        await syncPrimaryToProfile(cert.user_id)
      }
      resetForm()
      onChanged()
    } else {
      setSaving(false)
    }
  }, [form, certs, resetForm, onChanged])

  const handleDelete = useCallback(async (certId: string, wasPrimary: boolean) => {
    setSaving(true)
    await adminDeleteCertification(certId, userId, wasPrimary)
    setSaving(false)
    resetForm()
    onChanged()
  }, [userId, resetForm, onChanged])

  const showList = certs.length > 0 || (editing && mode === 'adding')

  return (
    <>
      {showList && (
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {editing && mode === 'adding' && (
            <CertificationForm
              form={form}
              onChange={setForm}
              mode="add"
              saving={saving}
              canSubmit={!!form.title.trim()}
              onSubmit={handleAdd}
              onCancel={resetForm}
              autoFocus
              datalistId={`add-${userId}`}
            />
          )}

          {certs.map((cert) => {
            const isEditingThis = editing && mode === 'editing' && editingCertId === cert.id
            if (isEditingThis) {
              return (
                <CertificationForm
                  key={cert.id}
                  form={form}
                  onChange={setForm}
                  mode="edit"
                  saving={saving}
                  canSubmit={!!form.title.trim()}
                  onSubmit={() => handleEdit(cert.id)}
                  onCancel={resetForm}
                  onDelete={() => {
                    setPendingDeleteId(cert.id)
                    setPendingDeletePrimary(cert.is_primary)
                  }}
                  datalistId={`edit-${cert.id}`}
                />
              )
            }
            return (
              <CertificationRow
                key={cert.id}
                cert={cert}
                onClick={editing && mode === 'view' ? () => startEditing(cert) : undefined}
              />
            )
          })}
        </div>
      )}

      {!showList && <EmptyState title="No certifications" />}

      {editing && mode === 'view' && (
        <button
          onClick={() => { setMode('adding'); setForm(emptyCertForm) }}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 rounded-lg border border-dashed border-tertiary/20 text-[10pt] text-tertiary hover:border-themeblue2 hover:text-themeblue2 transition-colors active:scale-95"
        >
          <Plus size={14} />
          Add Certification
        </button>
      )}

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title={`Delete "${certs.find(c => c.id === pendingDeleteId)?.title || 'this certification'}"?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (pendingDeleteId) {
            const id = pendingDeleteId
            const wasPrimary = pendingDeletePrimary
            setPendingDeleteId(null)
            await handleDelete(id, wasPrimary)
          }
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  )
}
