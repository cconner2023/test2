import { useState } from 'react'
import { formatMedicName, HQ_SUB_CLUSTER_ID } from './supervisorHelpers'
import { TreeRowCount } from '@/Components/primitives/TreeRow'
import { PersonnelRow, PersonnelGroupBand } from '@/Components/primitives/PersonnelRow'
import { UserAvatar } from '../UserAvatar'
import { useSubClusters } from '../../../Hooks/useSubClusters'
import { SubordinateClusterNode } from './SubordinateClusterNode'
import type { ChildClinicCard } from '../../../Hooks/useEchelonSummaries'
import type { SoldierReadinessEntry } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'

/**
 * The rail's subject selector. Every node here is a SCOPE, not a destination:
 * selecting one re-points the center pane and swaps the SubjectCard above.
 * Nothing in this tree opens the detail pane, so the rail never collapses out
 * from under the person using it.
 *
 * Rendered with PersonnelRow / PersonnelGroupBand — the same primitives the
 * calendar's personnel filter uses, so a medic looks like the same object in
 * both drawers. It used to be TreeRow, which is built for indented stock-number
 * lists and gave people no avatar; a roster you scan by face is not that.
 */
export type TreeSelection =
  | { type: 'cluster' }
  | { type: 'sub-cluster'; subClusterId: string; name: string }
  | { type: 'soldier'; soldierId: string }
  /** A direct child cluster. A SCOPE like the rest — this drawer views training
   *  down the subtree and never edits it, so a subordinate cluster re-points the
   *  card the same way selecting your own does. It was briefly a roster terminal;
   *  roster ops belong to cluster management, not here. */
  | { type: 'child-cluster'; clinicId: string; name: string }
  /** One person in a child cluster. Their numbers come from the `soldiers` rows
   *  the child fans up, so this reads exactly like selecting your own medic.
   *
   *  The row travels WITH the selection rather than as an id the rail looks up:
   *  child rosters are fetched by the expanded node (supervisor_list_clinic_
   *  members), not by the rail, and making the rail resolve a name would cost a
   *  second RPC for data the node is already holding. */
  | {
      type: 'child-soldier'
      clinicId: string
      soldier: {
        id: string
        name: string
        firstName: string | null
        lastName: string | null
        credential: string | null
        avatarId: string | null
      }
    }

interface SupervisorTreeProps {
  medics: ClinicMedic[]
  clinicName?: string | null
  /** Per-soldier numbers, keyed by soldier id. ORDERING ONLY — nothing in this
   *  tree renders a percentage any more. Every number the rail shows is on the
   *  SubjectCard above it, for the one scope you have selected. */
  statById: Map<string, SoldierReadinessEntry>
  selection: TreeSelection
  onSelect: (selection: TreeSelection) => void
  /** Rail search — filters the personnel rows by name. */
  searchQuery?: string
  /** Direct child clusters, fetched once by the rail and handed down — calling
   *  useEchelonSummaries here too would double the RPC for one list. */
  childClusters?: ChildClinicCard[]
}

/** HQ / unassigned grouping bucket — sorts first. */
const HQ_GROUP_ID = HQ_SUB_CLUSTER_ID

