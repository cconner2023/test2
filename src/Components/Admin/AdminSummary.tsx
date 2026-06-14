import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, AlertTriangle, User, Building2, Eye, Pencil, Trash2, Mail, MessageSquare } from 'lucide-react'
import { listClinics, listAllUsers, getAllAccountRequests, deleteClinic, deleteUser } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { openMailto } from '../../lib/mailto'
import { useInvalidation, invalidate } from '../../stores/useInvalidationStore'
import { AdminSummarySkeleton } from './AdminSkeletons'
import { EmptyState } from '../EmptyState'
import { SearchInput } from '../SearchInput'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { type ContextMenuItem } from '../ContextMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { UI_TIMING } from '../../Utilities/constants'

interface AdminSummaryProps {
  onSelectClinic: (clinic: AdminClinic) => void
  onSelectUser: (user: AdminUser) => void
  onEditClinic: (clinic: AdminClinic) => void
  onEditUser: (user: AdminUser) => void
  /** Open an in-app system conversation with a user. Passed only for dev role;
   *  when absent the tree context menu omits the Chat action. */
  onChatUser?: (user: AdminUser) => void
  onSelectAll: () => void
  onSwitchTab: (tab: 'requests' | 'users' | 'clinics') => void
  activeClinicId?: string | null
  activeUserId?: string | null
  allSelected?: boolean
  /** Tree-only mode for the mobile hierarchy sheet: drops the stats summary
   *  block + per-row entity icons, rendering a clean map-overlay-style tree
   *  (All Clusters → clusters → user leaves → an Unassigned node). */
  treeOnly?: boolean
}

interface ClinicNode {
  clinic: AdminClinic
  children: ClinicNode[]
  /** Users assigned directly to this cluster — selectable leaf rows. */
  users: AdminUser[]
  userCount: number
  totalUserCount: number
}

