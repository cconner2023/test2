import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, ClipboardList } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useTrainingCompletions } from '../../Hooks/useTrainingCompletions'
import {
  buildTestableTaskMap,
  buildSoldierCompetency,
  buildAlgorithmCompetency,
} from './Supervisor/supervisorHelpers'
import { getExpirationStatus } from '../Certifications/certHelpers'
import { getTaskData } from '../../Data/TrainingData'
import { UserTimeline } from '../Timeline/UserTimeline'
import type { Certification } from '../../Data/User'
import type { TrainingCompletionUI } from '../../lib/trainingService'
import type { AlgorithmCompetencyLevel } from './Supervisor/supervisorHelpers'

// Bar coloring — mirrors SoldierProfile's read-only readiness idiom (≥50% blue,
// else red). Kept local so the self surface reuses the exact visual language
// without importing an evaluator-only component.
function readinessColor(pct: number): string {
  return pct >= 50 ? 'bg-themeblue3/50' : 'bg-themeredred'
}
function readinessTextColor(pct: number): string {
  return pct >= 50 ? 'text-themeblue3' : 'text-themeredred'
}

function algoStatusLabel(status: AlgorithmCompetencyLevel): string {
  return status === 'trained' ? 'Trained' : status === 'partial' ? 'Partial' : 'Untrained'
}
function algoStatusClass(status: AlgorithmCompetencyLevel): string {
  return status === 'trained'
    ? 'text-themegreen'
    : status === 'partial'
      ? 'text-themeyellow'
      : 'text-tertiary'
}

/**
 * MyReadinessSection — the read-only self-facing mirror of the supervisor's
 * per-soldier readiness lens (SoldierProfile), scoped to the current user.
 *
 * All numbers are computed with the SAME pure helpers the supervisor uses
 * (buildSoldierCompetency / buildAlgorithmCompetency / cert compliance), run
 * over the current user's own data — so a medic sees exactly what their team
 * lead sees about them, minus every edit/evaluate control.
 *
 * Data is delta-only: training completions come from useTrainingCompletions
 * (offline-first audit fold + realtime, no fresh clinic pull); certs are passed
 * down from the host (ProfilePage already loads them); the timeline self-fetches
 * its own subject audit (read-through cached).
 */
