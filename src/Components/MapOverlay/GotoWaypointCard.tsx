import { useEffect } from 'react'
import { Navigation, Compass, X } from 'lucide-react'
import { useMapPrefsStore } from '../../stores/useMapPrefsStore'
import { applyBearingReference, bearingSuffix } from '../../lib/declination'
import { useDeviceHeading } from '../../Hooks/useDeviceHeading'

interface GotoWaypointCardProps {
  /** Selected target waypoint label */
  label: string
  /** Target lat/lng */
  target: [number, number]
  /** Current GPS position, or null when unavailable */
  gps: { lat: number; lng: number } | null
  /** Closes the card without deselecting the waypoint. */
  onDismiss: () => void
}

function legGeometry(lat1: number, lng1: number, lat2: number, lng2: number): { distanceM: number; bearing: number } {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lng2 - lng1)
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return { distanceM, bearing }
}

function formatRange(m: number): string {
  if (m >= 10000) return `${(m / 1000).toFixed(0)} km`
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`
  return `${Math.round(m)} m`
}

export function GotoWaypointCard({ label, target, gps, onDismiss }: GotoWaypointCardProps) {
  const bearingReference = useMapPrefsStore(s => s.bearingReference)
  const { heading, permission, requestPermission } = useDeviceHeading()

  // Auto-request orientation permission on mount where it grants implicitly
  // (Android / desktop). iOS keeps `unknown` until the user taps the prompt.
  useEffect(() => {
    if (permission === 'unknown' && typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission !== 'function') {
      requestPermission()
    }
  }, [permission, requestPermission])

  if (!gps) {
    return (
      <div className="absolute bottom-3 right-16 z-[1000] flex items-center gap-2
        bg-themewhite2/90 dark:bg-themewhite3/90 backdrop-blur-sm
        px-3 py-2 rounded-lg shadow-sm">
        <Navigation size={14} className="text-tertiary" />
        <span className="text-[10pt] text-tertiary">Waiting for GPS…</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-1 text-tertiary hover:text-primary">
          <X size={14} />
        </button>
      </div>
    )
  }

  const { distanceM, bearing: trueBearing } = legGeometry(gps.lat, gps.lng, target[0], target[1])
  const refBearing = applyBearingReference(trueBearing, bearingReference, gps.lat, gps.lng)
  // Arrow rotation: angle from device heading to true bearing. When heading is
  // unknown, arrow points to true north as an absolute reference.
  const arrowDeg = heading == null ? trueBearing : ((trueBearing - heading) + 360) % 360

  return (
    <div className="absolute bottom-3 right-16 z-[1000] flex items-center gap-3
      bg-themewhite2/95 dark:bg-themewhite3/95 backdrop-blur-sm
      px-3 py-2 rounded-lg shadow-sm">
      <div className="relative w-10 h-10 rounded-full bg-themewhite shrink-0 flex items-center justify-center">
        <Navigation
          size={20}
          className="text-themeblue3"
          style={{ transform: `rotate(${arrowDeg}deg)`, transition: 'transform 200ms ease-out' }}
        />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[9pt] text-tertiary truncate max-w-[150px]" title={label}>{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-[11pt] font-medium text-primary tabular-nums">{formatRange(distanceM)}</span>
          <span className="text-[10pt] font-mono text-themeblue2 tabular-nums">
            {Math.round(refBearing).toString().padStart(3, '0')}°{bearingSuffix(bearingReference)}
          </span>
        </div>
      </div>
      {permission === 'unknown' && (
        <button
          type="button"
          onClick={requestPermission}
          className="ml-1 w-7 h-7 rounded-full bg-themewhite flex items-center justify-center text-tertiary hover:text-primary"
          aria-label="Enable compass"
          title="Enable compass"
        >
          <Compass size={13} />
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-1 w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary"
      >
        <X size={13} />
      </button>
    </div>
  )
}
