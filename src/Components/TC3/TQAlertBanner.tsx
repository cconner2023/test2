import { memo } from 'react'
import { useTQAlerts } from '../../Hooks/useTQAlerts'

export const TQAlertBanner = memo(function TQAlertBanner() {
  const { alerts } = useTQAlerts()

  if (alerts.length === 0) return null

  const hasCritical = alerts.some((a) => a.isCritical)
  const top = alerts.reduce((best, a) => (a.elapsedMinutes > best.elapsedMinutes ? a : best))
  const others = alerts.length - 1

  const label = others > 0
    ? `TQ — ${top.location} +${others} other${others > 1 ? 's' : ''}: ${top.elapsedMinutes} min`
    : `TQ — ${top.location}: ${top.elapsedMinutes} min`

  return (
    <div
      className={`flex items-center justify-center px-3 h-9 text-white text-[10pt] font-semibold tracking-wide shrink-0 ${
        hasCritical ? 'bg-themeredred' : 'bg-amber-500'
      }`}
    >
      {label}
    </div>
  )
})
