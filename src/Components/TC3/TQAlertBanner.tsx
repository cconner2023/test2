import { memo } from 'react'
import type { TQAlert } from '../../Hooks/useTQAlerts'
import { ErrorDisplay } from '../primitives/ErrorDisplay'

/** Presentational — the caller owns `useTQAlerts()`. TC3CardColumn needs the
 *  same alert list to decide who takes the floating-header clearance (the
 *  banner when it's up, the scroller otherwise), and running the hook in both
 *  places would mean two 60s intervals that can disagree for a tick. */
export const TQAlertBanner = memo(function TQAlertBanner({ alerts }: { alerts: TQAlert[] }) {
  if (alerts.length === 0) return null

  const hasCritical = alerts.some((a) => a.isCritical)
  const top = alerts.reduce((best, a) => (a.elapsedMinutes > best.elapsedMinutes ? a : best))
  const others = alerts.length - 1

  const label = others > 0
    ? `TQ — ${top.location} +${others} other${others > 1 ? 's' : ''}: ${top.elapsedMinutes} min`
    : `TQ — ${top.location}: ${top.elapsedMinutes} min`

  return (
    <ErrorDisplay
      type={hasCritical ? 'error' : 'warning'}
      solid
      strip
      centered
      icon={null}
      message={label}
      className="h-9 tracking-wide shrink-0"
    />
  )
})
