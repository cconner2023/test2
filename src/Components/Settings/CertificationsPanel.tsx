import { useState, useCallback, useRef, useEffect } from 'react'
import { Award, Trash2, X, Check, RefreshCw } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { useCertifications } from '../../Hooks/useCertifications'
import { credentials } from '../../Data/User'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { getExpirationStatus } from './Supervisor/supervisorHelpers'
import { ToggleSwitch } from './ToggleSwitch'
import { DatePickerInput } from '../FormInputs'
import type { CertInput } from '../../lib/certificationService'
import type { Certification } from '../../Data/User'

const emptyForm = { title: '', cert_number: '', issue_date: '', exp_date: '', is_primary: false }

function statusLabel(s: string) {
  switch (s) {
    case 'valid': return { text: 'Valid', cls: 'text-themegreen bg-themegreen/10' }
    case 'expiring': return { text: 'Expiring', cls: 'text-themeyellow bg-themeyellow/10' }
    case 'expired': return { text: 'Expired', cls: 'text-themeredred bg-themeredred/10' }
    default: return { text: 'No Date', cls: 'text-tertiary bg-tertiary/5' }
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const pillInput = 'w-full rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary transition-all duration-300'


export const CertificationsPanel = () => {
  const { certs, loading, addCert, updateCert, removeCert } = useCertifications()
  const showLoading = useMinLoadTime(loading)

  const [mode, setMode] = useState<'view' | 'editing' | 'adding'>('view')
  const [editingCertId, setEditingCertId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDeletePrimary, setPendingDeletePrimary] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === 'adding') {
      // Small delay to let the expand animation start before focusing
      const t = setTimeout(() => titleInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [mode])

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

  const renderEditForm = (certId: string | null) => (
    <div className="px-4 py-3 bg-tertiary/5 space-y-2">
      <input
        ref={certId === null ? titleInputRef : undefined}
        type="text"
        list="cert-title-suggestions"
        value={form.title}
        onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="Certification title *"
        className={pillInput}
      />

      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          value={form.cert_number}
          onChange={(e) => setForm(f => ({ ...f, cert_number: e.target.value }))}
          placeholder="Cert #"
          className={pillInput}
        />
        <DatePickerInput
          value={form.issue_date}
          onChange={(val) => setForm(f => ({ ...f, issue_date: val }))}
          placeholder="Issued"
        />
        <DatePickerInput
          value={form.exp_date}
          onChange={(val) => setForm(f => ({ ...f, exp_date: val }))}
          placeholder="Expires"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          onClick={() => setForm(f => ({ ...f, is_primary: !f.is_primary }))}
        >
          <span className="text-sm text-primary">Primary</span>
          <ToggleSwitch checked={form.is_primary} />
        </label>

        <button
          onClick={resetForm}
          disabled={saving}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
        >
          <X size={18} />
        </button>

        {mode === 'editing' && certId && (
          <button
            onClick={() => {
              const cert = certs.find(c => c.id === certId)
              if (cert) {
                setPendingDeleteId(cert.id)
                setPendingDeletePrimary(cert.is_primary)
              }
            }}
            disabled={saving}
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
          >
            <Trash2 size={18} />
          </button>
        )}

        <button
          onClick={() => mode === 'adding' ? handleAdd() : certId && handleEdit(certId)}
          disabled={saving || !form.title.trim()}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
        </button>
      </div>

      <datalist id="cert-title-suggestions">
        {credentials.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-5">
        <p className="text-xs text-tertiary leading-relaxed">
          Manage your credentials and certification status.
        </p>

        {showLoading ? (
          <LoadingSpinner label="Loading certifications..." className="py-12 text-tertiary" />
        ) : (
          <>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
              {/* Inline creation block */}
              <div className={`overflow-hidden transition-all duration-300 ease-out ${
                mode === 'view' ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="px-4 pt-3 pb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                      <input
                        type="text"
                        value=""
                        onFocus={() => { setMode('adding'); setForm(emptyForm) }}
                        placeholder="Add certification..."
                        className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded creation form */}
              <div className={`overflow-hidden transition-all duration-300 ease-out ${
                mode === 'adding' ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                {renderEditForm(null)}
              </div>

              {certs.length === 0 && mode !== 'adding' && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-tertiary text-center py-4">No certifications added yet</p>
                </div>
              )}

              {certs.map((cert) => {
                  const status = getExpirationStatus(cert.exp_date)
                  const badge = statusLabel(status)
                  const isEditing = mode === 'editing' && editingCertId === cert.id

                  if (isEditing) {
                    return <div key={cert.id}>{renderEditForm(cert.id)}</div>
                  }

                  return (
                    <div
                      key={cert.id}
                      className="px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                      onClick={() => mode === 'view' && startEditing(cert)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && mode === 'view') {
                          e.preventDefault()
                          startEditing(cert)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                            <Award size={18} className="text-tertiary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-primary truncate">{cert.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9pt] text-tertiary">
                                {cert.cert_number ? `#${cert.cert_number}` : 'No cert number'}
                              </span>
                              {cert.is_primary && (
                                <>
                                  <span className="text-[9pt] text-tertiary">&middot;</span>
                                  <span className="text-[9pt] text-tertiary">Primary</span>
                                </>
                              )}
                              {cert.exp_date && (
                                <>
                                  <span className="text-[9pt] text-tertiary">&middot;</span>
                                  <span className="text-[9pt] text-tertiary">{formatDate(cert.exp_date)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`text-[9pt] md:text-[9pt] font-medium px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.text}</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </>
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
