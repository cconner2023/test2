import { useState } from 'react'
import { ChevronRight, ChevronDown, Users, User, BarChart3 } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'

// ─── Tree Selection Types ─────────────────────────────────────────────────────

export type TreeSelection =
  | { type: 'all-personnel' }
  | { type: 'soldier'; soldierId: string }
  | { type: 'team-insights' }

interface SupervisorTreeProps {
  medics: ClinicMedic[]
  selection: TreeSelection
  onSelect: (selection: TreeSelection) => void
}

export function SupervisorTree({
  medics,
  selection,
  onSelect,
}: SupervisorTreeProps) {
  const [personnelCollapsed, setPersonnelCollapsed] = useState(false)

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

  return (
    <div className="flex flex-col py-1">
      {/* ── PERSONNEL Section ─────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-3 border-b border-primary/10">
        <p className="text-[10pt] font-medium text-tertiary/70 uppercase tracking-wide">Personnel</p>
      </div>

      {/* All Personnel root */}
      <div
        role="button"
        tabIndex={0}
        className={`flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer ${nodeClass({ type: 'all-personnel' })}`}
        style={{ paddingLeft: '24px' }}
        onClick={() => onSelect({ type: 'all-personnel' })}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'all-personnel' }) }}
      >
        <button
          className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
          onClick={(e) => { e.stopPropagation(); setPersonnelCollapsed(!personnelCollapsed) }}
        >
          {personnelCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <Users size={16} className="text-themeblue3 shrink-0" />
        <span className="text-[10pt] font-medium text-primary truncate flex-1">All Personnel</span>
        {medics.length > 0 && (
          <span className="text-[10pt] px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium shrink-0">
            {medics.length}
          </span>
        )}
      </div>

      {/* Individual soldiers */}
      {!personnelCollapsed && sortedMedics.map((medic) => (
        <div
          key={medic.id}
          role="button"
          tabIndex={0}
          className={`flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer ${nodeClass({ type: 'soldier', soldierId: medic.id })}`}
          style={{ paddingLeft: '62px' }}
          onClick={() => onSelect({ type: 'soldier', soldierId: medic.id })}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'soldier', soldierId: medic.id }) }}
        >
          <User size={16} className="text-tertiary shrink-0" />
          <span className="text-[10pt] text-primary truncate flex-1">{formatMedicName(medic)}</span>
          {medic.credential && (
            <span className="text-[10pt] text-tertiary shrink-0">{medic.credential}</span>
          )}
        </div>
      ))}

      {/* ── Team Insights ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-primary/10 mt-1" />
      <div
        role="button"
        tabIndex={0}
        className={`flex items-center gap-2 py-2 pr-6 transition-colors cursor-pointer ${nodeClass({ type: 'team-insights' })}`}
        style={{ paddingLeft: '42px' }}
        onClick={() => onSelect({ type: 'team-insights' })}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'team-insights' }) }}
      >
        <BarChart3 size={16} className="text-themeblue3 shrink-0" />
        <span className="text-[10pt] font-medium text-primary truncate">Team Insights</span>
      </div>
    </div>
  )
}
