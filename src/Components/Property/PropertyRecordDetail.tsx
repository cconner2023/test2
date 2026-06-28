import { useState, forwardRef, useImperativeHandle } from 'react'
import { FileText, Trash2, type LucideIcon } from 'lucide-react'
import { RecordSummaryCard } from './RecordPreview'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { downloadDecryptedAttachment } from '../../lib/signal'
import type { PmcsDoc } from '../../lib/propertyService'
import type { AuditEvent } from '../../lib/auditTypes'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('PropertyRecordDetail')

export interface PropertyRecordDetailHandle {
  /** Open the action menu (Delete) anchored to the host header's ellipsis button.
   *  The host renders the trigger; the menu + confirm dialog live here. */
  openMenu: (anchor: DOMRect) => void
}

/** A PMCS / dispatch record selected from a Custody-roster card, resolved with its
 *  display chrome by the panel (the helpers live there alongside the list rows). */
export interface SelectedRecord {
  event: AuditEvent
  label: string
  Icon: LucideIcon
  /** Icon chip classes (bg + text), matching the list row. */
  tint: string
  /** Detail meta line (readings / exp date). */
  detail: string
}

function docOf(e: AuditEvent): PmcsDoc | null {
  const d = e.payload?.doc
  return d && typeof d === 'object' && typeof (d as PmcsDoc).path === 'string' ? (d as PmcsDoc) : null
}

interface PropertyRecordDetailProps {
  record: SelectedRecord
  /** Close the host pane/sheet after the record is deleted (it no longer exists). */
  onDeleted: () => void
}

/**
 * PropertyRecordDetail — the primitive right-pane (desktop) / detail-sheet (mobile)
 * view of a single PMCS / dispatch audit record, opened from a Custody-roster card.
 * Mirrors PropertyItemDetail: the label lives in the host header with a More (•••)
 * menu (opened via openMenu); the body is the record summary + an attached-form view
 * button. These records (pmcs.clear / dispatch.*) carry no free text, so the menu is
 * Delete only. Deleting hard-removes the audit row through the store (bumps the
 * `properties` generation so the roster refetches) and closes the host surface.
 */
export const PropertyRecordDetail = forwardRef<PropertyRecordDetailHandle, PropertyRecordDetailProps>(
  function PropertyRecordDetail({ record, onDeleted }, ref) {
    const deletePmcsEntry = usePropertyStore((s) => s.deletePmcsEntry)
    const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect } | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    useImperativeHandle(ref, () => ({
      openMenu: (anchor: DOMRect) => setMenuAnchor({ rect: anchor }),
    }), [])

    const { event, label, Icon, tint, detail } = record
    const doc = docOf(event)

    const confirmDelete = async () => {
      if (busy) return
      setBusy(true)
      await deletePmcsEntry(event.id)
      setBusy(false)
      onDeleted()
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

    const menuItems: ContextMenuItem[] = [
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmOpen(true) },
    ]

    return (
      <div className="flex flex-col h-full px-3 py-3 space-y-3">
        <RecordSummaryCard Icon={Icon} tint={tint} label={label} detail={detail} occurredAt={event.occurredAt} />

        {doc && (
          <button
            type="button"
            onClick={openDoc}
            disabled={busy}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-themeblue3/8 text-themeblue2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <FileText size={15} className="shrink-0" />
            <span className="flex-1 min-w-0 text-left text-sm font-medium truncate">{doc.name || 'View document'}</span>
          </button>
        )}

        {menuAnchor && (
          <LiftedRowMenu
            isOpen
            anchorRect={menuAnchor.rect}
            onClose={() => setMenuAnchor(null)}
            layout="list"
            align="right"
            items={menuItems}
          />
        )}

        <ConfirmDialog
          visible={confirmOpen}
          title="Delete this record?"
          subtitle="This can't be undone."
          confirmLabel="Delete"
          variant="danger"
          processing={busy}
          zIndex={1500}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    )
  },
)
