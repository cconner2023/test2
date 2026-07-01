import { useMemo, useRef } from 'react'
import { AlertTriangle, Building2, ChevronRight, Plus } from 'lucide-react'
import { formatMedicName } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { TeamMetrics } from './supervisorHelpers'
import { ActionButton } from '../../ActionButton'
import { ActionPill } from '../../ActionPill'
import { SwipeToDeleteRow } from '../../SwipeToDeleteRow'
import { SupervisorClinicCardAction } from '../../SupervisorClinicSwitcher'

interface TeamReportingProps {
  metrics: TeamMetrics
  medics: ClinicMedic[]
  onViewSoldier: (soldier: ClinicMedic) => void
  testableTaskMap: Map<string, { taskId: string }[]>
  onNavigateToTask?: (taskId: string) => void
  onNavigateToArea?: (areaName: string) => void
  /** Drill into the per-category algorithm list (A-1…X). The flat algorithm
   *  list is too long to inline, so "Algorithms" is one Coverage-Gaps row. */
  onNavigateToAlgorithmList?: () => void
  clinicName?: string | null
  /** When provided, the clinic-overview card becomes tap-to-edit (supervisor surface) */
  onEditClinic?: (anchorRect: DOMRect) => void
  /** When provided, an Add-member pill appears in the Soldier Readiness header */
  onAddMember?: (anchorRect: DOMRect) => void
  /** Mobile-only: render the cluster-switch pill on the clinic overview card.
   *  Desktop supervisor surfaces already expose this via SupervisorTree's
   *  SupervisorClinicFilterPanel, so we gate to avoid redundancy. */
  showClusterSwitch?: boolean
  /** When provided, soldier rows gain a swipe-left-to-remove gesture. The caller
   *  owns the ConfirmDialog + removal (loaned-in → end loan, else remove). */
  onRemoveSoldier?: (soldier: ClinicMedic) => void
  /** The viewer's own id — their row is never swipe-removable. */
  currentUserId?: string
}

// Readiness/compliance/coverage use a two-tone scheme: faded operating-clinic
// blue when passing, red when low. themeblue3 is the same accent the clinic
// switcher uses to mark the clinic you're operating as.
function metricBarColor(pct: number): string {
  return pct >= 50 ? 'bg-themeblue3/50' : 'bg-themeredred'
}

function metricTextColor(pct: number): string {
  return pct >= 50 ? 'text-themeblue3' : 'text-themeredred'
}

