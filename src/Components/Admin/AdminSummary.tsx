import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, AlertTriangle, User, Building2, MapPin, Eye, Pencil, Trash2, Mail, MessageSquare } from 'lucide-react'
import { listClinics, listAllUsers, listLocations, deleteClinic, deleteUser } from '../../lib/adminService'
import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'
import { buildScopeIndex } from './adminScope'
import { buildMailtoHref } from '../../lib/mailto'
import { useInvalidation, invalidate } from '../../stores/useInvalidationStore'
import { AdminSummarySkeleton } from './AdminSkeletons'
import { EmptyState } from '../EmptyState'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { UI_TIMING } from '../../Utilities/constants'

interface AdminSummaryProps {
  onSelectClinic: (clinic: AdminClinic) => void
  onSelectUser: (user: AdminUser) => void
  onEditClinic: (clinic: AdminClinic) => void
  onEditUser: (user: AdminUser) => void
  onSelectLocation?: (location: AdminLocation) => void
  onEditLocation?: (location: AdminLocation) => void
  /** Open an in-app system conversation with a user. Passed only for dev role;
   *  when absent the tree context menu omits the Chat action. */
  onChatUser?: (user: AdminUser) => void
  /** Empty-state fallback action. */
  onSelectAll: () => void
  /** Controlled search (shared with the drawer's SearchInput). Filters the tree
   *  by location / cluster name and member name/email; matches force-expand. */
  searchQuery?: string
  activeClinicId?: string | null
  activeUserId?: string | null
  activeLocationId?: string | null
}

// Unified tree node — locations contain sub-locations + clusters; clusters
// contain sub-clusters + user leaves.
type TreeNode =
  | { kind: 'location'; id: string; label: string; location: AdminLocation; children: TreeNode[]; count: number }
  | { kind: 'clinic'; id: string; label: string; clinic: AdminClinic; children: TreeNode[]; users: AdminUser[]; count: number }

/**
 * The Directory tree — the admin drawer's MAIN content list. A unified
 * location ⊃ cluster ⊃ user containment forest with selectable user leaves.
 * Tapping a node opens its detail; long-press/right-click opens View/Edit/
 * (Delete) actions. Stats + system conversations live in the sort rail
 * (AdminSortRail), not here — this is purely the browsable tree.
 */
