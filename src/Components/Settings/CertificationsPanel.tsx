import { useState, useCallback } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import { useCertifications } from '../../Hooks/useCertifications'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import type { CertInput } from '../../lib/certificationService'
import type { Certification } from '../../Data/User'
import { CertificationRow } from '../Certifications/CertificationRow'
import { CertificationForm } from '../Certifications/CertificationForm'
import { emptyCertForm } from '../Certifications/certHelpers'
import type { CertFormData } from '../Certifications/certHelpers'

export const CertificationsPanel = () => {
  const { certs, loading, addCert, updateCert, removeCert } = useCertifications()
  const showLoading = useMinLoadTime(loading)

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

  const toInput = (): CertInput => ({
    title: form.title,
    cert_number: form.cert_number || null,
    issue_date: form.issue_date || null,
    exp_date: form.exp_date || null,
    is_primary: form.is_primary,
  })

  const handleAdd = useCallback(async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const result = await addCert(toInput())
    if (result.success) resetForm()
    else setSaving(false)
  }, [form, addCert, resetForm])

  const handleEdit = useCallback(async (certId: string) => {
    if (!form.title.trim()) return
    setSaving(true)
    const result = await updateCert(certId, toInput())
    if (result.success) resetForm()
    else setSaving(false)
  }, [form, updateCert, resetForm])

  const handleDelete = useCallback(async (certId: string, wasPrimary: boolean) => {
    setSaving(true)
    await removeCert(certId, wasPrimary)
    setSaving(false)
  }, [removeCert])

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

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-5">
        <p className="text-xs text-tertiary leading-relaxed">
          Manage your credentials and certification status.
        </p>

        {showLoading ? (
          <LoadingSpinner label="Loading certifications..." className="py-12 text-tertiary" />
        ) : (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {/* Inline "Add certification..." trigger — collapses when editing/adding */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
              mode === 'view' ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="px-4 pt-3 pb-1">
                <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                  <input
                    type="text"
                    value=""
                    onFocus={() => { setMode('adding'); setForm(emptyCertForm) }}
                    placeholder="Add certification..."
                    className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary"
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Expanded add form */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
              mode === 'adding' ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
              {mode === 'adding' && (
                <CertificationForm
                  form={form}
                  onChange={setForm}
                  mode="add"
                  saving={saving}
                  canSubmit={!!form.title.trim()}
                  onSubmit={handleAdd}
                  onCancel={resetForm}
                  autoFocus
                  datalistId="settings-add"
                />
              )}
            </div>

            {certs.length === 0 && mode !== 'adding' && (
              <div className="px-4 pb-3">
                <p className="text-xs text-tertiary text-center py-4">No certifications added yet</p>
              </div>
            )}

            {certs.map((cert) => {
              const isEditing = mode === 'editing' && editingCertId === cert.id
              if (isEditing) {
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
                    datalistId={`settings-edit-${cert.id}`}
                  />
                )
              }
              return (
                <CertificationRow
                  key={cert.id}
                  cert={cert}
                  onClick={mode === 'view' ? () => startEditing(cert) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title={`Delete "${certs.find(c => c.id === pendingDeleteId)?.title || 'this certification'}"?`}
        subtitle="Permanent."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (pendingDeleteId) {
            const id = pendingDeleteId
            const wasPrimary = pendingDeletePrimary
            setPendingDeleteId(null)
            await handleDelete(id, wasPrimary)
            resetForm()
          }
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  )
}
