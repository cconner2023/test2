/**
 * Cluster-context picker — matches Beacon's filter-panel pattern.
 *
 * Two surfaces:
 *   - SupervisorClinicFilterPanel — operating-as rows. CalendarDrawer's filter
 *     sidebar and the supervisor rail both mount it (mirrors
 *     categoryFilterPanel + personnelFilterPanel).
 *   - ClusterFilterPanel — render-only multi-select, calendar only.
 *
 * A third surface, SupervisorClinicCardAction, used to ride the supervisor's
 * clinic overview card on mobile because that surface had no filter sidebar to
 * host the rows. The supervisor rail now renders into a mobile sheet, so the
 * picker itself is reachable there and the card action was redundant.
 *
 * Visible to any user with at least one active loan (supervisorRole no longer
 * gates). The toggle is the single clinic-context knob across calendar /
 * personnel / messages — `supervisingClinicId` drives event-visibility scope
 * via filteredEvents in CalendarPanel (strict scope + assigned-to-me bleed-
 * through). Server still validates every RPC against `auth_clinic_ids()`.
 */

import { useShallow } from 'zustand/react/shallow'
import { Check } from 'lucide-react'
import { useAuth } from '../Hooks/useAuth'
import { useCalendarStore } from '../stores/useCalendarStore'

interface ClinicOption {
  id: string
  name: string
}

function useSupervisorContextOptions(): ClinicOption[] | null {
  const { profile, clinicId, surrogateClinicIds } = useAuth()
  if (!clinicId || surrogateClinicIds.length === 0) return null
  const loans = profile.surrogateClinics ?? []
  return [
    { id: clinicId, name: profile.clinicName ?? 'Assigned' },
    ...surrogateClinicIds.map((id) => ({
      id,
      name: loans.find((c) => c.id === id)?.name ?? 'Surrogate',
    })),
  ]
}

/**
 * Desktop filter-sidebar variant — mirrors categoryFilterPanel structure.
 *
 * Typography here is the rail's, not its own: a section label is 9pt semibold
 * secondary uppercase, an option row is a 10pt normal-weight secondary line, the
 * same two steps TreeRow uses below it. The panel used to run its label at 10pt
 * medium and its rows at 10pt medium primary, which put two more weights into a
 * 260px column that already had two.
 */
export function SupervisorClinicFilterPanel() {
  const options = useSupervisorContextOptions()
  const { supervisingClinicId, setSupervisingClinic } = useAuth()
  if (!options) return null

  return (
    <div className="flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-t border-primary/10">
        <p className="text-[9pt] font-semibold text-secondary uppercase tracking-wider">Operating As</p>
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
            <span className="text-[10pt] text-secondary truncate flex-1">{c.name}</span>
            {active && <Check size={14} className="text-themeblue2 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Render-only cluster filter — narrows which clusters' events the calendar
 * shows WITHOUT touching supervisingClinicId (operating-as). Multi-select,
 * mirrors categoryFilterPanel: "All Clusters" clears to null; toggling rows
 * builds the selection; selecting every cluster collapses back to null.
 * Shown only to users with at least one active loan.
 */
export function ClusterFilterPanel() {
  const options = useSupervisorContextOptions()
  const { clusterFilter, setClusterFilter } = useCalendarStore(useShallow(s => ({
    clusterFilter: s.clusterFilter,
    setClusterFilter: s.setClusterFilter,
  })))
  if (!options) return null

  const activeSet = clusterFilter === null ? new Set(options.map(c => c.id)) : new Set(clusterFilter)
  const toggle = (id: string) => {
    const next = new Set(activeSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const arr = options.map(c => c.id).filter(c => next.has(c))
    setClusterFilter(arr.length === 0 || arr.length === options.length ? null : arr)
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-t border-primary/10">
        <p className="text-[9pt] font-semibold text-secondary uppercase tracking-wider">Filter Cluster</p>
      </div>

      <button
        onClick={() => setClusterFilter(null)}
        className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
          clusterFilter === null
            ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
            : 'hover:bg-secondary/5'
        }`}
      >
        <span className="text-[10pt] text-secondary truncate flex-1">All Clusters</span>
      </button>

      {options.map(c => {
        const active = activeSet.has(c.id)
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
              active
                ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                : 'hover:bg-secondary/5'
            }`}
          >
            <span className="text-[10pt] text-secondary truncate flex-1">{c.name}</span>
            {active && <Check size={14} className="text-themeblue2 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * NOTE: the standalone SUB-CLUSTER filter panel was removed — sub-unit scoping in
 * the calendar now lives in the grouped personnel tree (CalendarDrawer), where a
 * sub-cluster header filters all its members. Property keeps its own local
 * sub-cluster lens. See v2/calendar.
 */

