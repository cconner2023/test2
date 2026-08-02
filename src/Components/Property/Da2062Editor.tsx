import { useState, useMemo, useCallback, useEffect, useContext, forwardRef, useImperativeHandle } from 'react'
import { Check, ChevronDown, Minus, Plus, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { StackNavContext } from '@/Components/stackNav'
import { PreviewOverlay } from '../PreviewOverlay'
import { ItemRows, ItemsScreen } from './ItemPickerRows'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useHandReceiptActions } from '../../Hooks/useHandReceiptActions'
import type { HandReceiptData } from '../../Hooks/useHandReceipts'
import { isLinContainer, isAuthTarget, isZoneShadow } from '../../Utilities/propertyAuthorized'
import type { HandReceipt, LocalPropertyItem } from '../../Types/PropertyTypes'

export interface Da2062EditorHandle {
  /** Commit from the host header Check pill (calendar/property form pattern). */
  submit: () => void
}

interface Da2062EditorProps {
  receipt: HandReceipt
  clinicId: string
  itemsById: HandReceiptData['itemsById']
  membersById: HandReceiptData['membersById']
  refetch: HandReceiptData['refetch']
  /** All receipts — an item signed out on ANOTHER open 2062 can't join this one. */
  receipts: HandReceiptData['receipts']
  /** Leave edit mode (Save committed, or Cancel discarded). */
  onDone: () => void
  /** Reports commit-in-flight so the host surface can gate with the HUD loader. */
  onSavingChange?: (saving: boolean) => void
}

/**
 * Da2062Editor — the EDIT mode of an open DA 2062 hand receipt, and the only staged-
 * curation editor left in this domain (the DA 3161 turn-in has none: its pending list is a
 * ZONE, curated by moving stock in and out of it like any other zone). Drop a line with its
 * X, re-cut a line's count, and pick more items onto the receipt. NOTHING is written until
 * the host header's Save, so a half-finished edit is abandoned wholesale with Cancel —
 * which is why the per-row instant mutations this replaced are gone.
 *
 * Dropping is a PER-ROW X, the same affordance the "Adding" rows use to un-pick. It
 * replaced a checkbox multi-select feeding a bulk Remove: the X is one tap instead of
 * two, needs no selection state, and needs no delete verb anywhere else — a staged
 * editor has nothing to protect, since the row only leaves the LIST until Save.
 *
 * A line's ceiling is its signed count PLUS what is still on hand, because raising it
 * draws the difference off the shelf — unlike the turn-in editor, this one can grow.
 * A serialized unit IS the custody (one row, one thing), so it never steps.
 *
 * Adds go through addReceiptItems (which signs a stack out at 1) and then re-cut via
 * setReceiptItemQuantity when the picker asked for more — the SAME call the existing
 * lines use, rather than a second quantity-aware add path.
 */
