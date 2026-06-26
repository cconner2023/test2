import { useState, useMemo, useCallback } from 'react'
import { ChevronRight, ChevronDown, Pencil, Trash2, Eye, FolderPlus, PackagePlus, MoreHorizontal, FolderClosed, Layers } from 'lucide-react'
import { type ContextMenuItem } from '../ContextMenu'
import { LiftedRowMenu } from '../LiftedRowMenu'
import type { LocalPropertyLocation, LocalPropertyItem, HolderInfo } from '../../Types/PropertyTypes'
import { itemAlert } from '../../Types/PropertyTypes'
import { isStructuralZone } from './levelUtils'
import { useVehicleDispatches } from '../../Hooks/useVehicleDispatches'
import { DispatchDot } from './DispatchDot'

interface PropertyLocationTreeProps {
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  clinicName?: string
  /** Holders, for matching items by their current holder's name while searching. */
  holders?: Map<string, HolderInfo>
  /** Filter the tree to locations/items matching this query (name, nsn, lin, serial, …). */
  searchQuery?: string
  /** Reveal each row's ellipsis only on hover (desktop rail); off = always shown (mobile). */
  hoverActions?: boolean
  /**
   * Scope the tree to one zone's subtree: render that location's direct child
   * locations as roots and its direct items as top-level rows. Hides the
   * All-Locations / members / unassigned sections and the top-level drop zone.
   * Used by the selected-zone surface (PropertyLocationDetail).
   */
  rootId?: string
  onSelectLocation: (location: LocalPropertyLocation) => void
  onSelectItem: (item: LocalPropertyItem) => void
  activeLocationId?: string | null
  onSelectAll?: () => void
  allSelected?: boolean
  /** "My property" filter: when on, prune the tree to items the user OWNS
   *  (`owner_user_id`) OR HOLDS by custody (`current_holder_id`), plus the zones on
   *  their path. */
  mineOnly?: boolean
  /** The viewer's user id — needed to evaluate the "My property" filter. */
  currentUserId?: string | null
  /** Open the location edit form (name + parent) — no longer an inline rename. */
  onEditLocation?: (loc: LocalPropertyLocation) => void
  /** Open the item edit form. */
  onEditItem?: (item: LocalPropertyItem) => void
  onDeleteLocation?: (locId: string) => void
  onDeleteItem?: (item: LocalPropertyItem) => void
  onAddChildLocation?: (parentId: string | null) => void
  /** Add a building floor (kind='level') to a structural zone. */
  onAddLevel?: (containerId: string) => void
  onAddItemAtLocation?: (locationId: string | null) => void
}

interface TreeNode {
  location: LocalPropertyLocation
  children: TreeNode[]
  items: LocalPropertyItem[]
}

