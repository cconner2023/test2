import { useMemo } from 'react'
import { weekAxisLabel, type TrainingActivityWeek } from './supervisorHelpers'

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
 *
 * A COLUMN IS A WAY IN, NOT A READOUT. The graph is the one surface that says
 * WHEN, so it is where "what happened that week" gets asked — and the records
 * behind it were individually voidable the whole time. Selecting a column hands
 * the week to the drawer's pane, which is where this drawer already keeps acts
 * that must not be walked away from. An empty week stays a plain div: there is
 * nothing behind it to open, and a dimmed button that refuses the press is worse
 * than a column that never offered.
 */
/** The plotted halves, top of the stack first. `evaluated` is supervised work,
 *  `ran` is self-reported. */
type Series = 'evaluated' | 'ran'

const SERIES_STYLE: Record<Series, { label: string; bar: string; key: string }> = {
  evaluated: { label: 'Evaluated', bar: 'bg-themeblue2', key: 'bg-themeblue2' },
  ran: { label: 'Logged', bar: 'bg-themeblue3/40', key: 'bg-themeblue3/40' },
}

const BOTH: Series[] = ['evaluated', 'ran']

interface TrainingTimelineProps {
  weeks: TrainingActivityWeek[]
  /** Plot height in px. The columns scale to it; the axis sits below. */
  height?: number
  /** Open a week's records. Omitted where the scope holds none — a subordinate
   *  cluster publishes counts and keeps the records behind them sealed in its own
   *  vault, so its columns are a readout with nothing to drill. */
  onSelectWeek?: (start: number) => void
  /** The week whose pane is open, so the graph shows what is being read. */
  selectedStart?: number | null
  /** Which halves to plot. Defaults to both. A surface that is about ONE of them
   *  — the Algorithms stop, which asks how much was run and answers competency
   *  elsewhere — passes the one, and the scale, the tooltip and the legend all
   *  narrow with it. Plotting both and sending zeroes would draw a legend key for
   *  a series that is structurally absent, which reads as "none this quarter". */
  series?: Series[]
  /** What an empty window says. Defaults to the training phrasing. */
  emptyLabel?: string
}

export function TrainingTimeline({
  weeks,
  height = 96,
  onSelectWeek,
  selectedStart,
  series = BOTH,
  emptyLabel,
}: TrainingTimelineProps) {
  const plotted = useMemo(() => BOTH.filter(s => series.includes(s)), [series])
  const totalOf = useMemo(
    () => (w: TrainingActivityWeek) => plotted.reduce((sum, s) => sum + w[s], 0),
    [plotted],
  )
  const max = useMemo(
    () => weeks.reduce((m, w) => Math.max(m, totalOf(w)), 0),
    [weeks, totalOf],
  )

  if (max === 0) {
    return (
      <p className="px-4 py-4 text-[10pt] text-tertiary">
        {emptyLabel ?? `No training recorded in the last ${weeks.length} weeks.`}
      </p>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-end gap-1" style={{ height }}>
        {weeks.map((w) => {
          const total = totalOf(w)
          const selectable = !!onSelectWeek && total > 0
          const tip = [
            `Week of ${weekAxisLabel(w.start)}`,
            ...plotted.map(s => `${w[s]} ${SERIES_STYLE[s].label.toLowerCase()}`),
          ].join(' · ')
          // Everything else steps back while a week is open, so the column being
          // read carries the graph on its own.
          const muted = selectedStart != null && selectedStart !== w.start
          const shape = `flex-1 min-w-0 h-full flex flex-col justify-end transition-all ${muted ? 'opacity-30' : ''}`

          const bars = (
            <>
              {/* Evaluated rides on top, so the supervised half is the part that
                  reads against the empty space above the column. */}
              {plotted.map((s, i) => (
                <div
                  key={s}
                  className={`w-full ${SERIES_STYLE[s].bar} ${
                    // The topmost segment with any height owns the rounded cap.
                    plotted.slice(0, i).every(above => w[above] === 0) ? 'rounded-t-sm' : ''
                  }`}
                  style={{ height: `${(w[s] / max) * 100}%` }}
                />
              ))}
              {/* A week with nothing still shows a hairline on the baseline —
                  the column is there, it is just empty. */}
              {total === 0 && <div className="w-full h-px bg-tertiary/20" />}
            </>
          )

          if (!selectable) {
            return <div key={w.start} className={shape} title={tip}>{bars}</div>
          }

          return (
            <button
              key={w.start}
              type="button"
              onClick={() => onSelectWeek?.(w.start)}
              aria-pressed={selectedStart === w.start}
              aria-label={tip}
              title={tip}
              className={`${shape} rounded-sm hover:bg-themeblue2/5 active:scale-95`}
            >
              {bars}
            </button>
          )
        })}
      </div>

      {/* Every other label: at twelve columns in a 380px-ish pane every label
          collides, and a week's exact date is a hover detail, not a scan one.
          The open week is the exception — it is named whichever side of the
          alternation it fell on, because a selection you cannot read the date of
          leaves the pane's title unanchored to the column that opened it. */}
      <div className="flex gap-1 mt-1.5">
        {weeks.map((w, i) => {
          const selected = w.start === selectedStart
          return (
            <span
              key={w.start}
              className={`flex-1 min-w-0 text-[8pt] text-center truncate tabular-nums ${
                selected ? 'text-primary font-semibold' : 'text-tertiary'
              }`}
            >
              {selected || (weeks.length - 1 - i) % 2 === 0 ? weekAxisLabel(w.start) : ''}
            </span>
          )
        })}
      </div>

      {/* The key names the two series and stops there. A total beside each one
          is a number the columns already carry, and it competes with the axis
          for the same glance. Per-week counts stay on hover. */}
      <div className="flex items-center gap-4 mt-2">
        {plotted.map(s => (
          <LegendKey key={s} className={SERIES_STYLE[s].key} label={SERIES_STYLE[s].label} />
        ))}
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
