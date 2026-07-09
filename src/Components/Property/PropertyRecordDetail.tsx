import { useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { FileText, Trash2, MapPin, ChevronRight, AlertTriangle, Wrench, type LucideIcon } from 'lucide-react'
import { RecordSummaryCard } from './RecordPreview'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { downloadDecryptedAttachment } from '../../lib/signal'
import { pmcsOpened, pmcsCorrected } from '../../lib/pmcsFold'
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

/** Short, local-midnight day for date-only payload fields (exp_date / returned_at),
 *  so the shown day can't drift a day earlier in negative-offset timezones. */
function fmtDay(dateOnly: string): string {
  const d = new Date(dateOnly.length <= 10 ? `${dateOnly}T00:00:00` : dateOnly)
  if (!Number.isFinite(d.getTime())) return dateOnly
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** The structured readings the summary line collapses — one label/value row each,
 *  built from the record's payload per kind (PMCS readings / dispatch open / close). */
function infoRows(event: AuditEvent): { label: string; value: string }[] {
  const p = event.payload ?? {}
  const rows: { label: string; value: string }[] = []
  const push = (label: string, value: string | null) => {
    if (value) rows.push({ label, value })
  }
  const num = (v: unknown, suffix = ''): string | null =>
    typeof v === 'number' ? `${v.toLocaleString()}${suffix}` : null
  const text = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

  switch (event.eventType) {
    case 'pmcs.clear':
      push('Mileage', num(p.mileage, ' mi'))
      push('Fuel', num(p.fuelLevel, '%'))
      push('Operator', text(p.operator))
      push('Mechanic', text(p.mechanic))
      break
    case 'dispatch.opened':
      push('Status', 'On dispatch')
      push('Expires', typeof p.exp_date === 'string' && p.exp_date ? fmtDay(p.exp_date) : null)
      push('Odometer out', num(p.odo_out, ' mi'))
      push('Operator', text(p.operator))
      push('TC', text(p.tc))
      push('Note', text(p.note))
      break
    case 'dispatch.closed':
      push('Status', 'Returned')
      push('Returned', typeof p.returned_at === 'string' && p.returned_at ? fmtDay(p.returned_at) : null)
      push('Odometer in', num(p.odo_in, ' mi'))
      push('Note', text(p.note))
      break
  }
  return rows
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
    const doc = docOf(event)
    const isDispatch = event.eventType.startsWith('dispatch')
    const rows = useMemo(() => infoRows(event), [event])
    const faultsOpened = useMemo(() => (event.eventType === 'pmcs.clear' ? pmcsOpened(event) : []), [event])
    const faultsCorrected = useMemo(() => (event.eventType === 'pmcs.clear' ? pmcsCorrected(event) : []), [event])

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
      <div className="flex flex-col h-full px-3 py-3 space-y-3 overflow-y-auto">
        <RecordSummaryCard Icon={Icon} tint={tint} label={label} detail={detail} occurredAt={event.occurredAt} />

        {/* Information — the readings the roster line collapses, one row each, plus the
            PMCS faults this check found / corrected (red for a new fault). */}
        {(rows.length > 0 || faultsOpened.length > 0 || faultsCorrected.length > 0) && (
          <div>
            <SectionHeader>{isDispatch ? 'Dispatch information' : 'PMCS information'}</SectionHeader>
            <SectionCard className="divide-y divide-tertiary/8 mt-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-[10pt] text-tertiary shrink-0">{r.label}</span>
                  <span className="text-[10pt] text-primary text-right min-w-0 truncate">{r.value}</span>
                </div>
              ))}
              {faultsCorrected.map((f) => (
                <div key={`c-${f.id}`} className="flex items-start gap-2.5 px-4 py-2.5">
                  <Wrench size={14} className="text-themeblue2 shrink-0 mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10pt] text-primary">{f.description}</span>
                    <span className="block text-[9pt] text-tertiary">Corrected{f.note ? ` · ${f.note}` : ''}</span>
                  </span>
                </div>
              ))}
              {faultsOpened.map((f) => (
                <div key={`o-${f.id}`} className="flex items-start gap-2.5 px-4 py-2.5">
                  <AlertTriangle size={14} className="text-themered shrink-0 mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10pt] text-primary">{f.description}</span>
                    <span className="block text-[9pt] text-themered">New fault</span>
                  </span>
                </div>
              ))}
            </SectionCard>
          </div>
        )}

        {doc && (
          <button
            type="button"
            onClick={openDoc}
            disabled={busy}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-themeblue3/8 text-themeblue2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <FileText size={15} className="shrink-0" />
            <span className="flex-1 min-w-0 text-left text-sm font-medium truncate">
              {doc.name || (isDispatch ? 'Open dispatch form' : 'Open 5988E')}
            </span>
          </button>
        )}

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
