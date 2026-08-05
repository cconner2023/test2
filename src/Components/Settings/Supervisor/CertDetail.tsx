import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BadgeCheck, BadgeX, Bell, Check, FileText, Pencil, Trash2, Upload, X } from 'lucide-react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { AddFab } from '@/Components/primitives/AddFab'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { useIsMobile } from '../../../Hooks/useIsMobile'
import { CertOverlayFields } from '../../Certifications/CertOverlayFields'
import { formatCertDate, statusLabel, type CertFormData } from '../../Certifications/certHelpers'
import { formatMedicName, type CertHolder } from './supervisorHelpers'
import {
  certDocumentUrl,
  hasCertDocument,
  uploadCertDocument,
} from '../../../lib/certDocumentService'

/**
 * One certification's terminal — what is on file, and every act a supervisor has
 * on it.
 *
 * A CERT IS EDITED, NOT RE-RECORDED. This is the one place in the supervisor
 * drawer where that is true: a training record is a fold over append-only events,
 * so correcting one means filing a newer one, but a certification is a plain row
 * with an UPDATE policy behind it. The verbs differ for that reason, and the
 * difference is real rather than an inconsistency to iron out.
 *
 * VERIFY IS THE SUPERVISOR'S SIGNATURE and is the reason this terminal exists at
 * all. The holder can write the row; only a supervisor can say they saw the card.
 * It stamps verified_by / verified_at, which is why it is an act here rather than
 * a field in the form.
 *
 * THE VERBS LIVE IN THE CHROME. Edit, verify, remind, the document and delete are
 * an object-level ellipsis published up to the pane header — the same contract
 * RecordDetail uses, and for the same reason: a stack of full-width buttons under
 * the facts puts a destructive one at the end of a scroll.
 *
 * Plain flow, no scroller: the pane owns the scroll on desktop, the sheet on
 * mobile, and a nested one gets clipped by the sheet's card.
 */

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-t border-tertiary/8 first:border-t-0">
      <span className="text-[9pt] text-tertiary shrink-0 w-24">{label}</span>
      <span className="text-[10pt] text-primary min-w-0 flex-1 break-words">{value}</span>
    </div>
  )
}

export function certToForm(holder: CertHolder): CertFormData {
  const { cert } = holder
  return {
    title: cert.title,
    cert_number: cert.cert_number ?? '',
    issue_date: cert.issue_date ?? '',
    exp_date: cert.exp_date ?? '',
    is_primary: cert.is_primary,
  }
}

interface CertDetailProps {
  holder: CertHolder
  resolveName: (id: string | null) => string
  /** Save an edited row. The terminal owns the form; the host owns the write. */
  onSave: (holder: CertHolder, form: CertFormData) => void
  /** Stamp or clear the supervisor's signature. */
  onVerify: (holder: CertHolder, verified: boolean) => void
  /** Hand the expiration to the calendar. Absent when the row carries no date —
   *  there is nothing to remind against. */
  onRemind?: (holder: CertHolder) => void
  onDelete: (holder: CertHolder) => void
  /** Publish the header ellipsis so the pane / sheet header renders it. */
  onHeaderActions?: (node: ReactNode | null) => void
}

