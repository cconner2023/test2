import { useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronDown, Pencil, Trash2, Eye, FolderPlus, PackagePlus } from 'lucide-react'
import { useDrag } from '@use-gesture/react'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import type { LocalPropertyLocation, LocalPropertyItem } from '../../Types/PropertyTypes'
import { expiryStatus } from '../../Types/PropertyTypes'

interface PropertyLocationTreeProps {
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  clinicName?: string
  onSelectLocation: (location: LocalPropertyLocation) => void
  onSelectItem: (item: LocalPropertyItem) => void
  onMoveLocation?: (locationId: string, newParentId: string | null) => void
  onMoveItem?: (itemId: string, newLocationId: string | null) => void
  activeLocationId?: string | null
  onSelectAll?: () => void
  allSelected?: boolean
  onEditLocation?: (loc: LocalPropertyLocation) => void
  onDeleteLocation?: (locId: string) => void
  onDeleteItem?: (item: LocalPropertyItem) => void
  onAddChildLocation?: (parentId: string | null) => void
  onAddItemAtLocation?: (locationId: string | null) => void
  editing?: boolean
}

interface TreeNode {
  location: LocalPropertyLocation
  children: TreeNode[]
  items: LocalPropertyItem[]
}

interface DragState {
  type: 'location' | 'item'
  id: string
  name: string
  invalidTargets: Set<string>
}

