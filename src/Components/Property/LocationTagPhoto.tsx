/**
 * LocationTagPhoto — Renders zones as positioned divs within a scaled canvas.
 * Zones use their 0..1 normalised coords as CSS percentages.
 * No camera transforms — the canvas div itself scales and scrolls.
 *
 * Merged zones (those with `rects`) render as a single SVG composite shape
 * using clipPath for uniform fill + traced outline for the border.
 *
 * Item pins float at their x/y positions over the canvas (tap-only in view mode; drag is handled by EditItemPin in edit mode).
 */
import { memo } from 'react'
import { traceCompositeOutline } from '../../lib/tagIndex'
import type { LocationTag, LocalPropertyItem, ZoneRect } from '../../Types/PropertyTypes'

interface LocationTagPhotoProps {
  tags: LocationTag[]
  selectedZoneId: string | null
  onZoneTap: (targetId: string) => void
  scale: number
  /** Map of target_id → photo_data base64 URL for zone background images */
  photoMap?: Map<string, string>
  /** Items to render as spatially positioned pins */
  items?: LocalPropertyItem[]
  /** Called when an item pin is tapped */
  onItemTap?: (item: LocalPropertyItem) => void
}

/** SVG composite shape — uniform fill + outer contour, no overlap darkening */
function CompositeZoneSVG({ rects, selected, id, photo }: { rects: ZoneRect[]; selected: boolean; id: string; photo?: string }) {
  const outline = traceCompositeOutline(rects)
  const clipId = `zclip-${id}`
  const patId = `zpat-${id}`

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id={clipId}>
          {rects.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
          ))}
        </clipPath>
        {photo && (
          <pattern id={patId} x="0" y="0" width="1" height="1">
            <image href={photo} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
      </defs>
      {/* Fill clipped to composite shape — image or solid colour */}
      <rect
        x="0" y="0" width="1" height="1"
        clipPath={`url(#${clipId})`}
        fill={photo ? `url(#${patId})` : undefined}
        className={photo ? undefined : (selected ? 'fill-themeyellow/20' : 'fill-themeblue3/15')}
      />
      {/* Selection tint over image */}
      {photo && selected && (
        <rect
          x="0" y="0" width="1" height="1"
          clipPath={`url(#${clipId})`}
          className="fill-themeyellow/20"
        />
      )}
      {/* Outer contour — traced boundary of rect union */}
      {outline && (
        <path
          d={outline}
          fill="none"
          className={selected ? 'stroke-themeyellow/50' : 'stroke-themeblue3/30'}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}

/** Item badge in view mode — tap-only, no drag. Dragging is handled by EditItemPin in edit mode. */
function ItemPin({ pin, item, onTap }: {
  pin: LocationTag
  item: LocalPropertyItem
  onTap: (item: LocalPropertyItem) => void
}) {
  return (
    <div
      className="absolute z-20 select-none cursor-pointer"
      style={{
        left: `${pin.x * 100}%`,
        top: `${pin.y * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={(e) => { e.stopPropagation(); onTap(item) }}
    >
      <div className="px-2 py-1 rounded-full text-[9pt] font-medium bg-themewhite3/90 text-primary border border-themeblue3/30 shadow-sm backdrop-blur-sm min-h-[28px] flex items-center gap-1 active:scale-95 transition-transform">
        <span className="whitespace-nowrap max-w-[90px] truncate">{item.name}</span>
        {item.quantity > 1 && (
          <span className="shrink-0 text-[8pt] font-semibold text-themeblue1 bg-themeblue3/15 px-1 rounded-full leading-tight">×{item.quantity}</span>
        )}
      </div>
    </div>
  )
}

export const LocationTagPhoto = memo(function LocationTagPhoto({
  tags,
  selectedZoneId,
  onZoneTap,
  scale,
  photoMap,
  items,
  onItemTap,
}: LocationTagPhotoProps) {
  const zones = tags.filter((t) => (t.width ?? 0) > 0 && (t.height ?? 0) > 0)
  const itemPins = tags.filter((t) => t.target_type === 'item')

  // Build item lookup by id
  const itemById = new Map<string, LocalPropertyItem>()
  if (items) {
    for (const item of items) itemById.set(item.id, item)
  }

  return (
    <div
      className="relative origin-top-left"
      style={{
        width: `${scale * 100}%`,
        height: `${scale * 100}%`,
        minHeight: '100%',
      }}
    >
      {/* SVG defs for composite zone clip paths */}
      {zones.some((t) => t.rects && t.rects.length > 0) && (
        <svg className="absolute" width="0" height="0">
          <defs>
            {zones.map((tag) =>
              tag.rects && tag.rects.length > 0 ? (
                <clipPath key={tag.id} id={`zbb-${tag.id}`} clipPathUnits="objectBoundingBox">
                  {tag.rects.map((r, i) => (
                    <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
                  ))}
                </clipPath>
              ) : null,
            )}
          </defs>
        </svg>
      )}

      {/* Zone rectangles */}
      {zones.map((tag, idx) => {
        const isSelected = tag.target_id === selectedZoneId
        const isComposite = tag.rects && tag.rects.length > 0
        const photo = photoMap?.get(tag.target_id)
        const zoneItemCount = items?.filter((i) => i.location_id === tag.target_id).length ?? 0

        return (
          <div
            key={tag.id}
            data-zone-target={tag.target_id}
            onClick={(e) => {
              e.stopPropagation()
              onZoneTap(tag.target_id)
            }}
            className={[
              'absolute cursor-pointer transition-shadow duration-150 overflow-hidden group',
              isComposite
                ? ''
                : [
                    'rounded-lg border',
                    isSelected
                      ? 'ring-2 ring-themeyellow border-themeyellow/50'
                      : 'border-themeblue3/30 hover:bg-themeblue3/15',
                    !photo && (isSelected ? 'bg-themeyellow/20' : 'bg-themeblue3/10'),
                  ].filter(Boolean).join(' '),
            ].join(' ')}
            style={{
              left: `${tag.x * 100}%`,
              top: `${tag.y * 100}%`,
              width: `${(tag.width ?? 0) * 100}%`,
              height: `${(tag.height ?? 0) * 100}%`,
              zIndex: idx,
              ...(isComposite ? { clipPath: `url(#zbb-${tag.id})` } : {}),
            }}
          >
            {photo && !isComposite && (
              <img src={photo} alt={tag.label} className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
            )}
            {isComposite && (
              <CompositeZoneSVG rects={tag.rects!} selected={isSelected} id={tag.id} photo={photo} />
            )}
            {isSelected && photo && !isComposite && (
              <div className="absolute inset-0 bg-themeyellow/20 pointer-events-none" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-1 gap-0.5 overflow-hidden">
              <span
                className="text-[10pt] font-medium text-center leading-tight line-clamp-2 pointer-events-none"
                style={photo
                  ? { color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' }
                  : undefined}
              >
                {tag.label}
              </span>
              {zoneItemCount > 0 && (
                <span className={[
                  'text-[9pt] px-1.5 py-0.5 rounded-full pointer-events-none',
                  photo ? 'bg-black/40 text-white' : 'bg-black/10 text-themeblue1',
                ].join(' ')}>
                  {zoneItemCount} {zoneItemCount === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>

          </div>
        )
      })}

      {/* Item pins — spatially positioned, tap-only in view mode */}
      {itemPins.map((pin) => {
        const item = itemById.get(pin.target_id)
        if (!item) return null
        return (
          <ItemPin
            key={pin.id}
            pin={pin}
            item={item}
            onTap={onItemTap ?? (() => {})}
          />
        )
      })}
    </div>
  )
})
