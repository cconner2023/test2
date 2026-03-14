import { useState, useCallback } from 'react'
import { Award, Plus, Trash2, Pencil } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { SwipeableCard, type SwipeAction } from '../SwipeableCard'
import { useCertifications } from '../../Hooks/useCertifications'
import { credentials } from '../../Data/User'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { getExpirationStatus } from './Supervisor/supervisorHelpers'
import { TextInput } from '../FormInputs'
import type { CertInput } from '../../lib/certificationService'
import type { Certification } from '../../Data/User'

const emptyForm = { title: '', cert_number: '', issue_date: '', exp_date: '', is_primary: false }

function statusLabel(s: string) {
  switch (s) {
    case 'valid': return { text: 'Valid', cls: 'text-themegreen bg-themegreen/10' }
    case 'expiring': return { text: 'Expiring', cls: 'text-themeyellow bg-themeyellow/10' }
    case 'expired': return { text: 'Expired', cls: 'text-themeredred bg-themeredred/10' }
    default: return { text: 'No Date', cls: 'text-tertiary/50 bg-tertiary/5' }
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const inputClasses = 'w-full px-3 py-2.5 rounded-lg text-primary text-base border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all placeholder:text-tertiary/30'

export const CertificationsPanel = () => {
  const { certs, loading, addCert, updateCert, removeCert } = useCertifications()
  const showLoading = useMinLoadTime(loading)

  const [mode, setMode] = useState<'view' | 'editing' | 'adding'>('view')
  const [editingCertId, setEditingCertId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setForm(emptyForm)
    setMode('view')
    setEditingCertId(null)
    setSaving(false)
  }, [])

  const handleAdd = useCallback(async () => {
    if (!form.title.trim()) return
    setSaving(true)

    const input: CertInput = {
      title: form.title,
      cert_number: form.cert_number || null,
      issue_date: form.issue_date || null,
      exp_date: form.exp_date || null,
      is_primary: form.is_primary,
    }

    const result = await addCert(input)
    if (result.success) {
      resetForm()
    } else {
      setSaving(false)
    }
  }, [form, addCert, resetForm])

  const handleEdit = useCallback(async (certId: string) => {
    if (!form.title.trim()) return
    setSaving(true)

    const fields: Partial<CertInput> = {
      title: form.title,
      cert_number: form.cert_number || null,
      issue_date: form.issue_date || null,
      exp_date: form.exp_date || null,
      is_primary: form.is_primary,
    }

    const result = await updateCert(certId, fields)
    if (result.success) {
      resetForm()
    } else {
      setSaving(false)
    }
  }, [form, updateCert, resetForm])

  const handleDelete = useCallback(async (certId: string, wasPrimary: boolean) => {
    setSaving(true)
    const result = await removeCert(certId, wasPrimary)
    setSaving(false)
    if (result.success) setOpenSwipeId(null)
  }, [removeCert])

  const startEditing = useCallback((cert: Certification) => {
    setOpenSwipeId(null)
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

  const buildActions = useCallback((cert: Certification): SwipeAction[] => [
    { key: 'edit', label: 'Edit', icon: Pencil, iconBg: 'bg-themeblue2/15', iconColor: 'text-themeblue2', onAction: () => startEditing(cert) },
    { key: 'delete', label: 'Delete', icon: Trash2, iconBg: 'bg-themeredred/15', iconColor: 'text-themeredred', onAction: () => handleDelete(cert.id, cert.is_primary) },
  ], [startEditing, handleDelete])

  const renderEditCard = (certId: string | null) => (
    <div className="rounded-lg border border-themeblue2/30 bg-themewhite2 px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          list="cert-title-suggestions"
          value={form.title}
          onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Certification title"
          className={inputClasses}
        />
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
          <input type="checkbox" checked={form.is_primary}
            onChange={(e) => setForm(f => ({ ...f, is_primary: e.target.checked }))}
            className="rounded border-tertiary/20 text-themeblue2 focus:ring-themeblue2" />
          <span className="text-[10px] text-tertiary/50">Primary</span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Cert Number</span>
          <div className="mt-1">
            <TextInput
              value={form.cert_number}
              onChange={(val) => setForm(f => ({ ...f, cert_number: val }))}
              placeholder="Cert #"
            />
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Issue Date</span>
          <input type="date" value={form.issue_date}
            onChange={(e) => setForm(f => ({ ...f, issue_date: e.target.value }))}
            className={`mt-1 ${inputClasses}`} />
        </div>
        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Expiry Date</span>
          <input type="date" value={form.exp_date}
            onChange={(e) => setForm(f => ({ ...f, exp_date: e.target.value }))}
            className={`mt-1 ${inputClasses}`} />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-tertiary/5">
        <button
          onClick={() => mode === 'adding' ? handleAdd() : certId && handleEdit(certId)}
          disabled={saving || !form.title.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-themeblue3 text-white disabled:opacity-50 active:scale-95 transition-all">
          {saving ? 'Saving...' : mode === 'adding' ? 'Add' : 'Save'}
        </button>
        <button onClick={resetForm} disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-tertiary/10 text-primary active:scale-95 transition-all">
          Cancel
        </button>
      </div>

      <datalist id="cert-title-suggestions">
        {credentials.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-primary">Certifications</h2>
          <p className="text-sm text-tertiary/60 mt-1">
            Manage your credentials and certification status.
          </p>
        </div>

        {showLoading ? (
          <LoadingSpinner label="Loading certifications..." className="py-12 text-tertiary" />
        ) : (
          <div>
            {mode === 'adding' && renderEditCard(null)}

            {certs.length === 0 && mode !== 'adding' ? (
              <EmptyState
                icon={<Award size={28} />}
                title="No certifications added yet"
              />
            ) : (
              <div className="space-y-3">
                {certs.map((cert) => {
                  const status = getExpirationStatus(cert.exp_date)
                  const badge = statusLabel(status)
                  const isEditing = mode === 'editing' && editingCertId === cert.id

                  if (isEditing) {
                    return <div key={cert.id}>{renderEditCard(cert.id)}</div>
                  }

                  return (
                    <SwipeableCard
                      key={cert.id}
                      actions={buildActions(cert)}
                      isOpen={openSwipeId === cert.id}
                      enabled={mode === 'view'}
                      onOpen={() => setOpenSwipeId(cert.id)}
                      onClose={() => setOpenSwipeId(null)}
                      onTap={() => setOpenSwipeId(openSwipeId === cert.id ? null : cert.id)}
                    >
                      <div className="rounded-lg border border-tertiary/10 bg-themewhite2 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium text-primary truncate">{cert.title}</p>
                            {cert.is_primary && (
                              <span className="text-[9px] font-medium text-themeblue2 bg-themeblue2/10 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">Primary</span>
                            )}
                          </div>
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.text}</span>
                        </div>

                        <div className="flex items-center justify-between mt-1.5 text-xs text-tertiary/50">
                          <span>{cert.cert_number ? `#${cert.cert_number}` : 'No cert number'}</span>
                          <span>{cert.exp_date ? `Exp: ${formatDate(cert.exp_date)}` : 'No expiry'}</span>
                        </div>
                      </div>
                    </SwipeableCard>
                  )
                })}
              </div>
            )}

            {mode === 'view' && (
              <button
                onClick={() => { setMode('adding'); setForm(emptyForm) }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-3 rounded-lg border border-dashed border-tertiary/20 text-xs text-tertiary/50 hover:border-themeblue2 hover:text-themeblue2 transition-colors active:scale-95"
              >
                <Plus size={14} />
                Add Certification
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
