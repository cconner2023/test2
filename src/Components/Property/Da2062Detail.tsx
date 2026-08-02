import { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle, type RefObject } from 'react'
import { MapPin, FileText, RotateCcw, Pencil, Trash2 } from 'lucide-react'
import { TreeRow, TreeRowCount } from '@/Components/primitives/TreeRow'
import { PreviewOverlay } from '../PreviewOverlay'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { useHandReceiptActions } from '../../Hooks/useHandReceiptActions'
import type { ReceiptItem, HandReceiptData } from '../../Hooks/useHandReceipts'
import { ROOT_LOCATION_NAME, TURN_IN_ZONE_NAME, type HandReceipt } from '../../Types/PropertyTypes'

export interface Da2062DetailHandle {
  /** Open the action menu (Edit / Sign in / Print 2062 / Delete) anchored to the host
   *  header's ellipsis button. The host renders the trigger; the menu lives here so the
   *  receipt's sign-in picker + confirm dialogs stay co-located. */
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
  /** Fly the map to a signed-out item's usual zone and surface it. */
  onLocateItem: (item: ReceiptItem) => void
  /** Reprint this receipt's DA 2062 into the host's object-view surface (right pane
   *  desktop / detail sheet mobile) — owned by the host, not nested here. */
  onReprint: (r: HandReceipt) => void
  /** Enter the host's staged edit mode (Da2062Editor, with Save/Cancel in the host
   *  header) — the mode is a host surface, so the menu only asks for it. */
  onEdit?: () => void
  /** The whole property drawer element the sign-in PreviewOverlay scopes to so it
   *  dims/centers over the drawer. Null on mobile → floats fixed above the sheet. */
  drawerRef?: RefObject<HTMLElement | null>
  /** Sign in picked from the Custody roster CARD, whose zone picker lives here — the
   *  card opens the receipt and hands the verb across. Carries a per-pick token so
   *  picking Sign in again after cancelling the picker re-opens it. */
  signInIntent?: string | null
}

/**
 * Da2062Detail — the primitive right-pane (desktop) / detail-sheet (mobile) view of
 * a single DA 2062 hand receipt, opened from a Custody-roster card. Mirrors
 * PropertyItemDetail: the recipient/date title + a More (•••) menu live in the host
 * header (the menu opens via the openMenu handle); the body is the receipt's item
 * rows.
 *
 * This pane is READ ONLY, and its rows are the surfaceless TreeRow list the cluster
 * reports use (Shortages / Authorized) rather than a card stack — name over the item's
 * S/N or NSN, its quantity trailing. A card frame would read as content when the row
 * is only a handle into the map. No per-row icon, and NOT the item's usual zone: this
 * pane answers "what is on this 2062", and a location the receipt doesn't govern (the
 * item is signed OUT — it is wherever the holder took it) reads as an identifier of the
 * line when it isn't one. Tap still locates the item on the map.
 *
 * The More menu is Edit · Sign in · Print 2062 · Delete, both Edit and Sign in only
 * while the receipt is OPEN. Edit hands off to the host, which swaps this pane for
 * Da2062Editor and puts Save/Cancel in its header (the property form primitive) — so
 * no mutation happens from the read view, and a half-finished edit is abandoned
 * wholesale. Sign-in and delete stay here with their picker / confirm dialogs.
 */
export const Da2062Detail = forwardRef<Da2062DetailHandle, Da2062DetailProps>(
  function Da2062Detail(
    { receipt, clinicId, itemsById, locationNameById, membersById, refetch, onLocateItem, onReprint, onEdit, drawerRef, signInIntent },
    ref,
  ) {
    const {
      pendingSignIn,
      setPendingSignIn,
      confirmSignIn,
      pendingDelete,
      setPendingDelete,
      confirmDelete,
      busyId,
    } = useHandReceiptActions({ clinicId, itemsById, membersById, refetch })

    const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect } | null>(null)
    useImperativeHandle(ref, () => ({
      openMenu: (anchor: DOMRect) => setMenuAnchor({ rect: anchor }),
    }), [])

    const returned = receipt.status === 'returned'
    const busy = busyId === receipt.handReceiptId

    // Apply the roster card's sign-in hand-off ONCE per pick. Tracked by token rather
    // than by effect deps: `receipt` re-identifies on every refetch, which would
    // otherwise re-open the picker after each mutation.
    const appliedIntent = useRef<string | null>(null)
    useEffect(() => {
      if (!signInIntent || appliedIntent.current === signInIntent) return
      appliedIntent.current = signInIntent
      setPendingSignIn(receipt)
    }, [signInIntent, receipt, setPendingSignIn])

    // Destination zones for the sign-in placement picker — "where does it land now"
    // (no original-location restore; the user picks). Excludes the invisible root and the
    // turn-in staging zone: signing property in is not how it joins a depot run ("Stage for
    // turn-in" is, because that writes the DA 3161 row), so it is not a destination here.
    // Matched by name — this map carries names only, and both zones are system-named.
    const zoneOptions = useMemo(
      () =>
        [...locationNameById.entries()]
          .filter(([, name]) => name !== ROOT_LOCATION_NAME && name !== TURN_IN_ZONE_NAME)
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      [locationNameById],
    )

    // Edit and Sign in only exist while the receipt is OPEN — a returned 2062 is a
    // historical document whose items are already back, so it reads and prints only.
    const menuItems: ContextMenuItem[] = [
      ...(!returned && onEdit
        ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: onEdit } as ContextMenuItem]
        : []),
      ...(!returned
        ? [{ key: 'signin', label: 'Sign in', icon: RotateCcw, onAction: () => setPendingSignIn(receipt) } as ContextMenuItem]
        : []),
      { key: 'print', label: 'Print 2062', icon: FileText, onAction: () => onReprint(receipt) },
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setPendingDelete(receipt) },
    ]

    return (
      <div className="flex flex-col h-full py-3 gap-2">
        <div className="flex flex-col py-1">
          {receipt.entries.map((e) => {
            const item = itemsById.get(e.item_id)
            const qty = Math.max(1, e.quantity_delta ?? 1)
            // Only the serial keeps a prefix — a bare NSN can't be mistaken for one. A
            // line carrying neither drops the subline rather than saying so.
            return (
              <TreeRow
                key={e.id}
                title={item?.name ?? 'Unknown item'}
                sub={[item?.serial_number ? `S/N ${item.serial_number}` : item?.nsn]}
                trailing={<TreeRowCount>×{qty}</TreeRowCount>}
                onTap={() => item && onLocateItem(item)}
              />
            )
          })}
        </div>

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
