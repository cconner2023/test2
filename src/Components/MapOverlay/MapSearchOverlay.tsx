/** Full-screen search overlay shown when the map search input is focused.
 *  Search bar + recent list + waypoints-from-overlays list. Mobile-first. */
import { useMemo } from 'react'
import { ChevronLeft, Clock, MapPin, Trash2 } from 'lucide-react'
import { SearchInput } from '../SearchInput'
import { HeaderPill, PillButton } from '../HeaderPill'
import { Section, SectionCard } from '../Section'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
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
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onClose: () => void
  onSelect: (sel: SearchOverlaySelection) => void
  waypoints: OverlayFeature[]
}

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
  onChange,
  onSubmit,
  onClose,
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

  return (
    <div
      className="fixed inset-0 z-[1020] bg-themewhite3 flex flex-col"
      role="dialog"
      aria-label="Map search"
    >
      {/* Header — back arrow + search input. Safe-area top padding mirrors
          MessagesPanel / ChatDetailView so the search bar clears the iOS notch. */}
      <div className="shrink-0 flex items-center gap-2 px-3 pb-2 pt-[max(0.5rem,var(--sat,0px))] border-b border-tertiary/10 bg-themewhite3">
        <HeaderPill>
          <PillButton icon={ChevronLeft} onClick={onClose} label="Back" />
        </HeaderPill>
        <div className="flex-1 min-w-0">
          <SearchInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder="Address, grid, lat/lng…"
            autoFocus
          />
        </div>
      </div>

      {/* Body — scroll */}
      <div className="flex-1 overflow-y-auto px-3 pt-4 pb-6">
        {/* Recents */}
        {recentSearches.length > 0 && (
          <Section title="Recent">
            <div className="relative">
              <SectionCard>
                {recentSearches.map((entry) => (
                  <button
                    key={`${entry.ts}-${entry.label}`}
                    type="button"
                    onClick={() => onSelect({ lat: entry.lat, lng: entry.lng, label: entry.label })}
                    className="w-full flex items-center gap-3 px-3 py-3 border-b border-themeblue3/5 last:border-b-0 active:bg-themewhite3 transition-all text-left"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-themewhite3 text-tertiary flex items-center justify-center">
                      <Clock size={16} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11pt] text-primary truncate">{entry.label}</span>
                      <span className="block text-[9pt] text-tertiary">{timeAgo(entry.ts)}</span>
                    </span>
                  </button>
                ))}
              </SectionCard>
              <ActionPill shadow="sm" placement="overlay">
                <ActionButton icon={Trash2} label="Clear recent searches" onClick={clearRecents} variant="danger" />
              </ActionPill>
            </div>
          </Section>
        )}

        {/* Waypoints from visible overlays */}
        {filteredWaypoints.length > 0 && (
          <Section title="Pins">
            <SectionCard>
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
                    className="w-full flex items-center gap-3 px-3 py-3 border-b border-themeblue3/5 last:border-b-0 active:bg-themewhite3 transition-all text-left"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-themeblue3/10 text-themeblue3 flex items-center justify-center">
                      <MapPin size={16} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11pt] text-primary truncate">
                        {wp.label || 'Waypoint'}
                      </span>
                      <span className="block text-[9pt] text-tertiary truncate">{subtitle}</span>
                    </span>
                  </button>
                )
              })}
            </SectionCard>
          </Section>
        )}

        {recentSearches.length === 0 && filteredWaypoints.length === 0 && (
          <div className="px-3 py-8 text-center text-[10pt] text-tertiary">
            {value.trim()
              ? 'Press search to look up this address or grid.'
              : 'Type an address, MGRS grid, or coordinates to search.'}
          </div>
        )}
      </div>
    </div>
  )
}
