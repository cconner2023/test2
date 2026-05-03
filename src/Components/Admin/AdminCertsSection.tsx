/**
 * AdminCertsSection — certs for a single user inside the admin panel.
 * Mirrors the ProfilePage cert UX: row click → PreviewOverlay edit,
 * top-right FAB → PreviewOverlay add. CRUD is gated behind the parent's
 * edit mode (header toolbar).
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Check, RefreshCw, Trash2 } from 'lucide-react'
import type { Certification } from '../../Data/User'
import { ConfirmDialog } from '../ConfirmDialog'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { SectionCard } from '../Section'
import {
  updateCertification,
  adminAddCertification,
  adminDeleteCertification,
  syncPrimaryToProfile,
} from '../../lib/certificationService'
import { CertificationRow } from '../Certifications/CertificationRow'
import { CertOverlayFields } from '../Certifications/CertOverlayFields'
import { emptyCertForm } from '../Certifications/certHelpers'
import type { CertFormData } from '../Certifications/certHelpers'
import { EmptyState } from '../EmptyState'
import { useIsMobile } from '../../Hooks/useIsMobile'

interface AdminCertsSectionProps {
  userId: string
  certs: Certification[]
  editing: boolean
  onChanged: () => void
}

export function AdminCertsSection({ userId, certs, editing, onChanged }: AdminCertsSectionProps) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState<CertFormData>(emptyCertForm)
  const [saving, setSaving] = useState(false)
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null)
  const [editTarget, setEditTarget] = useState<{ certId: string; anchor: DOMRect } | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDeletePrimary, setPendingDeletePrimary] = useState(false)
  const fabRef = useRef<HTMLDivElement>(null)

  const closeOverlays = useCallback(() => {
    setAddAnchor(null)
    setEditTarget(null)
    setForm(emptyCertForm)
    setSaving(false)
  }, [])

  // Exit overlays when parent exits edit mode
  useEffect(() => {
    if (!editing) closeOverlays()
  }, [editing, closeOverlays])

  const openAdd = useCallback((anchorEl?: HTMLElement) => {
    const el = anchorEl ?? fabRef.current
    if (!el) return
    setForm(emptyCertForm)
    setAddAnchor(el.getBoundingClientRect())
  }, [])

  const openEdit = useCallback((cert: Certification, anchor: DOMRect) => {
    setForm({
      title: cert.title,
      cert_number: cert.cert_number ?? '',
      issue_date: cert.issue_date ?? '',
      exp_date: cert.exp_date ?? '',
      is_primary: cert.is_primary,
    })
    setEditTarget({ certId: cert.id, anchor })
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
      closeOverlays()
      onChanged()
    } else {
      setSaving(false)
    }
  }, [form, userId, closeOverlays, onChanged])

  const handleEdit = useCallback(async () => {
    if (!form.title.trim() || !editTarget) return
    setSaving(true)
    const result = await updateCertification(editTarget.certId, {
      title: form.title.trim(),
      cert_number: form.cert_number.trim() || null,
      issue_date: form.issue_date || null,
      exp_date: form.exp_date || null,
      is_primary: form.is_primary,
    })
    if (result.success) {
      const cert = certs.find(c => c.id === editTarget.certId)
      if (cert && form.is_primary !== cert.is_primary) {
        await syncPrimaryToProfile(cert.user_id)
      }
      closeOverlays()
      onChanged()
    } else {
      setSaving(false)
    }
  }, [form, editTarget, certs, closeOverlays, onChanged])

  const handleDelete = useCallback(async (certId: string, wasPrimary: boolean) => {
    setSaving(true)
    await adminDeleteCertification(certId, userId, wasPrimary)
    closeOverlays()
    onChanged()
  }, [userId, closeOverlays, onChanged])

  const editingCert = editTarget ? certs.find(c => c.id === editTarget.certId) : null
  const pendingDeleteCert = pendingDeleteId ? certs.find(c => c.id === pendingDeleteId) : null

  return (
    <>
      {certs.length > 0 ? (
        <SectionCard className="relative">
          <div className="px-2 py-2 space-y-1">
            {certs.map((cert) => (
              <CertificationRow
                key={cert.id}
                cert={cert}
                onClick={editing ? (e) => openEdit(cert, e.currentTarget.getBoundingClientRect()) : undefined}
              />
            ))}
          </div>
          {editing && (
            <ActionPill ref={fabRef} shadow="sm" className="absolute top-2 right-2">
              <ActionButton icon={Plus} label="Add certification" onClick={() => openAdd()} />
            </ActionPill>
          )}
        </SectionCard>
      ) : (
        <EmptyState
          title="No certifications"
          action={editing ? { icon: Plus, label: 'Add certification', onClick: openAdd } : undefined}
        />
      )}

      {/* Add overlay */}
      <PreviewOverlay
        isOpen={!!addAnchor}
        onClose={closeOverlays}
        anchorRect={addAnchor}
        title="Add certification"
        maxWidth={360}
        previewMaxHeight="60dvh"
        footer={
          addAnchor ? (
            <ActionPill>
              <ActionButton
                icon={saving ? RefreshCw : Check}
                label={saving ? 'Saving…' : 'Add'}
                variant={saving || !form.title.trim() ? 'disabled' : 'success'}
                onClick={handleAdd}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {addAnchor && <CertOverlayFields form={form} setForm={setForm} isMobile={isMobile} />}
      </PreviewOverlay>

      {/* Edit overlay */}
      <PreviewOverlay
        isOpen={!!editTarget}
        onClose={closeOverlays}
        anchorRect={editTarget?.anchor ?? null}
        title="Edit certification"
        maxWidth={360}
        previewMaxHeight="60dvh"
        footer={
          editTarget && editingCert ? (
            <ActionPill>
              <ActionButton
                icon={Trash2}
                label="Delete certification"
                variant="danger"
                onClick={() => {
                  setPendingDeleteId(editingCert.id)
                  setPendingDeletePrimary(editingCert.is_primary)
                }}
              />
              <ActionButton
                icon={saving ? RefreshCw : Check}
                label={saving ? 'Saving…' : 'Save'}
                variant={saving || !form.title.trim() ? 'disabled' : 'success'}
                onClick={handleEdit}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {editTarget && editingCert && <CertOverlayFields form={form} setForm={setForm} isMobile={isMobile} />}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title={`Delete "${pendingDeleteCert?.title || 'this certification'}"?`}
        subtitle="Permanent."
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
