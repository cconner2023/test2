import { useState, useMemo, useCallback, useEffect, useContext, forwardRef, useImperativeHandle } from 'react'
import { Check, ChevronDown, MapPin, Minus, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { TextInput } from '@/Components/primitives/FormInputs'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { StackNavContext } from '@/Components/stackNav'
import { PreviewOverlay } from '../PreviewOverlay'
import { ToggleSwitch } from '../Settings/ToggleSwitch'
import { SignaturePad } from '@/Components/primitives/SignaturePad'
import { Da2062Preview } from './Da2062Preview'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import { PartyPicker, type Party } from './PartyPicker'
import { isLinContainer } from '../../Utilities/propertyAuthorized'
import type { HolderInfo, LocalPropertyItem } from '../../Types/PropertyTypes'

/* ── Shared picker rows — one source for the desktop PreviewOverlay fallback AND the
      mobile stack drill screens, so both render byte-identical (mirrors FormInputs'
      PickerRows split). The recipient (member-or-external) picker lives in the shared
      PartyPicker; only the multi-select item rows are bespoke to the sign-out. ── */

/** Multi-select item rows with a per-item quantity stepper, filtered by the live
 *  search value. State ownership differs by host (live host state on desktop, local
 *  screen state in the drill) — this component is purely presentational. */
function ItemRows({ items, filter, quantities, onToggle, onSetQty, locationName }: {
  items: LocalPropertyItem[]
  filter: string
  quantities: Map<string, number>
  onToggle: (id: string) => void
  onSetQty: (id: string, qty: number, max: number) => void
  locationName: (id: string | null) => string | null
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
        // Middle line = nomenclature (the doctrinal role), falling back to serial / NSN so
        // the row always says WHAT the item is — same name · nomenclature · identity order
        // as the item detail + Cluster Hand Receipt cards.
        const identity = i.nomenclature
          ? i.nomenclature
          : i.serial_number
            ? `S/N ${i.serial_number}`
            : i.nsn
              ? `Material/NSN ${i.nsn}`
              : null
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
              {/* name · nomenclature · location — one field per line, no crammed subline. */}
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-primary truncate">{i.name}</span>
                {identity && <span className="block text-[10pt] text-tertiary truncate">{identity}</span>}
                <span className="block text-[10pt] text-tertiary truncate">
                  {loc ? `usually ${loc}` : 'Unplaced'}
                  {max > 1 ? ` · ${max} on hand` : ''}
                  {out ? ' · already out' : ''}
                </span>
              </span>
            </button>
            {/* Quantity gets its own column on the right — three-line rows leave room for a
                full-size stepper instead of squeezing it against the label. */}
            {selected && (
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
function ItemsScreen({ items, filter, initial, onChange, locationName }: {
  items: LocalPropertyItem[]
  filter: string
  initial: Map<string, number>
  onChange: (next: Map<string, number>) => void
  locationName: (id: string | null) => string | null
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
  return <ItemRows items={items} filter={filter} quantities={qtys} onToggle={toggle} onSetQty={setQty} locationName={locationName} />
}

export interface SignOutFormHandle {
  /** Submit from the host header Check pill (calendar/property form pattern).
   *  No-ops when the form isn't valid yet. */
  submit: () => void
}

interface SignOutFormProps {
  /** Close the hosting surface (detail sheet / right pane / Settings sheet).
   *  Called when the user closes the generated 2062 preview. */
  onClose: () => void
  /** Reports save-in-flight so the host surface can gate with the HUD loader. */
  onSavingChange?: (saving: boolean) => void
}

/**
 * New DA 2062 — content-only sign-out body: pick a recipient (cluster member or
 * external) + 1..N items (each with a quantity up to the item's on-hand count),
 * write one shared hand receipt, then offer the 2062 PDF.
 *
 * Recipient and items are both primitive PreviewOverlay pickers (the order-sets
 * pattern): a tappable row opens a searchable popover. The recipient picker adds
 * a custom (outside-cluster) recipient via the popover's add-custom row; the item
 * picker is multi-select with a per-item quantity stepper (bounded by the item's
 * stock; the chosen count renders inline in the item-info font). Notes is the
 * standard TextInput primitive.
 *
 * Submit lives in the host header Check pill (calendar EventForm pattern) via the
 * forwarded `submit()` handle, not an in-body button.
 *
 * Hosted by PropertyPanel's detail surface (right pane on desktop / detail sheet
 * on mobile). Provides its own padding so it drops straight into that scroll
 * container.
 * State resets on unmount, so closing the host surface clears the form.
 */
export const SignOutForm = forwardRef<SignOutFormHandle, SignOutFormProps>(function SignOutForm({ onClose, onSavingChange }, ref) {
  const store = usePropertyStore(
    useShallow((s) => ({
      items: s.items,
      locations: s.locations,
      clinicMembers: s.clinicMembers,
      signOut: s.signOut,
    })),
  )
  const profile = useAuthStore((s) => s.profile)

  // When hosted inside the property sheet's stack engine, the recipient/item pickers
  // MORPH the sheet in place (pushScreen); on desktop (no stack) they fall back to the
  // anchored PreviewOverlay popovers below.
  const stackNav = useContext(StackNavContext)

  // The party this receipt signs to — a cluster member (id → current_holder_id) or a
  // free-text outside-cluster entity (name only). The shared PartyPicker owns the pick.
  const [recipient, setRecipient] = useState<Party | null>(null)
  const [notes, setNotes] = useState('')
  // "Real" sign-out (item physically leaves → relocate to the member's zone) vs. a
  // sign-over / sign-for (custody only, location unchanged — the default). Member-zone
  // only exists for internal recipients, so this is meaningless in external mode.
  const [moveToZone, setMoveToZone] = useState(false)
  // itemId → quantity to sign out (>= 1, capped at the item's on-hand count).
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map())
  const [busy, setBusy] = useState(false)
  const [showSignature, setShowSignature] = useState(false)

  const [itemsOpen, setItemsOpen] = useState(false)
  const [itemsAnchor, setItemsAnchor] = useState<DOMRect | null>(null)

  const { exportDA2062, da2062Preview, downloadDA2062, clearDA2062Preview, status: da2062Status } = useDA2062Export()

  const locationName = useCallback(
    (id: string | null) => (id ? store.locations.find((l) => l.id === id)?.name ?? null : null),
    [store.locations],
  )

  // Only top-level items are signable (components ride their parent). Turned-in items
  // have left the books, so they're never signable. LIN containers are pure hand-receipt
  // headers, not property we hold — you sign out the actual equipment, never the LIN.
  const signableItems = useMemo(
    () => store.items.filter((i) => !i.parent_item_id && !i.turned_in_at && !isLinContainer(i)),
    [store.items],
  )

  const toggleItem = useCallback((id: string) => {
    setQuantities((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, 1)
      return next
    })
  }, [])

  // Step a selected item's quantity within [1, max on-hand]. Selecting happens
  // via toggleItem; this only adjusts an already-picked item.
  const setItemQty = useCallback((id: string, qty: number, max: number) => {
    const clamped = Math.max(1, Math.min(qty, Math.max(1, max)))
    setQuantities((prev) => {
      if (!prev.has(id)) return prev
      const next = new Map(prev)
      next.set(id, clamped)
      return next
    })
  }, [])

  const recipientLabel = useMemo(() => {
    if (!recipient) return null
    return recipient.kind === 'member' ? recipient.displayName : recipient.name
  }, [recipient])
  // Member-zone relocation only exists for internal recipients; an external party has
  // no zone, so the "move to zone" row hides in external mode.
  const isExternal = recipient?.kind === 'external'

  const itemsLabel = useMemo(() => {
    if (quantities.size === 0) return null
    return signableItems
      .filter((i) => quantities.has(i.id))
      .map((i) => {
        const qty = quantities.get(i.id) ?? 1
        return qty > 1 ? `${i.name} ×${qty}` : i.name
      })
      .join(', ')
  }, [quantities, signableItems])

  const openItems = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (stackNav) {
      stackNav.pushScreen({
        title: 'Items',
        searchPlaceholder: 'Search items…',
        // Match the property save-header primitive (HeaderPill + green Check PillButton) —
        // NOT ActionPill/ActionButton — so the drilled item-picker header reads identical to
        // every other property form header the sheet hosts.
        rightFooter: (_p, nav) => (
          <HeaderPill>
            <PillButton icon={Check} iconSize={18} accent="success" label="Done" onClick={nav.pop} />
          </HeaderPill>
        ),
        render: (_p, _nav, filter = '') => (
          <ItemsScreen
            items={signableItems}
            filter={filter}
            initial={quantities}
            onChange={setQuantities}
            locationName={locationName}
          />
        ),
      })
      return
    }
    setItemsAnchor(e.currentTarget.getBoundingClientRect())
    setItemsOpen(true)
  }, [stackNav, signableItems, quantities, locationName])

  const canSubmit = !!recipient && quantities.size > 0 && !busy

  const handleSubmit = useCallback(async (signatureImage?: string) => {
    if (!canSubmit || !recipient) return
    setBusy(true)
    const chosen = signableItems.filter((i) => quantities.has(i.id))
    const itemIds = chosen.map((i) => i.id)
    const quantityMap = Object.fromEntries(chosen.map((i) => [i.id, quantities.get(i.id) ?? 1]))
    const handReceiptId = await store.signOut({
      itemIds,
      quantities: quantityMap,
      toHolderId: recipient.kind === 'member' ? recipient.id : null,
      externalName: recipient.kind === 'external' ? recipient.name : null,
      notes: notes.trim() || null,
      // Relocate to the recipient's member-zone only on a "real" internal sign-out.
      moveToZone: recipient.kind === 'member' && moveToZone,
    })
    if (!handReceiptId) {
      setBusy(false)
      return
    }

    // Build + offer the DA 2062 for the receipt just written.
    const fromHolder: HolderInfo = {
      id: 'self',
      rank: profile.rank ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      displayName:
        [profile.rank, profile.lastName, profile.firstName].filter(Boolean).join(' ') ||
        'Hand Receipt Holder',
    }
    const toHolder: HolderInfo =
      recipient.kind === 'member'
        ? store.clinicMembers.find((m) => m.id === recipient.id) ?? {
            id: recipient.id,
            rank: null,
            firstName: null,
            lastName: null,
            displayName: recipient.displayName,
          }
        : { id: 'external', rank: null, firstName: null, lastName: null, displayName: recipient.name }

    // Carry the chosen quantity into the 2062 QTY column (defaults to on-hand 1).
    const items = chosen.map((i) => ({
      name: i.name,
      nomenclature: i.nomenclature,
      nsn: i.nsn,
      serial_number: i.serial_number,
      quantity: quantities.get(i.id) ?? 1,
    }))
    const now = new Date()
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    await exportDA2062({
      items,
      fromHolder,
      toHolder,
      handReceiptNumber: `HR-${handReceiptId.slice(0, 8).toUpperCase()}`,
      date: now.toLocaleDateString(),
      // Recipient acknowledgement, stamped vertically in QUANTITY column B.
      signature: { printedName: toHolder.displayName, date: ymd, image: signatureImage },
    })
    setBusy(false)
  }, [canSubmit, recipient, signableItems, quantities, store, notes, moveToZone, profile, exportDA2062])

  // Host header Check pill opens the signature pad (no-ops until valid); the
  // recipient signs to acknowledge, which both confirms and stamps the 2062.
  const requestSubmit = useCallback(() => {
    if (canSubmit) setShowSignature(true)
  }, [canSubmit])
  useImperativeHandle(ref, () => ({ submit: requestSubmit }), [requestSubmit])

  useEffect(() => { onSavingChange?.(busy) }, [busy, onSavingChange])
  // Clear the host's HUD flag on unmount so closing mid-flight never strands it.
  useEffect(() => () => onSavingChange?.(false), [onSavingChange])

  return (
    <>
      <SignaturePad
        isOpen={showSignature}
        zIndex={1500}
        title="Recipient signature"
        subtitle={recipientLabel ? `${recipientLabel} — sign to acknowledge receipt` : 'Sign to acknowledge receipt'}
        onClose={() => setShowSignature(false)}
        onComplete={(img) => { setShowSignature(false); handleSubmit(img) }}
      />

      <div className="px-4 py-4">
        {/* Single unified form card — stacked primitive rows with hairline
            dividers (EventForm / FeatureEditor pattern). No per-field bordered
            cards or uppercase mini-headers; each row owns its own border. */}
        <div className="rounded-2xl overflow-hidden">
          {/* Recipient — shared PartyPicker (cluster member or outside-cluster entity). */}
          <PartyPicker
            members={store.clinicMembers}
            value={recipient}
            onChange={setRecipient}
            placeholder="Sign to…"
            title="Sign to"
            externalPlaceholder="Recipient outside cluster…"
          />

          {/* Items — PickerInput-shaped row (custom multi-select with search). */}
          <div className="block border-b border-primary/6 last:border-b-0">
            <button
              type="button"
              onClick={openItems}
              className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${
                itemsLabel ? 'text-primary' : 'text-tertiary'
              }`}
            >
              <span className="truncate">{itemsLabel || 'Select items…'}</span>
              <ChevronDown size={16} className="shrink-0 text-tertiary" />
            </button>
          </div>

          {/* Sign-out kind — toggle a "real" sign-out (item leaves → relocate to the
              member's zone) vs. a sign-over (custody only). Internal-only: an external
              recipient has no member-zone, so the row is hidden in external mode. */}
          {!isExternal && (
            <button
              type="button"
              onClick={() => setMoveToZone((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-primary/6 last:border-b-0"
            >
              <MapPin size={16} className="shrink-0 text-tertiary" />
              <span className="flex-1 min-w-0">
                <span className="block text-base md:text-sm text-primary">Move to recipient's zone</span>
                <span className="block text-[10pt] text-tertiary">Item physically leaves its location (vs. sign-over)</span>
              </span>
              <ToggleSwitch checked={moveToZone} />
            </button>
          )}

          {/* Notes — standard TextInput primitive (last row drops its border). */}
          <TextInput value={notes} onChange={setNotes} placeholder="Notes (optional)" />
        </div>
      </div>

      {/* Item picker — multi-select top-level property items (search) */}
      <PreviewOverlay
        isOpen={itemsOpen}
        onClose={() => setItemsOpen(false)}
        anchorRect={itemsAnchor}
        title="Items"
        searchPlaceholder="Search items…"
        preview={(filter) => (
          <ItemRows
            items={signableItems}
            filter={filter}
            quantities={quantities}
            onToggle={toggleItem}
            onSetQty={setItemQty}
            locationName={locationName}
          />
        )}
      />

      <Da2062Preview
        preview={da2062Preview}
        generating={da2062Status === 'generating'}
        onDownload={downloadDA2062}
        onClose={() => {
          clearDA2062Preview()
          onClose()
        }}
      />
    </>
  )
})
