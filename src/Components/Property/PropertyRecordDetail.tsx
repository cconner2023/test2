import { forwardRef, useImperativeHandle, useState } from 'react'
import { Trash2, Pencil, type LucideIcon } from 'lucide-react'
import { RecordReviewBody, RecordPreview } from './RecordPreview'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { usePropertyStore } from '../../stores/usePropertyStore'
import type { AuditEvent } from '../../lib/auditTypes'

export interface PropertyRecordDetailHandle {
  /** Open the action menu (Delete) anchored to the host header's ellipsis button.
   *  The host renders the trigger; the menu + confirm dialog live here. */
  openMenu: (anchor: DOMRect) => void
}

/** A PMCS / dispatch record selected from a Custody-roster card, resolved with its
 *  display chrome by the panel (the helpers live there alongside the list rows). */
export interface SelectedRecord {
  event: AuditEvent
  /** What the record IS, plus when — "Dispatch 28JUL26". The host header's title. */
  title: string
  /** The subject the record is about (vehicle / item) — the header's breadcrumb line. */
  label: string
  Icon: LucideIcon
  /** Icon chip classes (bg + text), matching the list row. */
  tint: string
  /** Detail meta line (readings / exp date). */
  detail: string
}

interface PropertyRecordDetailProps {
  record: SelectedRecord
  /** Close the host pane/sheet after the record is deleted (it no longer exists). */
  onDeleted: () => void
  /** Close the host pane/sheet after the edit overlay dismisses — `record` is a
   *  SNAPSHOT taken when the card was tapped, so an edited payload would render
   *  stale behind it. The roster underneath refetches off the `properties` bump. */
  onEdited?: () => void
  /** Scopes the edit overlay to a container (the property panel, desktop). Null /
   *  absent → it floats fixed and auto-stacks above the mobile sheet. */
  containerRef?: React.RefObject<HTMLElement | null>
}

/**
 * PropertyRecordDetail — the primitive right-pane (desktop) / detail-sheet (mobile)
 * view of a single PMCS / dispatch audit record, opened from a Custody-roster card.
 * Mirrors PropertyItemDetail: what the record is and when ("Dispatch 28JUL26") lives
 * in the host header with its subject as the breadcrumb line (tap it to select the
 * vehicle/item on the map) and a More (•••) menu (opened via openMenu); the body is
 * ONLY what the header doesn't already say — the "Information" section (mileage /
 * fuel / operator / faults for PMCS; exp date / odometer / operator / TC for
 * dispatch) and the attached 5988E / dispatch form. The menu carries Edit — the
 * record's own pre-filled intake form, via the shared RecordPreview overlay, so this
 * pane doesn't fork a second copy of it — and Delete, which hard-removes the audit
 * row through the store (bumping the `properties` generation so the roster refetches)
 * and closes the host surface.
 */
export const PropertyRecordDetail = forwardRef<PropertyRecordDetailHandle, PropertyRecordDetailProps>(
  function PropertyRecordDetail({ record, onDeleted, onEdited, containerRef }, ref) {
    const deletePmcsEntry = usePropertyStore((s) => s.deletePmcsEntry)
    const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect } | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    useImperativeHandle(ref, () => ({
      openMenu: (anchor: DOMRect) => setMenuAnchor({ rect: anchor }),
    }), [])

    const { event, label, Icon, tint, detail } = record

    const confirmDelete = async () => {
      if (busy) return
      setBusy(true)
      await deletePmcsEntry(event.id)
      setBusy(false)
      onDeleted()
    }

    // Edit opens the record's own pre-filled intake form — the SAME overlay the PMCS /
    // Dispatch history rows route to (initialAction='edit'), so the form lives in one
    // place. Save commits through editPmcsEntry and dismisses.
    const menuItems: ContextMenuItem[] = [
      { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => setEditOpen(true) },
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmOpen(true) },
    ]

    return (
      <div className="flex flex-col h-full px-3 py-3 space-y-3 overflow-y-auto">
        <RecordReviewBody event={event} />

        <RecordPreview
          event={editOpen ? event : null}
          onClose={() => { setEditOpen(false); onEdited?.() }}
          initialAction="edit"
          label={label}
          detail={detail}
          Icon={Icon}
          tint={tint}
          containerRef={containerRef}
        />

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
