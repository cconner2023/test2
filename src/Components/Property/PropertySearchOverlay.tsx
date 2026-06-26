/** Property search RESULTS screen, shown while the property drawer header's
 *  center search input is focused. Mirrors MapSearchOverlay: it renders the
 *  results lists only — the search INPUT lives in the drawer header (the single
 *  source of truth). It sits as an absolute layer over the full-screen canvas
 *  below the drawer's floating glass header (content is isolate'd so it can't
 *  cover the header), and clears it via top padding. */
import { useMemo } from 'react'
import { FolderClosed, User, ClipboardList, MapPin } from 'lucide-react'
import { Section, SectionCard } from '../Section'
import { EmptyState } from '../EmptyState'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo, HandReceipt } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'
import type { ReceiptItem } from '../../Hooks/useHandReceipts'

interface PropertySearchOverlayProps {
  isVisible: boolean
  /** Current query — typed into the header's SearchInput. */
  value: string
  items: LocalPropertyItem[]
  locations: LocalPropertyLocation[]
  holders?: Map<string, HolderInfo>
  onSelectItem: (item: LocalPropertyItem) => void
  onOpenLocation: (loc: LocalPropertyLocation) => void
  /** DA 2062 hand receipts folded into the results (dev-gated). A receipt matches
   *  by recipient OR by any of its items (name / serial / nsn). */
  receipts?: HandReceipt[]
  receiptItemsById?: Map<string, ReceiptItem>
  showReceipts?: boolean
  /** Tap an item inside a receipt card — surfaces it on the map + opens its detail. */
  onSelectReceiptItem?: (item: ReceiptItem) => void
  /** Desktop center-pane render: drop the mobile floating-header top padding. */
  embedded?: boolean
}

