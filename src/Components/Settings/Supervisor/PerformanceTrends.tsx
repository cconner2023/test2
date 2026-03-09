import { useState, useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TrendPeriod, TrendBucket } from './supervisorHelpers'

interface PerformanceTrendsProps {
  computeTrends: (period: TrendPeriod, groupBy: 'week' | 'month', soldierId?: string) => TrendBucket[]
  medics: ClinicMedic[]
  resolveName: (id: string | null) => string
}

/**
 * Renders a fragment (no wrapping div) so that its scroll area + summary bar
 * become direct flex children of the parent flex column — same pattern as
 * AdminUsersList inside AdminDrawer.
 */
export function PerformanceTrends({
  computeTrends,
  medics,
  resolveName,
}: PerformanceTrendsProps) {
  const [soldierFilter, setSoldierFilter] = useState<string>('')

  const buckets = useMemo(
    () => computeTrends('all', 'month', soldierFilter || undefined),
    [computeTrends, soldierFilter]
  )

  const totalEvaluations = useMemo(
    () => buckets.reduce((sum, b) => sum + b.totalEvaluations, 0),
    [buckets]
  )

  const totalPass = useMemo(
    () => buckets.reduce((sum, b) => sum + b.passCount, 0),
    [buckets]
  )

  const totalFail = useMemo(
    () => buckets.reduce((sum, b) => sum + b.failCount, 0),
    [buckets]
  )

  const overallPassRate = totalEvaluations > 0 ? Math.round((totalPass / totalEvaluations) * 100) : 0

  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map(b => Math.max(b.passCount, b.failCount))),
    [buckets]
  )

  return (
    <>
      {/* Scrollable chart content — direct flex child of parent */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 md:px-5 md:py-5">
        {/* Soldier filter */}
        <div className="mb-5">
          <select
            value={soldierFilter}
            onChange={(e) => setSoldierFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-sm text-primary
                       border border-tertiary/10 outline-none focus:ring-1 focus:ring-themeblue2/40"
          >
            <option value="">All Personnel</option>
            {medics.map(m => (
              <option key={m.id} value={m.id}>{formatMedicName(m)}</option>
            ))}
          </select>
        </div>

        {/* Chart or empty state */}
        {buckets.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 size={28} className="mx-auto mb-3 text-tertiary/30" />
            <p className="text-sm text-tertiary/60">No evaluations recorded yet.</p>
          </div>
        ) : (
          <div>
            <h3 className="text-xs font-semibold text-tertiary/50 uppercase tracking-wider mb-3">
              Evaluations Over Time
            </h3>

            <div className="rounded-lg border border-tertiary/10 bg-themewhite2 p-4">
              {/* Chart with Y-axis */}
              <div className="flex gap-1.5" style={{ height: 180 }}>
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between items-end shrink-0 w-5">
                  <span className="text-[9px] text-tertiary/40 leading-none">{maxCount}</span>
                  <span className="text-[9px] text-tertiary/40 leading-none">0</span>
                  <span className="text-[9px] text-tertiary/40 leading-none">-{maxCount}</span>
                </div>

                {/* Bar chart area */}
                <div className="flex-1 relative">
                  {/* Center line at y=0 */}
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-tertiary/25 -translate-y-px z-[1]" />

                  <div className="flex h-full w-full gap-1">
                    {buckets.map((bucket) => {
                      const passH = maxCount > 0 ? (bucket.passCount / maxCount) * 100 : 0
                      const failH = maxCount > 0 ? (bucket.failCount / maxCount) * 100 : 0
                      return (
                        <div key={bucket.periodStart} className="flex-1 flex flex-col h-full">
                          {/* Upper half — GO bars grow upward from center */}
                          <div className="flex-1 flex flex-col justify-end items-center px-0.5">
                            {bucket.passCount > 0 && (
                              <div
                                className="w-full max-w-7 rounded-t bg-themegreen transition-all"
                                style={{ height: `${passH}%` }}
                                title={`${bucket.label}: ${bucket.passCount} GO`}
                              />
                            )}
                          </div>
                          {/* Lower half — NO GO bars grow downward from center */}
                          <div className="flex-1 flex flex-col justify-start items-center px-0.5">
                            {bucket.failCount > 0 && (
                              <div
                                className="w-full max-w-7 rounded-b bg-themeredred transition-all"
                                style={{ height: `${failH}%` }}
                                title={`${bucket.label}: ${bucket.failCount} NO GO`}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* X-axis labels */}
              <div className="flex gap-1 mt-1.5 ml-7">
                {buckets.map((bucket) => (
                  <div key={bucket.periodStart} className="flex-1 text-center">
                    <span className="text-[8px] text-tertiary/50 leading-none">{bucket.label}</span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-tertiary/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-themegreen" />
                  <span className="text-[10px] text-tertiary/60">GO</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-themeredred" />
                  <span className="text-[10px] text-tertiary/60">NO GO</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary — pinned at bottom, outside scroll, direct flex child of parent */}
      {buckets.length > 0 && (
        <div
          className="shrink-0 px-4 py-3 border-t border-primary/10 bg-themewhite"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{totalEvaluations}</p>
                <p className="text-[9px] text-tertiary/50 uppercase tracking-wide">Total</p>
              </div>
              <div className="w-px h-6 bg-tertiary/10" />
              <div className="text-center">
                <p className="text-lg font-bold text-themegreen">{totalPass}</p>
                <p className="text-[9px] text-tertiary/50 uppercase tracking-wide">GO</p>
              </div>
              <div className="w-px h-6 bg-tertiary/10" />
              <div className="text-center">
                <p className="text-lg font-bold text-themeredred">{totalFail}</p>
                <p className="text-[9px] text-tertiary/50 uppercase tracking-wide">NO GO</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${overallPassRate >= 80 ? 'text-themegreen' : overallPassRate >= 50 ? 'text-themeyellow' : 'text-themeredred'}`}>
                {overallPassRate}%
              </p>
              <p className="text-[9px] text-tertiary/50 uppercase tracking-wide">Pass Rate</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
