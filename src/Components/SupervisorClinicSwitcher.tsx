/**
 * Supervisor clinic-context picker — matches Beacon's filter-panel pattern.
 *
 * Two surfaces:
 *   - SupervisorClinicFilterPanel — list-row panel for CalendarDrawer's
 *     filter sidebar (mirrors categoryFilterPanel + personnelFilterPanel).
 *   - SupervisorClinicCardAction — small ActionButton mounted on the
 *     ClinicPanel clinic card; opens a PreviewOverlay with the same rows.
 *
 * Both render nothing for users without a supervisor role or without a
 * surrogate. Server validates every supervisor RPC against `auth_clinic_ids()`
 * regardless of the toggle — this is purely a UI affordance.
 */

import { useRef, useState } from 'react'
import { Building2, Check } from 'lucide-react'
import { useAuth } from '../Hooks/useAuth'
import { ActionButton } from './ActionButton'
import { PreviewOverlay } from './PreviewOverlay'

interface ClinicOption {
  id: string
  name: string
}

function useSupervisorContextOptions(): ClinicOption[] | null {
  const {
    isSupervisorRole, profile, clinicId, surrogateClinicId,
  } = useAuth()
  if (!isSupervisorRole || !surrogateClinicId || !clinicId) return null
  return [
    { id: clinicId, name: profile.clinicName ?? 'Assigned' },
    { id: surrogateClinicId, name: profile.surrogateClinicName ?? 'Surrogate' },
  ]
}

/** Desktop filter-sidebar variant — mirrors categoryFilterPanel structure. */
export function SupervisorClinicFilterPanel() {
  const options = useSupervisorContextOptions()
  const { supervisingClinicId, setSupervisingClinic } = useAuth()
  if (!options) return null

  return (
    <div data-tour="supervisor-clinic-filter" className="flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-t border-primary/10">
        <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Operating As</p>
      </div>
      {options.map(c => {
        const active = supervisingClinicId === c.id
        return (
          <button
            key={c.id}
            onClick={() => setSupervisingClinic(c.id)}
            className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
              active
                ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                : 'hover:bg-secondary/5'
            }`}
          >
            <span className="text-[10pt] font-medium text-primary truncate flex-1">{c.name}</span>
            {active && <Check size={14} className="text-themeblue2 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

/** ClinicPanel clinic-card affordance — small icon button + popover picker. */
export function SupervisorClinicCardAction() {
  const options = useSupervisorContextOptions()
  const { supervisingClinicId, setSupervisingClinic } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  if (!options) return null

  return (
    <>
      <div ref={buttonRef} className="contents">
        <ActionButton
          icon={Building2}
          label="Switch clinic context"
          onClick={() => setAnchor(buttonRef.current?.getBoundingClientRect() ?? null)}
        />
      </div>
      <PreviewOverlay
        isOpen={!!anchor}
        onClose={() => setAnchor(null)}
        anchorRect={anchor}
        title="Operating as"
        maxWidth={300}
      >
        <div>
          {options.map(c => {
            const active = supervisingClinicId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSupervisingClinic(c.id); setAnchor(null) }}
                className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors ${
                  active
                    ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                    : 'hover:bg-secondary/5'
                }`}
              >
                <span className="text-[10pt] font-medium text-primary truncate flex-1">{c.name}</span>
                {active && <Check size={14} className="text-themeblue2 shrink-0" />}
              </button>
            )
          })}
        </div>
      </PreviewOverlay>
    </>
  )
}
