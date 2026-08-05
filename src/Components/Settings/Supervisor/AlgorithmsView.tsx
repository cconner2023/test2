import { ChevronRight } from 'lucide-react'
import { SectionCard } from '@/Components/primitives/Section'
import { TrainingTimeline } from './TrainingTimeline'
import type { EncounterCategoryRollup, TrainingActivityWeek } from './supervisorHelpers'

/**
 * The Algorithms stop of the supervisor center: HOW MUCH the scope is running,
 * by week and by body system.
 *
 * VOLUME ONLY, AND THAT IS THE POINT. Whether a soldier is competent on an
 * algorithm is already answered on the algorithm's own route, reached from an
 * ICTL's prerequisites, and that route is the only place the three components
 * behind "trained" are read (see THE ALGORITHM ROUTE IS ONE ROUTE). Repeating
 * competency bars here would put the same verdict on two surfaces that could
 * disagree the moment either one's fold changed. This stop answers the other
 * question — what is actually walking through the door.
 *
 * A BREAKDOWN OF WHAT EXISTS, NOT A ROSTER OF WHAT COULD. Only categories and
 * algorithms with a logged count are drawn, and the algorithm row is the last
 * level — nothing drills past it. The full catData roster belongs on the
 * training routes that ask about coverage; this stop only reports volume, and a
 * body system nobody ran is not volume.
 *
 * The timeline does not open a week here, unlike Training's. A week's records are
 * every completion type at once, and a column on THIS graph counts encounters
 * alone — the list under the press would be a wider set than the bar that was
 * pressed. Training's graph is where a week gets opened.
 */
interface AlgorithmsViewProps {
  /** Weekly encounter volume, oldest first. */
  weeks: TrainingActivityWeek[]
  /** Every category with volume behind it, in published order. */
  categories: EncounterCategoryRollup[]
  /** The open category, or null for the category list. Owned by the host, so
   *  back walks it like every other center drill. */
  category?: string | null
  onSelectCategory?: (category: string) => void
}

export function AlgorithmsView({
  weeks,
  categories,
  category = null,
  onSelectCategory,
}: AlgorithmsViewProps) {
  const logged = categories.filter(c => c.count > 0)
  const open = category ? logged.find(c => c.category === category) : null

  if (open) {
    const algorithms = open.algorithms.filter(a => a.count > 0)
    return (
      <div className="space-y-5">
        <SectionCard>
          {algorithms.map(a => (
            <div
              key={a.id}
              className="w-full flex items-center gap-3 px-4 py-3
                border-t border-tertiary/8 first:border-t-0"
            >
              <span className="text-[9pt] font-medium text-tertiary shrink-0 w-10">{a.id}</span>
              <span className="text-sm text-primary min-w-0 truncate flex-1">{a.name}</span>
              {a.today > 0 && (
                <span className="text-[9pt] text-themeblue2 shrink-0 tabular-nums">
                  {a.today} today
                </span>
              )}
              <span className="text-[10pt] text-primary tabular-nums shrink-0 w-8 text-right">
                {a.count}
              </span>
            </div>
          ))}
        </SectionCard>
      </div>
    )
  }

  const hasWeeks = weeks.some(w => w.ran > 0)

  if (!hasWeeks && logged.length === 0) {
    return <p className="text-sm text-tertiary text-center py-12">No algorithms logged</p>
  }

  return (
    <div className="space-y-5">
      {/* Unlabelled, like Training's. A graph of weeks with a key under it does
          not need a word above it saying it is a graph of weeks. */}
      {hasWeeks && (
        <SectionCard>
          <TrainingTimeline weeks={weeks} series={['ran']} />
        </SectionCard>
      )}

      {logged.length > 0 && (
        <SectionCard>
          {logged.map(c => (
            <button
              key={c.category}
              onClick={() => onSelectCategory?.(c.category)}
              disabled={!onSelectCategory}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                hover:bg-themeblue2/5 active:scale-95 disabled:active:scale-100
                border-t border-tertiary/8 first:border-t-0"
            >
              <span className="text-sm text-primary min-w-0 truncate flex-1">{c.category}</span>
              {c.today > 0 && (
                <span className="text-[9pt] text-themeblue2 shrink-0 tabular-nums">
                  {c.today} today
                </span>
              )}
              <span className="text-[10pt] text-primary tabular-nums shrink-0 w-8 text-right">
                {c.count}
              </span>
              {onSelectCategory && <ChevronRight size={16} className="text-tertiary shrink-0" />}
            </button>
          ))}
        </SectionCard>
      )}
    </div>
  )
}
