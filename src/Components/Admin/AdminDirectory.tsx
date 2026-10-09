import { useState, useEffect, useMemo, useCallback } from 'react'
import { Building2, Eye, Pencil, Trash2 } from 'lucide-react'
import { listClinics, listAllUsers, listLocations, deleteClinic, deleteUser } from '../../lib/adminService'
import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'
import { fetchAllSubClusters, type SubCluster } from '../../lib/subClusterService'
import { buildScopeIndex } from './adminScope'
import { useInvalidation, invalidate } from '../../stores/useInvalidationStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { TreeRow, TreeRowCount } from '@/Components/primitives/TreeRow'
import { ListGroupLabel } from '@/Components/primitives/Section'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { formatLastActive, lastActiveColor } from './adminUtils'
import { useUserActions } from './useUserActions'
import { UI_TIMING } from '../../Utilities/constants'

interface AdminDirectoryProps {
  onSelectClinic: (clinic: AdminClinic) => void
  onSelectUser: (user: AdminUser) => void
  onEditClinic: (clinic: AdminClinic) => void
  onEditUser: (user: AdminUser) => void
  /** Dev-only system conversation. Absent ⇒ the row menu omits Message. */
  onChatUser?: (user: AdminUser) => void
  /** Empty-state action — a fresh org's only useful move is its first cluster. */
  onCreateClinic: () => void
  /** A non-empty query REPLACES the tree with flat results. */
  searchQuery: string
  activeClinicId?: string | null
  activeUserId?: string | null
}

const fullName = (u: AdminUser) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'user'
const sortKey = (u: AdminUser) => `${u.last_name ?? ''} ${u.first_name ?? ''}`.trim()
const byName = (a: AdminUser, b: AdminUser) => sortKey(a).localeCompare(sortKey(b))

/** A user matches on name, email, rank, UIC, or cluster name. `q` is pre-lowercased. */
const userMatches = (u: AdminUser, q: string) =>
  [`${u.first_name ?? ''} ${u.last_name ?? ''}`, u.email, u.rank, u.uic, u.clinic_name]
    .some(f => (f ?? '').toLowerCase().includes(q))

// The org IS the tree: root cluster ⊃ child clusters ⊃ user leaves. Location is
// a sub-line on the cluster (shown on roots, and on children only when it differs
// from the parent's), not a parent node — an org can sit elsewhere than its parent.
// `subUnits` is a render-only grouping (platoon/squad) between a cluster and its
// users; `users` then holds only the HQ / ungrouped remainder.
type SubUnitNode = { id: string; name: string; users: AdminUser[] }
type ClusterNode = {
  clinic: AdminClinic
  children: ClusterNode[]
  subUnits: SubUnitNode[]
  users: AdminUser[]
  locationLabel: string | null
}

type RowMenu = { kind: 'clinic' | 'user'; id: string; rect: DOMRect }

/**
 * The Directory — the admin drawer's org tree. Tap a node to open its detail;
 * the row ellipsis opens View / Edit / Delete (+ the shared user actions for a
 * user). Search flattens the tree into matching clusters + users.
 */
