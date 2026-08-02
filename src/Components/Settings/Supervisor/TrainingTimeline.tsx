import { useMemo } from 'react'
import type { TrainingActivityWeek } from './supervisorHelpers'

/** M/D for the axis. Derived here so a published week — which is a bucket start
 *  and two counts, nothing else — plots without a translation step. */
function weekLabel(start: number): string {
  const d = new Date(start)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * Weekly training activity for whatever the rail is pointed at.
 *
 * TWO STACKED SERIES, NOT ONE BAR. Evaluated is the supervised half, ran is the
 * self-reported half, and they are stacked rather than summed so the column
 * still reads as one week's work while staying separable at a glance. Merging
 * them would let a week of unsupervised reps look identical to a week of
 * evaluations, which is the distinction the whole completion model turns on.
 *
 * Hand-rolled from divs rather than an SVG or a chart library: two segments and
 * a baseline is not a chart problem, and the app ships no charting dependency
 * (nor should it — this is a PWA on iOS Safari with an offline budget).
 *
 * The x axis is DENSE — every week in the window gets a column, including empty
 * ones. A chart that skips quiet weeks draws a lull as continuous work.
 */
interface TrainingTimelineProps {
  weeks: TrainingActivityWeek[]
  /** Plot height in px. The columns scale to it; the axis sits below. */
  height?: number
}

export function TrainingTimeline({ weeks, height = 96 }: TrainingTimelineProps) {
  const max = useMemo(
    () => weeks.reduce((m, w) => Math.max(m, w.evaluated + w.ran), 0),
    [weeks],
  )

  if (max === 0) {
    return (
      <p className="px-4 py-4 text-[10pt] text-tertiary">
        No training recorded in the last {weeks.length} weeks.
      </p>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-end gap-1" style={{ height }}>
        {weeks.map((w) => {
          const total = w.evaluated + w.ran
          return (
            <div
              key={w.start}
              className="flex-1 min-w-0 h-full flex flex-col justify-end"
              title={`Week of ${weekLabel(w.start)} · ${w.evaluated} evaluated · ${w.ran} logged`}
            >
              {/* Evaluated rides on top, so the supervised half is the part that
                  reads against the empty space above the column. */}
              <div
                className="w-full rounded-t-sm bg-themeblue2"
                style={{ height: `${(w.evaluated / max) * 100}%` }}
              />
              <div
                className={`w-full bg-themeblue3/40 ${w.evaluated === 0 ? 'rounded-t-sm' : ''}`}
                style={{ height: `${(w.ran / max) * 100}%` }}
              />
              {/* A week with nothing still shows a hairline on the baseline —
                  the column is there, it is just empty. */}
              {total === 0 && <div className="w-full h-px bg-tertiary/20" />}
            </div>
          )
        })}
      </div>

      {/* Every other label: at twelve columns in a 380px-ish pane every label
          collides, and a week's exact date is a hover detail, not a scan one. */}
      <div className="flex gap-1 mt-1.5">
        {weeks.map((w, i) => (
          <span
            key={w.start}
            className="flex-1 min-w-0 text-[8pt] text-tertiary text-center truncate tabular-nums"
          >
            {(weeks.length - 1 - i) % 2 === 0 ? weekLabel(w.start) : ''}
          </span>
        ))}
      </div>

      {/* The key names the two series and stops there. A total beside each one
          is a number the columns already carry, and it competes with the axis
          for the same glance. Per-week counts stay on hover. */}
      <div className="flex items-center gap-4 mt-2">
        <LegendKey className="bg-themeblue2" label="Evaluated" />
        <LegendKey className="bg-themeblue3/40" label="Logged" />
      </div>
    </div>
  )
}

function LegendKey({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[9pt] text-tertiary">
      <span className={`w-2 h-2 rounded-full ${className}`} />
      {label}
    </span>
  )
}
