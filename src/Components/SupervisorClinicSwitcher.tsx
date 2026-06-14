/**
 * Cluster-context picker — matches Beacon's filter-panel pattern.
 *
 * Two surfaces:
 *   - SupervisorClinicFilterPanel — list-row panel for CalendarDrawer's
 *     filter sidebar (mirrors categoryFilterPanel + personnelFilterPanel).
 *   - SupervisorClinicCardAction — small ActionButton mounted on the
 *     ClinicPanel clinic card; opens a PreviewOverlay with the same rows.
 *
 * Visible to any user with at least one active loan (supervisorRole no longer
 * gates). The toggle is the single clinic-context knob across calendar /
 * personnel / messages — `supervisingClinicId` drives event-visibility scope
 * via filteredEvents in CalendarPanel (strict scope + assigned-to-me bleed-
 * through). Server still validates every RPC against `auth_clinic_ids()`.
 */

import { useCallback, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowLeftRight, Check } from 'lucide-react'
import { useAuth } from '../Hooks/useAuth'
import { useCalendarStore } from '../stores/useCalendarStore'
import { ActionButton } from './ActionButton'
import { PreviewOverlay } from './PreviewOverlay'

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
    <div data-tour="cluster-filter" className="flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-t border-primary/10">
        <p className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Filter Cluster</p>
      </div>

      <button
        onClick={() => setClusterFilter(null)}
        className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
          clusterFilter === null
            ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
            : 'hover:bg-secondary/5'
        }`}
      >
        <span className="text-[10pt] font-medium text-primary truncate flex-1">All Clusters</span>
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
            <span className="text-[10pt] font-medium text-primary truncate flex-1">{c.name}</span>
            {active && <Check size={14} className="text-themeblue2 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Card-mounted cluster-switch action — mirrors ClinicPanel's pill button
 * (Settings → clinic management). With exactly one alternative cluster the
 * button flips `supervisingClinicId` directly ("Switch to {name}"); with more,
 * it opens a picker.
 */
export function SupervisorClinicCardAction() {
  const options = useSupervisorContextOptions()
  const { supervisingClinicId, setSupervisingClinic } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  const handleClick = useCallback(() => {
    if (!options) return
    if (options.length === 2) {
      const next = options.find((c) => c.id !== supervisingClinicId) ?? options[0]
      setSupervisingClinic(next.id)
      return
    }
    setAnchor(buttonRef.current?.getBoundingClientRect() ?? null)
  }, [options, supervisingClinicId, setSupervisingClinic])

  if (!options) return null

  const otherName = options.length === 2
    ? options.find((c) => c.id !== supervisingClinicId)?.name ?? 'other cluster'
    : null

  return (
    <>
      <div ref={buttonRef} className="contents">
        <ActionButton
          icon={ArrowLeftRight}
          label={otherName ? `Switch to ${otherName}` : 'Switch cluster'}
          onClick={handleClick}
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