export function PropertyLocationTree({
  locations,
  items,
  clinicName,
  holders,
  searchQuery,
  hoverActions,
  rootId,
  onSelectLocation,
  onSelectItem,
  activeLocationId,
  onSelectAll,
  allSelected,
  mineOnly,
  currentUserId,
  onEditLocation,
  onEditItem,
  onDeleteLocation,
  onDeleteItem,
  onAddChildLocation,
  onAddLevel,
  onAddItemAtLocation,
}: PropertyLocationTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // Current open dispatches per vehicle → the row red-dot (expiring/expired).
  const dispatches = useVehicleDispatches(locations[0]?.clinic_id ?? null)
  const [contextMenu, setContextMenu] = useState<{ kind: 'location' | 'item'; id: string; rect: DOMRect } | null>(null)

  // Open the lifted row menu anchored to a row element's bounding rect.
  const openRowMenu = useCallback((kind: 'location' | 'item', id: string, anchor: HTMLElement | null) => {
    if (anchor) setContextMenu({ kind, id, rect: anchor.getBoundingClientRect() })
  }, [])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const { roots, unassignedItems, memberNodes, rootItems } = useMemo(() => {
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

    // Scoped mode: render the selected zone's direct children as roots and its
    // direct items as top-level rows. No members / unassigned / All-Locations.
    if (rootId) {
      const scopedRoots = (childrenMap.get(rootId) ?? [])
        .filter(l => !l.holder_user_id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(buildNode)
      const scopedItems = (itemsByLocation.get(rootId) ?? []).sort((a, b) => a.name.localeCompare(b.name))
      return { roots: scopedRoots, unassignedItems: [], memberNodes: [], rootItems: scopedItems }
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

    return { roots, unassignedItems, memberNodes, rootItems: [] as LocalPropertyItem[] }
  }, [locations, items, rootId])

  // Search filter — when a query is present, prune the tree to matching items /
  // locations (a matching location keeps its whole subtree; otherwise keep only
  // matching descendants). Mirrors PropertySearchOverlay's match fields.
  const q = (searchQuery ?? '').trim().toLowerCase()
  const isSearching = q.length > 0
  const mineActive = !!currentUserId && !!mineOnly
  const { displayRoots, displayMembers, displayUnassigned, displayRootItems } = useMemo(() => {
    if (!isSearching && !mineActive) return { displayRoots: roots, displayMembers: memberNodes, displayUnassigned: unassignedItems, displayRootItems: rootItems }

    const locName = (id: string | null) => (id ? locations.find(l => l.id === id)?.name ?? null : null)
    const matchesSearch = (i: LocalPropertyItem) => {
      const holder = i.current_holder_id ? holders?.get(i.current_holder_id) : null
      return (
        i.name.toLowerCase().includes(q) ||
        !!i.nomenclature?.toLowerCase().includes(q) ||
        !!i.nsn?.toLowerCase().includes(q) ||
        !!i.lin?.toLowerCase().includes(q) ||
        !!i.serial_number?.toLowerCase().includes(q) ||
        !!i.notes?.toLowerCase().includes(q) ||
        !!holder?.displayName.toLowerCase().includes(q) ||
        !!locName(i.location_id ?? null)?.toLowerCase().includes(q)
      )
    }
    // "My property" = owned by the viewer (owner_user_id) OR held by the viewer via
    // custody (current_holder_id).
    const isMine = (i: LocalPropertyItem) =>
      i.owner_user_id === currentUserId || i.current_holder_id === currentUserId
    const showItem = (i: LocalPropertyItem) =>
      (!isSearching || matchesSearch(i)) && (!mineActive || isMine(i))

    const filterNode = (node: TreeNode): TreeNode | null => {
      // A location NAME hit keeps its whole subtree — but ONLY for a pure search. The
      // "Mine" filter must never surface items the viewer doesn't own/hold just because
      // a zone name matched, so the shortcut is disabled when mineActive.
      if (isSearching && !mineActive && node.location.name.toLowerCase().includes(q)) return node
      const children = node.children.map(filterNode).filter((n): n is TreeNode => n !== null)
      const nodeItems = node.items.filter(showItem)
      if (children.length === 0 && nodeItems.length === 0) return null
      return { ...node, children, items: nodeItems }
    }
    return {
      displayRoots: roots.map(filterNode).filter((n): n is TreeNode => n !== null),
      displayMembers: memberNodes.map(filterNode).filter((n): n is TreeNode => n !== null),
      displayUnassigned: unassignedItems.filter(showItem),
      displayRootItems: rootItems.filter(showItem),
    }
  }, [isSearching, mineActive, currentUserId, q, roots, memberNodes, unassignedItems, rootItems, locations, holders])

  // Ellipsis button — hover-revealed in the desktop rail, always shown elsewhere.
  const actionBtnCls = `w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0 ${
    hoverActions ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''
  }`

  if (
    displayRoots.length === 0 &&
    displayUnassigned.length === 0 &&
    displayMembers.length === 0 &&
    displayRootItems.length === 0
  ) {
    return (
      <div className="px-6 py-8 text-center text-[10pt] text-tertiary">
        {isSearching ? 'No matches.' : mineActive ? 'Nothing owned or signed to you.' : rootId ? 'Nothing here yet' : 'No locations or items yet.'}
      </div>
    )
  }

  // Shared item-row renderer — used for nested items, unassigned items, and the
  // scoped selected-zone's top-level items. Takes the row's tree `depth` so item
  // rows share the exact leading structure of location rows (chevron-slot + gap),
  // keeping every child at a parent — vehicle, zone, or item — at the same indent.
  // `actionCls` toggles hover-gated vs always-visible ellipsis.
  function renderItemRow(item: LocalPropertyItem, depth: number, actionCls: string) {
    // Expired / expiring (≤30d) / depleted (0 on hand) → red row + dot.
    const alert = itemAlert(item)
    // Compact warning tag riding the action slot: OUT when depleted, EXP when expiry-flagged.
    const warnLabel = alert === 'depleted' ? 'OUT' : alert ? 'EXP' : null
    const hasActions = !!(onAddItemAtLocation || onDeleteItem)
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        className={`group flex items-center gap-2 w-full py-2 pr-6 transition-colors text-left cursor-pointer border-l-2 ${
          alert ? 'bg-themeredred/[0.06] border-l-themeredred/60' : 'border-l-transparent hover:bg-secondary/5'
        }`}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
        data-prop-row
        onClick={() => onSelectItem(item)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelectItem(item) }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (onDeleteItem || onAddItemAtLocation) openRowMenu('item', item.id, e.currentTarget as HTMLElement) }}
      >
        {/* Alert indicator sits in the chevron slot so item names line up with sibling locations. */}
        <span className="w-[18px] shrink-0 flex items-center justify-center">
          {alert && <span className="w-1.5 h-1.5 rounded-full bg-themeredred" />}
        </span>
        <span className={`text-[10pt] truncate flex-1 ${alert ? 'text-themeredred font-medium' : 'text-primary'}`}>{item.name}</span>
        {/* Quantity — matches the title font; hidden when depleted (the OUT tag covers it). */}
        {item.quantity > 0 && (
          <span className="text-[10pt] text-tertiary tabular-nums shrink-0">{item.quantity}</span>
        )}
        {/* Warning tag + actions share one slot: tag rides on top, ellipsis swaps in on hover. */}
        {(warnLabel || hasActions) && (
          <div className="relative w-7 h-7 shrink-0">
            {warnLabel && (
              <span className={`absolute inset-0 flex items-center justify-center text-[8pt] font-semibold text-themeredred tabular-nums pointer-events-none transition-opacity ${hasActions ? 'group-hover:opacity-0' : ''}`}>
                {warnLabel}
              </span>
            )}
            {hasActions && (
              <button
                onClick={(e) => { e.stopPropagation(); openRowMenu('item', item.id, (e.currentTarget as HTMLElement).closest('[data-prop-row]') as HTMLElement | null) }}
                aria-label="More actions"
                className={warnLabel
                  ? 'absolute inset-0 w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                  : actionCls}
              >
                <MoreHorizontal size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderNode(node: TreeNode, depth: number) {
    const isMember = !!node.location.holder_user_id
    const hasChildren = node.children.length > 0 || node.items.length > 0
    // Searching force-expands so matches deep in the tree stay visible.
    const isCollapsed = !isSearching && collapsed.has(node.location.id)
    const isActive = activeLocationId === node.location.id

    return (
      <div key={node.location.id}>
        {/* Location row */}
        <div
          className={`group flex items-center gap-2 py-2 pr-6 transition-colors border-l-2 ${
            isActive
              ? 'bg-themeblue3/8 border-l-themeblue3'
              : 'hover:bg-secondary/5 border-l-transparent'
          }`}
          style={{ paddingLeft: `${16 + depth * 20}px` }}
          data-prop-row
          onContextMenu={!isMember ? (e) => { e.preventDefault(); e.stopPropagation(); if (onEditLocation || onDeleteLocation || onAddChildLocation || onAddItemAtLocation) openRowMenu('location', node.location.id, e.currentTarget as HTMLElement) } : undefined}
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
            {node.location.kind === 'vehicle' && (
              <DispatchDot status={dispatches.get(node.location.id)?.status} />
            )}
          </div>

          {/* Row actions — ellipsis menu */}
          {!isMember && (onEditLocation || onDeleteLocation || onAddChildLocation || onAddItemAtLocation) && (
            <button
              onClick={(e) => { e.stopPropagation(); openRowMenu('location', node.location.id, (e.currentTarget as HTMLElement).closest('[data-prop-row]') as HTMLElement | null) }}
              aria-label="More actions"
              className={actionBtnCls}
            >
              <MoreHorizontal size={15} />
            </button>
          )}
        </div>

        {/* Children + items when expanded */}
        {hasChildren && !isCollapsed && (
          <>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {node.items.map((item) => renderItemRow(item, depth + 1, actionBtnCls))}
          </>
        )}
      </div>
    )
  }

  // Show unassigned section when there are unassigned items.
  const showUnassigned = !rootId && displayUnassigned.length > 0

  return (
    <div className="flex flex-col py-1">
      {/* All Locations node */}
      {onSelectAll && !isSearching && (
        <div
          role="button"
          tabIndex={0}
          className={`flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer border-l-2 ${
            allSelected
              ? 'bg-themeblue3/8 border-l-themeblue3'
              : 'hover:bg-secondary/5 border-l-transparent'
          }`}
          style={{ paddingLeft: '16px' }}
          onClick={onSelectAll}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelectAll() }}
        >
          <span className="w-[18px] shrink-0" />
          <span className="text-[10pt] font-medium text-primary truncate">{clinicName || 'Cluster'}</span>
        </div>
      )}

      {displayMembers.map((node) => renderNode(node, 0))}
      {displayRoots.map((node) => renderNode(node, 0))}

      {/* Scoped mode: the selected zone's own direct items, as top-level rows */}
      {rootId && displayRootItems.map((item) => renderItemRow(item, 0, actionBtnCls))}

      {/* Unassigned items */}
      {showUnassigned && (
        <div>
          <div
            className="flex items-center gap-2 py-2 pr-6 transition-colors border-l-2 hover:bg-secondary/5 border-l-transparent"
            style={{ paddingLeft: '16px' }}
          >
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleCollapse('__unassigned__') }}
            >
              {collapsed.has('__unassigned__') ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
            <span className="text-[10pt] font-medium text-tertiary italic flex-1">Unassigned</span>
            <span className="text-[10pt] font-medium px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary shrink-0">
              {displayUnassigned.length}
            </span>
          </div>

          {(isSearching || !collapsed.has('__unassigned__')) && (
            <>
              {displayUnassigned.map((item) => renderItemRow(item, 1, 'w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0'))}
            </>
          )}
        </div>
      )}

      {/* Lifted row menu — ellipsis / right-click on location and item rows */}
      {contextMenu && (() => {
        if (contextMenu.kind === 'location') {
          const loc = locations.find(l => l.id === contextMenu.id)
          if (!loc || loc.holder_user_id) return null
          const menuItems: ContextMenuItem[] = [
            ...(onAddChildLocation ? [{ key: 'add-area', label: 'New Area', icon: FolderPlus, onAction: () => onAddChildLocation(loc.id) }] : []),
            ...(onAddLevel && isStructuralZone(loc) ? [{ key: 'add-level', label: 'Add level', icon: Layers, onAction: () => onAddLevel(loc.id) }] : []),
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
                <div className="flex items-center gap-2 px-3 py-2 bg-themewhite">
                  <FolderClosed size={16} className="text-tertiary shrink-0" />
                  <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">{loc.name}</span>
                </div>
              )}
            />
          )
        }
        const item = items.find(i => i.id === contextMenu.id)
        if (!item) return null
        const menuItems: ContextMenuItem[] = [
          { key: 'view', label: 'View', icon: Eye, onAction: () => onSelectItem(item) },
          ...(onEditItem ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditItem(item) }] : []),
          ...(onAddItemAtLocation ? [{ key: 'add-item', label: 'New Item', icon: PackagePlus, onAction: () => onAddItemAtLocation(item.location_id ?? null) }] : []),
          ...(onDeleteItem ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDeleteItem(item) }] : []),
        ]
        return (
          <LiftedRowMenu
            isOpen
            layout="list"
            anchorRect={contextMenu.rect}
            onClose={() => setContextMenu(null)}
            items={menuItems}
            row={(
              <div className="flex items-center gap-2 px-3 py-2 bg-themewhite">
                <span className="flex-1 min-w-0 text-[10pt] text-primary truncate">{item.name}</span>
              </div>
            )}
          />
        )
      })()}
    </div>
  )
}
