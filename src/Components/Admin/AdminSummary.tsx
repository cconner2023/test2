import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, AlertTriangle, Building2, Eye, Pencil, Trash2 } from 'lucide-react'
import { listClinics, listAllUsers, listLocations, deleteClinic, deleteUser } from '../../lib/adminService'
import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'
import { fetchAllSubClusters, type SubCluster } from '../../lib/subClusterService'
import { buildScopeIndex } from './adminScope'
import { useInvalidation, invalidate } from '../../stores/useInvalidationStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { formatLastActive, lastActiveColor } from './adminUtils'
import { useUserActions } from './useUserActions'
import { UI_TIMING } from '../../Utilities/constants'

interface AdminSummaryProps {
  onSelectClinic: (clinic: AdminClinic) => void
  onSelectUser: (user: AdminUser) => void
  onEditClinic: (clinic: AdminClinic) => void
  onEditUser: (user: AdminUser) => void
  /** Open an in-app system conversation with a user. Passed only for dev role;
   *  when absent the tree context menu omits the Chat action. */
  onChatUser?: (user: AdminUser) => void
  /** Empty-state action. A fresh org has nothing to browse, so the only useful
   *  move from here is to create the first cluster. */
  onCreateClinic: () => void
  /** Controlled search (owned by the drawer's directory SearchInput). A
   *  non-empty query REPLACES the tree with flat results — clusters matched on
   *  name or location, users on name/email/rank/UIC/cluster. */
  searchQuery?: string
  activeClinicId?: string | null
  activeUserId?: string | null
}

/** A user leaf matches on name, email, rank, UIC, or its cluster name. `q` is
 *  expected pre-trimmed and lowercased. */
const userMatches = (u: AdminUser, q: string) => {
  const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase()
  return name.includes(q)
    || (u.email ?? '').toLowerCase().includes(q)
    || (u.rank ?? '').toLowerCase().includes(q)
    || (u.uic ?? '').toLowerCase().includes(q)
    || (u.clinic_name ?? '').toLowerCase().includes(q)
}

// Tree node — the org IS the tree: a root cluster ⊃ child clusters ⊃ user leaves.
// `locationLabel` is the cluster's location shown as a chip (not a parent node),
// so a cluster in a different location than its parent reads honestly.
//
// `subUnits` is an intra-clinic render-only grouping layer (platoon/squad) that
// sits BETWEEN a cluster and its direct users: when a clinic has sub-units, its
// roster nests under sub-unit grouping nodes, and `users` holds only the HQ /
// ungrouped remainder. Sub-units are NOT access boundaries and have no detail
// pane — their rows only expand/collapse. See Utilities/subCluster.ts.
type SubUnitNode = { id: string; name: string; users: AdminUser[] }
type TreeNode =
  { kind: 'clinic'; id: string; label: string; clinic: AdminClinic; children: TreeNode[]; subUnits: SubUnitNode[]; users: AdminUser[]; locationLabel: string | null }

/**
 * The Directory tree — the admin drawer's MAIN content list. An ORG-rooted
 * cluster ⊃ sub-cluster ⊃ user containment forest with selectable user leaves;
 * each cluster shows its location as a chip. Tapping a node opens its detail;
 * long-press/right-click opens View/Edit/(Delete) actions. Locations are managed
 * in the Settings sheet, not here; triage queues live in the inbox rail
 * (AdminSortRail) — this is purely the browsable tree.
 */