export function SupervisorTree({
  medics,
  clinicName,
  statById,
  selection,
  onSelect,
  searchQuery = '',
  childClusters = [],
}: SupervisorTreeProps) {
  const [rootCollapsed, setRootCollapsed] = useState(false)
  const [echelonCollapsed, setEchelonCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const { subClusters } = useSubClusters()

  const q = searchQuery.trim().toLowerCase()
  // A query overrides every collapse. Collapse state is where you left the tree
  // before you started looking; honoring it while filtering hides the exact rows
  // the filter just found, and reads as "no results" rather than "still folded".
  const searching = q.length > 0
  // Worst-first, not A-Z. Finding a specific person is what the rail search is
  // for; the ordering is the only place the triage signal can live once the
  // readiness roster leaves the center pane.
  const sortedMedics = [...medics]
    .filter(m => !q || formatMedicName(m).toLowerCase().includes(q))
    .sort((a, b) => {
      // Exempt last: worst-first is a triage order, and someone the medic roster
      // does not apply to is not the worst case, whatever their percentage reads.
      const ae = !!statById.get(a.id)?.exempt
      const be = !!statById.get(b.id)?.exempt
      if (ae !== be) return ae ? 1 : -1
      const ar = statById.get(a.id)?.readinessPercent ?? 0
      const br = statById.get(b.id)?.readinessPercent ?? 0
      if (ar !== br) return ar - br
      return formatMedicName(a).localeCompare(formatMedicName(b))
    })

  // Group medics by sub-cluster. Unknown/stale ids and null fall to the HQ bucket.
  // Read-only: sub-unit management lives in ClinicPanel / Admin; per-soldier
  // reassignment is editable on the soldier card (MemberEditPopover → Section).
  const knownIds = new Set(subClusters.map(s => s.id))
  const groups: { id: string; name: string; medics: ClinicMedic[] }[] = [
    { id: HQ_GROUP_ID, name: 'HQ / Unassigned', medics: [] },
    ...subClusters.map(s => ({ id: s.id, name: s.name, medics: [] as ClinicMedic[] })),
  ]
  const groupById = new Map(groups.map(g => [g.id, g]))
  for (const m of sortedMedics) {
    const key = m.subClusterId && knownIds.has(m.subClusterId) ? m.subClusterId : HQ_GROUP_ID
    groupById.get(key)!.medics.push(m)
  }
  // Only show the HQ bucket header when there ARE other sub-clusters (otherwise
  // it's a single flat list — no grouping to show).
  const grouped = subClusters.length > 0
  // An empty group is a header that expands into nothing. Every band here is a
  // scope, and a scope over zero people rolls up to zero — a number the
  // supervisor would have to explain rather than act on. Sub-unit CRUD lives in
  // ClinicPanel / Admin, so hiding it here costs no way to manage the sub-cluster.
  const visibleGroups = grouped ? groups.filter(g => g.medics.length > 0) : groups

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rootOpen = searching || !rootCollapsed

  /** No per-person percentage. A column of twenty numbers crowded a 260px rail and
   *  none of them was the number being acted on — the rollup on the band above is.
   *  Readiness still ORDERS this list (worst first), and the selected soldier's
   *  own numbers are on the card at the top of the rail, in full. */
  const renderSoldier = (medic: ClinicMedic) => {
    const loan = medic.isLoanedIn
      ? `Loaned in${medic.clinicName ? ` from ${medic.clinicName}` : ''}`
      : medic.surrogateClinicId ? 'Loaned out' : null
    return (
      <PersonnelRow
        key={medic.id}
        avatar={
          <UserAvatar
            avatarId={medic.avatarId}
            avatarBlob={medic.avatarBlob}
            userId={medic.id}
            firstName={medic.firstName}
            lastName={medic.lastName}
            className="w-8 h-8"
          />
        }
        name={formatMedicName(medic)}
        // Both facts on one line: the row is 8px shorter than the calendar's
        // because a rail shows twenty of them, and a second caption line would
        // cost more height than either fact is worth.
        sub={[medic.credential, loan].filter(Boolean).join(' · ') || undefined}
        selected={selection.type === 'soldier' && selection.soldierId === medic.id}
        onClick={() => onSelect({ type: 'soldier', soldierId: medic.id })}
      />
    )
  }

  return (
    <div>
      <PersonnelGroupBand
        label={clinicName ?? 'My Cluster'}
        expanded={rootOpen}
        onToggle={() => setRootCollapsed(!rootCollapsed)}
        selected={selection.type === 'cluster'}
        onSelect={() => onSelect({ type: 'cluster' })}
      />

      {searching && sortedMedics.length === 0 && (
        <p className="px-4 py-3 text-[10pt] text-tertiary">No personnel match "{searchQuery.trim()}"</p>
      )}

      {rootOpen && !grouped && sortedMedics.map(m => renderSoldier(m))}

      {rootOpen && grouped && visibleGroups.map(group => {
        const collapsed = !searching && collapsedGroups.has(group.id)
        // Every group is a scope, HQ included — a soldier nobody has placed in a
        // squad still has readiness the supervisor has to answer for, and the
        // center pane is the only surface that shows it.
        return (
          <div key={group.id}>
            <PersonnelGroupBand
              depth={1}
              label={group.name}
              expanded={!collapsed}
              onToggle={() => toggleGroup(group.id)}
              selected={selection.type === 'sub-cluster' && selection.subClusterId === group.id}
              onSelect={() => onSelect({ type: 'sub-cluster', subClusterId: group.id, name: group.name })}
            />
            {!collapsed && group.medics.map(m => renderSoldier(m))}
          </div>
        )
      })}

      {/* Subordinate clusters — siblings of my own cluster, not members of it,
          but they read the same: expand one and its personnel list out with the
          readiness the child fanned up. Read-only, always: those numbers are a
          copy of the child's own training state, and a parent-echelon supervisor
          views training down the subtree without writing it. Selecting one is a
          scope, exactly like selecting a sub-cluster: it re-points the card. */}
      {/* Hidden while searching: the filter matches personnel names only, so
          leaving it up puts unfiltered rows in a filtered result. */}
      {!searching && childClusters.length > 0 && (
        <>
          <PersonnelGroupBand
            label="Subordinate Clusters"
            expanded={!echelonCollapsed}
            onToggle={() => setEchelonCollapsed(!echelonCollapsed)}
            trailing={<TreeRowCount>{childClusters.length}</TreeRowCount>}
          />
          {!echelonCollapsed && childClusters.map(card => (
            <SubordinateClusterNode
              key={card.clinicId}
              card={card}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  )
}
