/** Full-screen search overlay shown when the map search input is focused.
 *  Mirrors the gmaps pattern: search bar + saved-place chips + recent list +
 *  waypoints-from-overlays list. Mobile-first. */
import { useMemo } from 'react'
import { ChevronLeft, Home, Briefcase, MoreHorizontal, Clock, MapPin, Trash2 } from 'lucide-react'
import { SearchInput } from '../SearchInput'
import { HeaderPill, PillButton } from '../HeaderPill'
import { useMapSearchStore, type SavedPlaceSlot } from '../../stores/useMapSearchStore'
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
  /** Called when the user taps an empty saved-place slot. Parent decides what
   *  to write (e.g. map center). */
  onAssignSavedPlace: (slot: SavedPlaceSlot) => void
  waypoints: OverlayFeature[]
}

const SLOT_META: Record<SavedPlaceSlot, { icon: typeof Home; emptyLabel: string }> = {
  home: { icon: Home, emptyLabel: 'Add Home' },
  work: { icon: Briefcase, emptyLabel: 'Add Work' },
  more: { icon: MoreHorizontal, emptyLabel: 'Add more' },
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
  onAssignSavedPlace,
  waypoints,
}: MapSearchOverlayProps) {
  const recentSearches = useMapSearchStore(s => s.recentSearches)
  const savedPlaces = useMapSearchStore(s => s.savedPlaces)
  const clearRecents = useMapSearchStore(s => s.clearRecents)
  const coordDisplay = useMapPrefsStore(s => s.coordDisplay)

  const filteredWaypoints = useMemo(() => {
    const q = value.trim().toLowerCase()
    const eligible = waypoints.filter(w => w.geometry.length > 0)
    if (!q) return eligible.slice(0, 20)
    return eligible.filter(w => (w.label || '').toLowerCase().includes(q)).slice(0, 20)
  }, [waypoints, value])

  if (!isVisible) return null

  const slots: SavedPlaceSlot[] = ['home', 'work', 'more']

  return (
    <div
      className="fixed inset-0 z-[1020] bg-themewhite3 flex flex-col"
      role="dialog"
      aria-label="Map search"
    >
      {/* Header — back arrow + search input */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-tertiary/10 bg-themewhite3">
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
      <div className="flex-1 overflow-y-auto">
        {/* Saved places */}
        <div className="flex items-stretch gap-2 px-3 pt-3 pb-1">
          {slots.map((slot) => {
            const place = savedPlaces[slot]
            const Meta = SLOT_META[slot]
            const Icon = Meta.icon
            const label = place ? place.label : Meta.emptyLabel
            return (
              <button
                key={slot}
                type="button"
                onClick={() => place
                  ? onSelect({ lat: place.lat, lng: place.lng, label: place.label })
                  : onAssignSavedPlace(slot)
                }
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full bg-themewhite2 active:scale-95 transition-all min-w-0"
              >
                <span className="w-7 h-7 shrink-0 rounded-full bg-themeblue3/10 text-themeblue3 flex items-center justify-center">
                  <Icon size={16} />
                </span>
                <span className="flex flex-col items-start min-w-0">
                  <span className="text-[10pt] font-medium text-primary truncate max-w-[80px]">
                    {label}
                  </span>
                  {place && (
                    <span className="text-[8pt] text-tertiary truncate max-w-[80px]">
                      Saved
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* Recents */}
        {recentSearches.length > 0 && (
          <div className="px-3 pt-4 pb-1 flex items-center justify-between">
            <h3 className="text-[11pt] font-semibold text-primary">Recent</h3>
            <button
              type="button"
              onClick={clearRecents}
              className="flex items-center gap-1 text-[9pt] text-tertiary hover:text-themeredred active:scale-95 transition-all"
              aria-label="Clear recent searches"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
        )}
        {recentSearches.map((entry) => (
          <button
            key={`${entry.ts}-${entry.label}`}
            type="button"
            onClick={() => onSelect({ lat: entry.lat, lng: entry.lng, label: entry.label })}
            className="w-full flex items-center gap-3 px-3 py-3 border-b border-tertiary/5 active:bg-themewhite2 transition-all text-left"
          >
            <span className="w-9 h-9 shrink-0 rounded-full bg-themewhite2 text-tertiary flex items-center justify-center">
              <Clock size={16} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11pt] text-primary truncate">{entry.label}</span>
              <span className="block text-[9pt] text-tertiary">{timeAgo(entry.ts)}</span>
            </span>
          </button>
        ))}

        {/* Waypoints from visible overlays */}
        {filteredWaypoints.length > 0 && (
          <div className="px-3 pt-4 pb-1">
            <h3 className="text-[11pt] font-semibold text-primary">Pins</h3>
          </div>
        )}
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
              className="w-full flex items-center gap-3 px-3 py-3 border-b border-tertiary/5 active:bg-themewhite2 transition-all text-left"
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
