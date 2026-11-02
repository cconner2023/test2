/** Map search DROPDOWN, shown while the map drawer header's search input is
 *  focused (mobile search template: lifted card under the search row, not a
 *  results page). Renders recents + waypoints only — the search INPUT lives in
 *  the map drawer header (the single source of truth). Anchored just below that
 *  glass header (the drawer content is `isolate`d, so it can't cover it). */
import { useMemo } from 'react'
import { Clock, MapPin } from 'lucide-react'
import { SearchDropdownCard, SearchDropdownGroup } from '@/Components/primitives/SearchDropdown'
import { useMapSearchStore } from '../../stores/useMapSearchStore'
import { useMapPrefsStore } from '../../stores/useMapPrefsStore'
import { latLngToMgrs } from '../../lib/mgrsFormat'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'

export interface SearchOverlaySelection {
  lat: number
  lng: number
  label: string
  /** When true, suppress the drop-pin side effect (e.g. selecting a waypoint
   *  that's already on the map). */
  noPin?: boolean
}

interface MapSearchOverlayProps {
  isVisible: boolean
  /** Current query — typed into the map header's SearchInput. Used here only to
   *  filter the pins list and to tailor the empty-state hint. */
  value: string
  onSelect: (sel: SearchOverlaySelection) => void
  waypoints: OverlayFeature[]
}

const ROW = 'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-themewhite2 active:bg-themewhite2 transition-colors'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

export function MapSearchOverlay({
  isVisible,
  value,
  onSelect,
  waypoints,
}: MapSearchOverlayProps) {
  const recentSearches = useMapSearchStore(s => s.recentSearches)
  const clearRecents = useMapSearchStore(s => s.clearRecents)
  const coordDisplay = useMapPrefsStore(s => s.coordDisplay)

  const filteredWaypoints = useMemo(() => {
    const q = value.trim().toLowerCase()
    const eligible = waypoints.filter(w => w.geometry.length > 0)
    if (!q) return eligible.slice(0, 20)
    return eligible.filter(w => (w.label || '').toLowerCase().includes(q)).slice(0, 20)
  }, [waypoints, value])

  if (!isVisible) return null

  const hasAny = recentSearches.length > 0 || filteredWaypoints.length > 0

  return (
    // Lifted dropdown anchored under the drawer's floating glass header — the
    // live map stays visible (and pannable) around it.
    <div className="absolute left-0 right-0 z-[1020] px-3 pt-1 pointer-events-none top-[var(--drawer-header-h,3.5rem)]">
      <SearchDropdownCard className="pointer-events-auto" ariaLabel="Map search results">
        {recentSearches.length > 0 && (
          <SearchDropdownGroup
            title="Recent"
            trailing={
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearRecents}
                className="text-[9pt] text-themeredred active:scale-95"
              >
                Clear
              </button>
            }
          >
            {recentSearches.map((entry) => (
              <button
                key={`${entry.ts}-${entry.label}`}
                type="button"
                onClick={() => onSelect({ lat: entry.lat, lng: entry.lng, label: entry.label })}
                className={ROW}
              >
                <span className="w-10 h-10 shrink-0 rounded-full bg-themewhite2 text-tertiary flex items-center justify-center">
                  <Clock size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[11pt] text-primary truncate">{entry.label}</span>
                  <span className="block text-[9pt] text-tertiary truncate mt-0.5">{timeAgo(entry.ts)}</span>
                </span>
              </button>
            ))}
          </SearchDropdownGroup>
        )}

        {filteredWaypoints.length > 0 && (
          <SearchDropdownGroup title="Pins">
            {filteredWaypoints.map((wp) => {
              const [lat, lng] = wp.geometry[0]
              const subtitle = coordDisplay === 'mgrs'
                ? (latLngToMgrs(lat, lng, 5) || '')
                : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
              return (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => onSelect({ lat, lng, label: wp.label || 'Waypoint', noPin: true })}
                  className={ROW}
                >
                  <span className="w-10 h-10 shrink-0 rounded-full bg-themeyellow/15 text-themeyellow flex items-center justify-center">
                    <MapPin size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11pt] text-primary truncate">{wp.label || 'Waypoint'}</span>
                    <span className="block text-[9pt] text-tertiary truncate mt-0.5">{subtitle}</span>
                  </span>
                </button>
              )
            })}
          </SearchDropdownGroup>
        )}

        {!hasAny && (
          <div className="px-4 py-6 text-center text-[10pt] text-tertiary">
            {value.trim()
              ? 'Press search to look up this address or grid.'
              : 'Type an address, MGRS grid, or coordinates to search.'}
          </div>
        )}
      </SearchDropdownCard>
    </div>
  )
}
