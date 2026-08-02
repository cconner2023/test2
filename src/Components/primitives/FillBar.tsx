import type { ReactNode } from 'react'

// ─── Readiness Color Scale ───────────────────────────────────────────────────
// ONE two-tone scheme for every percentage in the app: faded operating-clinic
// blue when passing, red when low. themeblue3 is the same accent the clinic
// switcher uses to mark the clinic you're operating as.
//
// These live WITH the bar, not beside it. They used to sit in supervisorHelpers
// with a comment saying they "match the FillBar primitive's defaults" — a
// documented duplicate is still a duplicate, and MyReadinessSection had quietly
// grown a third copy. Reach for <FillBar> for a bar; import these only to colour
// a bare number or pill that has no bar.

/** At/above this a readiness/coverage percentage reads as passing. */
export const READINESS_THRESHOLD = 50

export function readinessBarColor(pct: number, threshold = READINESS_THRESHOLD): string {
  return pct >= threshold ? 'bg-themeblue3/50' : 'bg-themeredred'
}

export function readinessTextColor(pct: number, threshold = READINESS_THRESHOLD): string {
  return pct >= threshold ? 'text-themeblue3' : 'text-themeredred'
}

interface FillBarProps {
  /** 0–100. Drives both the fill width and the two-tone color. */
  percent: number
  /** Optional leading label (supervisor overview-card style). Omit for row usage where the
   *  row already carries its own name to the left. */
  label?: string
  /** Trailing value. Defaults to `${percent}%`; pass a count (e.g. "3 / 12") or a signed
   *  shortfall when the raw quantity carries more meaning than the percent. Pass `null`
   *  for a bare track — the row already states the number somewhere else, which is why
   *  several surfaces had hand-rolled their own track div rather than use this. */
  value?: ReactNode | null
  /** At/above this the bar reads as the passing operating-clinic blue; below it flips red. */
  threshold?: number
  /** Overrides the threshold color on the trailing value only — e.g. keep a shortfall red
   *  regardless of how full the bar is. */
  valueClassName?: string
  /** Fixed width for the trailing value (e.g. `w-12`), so a column of bars keeps its
   *  numbers on one right edge instead of ragging with the digit count. */
  valueWidth?: string
  /** Width for the leading label. Defaults to `w-18`, which columns a stack of
   *  bars. Pass `w-auto` where the label is one unbreakable token — a task number
   *  is hyphenated, and at a fixed width it breaks at the hyphens into three
   *  lines. The label never wraps either way; the track gives up the space. */
  labelWidth?: string
  /** Width wrapper for the whole bar (track flexes within it). */
  className?: string
}

/** Completion / fill bar — the two-tone progress bar the supervisor readiness surfaces use
 *  (optional label · track · colored fill · trailing value), lifted to a primitive so the
 *  property hand-receipt and shortage panels read the same way. At/above `threshold` the fill
 *  is the passing operating-clinic blue (themeblue3); below it flips to red — the same scheme
 *  as the supervisor readiness/compliance/coverage bars. */
export function FillBar({ percent, label, value, threshold = READINESS_THRESHOLD, valueClassName, valueWidth, labelWidth, className }: FillBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const barColor = readinessBarColor(percent, threshold)
  const textColor = readinessTextColor(percent, threshold)
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {label && (
        <span className={`text-[9pt] text-tertiary shrink-0 whitespace-nowrap ${labelWidth ?? 'w-18'}`}>
          {label}
        </span>
      )}
      <div
        className="flex-1 h-1.5 rounded-full bg-tertiary/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>
      {value !== null && (
        <span className={`text-[9pt] font-medium text-right tabular-nums shrink-0 ${valueWidth ?? ''} ${valueClassName ?? textColor}`}>
          {value ?? `${percent}%`}
        </span>
      )}
    </div>
  )
}
