import { useMemo } from 'react'
import { AlertTriangle, Building2 } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TeamMetrics } from './supervisorHelpers'

interface TeamReportingProps {
  metrics: TeamMetrics
  medics: ClinicMedic[]
  resolveName: (id: string | null) => string
  onViewSoldier: (soldier: ClinicMedic) => void
  testableTaskMap: Map<string, { taskId: string }[]>
  onNavigateToTask?: (taskId: string) => void
  clinicName?: string | null
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
  clinicName,
}: TeamReportingProps) {
  const sortedSoldiers = useMemo(() => {
    return [...metrics.soldierReadiness].sort((a, b) => a.readinessPercent - b.readinessPercent)
  }, [metrics.soldierReadiness])

  const sortedGaps = useMemo(() => {
    return [...metrics.subjectAreaGaps].sort((a, b) => a.coveragePercent - b.coveragePercent)
  }, [metrics.subjectAreaGaps])

  if (metrics.totalMedics === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={28} className="mx-auto mb-3 text-tertiary/30" />
        <p className="text-sm text-tertiary/60">No personnel assigned to your clinic.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Clinic Overview Card */}
      <div className="rounded-xl bg-themewhite2 px-4 py-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <Building2 size={16} className="text-tertiary/50" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{clinicName ?? 'My Clinic'}</p>
            <p className="text-[9pt] text-tertiary/50">{medics.length} personnel</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mt-2 ml-11">
          <div className="flex items-center gap-2">
            <span className="text-[9pt] text-tertiary/50 w-18 shrink-0">Readiness</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${readinessColor(metrics.teamReadinessPercent)}`} style={{ width: `${metrics.teamReadinessPercent}%` }} />
            </div>
            <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(metrics.teamReadinessPercent)}`}>{metrics.teamReadinessPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9pt] text-tertiary/50 w-18 shrink-0">Compliance</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${readinessColor(metrics.certCompliancePercent)}`} style={{ width: `${metrics.certCompliancePercent}%` }} />
            </div>
            <span className={`text-[9pt] font-medium w-8 text-right ${readinessTextColor(metrics.certCompliancePercent)}`}>{metrics.certCompliancePercent}%</span>
          </div>
        </div>
      </div>

      {/* Soldier Readiness */}
      <div>
        <h3 className="text-xs font-semibold text-tertiary/50 uppercase tracking-wider mb-3">
          Soldier Readiness
        </h3>
        <div className="space-y-2">
          {sortedSoldiers.map((entry) => {
            const soldier = medics.find(m => m.id === entry.soldierId)
            if (!soldier) return null
            return (
              <button
                key={entry.soldierId}
                onClick={() => onViewSoldier(soldier)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-themewhite2 text-left active:scale-95 transition-all"
              >
                <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">
                  {formatMedicName(soldier)}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="h-2 rounded-full bg-tertiary/10 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={entry.readinessPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${readinessColor(entry.readinessPercent)}`}
                      style={{ width: `${entry.readinessPercent}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs font-medium w-9 text-right ${readinessTextColor(entry.readinessPercent)}`}>
                  {entry.readinessPercent}%
                </span>
                {entry.overdueCount > 0 && (
                  <span className="text-[10px] font-medium text-themeredred bg-themeredred/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {entry.overdueCount} overdue
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Coverage Gaps */}
      <div>
        <h3 className="text-xs font-semibold text-tertiary/50 uppercase tracking-wider mb-3">
          Coverage Gaps
        </h3>
        <div className="space-y-2">
          {sortedGaps.map((gap) => (
            <button
              key={gap.areaName}
              onClick={() => {
                const tasks = testableTaskMap.get(gap.areaName)
                if (tasks?.[0] && onNavigateToTask) onNavigateToTask(tasks[0].taskId)
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-themewhite2 text-left active:scale-95 transition-all"
            >
              <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">
                {gap.areaName}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="h-2 rounded-full bg-tertiary/10 overflow-hidden"
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
              <span className={`text-xs font-medium w-9 text-right ${readinessTextColor(gap.coveragePercent)}`}>
                {gap.coveragePercent}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