export function AdminSummary({
  onSelectClinic,
  onSelectUser,
  onEditClinic,
  onEditUser,
  onChatUser,
  onCreateClinic,
  searchQuery,
  activeClinicId,
  activeUserId,
}: AdminSummaryProps) {
  const gen = useInvalidation('users', 'clinics', 'locations', 'subClusters')
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [locations, setLocations] = useState<AdminLocation[]>([])
  const [subClusters, setSubClusters] = useState<SubCluster[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Lifted-clone context menu (right-click / long-press) + delete flow.
  const [contextMenu, setContextMenu] = useState<{ kind: 'clinic' | 'user'; id: string; rect: DOMRect; clone: ReactNode } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'clinic' | 'user'; id: string; label: string } | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const preventTap = useRef(false)

  // Shared user action menu — identical items to AdminUserDetail's corner menu
  // (parity by construction). onOpenConversation adapts the tree's user-shaped
  // onChatUser to the hook's userId-shaped callback.
  const currentUserId = useAuthStore(s => s.user?.id ?? null)
  const { buildItems: buildUserMenuItems, overlays: userActionOverlays } = useUserActions({
    currentUserId,
    onOpenConversation: onChatUser
      ? (userId) => { const u = users.find(x => x.id === userId); if (u) onChatUser(u) }
      : undefined,
  })

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }, [])

  const openClinicMenu = useCallback((clinic: AdminClinic, el: HTMLElement) => {
    setContextMenu({
      kind: 'clinic',
      id: clinic.id,
      rect: el.getBoundingClientRect(),
      clone: (
        <div className="bg-themewhite px-4 py-2.5 flex items-center gap-2">
          <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">{clinic.name}</span>
        </div>
      ),
    })
  }, [])

  const openUserMenu = useCallback((user: AdminUser, el: HTMLElement) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'user'
    setContextMenu({
      kind: 'user',
      id: user.id,
      rect: el.getBoundingClientRect(),
      clone: (
        <div className="bg-themewhite px-3 py-2 flex items-center gap-2">
          <span className="flex-1 min-w-0 text-[10pt] text-primary truncate">{name}</span>
        </div>
      ),
    })
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDelete) return
    const { kind, id, label } = confirmDelete
    setDeleteProcessing(true)
    const result = kind === 'clinic' ? await deleteClinic(id) : await deleteUser(id)
    setDeleteProcessing(false)
    setConfirmDelete(null)
    if (result.success) {
      setNotify({ type: 'success', message: `Deleted ${label}.` })
      if (kind === 'clinic') invalidate('clinics', 'users')
      else invalidate('users', 'clinics', 'requests')
    } else {
      setNotify({ type: 'error', message: result.error || `Failed to delete ${label}` })
    }
  }, [confirmDelete])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [clinicData, userData, locationData, subClusterRes] = await Promise.all([
      listClinics(),
      listAllUsers(),
      listLocations(),
      fetchAllSubClusters(),
    ])
    setClinics(clinicData)
    setUsers(userData)
    setLocations(locationData)
    setSubClusters(subClusterRes.ok ? subClusterRes.data : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData, gen])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const index = useMemo(() => buildScopeIndex(clinics), [clinics])

  const locationsById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations])

  /** clinic_id → its sub-units (platoon/squad), in fetch (name) order. */
  const subClustersByClinic = useMemo(() => {
    const map = new Map<string, SubCluster[]>()
    for (const sc of subClusters) {
      const arr = map.get(sc.clinic_id)
      if (arr) arr.push(sc)
      else map.set(sc.clinic_id, [sc])
    }
    return map
  }, [subClusters])

  /** clinic_id → its assigned users (sorted), for the user leaves. */
  const usersByClinicList = useMemo(() => {
    const map = new Map<string, AdminUser[]>()
    for (const user of users) {
      if (!user.clinic_id) continue
      const arr = map.get(user.clinic_id) ?? []
      arr.push(user)
      map.set(user.clinic_id, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const na = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim()
        const nb = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim()
        return na.localeCompare(nb)
      })
    }
    return map
  }, [users])

  const unassignedUsers = useMemo(
    () => users.filter(u => !u.clinic_id).sort((a, b) => {
      const nameA = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim()
      const nameB = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim()
      return nameA.localeCompare(nameB)
    }),
    [users],
  )
  const [showUnassigned, setShowUnassigned] = useState(false)

  const q = (searchQuery ?? '').trim().toLowerCase()

  // Build the org-rooted node forest (root cluster ⊃ sub-clusters ⊃ user leaves).
  // Location is resolved to a chip label per cluster, not a parent node. The chip
  // shows on roots, and on sub-clusters ONLY when their location differs from the
  // parent's — surfacing exactly the "org in a different location than its parent"
  // case without spamming a chip on every same-location descendant.
  const roots = useMemo(() => {
    const clinicNode = (clinic: AdminClinic, parentLocId: string | null): TreeNode => {
      const ownLocId = clinic.location_id ?? null
      const children = (index.clinicChildren.get(clinic.id) ?? []).map(c => clinicNode(c, ownLocId))
      const loc = ownLocId ? locationsById.get(ownLocId) : undefined
      const showChip = !!loc && ownLocId !== parentLocId

      // Sub-unit grouping: when this clinic has sub-units, nest its roster under
      // them. Every sub-unit renders (even empty) so the structure is visible;
      // members with no — or a now-deleted — sub_cluster_id stay as HQ leaves
      // directly under the clinic. No sub-units → flat roster (subUnits = []).
      const clinicUsers = usersByClinicList.get(clinic.id) ?? []
      const units = subClustersByClinic.get(clinic.id) ?? []
      let subUnits: SubUnitNode[] = []
      let directUsers = clinicUsers
      if (units.length > 0) {
        const known = new Set(units.map(u => u.id))
        const byUnit = new Map<string, AdminUser[]>()
        const hq: AdminUser[] = []
        for (const u of clinicUsers) {
          if (u.sub_cluster_id && known.has(u.sub_cluster_id)) {
            const arr = byUnit.get(u.sub_cluster_id)
            if (arr) arr.push(u)
            else byUnit.set(u.sub_cluster_id, [u])
          } else hq.push(u)
        }
        subUnits = units.map(u => ({ id: u.id, name: u.name, users: byUnit.get(u.id) ?? [] }))
        directUsers = hq
      }

      return {
        kind: 'clinic',
        id: clinic.id,
        label: clinic.name,
        clinic,
        children,
        subUnits,
        users: directUsers,
        locationLabel: showChip ? loc!.display_name : null,
      }
    }
    return index.rootClinics.map(c => clinicNode(c, null))
  }, [index, usersByClinicList, locationsById, subClustersByClinic])

  // Search is DISCRETE ITEMS, not a filtered tree — a query flattens the org
  // into the flat set of clusters + users that match, so "find a person/cluster
  // fast" doesn't make you read a force-expanded hierarchy.
  //
  // Consequently the TREE ONLY RENDERS WHEN q IS EMPTY, and `roots` /
  // `unassignedUsers` are already the unfiltered sets — which is why there is no
  // filtered-tree memo here. There used to be one (plus a filtered-unassigned
  // one); both became unreachable when search went flat, and they kept
  // recomputing a discarded tree on every keystroke.
  const flatResults = useMemo(() => {
    if (!q) return null
    const clinicMatches = (c: AdminClinic) => {
      const loc = c.location_id ? (locationsById.get(c.location_id)?.display_name ?? '') : ''
      return c.name.toLowerCase().includes(q) || loc.toLowerCase().includes(q)
    }
    const matchedClinics = clinics
      .filter(clinicMatches)
      .sort((a, b) => a.name.localeCompare(b.name))
    const matchedUsers = users
      .filter(u => userMatches(u, q))
      .sort((a, b) => {
        const na = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim()
        const nb = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim()
        return na.localeCompare(nb)
      })
    return { matchedClinics, matchedUsers }
  }, [q, clinics, users, locationsById])

  // ── Row renderers ───────────────────────────────────────────────────────
  function renderUserLeaf(user: AdminUser, depth: number) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
    return (
      <button
        key={user.id}
        onClick={() => { if (preventTap.current) { preventTap.current = false; return } onSelectUser(user) }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openUserMenu(user, e.currentTarget as HTMLElement) }}
        onTouchStart={(e) => { const el = e.currentTarget as HTMLElement; preventTap.current = false; longPressTimer.current = window.setTimeout(() => { preventTap.current = true; openUserMenu(user, el) }, 500) }}
        onTouchEnd={clearLongPress}
        onTouchMove={clearLongPress}
        style={{ paddingLeft: `${16 + depth * 16}px` }}
        className={`flex items-center gap-2 w-full py-1.5 pr-4 text-left cursor-pointer transition-all active:scale-[0.98] ${
          activeUserId === user.id ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3' : 'hover:bg-secondary/5'
        }`}
      >
        {/* No avatar icon — a last-on dot stands in for presence. Its title
            surfaces the relative time; UIC trails the name. */}
        <span className="w-[18px] shrink-0" />
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${lastActiveColor(user.last_active_at)}`}
          title={`Last active: ${formatLastActive(user.last_active_at)}`}
        />
        <span className="flex-1 min-w-0 text-[9.5pt] text-primary truncate">{name}</span>
        {user.uic && (
          <span className="text-[8pt] font-medium text-tertiary tabular-nums shrink-0">{user.uic}</span>
        )}
      </button>
    )
  }

  // Sub-unit (platoon/squad) grouping row — a render-only node with no detail
  // pane, so the whole row just expands/collapses to reveal its member leaves.
  function renderSubUnit(su: SubUnitNode, depth: number) {
    const expandable = su.users.length > 0
    const isCollapsed = expandable && collapsed.has(su.id)
    return (
      <div key={su.id}>
        <div
          className="flex items-center gap-2 py-1.5 pr-4 cursor-pointer transition-all active:scale-[0.98] hover:bg-secondary/5"
          style={{ paddingLeft: `${16 + depth * 16}px` }}
          onClick={() => { if (expandable) toggleCollapse(su.id) }}
          role={expandable ? 'button' : undefined}
          aria-expanded={expandable ? !isCollapsed : undefined}
        >
          {expandable ? (
            <span className="p-0.5 text-tertiary shrink-0">
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <span className="flex-1 min-w-0 text-[9.5pt] font-medium text-secondary truncate">{su.name}</span>
        </div>
        {expandable && !isCollapsed && su.users.map(u => renderUserLeaf(u, depth + 1))}
      </div>
    )
  }

  // Flat cluster row — the search-results counterpart to a tree node (no
  // chevron, no children). Same select + long-press/right-click menu as the tree.
  function renderClusterRow(clinic: AdminClinic) {
    const loc = clinic.location_id ? locationsById.get(clinic.location_id) : undefined
    const isActive = activeClinicId === clinic.id
    return (
      <button
        key={clinic.id}
        onClick={() => { if (preventTap.current) { preventTap.current = false; return } onSelectClinic(clinic) }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openClinicMenu(clinic, e.currentTarget as HTMLElement) }}
        onTouchStart={(e) => { const el = e.currentTarget as HTMLElement; preventTap.current = false; longPressTimer.current = window.setTimeout(() => { preventTap.current = true; openClinicMenu(clinic, el) }, 500) }}
        onTouchEnd={clearLongPress}
        onTouchMove={clearLongPress}
        className={`flex items-center gap-2 w-full py-2 pl-4 pr-4 text-left cursor-pointer transition-all active:scale-[0.98] ${
          isActive ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3' : 'hover:bg-secondary/5'
        }`}
      >
        <Building2 size={14} className="text-tertiary shrink-0" />
        <span className="text-[10pt] font-medium text-primary truncate">{clinic.name}</span>
        {loc && (
          <span className="inline-flex items-center text-[8.5pt] text-themeblue2 bg-themeblue2/10 rounded-full px-1.5 py-0.5 shrink min-w-0 max-w-[45%]">
            <span className="truncate">{loc.display_name}</span>
          </span>
        )}
      </button>
    )
  }

  function renderNode(node: TreeNode, depth: number) {
    // A cluster expands if it has sub-units, child clusters, or user leaves.
    // No search fork: the tree renders only when there is no query.
    const hasUsers = node.users.length > 0
    const expandable = node.children.length > 0 || node.subUnits.length > 0 || hasUsers
    const isCollapsed = expandable && collapsed.has(node.id)
    const isActive = activeClinicId === node.id

    const selectNode = () => {
      if (preventTap.current) { preventTap.current = false; return }
      onSelectClinic(node.clinic)
    }
    const openMenu = (el: HTMLElement) => openClinicMenu(node.clinic, el)

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 py-2 pr-4 cursor-pointer transition-all active:scale-[0.98] ${
            isActive ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3' : 'hover:bg-secondary/5'
          }`}
          style={{ paddingLeft: `${16 + depth * 16}px` }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(e.currentTarget as HTMLElement) }}
          onTouchStart={(e) => { const el = e.currentTarget as HTMLElement; preventTap.current = false; longPressTimer.current = window.setTimeout(() => { preventTap.current = true; openMenu(el) }, 500) }}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
        >
          {expandable ? (
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.label}`}
              aria-expanded={!isCollapsed}
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id) }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}

          <div
            role="button"
            tabIndex={0}
            aria-label={`Select ${node.label}`}
            className="flex items-center gap-1.5 flex-1 min-w-0"
            onClick={selectNode}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectNode() } }}
          >
            <span className="text-[10pt] font-medium text-primary truncate">{node.label}</span>
            {node.locationLabel && (
              <span className="inline-flex items-center text-[8.5pt] text-themeblue2 bg-themeblue2/10 rounded-full px-1.5 py-0.5 shrink min-w-0 max-w-[45%]">
                <span className="truncate">{node.locationLabel}</span>
              </span>
            )}
          </div>
        </div>

        {expandable && !isCollapsed && (
          <>
            {node.subUnits.map(su => renderSubUnit(su, depth + 1))}
            {hasUsers && node.users.map(u => renderUserLeaf(u, depth + 1))}
            {node.children.map(child => renderNode(child, depth + 1))}
          </>
        )}
      </div>
    )
  }

  // No load treatment: the tree refetches on every invalidation (each save or
  // delete bumps the generation), so an overlay HUD fired on every mutation.
  // `loading` only suppresses the empty state until the first fetch lands.
  if (!loading && clinics.length === 0 && users.length === 0) {
    return (
      <div className="px-4 py-4">
        <EmptyState
          title="No clusters or users yet"
          action={{ icon: Building2, label: 'New cluster', onClick: onCreateClinic }}
        />
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* pb clears the bottom island that floats over the center pane. */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* flatResults is non-null exactly when there is a query, so it doubles
            as the "are we searching" switch. */}
        {flatResults ? (
          // Discrete search results — flat clusters + users, not a filtered tree.
          flatResults.matchedClinics.length > 0 || flatResults.matchedUsers.length > 0 ? (
            <>
              {flatResults.matchedClinics.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-[9pt] font-semibold uppercase tracking-wider text-tertiary">Clusters</p>
                  {flatResults.matchedClinics.map(renderClusterRow)}
                </>
              )}
              {flatResults.matchedUsers.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-[9pt] font-semibold uppercase tracking-wider text-tertiary">Users</p>
                  {flatResults.matchedUsers.map(u => renderUserLeaf(u, 0))}
                </>
              )}
            </>
          ) : (
            <p className="px-4 py-6 text-center text-[10pt] text-tertiary">No matches</p>
          )
        ) : (
          <>
            {roots.map(node => renderNode(node, 0))}

            {/* Unassigned users — an expandable inline block of selectable leaves. */}
            {unassignedUsers.length > 0 && (
              <div>
                <button
                  onClick={() => setShowUnassigned(!showUnassigned)}
                  aria-expanded={showUnassigned}
                  aria-label={`${showUnassigned ? 'Collapse' : 'Expand'} unassigned users`}
                  className="flex items-center gap-2 w-full py-2 pr-4 text-left cursor-pointer transition-all active:scale-[0.98] hover:bg-secondary/5"
                  style={{ paddingLeft: '16px' }}
                >
                  <span className="p-0.5 text-tertiary shrink-0">
                    {showUnassigned ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <AlertTriangle size={14} className="text-themeredred shrink-0" />
                  <span className="text-[10pt] font-medium text-themeredred flex-1">Unassigned</span>
                </button>
                {showUnassigned && unassignedUsers.map(u => renderUserLeaf(u, 1))}
              </div>
            )}
          </>
        )}
      </div>

      {contextMenu && (() => {
        let items: ContextMenuItem[] = []
        if (contextMenu.kind === 'clinic') {
          const clinic = clinics.find(c => c.id === contextMenu.id)
          if (!clinic) return null
          items = [
            { key: 'view', label: 'View', icon: Eye, onAction: () => onSelectClinic(clinic) },
            { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditClinic(clinic) },
            { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDelete({ kind: 'clinic', id: clinic.id, label: clinic.name }) },
          ]
        } else {
          const user = users.find(u => u.id === contextMenu.id)
          if (!user) return null
          const label = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'user'
          // Same items as the user detail's corner menu (View/Edit/Delete are the
          // tree's list-nav extras; the reset-pw popover anchors to the row rect).
          items = buildUserMenuItems(user, {
            resetAnchor: () => contextMenu.rect,
            onView: onSelectUser,
            onEdit: onEditUser,
            onDelete: (u) => setConfirmDelete({ kind: 'user', id: u.id, label }),
          })
          if (items.length === 0) return null
        }
        return (
          <LiftedRowMenu
            isOpen
            layout="list"
            anchorRect={contextMenu.rect}
            onClose={() => setContextMenu(null)}
            items={items}
            row={contextMenu.clone}
          />
        )
      })()}

      {/* Reset-password popover + force-logout / vault / notify dialogs, shared
          verbatim with the user detail so both menus behave identically. */}
      {userActionOverlays}

      <ConfirmDialog
        visible={!!confirmDelete}
        title={`Delete ${confirmDelete?.label ?? ''}?`}
        subtitle="Permanent."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        visible={!!notify}
        title={notify?.message ?? ''}
        variant={notify?.type === 'success' ? 'success' : 'danger'}
        notifyOnly
        autoDismissMs={UI_TIMING.FEEDBACK_DURATION}
        onCancel={() => setNotify(null)}
      />
    </div>
  )
}
