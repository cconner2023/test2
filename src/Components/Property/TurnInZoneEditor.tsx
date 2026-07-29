import { useState, useMemo, useCallback, useEffect, useContext, forwardRef, useImperativeHandle } from 'react'
import { Check, ChevronDown, Minus, Plus, Trash2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { StackNavContext } from '@/Components/stackNav'
import { PreviewOverlay } from '../PreviewOverlay'
import { ItemRows, ItemsScreen } from './ItemPickerRows'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { getPendingTurnInDocIds } from '../../lib/propertyService'
import { isLinContainer, isAuthTarget, isZoneShadow } from '../../Utilities/propertyAuthorized'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'

export interface TurnInZoneEditorHandle {
  /** Commit from the host header Check pill (calendar/property form pattern). */
  submit: () => void
}

interface TurnInZoneEditorProps {
  /** The cluster's turn-in staging zone — its contents ARE the pending list. */
  zoneId: string
  /** Leave edit mode (Save committed, or Cancel discarded). */
  onDone: () => void
  /** Reports commit-in-flight so the host surface can gate with the HUD loader. */
  onSavingChange?: (saving: boolean) => void
}

/**
 * TurnInZoneEditor — the EDIT mode of the "Pending Turn-In" staging zone.
 *
 * Pending Turn-In is not a place, it is a LIST of what is going to the depot, so its
 * menu carries no zone verbs (no new area / level / item / delete). Editing it means
 * curating that list: multi-select lines to drop, re-cut a line's count ("only 4 of the
 * 10 are going"), and add more items to the run. Nothing is written until Save, so a
 * half-finished curation can be abandoned wholesale — the opposite of the per-row
 * instant un-stage in PropertyTurnInDetail, which curates ONE doc from the roster.
 *
 * Adds stage the WHOLE line; a partial add is "stage it, then re-cut the row", which
 * keeps one code path for the split (propertyService.setTurnInQuantity) instead of two.
 * Re-cutting is reduce-only for the same reason the service is: the leftover it hands
 * back is its own stack, so there is nothing to grow back into.
 */
export const TurnInZoneEditor = forwardRef<TurnInZoneEditorHandle, TurnInZoneEditorProps>(
  function TurnInZoneEditor({ zoneId, onDone, onSavingChange }, ref) {
    const store = usePropertyStore(
      useShallow((s) => ({
        clinicId: s.clinicId,
        items: s.items,
        locations: s.locations,
        stageTurnIn: s.stageTurnIn,
        setTurnInQuantity: s.setTurnInQuantity,
        unstageTurnInItem: s.unstageTurnInItem,
      })),
    )
    // Staged item → its pending doc, read off the ledger (see getPendingTurnInDocIds).
    // A line whose doc hasn't resolved yet simply can't be dropped or re-cut.
    const [docIdByItemId, setDocIdByItemId] = useState<Map<string, string>>(new Map())
    useEffect(() => {
      if (!store.clinicId) return
      let live = true
      void getPendingTurnInDocIds(store.clinicId).then((m) => { if (live) setDocIdByItemId(m) })
      return () => { live = false }
    }, [store.clinicId])

    // Mobile hosts this inside the property sheet's stack engine, where the item picker
    // MORPHS the sheet in place; desktop has no stack, so it falls back to the anchored
    // PreviewOverlay popover (the sign-out pattern).
    const stackNav = useContext(StackNavContext)

    const [removed, setRemoved] = useState<Set<string>>(new Set())
    const [selected, setSelected] = useState<Set<string>>(new Set())
    /** staged item id → the re-cut count. Absent = leave the line at its staged count. */
    const [counts, setCounts] = useState<Map<string, number>>(new Map())
    /** Item ids picked to join this turn-in. Value is unused (whole-line stage). */
    const [adds, setAdds] = useState<Map<string, number>>(new Map())
    const [busy, setBusy] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)

    const locationName = useCallback(
      (id: string | null) => (id ? store.locations.find((l) => l.id === id)?.name ?? null : null),
      [store.locations],
    )

    // The staged lines = the zone's live contents (cascaded SKO components ride their
    // parent kit and never relocate here, so this is exactly the top-level manifest).
    const staged = useMemo(
      () =>
        store.items
          .filter((i) => i.location_id === zoneId && !i.deleted_at && !i.turned_in_at)
          .sort((a, b) => a.name.localeCompare(b.name)),
      [store.items, zoneId],
    )

    // What can still JOIN the run: on-hand, top-level, real property — never a LIN
    // header, a zone shadow, an unplaced authorized par, or something already staged.
    const candidates = useMemo(
      () =>
        store.items
          .filter(
            (i) =>
              i.location_id !== zoneId &&
              !i.parent_item_id &&
              !i.deleted_at &&
              !i.turned_in_at &&
              i.quantity > 0 &&
              !isLinContainer(i) &&
              !isZoneShadow(i) &&
              !isAuthTarget(i),
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      [store.items, zoneId],
    )
    const candidatesById = useMemo(() => new Map(candidates.map((i) => [i.id, i])), [candidates])

    // Lines still on the working manifest (a pending removal just leaves the list —
    // Cancel restores it, Save purges it).
    const shown = useMemo(() => staged.filter((i) => !removed.has(i.id)), [staged, removed])

    const toggleSelected = useCallback((id: string) => {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }, [])

    const removeSelected = useCallback(() => {
      setRemoved((prev) => new Set([...prev, ...selected]))
      setSelected(new Set())
    }, [selected])

    // Re-cut ONE line, bounded by what is staged on it (reduce-only — see the doc-comment).
    const setCount = useCallback((id: string, next: number, max: number) => {
      const clamped = Math.max(1, Math.min(next, max))
      setCounts((prev) => {
        const map = new Map(prev)
        if (clamped >= max) map.delete(id)
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

    const openPicker = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (stackNav) {
        stackNav.pushScreen({
          title: 'Add to turn-in',
          searchPlaceholder: 'Search items…',
          rightFooter: (_p, nav) => (
            <FooterPill side="right">
              <PillButton icon={Check} iconSize={18} accent="success" label="Done" onClick={nav.pop} />
            </FooterPill>
          ),
          render: (_p, _nav, filter = '') => (
            <ItemsScreen
              items={candidates}
              filter={filter}
              initial={adds}
              onChange={setAdds}
              locationName={locationName}
              showQuantity={false}
            />
          ),
        })
        return
      }
      setPickerAnchor(e.currentTarget.getBoundingClientRect())
      setPickerOpen(true)
    }, [stackNav, candidates, adds, locationName])

    const commit = useCallback(async () => {
      if (busy) return
      setBusy(true)
      for (const id of removed) {
        const docId = docIdByItemId.get(id)
        if (docId) await store.unstageTurnInItem(docId, id)
      }
      for (const [id, count] of counts) {
        if (removed.has(id)) continue
        const docId = docIdByItemId.get(id)
        const line = staged.find((i) => i.id === id)
        if (docId && line && count < line.quantity) await store.setTurnInQuantity(docId, id, count)
      }
      if (adds.size > 0) await store.stageTurnIn([...adds.keys()])
      setBusy(false)
      onDone()
    }, [busy, removed, counts, adds, docIdByItemId, staged, store, onDone])

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
          {/* Add more to this depot run — PickerInput-shaped row (the sign-out pattern). */}
          <button
            type="button"
            onClick={openPicker}
            className="w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 border-b border-primary/6 focus:outline-none text-tertiary"
          >
            <span className="truncate">Add items to turn-in…</span>
            <ChevronDown size={16} className="shrink-0 text-tertiary" />
          </button>

          {addedItems.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-[10pt] font-medium text-tertiary uppercase tracking-wide">Adding</p>
              {addedItems.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-primary/6">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-primary truncate">{i.name}</span>
                    <span className="block text-[10pt] text-tertiary truncate">
                      {locationName(i.location_id) || 'Unplaced'}
                      {i.quantity > 1 ? ` · ${i.quantity}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Don't add"
                    onClick={() => togglePicked(i.id)}
                    className="shrink-0 -mr-1 p-1 text-tertiary active:scale-90 transition-transform"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Contextual bulk action — only while a selection exists (never a dimmed button). */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-primary/6">
              <span className="text-[10pt] text-tertiary tabular-nums">{selected.size} selected</span>
              <button
                type="button"
                onClick={removeSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-themeredred/10 text-themeredred text-[10pt] font-medium active:scale-95 transition-all"
              >
                <Trash2 size={14} />
                Remove from turn-in
              </button>
            </div>
          )}

          {shown.map((i) => {
            const max = Math.max(1, i.quantity)
            const count = counts.get(i.id) ?? max
            const isSelected = selected.has(i.id)
            const origin = locationName(i.turn_in_origin_location_id ?? null)
            return (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3 border-b border-primary/6">
                <button
                  type="button"
                  onClick={() => toggleSelected(i.id)}
                  className="flex items-start gap-3 min-w-0 flex-1 text-left"
                >
                  <span
                    className={`w-5 h-5 mt-0.5 rounded-md shrink-0 flex items-center justify-center border ${
                      isSelected ? 'bg-themeblue3 border-themeblue3' : 'border-tertiary/40'
                    }`}
                  >
                    {isSelected && <Check size={14} className="text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-primary truncate">{i.name}</span>
                    {i.nomenclature && <span className="block text-[10pt] text-tertiary truncate">{i.nomenclature}</span>}
                    {origin && <span className="block text-[10pt] text-tertiary truncate">From {origin}</span>}
                    {i.serial_number && <span className="block text-[10pt] text-tertiary truncate">S/N {i.serial_number}</span>}
                  </span>
                </button>
                {/* A serialized line is one physical thing — no stepper, it goes whole. */}
                {i.is_serialized || max === 1 ? (
                  <span className="text-sm text-primary tabular-nums shrink-0">1</span>
                ) : (
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[9pt] uppercase tracking-wide text-tertiary">Qty</span>
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCount(i.id, count - 1, max)}
                        disabled={count <= 1}
                        aria-label="Decrease quantity"
                        className="w-8 h-8 rounded-full flex items-center justify-center border border-tertiary/30 text-tertiary active:scale-90 transition-all disabled:opacity-30"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="text-sm text-primary tabular-nums w-12 text-center">{count} / {max}</span>
                      <button
                        type="button"
                        onClick={() => setCount(i.id, count + 1, max)}
                        disabled={count >= max}
                        aria-label="Increase quantity"
                        className="w-8 h-8 rounded-full flex items-center justify-center border border-tertiary/30 text-tertiary active:scale-90 transition-all disabled:opacity-30"
                      >
                        <Plus size={15} />
                      </button>
                    </span>
                  </span>
                )}
              </div>
            )
          })}

          {shown.length === 0 && (
            <p className="px-6 py-8 text-center text-[10pt] text-tertiary">
              {addedItems.length > 0 ? 'Everything staged was dropped — save to apply.' : 'Nothing pending turn-in.'}
            </p>
          )}
        </div>

        {/* Desktop fallback picker — the mobile path morphs the sheet instead. */}
        <PreviewOverlay
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          anchorRect={pickerAnchor}
          title="Add to turn-in"
          searchPlaceholder="Search items…"
          preview={(filter) => (
            <ItemRows
              items={candidates}
              filter={filter}
              quantities={adds}
              onToggle={togglePicked}
              onSetQty={() => {}}
              locationName={locationName}
              showQuantity={false}
            />
          )}
        />
      </>
    )
  },
)
