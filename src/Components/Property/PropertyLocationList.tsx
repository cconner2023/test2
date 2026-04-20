import { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { ChevronRight, Pencil, Trash2, Map as MapIcon, X, Check, Plus } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { Section, SectionCard } from '../Section'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { PropertyItemForm } from './PropertyItemForm'
import type { LocalPropertyLocation, LocalPropertyItem, HolderInfo } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'

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
  onEditLocation?: (loc: LocalPropertyLocation) => void
  onDeleteLocation?: (locId: string) => void
  onDeleteItem?: (item: LocalPropertyItem) => void
  onViewOnMap?: (locationId: string) => void
  onDrilldownChange?: (path: DrilldownSegment[]) => void
  onAddChildLocation?: (parentId: string) => void
  onAddItemAtLocation?: (locationId: string | null) => void
  /** When true, show the inline item creation form */
  showInlineForm?: boolean
  /** Editing an existing item inline */
  inlineEditItem?: LocalPropertyItem | null
  onInlineFormClose?: () => void
  editing?: boolean
}

export const PropertyLocationList = forwardRef<PropertyLocationListHandle, PropertyLocationListProps>(function PropertyLocationList({
  locations,
  items,
  holders,
  clinicName,
  searchQuery = '',
  onSelectItem,
  onEditLocation,
  onDeleteLocation,
  onDeleteItem,
  onViewOnMap,
  onDrilldownChange,
  onAddChildLocation,
  onAddItemAtLocation,
  showInlineForm = false,
  inlineEditItem = null,
  onInlineFormClose,
  editing = false,
}, ref) {
  const [path, setPath] = useState<DrilldownSegment[]>([])
  const [contextMenu, setContextMenu] = useState<{ type: 'location' | 'item'; id: string; x: number; y: number } | null>(null)
  const longPressRef = useRef<number | null>(null)
  const longPressPreventTap = useRef(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const [searchFilter, setSearchFilter] = useState<PropertySearchFilter>('all')

  const currentParentId = path.length > 0 ? path[path.length - 1].id : null
  const isSearching = searchQuery.trim().length > 0

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

  const childLocations = useMemo(() => {
    if (isSearching) return []
    return locations
      .filter((l) => (l.parent_id ?? null) === currentParentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locations, currentParentId, isSearching])

  const locationItems = useMemo(() => {
    if (isSearching) return []
    return items
      .filter((i) => !i.parent_item_id && (i.location_id ?? null) === currentParentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, currentParentId, isSearching])

  const unassignedItems = useMemo(() => {
    if (isSearching) return []
    if (currentParentId !== null) return []
    return items
      .filter((i) => !i.parent_item_id && (i.location_id ?? null) === null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, currentParentId, isSearching])

  const drillInto = useCallback(
    (loc: LocalPropertyLocation) => {
      if (longPressPreventTap.current) { longPressPreventTap.current = false; return }
      setContextMenu(null)
      const newPath = [...path, { id: loc.id, name: loc.name }]
      setPath(newPath)
      onDrilldownChange?.(newPath)
    },
    [path, onDrilldownChange],
  )

  // Expose popPath for parent (PropertyDrawer) back-button handling
  const popPath = useCallback(() => {
    setContextMenu(null)
    const newPath = path.slice(0, -1)
    setPath(newPath)
    onDrilldownChange?.(newPath)
  }, [path, onDrilldownChange])

  // Long-press to open context menu (mobile equivalent of right-click)
  const handleTouchStart = useCallback((type: 'location' | 'item', id: string, e: React.TouchEvent) => {
    const touch = e.touches[0]
    const x = touch.clientX
    const y = touch.clientY
    longPressPreventTap.current = false
    longPressRef.current = window.setTimeout(() => {
      longPressPreventTap.current = true
      setContextMenu({ type, id, x, y })
    }, 500)
  }, [])

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

  const startRename = useCallback((loc: LocalPropertyLocation) => {
    setContextMenu(null)
    setRenamingId(loc.id)
    setRenameValue(loc.name)
    setTimeout(() => renameInputRef.current?.focus(), 30)
  }, [])

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim() && onEditLocation) {
      const loc = locations.find((l) => l.id === renamingId)
      if (loc) onEditLocation({ ...loc, name: renameValue.trim() })
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, onEditLocation, locations])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameValue('')
  }, [])

  const totalDescendantItems = useCallback(
    (locId: string): number => {
      const directItems = items.filter(
        (i) => !i.parent_item_id && i.location_id === locId,
      ).length
      const childLocs = locations.filter((l) => l.parent_id === locId)
      return directItems + childLocs.reduce((sum, c) => sum + totalDescendantItems(c.id), 0)
    },
    [items, locations],
  )

  const isEmpty = childLocations.length === 0 && locationItems.length === 0

  const hasLocations = childLocations.length > 0
  const hasItems = locationItems.length > 0
  const hasUnassigned = currentParentId === null && unassignedItems.length > 0

  const renderLocationRow = (loc: LocalPropertyLocation, isLast: boolean) => {
    const isRenaming = renamingId === loc.id
    const count = totalDescendantItems(loc.id)

    if (isRenaming) {
      return (
        <div key={loc.id} className="flex items-center gap-2 px-4 py-3">
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') cancelRename()
            }}
            placeholder="Rename location"
            className="flex-1 min-w-0 rounded-full py-2.5 px-4 border border-themeblue1/30 shadow-xs bg-themewhite2 focus:outline-none text-base text-primary placeholder:text-tertiary/30 transition-all duration-300"
          />
          <button
            onClick={cancelRename}
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-themewhite2 border border-themeblue3/10 text-tertiary hover:text-primary active:scale-95 transition-all duration-300"
          >
            <X size={20} />
          </button>
          <button
            onClick={commitRename}
            disabled={!renameValue.trim()}
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-themeblue3 text-white border border-themeblue1/30 disabled:opacity-30 active:scale-95 transition-all duration-300"
          >
            <Check size={20} />
          </button>
        </div>
      )
    }

    return (
      <div
        key={loc.id}
        role="button"
        tabIndex={0}
        onClick={() => drillInto(loc)}
        onKeyDown={(e) => { if (e.key === 'Enter') drillInto(loc) }}
        onContextMenu={(e) => {
          e.preventDefault()
          if (onEditLocation || onDeleteLocation || onAddChildLocation || onAddItemAtLocation) {
            setContextMenu({ type: 'location', id: loc.id, x: e.clientX, y: e.clientY })
          }
        }}
        onTouchStart={(e) => handleTouchStart('location', loc.id, e)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`flex items-center gap-3 px-4 py-3.5 active:bg-secondary/5 transition-colors cursor-pointer ${
          !isLast ? 'border-b border-tertiary/8' : ''
        }`}
      >
        <span className="flex-1 text-sm font-medium text-primary truncate">{loc.name}</span>
        {count > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium shrink-0">
            {count}
          </span>
        )}
        {editing ? (
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {onEditLocation && (
              <button
                onClick={() => startRename(loc)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDeleteLocation && (
              <button
                onClick={() => onDeleteLocation(loc.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : (
          <ChevronRight size={16} className="text-tertiary/30 shrink-0" />
        )}
      </div>
    )
  }

  const renderItemRow = (item: LocalPropertyItem, isLast: boolean) => {
    const expiry = expiryStatus(item.expiry_date ?? null)
    return (
    <div
      key={item.id}
      className={`flex items-center gap-3 px-4 py-3.5 ${
        !isLast ? 'border-b border-tertiary/8' : ''
      }`}
      onContextMenu={onAddItemAtLocation ? (e) => { e.preventDefault(); setContextMenu({ type: 'item', id: item.id, x: e.clientX, y: e.clientY }) } : undefined}
      onTouchStart={onAddItemAtLocation ? (e) => handleTouchStart('item', item.id, e) : undefined}
      onTouchEnd={onAddItemAtLocation ? handleTouchEnd : undefined}
      onTouchMove={onAddItemAtLocation ? handleTouchMove : undefined}
    >
      <button
        onClick={() => onSelectItem(item)}
        className="flex-1 min-w-0 flex items-center gap-3 text-left active:opacity-70 transition-opacity"
      >
        {expiry && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${expiry === 'expired' ? 'bg-themeredred' : 'bg-themeyellow'}`} />
        )}
        <span className="flex-1 text-sm text-primary truncate">{item.name}</span>
        {item.quantity > 1 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-themeblue3/10 text-themeblue3">
            {item.quantity}
          </span>
        )}
      </button>
      {editing && onDeleteItem && (
        <button
          onClick={() => onDeleteItem(item)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all shrink-0"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
  }

  const renderSearchResultRow = (item: LocalPropertyItem, isLast: boolean) => {
    const locName = item.location_id ? locationNameMap.get(item.location_id) : null
    const holder = item.current_holder_id ? holders?.get(item.current_holder_id) : null
    const expiry = expiryStatus(item.expiry_date ?? null)
    const subtitle = [locName, holder?.displayName].filter(Boolean).join(' · ')

    return (
      <button
        key={item.id}
        onClick={() => onSelectItem(item)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-secondary/5 transition-colors active:scale-[0.98] ${
          !isLast ? 'border-b border-tertiary/8' : ''
        }`}
      >
        {expiry && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${expiry === 'expired' ? 'bg-themeredred' : 'bg-themeyellow'}`} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary truncate">{item.name}</p>
          {subtitle && (
            <p className="text-xs text-tertiary/60 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
        {item.quantity > 1 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-themeblue3/10 text-themeblue3">
            {item.quantity}
          </span>
        )}
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
          className={`flex-1 py-1.5 text-[10px] font-medium rounded-full transition-all duration-200 active:scale-95 ${
            searchFilter === f.key
              ? 'bg-themeblue3 text-white shadow-sm'
              : 'text-tertiary/50 hover:text-tertiary/70'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )

  const inlineFormVisible = showInlineForm || !!inlineEditItem

  return (
    <div className="flex flex-col min-h-0 px-4 pt-3 pb-20 space-y-5">
      {/* Inline item form — animated expand like TextExpanderManager */}
      <div className={`overflow-hidden transition-all duration-300 ease-out ${
        inlineFormVisible ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        {inlineFormVisible && (
          <PropertyItemForm
            editingItem={inlineEditItem}
            onClose={() => onInlineFormClose?.()}
          />
        )}
      </div>

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
              <MapIcon size={14} className="text-themeblue3 shrink-0" />
              <span className="text-sm text-themeblue3">View on Map</span>
            </button>
          )}

          {isEmpty && !hasUnassigned ? (
            <EmptyState title="No items at this location" />
          ) : (
            <>
              {/* Locations section */}
              {hasLocations && (
                <Section title="Locations" count={childLocations.length}>
                  <SectionCard>
                    {childLocations.map((loc, i) => renderLocationRow(loc, i === childLocations.length - 1))}
                  </SectionCard>
                </Section>
              )}

              {/* Items section */}
              {hasItems && (
                <Section title="Items" count={locationItems.length}>
                  <SectionCard>
                    {locationItems.map((item, i) => renderItemRow(item, i === locationItems.length - 1))}
                  </SectionCard>
                </Section>
              )}

              {/* Unassigned section — root level only */}
              {hasUnassigned && (
                <Section title="Unassigned" count={unassignedItems.length}>
                  <SectionCard>
                    {unassignedItems.map((item, i) => renderItemRow(item, i === unassignedItems.length - 1))}
                  </SectionCard>
                </Section>
              )}
            </>
          )}

          {/* Context menu — long-press / right-click on location and item rows */}
          {contextMenu && (() => {
            if (contextMenu.type === 'location') {
              const loc = locations.find((l) => l.id === contextMenu.id)
              if (!loc) return null
              return (
                <ContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  onClose={() => setContextMenu(null)}
                  items={[
                    ...(onAddChildLocation ? [{ key: 'add-area', label: 'New Area', icon: Plus, onAction: () => onAddChildLocation(loc.id) }] : []),
                    ...(onAddItemAtLocation ? [{ key: 'add-item', label: 'New Item', icon: Plus, onAction: () => onAddItemAtLocation(loc.id) }] : []),
                    ...(onEditLocation ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => startRename(loc) }] : []),
                    ...(onDeleteLocation ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteLocation(loc.id) }] : []),
                  ]}
                />
              )
            } else {
              return (
                <ContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  onClose={() => setContextMenu(null)}
                  items={[
                    ...(onAddItemAtLocation ? [{ key: 'add-item', label: 'New Item', icon: Plus, onAction: () => onAddItemAtLocation(currentParentId) }] : []),
                  ]}
                />
              )
            }
          })()}
        </>
      )}
    </div>
  )
})
