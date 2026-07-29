import { useState, useCallback } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'

/**
 * The shared multi-select property-item picker body — one source for every surface that
 * picks 1..N items with a per-item count (the DA 2062 sign-out, the turn-in staging
 * editor). Hosts differ (desktop PreviewOverlay popover vs. the mobile stack drill), so
 * this stays purely presentational and the host owns the selection state.
 */

/** Multi-select item rows with a per-item quantity stepper, filtered by the live
 *  search value. `showQuantity={false}` drops the whole right column for pickers whose
 *  verb is whole-line (turn-in stages the stack; the count is re-cut afterwards). */
export function ItemRows({ items, filter, quantities, onToggle, onSetQty, locationName, showQuantity = true }: {
  items: LocalPropertyItem[]
  filter: string
  quantities: Map<string, number>
  onToggle: (id: string) => void
  onSetQty: (id: string, qty: number, max: number) => void
  locationName: (id: string | null) => string | null
  showQuantity?: boolean
}) {
  const q = filter.trim().toLowerCase()
  const shown = q
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.nsn?.toLowerCase().includes(q) ||
          i.serial_number?.toLowerCase().includes(q),
      )
    : items
  return (
    <div>
      {shown.map((i) => {
        const qty = quantities.get(i.id)
        const selected = qty !== undefined
        const max = Math.max(1, i.quantity)
        const loc = locationName(i.location_id)
        const out = i.signed_out_external || !!i.current_holder_id
        // Serial | material identity line — mirrors the standard property item card.
        const serialMaterial = [
          i.serial_number ? `S/N ${i.serial_number}` : null,
          i.nsn ? `Material/NSN ${i.nsn}` : null,
        ].filter(Boolean).join(' | ')
        return (
          <div
            key={i.id}
            className="w-full flex items-center gap-3 px-4 py-3 active:bg-tertiary/5 border-b border-primary/6 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onToggle(i.id)}
              className="flex items-start gap-3 min-w-0 flex-1 text-left"
            >
              <span
                className={`w-5 h-5 mt-0.5 rounded-md shrink-0 flex items-center justify-center border ${
                  selected ? 'bg-themeblue3 border-themeblue3' : 'border-tertiary/40'
                }`}
              >
                {selected && <Check size={14} className="text-white" />}
              </span>
              {/* name / nomenclature / location / serial | material — the standard
                  property item card, one field per line. Quantity rides the right column. */}
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-primary truncate">{i.name}</span>
                {i.nomenclature && <span className="block text-[10pt] text-tertiary truncate">{i.nomenclature}</span>}
                <span className="block text-[10pt] text-tertiary truncate">
                  {loc || 'Unplaced'}
                  {out ? ' · already out' : ''}
                </span>
                {serialMaterial && <span className="block text-[10pt] text-tertiary truncate">{serialMaterial}</span>}
              </span>
            </button>
            {/* Right column: the on-hand quantity when browsing (how we normally show it),
                swapped for the full-size stepper once the item is selected. */}
            {!showQuantity ? null : selected ? (
              <span className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[9pt] uppercase tracking-wide text-tertiary">Qty</span>
                {max > 1 ? (
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSetQty(i.id, (qty ?? 1) - 1, max)}
                      disabled={(qty ?? 1) <= 1}
                      aria-label="Decrease quantity"
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-tertiary/30 text-tertiary active:scale-90 transition-all disabled:opacity-30"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="text-sm text-primary tabular-nums w-12 text-center">
                      {qty} / {max}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSetQty(i.id, (qty ?? 1) + 1, max)}
                      disabled={(qty ?? 1) >= max}
                      aria-label="Increase quantity"
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-tertiary/30 text-tertiary active:scale-90 transition-all disabled:opacity-30"
                    >
                      <Plus size={15} />
                    </button>
                  </span>
                ) : (
                  <span className="text-sm text-primary tabular-nums">1</span>
                )}
              </span>
            ) : (
              max > 1 && <span className="text-sm text-primary tabular-nums shrink-0">{i.quantity}</span>
            )}
          </div>
        )
      })}
      {shown.length === 0 && <p className="px-4 py-3 text-[10pt] text-tertiary">No items match.</p>}
    </div>
  )
}

/** Multi-select items drill screen. A pushed stack screen freezes its render closure
 *  at push time, so it can't read the host's live `quantities` — it owns a local Map
 *  seeded from `initial` and commits every change up via `onChange` (MultiSelectScreen
 *  pattern). */
export function ItemsScreen({ items, filter, initial, onChange, locationName, showQuantity = true }: {
  items: LocalPropertyItem[]
  filter: string
  initial: Map<string, number>
  onChange: (next: Map<string, number>) => void
  locationName: (id: string | null) => string | null
  showQuantity?: boolean
}) {
  const [qtys, setQtys] = useState<Map<string, number>>(() => new Map(initial))
  const toggle = useCallback((id: string) => {
    const n = new Map(qtys)
    if (n.has(id)) n.delete(id)
    else n.set(id, 1)
    setQtys(n); onChange(n)
  }, [qtys, onChange])
  const setQty = useCallback((id: string, qty: number, max: number) => {
    if (!qtys.has(id)) return
    const clamped = Math.max(1, Math.min(qty, Math.max(1, max)))
    const n = new Map(qtys); n.set(id, clamped)
    setQtys(n); onChange(n)
  }, [qtys, onChange])
  return <ItemRows items={items} filter={filter} quantities={qtys} onToggle={toggle} onSetQty={setQty} locationName={locationName} showQuantity={showQuantity} />
}
