import { useState, useMemo, useCallback, type ReactNode } from 'react'
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  FileText,
  RotateCcw,
  ClipboardCheck,
  AlertTriangle,
  Wrench,
  Route,
  PackageMinus,
  type LucideIcon,
} from 'lucide-react'
import type { ReceiptItem, HandReceiptData } from '../../Hooks/useHandReceipts'
import { useRecentPropertyActivity } from '../../Hooks/useRecentPropertyActivity'
import { summarizePmcs, pmcsOpened } from '../../lib/pmcsFold'
import type { SelectedRecord } from './PropertyRecordDetail'
import { SectionCard, SectionHeader } from '../Section'
import { expiryStatus, type HandReceipt } from '../../Types/PropertyTypes'
import type { AuditEvent } from '../../lib/auditTypes'

/** Short, human date for the receipt rows (chronological, newest first). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Icon chip for a PMCS / dispatch / usage activity row. */
function activityMeta(e: AuditEvent): { Icon: LucideIcon; tint: string } {
  switch (e.eventType) {
    case 'pmcs.clear': {
      // Mirror the PMCS history chip: red when this check found a fault, wrench
      // when it only corrected one, clipboard for a clean check.
      const s = summarizePmcs(e)
      if (s.foundFault) return { Icon: AlertTriangle, tint: 'bg-themered/10 text-themered' }
      if (s.correctedFault) return { Icon: Wrench, tint: 'bg-themeblue3/10 text-themeblue2' }
      return { Icon: ClipboardCheck, tint: 'bg-themeblue3/10 text-themeblue2' }
    }
    case 'dispatch.opened':
      return { Icon: Route, tint: 'bg-themeblue3/10 text-themeblue2' }
    case 'dispatch.closed':
      return { Icon: RotateCcw, tint: 'bg-themegreen/10 text-themegreen' }
    case 'item.expended':
      return { Icon: PackageMinus, tint: 'bg-themeyellow/15 text-themeyellow' }
    default:
      return { Icon: FileText, tint: 'bg-tertiary/10 text-tertiary' }
  }
}

/** True when an event carries a viewable attachment (5988E / dispatch form). */
function hasDoc(e: AuditEvent): boolean {
  const d = e.payload?.doc
  return !!d && typeof d === 'object' && typeof (d as { path?: unknown }).path === 'string'
}

interface CustodyPanelProps {
  clinicId: string
  /** Hand-receipt data — lifted to PropertyPanel so this tab and the unified
   *  search overlay share one fetch. */
  receipts: HandReceiptData['receipts']
  itemsById: HandReceiptData['itemsById']
  locationNameById: HandReceiptData['locationNameById']
  /** Roster lookup (actor id → display name) for the Usage "who did it" line. */
  membersById: HandReceiptData['membersById']
  loading: HandReceiptData['loading']
  /** Fly the map to a signed-out / used / expiring item's usual zone and surface it. */
  onLocateItem: (item: ReceiptItem) => void
  /** Open a hand receipt's detail in the host pane (right pane desktop / sheet mobile). */
  onSelectReceipt: (r: HandReceipt) => void
  /** Open a PMCS / dispatch record's detail in the host pane. */
  onSelectRecord: (record: SelectedRecord) => void
  /** Currently-open receipt / record — for the selected-row highlight (desktop). */
  selectedReceiptId?: string | null
  selectedRecordId?: string | null
}

/**
 * Custody tab — the DA 2062 accountability surface, a ROSTER of cards. Collapsible
 * GROUP headers (label + chevron, NO count) whose discrete items render as a flush
 * SectionCard stack. Cards are consistent across all sections: a two-line text card
 * (no leading icon chip) — line 1 the subject, line 2 the section's detail. Top: the
 * hand receipts under "Signed Out" / "History" — first item ×qty (+N more) over the
 * recipient; tap OPENS the 2062 detail in the host pane (right pane desktop / sheet
 * mobile). Middle: "Usage" (item · ×qty · who did it) + "Expired" (item · exp date),
 * tap to locate the item. Bottom: the week's "PMCS" (vehicle · who · date · faults)
 * + "Dispatch" (vehicle · operator · exp) activity (clinic-wide audit events from the
 * past week via useRecentPropertyActivity) — each card opens the record's detail in
 * the host pane (view the 5988E / dispatch form, delete). Every selectable card
 * follows the same "main-content card → pane/sheet detail" primitive; the panel holds
 * NO inline expansion. Search lives in the property header search.
 */