export function PropertySearchOverlay({
  isVisible,
  value,
  items,
  locations,
  holders,
  onSelectItem,
  onOpenLocation,
  receipts = [],
  receiptItemsById,
  showReceipts = false,
  onSelectReceiptItem,
  embedded = false,
}: PropertySearchOverlayProps) {
  const locationNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of locations) map.set(loc.id, loc.name)
    return map
  }, [locations])

  const q = value.trim().toLowerCase()
  const isSearching = q.length > 0

  const locationResults = useMemo(() => {
    if (!isSearching) return []
    return locations
      .filter(l => l.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30)
  }, [locations, isSearching, q])

  const itemResults = useMemo(() => {
    if (!isSearching) return []
    return items
      .filter((i) => {
        if (i.parent_item_id) return false
        const holder = i.current_holder_id ? holders?.get(i.current_holder_id) : null
        const locName = i.location_id ? locationNameMap.get(i.location_id) : null
        return (
          i.name.toLowerCase().includes(q) ||
          !!i.nomenclature?.toLowerCase().includes(q) ||
          !!i.nsn?.toLowerCase().includes(q) ||
          !!i.lin?.toLowerCase().includes(q) ||
          !!i.serial_number?.toLowerCase().includes(q) ||
          !!i.notes?.toLowerCase().includes(q) ||
          !!holder?.displayName.toLowerCase().includes(q) ||
          !!locName?.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, isSearching, q, holders, locationNameMap])

  const receiptResults = useMemo(() => {
    if (!isSearching || !showReceipts) return []
    return receipts.filter((r) => {
      if (r.recipientLabel.toLowerCase().includes(q)) return true
      return r.entries.some((e) => {
        const it = receiptItemsById?.get(e.item_id)
        return (
          !!it?.name?.toLowerCase().includes(q) ||
          !!it?.serial_number?.toLowerCase().includes(q) ||
          !!it?.nsn?.toLowerCase().includes(q)
        )
      })
    })
  }, [receipts, receiptItemsById, isSearching, showReceipts, q])

  if (!isVisible) return null

  const itemInitials = (name: string) => {
    const words = name.trim().split(/\s+/)
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }

  const formatReceiptDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const formatExpiryDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })

  /** Left icon encodes WHERE the item lives: held by a person (ownership) → User,
   *  otherwise placed at a location → MapPin. Healthy/grey unless held. */
  const renderItemIcon = (item: LocalPropertyItem) => {
    const held = !!item.current_holder_id
    return (
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${held ? 'bg-themeblue3/10' : 'bg-tertiary/8'}`}>
        {held
          ? <User size={18} className="text-themeblue2" />
          : <MapPin size={18} className="text-tertiary" />}
      </div>
    )
  }

  return (
    <div
      className="absolute inset-0 z-[1020] bg-themewhite3 overflow-y-auto"
      role="dialog"
      aria-label="Property search results"
    >
      {/* Top padding clears the drawer's floating glass header (mobile). On desktop
          the center pane already starts below the solid header — no clearance. */}
      <div className={`px-3 pb-6 space-y-5 ${embedded ? 'pt-4' : 'pt-[calc(var(--drawer-header-h,3.5rem)+1rem)]'}`}>
        {!isSearching ? (
          <div className="px-3 py-8 text-center text-[10pt] text-tertiary">
            Type to search items, serials, locations, or holders.
          </div>
        ) : locationResults.length === 0 && itemResults.length === 0 && receiptResults.length === 0 ? (
          <EmptyState title="No results" />
        ) : (
          <>
            {locationResults.length > 0 && (
              <Section title="Locations" count={locationResults.length}>
                <SectionCard>
                  {locationResults.map((loc, i) => {
                    const isMember = !!loc.holder_user_id
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => onOpenLocation(loc)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-secondary/5 transition-colors active:scale-[0.98] ${
                          i !== locationResults.length - 1 ? 'border-b border-tertiary/8' : ''
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isMember ? 'bg-themeblue3/10' : 'bg-tertiary/8'}`}>
                          {isMember
                            ? <User size={18} className="text-themeblue2" />
                            : <FolderClosed size={18} className="text-tertiary" />}
                        </div>
                        <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{loc.name}</span>
                      </button>
                    )
                  })}
                </SectionCard>
              </Section>
            )}

            {itemResults.length > 0 && (
              <Section title="Items">
                <SectionCard>
                  {itemResults.map((item, i) => {
                    const exp = expiryStatus(item.expiry_date ?? null)
                    const meta: { text: string; className?: string }[] = []
                    if (item.nsn) meta.push({ text: `NSN ${item.nsn}` })
                    if (item.lin) meta.push({ text: `LIN ${item.lin}` })
                    meta.push({ text: `Qty ${item.quantity}` })
                    if (item.expiry_date) {
                      meta.push({
                        text: `Exp ${formatExpiryDate(item.expiry_date)}`,
                        className: exp === 'expired'
                          ? 'text-themeredred font-medium'
                          : exp === 'expiring'
                            ? 'text-themeyellow font-medium'
                            : undefined,
                      })
                    }
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-secondary/5 transition-colors active:scale-[0.98] ${
                          i !== itemResults.length - 1 ? 'border-b border-tertiary/8' : ''
                        }`}
                      >
                        {renderItemIcon(item)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-primary truncate">
                            <span className="font-medium">{item.name}</span>
                            {item.nomenclature && (
                              <span className="text-secondary font-normal"> {item.nomenclature}</span>
                            )}
                          </p>
                          {meta.length > 0 && (
                            <p className="text-[10pt] text-secondary truncate mt-0.5">
                              {meta.map((m, idx) => (
                                <span key={idx} className={m.className}>
                                  {idx > 0 && <span className="mx-1 text-tertiary/50 font-normal">·</span>}
                                  {m.text}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </SectionCard>
              </Section>
            )}

            {/* DA 2062 sign-outs — one card per matching receipt, listing its items.
                Tapping an item routes to the SAME detail surface as any item result
                (map selects + detail opens), so search has a single destination. */}
            {receiptResults.length > 0 && (
              <Section title="Sign-outs" count={receiptResults.length}>
                <div className="space-y-2">
                  {receiptResults.map((r) => (
                    <SectionCard key={r.handReceiptId}>
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-tertiary/8 bg-tertiary/[0.03]">
                        <ClipboardList size={15} className="text-themeblue2 shrink-0" />
                        <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{r.recipientLabel}</span>
                        <span className="text-[9pt] text-tertiary shrink-0">{formatReceiptDate(r.recordedAt)}</span>
                      </div>
                      {r.entries.map((e, i) => {
                        const it = receiptItemsById?.get(e.item_id)
                        const subtitle = it?.serial_number
                          ? `S/N ${it.serial_number}`
                          : it?.nsn
                            ? `NSN ${it.nsn}`
                            : null
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => it && onSelectReceiptItem?.(it)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-secondary/5 transition-colors active:scale-[0.98] ${
                              i !== r.entries.length - 1 ? 'border-b border-tertiary/8' : ''
                            }`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-themeblue3/10 flex items-center justify-center shrink-0">
                              <span className="text-[9pt] font-semibold text-themeblue2">{itemInitials(it?.name ?? '?')}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-primary truncate">{it?.name ?? 'Unknown item'}</p>
                              {subtitle && <p className="text-[10pt] text-secondary truncate mt-0.5">{subtitle}</p>}
                            </div>
                            <MapPin size={14} className="text-tertiary shrink-0" />
                          </button>
                        )
                      })}
                    </SectionCard>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