export function TeamReporting({
  metrics,
  medics,
  onViewSoldier,
  testableTaskMap,
  onNavigateToTask,
  onNavigateToArea,
  onNavigateToAlgorithmList,
  clinicName,
  onEditClinic,
  onAddMember,
  showClusterSwitch = false,
  onRemoveSoldier,
  currentUserId,
}: TeamReportingProps) {
  const addMemberPillRef = useRef<HTMLDivElement>(null)
  const sortedSoldiers = useMemo(() => {
    return [...metrics.soldierReadiness].sort((a, b) => a.readinessPercent - b.readinessPercent)
  }, [metrics.soldierReadiness])

  const sortedGaps = useMemo(() => {
    return [...metrics.subjectAreaGaps].sort((a, b) => a.coveragePercent - b.coveragePercent)
  }, [metrics.subjectAreaGaps])

  // Algorithms collapse to a single Coverage-Gaps row; the per-algorithm list
  // lives behind the drill-down. The row's % is the team average across them.
  const algorithmsAggregatePercent = useMemo(() => {
    const list = metrics.algorithmGaps
    if (list.length === 0) return 0
    return Math.round(list.reduce((s, g) => s + g.coveragePercent, 0) / list.length)
  }, [metrics.algorithmGaps])

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
              <div className={`h-full rounded-full ${metricBarColor(metrics.teamReadinessPercent)}`} style={{ width: `${metrics.teamReadinessPercent}%` }} />
            </div>
            <span className={`text-[9pt] font-medium w-8 text-right ${metricTextColor(metrics.teamReadinessPercent)}`}>{metrics.teamReadinessPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9pt] text-tertiary w-18 shrink-0">Compliance</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${metricBarColor(metrics.certCompliancePercent)}`} style={{ width: `${metrics.certCompliancePercent}%` }} />
            </div>
            <span className={`text-[9pt] font-medium w-8 text-right ${metricTextColor(metrics.certCompliancePercent)}`}>{metrics.certCompliancePercent}%</span>
          </div>
        </div>
      </button>
        {showClusterSwitch && (
          <ActionPill shadow="sm" placement="overlay">
            <SupervisorClinicCardAction />
          </ActionPill>
        )}
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
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
          {sortedSoldiers.map((entry, index) => {
            const soldier = medics.find(m => m.id === entry.soldierId)
            if (!soldier) return null
            return (
              <SwipeToDeleteRow
                key={entry.soldierId}
                onDelete={() => onRemoveSoldier?.(soldier)}
                disabled={!onRemoveSoldier || soldier.id === currentUserId}
              >
              <button
                onClick={() => onViewSoldier(soldier)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-themeblue2/5 text-left active:scale-95 transition-all"
                {...(index === 0 && { 'data-tour': 'supervisor-first-soldier' })}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary truncate">{formatMedicName(soldier)}</p>
                  {(soldier.isLoanedIn || soldier.surrogateClinicId || entry.overdueCount > 0) && (
                    <p className="text-[9pt] truncate">
                      {soldier.isLoanedIn && (
                        <span className="text-themeblue2">Loaned in{soldier.clinicName ? ` from ${soldier.clinicName}` : ''}</span>
                      )}
                      {!soldier.isLoanedIn && soldier.surrogateClinicId && (
                        <span className="text-themeyellow">Loaned out</span>
                      )}
                      {entry.overdueCount > 0 && (
                        <span className="text-themeredred">{(soldier.isLoanedIn || soldier.surrogateClinicId) ? ' · ' : ''}{entry.overdueCount} overdue</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="shrink-0 w-48 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9pt] text-tertiary w-18 shrink-0">Readiness</span>
                    <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${metricBarColor(entry.readinessPercent)}`}
                        style={{ width: `${entry.readinessPercent}%` }}
                      />
                    </div>
                    <span className={`text-[9pt] font-medium w-8 text-right ${metricTextColor(entry.readinessPercent)}`}>
                      {entry.readinessPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9pt] text-tertiary w-18 shrink-0">Compliance</span>
                    <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${metricBarColor(entry.compliancePercent)}`}
                        style={{ width: `${entry.compliancePercent}%` }}
                      />
                    </div>
                    <span className={`text-[9pt] font-medium w-8 text-right ${metricTextColor(entry.compliancePercent)}`}>
                      {entry.compliancePercent}%
                    </span>
                  </div>
                </div>
              </button>
              </SwipeToDeleteRow>
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
        <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                    className={`h-full rounded-full transition-all ${metricBarColor(gap.coveragePercent)}`}
                    style={{ width: `${gap.coveragePercent}%` }}
                  />
                </div>
              </div>
              <span className={`text-[9pt] font-medium w-8 text-right ${metricTextColor(gap.coveragePercent)}`}>
                {gap.coveragePercent}%
              </span>
            </button>
          ))}

          {/* Algorithms — composite competency, a single coverage-gap row that
              drills into the per-category A-1…X list (too long to inline). */}
          {metrics.algorithmGaps.length > 0 && (
            <button
              onClick={() => onNavigateToAlgorithmList?.()}
              disabled={!onNavigateToAlgorithmList}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-themeblue2/5 text-left active:scale-95 transition-all disabled:active:scale-100"
            >
              <span className="text-sm font-medium text-primary min-w-0 truncate shrink-0 w-36">
                Algorithms
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={algorithmsAggregatePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-all ${metricBarColor(algorithmsAggregatePercent)}`}
                    style={{ width: `${algorithmsAggregatePercent}%` }}
                  />
                </div>
              </div>
              <span className={`text-[9pt] font-medium w-8 text-right ${metricTextColor(algorithmsAggregatePercent)}`}>
                {algorithmsAggregatePercent}%
              </span>
              <ChevronRight size={16} className="text-tertiary shrink-0" />
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
