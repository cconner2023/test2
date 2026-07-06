import { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { ChevronRight, Pencil, Trash2, Map as MapIcon, FolderPlus, PackagePlus, FolderClosed, User, MoreHorizontal } from 'lucide-react'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { Section, SectionCard } from '@/Components/primitives/Section'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import type { LocalPropertyLocation, LocalPropertyItem, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'
import { useVehicleDispatches } from '../../Hooks/useVehicleDispatches'
import { DispatchDot } from './DispatchDot'

export type PropertySearchFilter = 'all' | 'item' | 'assigned' | 'location' | 'description'
const SEARCH_FILTERS: { key: PropertySearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'item', label: 'Item' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'location', label: 'Location' },
  { key: 'description', label: 'Description' },
]

export interface DrilldownSegment {
  id: string
  name: string
}

export interface PropertyLocationListHandle {
  popPath: () => void
  getPath: () => DrilldownSegment[]
}

interface PropertyLocationListProps {
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  holders?: Map<string, HolderInfo>
  clinicName?: string
  searchQuery?: string
  onSelectItem: (item: LocalPropertyItem) => void
  /** Open the location edit form (name + parent) — no longer an inline rename. */
  onEditLocation?: (loc: LocalPropertyLocation) => void
  /** Open the shared item action menu for an item row (nav-sheet hosted). */
  onOpenItemMenu?: (item: LocalPropertyItem, rect: DOMRect) => void
  onDeleteLocation?: (locId: string) => void
  onViewOnMap?: (locationId: string) => void
  onDrilldownChange?: (path: DrilldownSegment[]) => void
  onAddChildLocation?: (parentId: string | null) => void
  onAddItemAtLocation?: (locationId: string | null) => void
  /** Scope the list to a location's subtree (used inside the location Sheet):
   *  base level shows children of rootId; Personnel/Unassigned sections hidden. */
  rootId?: string
  /** When set, a location/member tap calls this instead of in-place drilldown
   *  (the base list uses it to open the location Sheet). */
  onOpenLocation?: (loc: LocalPropertyLocation) => void
}

export const PropertyLocationList = forwardRef<PropertyLocationListHandle, PropertyLocationListProps>(function PropertyLocationList({
  locations,
  items,
  holders,
  clinicName,
  searchQuery = '',
  onSelectItem,
  onEditLocation,
  onOpenItemMenu,
  onDeleteLocation,
  onViewOnMap,
  onDrilldownChange,
  onAddChildLocation,
  onAddItemAtLocation,
  rootId,
  onOpenLocation,
}, ref) {
  const [path, setPath] = useState<DrilldownSegment[]>([])
  // Current open dispatches per vehicle → the row red-dot (expiring/expired).
  const dispatches = useVehicleDispatches(locations[0]?.clinic_id ?? null)
  const [contextMenu, setContextMenu] = useState<{ kind: 'location' | 'item'; id: string; rect: DOMRect } | null>(null)
  const longPressRef = useRef<number | null>(null)
  const longPressPreventTap = useRef(false)

  const [searchFilter, setSearchFilter] = useState<PropertySearchFilter>('all')

  const currentParentId = path.length > 0 ? path[path.length - 1].id : (rootId ?? null)
  const isSearching = searchQuery.trim().length > 0

  const currentLocationNode = useMemo(() => {
    const currentId = path.length > 0 ? path[path.length - 1].id : (rootId ?? null)
    if (!currentId) return null
    return locations.find(l => l.id === currentId) ?? null
  }, [path, locations, rootId])

  const isHolderView = !!currentLocationNode?.holder_user_id

  // Lookup maps for search result subtitles
  const locationNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of locations) map.set(loc.id, loc.name)
    return map
  }, [locations])

  // Filter-aware match function
  const matchesSearch = useCallback((item: LocalPropertyItem, q: string): boolean => {
    switch (searchFilter) {
      case 'item':
        return (
          item.name.toLowerCase().includes(q) ||
          !!item.nsn?.toLowerCase().includes(q) ||
          !!item.lin?.toLowerCase().includes(q) ||
          !!item.serial_number?.toLowerCase().includes(q)
        )
      case 'assigned': {
        const holder = item.current_holder_id ? holders?.get(item.current_holder_id) : null
        return !!holder?.displayName.toLowerCase().includes(q)
      }
      case 'location': {
        const locName = item.location_id ? locationNameMap.get(item.location_id) : null
        return !!locName?.toLowerCase().includes(q)
      }
      case 'description':
        return (
          !!item.nomenclature?.toLowerCase().includes(q) ||
          !!item.notes?.toLowerCase().includes(q)
        )
      case 'all':
      default: {
        const holder = item.current_holder_id ? holders?.get(item.current_holder_id) : null
        const locName = item.location_id ? locationNameMap.get(item.location_id) : null
        return (
          item.name.toLowerCase().includes(q) ||
          !!item.nomenclature?.toLowerCase().includes(q) ||
          !!item.nsn?.toLowerCase().includes(q) ||
          !!item.lin?.toLowerCase().includes(q) ||
          !!item.serial_number?.toLowerCase().includes(q) ||
          !!item.notes?.toLowerCase().includes(q) ||
          !!holder?.displayName.toLowerCase().includes(q) ||
          !!locName?.toLowerCase().includes(q)
        )
      }
    }
  }, [searchFilter, holders, locationNameMap])

  // Global search results — flat across all locations
  const globalSearchResults = useMemo(() => {
    if (!isSearching) return []
    const q = searchQuery.toLowerCase()
    return items
      .filter((i) => !i.parent_item_id && matchesSearch(i, q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, isSearching, searchQuery, matchesSearch])

  // Child locations at the current drill level.
  // Member-locations have no sub-locations.
  const childLocations = useMemo(() => {
    if (isSearching) return []
    if (isHolderView) return []
    return locations
      .filter(l => !l.holder_user_id && (l.parent_id ?? null) === currentParentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locations, currentParentId, isSearching, isHolderView])

  // Member-location nodes — only shown at root level.
  const memberLocations = useMemo(() => {
    if (isSearching) return []
    if (currentParentId !== null) return []
    return locations
      .filter(l => !!l.holder_user_id)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locations, currentParentId, isSearching])

  const locationItems = useMemo(() => {
    if (isSearching) return []
    return items
      .filter((i) => !i.parent_item_id && (i.location_id ?? null) === currentParentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, currentParentId, isSearching])

  // Unassigned = no location at all. Only shown at root.
  const unassignedItems = useMemo(() => {
    if (isSearching) return []
    if (currentParentId !== null) return []
    return items
      .filter((i) => !i.parent_item_id && !i.location_id)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, currentParentId, isSearching])

  const drillInto = useCallback(
    (loc: LocalPropertyLocation) => {
      if (longPressPreventTap.current) { longPressPreventTap.current = false; return }
      setContextMenu(null)
      // Base list hands location taps to the Sheet; scoped list drills in place.
      if (onOpenLocation) { onOpenLocation(loc); return }
      const newPath = [...path, { id: loc.id, name: loc.name }]
      setPath(newPath)
      onDrilldownChange?.(newPath)
    },
    [path, onDrilldownChange, onOpenLocation],
  )

  // Expose popPath for parent (PropertyDrawer) back-button handling
  const popPath = useCallback(() => {
    setContextMenu(null)
    const newPath = path.slice(0, -1)
    setPath(newPath)
    onDrilldownChange?.(newPath)
  }, [path, onDrilldownChange])

  // Open the lifted row menu anchored to a row element's bounding rect.
  const openRowMenu = useCallback((kind: 'location' | 'item', id: string, anchor: HTMLElement | null) => {
    if (anchor) setContextMenu({ kind, id, rect: anchor.getBoundingClientRect() })
  }, [])

  // Long-press to open the lifted menu (mobile equivalent of right-click). Item rows
  // delegate to the nav-sheet-hosted shared menu; location rows use the inline menu.
  const handleTouchStart = useCallback((kind: 'location' | 'item', id: string, e: React.TouchEvent, isVirtual?: boolean) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    longPressPreventTap.current = false
    longPressRef.current = window.setTimeout(() => {
      longPressPreventTap.current = true
      if (isVirtual) return
      if (kind === 'item') {
        const item = items.find((i) => i.id === id)
        if (item) onOpenItemMenu?.(item, rect)
      } else {
        setContextMenu({ kind, id, rect })
      }
    }, 500)
  }, [items, onOpenItemMenu])

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }, [])

  useImperativeHandle(ref, () => ({
    popPath,
    getPath: () => path,
  }), [popPath, path])

  const totalDescendantItems = useCallback(
    (locId: string): number => {
      const directItems = items.filter(
        (i) => !i.parent_item_id && i.location_id === locId,
      ).length
      const childLocs = locations.filter((l) => l.parent_id === locId && !l.holder_user_id)
      return directItems + childLocs.reduce((sum, c) => sum + totalDescendantItems(c.id), 0)
    },
    [items, locations],
  )

  const isEmpty = childLocations.length === 0 && locationItems.length === 0

  const hasLocations = childLocations.length > 0
  const hasItems = locationItems.length > 0
  const hasUnassigned = currentParentId === null && unassignedItems.length > 0
  const hasMembers = memberLocations.length > 0

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
      <span className={`text-[9pt] md:text-[9pt] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
        expiry === 'expired' ? 'bg-themeredred/10 text-themeredred' : 'bg-themeyellow/15 text-themeyellow'
      }`}>
        {expiry === 'expired' ? 'Expired' : 'Expiring'}
      </span>
    )
  }

  const renderLocationRow = (loc: LocalPropertyLocation, isLast: boolean) => {
    const isMember = !!loc.holder_user_id
    const count = totalDescendantItems(loc.id)

    return (
      <div
        key={loc.id}
        data-prop-row
        role="button"
        tabIndex={0}
        onClick={() => drillInto(loc)}
        onKeyDown={(e) => { if (e.key === 'Enter') drillInto(loc) }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!isMember && (onEditLocation || onDeleteLocation || onAddChildLocation || onAddItemAtLocation)) {
            openRowMenu('location', loc.id, e.currentTarget as HTMLElement)
          }
        }}
        onTouchStart={(e) => handleTouchStart('location', loc.id, e, isMember)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`flex items-center gap-3 px-4 py-3 active:bg-secondary/5 transition-colors cursor-pointer ${
          !isLast ? 'border-b border-tertiary/8' : ''
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isMember ? 'bg-themeblue3/10' : 'bg-tertiary/8'}`}>
          {isMember
            ? <User size={18} className="text-themeblue2" />
            : <FolderClosed size={18} className="text-tertiary" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{loc.name}</p>
            {loc.kind === 'vehicle' && <DispatchDot status={dispatches.get(loc.id)?.status} />}
          </div>
          {count > 0 && (
            <p className="text-[10pt] text-tertiary mt-0.5">{count} item{count !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isMember && (onEditLocation || onDeleteLocation || onAddChildLocation || onAddItemAtLocation) && (
            <button
              onClick={(e) => { e.stopPropagation(); openRowMenu('location', loc.id, (e.currentTarget as HTMLElement).closest('[data-prop-row]') as HTMLElement | null) }}
              aria-label="More actions"
              className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
            >
              <MoreHorizontal size={16} />
            </button>
          )}
          <ChevronRight size={16} className="text-tertiary shrink-0" />
        </div>
      </div>
    )
  }

  const renderItemRow = (item: LocalPropertyItem, isLast: boolean) => {
    const expiry = expiryStatus(item.expiry_date ?? null)
    const holder = item.current_holder_id ? holders?.get(item.current_holder_id) : null
    const subtitle = item.is_serialized && item.serial_number
      ? item.serial_number
      : !item.is_serialized && item.quantity > 1
        ? `Qty ${item.quantity}`
        : holder?.displayName ?? null
    const subtitleWithHolder = subtitle && holder?.displayName && subtitle !== holder.displayName
      ? `${subtitle} · ${holder.displayName}`
      : subtitle

    return (
      <div
        key={item.id}
        data-prop-row
        className={`flex items-center gap-3 px-4 py-3 ${!isLast ? 'border-b border-tertiary/8' : ''}`}
        onContextMenu={onOpenItemMenu ? (e) => { e.preventDefault(); e.stopPropagation(); onOpenItemMenu(item, (e.currentTarget as HTMLElement).getBoundingClientRect()) } : undefined}
        onTouchStart={onOpenItemMenu ? (e) => handleTouchStart('item', item.id, e) : undefined}
        onTouchEnd={onOpenItemMenu ? handleTouchEnd : undefined}
        onTouchMove={onOpenItemMenu ? handleTouchMove : undefined}
      >
        <button
          onClick={() => onSelectItem(item)}
          className="flex-1 min-w-0 flex items-center gap-3 text-left active:opacity-70 transition-opacity"
        >
          {renderItemIcon(item)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{item.name}</p>
            {subtitleWithHolder && (
              <p className="text-[10pt] text-secondary truncate mt-0.5">{subtitleWithHolder}</p>
            )}
          </div>
          {renderExpiryChip(expiry)}
        </button>
        {onOpenItemMenu && (
          <button
            onClick={(e) => { e.stopPropagation(); const row = (e.currentTarget as HTMLElement).closest('[data-prop-row]') as HTMLElement | null; if (row) onOpenItemMenu(item, row.getBoundingClientRect()) }}
            aria-label="More actions"
            className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all shrink-0"
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
    )
  }

  const renderSearchResultRow = (item: LocalPropertyItem, isLast: boolean) => {
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
        onClick={() => onSelectItem(item)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-secondary/5 transition-colors active:scale-[0.98] ${
          !isLast ? 'border-b border-tertiary/8' : ''
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
  }

  const renderFilterSegments = () => (
    <div className="flex gap-1 p-0.5 rounded-full bg-themewhite dark:bg-themewhite3 border border-themeblue3/10">
      {SEARCH_FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => setSearchFilter(f.key)}
          className={`flex-1 py-1.5 text-[9pt] font-medium rounded-full transition-all duration-200 active:scale-95 ${
            searchFilter === f.key
              ? 'bg-themeblue3 text-white shadow-sm'
              : 'text-tertiary hover:text-tertiary'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col min-h-0 px-4 pt-3 pb-20 space-y-5">
      {isSearching ? (
        <>
          {renderFilterSegments()}
          {globalSearchResults.length === 0 ? (
            <EmptyState title="No results" />
          ) : (
            <Section title="Results" count={globalSearchResults.length}>
              <SectionCard>
                {globalSearchResults.map((item, i) => renderSearchResultRow(item, i === globalSearchResults.length - 1))}
              </SectionCard>
            </Section>
          )}
        </>
      ) : (
        <>
          {/* "View on Map" row — only when drilled in */}
          {currentParentId !== null && onViewOnMap && (
            <button
              onClick={() => onViewOnMap(currentParentId)}
              className="flex items-center gap-2 py-1 text-left active:scale-[0.98] transition-all"
            >
              <MapIcon size={14} className="text-themeblue2 shrink-0" />
              <span className="text-sm text-themeblue2">View on Map</span>
            </button>
          )}

          {currentParentId === null ? (
            /* ── Root level ── */
            <>
              {/* Personnel — always present when clinic has members */}
              {hasMembers && (
                <Section title="Personnel" count={memberLocations.length}>
                  <SectionCard>
                    {memberLocations.map((loc, i) => renderLocationRow(loc, i === memberLocations.length - 1))}
                  </SectionCard>
                </Section>
              )}

              {/* Physical locations */}
              {hasLocations && (
                <Section title="Locations" count={childLocations.length}>
                  <SectionCard>
                    {childLocations.map((loc, i) => renderLocationRow(loc, i === childLocations.length - 1))}
                  </SectionCard>
                </Section>
              )}

              {/* Unassigned — no physical location and no holder */}
              {hasUnassigned && (
                <Section title="Unassigned" count={unassignedItems.length}>
                  <SectionCard>
                    {unassignedItems.map((item, i) => renderItemRow(item, i === unassignedItems.length - 1))}
                  </SectionCard>
                </Section>
              )}

              {!hasMembers && !hasLocations && !hasUnassigned && (
                <EmptyState title="No locations or items yet" />
              )}
            </>
          ) : (
            /* ── Drilled into a location or member ── */
            <>
              {isEmpty ? (
                <EmptyState title={isHolderView ? 'No items assigned' : 'No items at this location'} />
              ) : (
                <>
                  {hasLocations && (
                    <Section title="Locations" count={childLocations.length}>
                      <SectionCard>
                        {childLocations.map((loc, i) => renderLocationRow(loc, i === childLocations.length - 1))}
                      </SectionCard>
                    </Section>
                  )}
                  {hasItems && (
                    <Section title="Items" count={locationItems.length}>
                      <SectionCard>
                        {locationItems.map((item, i) => renderItemRow(item, i === locationItems.length - 1))}
                      </SectionCard>
                    </Section>
                  )}
                </>
              )}
            </>
          )}

        </>
      )}

      {/* Lifted row menu — ellipsis / long-press / right-click on location and item rows */}
      {contextMenu && (() => {
        if (contextMenu.kind === 'location') {
          const loc = locations.find((l) => l.id === contextMenu.id)
          if (!loc || loc.holder_user_id) return null
          const menuItems: ContextMenuItem[] = [
            ...(onAddChildLocation ? [{ key: 'add-area', label: 'New Area', icon: FolderPlus, onAction: () => onAddChildLocation(loc.id) }] : []),
            ...(onAddItemAtLocation ? [{ key: 'add-item', label: 'New Item', icon: PackagePlus, onAction: () => onAddItemAtLocation(loc.id) }] : []),
            ...(onEditLocation ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditLocation(loc) }] : []),
            // The default cluster zone (BAS) is a standing concept — never deletable.
            ...(onDeleteLocation && !loc.is_default_zone ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteLocation(loc.id) }] : []),
          ]
          return (
            <LiftedRowMenu
              isOpen
              layout="list"
              anchorRect={contextMenu.rect}
              onClose={() => setContextMenu(null)}
              items={menuItems}
              row={(
                <div className="flex items-center gap-3 px-4 py-3 bg-themewhite">
                  <div className="w-10 h-10 rounded-xl bg-tertiary/8 flex items-center justify-center shrink-0">
                    <FolderClosed size={18} className="text-tertiary" />
                  </div>
                  <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{loc.name}</span>
                </div>
              )}
            />
          )
        }
        // Item rows delegate to the nav-sheet-hosted shared menu (onOpenItemMenu);
        // only location rows use this inline menu.
        return null
      })()}
    </div>
  )
})
