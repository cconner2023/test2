import { useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Check, ChevronDown, MapPin, Minus, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { TextInput } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'
import { ToggleSwitch } from '../Settings/ToggleSwitch'
import { SignaturePad } from '../SignaturePad'
import { Da2062Preview } from './Da2062Preview'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import type { HolderInfo } from '../../Types/PropertyTypes'

type Mode = 'member' | 'external'

export interface SignOutFormHandle {
  /** Submit from the host header Check pill (calendar/property form pattern).
   *  No-ops when the form isn't valid yet. */
  submit: () => void
}

interface SignOutFormProps {
  /** Close the hosting surface (detail sheet / right pane / Settings sheet).
   *  Called when the user closes the generated 2062 preview. */
  onClose: () => void
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
export const SignOutForm = forwardRef<SignOutFormHandle, SignOutFormProps>(function SignOutForm({ onClose }, ref) {
  const store = usePropertyStore(
    useShallow((s) => ({
      items: s.items,
      locations: s.locations,
      clinicMembers: s.clinicMembers,
      signOut: s.signOut,
    })),
  )
  const profile = useAuthStore((s) => s.profile)

  const [mode, setMode] = useState<Mode>('member')
  const [toHolderId, setToHolderId] = useState<string | null>(null)
  const [externalName, setExternalName] = useState('')
  const [notes, setNotes] = useState('')
  // "Real" sign-out (item physically leaves → relocate to the member's zone) vs. a
  // sign-over / sign-for (custody only, location unchanged — the default). Member-zone
  // only exists for internal recipients, so this is meaningless in external mode.
  const [moveToZone, setMoveToZone] = useState(false)
  // itemId → quantity to sign out (>= 1, capped at the item's on-hand count).
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map())
  const [busy, setBusy] = useState(false)
  const [showSignature, setShowSignature] = useState(false)

  const [recipientOpen, setRecipientOpen] = useState(false)
  const [recipientAnchor, setRecipientAnchor] = useState<DOMRect | null>(null)
  const [itemsOpen, setItemsOpen] = useState(false)
  const [itemsAnchor, setItemsAnchor] = useState<DOMRect | null>(null)

  const { exportDA2062, da2062Preview, downloadDA2062, clearDA2062Preview } = useDA2062Export()

  const locationName = useCallback(
    (id: string | null) => (id ? store.locations.find((l) => l.id === id)?.name ?? null : null),
    [store.locations],
  )

  // Only top-level items are signable (components ride their parent). Turned-in items
  // have left the books, so they're never signable.
  const signableItems = useMemo(
    () => store.items.filter((i) => !i.parent_item_id && !i.turned_in_at),
    [store.items],
  )

  const selectMember = useCallback((id: string) => {
    setMode('member')
    setToHolderId(id)
    setExternalName('')
  }, [])

  const selectExternal = useCallback((name: string) => {
    setMode('external')
    setExternalName(name)
    setToHolderId(null)
  }, [])

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
    if (mode === 'member') return store.clinicMembers.find((m) => m.id === toHolderId)?.displayName ?? null
    return externalName.trim() || null
  }, [mode, toHolderId, externalName, store.clinicMembers])

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

  const openRecipient = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setRecipientAnchor(e.currentTarget.getBoundingClientRect())
    setRecipientOpen(true)
  }, [])

  const openItems = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setItemsAnchor(e.currentTarget.getBoundingClientRect())
    setItemsOpen(true)
  }, [])

  const recipientReady = mode === 'member' ? !!toHolderId : !!externalName.trim()
  const canSubmit = recipientReady && quantities.size > 0 && !busy

  const handleSubmit = useCallback(async (signatureImage?: string) => {
    if (!canSubmit) return
    setBusy(true)
    const chosen = signableItems.filter((i) => quantities.has(i.id))
    const itemIds = chosen.map((i) => i.id)
    const quantityMap = Object.fromEntries(chosen.map((i) => [i.id, quantities.get(i.id) ?? 1]))
    const handReceiptId = await store.signOut({
      itemIds,
      quantities: quantityMap,
      toHolderId: mode === 'member' ? toHolderId : null,
      externalName: mode === 'external' ? externalName.trim() : null,
      notes: notes.trim() || null,
      // Relocate to the recipient's member-zone only on a "real" internal sign-out.
      moveToZone: mode === 'member' && moveToZone,
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
      mode === 'member'
        ? store.clinicMembers.find((m) => m.id === toHolderId) ?? {
            id: toHolderId ?? 'unknown',
            rank: null,
            firstName: null,
            lastName: null,
            displayName: 'Member',
          }
        : { id: 'external', rank: null, firstName: null, lastName: null, displayName: externalName.trim() }

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
  }, [canSubmit, signableItems, quantities, store, mode, toHolderId, externalName, notes, moveToZone, profile, exportDA2062])

  // Host header Check pill opens the signature pad (no-ops until valid); the
  // recipient signs to acknowledge, which both confirms and stamps the 2062.
  const requestSubmit = useCallback(() => {
    if (canSubmit) setShowSignature(true)
  }, [canSubmit])
  useImperativeHandle(ref, () => ({ submit: requestSubmit }), [requestSubmit])

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
          {/* Recipient — PickerInput-shaped row (custom because it needs member
              search + add-custom outside recipient via PreviewOverlay). */}
          <div className="block border-b border-primary/6 last:border-b-0">
            <button
              type="button"
              onClick={openRecipient}
              className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${
                recipientLabel ? 'text-primary' : 'text-tertiary'
              }`}
            >
              <span className="truncate">{recipientLabel || 'Sign to…'}</span>
              <ChevronDown size={16} className="shrink-0 text-tertiary" />
            </button>
          </div>

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
          {mode === 'member' && (
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

      {/* Recipient picker — cluster members (search) + add custom outside recipient */}
      <PreviewOverlay
        isOpen={recipientOpen}
        onClose={() => setRecipientOpen(false)}
        anchorRect={recipientAnchor}
        title="Sign to"
        searchPlaceholder="Search members…"
        onAdd={(name) => { selectExternal(name); setRecipientOpen(false) }}
        addPlaceholder="Recipient outside cluster…"
        preview={(filter, clearFilter) => {
          const q = filter.trim().toLowerCase()
          const members = q
            ? store.clinicMembers.filter((m) => m.displayName.toLowerCase().includes(q))
            : store.clinicMembers
          return (
            <div className="py-1">
              {members.map((m) => {
                const selected = mode === 'member' && toHolderId === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { selectMember(m.id); clearFilter(); setRecipientOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left active:bg-tertiary/5 border-b border-primary/6 last:border-b-0"
                  >
                    <span className={`text-sm ${selected ? 'text-primary font-medium' : 'text-secondary'}`}>
                      {m.displayName}
                    </span>
                    {selected && <Check size={16} className="text-themeblue3 shrink-0" />}
                  </button>
                )
              })}
              {members.length === 0 && (
                <p className="px-4 py-3 text-[10pt] text-tertiary">No members match.</p>
              )}
            </div>
          )
        }}
      />

      {/* Item picker — multi-select top-level property items (search) */}
      <PreviewOverlay
        isOpen={itemsOpen}
        onClose={() => setItemsOpen(false)}
        anchorRect={itemsAnchor}
        title="Items"
        searchPlaceholder="Search items…"
        preview={(filter) => {
          const q = filter.trim().toLowerCase()
          const items = q
            ? signableItems.filter(
                (i) =>
                  i.name.toLowerCase().includes(q) ||
                  i.nsn?.toLowerCase().includes(q) ||
                  i.serial_number?.toLowerCase().includes(q),
              )
            : signableItems
          return (
            <div>
              {items.map((i) => {
                const qty = quantities.get(i.id)
                const selected = qty !== undefined
                const max = Math.max(1, i.quantity)
                const loc = locationName(i.location_id)
                const out = i.signed_out_external || !!i.current_holder_id
                // Stepper only when a bulk item is picked; serialized/qty-1 items
                // sign out as a single unit (no count to choose).
                const showStepper = selected && max > 1
                return (
                  <div
                    key={i.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-tertiary/5 border-b border-primary/6 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(i.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center border ${
                          selected ? 'bg-themeblue3 border-themeblue3' : 'border-tertiary/40'
                        }`}
                      >
                        {selected && <Check size={14} className="text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-primary truncate">{i.name}</span>
                        <span className="block text-[10pt] text-tertiary truncate">
                          {i.serial_number ? `S/N ${i.serial_number}` : i.nsn ? `NSN ${i.nsn}` : 'No NSN'}
                          {max > 1 ? ` · ${max} on hand` : ''}
                          {loc ? ` · usually ${loc}` : ''}
                          {out ? ' · already out' : ''}
                        </span>
                      </span>
                    </button>
                    {showStepper && (
                      <span className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setItemQty(i.id, (qty ?? 1) - 1, max)}
                          disabled={(qty ?? 1) <= 1}
                          aria-label="Decrease quantity"
                          className="w-6 h-6 rounded-full flex items-center justify-center text-tertiary active:scale-90 transition-all disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>
                        {/* Chosen count — plain text, same font as the item info line. */}
                        <span className="text-[10pt] text-tertiary tabular-nums w-8 text-center">
                          {qty} / {max}
                        </span>
                        <button
                          type="button"
                          onClick={() => setItemQty(i.id, (qty ?? 1) + 1, max)}
                          disabled={(qty ?? 1) >= max}
                          aria-label="Increase quantity"
                          className="w-6 h-6 rounded-full flex items-center justify-center text-tertiary active:scale-90 transition-all disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                      </span>
                    )}
                  </div>
                )
              })}
              {items.length === 0 && (
                <p className="px-4 py-3 text-[10pt] text-tertiary">No items match.</p>
              )}
            </div>
          )
        }}
      />

      <Da2062Preview
        preview={da2062Preview}
        onDownload={downloadDA2062}
        onClose={() => {
          clearDA2062Preview()
          onClose()
        }}
      />
    </>
  )
})
