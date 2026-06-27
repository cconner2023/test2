import { useMemo } from 'react'
import type { LocalPropertyLocation, LocalPropertyItem, HolderInfo } from '../../Types/PropertyTypes'
import { itemAlert } from '../../Types/PropertyTypes'

interface PersonnelZoneCarouselProps {
  /** Personnel (member) zones — root zones with holder_user_id set, gated by the filter. */
  zones: LocalPropertyLocation[]
  /** Holder profiles, for the tile's rank+name label. */
  holders: Map<string, HolderInfo>
  /** All items, for each tile's expiring/depleted dot. */
  items: LocalPropertyItem[]
  /** The currently-zoomed zone id — highlights its tile (same selected treatment as canvas). */
  activeId?: string | null
  /** Zoom the canvas into a personnel zone (the SAME zone zoom as tapping a canvas tile). */
  onSelect: (zone: LocalPropertyLocation) => void
}

/**
 * The personnel-zone carousel — the upper strip of the property map. Personnel zones are
 * ordinary ROOT zones; we just surface them as a horizontal carousel here (instead of
 * tiling the company overview, which is unusable at ~120 members) and keep the EXACT zone
 * tile UI (rounded photo tile, centered name, themeyellow selected ring) so tapping one
 * uses the same zone zoom. Which personnel show is gated by the filter (Settings picker).
 */
export function PersonnelZoneCarousel({ zones, holders, items, activeId, onSelect }: PersonnelZoneCarouselProps) {
  // Per-zone alert roll-up — any expiring/expired/depleted item → the zone's red dot.
  const alertByZone = useMemo(() => {
    const m = new Set<string>()
    for (const i of items) {
      if (i.parent_item_id || !i.location_id) continue
      if (!m.has(i.location_id) && itemAlert(i)) m.add(i.location_id)
    }
    return m
  }, [items])

  if (zones.length === 0) return null

  return (
    <div
      className="flex items-stretch gap-2 overflow-x-auto py-1 px-1 snap-x pointer-events-auto"
      style={{ scrollbarWidth: 'none' }}
      data-tour="property-personnel-carousel"
    >
      {zones.map((z) => {
        const holder = z.holder_user_id ? holders.get(z.holder_user_id) : null
        const label = holder?.displayName || z.name
        const isActive = activeId === z.id
        const hasAlert = alertByZone.has(z.id)
        return (
          <button
            key={z.id}
            type="button"
            onClick={() => onSelect(z)}
            title={label}
            // Mirrors the canvas zone tile (LocationTagPhoto): rounded border, themeblue3
            // tint / photo fill, themeyellow selected ring.
            className={`group relative shrink-0 snap-start w-28 h-20 rounded-lg border overflow-hidden cursor-pointer transition-shadow duration-150 ${
              isActive
                ? 'ring-2 ring-themeyellow border-themeyellow/50'
                : 'border-themeblue3/30 hover:bg-themeblue3/15'
            } ${!z.photo_data ? (isActive ? 'bg-themeyellow/20' : 'bg-themeblue3/10') : ''}`}
          >
            {z.photo_data && (
              <img src={z.photo_data} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
            )}
            {isActive && z.photo_data && <div className="absolute inset-0 bg-themeyellow/20 pointer-events-none" />}
            {/* Centered name — same label treatment as a zone tile (white + shadow over a photo). */}
            <div className="absolute inset-0 flex items-center justify-center p-1 gap-1">
              <span
                className={`text-[10pt] font-medium text-center leading-tight line-clamp-2 ${z.photo_data ? '' : 'text-primary'}`}
                style={z.photo_data ? { color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' } : undefined}
              >
                {label}
              </span>
              {hasAlert && <span className="w-1.5 h-1.5 rounded-full bg-themeredred shrink-0" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
