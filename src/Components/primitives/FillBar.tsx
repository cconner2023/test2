import type { ReactNode } from 'react'

interface FillBarProps {
  /** 0–100. Drives both the fill width and the two-tone color. */
  percent: number
  /** Optional leading label (supervisor overview-card style). Omit for row usage where the
   *  row already carries its own name to the left. */
  label?: string
  /** Trailing value. Defaults to `${percent}%`; pass a count (e.g. "3 / 12") or a signed
   *  shortfall when the raw quantity carries more meaning than the percent. */
  value?: ReactNode
  /** At/above this the bar reads as the passing operating-clinic blue; below it flips red. */
  threshold?: number
  /** Overrides the threshold color on the trailing value only — e.g. keep a shortfall red
   *  regardless of how full the bar is. */
  valueClassName?: string
  /** Width wrapper for the whole bar (track flexes within it). */
  className?: string
}

/** Completion / fill bar — the two-tone progress bar the supervisor readiness surfaces use
 *  (optional label · track · colored fill · trailing value), lifted to a primitive so the
 *  property hand-receipt and shortage panels read the same way. At/above `threshold` the fill
 *  is the passing operating-clinic blue (themeblue3); below it flips to red — the same scheme
 *  as TeamReporting's readiness/compliance/coverage bars. */
export function FillBar({ percent, label, value, threshold = 50, valueClassName, className }: FillBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const pass = percent >= threshold
  const barColor = pass ? 'bg-themeblue3/50' : 'bg-themeredred'
  const textColor = pass ? 'text-themeblue3' : 'text-themeredred'
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {label && <span className="text-[9pt] text-tertiary w-18 shrink-0">{label}</span>}
      <div
        className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-[9pt] font-medium text-right tabular-nums shrink-0 ${valueClassName ?? textColor}`}>
        {value ?? `${percent}%`}
      </span>
    </div>
  )
}
