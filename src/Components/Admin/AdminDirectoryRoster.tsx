// AdminDirectoryRoster.tsx
//
// The mobile Directory BODY (selection model "A"): shows the contents of the
// node picked in the tree-Sheet, one echelon at a time. A breadcrumb walks back
// up; sub-cluster rows drill down; the cluster's assigned users render via the
// real AdminUsersList (so the row menus / reset / delete / logout machinery is
// reused, not reimplemented).
//
//   • nothing selected → the top ring: locations + "No location" + "Unassigned"
//   • location selected → its root clusters
//   • cluster selected  → its sub-clusters + Members (assigned users)
//   • unassigned        → clinic-less users
import { ChevronRight, Building2, Users, SlidersHorizontal } from 'lucide-react'
import { SectionCard } from '../Section'
import { EmptyState } from '../EmptyState'
import { AdminUsersList } from './AdminUsersList'
import { ancestryOf, UNASSIGNED_ID, type AdminHierarchy, type HierNode, type ClusterNode } from './adminHierarchy'
import type { AdminClinic, AdminLocation, AdminUser } from '../../lib/adminService'

interface AdminDirectoryRosterProps {
    hierarchy: AdminHierarchy
    loading?: boolean
    isDevRole?: boolean
    selectedId: string | null
    onSelectNode: (node: HierNode) => void
    /** Jump the breadcrumb to an ancestor (null = the top ring). */
    onNavigate: (id: string | null) => void
    onSelectUser: (user: AdminUser) => void
    onEditUser: (user: AdminUser) => void
    onCreateUser: () => void
    /** Open the selected cluster/location's own detail (edit). */
    onOpenCluster: (clinic: AdminClinic) => void
    onOpenLocation: (location: AdminLocation) => void
}

export function AdminDirectoryRoster({
    hierarchy,
    loading,
    isDevRole,
    selectedId,
    onSelectNode,
    onNavigate,
    onSelectUser,
    onEditUser,
    onCreateUser,
    onOpenCluster,
    onOpenLocation,
}: AdminDirectoryRosterProps) {
    const selected = selectedId ? hierarchy.nodeById.get(selectedId) ?? null : null
    const crumbs = selectedId ? ancestryOf(selectedId, hierarchy) : []

    // Detail opener for the node we're currently AT (cluster always; real
    // location only for dev). null when there's no editable backing record.
    const openSelectedDetail =
        selected?.kind === 'cluster' ? () => onOpenCluster(selected.clinic)
        : selected?.kind === 'location' && selected.location && isDevRole ? () => onOpenLocation(selected.location!)
        : null

    // The clusters to show as drill rows: roots when nothing is selected, else
    // the selected node's children (locations + clusters both carry `children`).
    const clusterRows: ClusterNode[] = selected
        ? selected.children
        : []
    const topRows: HierNode[] = selected ? [] : hierarchy.roots

    // Members list shows for a selected cluster (its clinic_id) or the
    // Unassigned pseudo-node (clinic-less users via the sentinel).
    const memberClinicId =
        selected?.kind === 'cluster' ? selected.id
        : selected?.kind === 'unassigned' ? UNASSIGNED_ID
        : null

    const Crumb = ({ label, onClick, current }: { label: string; onClick?: () => void; current?: boolean }) => (
        <>
            <button
                type="button"
                disabled={current}
                onClick={onClick}
                className={`shrink-0 max-w-[140px] truncate ${current ? 'text-primary font-semibold' : 'text-tertiary hover:text-primary active:scale-95'}`}
            >
                {label}
            </button>
            {!current && <ChevronRight size={12} className="shrink-0 text-tertiary/50" />}
        </>
    )

    const NodeRow = ({ node }: { node: HierNode }) => (
        <div
            role="button"
            tabIndex={0}
            aria-label={`Open ${node.label}`}
            onClick={() => onSelectNode(node)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectNode(node) } }}
            className="flex items-center gap-3 px-4 py-3.5 transition-all active:scale-[0.99] hover:bg-themeblue2/5 cursor-pointer select-none"
        >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <Building2 size={16} className="text-tertiary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{node.label}</p>
                {node.sublabel && <p className="text-[9pt] text-tertiary mt-0.5 truncate">{node.sublabel}</p>}
            </div>
            {node.totalUserCount > 0 && (
                <span className="flex items-center gap-1 text-[9pt] text-tertiary shrink-0">
                    <Users size={11} />{node.totalUserCount}
                </span>
            )}
            <ChevronRight size={16} className="text-tertiary shrink-0" />
        </div>
    )

    return (
        <div className="px-3 pt-2 pb-24 space-y-4">
            {/* Breadcrumb — Directory › … › current — + an "open details" pill
                for the node we're at (edit cluster / dev-edit location). */}
            <div className="flex items-center gap-2 px-1">
                <div className="flex-1 flex items-center gap-1 overflow-x-auto text-[10pt]">
                    <Crumb label="Directory" onClick={() => onNavigate(null)} current={!selected} />
                    {crumbs.map((c) => (
                        <Crumb key={c.id} label={c.label} onClick={() => onNavigate(c.id)} />
                    ))}
                    {selected && <Crumb label={selected.label} current />}
                </div>
                {openSelectedDetail && (
                    <button
                        type="button"
                        onClick={openSelectedDetail}
                        aria-label="Open details"
                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themewhite shadow-sm border border-tertiary/15 text-tertiary active:scale-95"
                    >
                        <SlidersHorizontal size={16} />
                    </button>
                )}
            </div>

            {/* Drill rows: top ring (no selection) or the selected node's children. */}
            {topRows.length > 0 && (
                <SectionCard>{topRows.map((n) => <NodeRow key={n.id} node={n} />)}</SectionCard>
            )}
            {clusterRows.length > 0 && (
                <section className="space-y-2">
                    {memberClinicId && (
                        <p className="px-1 text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Sub-clusters</p>
                    )}
                    <SectionCard>{clusterRows.map((n) => <NodeRow key={n.id} node={n} />)}</SectionCard>
                </section>
            )}

            {/* Members — reuses AdminUsersList (menus/reset/delete/logout intact). */}
            {memberClinicId && (
                <AdminUsersList
                    embedded
                    title="Members"
                    filterClinicId={memberClinicId}
                    onSelectUser={onSelectUser}
                    onEditUser={onEditUser}
                    onCreateUser={onCreateUser}
                />
            )}

            {/* Empty: a selected location/cluster with neither children nor members. */}
            {!loading && topRows.length === 0 && clusterRows.length === 0 && !memberClinicId && (
                <EmptyState title="Nothing here yet" />
            )}
        </div>
    )
}
