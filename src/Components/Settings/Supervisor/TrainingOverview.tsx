import { subjectAreaIcons } from '../../../Data/TrainingConstants'
import type { SubjectAreaGap, FlatTask } from './supervisorHelpers'

interface TrainingOverviewProps {
  subjectAreaGaps: SubjectAreaGap[]
  testableTaskMap: Map<string, FlatTask[]>
  onSelectArea: (areaName: string) => void
}

function readinessColor(pct: number): string {
  if (pct >= 80) return 'bg-themegreen'
  if (pct >= 50) return 'bg-themeyellow'
  return 'bg-themeredred'
}

function readinessBadge(pct: number): string {
  if (pct >= 80) return 'text-themegreen'
  if (pct >= 50) return 'text-themeyellow'
  return 'text-themeredred'
}

export function TrainingOverview({
  subjectAreaGaps,
  testableTaskMap,
  onSelectArea,
}: TrainingOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {subjectAreaGaps.map((gap) => {
        const tasks = testableTaskMap.get(gap.areaName)
        const taskCount = tasks?.length ?? 0
        const deficientCount = gap.deficientSoldierIds.length

        return (
          <button
            key={gap.areaName}
            onClick={() => onSelectArea(gap.areaName)}
            className="rounded-lg border border-tertiary/10 bg-themewhite2 p-4 text-left
                       hover:bg-themeblue2/5 hover:border-themeblue2/20 transition-colors"
          >
            {/* Header: icon + area name */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-tertiary">{subjectAreaIcons[gap.areaName]}</span>
              <span className="text-sm font-medium text-primary truncate">{gap.areaName}</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-tertiary/10 mb-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${readinessColor(gap.coveragePercent)}`}
                style={{ width: `${Math.max(gap.coveragePercent, 2)}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between">
              <span className="text-[9pt] text-tertiary">
                {taskCount} task{taskCount !== 1 ? 's' : ''}
                {deficientCount > 0 && (
                  <> · <span className="text-themeredred">{deficientCount} deficient</span></>
                )}
              </span>
              <span className={`text-sm font-semibold ${readinessBadge(gap.coveragePercent)}`}>
                {gap.coveragePercent}%
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
