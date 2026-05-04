import { useRef, useState } from 'react'
import { ChevronRight, ChevronDown, Plus } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import { ActionPill } from '../../ActionPill'
import { ActionButton } from '../../ActionButton'
import { SupervisorClinicFilterPanel } from '../../SupervisorClinicSwitcher'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'

export type TreeSelection =
  | { type: 'all-personnel' }
  | { type: 'soldier'; soldierId: string }

interface SupervisorTreeProps {
  medics: ClinicMedic[]
  selection: TreeSelection
  onSelect: (selection: TreeSelection) => void
  readinessForSoldier: (soldierId: string) => number
  /** When provided, an Add-member pill appears in the Personnel header */
  onAddMember?: (anchorRect: DOMRect) => void
}

function readinessColor(pct: number): string {
  if (pct >= 80) return 'bg-themegreen'
  if (pct >= 50) return 'bg-themeyellow'
  return 'bg-themeredred'
}

export function SupervisorTree({
  medics,
  selection,
  onSelect,
  readinessForSoldier,
  onAddMember,
}: SupervisorTreeProps) {
  const [personnelCollapsed, setPersonnelCollapsed] = useState(false)
  const addPillRef = useRef<HTMLDivElement>(null)

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
    <div className="relative h-full flex flex-col py-1">
      {onAddMember && (
        <ActionPill ref={addPillRef} shadow="sm" className="absolute top-2 right-2 z-10">
          <ActionButton
            icon={Plus}
            label="Add member"
            onClick={() => {
              if (!addPillRef.current) return
              onAddMember(addPillRef.current.getBoundingClientRect())
            }}
          />
        </ActionPill>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Clinic-context picker — only renders for loaned supervisors. */}
        <SupervisorClinicFilterPanel />

        <div className="shrink-0 px-4 py-3 border-b border-primary/10 flex items-center gap-2">
          <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Personnel</p>
          {medics.length > 0 && (
            <span className="text-[10pt] px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
              {medics.length}
            </span>
          )}
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

        {/* Individual soldiers */}
        {!personnelCollapsed && sortedMedics.map((medic) => {
          const pct = readinessForSoldier(medic.id)
          return (
            <div
              key={medic.id}
              role="button"
              tabIndex={0}
              className={`flex items-center gap-3 py-3 px-4 transition-colors cursor-pointer active:scale-95 ${nodeClass({ type: 'soldier', soldierId: medic.id })}`}
              onClick={() => onSelect({ type: 'soldier', soldierId: medic.id })}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'soldier', soldierId: medic.id }) }}
            >
              <UserAvatar avatarId={medic.avatarId} firstName={medic.firstName} lastName={medic.lastName} className="w-10 h-10" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">{formatMedicName(medic)}</p>
                {medic.credential && (
                  <p className="text-[9pt] text-tertiary truncate">{medic.credential}</p>
                )}
              </div>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${readinessColor(pct)}`} />
            </div>
          )
        })}

      </div>
    </div>
  )
}