export function AdminSummary({
  onSelectClinic,
  onSelectUser,
  onEditClinic,
  onEditUser,
  onSelectLocation,
  onEditLocation,
  onChatUser,
  onSelectAll,
  searchQuery,
  activeClinicId,
  activeUserId,
  activeLocationId,
}: AdminSummaryProps) {
  const gen = useInvalidation('users', 'clinics', 'locations')
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [locations, setLocations] = useState<AdminLocation[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Lifted-clone context menu (right-click / long-press) + delete flow.
  const [contextMenu, setContextMenu] = useState<{ kind: 'clinic' | 'user' | 'location'; id: string; rect: DOMRect; clone: ReactNode } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'clinic' | 'user'; id: string; label: string } | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)
  const [notify, setNotify] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const preventTap = useRef(false)

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
          <span className="w-7 h-7 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-tertiary" />
          </span>
          <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">{clinic.name}</span>
        </div>
      ),
    })
  }, [])

  const openLocationMenu = useCallback((location: AdminLocation, el: HTMLElement) => {
    setContextMenu({
      kind: 'location',
      id: location.id,
      rect: el.getBoundingClientRect(),
      clone: (
        <div className="bg-themewhite px-4 py-2.5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
            <MapPin size={14} className="text-themeblue2" />
          </span>
          <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">{location.display_name}</span>
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
          <User size={14} className="text-tertiary shrink-0" />
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
    const [clinicData, userData, locationData] = await Promise.all([
      listClinics(),
      listAllUsers(),
      listLocations(),
    ])
    setClinics(clinicData)
    setUsers(userData)
    setLocations(locationData)
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

  // Build the unified node forest (locations ⊃ clusters ⊃ user leaves).
  const roots = useMemo(() => {
    const clinicNode = (clinic: AdminClinic): TreeNode => {
      const children = (index.clinicChildren.get(clinic.id) ?? []).map(clinicNode)
      const childCount = children.reduce((s, n) => s + n.count, 0)
      return {
        kind: 'clinic',
        id: clinic.id,
        label: clinic.name,
        clinic,
        children,
        users: usersByClinicList.get(clinic.id) ?? [],
        count: (usersByClinic.get(clinic.id) ?? 0) + childCount,
      }
    }
    const locationNode = (loc: AdminLocation): TreeNode => {
      const childLocs = (index.locChildren.get(loc.id) ?? []).map(locationNode)
      const clinicsHere = (index.clinicsByLocation.get(loc.id) ?? []).map(clinicNode)
      const children = [...childLocs, ...clinicsHere]
      return {
        kind: 'location',
        id: loc.id,
        label: loc.display_name,
        location: loc,
        children,
        count: children.reduce((s, n) => s + n.count, 0),
      }
    }
    return [
      ...index.rootLocations.map(locationNode),
      ...index.floatingRootClinics.map(clinicNode),
    ]
  }, [index, usersByClinic, usersByClinicList])

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
      const children = node.children.map(filterNode).filter((n): n is TreeNode => n !== null)
      if (node.kind === 'clinic') {
        const matchedUsers = selfMatch ? node.users : node.users.filter(userMatches)
        if (selfMatch || matchedUsers.length || children.length) {
          return { ...node, users: matchedUsers, children }
        }
        return null
      }
      if (selfMatch || children.length) return { ...node, children }
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
        <span className="w-[18px] shrink-0" />
        <span className="text-[9.5pt] text-primary truncate">{name}</span>
      </button>
    )
  }

  function renderNode(node: TreeNode, depth: number) {
    // A node expands if it has descendant nodes, or (clinics) has user leaves to
    // reveal. Search force-expands so matches are visible.
    const hasUsers = node.kind === 'clinic' && node.users.length > 0
    const expandable = node.children.length > 0 || hasUsers
    const isCollapsed = !searching && expandable && collapsed.has(node.id)
    const isActive = node.kind === 'clinic'
      ? activeClinicId === node.id
      : activeLocationId === node.id
    const Icon = node.kind === 'location' ? MapPin : Building2

    const selectNode = () => {
      if (preventTap.current) { preventTap.current = false; return }
      if (node.kind === 'location') onSelectLocation?.(node.location)
      else onSelectClinic(node.clinic)
    }
    const openMenu = (el: HTMLElement) => {
      if (node.kind === 'location') openLocationMenu(node.location, el)
      else openClinicMenu(node.clinic, el)
    }

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

          <Icon size={14} className={`shrink-0 ${node.kind === 'location' ? 'text-themeblue2' : 'text-tertiary'}`} />

          <div
            role="button"
            tabIndex={0}
            aria-label={`Select ${node.label}`}
            className="flex items-center flex-1 min-w-0"
            onClick={selectNode}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectNode() } }}
          >
            <span className="text-[10pt] font-medium text-primary truncate">{node.label}</span>
          </div>

          <span className="text-[9pt] font-normal text-tertiary tabular-nums shrink-0">{node.count}</span>
        </div>

        {expandable && !isCollapsed && (
          <>
            {hasUsers && node.kind === 'clinic' && node.users.map(u => renderUserLeaf(u, depth + 1))}
            {node.children.map(child => renderNode(child, depth + 1))}
          </>
        )}
      </div>
    )
  }

  if (loading) return <AdminSummarySkeleton />

  if (clinics.length === 0 && users.length === 0 && locations.length === 0) {
    return (
      <div className="px-4 py-4">
        <EmptyState
          title="No locations, clusters, or users yet"
          action={{ icon: Building2, label: 'Show all', onClick: onSelectAll }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
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
        } else if (contextMenu.kind === 'location') {
          const location = locations.find(l => l.id === contextMenu.id)
          if (!location) return null
          items = [
            ...(onSelectLocation ? [{ key: 'view', label: 'View', icon: Eye, onAction: () => onSelectLocation(location) }] : []),
            ...(onEditLocation ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditLocation(location) }] : []),
          ]
          if (items.length === 0) return null
        } else {
          const user = users.find(u => u.id === contextMenu.id)
          if (!user) return null
          const label = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'user'
          items = [
            { key: 'view', label: 'View', icon: Eye, onAction: () => onSelectUser(user) },
            { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditUser(user) },
            ...(onChatUser && user.last_active_at ? [{
              key: 'chat', label: 'Chat', icon: MessageSquare, onAction: () => onChatUser(user),
            }] : []),
            ...(user.email ? [{
              key: 'email', label: 'Email', icon: Mail,
              href: buildMailtoHref({ to: user.email!, subject: '[inquiry] -  Medical Operations Web Application', body: `${[user.rank, user.last_name].filter(Boolean).join(' ')},\n\n` }),
            }] : []),
            { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDelete({ kind: 'user', id: user.id, label }) },
          ]
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
