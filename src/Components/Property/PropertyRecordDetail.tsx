import { useMemo, forwardRef, useImperativeHandle, useState } from 'react'
import { Trash2, MapPin, ChevronRight, type LucideIcon } from 'lucide-react'
import { RecordReviewBody } from './RecordPreview'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { SectionHeader } from '@/Components/primitives/Section'
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
  /** Fly the map to (and select) the record's subject — the vehicle zone for a
   *  vehicle PMCS/dispatch, the item for a stock-item PMCS. Absent → no subject card. */
  onLocateSubject?: () => void
}

/**
 * PropertyRecordDetail — the primitive right-pane (desktop) / detail-sheet (mobile)
 * view of a single PMCS / dispatch audit record, opened from a Custody-roster card.
 * Mirrors PropertyItemDetail: the label lives in the host header with a More (•••)
 * menu (opened via openMenu); the body is the full record — a summary card, an
 * "Information" section listing every reading the roster line collapses (mileage /
 * fuel / operator / faults for PMCS; exp date / odometer / operator / TC for
 * dispatch), the attached 5988E / dispatch form (openable), and a tappable subject
 * card that flies the map to (and selects) the vehicle/item. Delete hard-removes the
 * audit row through the store (bumps the `properties` generation so the roster
 * refetches) and closes the host surface.
 */
export const PropertyRecordDetail = forwardRef<PropertyRecordDetailHandle, PropertyRecordDetailProps>(
  function PropertyRecordDetail({ record, onDeleted, onLocateSubject }, ref) {
    const deletePmcsEntry = usePropertyStore((s) => s.deletePmcsEntry)
    const items = usePropertyStore((s) => s.items)
    const locations = usePropertyStore((s) => s.locations)
    const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect } | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    useImperativeHandle(ref, () => ({
      openMenu: (anchor: DOMRect) => setMenuAnchor({ rect: anchor }),
    }), [])

    const { event, label, Icon, tint, detail } = record
    const isDispatch = event.eventType.startsWith('dispatch')

    // The subject the record is about — a vehicle (location) or a stock item — resolved
    // to a name + its location for the tappable "locate on the map" card. Falls back to
    // the roster label for a vehicle whose zone isn't loaded so the card still shows.
    const subject = useMemo<{ name: string; sub: string | null } | null>(() => {
      if (event.subjectType === 'location') {
        const loc = locations.find((l) => l.id === event.subjectId)
        const parent = loc?.parent_id ? locations.find((l) => l.id === loc.parent_id) : null
        return { name: loc?.name ?? label, sub: parent?.name ?? null }
      }
      const it = items.find((i) => i.id === event.subjectId)
      if (!it) return null
      const loc = it.location_id ? locations.find((l) => l.id === it.location_id) : null
      return { name: it.name, sub: loc?.name ?? 'Unplaced' }
    }, [event, items, locations, label])

    const confirmDelete = async () => {
      if (busy) return
      setBusy(true)
      await deletePmcsEntry(event.id)
      setBusy(false)
      onDeleted()
    }

    const menuItems: ContextMenuItem[] = [
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmOpen(true) },
    ]

    return (
      <div className="flex flex-col h-full px-3 py-3 space-y-3 overflow-y-auto">
        <RecordReviewBody event={event} label={label} Icon={Icon} tint={tint} detail={detail} />

        {/* Subject — the vehicle/item this record is about. Tap flies the map to it and
            selects it (leaves the custody tab), matching a Signed-Out / Expired card tap. */}
        {subject && onLocateSubject && (
          <div>
            <SectionHeader>{isDispatch ? 'Vehicle' : 'PMCS item'}</SectionHeader>
            <button
              type="button"
              onClick={onLocateSubject}
              className="mt-2 w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/5 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-themeblue3/10 text-themeblue2 flex items-center justify-center shrink-0">
                <MapPin size={16} />
              </div>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-primary truncate">{subject.name}</span>
                {subject.sub && <span className="block text-[9pt] text-tertiary truncate">{subject.sub}</span>}
              </span>
              <ChevronRight size={16} className="text-tertiary shrink-0" />
            </button>
          </div>
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
