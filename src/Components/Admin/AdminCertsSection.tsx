/**
 * AdminCertsSection.tsx
 *
 * Manages certifications for a single user within the admin panel.
 * Matches the Settings → Certifications panel pattern: each cert is a
 * card row with icon circle, title, subtitle, and status badge.
 * CRUD is gated behind the parent's edit mode (header toolbar).
 */

import { useState, useCallback, useEffect } from 'react'
import { Award, Plus, Trash2, X, Check, RefreshCw } from 'lucide-react'

import type { Certification } from '../../Data/User'
import { credentials } from '../../Data/User'
import { ConfirmDialog } from '../ConfirmDialog'
import { ToggleSwitch } from '../Settings/ToggleSwitch'
import {
  updateCertification,
  adminAddCertification,
  adminDeleteCertification,
  syncPrimaryToProfile,
} from '../../lib/certificationService'
import { getExpirationStatus } from './adminUtils'

// ─── Helpers ──────────────────────────────────────────────────────────

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

function toDisplayDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

function toIsoDate(display: string): string {
  const clean = display.replace(/[^0-9/]/g, '')
  const parts = clean.split('/')
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  }
  return ''
}

const pillInput = 'w-full rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary transition-all duration-300'

const emptyForm = { title: '', cert_number: '', issue_date: '', exp_date: '', is_primary: false }

// ─── Types ────────────────────────────────────────────────────────────

interface AdminCertsSectionProps {
  userId: string
  certs: Certification[]
  editing: boolean
  onChanged: () => void
}

// ─── Component ────────────────────────────────────────────────────────

export const AdminCertsSection = ({
  userId,
  certs,
  editing,
  onChanged,
}: AdminCertsSectionProps) => {
  const [mode, setMode] = useState<'view' | 'editing' | 'adding'>('view')
  const [editingCertId, setEditingCertId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDeletePrimary, setPendingDeletePrimary] = useState(false)

  // Reset internal state when parent exits edit mode
  useEffect(() => {
    if (!editing) resetForm()
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = useCallback(() => {
    setForm(emptyForm)
    setMode('view')
    setEditingCertId(null)
    setSaving(false)
  }, [])

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

  // ── Edit form (matches CertificationsPanel) ──────────────────────────

  const renderEditForm = (certId: string | null) => (
    <div className="px-4 py-3 bg-tertiary/5 space-y-2">
      <input
        type="text"
        list={`cert-sug-${userId}`}
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
        <input
          type="text"
          inputMode="numeric"
          value={toDisplayDate(form.issue_date)}
          onChange={(e) => {
            const raw = e.target.value
            setForm(f => ({ ...f, issue_date: toIsoDate(raw) || (raw ? f.issue_date : '') }))
          }}
          onBlur={(e) => {
            if (e.target.value && !toIsoDate(e.target.value)) {
              setForm(f => ({ ...f, issue_date: '' }))
            }
          }}
          placeholder="Issued (MM/DD/YYYY)"
          className={pillInput}
        />
        <input
          type="text"
          inputMode="numeric"
          value={toDisplayDate(form.exp_date)}
          onChange={(e) => {
            const raw = e.target.value
            setForm(f => ({ ...f, exp_date: toIsoDate(raw) || (raw ? f.exp_date : '') }))
          }}
          onBlur={(e) => {
            if (e.target.value && !toIsoDate(e.target.value)) {
              setForm(f => ({ ...f, exp_date: '' }))
            }
          }}
          placeholder="Expires (MM/DD/YYYY)"
          className={pillInput}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <label
          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          onClick={() => setForm(f => ({ ...f, is_primary: !f.is_primary }))}
        >
          <span className="text-sm text-primary">Primary</span>
          <ToggleSwitch checked={form.is_primary} />
        </label>

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
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeredred/10 text-themeredred active:scale-95 transition-all"
          >
            <Trash2 size={18} />
          </button>
        )}

        <button
          onClick={resetForm}
          disabled={saving}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
        >
          <X size={18} />
        </button>

        <button
          onClick={() => mode === 'adding' ? handleAdd() : certId && handleEdit(certId)}
          disabled={saving || !form.title.trim()}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
        </button>
      </div>

      <datalist id={`cert-sug-${userId}`}>
        {credentials.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────

  if (certs.length === 0 && !editing) {
    return (
      <p className="text-sm text-tertiary py-2">No certifications</p>
    )
  }

  return (
    <>
      {(certs.length > 0 || (editing && mode === 'adding')) && (
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {editing && mode === 'adding' && renderEditForm(null)}

          {certs.map((cert) => {
            const status = getExpirationStatus(cert.exp_date)
            const badge = statusLabel(status)
            const isEditingThis = editing && mode === 'editing' && editingCertId === cert.id

            if (isEditingThis) {
              return <div key={cert.id}>{renderEditForm(cert.id)}</div>
            }

            return (
              <div
                key={cert.id}
                className={`px-4 py-3.5 transition-all ${editing ? 'cursor-pointer active:scale-95 hover:bg-themeblue2/5' : ''}`}
                onClick={editing && mode === 'view' ? () => startEditing(cert) : undefined}
                role={editing ? 'button' : undefined}
                tabIndex={editing ? 0 : undefined}
                onKeyDown={editing && mode === 'view' ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditing(cert) }
                } : undefined}
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
      )}

      {editing && mode === 'view' && (
        <button
          onClick={() => { setMode('adding'); setForm(emptyForm) }}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 rounded-lg border border-dashed border-tertiary/20 text-xs text-tertiary hover:border-themeblue2 hover:text-themeblue2 transition-colors active:scale-95"
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
