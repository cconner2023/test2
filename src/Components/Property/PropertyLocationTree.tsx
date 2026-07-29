import { useState, useMemo, useCallback } from 'react'
import { ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react'
import type { LocalPropertyLocation, LocalPropertyItem, HolderInfo } from '../../Types/PropertyTypes'
import { itemAlert } from '../../Types/PropertyTypes'
import { itemPassesLens, itemIsMine } from '../../Utilities/subCluster'
import { isLinContainer, isAuthTarget, isZoneShadow } from '../../Utilities/propertyAuthorized'

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
   *  (`owner_user_id`), HOLDS by custody (`current_holder_id`), or STORES in their
   *  member-zone (`myZoneIds`), plus the zones on their path. */
  mineOnly?: boolean
  /** The viewer's user id — needed to evaluate the "My property" filter. */
  currentUserId?: string | null
  /** The viewer's member-zone location ids (self + descendants), from
   *  `collectHolderZoneIds`. Items placed in these zones count as "mine". */
  myZoneIds?: Set<string> | null
  /** Pre-resolved sub-cluster (platoon/squad) lens: an array narrows the tree to
   *  items in those sub-clusters (HQ/common items always pass); null/undefined =
   *  no narrowing. Render-only; see Utilities/subCluster.ts + v2/supervisor. */
  subClusterLens?: string[] | null
  /** Viewer's PRIMARY clinic id — the squad lens only narrows items in this clinic;
   *  cross-cluster (followed) items bypass it. */
  primaryClinicId?: string | null
  /** Open the shared item action menu (View · Edit · Split/Merge · Expend · … ·
   *  Delete) anchored to the row — the panel hosts the menu + its sheets. */
  onOpenItemMenu?: (item: LocalPropertyItem, rect: DOMRect) => void
  /** Open the shared zone action menu (Edit · PMCS · DD 1750 · New item · … ·
   *  Delete) anchored to a location row — the panel hosts the menu + its overlays.
   *  This is the sole gate for a row's ellipsis / right-click menu. */
  onOpenLocationMenu?: (loc: LocalPropertyLocation, rect: DOMRect) => void
}

interface TreeNode {
  location: LocalPropertyLocation
  children: TreeNode[]
  items: LocalPropertyItem[]
}

