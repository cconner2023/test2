import { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { ChevronRight, Pencil, Trash2, Map, X, Check } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { CardContextMenu } from '../CardContextMenu'
import type { LocalPropertyLocation, LocalPropertyItem } from '../../Types/PropertyTypes'

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
  clinicName?: string
  searchQuery?: string
  onSelectItem: (item: LocalPropertyItem) => void
  onEditLocation?: (loc: LocalPropertyLocation) => void
  onDeleteLocation?: (locId: string) => void
  onDeleteItem?: (item: LocalPropertyItem) => void
  onViewOnMap?: (locationId: string) => void
  onDrilldownChange?: (path: DrilldownSegment[]) => void
}

export const PropertyLocationList = forwardRef<PropertyLocationListHandle, PropertyLocationListProps>(function PropertyLocationList({
  locations,
  items,
  clinicName,
  searchQuery = '',
  onSelectItem,
  onEditLocation,
  onDeleteLocation,
  onDeleteItem,
  onViewOnMap,
  onDrilldownChange,
}, ref) {
  const [path, setPath] = useState<DrilldownSegment[]>([])
  const [contextMenu, setContextMenu] = useState<{ locId: string; x: number; y: number } | null>(null)
  const longPressRef = useRef<number | null>(null)
  const longPressPreventTap = useRef(false)
  const [unassignedOpen, setUnassignedOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const currentParentId = path.length > 0 ? path[path.length - 1].id : null

  const childLocations = useMemo(() => {
    return locations
      .filter((l) => (l.parent_id ?? null) === currentParentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locations, currentParentId])

  const locationItems = useMemo(() => {
    let list = items.filter(
      (i) => !i.parent_item_id && (i.location_id ?? null) === currentParentId,
    )
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.nomenclature?.toLowerCase().includes(q) ||
          i.nsn?.toLowerCase().includes(q) ||
          i.serial_number?.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [items, currentParentId, searchQuery])

  const unassignedItems = useMemo(() => {
    if (currentParentId !== null) return []
    let list = items.filter((i) => !i.parent_item_id && (i.location_id ?? null) === null)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.nomenclature?.toLowerCase().includes(q) ||
          i.nsn?.toLowerCase().includes(q) ||
          i.serial_number?.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [items, currentParentId, searchQuery])

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

  const navigateTo = useCallback(
    (index: number) => {
      setContextMenu(null)
      const newPath = path.slice(0, index + 1)
      setPath(newPath)
      onDrilldownChange?.(newPath)
    },
    [path, onDrilldownChange],
  )

  const navigateToRoot = useCallback(() => {
    setContextMenu(null)
    setPath([])
    onDrilldownChange?.([])
  }, [onDrilldownChange])

  // Expose popPath for parent (PropertyDrawer) back-button handling
  const popPath = useCallback(() => {
    setContextMenu(null)
    const newPath = path.slice(0, -1)
    setPath(newPath)
    onDrilldownChange?.(newPath)
  }, [path, onDrilldownChange])

  // Long-press to open context menu (mobile equivalent of right-click)
  const handleTouchStart = useCallback((locId: string, e: React.TouchEvent) => {
    const touch = e.touches[0]
    const x = touch.clientX
    const y = touch.clientY
    longPressPreventTap.current = false
    longPressRef.current = window.setTimeout(() => {
      longPressPreventTap.current = true
      setContextMenu({ locId, x, y })
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

  // Breadcrumb — collapse to "… > Parent > Current" when > 3 levels
  const renderBreadcrumb = () => {
    if (path.length === 0) return null
    const segments: Array<{ label: string; index: number } | { ellipsis: true }> = []

    if (path.length <= 3) {
      path.forEach((seg, i) => segments.push({ label: seg.name, index: i }))
    } else {
      segments.push({ label: clinicName || 'Clinic', index: -1 })
      segments.push({ ellipsis: true })
      segments.push({ label: path[path.length - 2].name, index: path.length - 2 })
      segments.push({ label: path[path.length - 1].name, index: path.length - 1 })
    }

    return (
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto border-b border-tertiary/10 shrink-0 bg-themewhite3/60">
        <button
          onClick={navigateToRoot}
          className="text-[10pt] text-themeblue3 shrink-0 active:scale-95 transition-all"
        >
          {clinicName || 'Clinic'}
        </button>
        {path.map((seg, i) => (
          <span key={seg.id} className="flex items-center gap-1 shrink-0">
            <ChevronRight size={12} className="text-tertiary/40 shrink-0" />
            {i < path.length - 1 ? (
              <button
                onClick={() => navigateTo(i)}
                className="text-[10pt] text-themeblue3 active:scale-95 transition-all"
              >
                {seg.name}
              </button>
            ) : (
              <span className="text-[10pt] font-medium text-primary">{seg.name}</span>
            )}
          </span>
        ))}
      </div>
    )
  }

  const renderLocationRow = (loc: LocalPropertyLocation) => {
    const isRenaming = renamingId === loc.id
    const count = totalDescendantItems(loc.id)

    if (isRenaming) {
      return (
        <div key={loc.id} className="flex items-center gap-2 px-4 py-3 border-b border-tertiary/10 bg-themewhite3/50">
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
            className="flex-1 min-w-0 px-3 py-2.5 rounded-lg text-primary text-base border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all placeholder:text-tertiary/30"
          />
          <button
            onClick={cancelRename}
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
          >
            <X size={18} />
          </button>
          <button
            onClick={commitRename}
            disabled={!renameValue.trim()}
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
          >
            <Check size={18} />
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
          if (onEditLocation || onDeleteLocation) {
            setContextMenu({ locId: loc.id, x: e.clientX, y: e.clientY })
          }
        }}
        onTouchStart={(e) => handleTouchStart(loc.id, e)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className="flex items-center gap-3 px-4 py-3.5 border-b border-tertiary/10 bg-themewhite3 active:bg-secondary/5 transition-colors cursor-pointer"
      >
        <span className="flex-1 text-[10pt] font-medium text-primary truncate">{loc.name}</span>
        {count > 0 && (
          <span className="text-[10pt] px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium shrink-0">
            {count}
          </span>
        )}
        <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
      </div>
    )
  }

  const renderItemRow = (item: LocalPropertyItem) => (
    <button
      key={item.id}
      onClick={() => onSelectItem(item)}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-tertiary/10 text-left active:bg-secondary/5 transition-colors active:scale-[0.98]"
    >
      <span className="flex-1 text-[10pt] text-primary truncate">{item.name}</span>
      {item.quantity > 0 && (
        <span className="text-[10pt] px-2 py-0.5 rounded-full font-medium shrink-0 bg-themeblue3/10 text-themeblue3">
          {item.quantity}
        </span>
      )}
    </button>
  )

  return (
    <div className="flex flex-col min-h-0">
      {renderBreadcrumb()}

      {/* "View on Map" row — only when drilled in */}
      {currentParentId !== null && onViewOnMap && (
        <button
          onClick={() => onViewOnMap(currentParentId)}
          className="flex items-center gap-2 px-4 py-2.5 border-b border-tertiary/10 text-left active:bg-secondary/5 transition-colors active:scale-[0.98]"
        >
          <Map size={14} className="text-themeblue3 shrink-0" />
          <span className="text-[10pt] text-themeblue3">View on Map</span>
        </button>
      )}

      {isEmpty && unassignedItems.length === 0 ? (
        <EmptyState title="No items at this location" />
      ) : (
        <>
          {childLocations.map(renderLocationRow)}
          {locationItems.map(renderItemRow)}

          {/* Unassigned section — root level only */}
          {currentParentId === null && unassignedItems.length > 0 && (
            <div>
              <button
                onClick={() => setUnassignedOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-tertiary/10 text-left active:bg-secondary/5 transition-colors active:scale-[0.98]"
              >
                <span className="flex-1 text-[10pt] font-medium text-tertiary italic">Unassigned</span>
                <span className="text-[10pt] px-2 py-0.5 rounded-full bg-themeyellow/10 text-themeyellow font-medium shrink-0">
                  {unassignedItems.length}
                </span>
                <ChevronRight
                  size={16}
                  className={`text-tertiary/40 shrink-0 transition-transform ${unassignedOpen ? 'rotate-90' : ''}`}
                />
              </button>
              {unassignedOpen && unassignedItems.map(renderItemRow)}
            </div>
          )}
        </>
      )}

      {/* Context menu — long-press / right-click on location rows */}
      {contextMenu && (() => {
        const loc = locations.find((l) => l.id === contextMenu.locId)
        if (!loc) return null
        return (
          <CardContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              ...(onEditLocation ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => startRename(loc) }] : []),
              ...(onDeleteLocation ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteLocation(loc.id) }] : []),
            ]}
          />
        )
      })()}
    </div>
  )
})
