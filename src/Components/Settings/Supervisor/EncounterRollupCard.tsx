import { Activity } from 'lucide-react'
import type { EncounterRollup } from './supervisorHelpers'

/**
 * "Algorithm Encounters" — clinic-wide roll-up of logged algorithm encounters,
 * grouped by body-system category (EAR NOSE THROAT, EYE, …). Counts are true
 * occurrence totals from the raw event stream (see rollupEncounterReads), not the
 * de-duplicated fold. Today's count is accented per category. Renders nothing
 * when the clinic has logged no encounters, so it's safe to mount unconditionally.
 *
 * Operational, non-PHI: counts of algorithm reads by category — no soldier
 * identity, no patient data.
 */
export function EncounterRollupCard({ rollup }: { rollup: EncounterRollup }) {
  if (rollup.total === 0) return null

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
          Algorithm Encounters
        </p>
        <p className="text-[9pt] text-tertiary">
          {rollup.total} total
          {rollup.totalToday > 0 && (
            <span className="text-themeblue3 font-medium"> · {rollup.totalToday} today</span>
          )}
        </p>
      </div>

      <div className="rounded-xl bg-themewhite2 divide-y divide-tertiary/10">
        {rollup.categories.map((c) => (
          <div key={c.category} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
              <Activity size={14} className="text-tertiary" />
            </div>
            <p className="flex-1 min-w-0 text-sm text-primary truncate capitalize">
              {c.category.toLowerCase()}
            </p>
            {c.today > 0 && (
              <span className="shrink-0 text-[9pt] font-medium px-2 py-0.5 rounded-full bg-themeblue3/10 text-themeblue3">
                {c.today} today
              </span>
            )}
            <span className="shrink-0 text-sm font-semibold text-primary w-8 text-right tabular-nums">
              {c.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