export const Da2062Editor = forwardRef<Da2062EditorHandle, Da2062EditorProps>(
  function Da2062Editor({ receipt, clinicId, itemsById, membersById, refetch, receipts, onDone, onSavingChange }, ref) {
    const store = usePropertyStore(useShallow((s) => ({ items: s.items, locations: s.locations })))
    const { removeItem, setItemQuantity, addItems } = useHandReceiptActions({ clinicId, itemsById, membersById, refetch })

    // Mobile hosts this inside the property sheet's stack engine, where the item picker
    // MORPHS the sheet in place; desktop has no stack, so it falls back to the anchored
    // PreviewOverlay popover (the sign-out / turn-in pattern).
    const stackNav = useContext(StackNavContext)

    const [removed, setRemoved] = useState<Set<string>>(new Set())
    /** receipt item id → the re-cut count. Absent = leave the line at its signed count. */
    const [counts, setCounts] = useState<Map<string, number>>(new Map())
    /** Item ids picked to join this receipt, with the count each should sign out at. */
    const [adds, setAdds] = useState<Map<string, number>>(new Map())
    const [busy, setBusy] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)

    const locationName = useCallback(
      (id: string | null) => (id ? store.locations.find((l) => l.id === id)?.name ?? null : null),
      [store.locations],
    )

    // The receipt's lines, each resolved to its live stack. `signed` is what the 2062
    // covers today; `max` adds the on-hand remainder — the room a line has to grow.
    const lines = useMemo(
      () =>
        receipt.entries
          .map((e) => {
            const item = store.items.find((i) => i.id === e.item_id)
            if (!item) return null
            const signed = Math.max(1, e.quantity_delta ?? 1)
            return { entryId: e.id, item, signed, max: item.is_serialized ? 1 : signed + Math.max(0, item.quantity) }
          })
          .filter((l): l is { entryId: string; item: LocalPropertyItem; signed: number; max: number } => !!l),
      [receipt.entries, store.items],
    )

    // Items already out on an OPEN receipt (this one included) — an item can't be
    // double-signed-out, so none of them can join.
    const signedOutItemIds = useMemo(() => {
      const s = new Set<string>()
      for (const r of receipts) {
        if (r.status === 'returned') continue
        for (const e of r.entries) s.add(e.item_id)
      }
      return s
    }, [receipts])

    // What can still JOIN the receipt: on-hand, top-level, real property — never a LIN
    // header, a zone shadow, an unplaced authorized par, or something already out.
    const candidates = useMemo(
      () =>
        store.items
          .filter(
            (i) =>
              !signedOutItemIds.has(i.id) &&
              !i.parent_item_id &&
              !i.deleted_at &&
              !i.turned_in_at &&
              i.quantity > 0 &&
              !isLinContainer(i) &&
              !isZoneShadow(i) &&
              !isAuthTarget(i),
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      [store.items, signedOutItemIds],
    )
    const candidatesById = useMemo(() => new Map(candidates.map((i) => [i.id, i])), [candidates])

    // Lines still on the working manifest (a pending removal just leaves the list —
    // Cancel restores it, Save purges it).
    const shown = useMemo(() => lines.filter((l) => !removed.has(l.item.id)), [lines, removed])

    const dropLine = useCallback((id: string) => {
      setRemoved((prev) => new Set(prev).add(id))
    }, [])

    // Re-cut ONE line within [1, signed + on-hand].
    const setCount = useCallback((id: string, next: number, signed: number, max: number) => {
      const clamped = Math.max(1, Math.min(next, max))
      setCounts((prev) => {
        const map = new Map(prev)
        if (clamped === signed) map.delete(id)
        else map.set(id, clamped)
        return map
      })
    }, [])

    const togglePicked = useCallback((id: string) => {
      setAdds((prev) => {
        const next = new Map(prev)
        if (next.has(id)) next.delete(id)
        else next.set(id, 1)
        return next
      })
    }, [])

    const setAddQty = useCallback((id: string, qty: number, max: number) => {
      setAdds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Map(prev)
        next.set(id, Math.max(1, Math.min(qty, Math.max(1, max))))
        return next
      })
    }, [])

    const openPicker = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (stackNav) {
        stackNav.pushScreen({
          title: 'Add to receipt',
          searchPlaceholder: 'Search items…',
          rightFooter: (_p, nav) => (
            <FooterPill side="right">
              <PillButton icon={Check} iconSize={18} accent="success" label="Done" onClick={nav.pop} />
            </FooterPill>
          ),
          render: (_p, _nav, filter = '') => (
            <ItemsScreen items={candidates} filter={filter} initial={adds} onChange={setAdds} locationName={locationName} />
          ),
        })
        return
      }
      setPickerAnchor(e.currentTarget.getBoundingClientRect())
      setPickerOpen(true)
    }, [stackNav, candidates, adds, locationName])

    // Drops and re-cuts first, then the adds — so a line freed by a drop is on hand
    // again before anything tries to sign it out on the same save.
    const commit = useCallback(async () => {
      if (busy) return
      setBusy(true)
      for (const id of removed) await removeItem(receipt.handReceiptId, id)
      for (const [id, count] of counts) {
        if (removed.has(id)) continue
        await setItemQuantity(receipt.handReceiptId, id, count)
      }
      if (adds.size > 0) {
        await addItems(receipt.handReceiptId, [...adds.keys()])
        for (const [id, qty] of adds) {
          if (qty > 1) await setItemQuantity(receipt.handReceiptId, id, qty)
        }
      }
      setBusy(false)
      onDone()
    }, [busy, removed, counts, adds, receipt.handReceiptId, removeItem, setItemQuantity, addItems, onDone])

    useImperativeHandle(ref, () => ({ submit: () => void commit() }), [commit])

    useEffect(() => { onSavingChange?.(busy) }, [busy, onSavingChange])
    // Clear the host's HUD flag on unmount so closing mid-flight never strands it.
    useEffect(() => () => onSavingChange?.(false), [onSavingChange])

    const addedItems = useMemo(
      () => [...adds.keys()].map((id) => candidatesById.get(id)).filter((i): i is LocalPropertyItem => !!i),
      [adds, candidatesById],
    )

    return (
      <>
        <div className="flex flex-col pb-2">
          {/* Add more to this receipt — PickerInput-shaped row (the sign-out pattern). */}
          <button
            type="button"
            onClick={openPicker}
            className="w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 border-b border-primary/6 focus:outline-none text-tertiary"
          >
            <span className="truncate">Add items to receipt…</span>
            <ChevronDown size={16} className="shrink-0 text-tertiary" />
          </button>

          {addedItems.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-[10pt] font-medium text-tertiary uppercase tracking-wide">Adding</p>
              {addedItems.map((i) => {
                const qty = adds.get(i.id) ?? 1
                const max = i.is_serialized ? 1 : Math.max(1, i.quantity)
                return (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-primary/6">
                    <button
                      type="button"
                      aria-label="Don't add"
                      onClick={() => togglePicked(i.id)}
                      className="shrink-0 -ml-1 p-1 text-tertiary active:scale-90 transition-transform"
                    >
                      <X size={16} />
                    </button>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-primary truncate">{i.name}</span>
                      <span className="block text-[10pt] text-tertiary truncate">
                        {locationName(i.location_id) || 'Unplaced'}
                      </span>
                    </span>
                    {max > 1 && (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setAddQty(i.id, qty - 1, max)}
                          disabled={qty <= 1}
                          aria-label="Decrease quantity"
                          className="w-8 h-8 rounded-full flex items-center justify-center border border-tertiary/30 text-tertiary active:scale-90 transition-all disabled:opacity-30"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="text-sm text-primary tabular-nums w-12 text-center">{qty} / {max}</span>
                        <button
                          type="button"
                          onClick={() => setAddQty(i.id, qty + 1, max)}
                          disabled={qty >= max}
                          aria-label="Increase quantity"
                          className="w-8 h-8 rounded-full flex items-center justify-center border border-tertiary/30 text-tertiary active:scale-90 transition-all disabled:opacity-30"
                        >
                          <Plus size={15} />
                        </button>
                      </span>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {shown.map(({ entryId, item, signed, max }) => {
            const count = counts.get(item.id) ?? signed
            return (
              <div key={entryId} className="flex items-center gap-3 px-4 py-3 border-b border-primary/6">
                {/* Drop the line — the same X the "Adding" rows use to un-pick, and the
                    only remove affordance. Staged like every other edit: the row leaves
                    the list, Cancel restores it, Save purges it. */}
                <button
                  type="button"
                  aria-label="Remove from receipt"
                  onClick={() => dropLine(item.id)}
                  className="shrink-0 -ml-1 p-1 text-tertiary active:scale-90 transition-transform"
                >
                  <X size={16} />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-primary truncate">{item.name}</span>
                  {item.nomenclature && <span className="block text-[10pt] text-tertiary truncate">{item.nomenclature}</span>}
                  {item.serial_number
                    ? <span className="block text-[10pt] text-tertiary truncate">S/N {item.serial_number}</span>
                    : item.nsn
                      ? <span className="block text-[10pt] text-tertiary truncate">{item.nsn}</span>
                      : null}
                </span>
                {/* A serialized line is one physical thing — no stepper, it goes whole. */}
                {max === 1 ? (
                  <span className="text-sm text-primary tabular-nums shrink-0">1</span>
                ) : (
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCount(item.id, count - 1, signed, max)}
                      disabled={count <= 1}
                      aria-label="Decrease quantity"
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-tertiary/30 text-tertiary active:scale-90 transition-all disabled:opacity-30"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="text-sm text-primary tabular-nums w-12 text-center">{count} / {max}</span>
                    <button
                      type="button"
                      onClick={() => setCount(item.id, count + 1, signed, max)}
                      disabled={count >= max}
                      aria-label="Increase quantity"
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-tertiary/30 text-tertiary active:scale-90 transition-all disabled:opacity-30"
                    >
                      <Plus size={15} />
                    </button>
                  </span>
                )}
              </div>
            )
          })}

          {shown.length === 0 && (
            <p className="px-6 py-8 text-center text-[10pt] text-tertiary">
              {addedItems.length > 0
                ? 'Every line was dropped — save to apply.'
                : 'Nothing left on this receipt — saving deletes it.'}
            </p>
          )}
        </div>

        {/* Desktop fallback picker — the mobile path morphs the sheet instead. */}
        <PreviewOverlay
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          anchorRect={pickerAnchor}
          title="Add to receipt"
          searchPlaceholder="Search items…"
          preview={(filter) => (
            <ItemRows
              items={candidates}
              filter={filter}
              quantities={adds}
              onToggle={togglePicked}
              onSetQty={setAddQty}
              locationName={locationName}
            />
          )}
        />
      </>
    )
  },
)
