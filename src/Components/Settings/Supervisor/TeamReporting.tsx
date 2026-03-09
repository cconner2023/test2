import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import { subjectAreaIcons } from '../../../Data/TrainingConstants'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TeamMetrics } from './supervisorHelpers'

interface TeamReportingProps {
  metrics: TeamMetrics
  medics: ClinicMedic[]
  resolveName: (id: string | null) => string
  onViewSoldier: (soldier: ClinicMedic) => void
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
}: TeamReportingProps) {
  const evalDelta = metrics.evaluationsThisPeriod - metrics.evaluationsLastPeriod

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
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-tertiary/10 bg-themewhite2 p-4">
          <p className={`text-2xl font-bold ${readinessTextColor(metrics.teamReadinessPercent)}`}>
            {metrics.teamReadinessPercent}%
          </p>
          <p className="text-[11px] text-tertiary/60 mt-0.5">Team Readiness</p>
        </div>
        <div className="rounded-lg border border-tertiary/10 bg-themewhite2 p-4">
          <p className={`text-2xl font-bold ${readinessTextColor(metrics.certCompliancePercent)}`}>
            {metrics.certCompliancePercent}%
          </p>
          <p className="text-[11px] text-tertiary/60 mt-0.5">Cert Compliance</p>
        </div>
      </div>

      <div className="rounded-lg border border-tertiary/10 bg-themewhite2 p-4">
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold text-primary">{metrics.evaluationsThisPeriod}</p>
          {evalDelta !== 0 && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${evalDelta > 0 ? 'text-themegreen' : 'text-themeredred'}`}>
              {evalDelta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {evalDelta > 0 ? '+' : ''}{evalDelta}
            </span>
          )}
          {evalDelta === 0 && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-tertiary/50">
              <Minus size={12} />0
            </span>
          )}
        </div>
        <p className="text-[11px] text-tertiary/60 mt-0.5">Evaluations (30d)</p>
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
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-themewhite2 transition-colors text-left"
              >
                <span className="text-sm text-primary font-medium min-w-0 truncate flex-shrink-0 w-28">
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
            <div
              key={gap.areaName}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg"
            >
              <span className="text-tertiary/50 flex-shrink-0">
                {subjectAreaIcons[gap.areaName]}
              </span>
              <span className="text-sm text-primary min-w-0 truncate flex-shrink-0 w-36">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