export function AdminSummary({
  onSelectClinic,
  onSelectUser,
  onEditClinic,
  onEditUser,
  onChatUser,
  onSelectAll,
  onSwitchTab,
  activeClinicId,
  activeUserId,
  allSelected,
  treeOnly,
}: AdminSummaryProps) {
  const gen = useInvalidation('users', 'clinics', 'requests')
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Lifted-clone context menu (right-click / long-press) + delete flow.
  const [contextMenu, setContextMenu] = useState<{ kind: 'clinic' | 'user'; id: string; rect: DOMRect; clone: ReactNode } | null>(null)
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
      // A clinic delete clears its members' clinic_id; a user delete also clears
      // their membership + any account_requests. Mirrors the list-level deletes.
      if (kind === 'clinic') invalidate('clinics', 'users')
      else invalidate('users', 'clinics', 'requests')
    } else {
      setNotify({ type: 'error', message: result.error || `Failed to delete ${label}` })
    }
  }, [confirmDelete])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [clinicData, userData, requests] = await Promise.all([
      listClinics(),
      listAllUsers(),
      getAllAccountRequests('pending'),
    ])
    setClinics(clinicData)
    setUsers(userData)
    setPendingCount(requests.length)
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

  /** Map parent_id → children, computed once via reverse lookup on parent_clinic_id. */
  const childrenByParent = useMemo(() => {
    const map = new Map<string, AdminClinic[]>()
    for (const clinic of clinics) {
      if (!clinic.parent_clinic_id) continue
      const arr = map.get(clinic.parent_clinic_id) ?? []
      arr.push(clinic)
      map.set(clinic.parent_clinic_id, arr)
    }
    return map
  }, [clinics])

  const usersByClinic = useMemo(() => {
    const map = new Map<string | null, number>()
    for (const user of users) {
      const key = user.clinic_id ?? null
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [users])

  /** clinic_id → its assigned users (sorted), so the tree can expand to show
   *  individual users as selectable leaves under their cluster. */
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
  const unassignedCount = unassignedUsers.length
  const [showUnassigned, setShowUnassigned] = useState(false)

  // Tree-only search (mobile hierarchy sheet). Filters clusters + user leaves
  // by name/email; a cluster name match keeps all its users. Matching branches
  // render force-expanded so hits are visible regardless of collapse state.
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const searching = !!treeOnly && q.length > 0

  const { roots } = useMemo(() => {
    function countTotal(clinic: AdminClinic): number {
      let count = usersByClinic.get(clinic.id) ?? 0
      for (const child of childrenByParent.get(clinic.id) ?? []) {
        count += countTotal(child)
      }
      return count
    }

    function buildNode(clinic: AdminClinic): ClinicNode {
      const children = (childrenByParent.get(clinic.id) ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(buildNode)

      return {
        clinic,
        children,
        users: usersByClinicList.get(clinic.id) ?? [],
        userCount: usersByClinic.get(clinic.id) ?? 0,
        totalUserCount: countTotal(clinic),
      }
    }

    const rootClinics = clinics
      .filter(c => !c.parent_clinic_id)
      .sort((a, b) => a.name.localeCompare(b.name))

    return { roots: rootClinics.map(buildNode) }
  }, [clinics, usersByClinic, usersByClinicList, childrenByParent])

  const { displayRoots, displayUnassigned } = useMemo(() => {
    if (!q) return { displayRoots: roots, displayUnassigned: unassignedUsers }
    const userMatches = (u: AdminUser) => {
      const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase()
      return name.includes(q) || (u.email ?? '').toLowerCase().includes(q)
    }
    const filterNode = (node: ClinicNode): ClinicNode | null => {
      const selfMatch = node.clinic.name.toLowerCase().includes(q)
      const matchedUsers = selfMatch ? node.users : node.users.filter(userMatches)
      const matchedChildren = node.children
        .map(filterNode)
        .filter((n): n is ClinicNode => n !== null)
      if (selfMatch || matchedUsers.length || matchedChildren.length) {
        return { ...node, users: matchedUsers, children: matchedChildren }
      }
      return null
    }
    return {
      displayRoots: roots.map(filterNode).filter((n): n is ClinicNode => n !== null),
      displayUnassigned: unassignedUsers.filter(userMatches),
    }
  }, [q, roots, unassignedUsers])

  // Selectable user leaf under a cluster (or unassigned) — shared row renderer.
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

  function renderClinicRow(node: ClinicNode, depth: number, forceExpand = false) {
    // Expandable when it has sub-clusters OR assigned users (so the chevron can
    // reveal individual members, not just child clusters).
    const hasChildren = node.children.length > 0 || node.users.length > 0
    // forceExpand (active search) overrides the collapse set so matches show.
    const isCollapsed = !forceExpand && collapsed.has(node.clinic.id)
    const isActive = activeClinicId === node.clinic.id

    return (
      <div key={node.clinic.id}>
        <div
          className={`flex items-center gap-2 py-2 pr-4 cursor-pointer transition-all active:scale-[0.98] ${
            isActive
              ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
              : 'hover:bg-secondary/5'
          }`}
          style={{ paddingLeft: `${16 + depth * 16}px` }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openClinicMenu(node.clinic, e.currentTarget as HTMLElement) }}
          onTouchStart={(e) => { const el = e.currentTarget as HTMLElement; preventTap.current = false; longPressTimer.current = window.setTimeout(() => { preventTap.current = true; openClinicMenu(node.clinic, el) }, 500) }}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
        >
          {hasChildren ? (
            <button
              className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.clinic.name}`}
              aria-expanded={!isCollapsed}
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.clinic.id) }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}

          <div
            role="button"
            tabIndex={0}
            aria-label={`Select cluster ${node.clinic.name}`}
            className="flex items-center flex-1 min-w-0"
            onClick={() => { if (preventTap.current) { preventTap.current = false; return } onSelectClinic(node.clinic) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectClinic(node.clinic) } }}
          >
            <span className="text-[10pt] font-medium text-primary truncate">{node.clinic.name}</span>
          </div>

          <span className="text-[9pt] md:text-[9pt] font-normal text-tertiary tabular-nums shrink-0">
            {node.totalUserCount}
          </span>
        </div>

        {hasChildren && !isCollapsed && (
          <>
            {node.users.map(user => renderUserLeaf(user, depth + 1))}
            {node.children.map(child => renderClinicRow(child, depth + 1, forceExpand))}
          </>
        )}
      </div>
    )
  }

  if (loading) return <AdminSummarySkeleton />

  if (clinics.length === 0 && users.length === 0) {
    return (
      <div className="px-4 py-4">
        <EmptyState
          title="No users or clusters yet"
          action={{ icon: Building2, label: 'Open clusters', onClick: () => onSwitchTab('clinics') }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats — hidden in tree-only mode (the mobile hierarchy sheet wants a
          clean map-overlay-style tree, no summary header). */}
      {!treeOnly && (
      <>
      <div className="px-4 py-3 space-y-1.5">
        <button
          onClick={() => onSwitchTab('users')}
          className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
        >
          <span className="text-[10pt] text-primary flex-1">Users</span>
          <span className="text-[10pt] font-semibold text-primary tabular-nums">{users.length}</span>
        </button>

        <button
          onClick={() => onSwitchTab('clinics')}
          className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
        >
          <span className="text-[10pt] text-primary flex-1">Clusters</span>
          <span className="text-[10pt] font-semibold text-primary tabular-nums">{clinics.length}</span>
        </button>

        {pendingCount > 0 && (
          <button
            onClick={() => onSwitchTab('requests')}
            className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
          >
            <span className="text-[10pt] text-themeyellow flex-1">Pending Requests</span>
            <span className="text-[10pt] font-semibold text-themeyellow tabular-nums">{pendingCount}</span>
          </button>
        )}

        {unassignedCount > 0 && (
          <div>
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              aria-expanded={showUnassigned}
              aria-label={`${showUnassigned ? 'Hide' : 'Show'} unassigned users`}
              className="flex items-center gap-2 w-full text-left active:scale-[0.98] transition-all"
            >
              <span className="w-7 h-7 rounded-full bg-themeredred/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={14} className="text-themeredred" />
              </span>
              <span className="text-[10pt] text-themeredred flex-1">Unassigned</span>
              <span className="text-[10pt] font-semibold text-themeredred tabular-nums mr-1">{unassignedCount}</span>
              {showUnassigned ? <ChevronDown size={14} className="text-tertiary shrink-0" /> : <ChevronRight size={14} className="text-tertiary shrink-0" />}
            </button>
            {showUnassigned && (
              <div className="mt-1 ml-9 rounded-lg border border-tertiary/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
                {unassignedUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { if (preventTap.current) { preventTap.current = false; return } onSelectUser(u) }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openUserMenu(u, e.currentTarget as HTMLElement) }}
                    onTouchStart={(e) => { const el = e.currentTarget as HTMLElement; preventTap.current = false; longPressTimer.current = window.setTimeout(() => { preventTap.current = true; openUserMenu(u, el) }, 500) }}
                    onTouchEnd={clearLongPress}
                    onTouchMove={clearLongPress}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left active:scale-95 transition-all ${
                      activeUserId === u.id ? 'bg-themeblue3/8' : 'hover:bg-secondary/5'
                    }`}
                  >
                    <span className="text-[10pt] text-primary truncate">
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-b border-primary/10 mx-4" />

      {/* Hierarchy header */}
      <div className="px-4 py-2.5">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Hierarchy</p>
      </div>
      </>
      )}

      {/* Search — tree-only (mobile hierarchy sheet). */}
      {treeOnly && (
        <div className="shrink-0 px-4 pt-1 pb-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search clusters or users…" />
        </div>
      )}

      {/* Clinic tree */}
      <div className="flex-1 overflow-y-auto">
        {!searching && (
        <button
          onClick={onSelectAll}
          onKeyDown={e => { if (e.key === 'Enter') onSelectAll() }}
          aria-label="Show all clusters"
          className={`flex items-center gap-2 w-full py-2 px-4 text-left cursor-pointer transition-all active:scale-[0.98] ${
            allSelected
              ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
              : 'hover:bg-secondary/5'
          }`}
        >
          <span className="w-[18px] shrink-0" />
          <span className="text-[10pt] font-medium text-primary">All Clusters</span>
          <span className="text-[9pt] md:text-[9pt] font-normal text-tertiary tabular-nums ml-auto">{users.length}</span>
        </button>
        )}

        {displayRoots.map(node => renderClinicRow(node, 0, searching))}

        {/* Unassigned users — rendered as a tree node in tree-only mode (in
            the stats variant these live in the summary block above). When
            searching, force-expanded and showing only matched users. */}
        {treeOnly && displayUnassigned.length > 0 && (
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
              <span className="text-[10pt] font-medium text-tertiary italic flex-1">Unassigned</span>
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
          items = [
            { key: 'view', label: 'View', icon: Eye, onAction: () => onSelectUser(user) },
            { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditUser(user) },
            // Chat — in-app system conversation. Dev-only (onChatUser gated by
            // role upstream) and only once the user has a vault (last_active_at).
            ...(onChatUser && user.last_active_at ? [{
              key: 'chat', label: 'Chat', icon: MessageSquare, onAction: () => onChatUser(user),
            }] : []),
            ...(user.email ? [{
              key: 'email', label: 'Email', icon: Mail,
              onAction: () => openMailto({ to: user.email!, subject: 'Beacon Inquiry', body: `${[user.rank, user.last_name].filter(Boolean).join(' ')},\n\n` }),
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
