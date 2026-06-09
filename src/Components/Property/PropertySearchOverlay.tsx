/** Property search RESULTS screen, shown while the property drawer header's
 *  center search input is focused. Mirrors MapSearchOverlay: it renders the
 *  results lists only — the search INPUT lives in the drawer header (the single
 *  source of truth). It sits as an absolute layer over the full-screen canvas
 *  below the drawer's floating glass header (content is isolate'd so it can't
 *  cover the header), and clears it via top padding. */
import { useMemo } from 'react'
import { FolderClosed, User } from 'lucide-react'
import { Section, SectionCard } from '../Section'
import { EmptyState } from '../EmptyState'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'

interface PropertySearchOverlayProps {
  isVisible: boolean
  /** Current query — typed into the header's SearchInput. */
  value: string
  items: LocalPropertyItem[]
  locations: LocalPropertyLocation[]
  holders?: Map<string, HolderInfo>
  onSelectItem: (item: LocalPropertyItem) => void
  onOpenLocation: (loc: LocalPropertyLocation) => void
}

export function PropertySearchOverlay({
  isVisible,
  value,
  items,
  locations,
  holders,
  onSelectItem,
  onOpenLocation,
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

  if (!isVisible) return null

  const itemInitials = (name: string) => {
    const words = name.trim().split(/\s+/)
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }

  const renderItemIcon = (item: LocalPropertyItem) => {
    if (item.photo_url) {
      return <img src={item.photo_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-themeblue3/10 flex items-center justify-center shrink-0">
        <span className="text-[10pt] font-semibold text-themeblue2">{itemInitials(item.name)}</span>
      </div>
    )
  }

  const renderExpiryChip = (expiry: 'expired' | 'expiring' | null) => {
    if (!expiry) return null
    return (
      <span className={`text-[9pt] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
        expiry === 'expired' ? 'bg-themeredred/10 text-themeredred' : 'bg-themeyellow/15 text-themeyellow'
      }`}>
        {expiry === 'expired' ? 'Expired' : 'Expiring'}
      </span>
    )
  }

  return (
    <div
      className="absolute inset-0 z-[1020] bg-themewhite3 overflow-y-auto"
      role="dialog"
      aria-label="Property search results"
    >
      {/* Top padding clears the drawer's floating glass header. */}
      <div className="px-3 pb-6 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+1rem)]">
        {!isSearching ? (
          <div className="px-3 py-8 text-center text-[10pt] text-tertiary">
            Type to search items, serials, locations, or holders.
          </div>
        ) : locationResults.length === 0 && itemResults.length === 0 ? (
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
              <Section title="Items" count={itemResults.length}>
                <SectionCard>
                  {itemResults.map((item, i) => {
                    const locName = item.location_id ? locationNameMap.get(item.location_id) : null
                    const holder = item.current_holder_id ? holders?.get(item.current_holder_id) : null
                    const expiry = expiryStatus(item.expiry_date ?? null)
                    const subtitle = [
                      item.is_serialized && item.serial_number ? item.serial_number : (!item.is_serialized && item.quantity > 1 ? `Qty ${item.quantity}` : null),
                      locName,
                      holder?.displayName,
                    ].filter(Boolean).join(' · ')
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
                          <p className="text-sm font-medium text-primary truncate">{item.name}</p>
                          {subtitle && (
                            <p className="text-[10pt] text-secondary truncate mt-0.5">{subtitle}</p>
                          )}
                        </div>
                        {renderExpiryChip(expiry)}
                      </button>
                    )
                  })}
                </SectionCard>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