export function CertDetail({
  holder,
  resolveName,
  onSave,
  onVerify,
  onRemind,
  onDelete,
  onHeaderActions,
}: CertDetailProps) {
  const { cert, soldier, status } = holder
  const isMobile = useIsMobile()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CertFormData>(() => certToForm(holder))

  // The document lives in storage, not on the row, so its presence is a fetched
  // fact rather than a rendered one — see certDocumentService.
  const [hasDoc, setHasDoc] = useState<boolean | null>(null)
  const [docBusy, setDocBusy] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const original = useMemo(() => certToForm(holder), [holder])
  // No disabled Save. An untouched form has nothing to save, and a dimmed button
  // that wakes on a keystroke is the same information said twice.
  const dirty = editing && !!form.title.trim() && (
    form.title !== original.title
    || form.cert_number !== original.cert_number
    || form.issue_date !== original.issue_date
    || form.exp_date !== original.exp_date
    || form.is_primary !== original.is_primary
  )

  useEffect(() => {
    let live = true
    void hasCertDocument(cert.user_id, cert.id).then(present => {
      if (live) setHasDoc(present)
    })
    return () => { live = false }
  }, [cert.user_id, cert.id])

  const pickDocument = useCallback(() => {
    setDocError(null)
    fileRef.current?.click()
  }, [])

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setDocBusy(true)
    setDocError(null)
    const res = await uploadCertDocument(cert.user_id, cert.id, file)
    setDocBusy(false)
    if (!res.success) { setDocError(res.error); return }
    setHasDoc(true)
  }, [cert.user_id, cert.id])

  /** Signed on demand rather than held: a URL minted at render would be stale by
   *  the time anyone pressed it, and it is a link to a credential card. */
  const openDocument = useCallback(async () => {
    setDocError(null)
    const url = await certDocumentUrl(cert.user_id, cert.id)
    if (!url) {
      setDocError('Could not open the document — you may be offline.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [cert.user_id, cert.id])

  const headerActions = useMemo(() => {
    const items: ContextMenuItem[] = [
      editing
        ? { key: 'cancel-edit', label: 'Cancel edit', icon: X, onAction: () => setEditing(false) }
        : { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => setEditing(true) },
      cert.verified
        ? { key: 'unverify', label: 'Remove verification', icon: BadgeX, onAction: () => onVerify(holder, false) }
        : { key: 'verify', label: 'Verify', icon: BadgeCheck, onAction: () => onVerify(holder, true) },
      ...(onRemind ? [{
        key: 'remind',
        label: 'Schedule renewal',
        icon: Bell,
        onAction: () => onRemind(holder),
      }] : []),
      {
        key: 'document',
        label: hasDoc ? 'Replace document' : 'Upload document',
        icon: Upload,
        onAction: pickDocument,
      },
      {
        key: 'delete',
        label: 'Delete certification',
        icon: Trash2,
        destructive: true,
        onAction: () => setConfirmOpen(true),
      },
    ]
    return <OverlayHeaderMenu items={items} />
  }, [editing, cert.verified, hasDoc, holder, onVerify, onRemind, pickDocument])

  useEffect(() => {
    onHeaderActions?.(headerActions)
    return () => onHeaderActions?.(null)
  }, [headerActions, onHeaderActions])

  const s = statusLabel(status)

  return (
    <div className="px-4 py-4">
      <div>
        <SectionHeader>Certification</SectionHeader>
        <SectionCard>
          <Fact label="Soldier" value={formatMedicName(soldier)} />
          {/* The title is the pane's title — restating it an inch below the
              chrome is the same fact twice. Everything keyed off it is not. */}
          {cert.cert_number && <Fact label="Cert #" value={cert.cert_number} />}
          {cert.issue_date && <Fact label="Issued" value={formatCertDate(cert.issue_date)} />}
          <Fact
            label="Expires"
            value={
              <span className="flex items-center gap-2">
                {cert.exp_date ? formatCertDate(cert.exp_date) : 'No date on file'}
                <span className={`text-[9pt] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                  {s.text}
                </span>
              </span>
            }
          />
          {cert.is_primary && <Fact label="Primary" value="Yes" />}
          <Fact
            label="Verified"
            value={cert.verified
              ? `${resolveName(cert.verified_by)}${cert.verified_at ? ` · ${fmtDateTime(cert.verified_at)}` : ''}`
              : 'Not verified'}
          />
        </SectionCard>
      </div>

      {/* The scanned card. Its own section rather than a Fact row: it is the one
          thing here that is fetched, can fail, and is pressed. */}
      <div className="mt-4">
        <SectionHeader>Document</SectionHeader>
        {hasDoc ? (
          <SectionCard>
            <button
              onClick={() => void openDocument()}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                hover:bg-themeblue2/5 active:scale-95"
            >
              <FileText size={16} className="text-tertiary shrink-0" />
              <span className="text-[10pt] text-primary flex-1 min-w-0 truncate">
                {docBusy ? 'Uploading…' : 'View PDF'}
              </span>
            </button>
          </SectionCard>
        ) : hasDoc === false ? (
          <EmptyState
            title={docBusy ? 'Uploading…' : 'Upload a PDF'}
            action={{ icon: Upload, label: 'Upload PDF', onClick: () => pickDocument() }}
          />
        ) : (
          <SectionCard className="px-4 py-3">
            <p className="text-[10pt] text-tertiary">Checking…</p>
          </SectionCard>
        )}
        {docError && (
          <p className="text-[9pt] text-themeredred mt-1.5 px-1">{docError}</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            // Cleared so re-picking the SAME file still fires a change.
            e.target.value = ''
          }}
        />
      </div>

      {/* Entered from the header's Edit rather than standing open — a terminal
          that is a form on arrival reads as a draft, not a record. */}
      {editing && (
        <div className="mt-4">
          <SectionHeader>Edit</SectionHeader>
          <SectionCard>
            {/* No Primary toggle here — see CertOverlayFields.hidePrimary. The
                credential a soldier states is theirs to state; this surface
                records the card and signs for it. */}
            <CertOverlayFields
              form={form}
              setForm={setForm}
              isMobile={isMobile}
              datalistId="supervisor-cert-titles"
              hidePrimary
            />
          </SectionCard>
        </div>
      )}

      {dirty && (
        <div className="sticky bottom-4 z-10 flex justify-end pb-2 pointer-events-none">
          <AddFab icon={Check} label="Save certification" onClick={() => onSave(holder, form)} />
        </div>
      )}

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete this certification?"
        subtitle="The row and any document filed with it are removed. The soldier's cert compliance falls back to whatever else is on file."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); onDelete(holder) }}
        onCancel={() => setConfirmOpen(false)}
        zIndex={1300}
      />
    </div>
  )
}
