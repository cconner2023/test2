import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { listAlgorithmsWithStp } from '../../../Utilities/algorithmStp'
import type { AlgorithmGap } from './supervisorHelpers'

function metricBarColor(pct: number): string {
  return pct >= 50 ? 'bg-themeblue3/50' : 'bg-themeredred'
}

function metricTextColor(pct: number): string {
  return pct >= 50 ? 'text-themeblue3' : 'text-themeredred'
}

interface AlgorithmGapListProps {
  gaps: AlgorithmGap[]
  onNavigateToAlgorithm: (algorithmId: string, algorithmName: string) => void
}

/**
 * The expanded list behind the Coverage Gaps "Algorithms" row: every algorithm
 * (A-1…X) grouped under its catData category, each drilling into the per-soldier
 * AlgorithmCoverageView. Pulled out of TeamReporting because the flat algorithm
 * list was too long to live inline in the Coverage Gaps card.
 */
export function AlgorithmGapList({ gaps, onNavigateToAlgorithm }: AlgorithmGapListProps) {
  const categories = useMemo(() => {
    const gapById = new Map(gaps.map((g) => [g.algorithmId, g]))
    const out: { category: string; items: { id: string; name: string; pct: number }[] }[] = []
    const indexByCategory = new Map<string, number>()
    // catData render order — algorithms come out A-1…X within each category.
    for (const a of listAlgorithmsWithStp()) {
      const gap = gapById.get(a.id)
      if (!gap) continue
      let ci = indexByCategory.get(a.category)
      if (ci === undefined) {
        ci = out.length
        indexByCategory.set(a.category, ci)
        out.push({ category: a.category, items: [] })
      }
      out[ci].items.push({ id: a.id, name: a.name, pct: gap.coveragePercent })
    }
    return out
  }, [gaps])

  return (
    <div>
      {categories.map(({ category, items }) => (
        <div key={category} className="mb-4 last:mb-0">
          <p className="text-[8pt] font-semibold text-tertiary uppercase tracking-wider mb-1.5">
            {category}
          </p>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigateToAlgorithm(item.id, item.name)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-themeblue2/5 text-left active:scale-95 transition-all"
              >
                <span className="text-[9pt] text-tertiary font-mono shrink-0 w-10">
                  {item.id}
                </span>
                <span className="text-sm text-primary min-w-0 truncate flex-1">
                  {item.name}
                </span>
                <div className="w-20 shrink-0">
                  <div
                    className="h-1.5 rounded-full bg-tertiary/10 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={item.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${metricBarColor(item.pct)}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
                <span className={`text-[9pt] font-medium w-8 text-right ${metricTextColor(item.pct)}`}>
                  {item.pct}%
                </span>
                <ChevronRight size={16} className="text-tertiary shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
