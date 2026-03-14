import { useState } from 'react'
import { ChevronRight, ChevronDown, Building2 } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { ClinicCardData } from './ClinicManagement'

export type TreeSelection =
  | { type: 'all-personnel' }
  | { type: 'soldier'; soldierId: string }
  | { type: 'team-insights' }
  | { type: 'clinic-management' }
  | { type: 'clinic'; clinicId: string }

interface SupervisorTreeProps {
  medics: ClinicMedic[]
  clinics: ClinicCardData[]
  selection: TreeSelection
  onSelect: (selection: TreeSelection) => void
  readinessForSoldier: (soldierId: string) => number
}

function readinessColor(pct: number): string {
  if (pct >= 80) return 'bg-themegreen'
  if (pct >= 50) return 'bg-themeyellow'
  return 'bg-themeredred'
}

export function SupervisorTree({
  medics,
  clinics,
  selection,
  onSelect,
  readinessForSoldier,
}: SupervisorTreeProps) {
  const [personnelCollapsed, setPersonnelCollapsed] = useState(false)
  const [clinicsCollapsed, setClinicsCollapsed] = useState(false)

  const isActive = (sel: TreeSelection): boolean => {
    if (sel.type !== selection.type) return false
    if (sel.type === 'soldier' && selection.type === 'soldier') return sel.soldierId === selection.soldierId
    if (sel.type === 'clinic' && selection.type === 'clinic') return sel.clinicId === selection.clinicId
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
    <div className="h-full flex flex-col py-1">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="shrink-0 px-4 py-3 border-b border-primary/10 flex items-center justify-between">
          <p className="text-xs font-medium text-tertiary/70 uppercase tracking-wide">Personnel</p>
          {medics.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary/70 font-medium">
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
          <span className="text-xs font-medium text-primary truncate flex-1">All Personnel</span>
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
                  <p className="text-[10px] text-tertiary/50 truncate">{medic.credential}</p>
                )}
              </div>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${readinessColor(pct)}`} />
            </div>
          )
        })}

        {/* Clinics */}
        <div className="shrink-0 px-4 py-3 border-t border-primary/10 mt-1 flex items-center justify-between">
          <p className="text-xs font-medium text-tertiary/70 uppercase tracking-wide">Clinics</p>
          {clinics.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary/70 font-medium">
              {clinics.length}
            </span>
          )}
        </div>

        {/* Clinics expand/collapse */}
        <button
          className="flex items-center gap-2 py-2 px-4 w-full text-left hover:bg-secondary/5 transition-colors"
          onClick={() => setClinicsCollapsed(!clinicsCollapsed)}
        >
          <div className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0">
            {clinicsCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </div>
          <span className="text-xs font-medium text-primary truncate flex-1">All Clinics</span>
        </button>

        {/* Individual clinic cards */}
        {!clinicsCollapsed && clinics.map((clinic) => (
          <div
            key={clinic.id}
            role="button"
            tabIndex={0}
            className={`flex items-center gap-3 py-3 px-4 transition-colors cursor-pointer active:scale-95 ${nodeClass({ type: 'clinic', clinicId: clinic.id })}`}
            onClick={() => onSelect({ type: 'clinic', clinicId: clinic.id })}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ type: 'clinic', clinicId: clinic.id }) }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
              <Building2 size={16} className="text-tertiary/50" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">{clinic.name}</p>
              <p className="text-[10px] text-tertiary/50">{clinic.personnelCount} personnel</p>
            </div>
            <ChevronRight size={14} className="text-tertiary/30 shrink-0" />
          </div>
        ))}

      </div>
    </div>
  )
}
