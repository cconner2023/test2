import type { AlgorithmComponentScore } from './supervisorHelpers'

/**
 * One soldier's standing on one algorithm, as a column per component.
 *
 * It is a CHART because the question is comparative: an algorithm is held three
 * ways at once and what a supervisor needs off one glance is which of the three
 * is short, not what each of them reads. A stack of "2/3" lines answers that only
 * after you have done the division yourself.
 *
 * Same construction as TrainingTimeline — divs, no SVG, no chart dependency (this
 * is a PWA on iOS Safari with an offline budget), and the same two-tone language:
 * themeblue2 for the supervised half, themeblue3/40 for the self-reported one, so
 * a column here and a column there mean the same thing.
 *
 * Every component gets a column even at zero, which draws as the baseline
 * hairline. A chart that omits what has not been started reports it as absent
 * rather than as outstanding — the opposite of what it is.
 */
interface AlgorithmComponentChartProps {
  components: AlgorithmComponentScore[]
  /** Plot height in px, matching TrainingTimeline's default proportions. */
  height?: number
}

export function AlgorithmComponentChart({ components, height = 88 }: AlgorithmComponentChartProps) {
  if (components.length === 0) return null

  return (
    <div className="px-4 py-3">
      <div className="flex items-end gap-3" style={{ height }}>
        {components.map(c => {
          // Each column is read against ITS OWN target, not a shared axis: three
          // logged encounters and five prerequisite tasks are different units, and
          // a common scale would make the smaller requirement look like progress.
          const pct = c.total > 0 ? Math.min(100, (c.validated / c.total) * 100) : 0
          return (
            <div
              key={c.kind}
              className="flex-1 min-w-0 h-full flex flex-col justify-end"
              title={`${c.label} ${c.validated}/${c.total}`}
            >
              <div
                className={`w-full rounded-t-sm ${c.met ? 'bg-themeblue2' : 'bg-themeblue3/40'}`}
                style={{ height: `${pct}%` }}
              />
              {pct === 0 && <div className="w-full h-px bg-tertiary/20" />}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-1.5">
        {components.map(c => (
          <span key={c.kind} className="flex-1 min-w-0 text-center">
            <span className="block text-[8pt] text-tertiary truncate">{c.label}</span>
            <span
              className={`block text-[9pt] tabular-nums ${c.met ? 'text-themegreen' : 'text-tertiary'}`}
            >
              {c.validated}/{c.total}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