export function AdminDirectory({
  onSelectClinic,
  onSelectUser,
  onEditClinic,
  onEditUser,
  onChatUser,
  onCreateClinic,
  searchQuery,
  activeClinicId,
  activeUserId,
}: AdminDirectoryProps) {
  const gen = useInvalidation('users', 'clinics', 'locations', 'subClusters')
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [locations, setLocations] = useState<AdminLocation[]>([])
  const [subClusters, setSubClusters] = useState<SubCluster[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showUnassigned, setShowUnassigned] = useState(false)
  const [loading, setLoading] = useState(true)

  const [menu, setMenu] = useState<RowMenu | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'clinic' | 'user'; id: string; label: string } | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Same action set as the user detail's corner menu — parity by construction.
  const currentUserId = useAuthStore(s => s.user?.id ?? null)
  const { buildItems: buildUserItems, overlays: userActionOverlays } = useUserActions({
    currentUserId,
    onOpenConversation: onChatUser
      ? (userId) => { const u = users.find(x => x.id === userId); if (u) onChatUser(u) }
      : undefined,
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [clinicData, userData, locationData, subClusterRes] = await Promise.all([
        listClinics(), listAllUsers(), listLocations(), fetchAllSubClusters(),
      ])
      if (cancelled) return
      setClinics(clinicData)
      setUsers(userData)
      setLocations(locationData)
      setSubClusters(subClusterRes.ok ? subClusterRes.data : [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [gen])

  const toggle = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDelete) return
    const { kind, id, label } = confirmDelete
    setDeleteProcessing(true)
    const result = kind === 'clinic' ? await deleteClinic(id) : await deleteUser(id)
    setDeleteProcessing(false)
    setConfirmDelete(null)
    // No success toast — the row disappearing is the feedback.
    if (!result.success) { setDeleteError(result.error || `Failed to delete ${label}`); return }
    if (kind === 'clinic') invalidate('clinics', 'users')
    else invalidate('users', 'clinics', 'requests')
  }, [confirmDelete])

  const locationsById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations])

  const roots = useMemo(() => {
    const index = buildScopeIndex(clinics)
    const subsByClinic = new Map<string, SubCluster[]>()
    for (const sc of subClusters) subsByClinic.set(sc.clinic_id, [...(subsByClinic.get(sc.clinic_id) ?? []), sc])
    const usersByClinic = new Map<string, AdminUser[]>()
    for (const u of users) if (u.clinic_id) usersByClinic.set(u.clinic_id, [...(usersByClinic.get(u.clinic_id) ?? []), u])

    const build = (clinic: AdminClinic, parentLocId: string | null): ClusterNode => {
      const ownLocId = clinic.location_id ?? null
      const loc = ownLocId ? locationsById.get(ownLocId) : undefined
      const members = (usersByClinic.get(clinic.id) ?? []).sort(byName)
      const units = subsByClinic.get(clinic.id) ?? []
      // Every sub-unit renders (even empty) so the structure is visible; members
      // with no — or a deleted — sub_cluster_id stay as HQ leaves on the cluster.
      const known = new Set(units.map(u => u.id))
      return {
        clinic,
        children: (index.clinicChildren.get(clinic.id) ?? []).map(c => build(c, ownLocId)),
        subUnits: units.map(u => ({ id: u.id, name: u.name, users: members.filter(m => m.sub_cluster_id === u.id) })),
        users: members.filter(m => !m.sub_cluster_id || !known.has(m.sub_cluster_id)),
        locationLabel: loc && ownLocId !== parentLocId ? loc.display_name : null,
      }
    }
    return index.rootClinics.map(c => build(c, null))
  }, [clinics, users, subClusters, locationsById])

  const unassignedUsers = useMemo(() => users.filter(u => !u.clinic_id).sort(byName), [users])

  // Search is discrete items, not a filtered tree — "find a person fast"
  // shouldn't mean reading a force-expanded hierarchy.
  const q = searchQuery.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) return null
    const locName = (c: AdminClinic) => (c.location_id ? locationsById.get(c.location_id)?.display_name : '') ?? ''
    return {
      clinics: clinics
        .filter(c => c.name.toLowerCase().includes(q) || locName(c).toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
      users: users.filter(u => userMatches(u, q)).sort(byName),
    }
  }, [q, clinics, users, locationsById])

  // ── Rows ────────────────────────────────────────────────────────────────
  const userRow = (user: AdminUser, depth: number) => (
    <TreeRow
      key={user.id}
      depth={depth}
      title={fullName(user)}
      onTap={() => onSelectUser(user)}
      active={activeUserId === user.id}
      onOpenMenu={rect => setMenu({ kind: 'user', id: user.id, rect })}
      menuLabel={`${fullName(user)} actions`}
      trailing={
        <span className="flex items-center gap-1.5 shrink-0">
          {user.uic && <span className="text-[9pt] text-tertiary tabular-nums">{user.uic}</span>}
          <span
            className={`w-1.5 h-1.5 rounded-full ${lastActiveColor(user.last_active_at)}`}
            title={`Last active: ${formatLastActive(user.last_active_at)}`}
          />
        </span>
      }
    />
  )

  const clusterRow = (clinic: AdminClinic, depth: number, sub: string | null, expand?: { expanded: boolean; onToggle: () => void }) => (
    <TreeRow
      key={clinic.id}
      depth={depth}
      title={clinic.name}
      sub={[sub]}
      emphasis
      expanded={expand?.expanded}
      onToggle={expand?.onToggle}
      onTap={() => onSelectClinic(clinic)}
      active={activeClinicId === clinic.id}
      onOpenMenu={rect => setMenu({ kind: 'clinic', id: clinic.id, rect })}
      menuLabel={`${clinic.name} actions`}
    />
  )

  const renderNode = (node: ClusterNode, depth: number) => {
    const expandable = node.children.length > 0 || node.subUnits.length > 0 || node.users.length > 0
    const open = !collapsed.has(node.clinic.id)
    return (
      <div key={node.clinic.id}>
        {clusterRow(node.clinic, depth, node.locationLabel, expandable ? { expanded: open, onToggle: () => toggle(node.clinic.id) } : undefined)}
        {expandable && open && (
          <>
            {node.subUnits.map(su => {
              const suOpen = !collapsed.has(su.id)
              return (
                <div key={su.id}>
                  <TreeRow
                    depth={depth + 1}
                    title={su.name}
                    expanded={su.users.length > 0 ? suOpen : undefined}
                    onToggle={() => toggle(su.id)}
                    trailing={<TreeRowCount>{su.users.length}</TreeRowCount>}
                  />
                  {suOpen && su.users.map(u => userRow(u, depth + 2))}
                </div>
              )
            })}
            {node.users.map(u => userRow(u, depth + 1))}
            {node.children.map(child => renderNode(child, depth + 1))}
          </>
        )}
      </div>
    )
  }

  const menuItems = (m: RowMenu): ContextMenuItem[] => {
    if (m.kind === 'clinic') {
      const clinic = clinics.find(c => c.id === m.id)
      if (!clinic) return []
      return [
        { key: 'view', label: 'View', icon: Eye, onAction: () => onSelectClinic(clinic) },
        { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEditClinic(clinic) },
        { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDelete({ kind: 'clinic', id: clinic.id, label: clinic.name }) },
      ]
    }
    const user = users.find(u => u.id === m.id)
    if (!user) return []
    return buildUserItems(user, {
      resetAnchor: () => m.rect,
      onView: onSelectUser,
      onEdit: onEditUser,
      onDelete: u => setConfirmDelete({ kind: 'user', id: u.id, label: fullName(u) }),
    })
  }

  // `loading` only suppresses the empty state until the first fetch lands —
  // every save refetches, so a load treatment would flash on each mutation.
  if (!loading && clinics.length === 0 && users.length === 0) {
    return (
      <div className="px-4 py-4">
        <EmptyState title="No clusters or users yet" action={{ icon: Building2, label: 'New cluster', onClick: onCreateClinic }} />
      </div>
    )
  }

  return (
    <>
      {results ? (
        results.clinics.length + results.users.length === 0 ? (
          <EmptyState title="No matches" bordered={false} />
        ) : (
          <>
            {results.clinics.length > 0 && <ListGroupLabel>Clusters</ListGroupLabel>}
            {results.clinics.map(c => clusterRow(c, 0, c.location_id ? locationsById.get(c.location_id)?.display_name ?? null : null))}
            {results.users.length > 0 && <ListGroupLabel>Users</ListGroupLabel>}
            {results.users.map(u => userRow(u, 0))}
          </>
        )
      ) : (
        <>
          {roots.map(node => renderNode(node, 0))}
          {unassignedUsers.length > 0 && (
            <>
              <TreeRow
                title="Unassigned"
                emphasis
                expanded={showUnassigned}
                onToggle={() => setShowUnassigned(s => !s)}
                trailing={<TreeRowCount tone="short">{unassignedUsers.length}</TreeRowCount>}
              />
              {showUnassigned && unassignedUsers.map(u => userRow(u, 1))}
            </>
          )}
        </>
      )}

      {menu && (
        <AnchoredMenu isOpen layout="list" anchorRect={menu.rect} items={menuItems(menu)} onClose={() => setMenu(null)} />
      )}

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
        visible={!!deleteError}
        title={deleteError ?? ''}
        variant="danger"
        notifyOnly
        autoDismissMs={UI_TIMING.FEEDBACK_DURATION}
        onCancel={() => setDeleteError(null)}
      />
    </>
  )
}
