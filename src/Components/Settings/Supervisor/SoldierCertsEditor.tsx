import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import {
  adminAddCertification,
  updateCertification,
  adminDeleteCertification,
  syncPrimaryToProfile,
  type CertInput,
} from '../../../lib/certificationService'
import { credentials } from '../../../Data/User'
import { formatMedicName } from './supervisorHelpers'
import { getExpirationStatus } from '../../Certifications/certHelpers'
import { TextInput } from '../../FormInputs'
import { SwipeableCard, type SwipeAction } from '../../SwipeableCard'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'

interface SoldierCertsEditorProps {
  soldier: ClinicMedic
  certs: Certification[]
  currentUserId: string
  onUpdateCert: (certId: string, updates: Partial<Certification>) => void
  onAddCert?: (cert: Certification) => void
  onRemoveCert?: (certId: string) => void
  initialEditCertId?: string | null
}

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

const inputClasses = 'w-full px-3 py-2.5 rounded-lg text-primary text-base border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all placeholder:text-tertiary'

export function SoldierCertsEditor({
  soldier,
  certs,
  currentUserId,
  onUpdateCert,
  onAddCert,
  onRemoveCert,
  initialEditCertId,
}: SoldierCertsEditorProps) {
  const [mode, setMode] = useState<'view' | 'editing' | 'adding'>('view')
  const [editingCertId, setEditingCertId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)

  useEffect(() => {
    if (initialEditCertId && mode === 'view') {
      const cert = certs.find(c => c.id === initialEditCertId)
      if (cert) startEditing(cert)
    }
  }, []) // only on mount

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

    const result = await adminAddCertification(soldier.id, input)
    if (result.success) {
      const now = new Date().toISOString()
      const syntheticCert: Certification = {
        id: crypto.randomUUID(),
        user_id: soldier.id,
        title: form.title.trim(),
        cert_number: form.cert_number || null,
        issue_date: form.issue_date || null,
        exp_date: form.exp_date || null,
        is_primary: form.is_primary,
        verified: false,
        verified_by: null,
        verified_at: null,
        created_at: now,
        updated_at: now,
      }
      onAddCert?.(syntheticCert)
      resetForm()
    } else {
      setSaving(false)
    }
  }, [form, soldier.id, onAddCert, resetForm])

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

    const result = await updateCertification(certId, fields)
    if (result.success) {
      onUpdateCert(certId, {
        title: form.title.trim(),
        cert_number: form.cert_number || null,
        issue_date: form.issue_date || null,
        exp_date: form.exp_date || null,
        is_primary: form.is_primary,
      })
      if (form.is_primary) {
        await syncPrimaryToProfile(soldier.id)
      }
      resetForm()
    } else {
      setSaving(false)
    }
  }, [form, soldier.id, onUpdateCert, resetForm])

  const handleDelete = useCallback(async (cert: Certification) => {
    setSaving(true)
    const result = await adminDeleteCertification(cert.id, soldier.id, cert.is_primary)
    setSaving(false)
    if (result.success) {
      onRemoveCert?.(cert.id)
      setOpenSwipeId(null)
    }
  }, [soldier.id, onRemoveCert])

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
    { key: 'delete', label: 'Delete', icon: Trash2, iconBg: 'bg-themeredred/15', iconColor: 'text-themeredred', onAction: () => handleDelete(cert) },
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
          <span className="text-[9pt] text-tertiary">Primary</span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">Cert Number</span>
          <div className="mt-1">
            <TextInput
              value={form.cert_number}
              onChange={(val) => setForm(f => ({ ...f, cert_number: val }))}
              placeholder="Cert #"
            />
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">Issue Date</span>
          <input type="date" value={form.issue_date}
            onChange={(e) => setForm(f => ({ ...f, issue_date: e.target.value }))}
            className={`mt-1 ${inputClasses}`} />
        </div>
        <div>
          <span className="text-xs font-medium text-tertiary uppercase tracking-wide">Expiry Date</span>
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
    <div>
      {/* Header */}
      <div className="mb-4">
        <p className="text-lg font-semibold text-primary">{formatMedicName(soldier)}</p>
        <p className="text-xs text-tertiary mt-0.5">Certification Management</p>
      </div>

      {/* Add form at top */}
      {mode === 'adding' && renderEditCard(null)}

      {certs.length === 0 && mode !== 'adding' ? (
        <div className="text-center py-12">
          <p className="text-sm text-tertiary">No certifications on file</p>
        </div>
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
                        <span className="text-[9pt] md:text-[9pt] font-medium text-themeblue2 bg-themeblue2/10 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">Primary</span>
                      )}
                    </div>
                    <span className={`text-[9pt] md:text-[9pt] font-medium px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.text}</span>
                  </div>

                  <div className="flex items-center justify-between mt-1.5 text-xs text-tertiary">
                    <span>{cert.cert_number ? `#${cert.cert_number}` : 'No cert number'}</span>
                    <span>{cert.exp_date ? `Exp: ${formatDate(cert.exp_date)}` : 'No expiry'}</span>
                  </div>
                </div>
              </SwipeableCard>
            )
          })}
        </div>
      )}

      {/* Add Certification button */}
      {mode === 'view' && (
        <button
          onClick={() => { setMode('adding'); setForm(emptyForm) }}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-3 rounded-lg border border-dashed border-tertiary/20 text-xs text-tertiary hover:border-themeblue2 hover:text-themeblue2 transition-colors active:scale-95"
        >
          <Plus size={14} />
          Add Certification
        </button>
      )}
    </div>
  )
}
