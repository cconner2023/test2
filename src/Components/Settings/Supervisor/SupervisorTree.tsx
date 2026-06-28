import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import { SupervisorClinicFilterPanel } from '../../SupervisorClinicSwitcher'
import { useSubClusters } from '../../../Hooks/useSubClusters'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'

export type TreeSelection =
  | { type: 'all-personnel' }
  | { type: 'soldier'; soldierId: string }

interface SupervisorTreeProps {
  medics: ClinicMedic[]
  selection: TreeSelection
  onSelect: (selection: TreeSelection) => void
}

/** HQ / unassigned grouping bucket — sorts first. */
const HQ_GROUP_ID = '__hq__'

export function SupervisorTree({
  medics,
  selection,
  onSelect,
}: SupervisorTreeProps) {
  const [personnelCollapsed, setPersonnelCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const { subClusters } = useSubClusters()

  const isActive = (sel: TreeSelection): boolean => {
    if (sel.type !== selection.type) return false
    if (sel.type === 'soldier' && selection.type === 'soldier') return sel.soldierId === selection.soldierId
    return true
  }

  const nodeClass = (sel: TreeSelection) =>
    isActive(sel)
      ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
      : 'hover:bg-secondary/5'

  const sortedMedics = [...medics].sort((a, b) =>
    formatMedicName(a).localeCompare(formatMedicName(b))
  )

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
  const visibleGroups = grouped ? groups.filter(g => g.id !== HQ_GROUP_ID || g.medics.length > 0) : groups

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderSoldier = (medic: ClinicMedic) => (
    <div
      key={medic.id}
      role="button"
      tabIndex={0}
      className={`flex items-center gap-3 py-3 px-4 transition-colors cursor-pointer active:scale-95 ${nodeClass({ type: 'soldier', soldierId: medic.id })}`}
      onClick={() => onSelect({ type: 'soldier', soldierId: medic.id })}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'soldier', soldierId: medic.id }) }}
    >
      <UserAvatar avatarId={medic.avatarId} avatarBlob={medic.avatarBlob} userId={medic.id} firstName={medic.firstName} lastName={medic.lastName} className="w-10 h-10" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">{formatMedicName(medic)}</p>
        {medic.credential && (
          <p className="text-[9pt] text-tertiary truncate">{medic.credential}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="relative h-full flex flex-col py-1">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Clinic-context picker — only renders for loaned supervisors. */}
        <SupervisorClinicFilterPanel />

        <div className="shrink-0 px-4 py-3 border-b border-primary/10">
          <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Personnel</p>
        </div>

        {/* All Personnel root */}
        <div
          role="button"
          tabIndex={0}
          className={`flex items-center gap-2 py-2 px-4 transition-colors cursor-pointer ${nodeClass({ type: 'all-personnel' })}`}
          onClick={() => onSelect({ type: 'all-personnel' })}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'all-personnel' }) }}
        >
          <button
            className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
            onClick={(e) => { e.stopPropagation(); setPersonnelCollapsed(!personnelCollapsed) }}
          >
            {personnelCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <span className="text-[10pt] font-medium text-primary truncate flex-1">All Personnel</span>
        </div>

        {/* Grouped (by sub-cluster) or flat soldier list */}
        {!personnelCollapsed && !grouped && sortedMedics.map(renderSoldier)}

        {!personnelCollapsed && grouped && visibleGroups.map(group => {
          const collapsed = collapsedGroups.has(group.id)
          return (
            <div key={group.id}>
              <div className="flex items-center gap-2 py-2 px-4 bg-secondary/5 border-y border-primary/5">
                <button
                  className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
                  onClick={() => toggleGroup(group.id)}
                >
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="text-[9pt] font-medium text-tertiary uppercase tracking-wide truncate flex-1">
                  {group.name}
                </span>
              </div>
              {!collapsed && group.medics.map(renderSoldier)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
