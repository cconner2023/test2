// AdminHierarchyTree.tsx
//
// The Directory navigator: an indented, collapsible Location ⊃ Cluster (echelon)
// tree. Presentational — data + expand/selection state are owned by the caller
// (AdminDrawer) so the SAME built hierarchy drives the desktop inline pane and
// the mobile tree-Sheet, and selection stays in sync with the roster.
//
// Rows stop at clusters (no user leaves): selecting a cluster opens its roster
// (mobile body) or detail pane (desktop). Tapping the chevron expands the
// echelon / location group in place; tapping the row selects the node.
import { ChevronRight, MapPin, Building2, Users, FolderX, UserX } from 'lucide-react'
import { SectionCard } from '../Section'
import { EmptyState } from '../EmptyState'
import { AdminListSkeleton } from './AdminSkeletons'
import type { AdminHierarchy, HierNode, ClusterNode } from './adminHierarchy'

interface AdminHierarchyTreeProps {
    hierarchy: AdminHierarchy
    loading?: boolean
    expandedIds: Set<string>
    onToggle: (id: string) => void
    selectedId?: string | null
    onSelect: (node: HierNode) => void
}

function nodeIcon(node: HierNode) {
    switch (node.kind) {
        case 'location': return MapPin
        case 'no-location': return FolderX
        case 'unassigned': return UserX
        case 'cluster': return Building2
    }
}

export function AdminHierarchyTree({
    hierarchy,
    loading,
    expandedIds,
    onToggle,
    selectedId,
    onSelect,
}: AdminHierarchyTreeProps) {
    if (loading) return <AdminListSkeleton />
    if (hierarchy.roots.length === 0) return <EmptyState title="No clusters" />

    const rows: React.ReactNode[] = []

    const pushRow = (node: HierNode, depth: number, hasChildren: boolean) => {
        const Icon = nodeIcon(node)
        const expanded = expandedIds.has(node.id)
        const selected = selectedId === node.id
        rows.push(
            <div
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`Select ${node.label}`}
                onClick={() => onSelect(node)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node) } }}
                style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
                className={`flex items-center gap-2 pr-3 py-3 transition-all active:scale-[0.99] cursor-pointer select-none ${
                    selected ? 'bg-themeblue2/10' : 'hover:bg-themeblue2/5'
                } ${depth > 0 ? 'border-l-2 border-l-themeblue3/15' : ''}`}
            >
                {/* Chevron — toggles expand; its own hit area so it doesn't select. */}
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggle(node.id) }}
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                        className="w-6 h-6 -ml-1 rounded-full flex items-center justify-center text-tertiary shrink-0 active:scale-90"
                    >
                        <ChevronRight size={15} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                ) : (
                    <span className="w-5 shrink-0" />
                )}

                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                    <Icon size={15} className="text-tertiary" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{node.label}</p>
                    {node.sublabel && (
                        <p className="text-[9pt] text-tertiary mt-0.5 truncate">{node.sublabel}</p>
                    )}
                </div>

                {node.totalUserCount > 0 && (
                    <span className="flex items-center gap-1 text-[9pt] text-tertiary shrink-0">
                        <Users size={11} />
                        {node.totalUserCount}
                    </span>
                )}
            </div>
        )
    }

    // Cluster subtree — recurse while expanded.
    const visitCluster = (node: ClusterNode, depth: number) => {
        pushRow(node, depth, node.children.length > 0)
        if (expandedIds.has(node.id)) {
            for (const child of node.children) visitCluster(child, depth + 1)
        }
    }

    for (const root of hierarchy.roots) {
        const hasChildren = root.children.length > 0
        pushRow(root, 0, hasChildren)
        if (hasChildren && expandedIds.has(root.id)) {
            for (const child of root.children) visitCluster(child, 1)
        }
    }

    return <SectionCard>{rows}</SectionCard>
}
