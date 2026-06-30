import { useState, forwardRef, useImperativeHandle } from 'react'
import { Pencil, Check, PackageMinus, Trash2, X } from 'lucide-react'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { SectionCard } from '../Section'
import type { HandReceiptData } from '../../Hooks/useHandReceipts'
import type { CustodyLedgerEntry } from '../../Types/PropertyTypes'

/** A pending DA 3161 turn-in — its staged turn_in ledger rows grouped by the shared
 *  doc id, NOT yet verified (depot run still ahead). Parallels TurnInDoc (completed)
 *  but the rows are still live on the books, so the user can curate / complete / drop it. */
export interface PendingTurnIn {
  turnInDocId: string
  entries: CustodyLedgerEntry[]
}

export interface PropertyTurnInDetailHandle {
  /** Open the action menu (Edit · Complete · Remove) anchored to the host header's
   *  ellipsis button — the host renders the trigger; the menu + dialogs live here. */
  openMenu: (anchor: DOMRect) => void
}

interface PropertyTurnInDetailProps {
  turnIn: PendingTurnIn
  itemsById: HandReceiptData['itemsById']
  /** Drop ONE item back onto the books (curate). The host re-derives the turn-in from
   *  the live pending fold, so the row vanishes; the pane closes when the last one goes. */
  onUnstageItem: (itemId: string) => void
  /** Verify the WHOLE turn-in (depot accepted) — every item marked turned in. */
  onComplete: () => void
  /** Drop the WHOLE turn-in (un-stage every item back onto the books). */
  onRemove: () => void
  /** Close the host pane/sheet (after complete / remove the turn-in is gone). */
  onClose: () => void
}

/**
 * PropertyTurnInDetail — the right-pane (desktop) / detail-sheet (mobile) view of a
 * single PENDING DA 3161 turn-in, opened from a Custody-roster Turn-In card. Mirrors
 * PropertyRecordDetail: the label lives in the host header with a More (•••) menu
 * (opened via openMenu); the body is the turn-in's item rows. The menu carries the
 * three turn-in verbs — Edit items (curate: per-row remove un-stages one item),
 * Complete turn-in (verify the whole doc), Remove turn-in (un-stage everything). The
 * destructive verbs confirm; the host refetches off the store invalidation and closes
 * the pane once the turn-in empties.
 */
export const PropertyTurnInDetail = forwardRef<PropertyTurnInDetailHandle, PropertyTurnInDetailProps>(
  function PropertyTurnInDetail({ turnIn, itemsById, onUnstageItem, onComplete, onRemove, onClose }, ref) {
    const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect } | null>(null)
    const [curate, setCurate] = useState(false)
    const [confirm, setConfirm] = useState<null | 'complete' | 'remove'>(null)
    useImperativeHandle(ref, () => ({
      openMenu: (rect: DOMRect) => setMenuAnchor({ rect }),
    }), [])

    const menuItems: ContextMenuItem[] = [
      { key: 'edit', label: curate ? 'Done editing' : 'Edit items', icon: curate ? Check : Pencil, onAction: () => setCurate((c) => !c) },
      { key: 'complete', label: 'Complete turn-in', icon: PackageMinus, onAction: () => setConfirm('complete') },
      { key: 'remove', label: 'Remove turn-in', icon: Trash2, destructive: true, onAction: () => setConfirm('remove') },
    ]

    return (
      <div className="flex flex-col h-full px-3 py-3 space-y-2">
        {turnIn.entries.map((e) => {
          const it = itemsById.get(e.item_id)
          const qty = Math.max(1, e.quantity_delta ?? 1)
          return (
            <SectionCard key={e.id}>
              <div className="w-full flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {it?.name ?? 'Item'}{qty > 1 ? ` ×${qty}` : ''}
                  </p>
                  {it?.nsn && <p className="text-[9pt] text-tertiary mt-0.5 truncate">NSN {it.nsn}</p>}
                </div>
                {curate && (
                  <button
                    type="button"
                    aria-label="Remove from turn-in"
                    onClick={() => onUnstageItem(e.item_id)}
                    className="shrink-0 -mr-1 p-1 text-themeredred active:scale-90 transition-transform"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </SectionCard>
          )
        })}

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
          visible={confirm === 'complete'}
          title="Complete this turn-in?"
          subtitle="Marks every item as turned in to the depot."
          confirmLabel="Complete"
          variant="success"
          zIndex={1500}
          onConfirm={() => { setConfirm(null); onComplete(); onClose() }}
          onCancel={() => setConfirm(null)}
        />
        <ConfirmDialog
          visible={confirm === 'remove'}
          title="Remove this turn-in?"
          subtitle="Un-stages every item back onto the books."
          confirmLabel="Remove"
          variant="danger"
          zIndex={1500}
          onConfirm={() => { setConfirm(null); onRemove(); onClose() }}
          onCancel={() => setConfirm(null)}
        />
      </div>
    )
  },
)
