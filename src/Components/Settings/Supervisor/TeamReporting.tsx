import { useMemo } from 'react'
import { AlertTriangle, Building2, Calendar } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TeamMetrics } from './supervisorHelpers'
import type { CalendarEvent } from '../../../Types/CalendarTypes'
import { getCategoryMeta } from '../../../Types/CalendarTypes'
import { ActionButton } from '../../ActionButton'

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
}: TeamReportingProps) {
  const now = useMemo(() => new Date(), [])
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
        <p className="text-sm text-tertiary">No personnel assigned to your clinic.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Clinic Overview Card */}
      <div data-tour="supervisor-clinic-stats" className="rounded-xl bg-themewhite2 px-4 py-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <Building2 size={16} className="text-tertiary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{clinicName ?? 'My Clinic'}</p>
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
      </div>

      {/* Team Schedule */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Team Schedule
        </p>
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {teamEvents.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <p className="text-sm text-tertiary flex-1">No events in the next 14 days</p>
              <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-sm border border-tertiary/15">
                <ActionButton icon={Calendar} label="Open full calendar" onClick={onOpenCalendar} />
              </div>
            </div>
          ) : (
            <>
              {teamEvents.map((evt, idx) => {
                const isPast = new Date(evt.end_time) < now
                const meta = getCategoryMeta(evt.category)
                return (
                  <div
                    key={evt.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-opacity ${idx > 0 ? 'border-t border-tertiary/8' : ''} ${isPast ? 'opacity-50' : ''}`}
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
                  </div>
                )
              })}
              <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-tertiary/8">
                <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-sm border border-tertiary/15">
                  <ActionButton icon={Calendar} label="Open full calendar" onClick={onOpenCalendar} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Soldier Readiness */}
      <div data-tour="supervisor-soldier-readiness">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
          Soldier Readiness
        </p>
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
                <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">
                  {formatMedicName(soldier)}
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
