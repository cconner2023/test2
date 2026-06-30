import { useState, useMemo, useCallback, useRef, type ReactNode } from 'react'
import {
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
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
import type { TurnInFold } from '../../Utilities/handReceipts'
import { useRecentPropertyActivity } from '../../Hooks/useRecentPropertyActivity'
import { useLongPress } from '../../Hooks/useLongPress'
import { summarizePmcs, pmcsOpened } from '../../lib/pmcsFold'
import type { SelectedRecord } from './PropertyRecordDetail'
import type { PendingTurnIn } from './PropertyTurnInDetail'
import { SectionCard, SectionHeader } from '../Section'
import { AnchoredMenu } from '../LiftedRowMenu'
import type { ContextMenuItem } from '../ContextMenu'
import { expiryStatus, type HandReceipt, type CustodyLedgerEntry, type TurnInDoc } from '../../Types/PropertyTypes'
import type { AuditEvent } from '../../lib/auditTypes'

/**
 * One Custody-roster card — the borderless SectionCard row shared by every section
 * (receipts / usage / expired / PMCS / dispatch). A short tap runs the primary
 * action (`onTap`); the trailing ellipsis, a right-click, or a long-press all open
 * the SAME object context menu (`menuItems`) via the AnchoredMenu the parent hosts.
 * The card never builds its own item list — the parent passes the adaptive set so
 * each entity offers only the actions that apply (calendar eventMenu pattern).
 */
function CustodyCard({
  active,
  onTap,
  menuItems,
  openMenu,
  trailing,
  children,
}: {
  active?: boolean
  onTap: () => void
  menuItems: ContextMenuItem[]
  openMenu: (rect: DOMRect, items: ContextMenuItem[]) => void
  trailing?: ReactNode
  children: ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const hasMenu = menuItems.length > 0
  const openFromRow = useCallback(() => {
    if (hasMenu && rowRef.current) openMenu(rowRef.current.getBoundingClientRect(), menuItems)
  }, [hasMenu, openMenu, menuItems])
  const { isPressing, ...longPress } = useLongPress(openFromRow)
  return (
    <SectionCard>
      <div
        ref={rowRef}
        onContextMenu={hasMenu ? (e) => { e.preventDefault(); e.stopPropagation(); openFromRow() } : undefined}
        {...(hasMenu ? longPress : {})}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${isPressing ? 'opacity-60' : ''} ${active ? 'bg-themeblue2/8' : ''}`}
      >
        <button onClick={onTap} className="flex-1 min-w-0 text-left active:opacity-70">
          {children}
        </button>
        {trailing}
        {hasMenu && (
          <button
            type="button"
            aria-label="More actions"
            onClick={(e) => { e.stopPropagation(); openMenu((e.currentTarget as HTMLElement).getBoundingClientRect(), menuItems) }}
            className="shrink-0 -mr-1 p-1 text-tertiary active:scale-90 transition-transform"
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
    </SectionCard>
  )
}

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
  /** Fly the map to a signed-out / used / expiring item's usual zone and surface it.
   *  Doubles as the "Navigate to" menu action for item- and receipt-backed cards. */
  onLocateItem: (item: ReceiptItem) => void
  /** Open a hand receipt's detail in the host pane (right pane desktop / sheet mobile). */
  onSelectReceipt: (r: HandReceipt) => void
  /** Open a PMCS / dispatch record's detail in the host pane. */
  onSelectRecord: (record: SelectedRecord) => void
  /** Object context-menu actions (ellipsis / right-click / long-press). Every card's
   *  menu opens with View (== the card's left click, kept so a right click reaches it);
   *  these add the mutations: items get Edit + Delete, receipts + records get Delete.
   *  Each is OPTIONAL so read-only viewers see View alone. The item handlers resolve the
   *  full store item from the lean ReceiptItem upstream. */
  onEditItem?: (item: ReceiptItem) => void
  onDeleteItem?: (item: ReceiptItem) => void
  /** Delete the whole hand receipt (confirmed upstream). */
  onDeleteReceipt?: (r: HandReceipt) => void
  /** Delete a PMCS/dispatch audit record (confirmed upstream). */
  onDeleteRecord?: (e: AuditEvent) => void
  /** DA 3161 turn-in: staged-pending rows + completed docs. */
  turnIns: TurnInFold
  /** Open a PENDING turn-in's detail in the host pane (curate / complete / remove).
   *  Locating the first item on the map + the view switch happen host-side. */
  onSelectTurnIn?: (turnIn: PendingTurnIn) => void
  /** Open / print the DA 3161 for a completed turn-in doc. */
  onViewTurnIn?: (doc: TurnInDoc) => void
  /** Delete a submitted DA 3161 record — does NOT restore equipment (items stay turned in). */
  onDeleteTurnIn?: (doc: TurnInDoc) => void
  /** The open pending turn-in (doc id) — for the selected-row highlight (desktop). */
  selectedTurnInId?: string | null
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
  onEditItem,
  onDeleteItem,
  onDeleteReceipt,
  onDeleteRecord,
  turnIns,
  onSelectTurnIn,
  onViewTurnIn,
  onDeleteTurnIn,
  selectedTurnInId,
  selectedReceiptId,
  selectedRecordId,
}: CustodyPanelProps) {
  // The single object context menu shared by every card — opened from the trailing
  // ellipsis, a right-click, or a long-press. Clone-less list layout (the convention
  // for ellipsis-anchored menus); the parent passes the adaptive item set per card.
  const [menu, setMenu] = useState<{ rect: DOMRect; items: ContextMenuItem[] } | null>(null)
  const openMenu = useCallback((rect: DOMRect, items: ContextMenuItem[]) => setMenu({ rect, items }), [])

  // Build the adaptive menu for an item-backed card (Usage / Expired). View == the
  // card's left click (locate + surface the item) — kept in the menu so a right click
  // reaches it too. Navigate folded into View (same action). Edit + Delete follow,
  // each present only when its handler was supplied.
  const itemMenu = useCallback(
    (item: ReceiptItem | undefined): ContextMenuItem[] => {
      if (!item) return []
      const items: ContextMenuItem[] = [{ key: 'view', label: 'View', icon: Eye, onAction: () => onLocateItem(item) }]
      if (onEditItem) items.push({ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditItem(item) })
      if (onDeleteItem) items.push({ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteItem(item) })
      return items
    },
    [onLocateItem, onEditItem, onDeleteItem],
  )
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
    () => new Set(['__signed_out__', '__turnin__', '__usage__', '__expired__', '__pmcs__', '__dispatch__']),
  )
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Only OPEN hand receipts live in the Signed Out section. Returned receipts are
  // per-item history (surfaced in the item's own detail), not a sign-outs-tab group.
  const outstanding = useMemo(() => receipts.filter((r) => r.status !== 'returned'), [receipts])

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
    // View (open the 2062) == the card's left click — kept in the menu so a right
    // click reaches it too. Then Delete (drop the whole receipt). Receipts aren't a
    // single editable item, so no Edit.
    const items: ContextMenuItem[] = [{ key: 'view', label: 'View', icon: Eye, onAction: () => onSelectReceipt(r) }]
    if (onDeleteReceipt) items.push({ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteReceipt(r) })
    return (
      <CustodyCard key={r.handReceiptId} active={active} onTap={() => onSelectReceipt(r)} menuItems={items} openMenu={openMenu}>
        <p className="text-sm font-medium text-primary truncate">{itemLine}</p>
        <p className="text-[9pt] text-tertiary mt-0.5 truncate">{r.recipientLabel}</p>
      </CustodyCard>
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
    const open = () => onSelectRecord({ event: e, label: activityName(e), Icon, tint, detail: detailOf(e) })
    // View (the record's 5988E/dispatch form) == the card's left click — kept in the
    // menu so a right click reaches it too. Then Delete (drop the audit row). Records
    // aren't editable, so no Edit.
    const items: ContextMenuItem[] = [{ key: 'view', label: 'View', icon: Eye, onAction: open }]
    if (onDeleteRecord) items.push({ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteRecord(e) })
    return (
      <CustodyCard
        key={e.id}
        active={active}
        onTap={open}
        menuItems={items}
        openMenu={openMenu}
        trailing={hasDoc(e) ? <FileText size={14} className="text-themeblue2 shrink-0" /> : undefined}
      >
        <p className="text-sm font-medium text-primary truncate">{activityName(e)}</p>
        <p className="text-[9pt] text-tertiary mt-0.5 truncate">{detailOf(e)}</p>
      </CustodyCard>
    )
  }

  // A usage (expenditure) event as a card: item name on line 1, "×N · who did it"
  // below. Tapping locates the item on the map (it still exists — expend clamps qty
  // to 0, never deletes). No detail: item.expended is an immutable, doc-less event.
  const renderUsageCard = (e: AuditEvent) => {
    const item = itemsById.get(e.subjectId)
    return (
      <CustodyCard
        key={e.id}
        onTap={() => item && onLocateItem(item)}
        menuItems={itemMenu(item)}
        openMenu={openMenu}
      >
        <p className="text-sm font-medium text-primary truncate">{activityName(e)}</p>
        <p className="text-[9pt] text-tertiary mt-0.5 truncate">{detailOf(e)}</p>
      </CustodyCard>
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
      <CustodyCard key={item.id} onTap={() => onLocateItem(item)} menuItems={itemMenu(item)} openMenu={openMenu}>
        <p className="text-sm font-medium text-primary truncate">{item.name}</p>
        <p className={`text-[9pt] mt-0.5 truncate ${expired ? 'text-themeredred' : 'text-tertiary'}`}>
          {expired ? `Expired ${dateLabel}` : `Expires ${dateLabel}`}
        </p>
      </CustodyCard>
    )
  }

  // Pending turn-ins grouped by their shared doc id — ONE card per turn-in (not per
  // item), mirroring the completed-doc + hand-receipt cards. turnIns.pending is already
  // newest-first, so the Map preserves that order.
  const pendingTurnIns = useMemo<PendingTurnIn[]>(() => {
    const byDoc = new Map<string, CustodyLedgerEntry[]>()
    for (const e of turnIns.pending) {
      if (!e.hand_receipt_id) continue
      const arr = byDoc.get(e.hand_receipt_id) ?? []
      arr.push(e)
      byDoc.set(e.hand_receipt_id, arr)
    }
    return [...byDoc.entries()].map(([turnInDocId, entries]) => ({ turnInDocId, entries }))
  }, [turnIns.pending])

  // A PENDING turn-in as a card — first staged item (+N more) over "Pending turn-in".
  // Tapping opens its detail in the host pane (curate / complete / remove) AND locates
  // the first item on the map + switches the view (both host-side via onSelectTurnIn).
  const renderPendingTurnInCard = (turnIn: PendingTurnIn) => {
    const first = turnIn.entries[0]
    const firstName = first ? itemsById.get(first.item_id)?.name ?? 'Item' : 'Item'
    const more = turnIn.entries.length - 1
    const active = selectedTurnInId === turnIn.turnInDocId
    return (
      <CustodyCard
        key={turnIn.turnInDocId}
        active={active}
        onTap={() => onSelectTurnIn?.(turnIn)}
        menuItems={[]}
        openMenu={openMenu}
      >
        <p className="text-sm font-medium text-primary truncate">{firstName}{more > 0 ? ` · +${more} more` : ''}</p>
        <p className="text-[9pt] text-tertiary mt-0.5 truncate">Pending turn-in</p>
      </CustodyCard>
    )
  }

  // A COMPLETED DA 3161 turn-in doc — first item (+N more) over "Turned in · <date>".
  // (Tap / view → the 3161 PDF is the next slice.)
  const renderTurnInDocCard = (doc: TurnInDoc) => {
    const first = doc.entries[0]
    const firstName = first ? itemsById.get(first.item_id)?.name ?? 'Item' : 'Item'
    const more = doc.entries.length - 1
    const items: ContextMenuItem[] = [
      ...(onViewTurnIn ? [{ key: 'view', label: 'Open DA 3161', icon: FileText, onAction: () => onViewTurnIn(doc) }] : []),
      ...(onDeleteTurnIn ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteTurnIn(doc) }] : []),
    ]
    return (
      <CustodyCard key={doc.turnInDocId} onTap={() => onViewTurnIn?.(doc)} menuItems={items} openMenu={openMenu}>
        <p className="text-sm font-medium text-primary truncate">{firstName}{more > 0 ? ` · +${more} more` : ''}</p>
        <p className="text-[9pt] text-tertiary mt-0.5 truncate">Turned in · {formatDate(doc.recordedAt)}</p>
      </CustodyCard>
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
        {/* Section order (USR): Dispatch · PMCS · Signed Out · Turn-In · Expired · Usage. */}

        {/* Dispatch activity (this week). Always shown so an empty group reads as
            "nothing this week" rather than going missing. */}
        {renderGroup(
          '__dispatch__',
          'Dispatch',
          dispatchEvents.length > 0 ? dispatchEvents.map(renderActivityCard) : emptyLine('Nothing this week.'),
        )}

        {/* PMCS / maintenance activity (this week). */}
        {renderGroup(
          '__pmcs__',
          'PMCS',
          pmcsEvents.length > 0 ? pmcsEvents.map(renderActivityCard) : emptyLine('Nothing this week.'),
        )}

        {/* Signed Out — always shown so an empty list reads as "all in". */}
        {renderGroup(
          '__signed_out__',
          'Signed Out',
          outstanding.length > 0
            ? outstanding.map(renderReceiptCard)
            : emptyLine(loading ? 'Loading…' : 'Nothing signed out.'),
        )}

        {/* Turn-In (DA 3161) — ONE card per turn-in: pending cards open their detail
            (curate / complete / remove), completed docs read "Turned in · <date>" and
            open the DA 3161. Hidden only when both are empty. */}
        {(pendingTurnIns.length > 0 || turnIns.history.length > 0) &&
          renderGroup(
            '__turnin__',
            'Turn-In',
            <>
              {pendingTurnIns.map(renderPendingTurnInCard)}
              {turnIns.history.map(renderTurnInDocCard)}
            </>,
          )}

        {/* Expired — items lapsed or expiring within 30 days (expiry_date window).
            Always shown so an empty group reads as "nothing expiring". */}
        {renderGroup(
          '__expired__',
          'Expired',
          expiredItems.length > 0 ? expiredItems.map(renderExpiredCard) : emptyLine('Nothing expiring.'),
        )}

        {/* Usage — consumables expended this week (item.expended ledger events).
            Always shown so an empty group reads as "nothing used" rather than missing. */}
        {renderGroup(
          '__usage__',
          'Usage',
          usageEvents.length > 0 ? usageEvents.map(renderUsageCard) : emptyLine('Nothing expended this week.'),
        )}
      </div>

      {/* Shared object context menu — ellipsis / right-click / long-press on any card. */}
      <AnchoredMenu
        isOpen={!!menu}
        anchorRect={menu?.rect ?? null}
        items={menu?.items ?? []}
        layout="list"
        align="right"
        onClose={() => setMenu(null)}
      />
    </div>
  )
}