export function CustodyPanel({
  clinicId,
  receipts,
  itemsById,
  locationNameById,
  membersById,
  loading,
  onLocateItem,
  onSelectReceipt,
  onSelectRecord,
  selectedReceiptId,
  selectedRecordId,
}: CustodyPanelProps) {
  // Clinic-wide PMCS + dispatch activity for the past week — the "what got
  // inspected / dispatched lately" feed living below the hand receipts.
  const activity = useRecentPropertyActivity(clinicId)
  const { pmcsEvents, dispatchEvents, usageEvents } = useMemo(() => {
    const pmcsEvents: AuditEvent[] = []
    const dispatchEvents: AuditEvent[] = []
    const usageEvents: AuditEvent[] = []
    for (const e of activity) {
      if (e.eventType === 'pmcs.clear') pmcsEvents.push(e)
      else if (e.eventType === 'item.expended') usageEvents.push(e)
      else dispatchEvents.push(e) // dispatch.opened / dispatch.closed
    }
    return { pmcsEvents, dispatchEvents, usageEvents }
  }, [activity])

  // Expiring / expired consumables — the "Expired" section. expiryStatus folds the
  // item's expiry_date into the 30-day window (past → 'expired', within 30 days →
  // 'expiring'); items without an expiry_date drop out. Soonest-to-lapse first.
  const expiredItems = useMemo(() => {
    const rows: { item: ReceiptItem; status: 'expired' | 'expiring' }[] = []
    for (const item of itemsById.values()) {
      const status = expiryStatus(item.expiry_date)
      if (status) rows.push({ item, status })
    }
    rows.sort((a, b) => (a.item.expiry_date ?? '').localeCompare(b.item.expiry_date ?? ''))
    return rows
  }, [itemsById])

  // Expand state — collapsible GROUP keys ('__signed_out__' etc.). The discrete
  // receipts / activity events inside an open group render as a card stack.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(['__signed_out__', '__usage__', '__expired__', '__pmcs__', '__dispatch__']),
  )
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const { outstanding, history } = useMemo(() => {
    const outstanding: HandReceipt[] = []
    const history: HandReceipt[] = []
    for (const r of receipts) {
      ;(r.status === 'returned' ? history : outstanding).push(r)
    }
    return { outstanding, history }
  }, [receipts])

  // A hand receipt as a card in the stack — the ITEM (first signed-out item + its
  // quantity, with "+N more" when the receipt covers several) on line 1, the
  // recipient it went to on line 2. Tapping opens its 2062 detail in the host pane
  // (right pane / sheet) for the full item list / print.
  const renderReceiptCard = (r: HandReceipt) => {
    const active = selectedReceiptId === r.handReceiptId
    const first = r.entries[0]
    const firstName = first ? itemsById.get(first.item_id)?.name ?? 'Item' : 'Item'
    const firstQty = Math.max(1, first?.quantity_delta ?? 1)
    const more = r.entries.length - 1
    const itemLine =
      `${firstName}${firstQty > 1 ? ` ×${firstQty}` : ''}` + (more > 0 ? ` · +${more} more` : '')
    return (
      <SectionCard key={r.handReceiptId}>
        <button
          onClick={() => onSelectReceipt(r)}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themeblue2/5 ${active ? 'bg-themeblue2/8' : ''}`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{itemLine}</p>
            <p className="text-[9pt] text-tertiary mt-0.5 truncate">{r.recipientLabel}</p>
          </div>
          <ChevronRight size={16} className="text-tertiary shrink-0" />
        </button>
      </SectionCard>
    )
  }

  // Item / vehicle name a PMCS / dispatch event is about.
  const activityName = (e: AuditEvent): string =>
    e.subjectType === 'item'
      ? itemsById.get(e.subjectId)?.name ?? 'Item'
      : locationNameById.get(e.subjectId) ?? 'Vehicle'

  // The second-line detail for an activity/usage card (also the record detail's
  // subline). Each section surfaces exactly the fields the user asked for:
  //  · PMCS     → who did it · date · number of faults
  //  · Dispatch → operator · exp date  (open) / "Returned" (closed)
  //  · Usage    → ×quantity · who did it
  const detailOf = (e: AuditEvent): string => {
    const p = e.payload ?? {}
    switch (e.eventType) {
      case 'pmcs.clear': {
        const who = typeof p.operator === 'string' && p.operator ? p.operator : null
        const n = pmcsOpened(e).length
        const faults = n > 0 ? `${n} fault${n === 1 ? '' : 's'}` : 'No faults'
        return [who, formatDate(e.occurredAt), faults].filter(Boolean).join(' · ')
      }
      case 'dispatch.opened': {
        const op = typeof p.operator === 'string' && p.operator ? p.operator : null
        const exp = typeof p.exp_date === 'string' ? `exp ${formatDate(p.exp_date)}` : null
        return [op, exp].filter(Boolean).join(' · ') || 'Dispatched'
      }
      case 'dispatch.closed':
        return 'Returned'
      case 'item.expended': {
        const qty = typeof p.quantity_delta === 'number' ? p.quantity_delta : 1
        const who = membersById.get(e.actorId ?? '')?.displayName ?? null
        return [`×${qty}`, who].filter(Boolean).join(' · ')
      }
      default:
        return e.eventType
    }
  }

  // A PMCS / dispatch activity event as a card: subject (vehicle) name on line 1,
  // the section's detail line below (PMCS: who · date · faults; Dispatch: operator ·
  // exp). Doc indicator when a form is attached. Tapping opens the record detail in
  // the host pane (view 5988E / dispatch form, delete). The icon/tint still ride the
  // SelectedRecord for the detail header even though the card itself is icon-free.
  const renderActivityCard = (e: AuditEvent) => {
    const { Icon, tint } = activityMeta(e)
    const active = selectedRecordId === e.id
    return (
      <SectionCard key={e.id}>
        <button
          type="button"
          onClick={() => onSelectRecord({ event: e, label: activityName(e), Icon, tint, detail: detailOf(e) })}
          className={`group w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themeblue2/5 ${active ? 'bg-themeblue2/8' : ''}`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{activityName(e)}</p>
            <p className="text-[9pt] text-tertiary mt-0.5 truncate">{detailOf(e)}</p>
          </div>
          {hasDoc(e) && <FileText size={14} className="text-themeblue2 shrink-0" />}
          <ChevronRight size={16} className="text-tertiary shrink-0" />
        </button>
      </SectionCard>
    )
  }

  // A usage (expenditure) event as a card: item name on line 1, "×N · who did it"
  // below. Tapping locates the item on the map (it still exists — expend clamps qty
  // to 0, never deletes). No detail: item.expended is an immutable, doc-less event.
  const renderUsageCard = (e: AuditEvent) => {
    const item = itemsById.get(e.subjectId)
    return (
      <SectionCard key={e.id}>
        <button
          type="button"
          onClick={() => item && onLocateItem(item)}
          className="group w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themeblue2/5"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{activityName(e)}</p>
            <p className="text-[9pt] text-tertiary mt-0.5 truncate">{detailOf(e)}</p>
          </div>
          {item && <MapPin size={13} className="text-tertiary opacity-0 group-hover:opacity-100 shrink-0" />}
        </button>
      </SectionCard>
    )
  }

  // An expiring/expired consumable as a card: item name + "Expired/Expires <date>"
  // (the date line goes red when lapsed). Tap locates it on the map.
  const renderExpiredCard = ({ item, status }: { item: ReceiptItem; status: 'expired' | 'expiring' }) => {
    const expired = status === 'expired'
    // Date-only string → parse as local midnight (matches expiryStatus) so the
    // displayed day can't drift a day earlier in negative-offset timezones.
    const dateLabel = item.expiry_date ? formatDate(item.expiry_date + 'T00:00:00') : ''
    return (
      <SectionCard key={item.id}>
        <button
          type="button"
          onClick={() => onLocateItem(item)}
          className="group w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themeblue2/5"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{item.name}</p>
            <p className={`text-[9pt] mt-0.5 truncate ${expired ? 'text-themeredred' : 'text-tertiary'}`}>
              {expired ? `Expired ${dateLabel}` : `Expires ${dateLabel}`}
            </p>
          </div>
          <MapPin size={13} className="text-tertiary opacity-0 group-hover:opacity-100 shrink-0" />
        </button>
      </SectionCard>
    )
  }

  // Light muted line for an empty group (keeps the group from going missing).
  const emptyLine = (text: string) => (
    <p className="text-[9pt] text-tertiary italic px-1 py-1">{text}</p>
  )

  // A collapsible SECTION — the SectionHeader primitive (9pt semibold uppercase
  // primary) with a subtle TRAILING chevron so it reads as a section header you can
  // collapse, not a tree node. No count identifier per USR. When open, its discrete
  // items render as a flush card stack beneath the header (no tree indent).
  const renderGroup = (key: string, title: string, body: ReactNode) => {
    const open = expanded.has(key)
    return (
      <div>
        <button
          type="button"
          onClick={() => toggle(key)}
          className="w-full flex items-center gap-2 mb-2 text-left"
        >
          <SectionHeader>{title}</SectionHeader>
          <span className="flex-1" />
          {open ? (
            <ChevronDown size={14} className="text-tertiary/50 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-tertiary/50 shrink-0" />
          )}
        </button>
        {open && <div className="space-y-2.5">{body}</div>}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {/* Signed Out — always shown so an empty list reads as "all in". */}
        {renderGroup(
          '__signed_out__',
          'Signed Out',
          outstanding.length > 0
            ? outstanding.map(renderReceiptCard)
            : emptyLine(loading ? 'Loading…' : 'Nothing signed out.'),
        )}

        {/* History (returned) — hidden when empty. */}
        {history.length > 0 &&
          renderGroup('__history__', 'History', history.map(renderReceiptCard))}

        {/* Usage — consumables expended this week (item.expended ledger events).
            Always shown so an empty group reads as "nothing used" rather than missing. */}
        {renderGroup(
          '__usage__',
          'Usage',
          usageEvents.length > 0 ? usageEvents.map(renderUsageCard) : emptyLine('Nothing expended this week.'),
        )}

        {/* Expired — items lapsed or expiring within 30 days (expiry_date window).
            Always shown so an empty group reads as "nothing expiring". */}
        {renderGroup(
          '__expired__',
          'Expired',
          expiredItems.length > 0 ? expiredItems.map(renderExpiredCard) : emptyLine('Nothing expiring.'),
        )}

        {/* Recent maintenance + dispatch activity (this week) — "which items got
            PMCS'd or dispatched lately". Always shown so an empty group reads as
            "nothing this week" rather than going missing. */}
        {renderGroup(
          '__pmcs__',
          'PMCS',
          pmcsEvents.length > 0 ? pmcsEvents.map(renderActivityCard) : emptyLine('Nothing this week.'),
        )}

        {renderGroup(
          '__dispatch__',
          'Dispatch',
          dispatchEvents.length > 0 ? dispatchEvents.map(renderActivityCard) : emptyLine('Nothing this week.'),
        )}
      </div>
    </div>
  )
}
