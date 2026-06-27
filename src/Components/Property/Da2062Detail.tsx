import { useState, useMemo, useCallback, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { MapPin, FileText, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { SectionCard } from '../Section'
import { PreviewOverlay } from '../PreviewOverlay'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { useHandReceiptActions } from '../../Hooks/useHandReceiptActions'
import type { ReceiptItem, HandReceiptData } from '../../Hooks/useHandReceipts'
import { ROOT_LOCATION_NAME, type HandReceipt } from '../../Types/PropertyTypes'

export interface Da2062DetailHandle {
  /** Open the action menu (Print 2062 / Sign in / Add item / Delete) anchored to the
   *  host header's ellipsis button. The host renders the trigger; the menu lives here so
   *  the receipt's confirm dialogs + add-item picker stay co-located. */
  openMenu: (anchor: DOMRect) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Da2062DetailProps {
  receipt: HandReceipt
  clinicId: string
  itemsById: HandReceiptData['itemsById']
  locationNameById: HandReceiptData['locationNameById']
  membersById: HandReceiptData['membersById']
  refetch: HandReceiptData['refetch']
  /** All receipts — needed to exclude items signed out on OTHER open 2062s from the
   *  add-item picker (an item can't be double-signed-out). */
  receipts: HandReceiptData['receipts']
  /** Fly the map to a signed-out item's usual zone and surface it. */
  onLocateItem: (item: ReceiptItem) => void
  /** Reprint this receipt's DA 2062 into the host's object-view surface (right pane
   *  desktop / detail sheet mobile) — owned by the host, not nested here. */
  onReprint: (r: HandReceipt) => void
  /** The whole property drawer element the add-item PreviewOverlay scopes to so it
   *  dims/centers over the drawer. Null on mobile → floats fixed above the sheet. */
  drawerRef?: RefObject<HTMLElement | null>
}

/**
 * Da2062Detail — the primitive right-pane (desktop) / detail-sheet (mobile) view of
 * a single DA 2062 hand receipt, opened from a Custody-roster card. Mirrors
 * PropertyItemDetail: the recipient/date title + a More (•••) menu live in the host
 * header (the menu opens via the openMenu handle); the body is the receipt's item
 * rows. Items tap → locate on the map; the trailing trash signs that one item back
 * in. The More menu holds Print 2062 / Sign in / Add item / Delete; Add item opens a
 * primitive PreviewOverlay picker (a modifier of this pane-hosted detail). Shares the
 * reprint / sign-in / add / remove / delete lifecycle via useHandReceiptActions.
 */
export const Da2062Detail = forwardRef<Da2062DetailHandle, Da2062DetailProps>(
  function Da2062Detail(
    { receipt, clinicId, itemsById, locationNameById, membersById, refetch, receipts, onLocateItem, onReprint, drawerRef },
    ref,
  ) {
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

    const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect } | null>(null)
    const [adding, setAdding] = useState(false)
    useImperativeHandle(ref, () => ({
      openMenu: (anchor: DOMRect) => setMenuAnchor({ rect: anchor }),
    }), [])

    const returned = receipt.status === 'returned'
    const busy = busyId === receipt.handReceiptId

    // Items already signed out on an OPEN receipt — excluded from the picker so an
    // item can't be double-signed-out across two 2062s.
    const signedOutItemIds = useMemo(() => {
      const s = new Set<string>()
      for (const r of receipts) {
        if (r.status === 'returned') continue
        for (const e of r.entries) s.add(e.item_id)
      }
      return s
    }, [receipts])

    // Add-item candidates: clinic items not already on this receipt and not signed out
    // elsewhere.
    const availableItems = useMemo(() => {
      const onReceipt = new Set(receipt.entries.map((e) => e.item_id))
      return [...itemsById.values()].filter((it) => !onReceipt.has(it.id) && !signedOutItemIds.has(it.id))
    }, [receipt.entries, itemsById, signedOutItemIds])

    const handleAdd = useCallback(
      (itemId: string) => { void addItems(receipt.handReceiptId, [itemId]) },
      [addItems, receipt.handReceiptId],
    )

    // Destination zones for the sign-in placement picker — "where does it land now"
    // (no original-location restore; the user picks). Excludes the invisible root.
    const zoneOptions = useMemo(
      () =>
        [...locationNameById.entries()]
          .filter(([, name]) => name !== ROOT_LOCATION_NAME)
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      [locationNameById],
    )

    const menuItems: ContextMenuItem[] = [
      { key: 'print', label: 'Print 2062', icon: FileText, onAction: () => onReprint(receipt) },
      ...(!returned
        ? [
            { key: 'signin', label: 'Sign in', icon: RotateCcw, onAction: () => setPendingSignIn(receipt) } as ContextMenuItem,
            { key: 'add', label: 'Add item', icon: Plus, onAction: () => setAdding(true) } as ContextMenuItem,
          ]
        : []),
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setPendingDelete(receipt) },
    ]

    return (
      <div className="flex flex-col h-full px-3 py-3 space-y-3">
        <SectionCard>
          {receipt.entries.map((e) => {
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
                {!returned && (
                  <button
                    onClick={() => setPendingRemove({ handReceiptId: receipt.handReceiptId, itemId: e.item_id })}
                    disabled={busy}
                    aria-label="Remove item from receipt"
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred hover:bg-themeredred/10 active:scale-95 transition disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </SectionCard>

        {/* Action menu — opened from the host header ellipsis (openMenu handle). */}
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

        {/* Add item — primitive PreviewOverlay picker (a modifier of this detail):
            clinic items not already on this receipt / signed out elsewhere. */}
        <PreviewOverlay
          isOpen={adding}
          onClose={() => setAdding(false)}
          anchorRect={null}
          containerRef={drawerRef}
          title="Add item"
          maxWidth={320}
        >
          <div className="max-h-72 overflow-y-auto">
            {availableItems.length === 0 ? (
              <p className="text-[9pt] text-tertiary italic px-4 py-4">No other items to add.</p>
            ) : (
              availableItems.map((it) => (
                <button
                  key={it.id}
                  onClick={() => handleAdd(it.id)}
                  disabled={busy}
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
        </PreviewOverlay>

        <ConfirmDialog
          visible={!!pendingRemove}
          title="Remove this item from the receipt?"
          confirmLabel="Remove"
          variant="danger"
          zIndex={1500}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />

        {/* Sign in — pick where the returned items land now (no original-location
            restore). "Leave where it is" signs in without moving; a zone signs in and
            re-places every item there. */}
        <PreviewOverlay
          isOpen={!!pendingSignIn}
          onClose={() => setPendingSignIn(null)}
          anchorRect={null}
          containerRef={drawerRef}
          title="Sign in — place where?"
          maxWidth={320}
        >
          <div className="max-h-72 overflow-y-auto">
            <button
              onClick={() => confirmSignIn()}
              disabled={busy}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left border-b border-primary/6 active:bg-themeblue2/5 disabled:opacity-40"
            >
              <RotateCcw size={13} className="text-themeblue3 shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-primary truncate">Leave where it is</span>
            </button>
            {zoneOptions.map((z) => (
              <button
                key={z.id}
                onClick={() => confirmSignIn(z.id)}
                disabled={busy}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left border-b border-primary/6 last:border-b-0 active:bg-themeblue2/5 disabled:opacity-40"
              >
                <MapPin size={13} className="text-tertiary shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-primary truncate">{z.name}</span>
              </button>
            ))}
          </div>
        </PreviewOverlay>

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
  },
)

/** Subtitle line for the host header — date + custody status. */
export function da2062DetailSubtitle(r: HandReceipt): string {
  return `${formatDate(r.recordedAt)} · ${r.status === 'returned' ? 'Returned' : 'Signed out'}`
}
