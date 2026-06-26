import { useState, useMemo, useCallback, type ReactNode } from 'react'
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  FileText,
  RotateCcw,
  ClipboardCheck,
  Route,
  Trash2,
  Plus,
  PackageMinus,
  CalendarX,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react'
import type { ReceiptItem, HandReceiptData } from '../../Hooks/useHandReceipts'
import { useHandReceiptActions } from '../../Hooks/useHandReceiptActions'
import { useRecentPropertyActivity } from '../../Hooks/useRecentPropertyActivity'
import { RecordPreview } from './RecordPreview'
import { ConfirmDialog } from '../ConfirmDialog'
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
    case 'pmcs.clear':
      return { Icon: ClipboardCheck, tint: 'bg-themeblue3/10 text-themeblue2' }
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
  membersById: HandReceiptData['membersById']
  loading: HandReceiptData['loading']
  refetch: HandReceiptData['refetch']
  /** Fly the map to a signed-out item's usual zone and surface it ("target the equipment"). */
  onLocateItem: (item: ReceiptItem) => void
  /** Reprint a receipt's DA 2062. The PDF opens in the host's object-view surface
   *  (right pane desktop / detail sheet mobile) — this panel is MAIN-panel content,
   *  so the preview is NOT a nested overlay here. */
  onReprint: (r: HandReceipt) => void
}

/**
 * Custody tab — the DA 2062 accountability surface. A hybrid: collapsible GROUP
 * headers (the tree feel — chevron + label + count) whose discrete items render
 * as an indented SectionCard stack. Top: the hand receipts under "Signed Out" /
 * "History" groups, each a card — deliberately icon-light and count-free, just
 * recipient + date, expanding to its items + Print 2062 / Sign in. Middle:
 * "Usage" (consumables expended this week — item.expended ledger events, tap to
 * locate) + "Expired" (items lapsed or expiring within 30 days via expiry_date,
 * red/amber, tap to locate). Bottom: the
 * week's activity under "PMCS" + "Dispatch" groups (clinic-wide pmcs.clear /
 * dispatch.* audit events from the past week via useRecentPropertyActivity) so a
 * glance answers "which items got PMCS'd or dispatched this week". Each is a card
 * with the subject name + a detail line (readings / exp date); tapping opens
 * RecordPreview (view the 5988E / dispatch form, delete). Item moves are intentionally NOT surfaced here — current
 * location is always one item-search away, and per-item move history lives in
 * ItemTimeline. SEARCH is NOT here — it lives in the
 * single property header search (PropertySearchOverlay), which folds receipts in
 * as a "Sign-outs" section. Shares the reprint / sign-in lifecycle via
 * useHandReceiptActions; receipt data is supplied by the parent.
 */