export function PropertyLocationTree({
  locations,
  items,
  clinicName,
  onSelectLocation,
  onSelectItem,
  onMoveLocation,
  onMoveItem,
  activeLocationId,
  onSelectAll,
  allSelected,
  onEditLocation,
  onDeleteLocation,
  onDeleteItem,
  onAddChildLocation,
  onAddItemAtLocation,
  editing = false,
}: PropertyLocationTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const dropTargetRef = useRef<string | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ type: 'location' | 'item' | 'root'; id: string; x: number; y: number } | null>(null)

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Build location children map for descendant detection
  const locationChildrenMap = useMemo(() => {
    const map = new Map<string | null, string[]>()
    for (const loc of locations) {
      const key = loc.parent_id ?? null
      const arr = map.get(key)
      if (arr) arr.push(loc.id)
      else map.set(key, [loc.id])
    }
    return map
  }, [locations])

  const getDescendantIds = useCallback((locId: string): Set<string> => {
    const result = new Set<string>([locId])
    const queue = [locId]
    while (queue.length > 0) {
      const current = queue.pop()!
      const children = locationChildrenMap.get(current)
      if (children) {
        for (const child of children) {
          if (!result.has(child)) {
            result.add(child)
            queue.push(child)
          }
        }
      }
    }
    return result
  }, [locationChildrenMap])

  const { roots, unassignedItems, memberNodes } = useMemo(() => {
    const childrenMap = new Map<string | null, LocalPropertyLocation[]>()
    for (const loc of locations) {
      const key = loc.parent_id ?? null
      const arr = childrenMap.get(key)
      if (arr) arr.push(loc)
      else childrenMap.set(key, [loc])
    }

    const itemsByLocation = new Map<string | null, LocalPropertyItem[]>()
    for (const item of items) {
      if (item.parent_item_id) continue
      const key = item.location_id ?? null
      const arr = itemsByLocation.get(key)
      if (arr) arr.push(item)
      else itemsByLocation.set(key, [item])
    }

    function buildNode(loc: LocalPropertyLocation): TreeNode {
      const children = (childrenMap.get(loc.id) ?? [])
        .filter(l => !l.holder_user_id) // member-locations don't nest further
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(buildNode)
      const nodeItems = (itemsByLocation.get(loc.id) ?? [])
        .sort((a, b) => a.name.localeCompare(b.name))
      return { location: loc, children, items: nodeItems }
    }

    // Member-locations are children of root — split them out for section rendering
    const memberNodes: TreeNode[] = locations
      .filter(l => !!l.holder_user_id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(loc => ({
        location: loc,
        children: [],
        items: (itemsByLocation.get(loc.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      }))

    // Physical root locations = no parent AND no holder_user_id
    const rootLocations = locations
      .filter(l => !l.holder_user_id && (l.parent_id ?? null) === null)
      .sort((a, b) => a.name.localeCompare(b.name))
    const roots = rootLocations.map(buildNode)

    // Unassigned = no location at all
    const unassignedItems = items
      .filter(i => !i.parent_item_id && !i.location_id)
      .sort((a, b) => a.name.localeCompare(b.name))

    return { roots, unassignedItems, memberNodes }
  }, [locations, items])

  // Helper to keep ref + state in sync
  const updateDropTarget = useCallback((id: string | null) => {
    dropTargetRef.current = id
    setDropTargetId(id)
  }, [])

  // useDrag on the tree container
  const bindDrag = useDrag(({ active, first, last, xy: [cx, cy], event, tap }) => {
    if (tap) return

    if (first) {
      const target = (event?.target as HTMLElement)?.closest?.('[data-drag-id]') as HTMLElement | null
      if (!target) return
      const id = target.dataset.dragId!
      const type = target.dataset.dragType as 'location' | 'item'
      const name = target.dataset.dragName || ''

      // Compute invalid targets for locations (self + descendants)
      let invalidTargets = new Set<string>()
      if (type === 'location') {
        invalidTargets = getDescendantIds(id)
        // Also invalid: current parent (no-op move)
        const loc = locations.find(l => l.id === id)
        if (loc?.parent_id) invalidTargets.add('__current_parent__')
      }

      const state: DragState = { type, id, name, invalidTargets }
      dragRef.current = state
      setDragState(state)
      updateDropTarget(null)
    }

    if (!dragRef.current) return

    // Position ghost
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate(${cx}px, ${cy}px)`
    }

    if (active && !first) {
      // Temporarily hide ghost to hit-test underneath
      if (ghostRef.current) ghostRef.current.style.display = 'none'
      const el = document.elementFromPoint(cx, cy) as HTMLElement | null
      if (ghostRef.current) ghostRef.current.style.display = ''

      const dropEl = el?.closest?.('[data-drop-id]') as HTMLElement | null
      const newDropId = dropEl?.dataset.dropId ?? null

      if (newDropId && dragRef.current) {
        const ds = dragRef.current
        // Validate drop target
        if (ds.type === 'location') {
          // Can't drop on self or descendants
          if (ds.invalidTargets.has(newDropId)) {
            updateDropTarget(null)
            return
          }
          // Can't drop on current parent (no-op)
          const loc = locations.find(l => l.id === ds.id)
          const currentParent = loc?.parent_id ?? '__root__'
          if (newDropId === currentParent) {
            updateDropTarget(null)
            return
          }
        } else {
          // Item: can't drop on __root__ (only locations or __unassigned__)
          if (newDropId === '__root__') {
            updateDropTarget(null)
            return
          }
          // Can't drop back on current location (no-op)
          const item = items.find(i => i.id === ds.id)
          const currentLoc = item?.location_id ?? '__unassigned__'
          if (newDropId === currentLoc) {
            updateDropTarget(null)
            return
          }
        }
        updateDropTarget(newDropId)
      } else {
        updateDropTarget(null)
      }
    }

    if (last) {
      const ds = dragRef.current
      const finalTarget = dropTargetRef.current
      // Clear drag state
      dragRef.current = null
      setDragState(null)
      updateDropTarget(null)

      if (ds && finalTarget) {
        if (ds.type === 'location' && onMoveLocation) {
          const newParent = finalTarget === '__root__' ? null : finalTarget
          onMoveLocation(ds.id, newParent)
        } else if (ds.type === 'item' && onMoveItem) {
          const newLoc = finalTarget === '__unassigned__' ? null : finalTarget
          onMoveItem(ds.id, newLoc)
        }
      }
    }
  }, { filterTaps: true, delay: 150 })

  if (roots.length === 0 && unassignedItems.length === 0 && memberNodes.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-[10pt] text-tertiary">
        No locations or items yet.
      </div>
    )
  }

  function countAllItems(node: TreeNode): number {
    let count = node.items.length
    for (const child of node.children) count += countAllItems(child)
    return count
  }

  function renderNode(node: TreeNode, depth: number) {
    const isMember = !!node.location.holder_user_id
    const hasChildren = node.children.length > 0 || node.items.length > 0
    const isCollapsed = collapsed.has(node.location.id)
    const totalItems = countAllItems(node)
    const isDragSource = !isMember && dragState?.id === node.location.id
    const isDropTarget = !isMember && dropTargetId === node.location.id
    const isActive = activeLocationId === node.location.id

    return (
      <div key={node.location.id}>
        {/* Location row */}
        <div
          className={`flex items-center gap-2 py-2 pr-6 transition-colors ${
            isDragSource ? 'opacity-30' : ''
          } ${
            isDropTarget
              ? 'bg-themeblue3/10 ring-1 ring-themeblue3/30'
              : isActive
                ? 'bg-primary/5 border-l-2 border-l-primary/40'
                : 'hover:bg-secondary/5'
          }`}
          style={{ paddingLeft: `${16 + depth * 20}px` }}
          {...(!isMember && {
            'data-drag-id': node.location.id,
            'data-drag-type': 'location',
            'data-drag-name': node.location.name,
            'data-drop-id': node.location.id,
          })}
          onContextMenu={!isMember ? (e) => { e.preventDefault(); e.stopPropagation(); if (onEditLocation || onDeleteLocation || onAddChildLocation || onAddItemAtLocation) setContextMenu({ type: 'location', id: node.location.id, x: e.clientX, y: e.clientY }) } : undefined}
        >
          {/* Chevron */}
          {hasChildren ? (
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.location.id) }}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}

          {/* Location icon + name */}
          <div
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
            onClick={() => onSelectLocation(node.location)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectLocation(node.location) }}
          >
            <span className="text-[10pt] font-medium text-primary truncate">{node.location.name}</span>
          </div>

          {/* Item count badge */}
          {totalItems > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary shrink-0">
              {totalItems}
            </span>
          )}

          {/* Inline edit controls — real locations only */}
          {!isMember && editing && (
            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {onEditLocation && (
                <button
                  onClick={() => onEditLocation(node.location)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                >
                  <Pencil size={13} />
                </button>
              )}
              {onDeleteLocation && (
                <button
                  onClick={() => onDeleteLocation(node.location.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Children + items when expanded */}
        {hasChildren && !isCollapsed && (
          <>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {node.items.map((item) => {
              const isItemDragSource = dragState?.id === item.id
              const expiry = expiryStatus(item.expiry_date ?? null)
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={`flex items-center gap-2 w-full py-2 pr-6 transition-colors text-left cursor-pointer ${
                    isItemDragSource ? 'opacity-30' : 'hover:bg-secondary/5'
                  }`}
                  style={{ paddingLeft: `${16 + (depth + 1) * 20 + 18}px` }}
                  onClick={() => onSelectItem(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSelectItem(item) }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (onDeleteItem || onAddItemAtLocation) setContextMenu({ type: 'item', id: item.id, x: e.clientX, y: e.clientY }) }}
                  data-drag-id={item.id}
                  data-drag-type="item"
                  data-drag-name={item.name}
                >
                  {expiry && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${expiry === 'expired' ? 'bg-themeredred' : 'bg-themeyellow'}`} />
                  )}
                  <span className="text-[10pt] text-primary truncate flex-1">{item.name}</span>
                  {item.quantity > 0 && (
                    <span className="text-[9pt] text-tertiary tabular-nums shrink-0">
                      {item.quantity}
                    </span>
                  )}
                  {editing && onDeleteItem && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteItem(item) }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    )
  }

  // Show unassigned section when there are unassigned items OR when dragging an item (as drop target)
  const showUnassigned = unassignedItems.length > 0 || dragState?.type === 'item'
  const isUnassignedDropTarget = dropTargetId === '__unassigned__'

  return (
    <div
      {...bindDrag()}
      className="flex flex-col py-1"
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => {
        if (onAddChildLocation || onAddItemAtLocation) {
          e.preventDefault()
          setContextMenu({ type: 'root', id: '', x: e.clientX, y: e.clientY })
        }
      }}
    >
      {/* All Locations node */}
      {onSelectAll && (
        <div
          role="button"
          tabIndex={0}
          className={`flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer ${
            allSelected
              ? 'bg-primary/5 border-l-2 border-l-primary/40'
              : 'hover:bg-secondary/5'
          }`}
          style={{ paddingLeft: '16px' }}
          onClick={onSelectAll}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelectAll() }}
        >
          <span className="w-[18px] shrink-0" />
          <span className="text-[10pt] font-medium text-primary truncate">{clinicName || 'Clinic'}</span>
        </div>
      )}

      {memberNodes.map((node) => renderNode(node, 0))}
      {roots.map((node) => renderNode(node, 0))}

      {/* Root drop zone — only visible when dragging a location */}
      {dragState?.type === 'location' && (
        <div
          className={`mx-3 my-1 py-2 rounded-md border-2 border-dashed text-center text-[10pt] font-medium transition-colors ${
            dropTargetId === '__root__'
              ? 'border-themeblue3/40 bg-themeblue3/10 text-themeblue3'
              : 'border-tertiary/20 text-tertiary'
          }`}
          data-drop-id="__root__"
        >
          Move to top level
        </div>
      )}

      {/* Unassigned items */}
      {showUnassigned && (
        <div>
          <div
            className={`flex items-center gap-2 py-2 pr-6 transition-colors ${
              isUnassignedDropTarget
                ? 'bg-themeyellow/10 ring-1 ring-themeyellow/30'
                : 'hover:bg-secondary/5'
            }`}
            style={{ paddingLeft: '16px' }}
            data-drop-id="__unassigned__"
          >
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleCollapse('__unassigned__') }}
            >
              {collapsed.has('__unassigned__') ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
            <span className="text-[10pt] font-medium text-tertiary italic flex-1">Unassigned</span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary shrink-0">
              {unassignedItems.length}
            </span>
          </div>

          {!collapsed.has('__unassigned__') && (
            <>
              {unassignedItems.map((item) => {
                const isItemDragSource = dragState?.id === item.id
                const expiry = expiryStatus(item.expiry_date ?? null)
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-2 w-full py-2 pr-6 transition-colors text-left cursor-pointer ${
                      isItemDragSource ? 'opacity-30' : 'hover:bg-secondary/5'
                    }`}
                    style={{ paddingLeft: `${16 + 20 + 18}px` }}
                    onClick={() => onSelectItem(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSelectItem(item) }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (onDeleteItem || onAddItemAtLocation) setContextMenu({ type: 'item', id: item.id, x: e.clientX, y: e.clientY }) }}
                    data-drag-id={item.id}
                    data-drag-type="item"
                    data-drag-name={item.name}
                  >
                    {expiry && (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${expiry === 'expired' ? 'bg-themeredred' : 'bg-themeyellow'}`} />
                    )}
                    <span className="text-[10pt] text-primary truncate flex-1">{item.name}</span>
                    {item.quantity > 0 && (
                      <span className="text-[9pt] text-tertiary tabular-nums shrink-0">
                        {item.quantity}
                      </span>
                    )}
                    {editing && onDeleteItem && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteItem(item) }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (() => {
        if (contextMenu.type === 'root') {
          return (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              items={[
                ...(onAddChildLocation ? [{ key: 'add-area', label: 'New Area', icon: FolderPlus, onAction: () => onAddChildLocation(null) }] : []),
                ...(onAddItemAtLocation ? [{ key: 'add-item', label: 'New Item', icon: PackagePlus, onAction: () => onAddItemAtLocation(null) }] : []),
              ]}
            />
          )
        }
        if (contextMenu.type === 'location') {
          const loc = locations.find(l => l.id === contextMenu.id)
          if (!loc) return null
          return (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              items={[
                ...(onAddChildLocation ? [{ key: 'add-area', label: 'New Area', icon: FolderPlus, onAction: () => onAddChildLocation(loc.id) }] : []),
                ...(onAddItemAtLocation ? [{ key: 'add-item', label: 'New Item', icon: PackagePlus, onAction: () => onAddItemAtLocation(loc.id) }] : []),
                ...(onEditLocation ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditLocation(loc) }] : []),
                ...(onDeleteLocation ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteLocation(loc.id) }] : []),
              ]}
            />
          )
        } else {
          const item = items.find(i => i.id === contextMenu.id)
          if (!item) return null
          return (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              items={[
                { key: 'view', label: 'View', icon: Eye, onAction: () => onSelectItem(item) },
                ...(onAddItemAtLocation ? [{ key: 'add-item', label: 'New Item', icon: PackagePlus, onAction: () => onAddItemAtLocation(item.location_id ?? null) }] : []),
                ...(onDeleteItem ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteItem(item) }] : []),
              ]}
            />
          )
        }
      })()}

      {/* Ghost element rendered via portal */}
      {dragState && createPortal(
        <div
          ref={ghostRef}
          className="fixed top-0 left-0 z-[9999] pointer-events-none"
          style={{ transform: 'translate(-9999px, -9999px)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-lg border border-tertiary/20 max-w-[200px]">
            <span className="text-[10pt] font-medium text-primary truncate">{dragState.name}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
