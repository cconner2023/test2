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
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { expiryStatus, type HandReceipt, type CustodyLedgerEntry, type TurnInDoc } from '../../Types/PropertyTypes'
import { formatDtg as formatDate } from '../../Utilities/propertyDates'
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
  menuItems = [],
  openMenu,
  onOpenMenu,
  trailing,
  children,
}: {
  active?: boolean
  onTap: () => void
  /** Inline menu items (receipts / records / turn-in docs), opened via `openMenu`. */
  menuItems?: ContextMenuItem[]
  openMenu?: (rect: DOMRect, items: ContextMenuItem[]) => void
  /** Item-backed cards (Usage / Expired) instead delegate to the panel-hosted shared
   *  item menu — this opens it anchored to the card. Takes precedence over menuItems. */
  onOpenMenu?: (rect: DOMRect) => void
  trailing?: ReactNode
  children: ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const hasMenu = !!onOpenMenu || menuItems.length > 0
  const openFromRow = useCallback(() => {
    if (!rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    if (onOpenMenu) onOpenMenu(rect)
    else if (menuItems.length && openMenu) openMenu(rect, menuItems)
  }, [onOpenMenu, openMenu, menuItems])
  const { isPressing, ...longPress } = useLongPress(openFromRow)
  // A flush ROW in the section's SectionCard stack — the divider between rows is the
  // enclosing card's `divide-y` (renderGroup), so the card itself owns no border/round.
  return (
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
          onClick={(e) => {
            e.stopPropagation()
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            if (onOpenMenu) onOpenMenu(rect)
            else if (openMenu) openMenu(rect, menuItems)
          }}
          className="shrink-0 -mr-1 p-1 text-tertiary active:scale-90 transition-transform"
        >
          <MoreHorizontal size={16} />
        </button>
      )}
    </div>
  )
}

type MetaField = { text: string; className?: string }

/**
 * The identifier fields a roster card shows for an item, in the order the property
 * surfaces share: NSN · location · serial · expiry. Absent fields drop out rather
 * than render blank, so a bulk consumable with none of them produces no meta line.
 * Quantity is NOT here — it rides the top row beside the name. NSN and the expiry
 * date carry no label — position and (for expiry) the urgency tint say what they
 * are; only the serial keeps its S/N prefix so two bare number strings can't be
 * confused for each other.
 */
function identityMeta(item: ReceiptItem, locationName?: string): MetaField[] {
  const meta: MetaField[] = []
  if (item.nsn) meta.push({ text: item.nsn })
  if (locationName) meta.push({ text: locationName })
  if (item.serial_number) meta.push({ text: `S/N ${item.serial_number}`, className: 'text-primary font-medium' })
  if (item.expiry_date) {
    const exp = expiryStatus(item.expiry_date)
    meta.push({
      text: formatDate(item.expiry_date),
      className:
        exp === 'expired'
          ? 'text-themeredred font-medium'
          : exp === 'expiring'
            ? 'text-themeyellow font-medium'
            : undefined,
    })
  }
  return meta
}

/**
 * An item's identity inside a CustodyCard — the shared block that makes the
 * Sign-outs roster read the same across its sections: the name, its count and an
 * optional `aside` (the event's date, for activity cards), then the dot-separated
 * identifiers, then an optional `detail` for whatever the section's event adds (who
 * signed it to whom, and when). `title` takes the composed string so grouped cards
 * can append their "+N more" suffix.
 *
 * Both runs WRAP rather than truncate — a long NSN + zone + serial would otherwise
 * clip the fields this roster exists to show — each capped at three lines so one
 * dense card can't crowd out the rest of the section.
 */