export function CustodyPanel({
  clinicId,
  receipts,
  itemsById,
  locationNameById,
  membersById,
  loading,
  refetch,
  onLocateItem,
  onReprint,
}: CustodyPanelProps) {
  const {
    pendingSignIn,
    setPendingSignIn,
    confirmSignIn,
    pendingRemove,
    setPendingRemove,
    confirmRemove,
    addItems,
    pendingDelete,
    setPendingDelete,
    confirmDelete,
    busyId,
  } = useHandReceiptActions({ clinicId, itemsById, membersById, refetch })

  // Which receipt's "add item" picker is open (one at a time).
  const [addingFor, setAddingFor] = useState<string | null>(null)

  // Clinic-wide PMCS + dispatch activity for the past week — the "what got
  // inspected / dispatched lately" feed living below the hand receipts. A tapped
  // row opens RecordPreview (view 5988E / dispatch form, delete).
  const activity = useRecentPropertyActivity(clinicId)
  const [previewEvent, setPreviewEvent] = useState<AuditEvent | null>(null)
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

  // Expand state — holds collapsible GROUP keys ('__signed_out__' / '__pmcs__' /
  // '__dispatch__' default open, '__history__' collapsed) AND each receipt's
  // handReceiptId. The group chevrons keep the tree feel; the discrete receipts /
  // activity events inside an open group render as a card stack.
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

  // Items currently signed out on an OPEN receipt — excluded from the add-item
  // picker so an item can't be double-signed-out across two 2062s.
  const signedOutItemIds = useMemo(() => {
    const s = new Set<string>()
    for (const r of outstanding) for (const e of r.entries) s.add(e.item_id)
    return s
  }, [outstanding])

  // Add-item candidates: clinic items not already on this receipt and not signed
  // out elsewhere.
  const availableItems = useCallback(
    (r: HandReceipt) => {
      const onReceipt = new Set(r.entries.map((e) => e.item_id))
      return [...itemsById.values()].filter((it) => !onReceipt.has(it.id) && !signedOutItemIds.has(it.id))
    },
    [itemsById, signedOutItemIds],
  )

  // A hand receipt as a card in the stack. Header is recipient + date only (icon-
  // light, count-free per USR); expanding reveals its items (tap → locate) + the
  // Print 2062 / Sign in actions.
  const renderReceiptCard = (r: HandReceipt) => {
    const open = expanded.has(r.handReceiptId)
    const returned = r.status === 'returned'
    return (
      <SectionCard key={r.handReceiptId}>
        {/* Header row — recipient + date only (no icon, no count). */}
        <button
          onClick={() => toggle(r.handReceiptId)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themeblue2/5"
        >
          <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{r.recipientLabel}</span>
          <span className="text-[9pt] text-tertiary shrink-0">{formatDate(r.recordedAt)}</span>
          {open ? (
            <ChevronDown size={16} className="text-tertiary shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-tertiary shrink-0" />
          )}
        </button>

        {/* Items + actions when expanded */}
        {open && (
          <div className="border-t border-primary/6">
            {r.entries.map((e) => {
              const item = itemsById.get(e.item_id)
              const loc = item?.location_id ? locationNameById.get(item.location_id) : null
              return (
                <div
                  key={e.id}
                  className="group flex items-center gap-1 px-4 py-2.5 border-b border-primary/6 last:border-b-0"
                >
                  <button
                    onClick={() => item && onLocateItem(item)}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left active:opacity-70"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary truncate">
                        {item?.name ?? 'Unknown item'}
                        {(e.quantity_delta ?? 1) > 1 && (
                          <span className="ml-1.5 text-[10pt] font-medium text-tertiary tabular-nums">×{e.quantity_delta}</span>
                        )}
                      </p>
                      <p className="text-[9pt] text-tertiary mt-0.5 flex items-center gap-1 truncate">
                        {item?.serial_number
                          ? `S/N ${item.serial_number}`
                          : item?.nsn
                            ? `NSN ${item.nsn}`
                            : 'No NSN'}
                        {loc && (
                          <>
                            <span className="text-tertiary/50">·</span>
                            <MapPin size={11} className="text-tertiary shrink-0" />
                            usually {loc}
                          </>
                        )}
                      </p>
                    </div>
                    {item && (
                      <MapPin size={13} className="text-tertiary opacity-0 group-hover:opacity-100 shrink-0" />
                    )}
                  </button>
                  {/* Remove this item from the 2062 (deletes its record, signs it back in). */}
                  <button
                    onClick={() => setPendingRemove({ handReceiptId: r.handReceiptId, itemId: e.item_id })}
                    disabled={busyId === r.handReceiptId}
                    aria-label="Remove item from receipt"
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred hover:bg-themeredred/10 active:scale-95 transition disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}

            {/* Receipt actions — Print 2062, Sign in / Add item (open only), Delete */}
            <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
              <button
                onClick={() => onReprint(r)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-themeblue3/10 text-themeblue3 text-[10pt] font-medium active:scale-95 transition-transform"
              >
                <FileText size={14} />
                Print 2062
              </button>
              {!returned && (
                <button
                  onClick={() => setPendingSignIn(r)}
                  disabled={busyId === r.handReceiptId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary/10 text-secondary text-[10pt] font-medium active:scale-95 transition-transform"
                >
                  <RotateCcw size={14} />
                  Sign in
                </button>
              )}
              {!returned && (
                <button
                  onClick={() => setAddingFor(addingFor === r.handReceiptId ? null : r.handReceiptId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-themeblue3/10 text-themeblue3 text-[10pt] font-medium active:scale-95 transition-transform"
                >
                  <Plus size={14} />
                  Add item
                </button>
              )}
              <span className="flex-1" />
              <button
                onClick={() => setPendingDelete(r)}
                disabled={busyId === r.handReceiptId}
                aria-label="Delete hand receipt"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-themeredred/8 text-themeredred text-[10pt] font-medium active:scale-95 transition-transform disabled:opacity-40"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>

            {/* Add-item picker — clinic items not already on this receipt. */}
            {addingFor === r.handReceiptId && (
              <div className="border-t border-primary/6 max-h-56 overflow-y-auto bg-themeblue2/3">
                {availableItems(r).length === 0 ? (
                  <p className="text-[9pt] text-tertiary italic px-4 py-3">No other items to add.</p>
                ) : (
                  availableItems(r).map((it) => (
                    <button
                      key={it.id}
                      onClick={() => addItems(r.handReceiptId, [it.id])}
                      disabled={busyId === r.handReceiptId}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left border-b border-primary/6 last:border-b-0 active:bg-themeblue2/5 disabled:opacity-40"
                    >
                      <Plus size={13} className="text-themeblue3 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-primary truncate">{it.name}</p>
                        <p className="text-[9pt] text-tertiary truncate">
                          {it.serial_number ? `S/N ${it.serial_number}` : it.nsn ? `NSN ${it.nsn}` : 'No NSN'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </SectionCard>
    )
  }

  // Item / vehicle name a PMCS / dispatch event is about.
  const activityName = (e: AuditEvent): string =>
    e.subjectType === 'item'
      ? itemsById.get(e.subjectId)?.name ?? 'Item'
      : locationNameById.get(e.subjectId) ?? 'Vehicle'

  // The record detail shown on the row's second line + in RecordPreview: readings
  // for PMCS, exp date for a dispatch.
  const detailOf = (e: AuditEvent): string => {
    const p = e.payload ?? {}
    switch (e.eventType) {
      case 'pmcs.clear': {
        const parts: string[] = []
        if (typeof p.mileage === 'number') parts.push(`${p.mileage.toLocaleString()} mi`)
        if (typeof p.fuelLevel === 'number') parts.push(`Fuel ${p.fuelLevel}%`)
        if (typeof p.operator === 'string' && p.operator) parts.push(p.operator)
        if (typeof p.mechanic === 'string' && p.mechanic) parts.push(`Mech ${p.mechanic}`)
        return parts.length ? `PMCS · ${parts.join(' · ')}` : 'PMCS — no new faults'
      }
      case 'dispatch.opened': {
        const op = typeof p.operator === 'string' && p.operator ? ` · ${p.operator}` : ''
        const tc = typeof p.tc === 'string' && p.tc ? ` · TC ${p.tc}` : ''
        return typeof p.exp_date === 'string'
          ? `Dispatched · exp ${formatDate(p.exp_date)}${op}${tc}`
          : `Dispatched${op}${tc}`
      }
      case 'dispatch.closed':
        return 'Returned'
      case 'item.expended': {
        const qty = typeof p.quantity_delta === 'number' ? p.quantity_delta : 1
        return `Expended ×${qty}`
      }
      default:
        return e.eventType
    }
  }

  // A PMCS / dispatch activity event as a card: subject name + detail·date, icon
  // chip matching its RecordPreview tint, doc indicator when a form is attached.
  // Tap opens RecordPreview (view 5988E / dispatch form, delete).
  const renderActivityCard = (e: AuditEvent) => {
    const { Icon, tint } = activityMeta(e)
    return (
      <SectionCard key={e.id}>
        <button
          type="button"
          onClick={() => setPreviewEvent(e)}
          className="group w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themeblue2/5"
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tint}`}>
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{activityName(e)}</p>
            <p className="text-[9pt] text-tertiary mt-0.5 truncate">{detailOf(e)} · {formatDate(e.occurredAt)}</p>
          </div>
          {hasDoc(e) && <FileText size={14} className="text-themeblue2 shrink-0" />}
        </button>
      </SectionCard>
    )
  }

  // A usage (expenditure) event as a card: item name + "Expended ×N · date". Tapping
  // locates the item on the map (it still exists — expend clamps qty to 0, never
  // deletes). No RecordPreview: item.expended is an immutable, doc-less ledger event.
  const renderUsageCard = (e: AuditEvent) => {
    const { Icon, tint } = activityMeta(e)
    const item = itemsById.get(e.subjectId)
    return (
      <SectionCard key={e.id}>
        <button
          type="button"
          onClick={() => item && onLocateItem(item)}
          className="group w-full flex items-center gap-3 px-4 py-3 text-left active:bg-themeblue2/5"
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tint}`}>
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{activityName(e)}</p>
            <p className="text-[9pt] text-tertiary mt-0.5 truncate">{detailOf(e)} · {formatDate(e.occurredAt)}</p>
          </div>
          {item && <MapPin size={13} className="text-tertiary opacity-0 group-hover:opacity-100 shrink-0" />}
        </button>
      </SectionCard>
    )
  }

  // An expiring/expired consumable as a card: item name + "Expired/Expires <date>",
  // tinted red (lapsed) or amber (within 30 days). Tap locates it on the map.
  const renderExpiredCard = ({ item, status }: { item: ReceiptItem; status: 'expired' | 'expiring' }) => {
    const expired = status === 'expired'
    const Icon = expired ? CalendarX : CalendarClock
    const tint = expired ? 'bg-themeredred/10 text-themeredred' : 'bg-themeyellow/15 text-themeyellow'
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
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tint}`}>
            <Icon size={16} />
          </div>
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
  // primary) + count, with a subtle TRAILING chevron so it reads as a section
  // header you can collapse, not a tree node. When open, its discrete items render
  // as a flush card stack beneath the header (no tree indent).
  const renderGroup = (key: string, title: string, count: number, body: ReactNode) => {
    const open = expanded.has(key)
    return (
      <div>
        <button
          type="button"
          onClick={() => toggle(key)}
          className="w-full flex items-center gap-2 mb-2 text-left"
        >
          <SectionHeader>{title}</SectionHeader>
          {count > 0 && <span className="text-[9pt] text-tertiary tabular-nums">{count}</span>}
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
          outstanding.length,
          outstanding.length > 0
            ? outstanding.map(renderReceiptCard)
            : emptyLine(loading ? 'Loading…' : 'Nothing signed out.'),
        )}

        {/* History (returned) — hidden when empty. */}
        {history.length > 0 &&
          renderGroup('__history__', 'History', history.length, history.map(renderReceiptCard))}

        {/* Usage — consumables expended this week (item.expended ledger events).
            Always shown so an empty group reads as "nothing used" rather than missing. */}
        {renderGroup(
          '__usage__',
          'Usage',
          usageEvents.length,
          usageEvents.length > 0 ? usageEvents.map(renderUsageCard) : emptyLine('Nothing expended this week.'),
        )}

        {/* Expired — items lapsed or expiring within 30 days (expiry_date window).
            Always shown so an empty group reads as "nothing expiring". */}
        {renderGroup(
          '__expired__',
          'Expired',
          expiredItems.length,
          expiredItems.length > 0 ? expiredItems.map(renderExpiredCard) : emptyLine('Nothing expiring.'),
        )}

        {/* Recent maintenance + dispatch activity (this week) — "which items got
            PMCS'd or dispatched lately". Always shown so an empty group reads as
            "nothing this week" rather than going missing. */}
        {renderGroup(
          '__pmcs__',
          'PMCS',
          pmcsEvents.length,
          pmcsEvents.length > 0 ? pmcsEvents.map(renderActivityCard) : emptyLine('Nothing this week.'),
        )}

        {renderGroup(
          '__dispatch__',
          'Dispatch',
          dispatchEvents.length,
          dispatchEvents.length > 0 ? dispatchEvents.map(renderActivityCard) : emptyLine('Nothing this week.'),
        )}
      </div>

      {/* Tap an activity row → preview the record (subject name + detail; view
          5988E / dispatch form; delete). */}
      <RecordPreview
        event={previewEvent}
        onClose={() => setPreviewEvent(null)}
        label={previewEvent ? `${activityName(previewEvent)} · ${detailOf(previewEvent)}` : ''}
        Icon={previewEvent ? activityMeta(previewEvent).Icon : FileText}
        tint={previewEvent ? activityMeta(previewEvent).tint : 'bg-tertiary/10 text-tertiary'}
      />

      <ConfirmDialog
        visible={!!pendingRemove}
        title="Remove this item from the receipt?"
        confirmLabel="Remove"
        variant="danger"
        zIndex={1500}
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />

      <ConfirmDialog
        visible={!!pendingSignIn}
        title="Sign this hand receipt back in?"
        subtitle={pendingSignIn ? `${pendingSignIn.entries.length} item(s) return to the property book.` : ''}
        confirmLabel="Sign in"
        variant="primary"
        zIndex={1500}
        onConfirm={confirmSignIn}
        onCancel={() => setPendingSignIn(null)}
      />

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete this hand receipt?"
        subtitle={
          pendingDelete
            ? `Removes the 2062 and all ${pendingDelete.entries.length} item record(s) + their timeline entries. Items return to the property book.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        zIndex={1500}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
