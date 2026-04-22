import { MapPin, RefreshCw } from 'lucide-react'
import { useWeather } from '../../Hooks/useWeather'
import { CATEGORY_BG } from '../../lib/wbgtUtils'

function ageLabel(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export function WeatherWidget() {
  const { temp, rh, wbgt, category, loading, error, locationError, lastUpdated, refresh } = useWeather()

  if (locationError) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-4">
        <MapPin size={18} className="text-tertiary" />
        <span className="text-xs text-secondary">{locationError}</span>
        <button onClick={refresh} className="text-[9pt] font-medium text-themeblue1">Enable &amp; Retry</button>
      </div>
    )
  }

  if (loading && temp === null) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-4">
        <RefreshCw size={14} className="text-tertiary animate-spin" />
        <span className="text-xs text-secondary">Fetching weather…</span>
      </div>
    )
  }

  if (temp === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-4">
        <span className="text-xs text-secondary">{error ?? 'Weather unavailable'}</span>
        <button onClick={refresh} className="text-[9pt] font-medium text-themeblue1">Retry</button>
      </div>
    )
  }

  const catBg = category ? CATEGORY_BG[category.flag] : 'bg-tertiary/8'

  return (
    <div className="px-3 py-2.5 space-y-2">

      {/* Temp + RH + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-primary tabular-nums leading-none">{Math.round(temp)}°F</span>
          <span className="text-sm text-secondary tabular-nums">{rh}% RH</span>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1 px-1.5 py-1 rounded active:bg-themeblue2/10 text-tertiary"
          aria-label="Refresh weather"
        >
          {lastUpdated && <span className="text-[8pt]">{ageLabel(lastUpdated)}</span>}
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Heat category band */}
      {wbgt !== null && (
        <div className={`rounded-lg px-2.5 py-2 ${catBg}`}>
          {category ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[9pt] font-semibold text-primary">Cat {category.num} — {category.flag} Flag</span>
                <span className="text-[9pt] text-secondary tabular-nums">WBGT ~{wbgt}°F</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[9pt] text-secondary">
                <span>{category.workRest}</span>
                <span className="text-tertiary">·</span>
                <span>{category.water}/hr water</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[9pt] text-secondary">Below Cat 1 — No restrictions</span>
              <span className="text-[9pt] text-secondary tabular-nums">WBGT ~{wbgt}°F</span>
            </div>
          )}
        </div>
      )}

      {error && temp !== null && (
        <p className="text-[8pt] text-orange-400">Stale data · {error}</p>
      )}

      <p className="text-[8pt] text-tertiary">Est. from temp &amp; humidity · TB MED 507</p>
    </div>
  )
}