export function MyReadinessSection({ certs, onViewTimeline }: {
  certs: Certification[]
  /** Desktop: dock the full timeline in the Settings right pane instead of the
   *  bottom Sheet. Undefined on mobile → UserTimeline falls back to its Sheet. */
  onViewTimeline?: () => void
}) {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const clinicId = useAuthStore(s => s.clinicId)
  const { completions } = useTrainingCompletions()

  const [expandedArea, setExpandedArea] = useState<string | null>(null)
  const [algosExpanded, setAlgosExpanded] = useState(false)

  const tests = useMemo(
    () => completions.filter((c: TrainingCompletionUI) => c.completionType === 'test'),
    [completions],
  )
  const assignments = useMemo(
    () => completions.filter((c: TrainingCompletionUI) => c.completionType === 'assignment'),
    [completions],
  )

  const testableTaskMap = useMemo(() => buildTestableTaskMap(), [])

  // Per-category competency + overall readiness — same derivation as the
  // supervisor's per-soldier view.
  const soldierComp = useMemo(
    () => buildSoldierCompetency(userId ?? '', tests, testableTaskMap),
    [userId, tests, testableTaskMap],
  )
  const readinessPercent = soldierComp.overallTotal > 0
    ? Math.round((soldierComp.overallPassed / soldierComp.overallTotal) * 100)
    : 0

  const compliancePercent = certs.length > 0
    ? Math.round((certs.filter(c => getExpirationStatus(c.exp_date) === 'valid').length / certs.length) * 100)
    : 100

  const categoryCompetency = useMemo(
    () => soldierComp.areas
      .map(a => ({ areaName: a.areaName, passed: a.passed, total: a.total, pct: a.total ? Math.round((a.passed / a.total) * 100) : 0, tasks: a.tasks }))
      .sort((a, b) => a.pct - b.pct),
    [soldierComp],
  )

  const algorithmCompetency = useMemo(() => buildAlgorithmCompetency(tests), [tests])
  const algorithmTrainedCount = useMemo(
    () => algorithmCompetency.filter(a => a.status === 'trained').length,
    [algorithmCompetency],
  )
  const algorithmsAggregatePercent = useMemo(() => {
    if (algorithmCompetency.length === 0) return 0
    return Math.round(algorithmCompetency.reduce((s, a) => s + a.pct, 0) / algorithmCompetency.length)
  }, [algorithmCompetency])

  if (!userId) return null

  return (
    <section>
      <div className="pb-2 flex items-center gap-2">
        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Readiness</p>
      </div>

      <div className="space-y-3">
        {/* Readiness + Compliance headline */}
        <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10pt] text-tertiary w-20 shrink-0">Readiness</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${readinessColor(readinessPercent)}`} style={{ width: `${readinessPercent}%` }} />
            </div>
            <span className={`text-[10pt] font-medium w-9 text-right ${readinessTextColor(readinessPercent)}`}>{readinessPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10pt] text-tertiary w-20 shrink-0">Compliance</span>
            <div className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
              <div className={`h-full rounded-full ${readinessColor(compliancePercent)}`} style={{ width: `${compliancePercent}%` }} />
            </div>
            <span className={`text-[10pt] font-medium w-9 text-right ${readinessTextColor(compliancePercent)}`}>{compliancePercent}%</span>
          </div>
        </div>

        {/* Assignments */}
        {assignments.length > 0 && (
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
            {assignments.map((a) => {
              const taskTitle = getTaskData(a.trainingItemId)?.title ?? a.trainingItemId
              const isCompleted = !!a.completedAt
              const isOverdue = !isCompleted && a.dueDate && new Date(a.dueDate) < new Date()
              const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isCompleted ? 'bg-themegreen/10' : isOverdue ? 'bg-themeredred/10' : 'bg-themeblue3/10'
                  }`}>
                    <ClipboardList size={14} className={isCompleted ? 'text-themegreen' : isOverdue ? 'text-themeredred' : 'text-themeblue2'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{taskTitle}</p>
                    {a.dueDate && (
                      <span className={`text-[9pt] font-medium ${isCompleted ? 'text-themegreen' : isOverdue ? 'text-themeredred' : 'text-tertiary'}`}>
                        {isCompleted ? 'Done' : isOverdue ? 'Overdue' : 'Due'} {formatDate(a.dueDate)}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9pt] font-medium shrink-0 ${isCompleted ? 'text-themegreen' : isOverdue ? 'text-themeredred' : 'text-themeblue2'}`}>
                    {isCompleted ? 'Complete' : isOverdue ? 'Overdue' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Training Competency by category — tap a row to reveal per-task GO/NO_GO */}
        <div>
          <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">Training Competency</p>
          {categoryCompetency.length === 0 && algorithmCompetency.length === 0 ? (
            <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4">
              <p className="text-sm text-tertiary">No testable tasks available</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-themewhite2 overflow-hidden">
              {categoryCompetency.map((cat) => {
                const isOpen = expandedArea === cat.areaName
                return (
                  <div key={cat.areaName}>
                    <button
                      onClick={() => setExpandedArea(isOpen ? null : cat.areaName)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-all"
                    >
                      <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">{cat.areaName}</span>
                      <div className="flex-1 min-w-0">
                        <div className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${readinessColor(cat.pct)}`} style={{ width: `${cat.pct}%` }} />
                        </div>
                      </div>
                      <span className={`text-[9pt] font-medium w-12 text-right ${readinessTextColor(cat.pct)}`}>{cat.passed}/{cat.total}</span>
                      {isOpen ? <ChevronDown size={14} className="text-tertiary shrink-0" /> : <ChevronRight size={14} className="text-tertiary shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 border-t border-tertiary/10 space-y-1 pt-2">
                        {cat.tasks.map((t) => (
                          <div key={t.taskId} className="flex items-center gap-2 py-1">
                            <span className="flex-1 min-w-0 text-[10pt] text-secondary truncate">{t.title}</span>
                            {t.status === 'GO' ? (
                              <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themegreen/15 text-themegreen shrink-0">GO</span>
                            ) : t.status === 'NO_GO' ? (
                              <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themeredred/15 text-themeredred shrink-0">NO GO</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9pt] bg-tertiary/10 text-tertiary shrink-0">Untested</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Algorithms — composite competency treated as a training category */}
              {algorithmCompetency.length > 0 && (
                <div>
                  <button
                    onClick={() => setAlgosExpanded(v => !v)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-all"
                  >
                    <span className="text-sm font-medium text-primary min-w-0 truncate shrink-0 w-36">Algorithms</span>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${readinessColor(algorithmsAggregatePercent)}`} style={{ width: `${algorithmsAggregatePercent}%` }} />
                      </div>
                    </div>
                    <span className={`text-[9pt] font-medium w-12 text-right ${readinessTextColor(algorithmsAggregatePercent)}`}>{algorithmTrainedCount}/{algorithmCompetency.length}</span>
                    {algosExpanded ? <ChevronDown size={14} className="text-tertiary shrink-0" /> : <ChevronRight size={14} className="text-tertiary shrink-0" />}
                  </button>
                  {algosExpanded && (
                    <div className="px-4 pb-3 border-t border-tertiary/10 space-y-1 pt-2">
                      {algorithmCompetency.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 py-1">
                          <span className="flex-1 min-w-0 text-[10pt] text-secondary truncate">{a.name}</span>
                          <span className={`text-[9pt] font-medium shrink-0 ${algoStatusClass(a.status)}`}>{algoStatusLabel(a.status)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* NO "Training History" list here on purpose — every graded evaluation
            already lands in the timeline below (test.graded audit events). The
            per-test PASS/FAIL list was a second rendering of the same records;
            per-task GO/NO_GO still lives in Training Competency above. The
            evaluator-side SoldierProfile keeps its history list (it needs the
            per-record delete). */}

        {/* Lifecycle timeline — self-fetches its own subject audit (offline-first).
            Desktop docks "View all" in the Settings right pane (onViewTimeline);
            mobile omits it → UserTimeline opens its own bottom Sheet. */}
        <UserTimeline subjectId={userId} clinicId={clinicId ?? undefined} title="Timeline" onViewAll={onViewTimeline} />
      </div>
    </section>
  )
}