export function PropertyLocationTree({
  locations,
  items: itemsRaw,
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
  myZoneIds,
  subClusterLens,
  primaryClinicId,
  onOpenItemMenu,
  onOpenLocationMenu,
}: PropertyLocationTreeProps) {
  // LIN containers are PHR headers, never discrete placeable property — exclude them from
  // every tree surface (main rail, Locations sheet, and the scoped location detail, which is
  // fed the unfiltered store items). Also keeps a component's LIN parent out of `presentIds`,
  // so the component renders at its own location instead of nesting under an absent header.
  const items = useMemo(() => itemsRaw.filter((i) => !isLinContainer(i) && !isAuthTarget(i) && !isZoneShadow(i)), [itemsRaw])

  // Personnel starts collapsed so a large roster doesn't bury the physical zones.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['__personnel__']))
  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Row indentation — condensed base + per-level step, CAPPED at 3 levels deep: beyond
  // depth 2 rows stop indenting visually (deep SKO/vehicle/zone nesting would otherwise
  // march off the left rail and starve the label width). Chevron + collapse still convey
  // hierarchy past the cap. Paired with the tighter py-1.5 row padding below.
  const rowPadLeft = (depth: number) => 12 + Math.min(depth, 2) * 16

  const { roots, unassignedItems, memberNodes, rootItems } = useMemo(() => {
    const childrenMap = new Map<string | null, LocalPropertyLocation[]>()
    for (const loc of locations) {
      const key = loc.parent_id ?? null
      const arr = childrenMap.get(key)
      if (arr) arr.push(loc)
      else childrenMap.set(key, [loc])
    }

    // An item nests under its parent (and so is omitted here) ONLY when that parent is
    // itself present in the tree — a real, placed SKO kit. A component whose parent is
    // absent (a PHR LIN header, filtered out of the canvas/tree; or an orphan) is a
    // standalone placeable item and renders at its own location.
    const presentIds = new Set(items.map((i) => i.id))
    const isNested = (i: LocalPropertyItem) => !!i.parent_item_id && presentIds.has(i.parent_item_id)

    const itemsByLocation = new Map<string | null, LocalPropertyItem[]>()
    for (const item of items) {
      if (isNested(item)) continue
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

    // Physical root locations = no parent AND no holder_user_id. The turn-in staging zone
    // is a standing root but CONDITIONALLY RENDERED: hide it unless it currently holds
    // staged items (like a personnel zone — it only appears when populated).
    //
    // Turn-in is PINNED to the bottom of the root list rather than sorted by name: it is a
    // system staging bucket, not a place anyone stores property, so a newly added zone must
    // never land underneath it just because its name sorts after "Pending Turn-In". Mirrors
    // the canvas, where the zone rides the reserved bottom band.
    const rootLocations = locations
      .filter(l => !l.holder_user_id && (l.parent_id ?? null) === null)
      .sort((a, b) => {
        if (!!a.is_turn_in_zone !== !!b.is_turn_in_zone) return a.is_turn_in_zone ? 1 : -1
        return a.name.localeCompare(b.name)
      })
    const roots = rootLocations
      .map(buildNode)
      .filter(n => !(n.location.is_turn_in_zone && n.children.length === 0 && n.items.length === 0))

    // Unassigned = no location at all (and not nested under a present kit — a LIN's
    // unplaced component is a real standalone item that belongs here, not hidden).
    const unassignedItems = items
      .filter(i => !isNested(i) && !i.location_id)
      .sort((a, b) => a.name.localeCompare(b.name))

    return { roots, unassignedItems, memberNodes, rootItems: [] as LocalPropertyItem[] }
  }, [locations, items, rootId])

  // Search filter — when a query is present, prune the tree to matching items /
  // locations (a matching location keeps its whole subtree; otherwise keep only
  // matching descendants). Mirrors PropertySearchOverlay's match fields.
  const q = (searchQuery ?? '').trim().toLowerCase()
  const isSearching = q.length > 0
  const mineActive = !!currentUserId && !!mineOnly
  // Sub-cluster (platoon/squad) lens: an array narrows; null/undefined = show all.
  const subActive = Array.isArray(subClusterLens)
  const { displayRoots, displayMembers, displayUnassigned, displayRootItems } = useMemo(() => {
    if (!isSearching && !mineActive && !subActive) return { displayRoots: roots, displayMembers: memberNodes, displayUnassigned: unassignedItems, displayRootItems: rootItems }

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
    // "My property" = owned by the viewer (owner_user_id), held via custody
    // (current_holder_id), OR stored in the viewer's member-zone (myZoneIds).
    // Shared with displayItems via itemIsMine so tree + map can't drift.
    const isMine = (i: LocalPropertyItem) => itemIsMine(i, { currentUserId, myZoneIds })
    // Squad lens — shared with the map canvas via itemPassesLens so the two surfaces
    // can't drift. Cross-cluster (foreign clinic_id), viewer-owned/held, and HQ/common
    // (sub_cluster_id == null) items always bypass; null lens = no narrowing.
    const inSubLens = (i: LocalPropertyItem) =>
      itemPassesLens(i, { lens: subClusterLens, primaryClinicId, currentUserId })
    // Staged turn-in stock is a clinic-wide operational state, not squad property — it
    // bypasses the mine/sub narrowings so the (system) Pending Turn-In zone never empties
    // out from under the viewer (the authorized-split clone loses its owner_user_id bypass).
    // Search still applies. Mirrors PropertyPanel.displayItems + the unfiltered turn-in list.
    const turnInZoneIds = new Set(locations.filter(l => l.is_turn_in_zone).map(l => l.id))
    const atTurnIn = (i: LocalPropertyItem) => i.location_id != null && turnInZoneIds.has(i.location_id)
    const showItem = (i: LocalPropertyItem) =>
      (!isSearching || matchesSearch(i)) && (atTurnIn(i) || ((!mineActive || isMine(i)) && inSubLens(i)))

    const filterNode = (node: TreeNode): TreeNode | null => {
      // A location NAME hit keeps its whole subtree — but ONLY for a pure search. The
      // "Mine" filter must never surface items the viewer doesn't own/hold just because
      // a zone name matched, so the shortcut is disabled when mineActive.
      if (isSearching && !mineActive && !subActive && node.location.name.toLowerCase().includes(q)) return node
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
  }, [isSearching, mineActive, subActive, subClusterLens, primaryClinicId, currentUserId, myZoneIds, q, roots, memberNodes, unassignedItems, rootItems, locations, holders])

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
    // Expired/depleted → red (already a problem); expiring (≤30d) → yellow (still time to
    // act). Mirrors PropertyItemDetail's EXPIRY_LABELS split so tree and detail agree —
    // the old unified-red hid "about to go" vs "already went" from the user.
    const alert = itemAlert(item)
    const isSoon = alert === 'expiring'
    const rowAlertCls = alert
      ? isSoon
        ? 'bg-themeyellow/[0.06] border-l-themeyellow/60'
        : 'bg-themeredred/[0.06] border-l-themeredred/60'
      : 'border-l-transparent hover:bg-secondary/5'
    const alertTextCls = isSoon ? 'text-themeyellow' : 'text-themeredred'
    const alertDotCls = isSoon ? 'bg-themeyellow' : 'bg-themeredred'
    // Compact warning tag riding the action slot: DEP when depleted, EXP when expiry-flagged.
    const warnLabel = alert === 'depleted' ? 'DEP' : alert ? 'EXP' : null
    const hasActions = !!onOpenItemMenu
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        className={`group flex items-center gap-2 w-full py-1.5 pr-6 transition-colors text-left cursor-pointer border-l-2 ${rowAlertCls}`}
        style={{ paddingLeft: `${rowPadLeft(depth)}px` }}
        data-prop-row
        onClick={() => onSelectItem(item)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelectItem(item) }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onOpenItemMenu?.(item, (e.currentTarget as HTMLElement).getBoundingClientRect()) }}
      >
        {/* Alert indicator sits in the chevron slot so item names line up with sibling locations. */}
        <span className="w-[18px] shrink-0 flex items-center justify-center">
          {alert && <span className={`w-1.5 h-1.5 rounded-full ${alertDotCls}`} />}
        </span>
        {/* Name over a secondary serial line — a bare name is ambiguous in the tree when
            two items share it; the serial pins down exactly which physical item this row is. */}
        <div className="flex-1 min-w-0">
          <div className={`text-[10pt] truncate ${alert ? `${alertTextCls} font-medium` : 'text-primary'}`}>{item.name}</div>
          {item.serial_number && (
            <div className="text-[8pt] text-tertiary truncate tabular-nums">SN {item.serial_number}</div>
          )}
        </div>
        {/* Quantity — matches the title font; hidden when depleted (the OUT tag covers it). */}
        {item.quantity > 0 && (
          <span className="text-[10pt] text-tertiary tabular-nums shrink-0">{item.quantity}</span>
        )}
        {/* Warning tag + actions share one slot: tag rides on top, ellipsis swaps in on hover. */}
        {(warnLabel || hasActions) && (
          <div className="relative w-7 h-7 shrink-0">
            {warnLabel && (
              <span className={`absolute inset-0 flex items-center justify-center text-[8pt] font-semibold ${alertTextCls} tabular-nums pointer-events-none transition-opacity ${hasActions ? 'group-hover:opacity-0' : ''}`}>
                {warnLabel}
              </span>
            )}
            {hasActions && (
              <button
                onClick={(e) => { e.stopPropagation(); const row = (e.currentTarget as HTMLElement).closest('[data-prop-row]') as HTMLElement | null; if (row) onOpenItemMenu?.(item, row.getBoundingClientRect()) }}
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
    // The turn-in staging zone is system-managed — no row actions / context menu.
    const isSystemZone = !!node.location.is_turn_in_zone
    const hasChildren = node.children.length > 0 || node.items.length > 0
    // Searching force-expands so matches deep in the tree stay visible.
    const isCollapsed = !isSearching && collapsed.has(node.location.id)
    const isActive = activeLocationId === node.location.id

    return (
      <div key={node.location.id}>
        {/* Location row */}
        <div
          className={`group flex items-center gap-2 py-1.5 pr-6 transition-colors border-l-2 ${
            isActive
              ? 'bg-themeblue3/8 border-l-themeblue3'
              : 'hover:bg-secondary/5 border-l-transparent'
          }`}
          style={{ paddingLeft: `${rowPadLeft(depth)}px` }}
          data-prop-row
          onContextMenu={!isMember && !isSystemZone && onOpenLocationMenu ? (e) => { e.preventDefault(); e.stopPropagation(); onOpenLocationMenu(node.location, (e.currentTarget as HTMLElement).getBoundingClientRect()) } : undefined}
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

          {/* Row actions — ellipsis menu */}
          {!isMember && !isSystemZone && onOpenLocationMenu && (
            <button
              onClick={(e) => { e.stopPropagation(); const row = (e.currentTarget as HTMLElement).closest('[data-prop-row]') as HTMLElement | null; if (row) onOpenLocationMenu(node.location, row.getBoundingClientRect()) }}
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
          className={`flex items-center gap-2 py-1.5 pr-6 transition-colors cursor-pointer border-l-2 ${
            allSelected
              ? 'bg-themeblue3/8 border-l-themeblue3'
              : 'hover:bg-secondary/5 border-l-transparent'
          }`}
          style={{ paddingLeft: `${rowPadLeft(0)}px` }}
          onClick={onSelectAll}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelectAll() }}
        >
          <span className="w-[18px] shrink-0" />
          <span className="text-[10pt] font-medium text-primary truncate">{clinicName || 'Cluster'}</span>
        </div>
      )}

      {/* Personnel zones — grouped under one collapsible node (default collapsed) so a
          large roster doesn't bury the physical zones or force endless scrolling. Sits ABOVE
          the committed/physical zones (personnel render above them on the canvas too). Not in
          scoped mode. Search force-expands it (like Unassigned) to reveal matches. */}
      {!rootId && displayMembers.length > 0 && (
        <div>
          <div
            className="flex items-center gap-2 py-1.5 pr-6 transition-colors border-l-2 hover:bg-secondary/5 border-l-transparent"
            style={{ paddingLeft: `${rowPadLeft(0)}px` }}
          >
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleCollapse('__personnel__') }}
            >
              {collapsed.has('__personnel__') ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
            <span className="text-[10pt] font-medium text-primary truncate flex-1">Personnel</span>
          </div>

          {(isSearching || !collapsed.has('__personnel__')) && (
            <>
              {displayMembers.map((node) => renderNode(node, 1))}
            </>
          )}
        </div>
      )}

      {displayRoots.map((node) => renderNode(node, 0))}

      {/* Scoped mode: the selected zone's own direct items, as top-level rows */}
      {rootId && displayRootItems.map((item) => renderItemRow(item, 0, actionBtnCls))}

      {/* Unassigned items */}
      {showUnassigned && (
        <div>
          <div
            className="flex items-center gap-2 py-1.5 pr-6 transition-colors border-l-2 hover:bg-secondary/5 border-l-transparent"
            style={{ paddingLeft: `${rowPadLeft(0)}px` }}
          >
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleCollapse('__unassigned__') }}
            >
              {collapsed.has('__unassigned__') ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
            <span className="text-[10pt] font-medium text-tertiary italic flex-1">Unassigned</span>
          </div>

          {(isSearching || !collapsed.has('__unassigned__')) && (
            <>
              {displayUnassigned.map((item) => renderItemRow(item, 1, 'w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0'))}
            </>
          )}
        </div>
      )}

    </div>
  )
}
