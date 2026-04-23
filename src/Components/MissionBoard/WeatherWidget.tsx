import { Thermometer, MapPin, RefreshCw } from 'lucide-react'
import { useWeather } from '../../Hooks/useWeather'
import { SectionCard } from '../Section'

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
      <SectionCard>
        <button onClick={refresh} className="flex items-center gap-3 w-full px-4 py-3.5 active:bg-themeblue2/5">
          <MapPin size={15} className="text-tertiary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-secondary">{locationError}</p>
            <p className="text-[9pt] font-medium text-themeblue1 mt-0.5">Enable &amp; Retry</p>
          </div>
        </button>
      </SectionCard>
    )
  }

  if (loading && temp === null) {
    return (
      <SectionCard>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <RefreshCw size={14} className="text-tertiary animate-spin shrink-0" />
          <p className="text-sm text-secondary">Fetching weather…</p>
        </div>
      </SectionCard>
    )
  }

  if (temp === null) {
    return (
      <SectionCard>
        <button onClick={refresh} className="flex items-center gap-3 w-full px-4 py-3.5 active:bg-themeblue2/5">
          <Thermometer size={15} className="text-tertiary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-secondary">{error ?? 'Tap to load weather'}</p>
            <p className="text-[9pt] font-medium text-themeblue1 mt-0.5">{error ? 'Retry' : 'Use My Location'}</p>
          </div>
        </button>
      </SectionCard>
    )
  }

  return (
    <SectionCard>
      {/* Temp + RH row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex-1 flex items-baseline gap-2 min-w-0">
          <span className="text-2xl font-semibold text-primary tabular-nums leading-none">{Math.round(temp)}°F</span>
          <span className="text-sm text-secondary tabular-nums">{rh}% RH</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {lastUpdated && <span className="text-[8pt] text-tertiary">{ageLabel(lastUpdated)}</span>}
          <button
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh weather"
            className="w-7 h-7 rounded-full flex items-center justify-center bg-themeblue2/8 text-primary active:scale-95 transition-all disabled:bg-tertiary/4 disabled:text-tertiary disabled:cursor-default"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* WBGT / heat category row */}
      {wbgt !== null && (
        <div className="px-4 py-3 border-t border-themeblue3/8">
          <div className="flex items-center justify-between">
            <span className="text-[9pt] text-secondary">
              {category ? `Cat ${category.num} — ${category.flag} Flag` : 'Below Cat 1 — No restrictions'}
            </span>
            <span className="text-[9pt] text-tertiary tabular-nums">WBGT ~{wbgt}°F</span>
          </div>
          {category && (
            <div className="flex items-center gap-2 mt-0.5 text-[9pt] text-tertiary">
              <span>{category.workRest}</span>
              <span>·</span>
              <span>{category.water}/hr water</span>
            </div>
          )}
        </div>
      )}

      {error && temp !== null && (
        <div className="px-4 py-2 border-t border-themeblue3/8">
          <p className="text-[8pt] text-orange-400">Stale data · {error}</p>
        </div>
      )}
    </SectionCard>
  )
}
