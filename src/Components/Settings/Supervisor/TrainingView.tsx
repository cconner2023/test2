import { ChevronRight } from 'lucide-react'
import { FillBar } from '@/Components/primitives/FillBar'
import { SectionCard } from '@/Components/primitives/Section'
import { TrainingTimeline } from './TrainingTimeline'
import type { IctlCategoryRow, TrainingActivityWeek } from './supervisorHelpers'

/**
 * The Training stop of the supervisor center, at every scope the rail can point
 * at: the ICTL categories with their completion, and how much training the
 * scope has done week by week.
 *
 * ONE SURFACE FOR EVERY SCOPE. A cluster, a sub-cluster and a soldier get the
 * same rows drilling to the same place; only the numbers on them change. That is
 * the rule the 2026-07-31 algorithm-list unification stated — a scope may change
 * a row's numbers, it may not change where the row goes — and it is why this
 * replaced the old per-scope overview rather than sitting beside it.
 *
 * The categories are the ICTL's five subject areas in PUBLISHED order, not
 * sorted worst-first. This is the roster a unit is measured against and it is
 * read constantly; a list that resorts whenever a bar moves cannot be scanned by
 * position. The old surface sorted by gap because it was named Coverage Gaps and
 * answered a different question.
 */
interface TrainingViewProps {
  rows: IctlCategoryRow[]
  /** Omit when the scope has no activity series of its own. A subordinate
   *  cluster publishes ONE cluster-wide series, so drilling one of its soldiers
   *  drops the graph rather than drawing their unit's work against their name. */
  activity?: TrainingActivityWeek[]
  /** Headcount behind the numbers. One soldier reads as held/total ICTLs; a
   *  group reads as a percentage, because "37/160" is a number nobody holds. */
  soldierCount: number
  /** Absent where the drill has nothing to open — a subordinate cluster's task
   *  records stay in its own vault, so its rows are a readout, not a way in. */
  onSelectCategory?: (areaName: string) => void
  /** "as of …" line for numbers that were computed somewhere else and sent. */
  asOf?: string
}

export function TrainingView({ rows, activity, soldierCount, onSelectCategory, asOf }: TrainingViewProps) {
  const single = soldierCount === 1

  return (
    <div className="space-y-5">
      {/* Activity leads, unlabelled. It is the thing that changed since you last
          looked, and a chart of weeks with a legend under it does not need a word
          above it saying it is activity. The category roster below is the
          reference you drill into once the graph gives you a reason to. */}
      {activity && (
        <SectionCard>
          <TrainingTimeline weeks={activity} />
        </SectionCard>
      )}

      {/* Unlabelled, like the graph above it. A scope with nothing recorded shows
          nothing rather than an empty card under a heading — the categories are
          the only list here, so a title over them names what is plainly visible,
          and a "none authored" line is a fact for the ICTL author, not for the
          supervisor reading this. */}
      {rows.length > 0 && (
        <div>
          <SectionCard>
            {rows.map((row) => (
              <button
                key={row.areaName}
                onClick={() => onSelectCategory?.(row.areaName)}
                disabled={!onSelectCategory}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-95 transition-all disabled:active:scale-100"
              >
                <span className="text-sm text-primary min-w-0 truncate shrink-0 w-36">
                  {row.areaName}
                </span>
                <FillBar
                  className="flex-1 min-w-0"
                  percent={row.pct}
                  value={single ? `${row.passed}/${row.total}` : `${row.pct}%`}
                  valueWidth="w-12"
                />
                {onSelectCategory && <ChevronRight size={16} className="text-tertiary shrink-0" />}
              </button>
            ))}
          </SectionCard>
          {/* Only for numbers computed elsewhere. Your own cluster's are live, and
              stamping "as of now" on them would be noise. */}
          {asOf && <p className="text-[9pt] text-tertiary mt-1.5 px-1">As of {asOf}</p>}
        </div>
      )}
    </div>
  )
}
