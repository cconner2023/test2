import { useEffect, useMemo, useRef, useState } from 'react'
import { Route, Pencil, Trash2, Check, MoreHorizontal, X } from 'lucide-react'
import { loadAuditBySubject } from '../../lib/auditService'
import type { AuditEvent } from '../../lib/auditTypes'
import { getLocalPropertyLocations } from '../../lib/offlineDb'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { useRecordPreview } from '../Property/RecordPreview'
import { PaneHeader } from '@/Components/primitives/PaneHeader'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { formatDtg } from '../../Utilities/propertyDates'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('DispatchExpiryDetail')

/**
 * DispatchExpiryDetail — the calendar-side detail for a derived dispatch-expiry
 * entry (see useDispatchCalendarEvents). Those entries are synthesized from the
 * audit-log dispatch fold and never exist in the calendar store, so the normal
 * event detail/edit path can't resolve them; this pane resolves the underlying
 * `dispatch.opened` audit event by id instead and hands it to the SAME shared
 * record surface property uses (useRecordPreview):
 *  - read  → the record review body (exp date, odometer out, operator, TC, note, form)
 *  - edit  → the pre-filled dispatch form (exp date, odometer, operator + TC party
 *            pickers, scan/replace the dispatch form), whose Save commits through
 *            editPmcsEntry → updateAuditEvent.
 * Nothing is forked: editing the exp date here moves the derived calendar entry
 * because the entry is re-derived from the event on the `properties` bump.
 *
 * CHROME follows the calendar's event surfaces, not the property sheets it borrows
 * its body from — this is a calendar entry, so it must not read as a foreign panel:
 *  - read mode  → ellipsis (Edit · Delete) + Close. Desktop groups both pills right
 *    (EventDetailPanel); mobile puts the ellipsis LEFT and Close right, the
 *    cross-domain mobile selected-surface invariant.
 *  - edit mode  → bare Back LEFT (exit edit, no save) + Save · Close RIGHT, the map
 *    FeatureEditor pattern the event form pane and Sheet both use. Delete is NOT
 *    duplicated here; it stays the read-mode ellipsis action.
 * There is no footer: the header owns every verb, and the dispatch form rides in the
 * edit card as a field (attachInBody) rather than a footer action.
 *
 * Hosted by CalendarPanel as a right-pane view (desktop) or inside the mobile
 * dispatch Sheet; it owns its own header row in both, since its read/edit mode is
 * internal. When the underlying event disappears (returned, or deleted) the entry it
 * stood for is gone too, so it closes itself.
 */

interface DispatchExpiryDetailProps {
  /** The `dispatch.opened` audit event the derived calendar entry stands for. */
  dispatchId: string
  /** The vehicle location the dispatch is on (the derived entry's room_id). */
  subjectId: string
  clinicId: string
  onClose: () => void
  /** Desktop only — scopes the nested doc scanner to a container. */
  containerRef?: React.RefObject<HTMLElement | null>
}

