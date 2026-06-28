import { useEffect, useState, type ReactNode } from 'react'
import { Pencil, Trash2, X, Check, FileText, type LucideIcon } from 'lucide-react'
import type { AuditEvent } from '../../lib/auditTypes'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { downloadDecryptedAttachment } from '../../lib/signal'
import type { PmcsDoc } from '../../lib/propertyService'
import { PreviewOverlay } from '../PreviewOverlay'
import { ConfirmDialog } from '../ConfirmDialog'
import { ActionButton } from '../ActionButton'
import { TextInput } from '../FormInputs'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('RecordPreview')

/**
 * RecordPreview — the shared "tap a history record → preview, edit or delete it"
 * overlay for property audit rows. Reused by the PMCS history, the Dispatch
 * history and the vehicle/item detail timeline so a tapped row opens ONE
 * consistent surface instead of every list carrying its own inline pencil/trash.
 *
 * A nested PreviewOverlay: opened from inside another PreviewOverlay (PMCS /
 * Dispatch) or from inside the detail Sheet (timeline), it auto-stacks above its
 * host via OverlayStackContext — no explicit zIndex plumbing needed, as long as
 * it renders as a React descendant of that host's children.
 *
 * Edit is offered only for the rows that carry free text (fault.opened /
 * fault.corrected); every row is deletable (hard-delete through the store, which
 * bumps the `properties` generation so the host list refetches). A row whose
 * payload carries an attachment (5988E / dispatch form) gets a "View document"
 * action that decrypts + opens it.
 */

interface RecordPreviewProps {
  /** The record to preview — null closes the overlay. */
  event: AuditEvent | null
  onClose: () => void
  /** Caller-supplied one-liner (each surface keeps its own phrasing). */
  label: string
  Icon: LucideIcon
  /** Icon chip classes (bg + text), matching the host list row. */
  tint: string
  /** Scopes the overlay to a container (the property drawer). Null → floats fixed. */
  containerRef?: React.RefObject<HTMLElement | null>
  /** Which mode to open in — a lifted-row menu routes straight to 'edit' or
   *  'delete' (confirm), skipping the view→footer hop. Defaults to 'view'. */
  initialAction?: 'view' | 'edit' | 'delete'
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function docOf(e: AuditEvent | null): PmcsDoc | null {
  const d = e?.payload?.doc
  return d && typeof d === 'object' && typeof (d as PmcsDoc).path === 'string' ? (d as PmcsDoc) : null
}

export function RecordPreview({ event, onClose, label, Icon, tint, containerRef, initialAction = 'view' }: RecordPreviewProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editText, setEditText] = useState('')
  const [busy, setBusy] = useState(false)

  const editPmcsEntry = usePropertyStore((s) => s.editPmcsEntry)
  const deletePmcsEntry = usePropertyStore((s) => s.deletePmcsEntry)

  const isOpen = !!event
  const editable = event?.eventType === 'fault.opened' || event?.eventType === 'fault.corrected'
  const doc = docOf(event)

  // Seed the edit field + set the opening mode each time a record opens. A
  // lifted-row menu can route straight to edit/delete via initialAction; edit is
  // honored only for the text-carrying fault rows.
  useEffect(() => {
    if (!event) return
    const canEdit = event.eventType === 'fault.opened' || event.eventType === 'fault.corrected'
    setMode(initialAction === 'edit' && canEdit ? 'edit' : 'view')
    setConfirmOpen(initialAction === 'delete')
    setBusy(false)
    setEditText(
      event.eventType === 'fault.opened' ? str(event.payload?.description) : str(event.payload?.note),
    )
  }, [event, initialAction])

  const saveEdit = async () => {
    if (!event || busy) return
    const text = editText.trim()
    // An empty fault description is meaningless — just back out.
    if (event.eventType === 'fault.opened' && !text) { setMode('view'); return }
    setBusy(true)
    const payload = event.eventType === 'fault.opened'
      ? { description: text }
      : { corrects: event.payload?.corrects, note: text }
    await editPmcsEntry(event.id, payload)
    setBusy(false)
    onClose()
  }

  const confirmDelete = async () => {
    if (!event || busy) return
    setBusy(true)
    await deletePmcsEntry(event.id)
    setBusy(false)
    onClose()
  }

  // Decrypt + open an attached 5988E / dispatch form in a new tab.
  const openDoc = async () => {
    if (!doc || busy) return
    setBusy(true)
    const res = await downloadDecryptedAttachment(doc.path, doc.key)
    setBusy(false)
    if (!res.ok) { logger.warn('document download failed:', res.error); return }
    const blob = doc.mime ? new Blob([res.data], { type: doc.mime }) : res.data
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const dateLabel = event ? fmtDate(event.occurredAt) : ''

  let body: ReactNode
  if (mode === 'edit') {
    body = (
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex-1 min-w-0">
          <TextInput value={editText} onChange={setEditText} placeholder="Entry text" />
        </div>
        <button
          type="button"
          onClick={() => setMode('view')}
          className="shrink-0 w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all"
          aria-label="Cancel"
        >
          <X size={14} className="text-tertiary" />
        </button>
        <button
          type="button"
          onClick={saveEdit}
          disabled={busy}
          className="shrink-0 w-8 h-8 rounded-full bg-themegreen/15 flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
          aria-label="Save"
        >
          <Check size={14} className="text-themegreen" />
        </button>
      </div>
    )
  } else {
    body = (
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">{label}</p>
            <p className="text-[9pt] text-tertiary">{dateLabel}</p>
          </div>
        </div>
        {doc && (
          <button
            type="button"
            onClick={openDoc}
            disabled={busy}
            className="mt-3 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-themeblue3/8 text-themeblue2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <FileText size={15} className="shrink-0" />
            <span className="flex-1 min-w-0 text-left text-sm font-medium truncate">
              {doc.name || 'View document'}
            </span>
          </button>
        )}
      </div>
    )
  }

  // Footer (view mode only) — Edit (when the row carries text) + Delete. The
  // default dismiss X rides the footer's right slot (no title set).
  const footer = mode === 'view' ? (
    <div className="flex gap-1 bg-themewhite rounded-2xl px-1.5 py-1.5">
      {editable && (
        <ActionButton icon={Pencil} label="Edit" variant="default" onClick={() => setMode('edit')} />
      )}
      <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => setConfirmOpen(true)} />
    </div>
  ) : undefined

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={null}
      containerRef={containerRef}
      maxWidth={320}
      footer={footer}
    >
      <>
        {body}
        {/* Canonical destructive-confirm primitive. Rendered INSIDE the
            PreviewOverlay children so OverlayStackContext floors it above this
            (already-nested) record card — no explicit zIndex needed. */}
        <ConfirmDialog
          visible={confirmOpen}
          title="Delete this record?"
          subtitle="This can't be undone."
          confirmLabel="Delete"
          variant="danger"
          processing={busy}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      </>
    </PreviewOverlay>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  })
}