function ItemIdentity({
  title,
  qty,
  aside,
  meta,
  detail,
}: {
  title: string
  qty?: number
  aside?: string
  meta: MetaField[]
  detail?: string
}) {
  return (
    <>
      <p className="text-sm text-primary line-clamp-3">
        <span className="font-medium">{title}</span>
        {qty != null && <span className="text-secondary font-normal"> ×{qty}</span>}
        {aside && (
          <span className="text-secondary font-normal">
            <span className="mx-1 text-tertiary/50">·</span>
            {aside}
          </span>
        )}
      </p>
      {meta.length > 0 && (
        <p className="text-[10pt] text-secondary line-clamp-3 mt-0.5">
          {meta.map((m, i) => (
            <span key={i} className={m.className}>
              {i > 0 && <span className="mx-1 text-tertiary/50 font-normal">·</span>}
              {m.text}
            </span>
          ))}
        </p>
      )}
      {detail && <p className="text-[9pt] text-tertiary truncate mt-0.5">{detail}</p>}
    </>
  )
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
  /** Open the panel-hosted shared item menu for an item-backed card (Usage / Expired) —
   *  the full item action set (View · Edit · Split/Merge · Expend · … · Delete). The
   *  panel resolves the full store item from the lean ReceiptItem. Receipts / records /
   *  turn-in cards keep their own inline menus below. */
  onOpenItemMenu?: (item: ReceiptItem, rect: DOMRect) => void
  /** Open the receipt in the host's staged EDIT mode (Da2062Editor — drop lines,
   *  re-cut quantities, add items, with Save/Cancel in the host header). */
  onEditReceipt?: (r: HandReceipt) => void
  /** Open the receipt's detail and its sign-in zone picker (same hand-off as Edit). */
  onSignInReceipt?: (r: HandReceipt) => void
  /** Reprint the receipt's DA 2062 into the host's object-view surface. */
  onPrintReceipt?: (r: HandReceipt) => void
  /** Delete the whole hand receipt (confirmed upstream). */
  onDeleteReceipt?: (r: HandReceipt) => void
  /** Delete a PMCS/dispatch audit record (confirmed upstream). */
  onDeleteRecord?: (e: AuditEvent) => void
  /** DA 3161 turn-in: staged-pending rows + completed docs. */
  turnIns: TurnInFold
  /** Open a PENDING turn-in's detail in the host pane (curate / complete / remove).
   *  Locating the first item on the map + the view switch happen host-side. */
  onSelectTurnIn?: (turnIn: PendingTurnIn) => void
  /** Verify the WHOLE pending turn-in — depot accepted (confirmed upstream). */
  onCompleteTurnIn?: (turnIn: PendingTurnIn) => void
  /** Un-stage the WHOLE pending turn-in back onto the books (confirmed upstream). */
  onRemoveTurnIn?: (turnIn: PendingTurnIn) => void
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
 * SectionCard stack. Cards are consistent across all sections: a text card with no
 * leading icon chip — line 1 the subject, then the section's detail. Every
 * item-backed section (Signed Out · Turn-In · Expired) renders the SAME identity
 * block via ItemIdentity: name ×qty over NSN · location · serial · expiry, so the
 * fields a hand-receipt holder needs are visible without opening anything. Top: the
 * hand receipts under "Signed Out" — the first item's identity over "signer ·
 * recipient · date"; tap OPENS the 2062 detail in the host pane (right pane desktop
 * / sheet mobile). Middle: "Turn-In" (DA 3161 pending + completed docs), "Expired",
 * and "Usage" (item · ×qty · who did it); tap to locate the item. Bottom: the week's
 * "PMCS" (vehicle · who · date · faults)
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
  onOpenItemMenu,
  onEditReceipt,
  onSignInReceipt,
  onPrintReceipt,
  onDeleteReceipt,
  onDeleteRecord,
  turnIns,
  onSelectTurnIn,
  onCompleteTurnIn,
  onRemoveTurnIn,
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

  // Item-backed cards (Usage / Expired) open the panel-hosted shared item menu anchored
  // to the card — the same full menu the tree + item detail use. Only when a full store
  // item resolves (onOpenItemMenu supplied); otherwise the card is tap-only.
  const openItemMenu = useCallback(
    (item: ReceiptItem | undefined): ((rect: DOMRect) => void) | undefined =>
      item && onOpenItemMenu ? (rect) => onOpenItemMenu(item, rect) : undefined,
    [onOpenItemMenu],
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

  // The identity of a multi-item document's FIRST entry — the item a receipt or
  // turn-in card leads with, with "+N more" when the doc covers several. Shared by
  // Signed Out and Turn-In so a document card reads the same in both.
  const entryIdentity = (entries: CustodyLedgerEntry[], extraMeta: MetaField[] = []) => {
    const first = entries[0]
    const item = first ? itemsById.get(first.item_id) : undefined
    const more = entries.length - 1
    return {
      title: `${item?.name ?? 'Item'}${more > 0 ? ` · +${more} more` : ''}`,
      qty: Math.max(1, first?.quantity_delta ?? 1),
      meta: [
        ...(item ? identityMeta(item, item.location_id ? locationNameById.get(item.location_id) : undefined) : []),
        ...extraMeta,
      ],
    }
  }

  // Who signed the receipt out, to whom, and when — the custody event itself, which
  // sits below the item identifiers rather than among them. The signer resolves from
  // the roster; an unresolved actor (departed, or an external-facing row) drops out
  // of the line rather than showing a raw id.
  const receiptDetail = (r: HandReceipt): string =>
    [membersById.get(r.recordedBy)?.displayName, r.recipientLabel, formatDate(r.recordedAt)]
      .filter(Boolean)
      .join(' · ')

  // A hand receipt as a card in the stack — the first signed-out item's identity over
  // the custody line. Tapping opens its 2062 detail in the host pane (right pane /
  // sheet) for the full item list / print.
  const renderReceiptCard = (r: HandReceipt) => {
    // The SAME verb set as the 2062 detail's own ••• menu, so the document reads one
    // vocabulary wherever it's touched. Edit and Sign in are UI the DETAIL owns (the
    // edit mode; the sign-in zone picker), so the card opens the receipt and hands the
    // verb off. View leads and has no counterpart there: a card's menu is also its
    // right-click surface, and the detail drops View only because you're already in it.
    // Every card here is an OPEN receipt (`outstanding` filters out returned), so the
    // detail's returned-only pruning has nothing to do.
    const items: ContextMenuItem[] = [{ key: 'view', label: 'View', icon: Eye, onAction: () => onSelectReceipt(r) }]
    if (onEditReceipt) items.push({ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditReceipt(r) })
    if (onSignInReceipt) items.push({ key: 'signin', label: 'Sign in', icon: RotateCcw, onAction: () => onSignInReceipt(r) })
    if (onPrintReceipt) items.push({ key: 'print', label: 'Print 2062', icon: FileText, onAction: () => onPrintReceipt(r) })
    if (onDeleteReceipt) items.push({ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteReceipt(r) })
    return (
      <CustodyCard
        key={r.handReceiptId}
        active={selectedReceiptId === r.handReceiptId}
        onTap={() => onSelectReceipt(r)}
        menuItems={items}
        openMenu={openMenu}
      >
        <ItemIdentity {...entryIdentity(r.entries)} detail={receiptDetail(r)} />
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
        // Quantity rides the card's top row (×N beside the item), so the line below
        // carries only the custody event — who expended it and when.
        const who = membersById.get(e.actorId ?? '')?.displayName ?? null
        return [who, formatDate(e.occurredAt)].filter(Boolean).join(' · ')
      }
      default:
        return e.eventType
    }
  }

  // The date a card stamps beside the vehicle name — when it was PMCS'd, dispatched,
  // or (for a close) returned. It rides the title row, not the readings, because it
  // is what the roster is scanned by.
  const activityStamp = (e: AuditEvent): string => {
    const returned = e.payload?.returned_at
    return formatDate(e.eventType === 'dispatch.closed' && typeof returned === 'string' ? returned : e.occurredAt)
  }

  // The readings a PMCS / dispatch card carries where an item card carries its
  // identifiers — the fields that make the row actionable without opening the
  // record. PMCS: fuel · mileage · user · mechanic · faults. Dispatch out: mileage ·
  // TC · driver · exp. Dispatch in: the return and its odometer. Dates are NOT here;
  // they stamp the title row (activityStamp). Absent payload fields drop out; a
  // fault count and a lapsed exp date go red.
  const eventMeta = (e: AuditEvent): MetaField[] => {
    const p = e.payload ?? {}
    const meta: MetaField[] = []
    switch (e.eventType) {
      case 'pmcs.clear': {
        if (typeof p.fuelLevel === 'number') meta.push({ text: `Fuel ${p.fuelLevel}%` })
        if (typeof p.mileage === 'number') meta.push({ text: `${p.mileage.toLocaleString()} mi` })
        if (typeof p.operator === 'string' && p.operator) meta.push({ text: p.operator })
        if (typeof p.mechanic === 'string' && p.mechanic) meta.push({ text: `Mech ${p.mechanic}` })
        const n = pmcsOpened(e).length
        meta.push({
          text: n > 0 ? `${n} fault${n === 1 ? '' : 's'}` : 'No faults',
          className: n > 0 ? 'text-themeredred font-medium' : undefined,
        })
        break
      }
      case 'dispatch.opened': {
        if (typeof p.odo_out === 'number') meta.push({ text: `${p.odo_out.toLocaleString()} mi` })
        if (typeof p.tc === 'string' && p.tc) meta.push({ text: `TC ${p.tc}` })
        if (typeof p.operator === 'string' && p.operator) meta.push({ text: `Driver ${p.operator}` })
        if (typeof p.exp_date === 'string') {
          // Only a LAPSED dispatch reddens. A live one is typically days out, so the
          // 30-day 'expiring' tint would fire on nearly every open dispatch.
          meta.push({
            text: `exp ${formatDate(p.exp_date)}`,
            className: expiryStatus(p.exp_date) === 'expired' ? 'text-themeredred font-medium' : undefined,
          })
        }
        break
      }
      case 'dispatch.closed': {
        meta.push({ text: 'Returned' })
        if (typeof p.odo_in === 'number') meta.push({ text: `${p.odo_in.toLocaleString()} mi` })
        break
      }
    }
    return meta
  }

  // A PMCS / dispatch activity event as a card — the same identity block as every
  // other section, its meta run carrying the event's readings (eventMeta). A VEHICLE
  // subject resolves to a location, which has no NSN/serial, so those cards show the
  // readings alone; an item-backed check prefixes the item's identifiers. Doc
  // indicator when a form is attached. Tapping opens the record detail in the host
  // pane (view 5988E / dispatch form, delete), whose header still takes the terser
  // detailOf() subline — and the icon/tint via SelectedRecord, though the card
  // itself is icon-free.
  const renderActivityCard = (e: AuditEvent) => {
    const { Icon, tint } = activityMeta(e)
    const active = selectedRecordId === e.id
    const subject = e.subjectType === 'item' ? itemsById.get(e.subjectId) : undefined
    // The detail header takes "what it is + when" as its title and the subject as its
    // breadcrumb, so the pane doesn't repeat the vehicle name in a card below.
    const kind = e.eventType === 'pmcs.clear' ? 'PMCS' : e.eventType === 'dispatch.closed' ? 'Return' : 'Dispatch'
    const open = () =>
      onSelectRecord({
        event: e,
        title: `${kind} ${activityStamp(e)}`,
        label: activityName(e),
        Icon,
        tint,
        detail: detailOf(e),
      })
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
        <ItemIdentity
          title={activityName(e)}
          aside={activityStamp(e)}
          meta={[
            ...(subject ? identityMeta(subject, subject.location_id ? locationNameById.get(subject.location_id) : undefined) : []),
            ...eventMeta(e),
          ]}
        />
      </CustodyCard>
    )
  }

  // A usage (expenditure) event as a card — the item's identity over "who · when",
  // with ×N on the top row reading as the amount EXPENDED (not the stock on hand).
  // Tapping locates the item on the map (it still exists — expend clamps qty to 0,
  // never deletes). No detail pane: item.expended is an immutable, doc-less event.
  const renderUsageCard = (e: AuditEvent) => {
    const item = itemsById.get(e.subjectId)
    const qty = typeof e.payload?.quantity_delta === 'number' ? e.payload.quantity_delta : 1
    return (
      <CustodyCard
        key={e.id}
        onTap={() => item && onLocateItem(item)}
        onOpenMenu={openItemMenu(item)}
      >
        <ItemIdentity
          title={activityName(e)}
          qty={qty}
          meta={item ? identityMeta(item, item.location_id ? locationNameById.get(item.location_id) : undefined) : []}
          detail={detailOf(e)}
        />
      </CustodyCard>
    )
  }

  // An expiring/expired consumable as a card — the full item identity (name ×qty
  // over NSN · location · serial · expiry). The expiry field carries the
  // lapsed/soon tint, so the card needs no separate date line. Tap locates it on
  // the map.
  const renderExpiredCard = ({ item }: { item: ReceiptItem; status: 'expired' | 'expiring' }) => (
    <CustodyCard key={item.id} onTap={() => onLocateItem(item)} onOpenMenu={openItemMenu(item)}>
      <ItemIdentity
        title={item.name}
        qty={item.quantity}
        meta={identityMeta(item, item.location_id ? locationNameById.get(item.location_id) : undefined)}
      />
    </CustodyCard>
  )

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

  // A PENDING turn-in as a card. Tapping opens its detail in the host pane (curate /
  // complete / remove) AND locates the first item on the map + switches the view
  // (both host-side via onSelectTurnIn). The card menu carries the two whole-doc
  // verbs the detail header also offers — Complete and Remove — so a turn-in can be
  // closed out from the roster; per-item curation stays in the detail. Both confirm
  // upstream, where the ConfirmDialogs live.
  const renderPendingTurnInCard = (turnIn: PendingTurnIn) => {
    const items: ContextMenuItem[] = []
    if (onSelectTurnIn) items.push({ key: 'view', label: 'View', icon: Eye, onAction: () => onSelectTurnIn(turnIn) })
    if (onCompleteTurnIn) items.push({ key: 'complete', label: 'Complete turn-in', icon: PackageMinus, onAction: () => onCompleteTurnIn(turnIn) })
    if (onRemoveTurnIn) items.push({ key: 'remove', label: 'Remove turn-in', icon: Trash2, destructive: true, onAction: () => onRemoveTurnIn(turnIn) })
    return (
      <CustodyCard
        key={turnIn.turnInDocId}
        active={selectedTurnInId === turnIn.turnInDocId}
        onTap={() => onSelectTurnIn?.(turnIn)}
        menuItems={items}
        openMenu={openMenu}
      >
        {/* No state field — a pending doc's location already reads as the turn-in zone. */}
        <ItemIdentity {...entryIdentity(turnIn.entries)} />
      </CustodyCard>
    )
  }

  // A COMPLETED DA 3161 turn-in doc. (Tap / view → the 3161 PDF.)
  const renderTurnInDocCard = (doc: TurnInDoc) => {
    const items: ContextMenuItem[] = [
      ...(onViewTurnIn ? [{ key: 'view', label: 'Open DA 3161', icon: FileText, onAction: () => onViewTurnIn(doc) }] : []),
      ...(onDeleteTurnIn ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteTurnIn(doc) }] : []),
    ]
    return (
      <CustodyCard key={doc.turnInDocId} onTap={() => onViewTurnIn?.(doc)} menuItems={items} openMenu={openMenu}>
        <ItemIdentity {...entryIdentity(doc.entries, [{ text: `Turned in ${formatDate(doc.recordedAt)}` }])} />
      </CustodyCard>
    )
  }

  // Light muted line for an empty group (keeps the group from going missing).
  const emptyLine = (text: string) => (
    <p className="text-[9pt] text-tertiary italic px-1 py-1">{text}</p>
  )

  // A collapsible SECTION — a LEADING chevron (matching the property location tree's
  // group headers) then the SectionHeader primitive (9pt semibold uppercase primary),
  // so it reads as a collapsible tree node. No count identifier per USR. When open, its
  // rows render as ONE flush SectionCard stack (divide-y between rows), NOT discrete
  // per-item cards. `empty` bodies (the muted "nothing" line) stay bare — no card frame.
  const renderGroup = (key: string, title: string, body: ReactNode, empty = false) => {
    const open = expanded.has(key)
    return (
      <div>
        <button
          type="button"
          onClick={() => toggle(key)}
          className="w-full flex items-center gap-1.5 mb-2 text-left"
        >
          {open ? (
            <ChevronDown size={14} className="text-tertiary/50 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-tertiary/50 shrink-0" />
          )}
          <SectionHeader>{title}</SectionHeader>
        </button>
        {open &&
          (empty ? body : <SectionCard className="divide-y divide-tertiary/8">{body}</SectionCard>)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* pb-24 clears the glass BottomIsland that floats over this panel (both the
          desktop center pane and the mobile custody overlay). */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        {/* Section order (USR): Dispatch · PMCS · Signed Out · Turn-In · Expired · Usage. */}

        {/* Dispatch activity (this week). Always shown so an empty group reads as
            "nothing this week" rather than going missing. */}
        {renderGroup(
          '__dispatch__',
          'Dispatch',
          dispatchEvents.length > 0 ? dispatchEvents.map(renderActivityCard) : emptyLine('Nothing this week.'),
          dispatchEvents.length === 0,
        )}

        {/* PMCS / maintenance activity (this week). */}
        {renderGroup(
          '__pmcs__',
          'PMCS',
          pmcsEvents.length > 0 ? pmcsEvents.map(renderActivityCard) : emptyLine('Nothing this week.'),
          pmcsEvents.length === 0,
        )}

        {/* Signed Out — always shown so an empty list reads as "all in". */}
        {renderGroup(
          '__signed_out__',
          'Signed Out',
          outstanding.length > 0
            ? outstanding.map(renderReceiptCard)
            : emptyLine(loading ? 'Loading…' : 'Nothing signed out.'),
          outstanding.length === 0,
        )}

        {/* Turn-In (DA 3161) — ONE card per turn-in: pending cards open their detail
            (curate / complete / remove), completed docs read "Turned in <date>" and
            open the DA 3161. Always shown, like every other group here — the roster
            is a fixed set of sections, so a section that vanishes reads as a missing
            surface rather than an empty one. Hiding the turn-in surface when there is
            nothing staged is the TREE's job (PropertyLocationTree drops the empty
            system zone from its roots), not this panel's. */}
        {renderGroup(
          '__turnin__',
          'Turn-In',
          pendingTurnIns.length > 0 || turnIns.history.length > 0 ? (
            <>
              {pendingTurnIns.map(renderPendingTurnInCard)}
              {turnIns.history.map(renderTurnInDocCard)}
            </>
          ) : (
            emptyLine(loading ? 'Loading…' : 'Nothing turned in.')
          ),
          pendingTurnIns.length === 0 && turnIns.history.length === 0,
        )}

        {/* Expired — items lapsed or expiring within 30 days (expiry_date window).
            Always shown so an empty group reads as "nothing expiring". */}
        {renderGroup(
          '__expired__',
          'Expired',
          expiredItems.length > 0 ? expiredItems.map(renderExpiredCard) : emptyLine('Nothing expiring.'),
          expiredItems.length === 0,
        )}

        {/* Usage — consumables expended this week (item.expended ledger events).
            Always shown so an empty group reads as "nothing used" rather than missing. */}
        {renderGroup(
          '__usage__',
          'Usage',
          usageEvents.length > 0 ? usageEvents.map(renderUsageCard) : emptyLine('Nothing expended this week.'),
          usageEvents.length === 0,
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