export function DispatchExpiryDetail({
  dispatchId,
  subjectId,
  clinicId,
  onClose,
  containerRef,
}: DispatchExpiryDetailProps) {
  const isMobile = useIsMobile()
  const [event, setEvent] = useState<AuditEvent | null>(null)
  const [vehicleName, setVehicleName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // The record the edit form is bound to — a SNAPSHOT taken when Edit is pressed,
  // so each press re-seeds the shared form (its seeding effect keys on the event
  // identity) and an abandoned edit doesn't linger in the fields. Null = read mode.
  const [editTarget, setEditTarget] = useState<AuditEvent | null>(null)
  const [moreMenu, setMoreMenu] = useState<DOMRect | null>(null)
  const moreBtnRef = useRef<HTMLDivElement>(null)
  const propGen = useInvalidation('properties')
  // The load effect closes the pane when the event is gone; keep onClose out of
  // its dep list so a new parent callback identity can't re-run the fetch.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Offline-first read of the dispatch event, mirroring DispatchSheet: local
  // audit rows first, server (read_audit) copy merged by id. Re-runs on the
  // `properties` bump so an edit here (or a return/delete elsewhere) lands.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const loaded = await loadAuditBySubject(subjectId, clinicId ?? '').catch((err) => {
        logger.warn('dispatch read failed:', err); return [] as AuditEvent[]
      })
      if (cancelled) return
      const found = loaded.find((e) => e.id === dispatchId) ?? null
      setLoading(false)
      // No event = the dispatch was returned or deleted, so the derived calendar
      // entry this pane opened from no longer exists.
      if (!found) { closeRef.current(); return }
      setEvent(found)
    })()
    return () => { cancelled = true }
  }, [dispatchId, subjectId, clinicId, propGen])

  useEffect(() => {
    let cancelled = false
    getLocalPropertyLocations(clinicId)
      .then((locs) => {
        if (!cancelled) setVehicleName(locs.find((l) => l.id === subjectId)?.name ?? null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clinicId, subjectId, propGen])

  const detail = useMemo(() => {
    const exp = event?.payload?.exp_date
    return typeof exp === 'string' && exp ? `exp ${formatDtg(exp)}` : ''
  }, [event])

  // The shared record surface, fed the live event in read mode and the snapshot while
  // editing, so its Delete is reachable from the read-mode ellipsis too. Its footer
  // slots go UNUSED — this pane's header owns Save, Edit and Delete.
  const record = useRecordPreview({
    event: editTarget ?? event,
    onClose: () => setEditTarget(null),
    initialAction: editTarget ? 'edit' : 'view',
    label: vehicleName ?? 'Vehicle',
    detail,
    Icon: Route,
    tint: 'bg-themeblue3/10 text-themeblue2',
    attachInBody: true,
    containerRef,
  })

  const editing = !!editTarget

  // Read-mode ellipsis — the same two verbs the property record surface puts in its
  // footer, as the menu items the calendar puts behind an ellipsis.
  const menuItems = event ? [
    { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => setEditTarget({ ...event }) },
    { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: record.requestDelete },
  ] : []

  // One trigger node, placed on the LEFT (mobile) or grouped with Close on the RIGHT
  // (desktop) — never both at once, so the single anchor ref stays unambiguous.
  const moreButton = (
    <div ref={moreBtnRef}>
      <PillButton
        icon={MoreHorizontal}
        iconSize={18}
        onClick={() => {
          const rect = moreBtnRef.current?.getBoundingClientRect()
          if (rect) setMoreMenu(rect)
        }}
        label="More actions"
      />
    </div>
  )

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <PaneHeader
        eyebrow={vehicleName ?? undefined}
        title={event ? `Dispatch ${formatDtg(event.occurredAt)}` : 'Dispatch'}
        onBack={editing ? () => setEditTarget(null) : undefined}
        // Mobile read mode: ellipsis LEFT of the title, Close alone on the right.
        leading={!editing && isMobile && menuItems.length > 0 ? <HeaderPill>{moreButton}</HeaderPill> : undefined}
        actions={
          editing ? (
            <HeaderPill>
              <PillButton
                icon={Check}
                iconSize={18}
                accent="success"
                disabled={!record.canSave || record.busy}
                onClick={record.save}
                label="Save"
              />
              <PillButton icon={X} iconSize={18} onClick={onClose} label="Close" />
            </HeaderPill>
          ) : !isMobile && menuItems.length > 0 ? (
            <HeaderPill>
              {moreButton}
              <PillButton icon={X} iconSize={18} onClick={onClose} label="Close" />
            </HeaderPill>
          ) : (
            <HeaderPill>
              <PillButton icon={X} iconSize={18} onClick={onClose} label="Close" />
            </HeaderPill>
          )
        }
      />

      {/* The edit form is a bare divide-y field stack (its inputs own their own
          padding); the read body brings its own card padding. */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${editing ? 'py-1' : ''}`}>
        {record.body}
      </div>

      {/* Delete confirm — a descendant of the host surface, so it stacks above a
          mobile Sheet via OverlayStackContext without explicit z plumbing. */}
      {record.confirm}

      {moreMenu && (
        <AnchoredMenu
          isOpen
          anchorRect={moreMenu}
          onClose={() => setMoreMenu(null)}
          layout="list"
          align={isMobile ? 'left' : 'right'}
          items={menuItems}
        />
      )}

      <LoadingOverlay visible={loading || record.saving} className="rounded-xl" />
    </div>
  )
}
