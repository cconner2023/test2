import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, AlertTriangle, Building2, Eye, Pencil, Trash2 } from 'lucide-react'
import { listClinics, listAllUsers, listLocations, deleteClinic, deleteUser } from '../../lib/adminService'
import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'
import { fetchAllSubClusters, type SubCluster } from '../../lib/subClusterService'
import { buildScopeIndex } from './adminScope'
import { useInvalidation, invalidate } from '../../stores/useInvalidationStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { LoadingOverlay } from '../LoadingOverlay'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { EmptyState } from '../EmptyState'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
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
  /** Empty-state fallback action. */
  onSelectAll: () => void
  /** Controlled search (shared with the drawer's SearchInput). Filters the tree
   *  by cluster name, its location chip, and member name/email; matches
   *  force-expand. */
  searchQuery?: string
  activeClinicId?: string | null
  activeUserId?: string | null
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
  { kind: 'clinic'; id: string; label: string; clinic: AdminClinic; children: TreeNode[]; subUnits: SubUnitNode[]; users: AdminUser[]; count: number; locationLabel: string | null }

/**
 * The Directory tree — the admin drawer's MAIN content list. An ORG-rooted
 * cluster ⊃ sub-cluster ⊃ user containment forest with selectable user leaves;
 * each cluster shows its location as a chip. Tapping a node opens its detail;
 * long-press/right-click opens View/Edit/(Delete) actions. Locations are managed
 * in the Settings sheet, not here. Stats + triage queues live in the sort rail
 * (AdminSortRail) — this is purely the browsable tree.
 */
export function AdminSummary({
  onSelectClinic,
  onSelectUser,
  onEditClinic,
  onEditUser,
  onChatUser,
  onSelectAll,
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

  const index = useMemo(() => buildScopeIndex(clinics, locations), [clinics, locations])

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

  const usersByClinic = useMemo(() => {
    const map = new Map<string, number>()
    for (const user of users) {
      if (!user.clinic_id) continue
      map.set(user.clinic_id, (map.get(user.clinic_id) ?? 0) + 1)
    }
    return map
  }, [users])

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
  const searching = q.length > 0

  // Build the org-rooted node forest (root cluster ⊃ sub-clusters ⊃ user leaves).
  // Location is resolved to a chip label per cluster, not a parent node. The chip
  // shows on roots, and on sub-clusters ONLY when their location differs from the
  // parent's — surfacing exactly the "org in a different location than its parent"
  // case without spamming a chip on every same-location descendant.
  const roots = useMemo(() => {
    const clinicNode = (clinic: AdminClinic, parentLocId: string | null): TreeNode => {
      const ownLocId = clinic.location_id ?? null
      const children = (index.clinicChildren.get(clinic.id) ?? []).map(c => clinicNode(c, ownLocId))
      const childCount = children.reduce((s, n) => s + n.count, 0)
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
        count: (usersByClinic.get(clinic.id) ?? 0) + childCount,
        locationLabel: showChip ? loc!.display_name : null,
      }
    }
    return index.rootClinics.map(c => clinicNode(c, null))
  }, [index, usersByClinic, usersByClinicList, locationsById, subClustersByClinic])

  // Apply the search filter. A node survives if its own label matches, any of
  // its (cluster) users match, or any descendant survives.
  const displayRoots = useMemo(() => {
    if (!q) return roots
    const userMatches = (u: AdminUser) => {
      const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase()
      return name.includes(q) || (u.email ?? '').toLowerCase().includes(q)
    }
    const filterNode = (node: TreeNode): TreeNode | null => {
      const selfMatch = node.label.toLowerCase().includes(q)
        || (node.locationLabel?.toLowerCase().includes(q) ?? false)
      const children = node.children.map(filterNode).filter((n): n is TreeNode => n !== null)
      const matchedUsers = selfMatch ? node.users : node.users.filter(userMatches)
      // A sub-unit survives if its name matches (keep all its members) or any of
      // its members match (keep just those). Clinic self-match keeps everything.
      const subUnits = selfMatch
        ? node.subUnits
        : node.subUnits
            .map(su => su.name.toLowerCase().includes(q)
              ? su
              : { ...su, users: su.users.filter(userMatches) })
            .filter(su => su.name.toLowerCase().includes(q) || su.users.length > 0)
      if (selfMatch || matchedUsers.length || subUnits.length || children.length) {
        return { ...node, users: matchedUsers, subUnits, children }
      }
      return null
    }
    return roots.map(filterNode).filter((n): n is TreeNode => n !== null)
  }, [q, roots])

  const displayUnassigned = useMemo(() => {
    if (!q) return unassignedUsers
    return unassignedUsers.filter(u => {
      const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase()
      return name.includes(q) || (u.email ?? '').toLowerCase().includes(q)
    })
  }, [q, unassignedUsers])

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
    const isCollapsed = !searching && expandable && collapsed.has(su.id)
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
          <span className="text-[9pt] font-normal text-tertiary tabular-nums shrink-0">{su.users.length}</span>
        </div>
        {expandable && !isCollapsed && su.users.map(u => renderUserLeaf(u, depth + 1))}
      </div>
    )
  }

  function renderNode(node: TreeNode, depth: number) {
    // A cluster expands if it has sub-units, child clusters, or user leaves.
    // Search force-expands so matches are visible.
    const hasUsers = node.users.length > 0
    const expandable = node.children.length > 0 || node.subUnits.length > 0 || hasUsers
    const isCollapsed = !searching && expandable && collapsed.has(node.id)
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

          <span className="text-[9pt] font-normal text-tertiary tabular-nums shrink-0">{node.count}</span>
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

  // Main-load treatment is the pre-defined HUD (mirrors PropertyPanel), NOT a
  // skeleton — the tree fades in under it. useMinLoadTime holds the HUD ≥500ms
  // so a fast cached load doesn't flash it.
  const showLoading = useMinLoadTime(loading)

  if (!showLoading && clinics.length === 0 && users.length === 0) {
    return (
      <div className="px-4 py-4">
        <EmptyState
          title="No clusters or users yet"
          action={{ icon: Building2, label: 'Show all', onClick: onSelectAll }}
        />
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full">
      <LoadingOverlay visible={showLoading} />
      {/* Tree — pb clears the bottom island that floats over the center pane. */}
      <div className="flex-1 overflow-y-auto pb-24">
        {displayRoots.map(node => renderNode(node, 0))}

        {/* Unassigned users — an expandable inline block of selectable leaves. */}
        {displayUnassigned.length > 0 && (
          <div>
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              aria-expanded={searching || showUnassigned}
              aria-label={`${showUnassigned ? 'Collapse' : 'Expand'} unassigned users`}
              className="flex items-center gap-2 w-full py-2 pr-4 text-left cursor-pointer transition-all active:scale-[0.98] hover:bg-secondary/5"
              style={{ paddingLeft: '16px' }}
            >
              <span className="p-0.5 text-tertiary shrink-0">
                {(searching || showUnassigned) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <AlertTriangle size={14} className="text-themeredred shrink-0" />
              <span className="text-[10pt] font-medium text-themeredred flex-1">Unassigned</span>
              <span className="text-[9pt] font-normal text-tertiary tabular-nums shrink-0">{displayUnassigned.length}</span>
            </button>
            {(searching || showUnassigned) && displayUnassigned.map(u => renderUserLeaf(u, 1))}
          </div>
        )}

        {searching && displayRoots.length === 0 && displayUnassigned.length === 0 && (
          <p className="px-4 py-6 text-center text-[10pt] text-tertiary">No matches</p>
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
