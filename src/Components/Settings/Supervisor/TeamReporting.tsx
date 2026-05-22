import { useMemo, useRef } from 'react'
import { AlertTriangle, Building2, Calendar, Plus } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TeamMetrics } from './supervisorHelpers'
import type { CalendarEvent } from '../../../Types/CalendarTypes'
import { getCategoryMeta } from '../../../Types/CalendarTypes'
import { ActionButton } from '../../ActionButton'
import { ActionPill } from '../../ActionPill'
import { SupervisorClinicCardAction } from '../../SupervisorClinicSwitcher'

function formatEventDate(evt: CalendarEvent): string {
  const start = new Date(evt.start_time)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const eventDay = new Date(start); eventDay.setHours(0, 0, 0, 0)

  let dayLabel: string
  if (eventDay.getTime() === today.getTime()) dayLabel = 'Today'
  else if (eventDay.getTime() === yesterday.getTime()) dayLabel = 'Yesterday'
  else if (eventDay.getTime() === tomorrow.getTime()) dayLabel = 'Tomorrow'
  else dayLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (evt.all_day) return dayLabel
  return `${dayLabel} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

interface TeamReportingProps {
  metrics: TeamMetrics
  medics: ClinicMedic[]
  resolveName: (id: string | null) => string
  onViewSoldier: (soldier: ClinicMedic) => void
  testableTaskMap: Map<string, { taskId: string }[]>
  onNavigateToTask?: (taskId: string) => void
  onNavigateToArea?: (areaName: string) => void
  clinicName?: string | null
  teamEvents: CalendarEvent[]
  onOpenCalendar: () => void
  onOpenEvent: (eventId: string) => void
  /** When provided, the clinic-overview card becomes tap-to-edit (supervisor surface) */
  onEditClinic?: (anchorRect: DOMRect) => void
  /** When provided, an Add-member pill appears in the Soldier Readiness header */
  onAddMember?: (anchorRect: DOMRect) => void
  /** Mobile-only: render the cluster-switch pill on the clinic overview card.
   *  Desktop supervisor surfaces already expose this via SupervisorTree's
   *  SupervisorClinicFilterPanel, so we gate to avoid redundancy. */
  showClusterSwitch?: boolean
}

function readinessColor(pct: number): string {
  if (pct >= 80) return 'bg-themegreen'
  if (pct >= 50) return 'bg-themeyellow'
  return 'bg-themeredred'
}

function readinessTextColor(pct: number): string {
  if (pct >= 80) return 'text-themegreen'
  if (pct >= 50) return 'text-themeyellow'
  return 'text-themeredred'
}

export function TeamReporting({
  metrics,
  medics,
  resolveName,
  onViewSoldier,
  testableTaskMap,
  onNavigateToTask,
  onNavigateToArea,
  clinicName,
  teamEvents,
  onOpenCalendar,
  onOpenEvent,
  onEditClinic,
  onAddMember,
  showClusterSwitch = false,
}: TeamReportingProps) {
  const now = useMemo(() => new Date(), [])
  const addMemberPillRef = useRef<HTMLDivElement>(null)
  const upcomingTeamEvents = useMemo(
    () => teamEvents.filter(e => new Date(e.end_time) >= now),
    [teamEvents, now],
  )
  const SCHEDULE_LIMIT = 5
  const scheduleHidden = Math.max(0, upcomingTeamEvents.length - SCHEDULE_LIMIT)
  const scheduleShown = upcomingTeamEvents.slice(0, SCHEDULE_LIMIT)
  const sortedSoldiers = useMemo(() => {
    return [...metrics.soldierReadiness].sort((a, b) => a.readinessPercent - b.readinessPercent)
  }, [metrics.soldierReadiness])

  const sortedGaps = useMemo(() => {
    return [...metrics.subjectAreaGaps].sort((a, b) => a.coveragePercent - b.coveragePercent)
  }, [metrics.subjectAreaGaps])

  if (metrics.totalMedics === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={28} className="mx-auto mb-3 text-tertiary" />
        <p className="text-sm text-tertiary">No personnel assigned to your cluster.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Clinic Overview Card — tap-to-edit when supervisor (onEditClinic provided).
          Wrapped in relative so the optional cluster-switch ActionPill can ride
          the top edge as an overlay (mobile only — see showClusterSwitch). */}
      <div className="relative mb-5">
      <button
        type="button"
        data-tour="supervisor-clinic-stats"
        disabled={!onEditClinic}
        onClick={(e) => onEditClinic?.(e.currentTarget.getBoundingClientRect())}
        className="w-full text-left rounded-xl bg-themewhite2 px-4 py-3 enabled:hover:bg-secondary/5 enabled:active:scale-[0.99] disabled:cursor-default transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <Building2 size={16} className="text-tertiary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{clinicName ?? 'My Cluster'}</p>
            <p className="text-[9pt] text-tertiary">{medics.length} personnel</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mt-2 ml-11">
          <div className="flex items-center gap-2">
            <span className="text-[9pt] text-tertiary w-18 shrink-0">Readiness</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${readinessColor(metrics.teamReadinessPercent)}`} style={{ width: `${metrics.teamReadinessPercent}%` }} />
            </div>
            <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(metrics.teamReadinessPercent)}`}>{metrics.teamReadinessPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9pt] text-tertiary w-18 shrink-0">Compliance</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${readinessColor(metrics.certCompliancePercent)}`} style={{ width: `${metrics.certCompliancePercent}%` }} />
            </div>
            <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(metrics.certCompliancePercent)}`}>{metrics.certCompliancePercent}%</span>
          </div>
        </div>
      </button>
        {showClusterSwitch && (
          <ActionPill shadow="sm" placement="overlay">
            <SupervisorClinicCardAction />
          </ActionPill>
        )}
      </div>

      {/* Team Schedule */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Team Schedule
        </p>
        <div className="relative">
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {scheduleShown.length === 0 ? (
              <p className="text-sm text-tertiary px-4 py-3">No upcoming events in the next 14 days</p>
            ) : (
              <>
                {scheduleShown.map((evt, idx) => {
                  const meta = getCategoryMeta(evt.category)
                  return (
                    <button
                      type="button"
                      key={evt.id}
                      onClick={() => onOpenEvent(evt.id)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors hover:bg-themeblue3/5 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${meta.solidColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{evt.title}</p>
                        <p className="text-[9pt] text-tertiary">{formatEventDate(evt)}</p>
                      </div>
                      {evt.assigned_to.length > 0 && (
                        <span className="text-[9pt] text-tertiary shrink-0">
                          {evt.assigned_to.length === 1
                            ? resolveName(evt.assigned_to[0])
                            : `${evt.assigned_to.length} assigned`}
                        </span>
                      )}
                    </button>
                  )
                })}
                {scheduleHidden > 0 && (
                  <button
                    type="button"
                    onClick={onOpenCalendar}
                    className="w-full text-left text-[9pt] text-tertiary px-4 py-2 border-t border-tertiary/8 hover:bg-themeblue3/5"
                  >
                    +{scheduleHidden} more in calendar
                  </button>
                )}
              </>
            )}
          </div>
          <ActionPill shadow="sm" placement="overlay">
            <ActionButton icon={Calendar} label="Open full calendar" onClick={onOpenCalendar} />
          </ActionPill>
        </div>
      </div>

      {/* Soldier Readiness */}
      <div data-tour="supervisor-soldier-readiness">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Soldier Readiness
        </p>
        <div className="relative">
          {onAddMember && (
            <ActionPill ref={addMemberPillRef} shadow="sm" placement="overlay">
              <ActionButton
                icon={Plus}
                label="Add member"
                onClick={() => {
                  if (!addMemberPillRef.current) return
                  onAddMember(addMemberPillRef.current.getBoundingClientRect())
                }}
              />
            </ActionPill>
          )}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {sortedSoldiers.map((entry, index) => {
            const soldier = medics.find(m => m.id === entry.soldierId)
            if (!soldier) return null
            return (
              <button
                key={entry.soldierId}
                onClick={() => onViewSoldier(soldier)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-themeblue2/5 text-left active:scale-95 transition-all"
                {...(index === 0 && { 'data-tour': 'supervisor-first-soldier' })}
              >
                <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36 flex items-center gap-1.5">
                  <span className="truncate">{formatMedicName(soldier)}</span>
                  {soldier.isLoanedIn && (
                    <span className="shrink-0 text-[8pt] px-1 py-0.5 rounded bg-themeblue2/10 text-themeblue2 font-medium border border-themeblue2/30" title={`Loaned in from ${soldier.clinicName ?? 'another clinic'}`}>
                      Loan
                    </span>
                  )}
                  {!soldier.isLoanedIn && soldier.surrogateClinicId && (
                    <span className="shrink-0 text-[8pt] px-1 py-0.5 rounded bg-themeyellow/15 text-themeyellow font-medium border border-themeyellow/30" title="Loaned out">
                      Out
                    </span>
                  )}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9pt] text-tertiary w-18 shrink-0">Readiness</span>
                    <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${readinessColor(entry.readinessPercent)}`}
                        style={{ width: `${entry.readinessPercent}%` }}
                      />
                    </div>
                    <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(entry.readinessPercent)}`}>
                      {entry.readinessPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9pt] text-tertiary w-18 shrink-0">Compliance</span>
                    <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${readinessColor(entry.compliancePercent)}`}
                        style={{ width: `${entry.compliancePercent}%` }}
                      />
                    </div>
                    <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(entry.compliancePercent)}`}>
                      {entry.compliancePercent}%
                    </span>
                  </div>
                </div>
                {entry.overdueCount > 0 && (
                  <span className="text-[9pt] font-medium text-themeredred bg-themeredred/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {entry.overdueCount}
                  </span>
                )}
              </button>
            )
          })}
          </div>
        </div>
      </div>

      {/* Coverage Gaps */}
      <div data-tour="supervisor-coverage-gaps">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Coverage Gaps
        </p>
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {sortedGaps.map((gap, index) => (
            <button
              key={gap.areaName}
              {...(index === 0 && { 'data-tour': 'supervisor-first-area' })}
              onClick={() => {
                if (onNavigateToArea) {
                  onNavigateToArea(gap.areaName)
                } else {
                  const tasks = testableTaskMap.get(gap.areaName)
                  if (tasks?.[0] && onNavigateToTask) onNavigateToTask(tasks[0].taskId)
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-themeblue2/5 text-left active:scale-95 transition-all"
            >
              <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">
                {gap.areaName}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={gap.coveragePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-all ${readinessColor(gap.coveragePercent)}`}
                    style={{ width: `${gap.coveragePercent}%` }}
                  />
                </div>
              </div>
              <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(gap.coveragePercent)}`}>
                {gap.coveragePercent}%
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
