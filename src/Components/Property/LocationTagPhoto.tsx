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
import { itemAlert } from '../../Types/PropertyTypes'
import { DispatchDot } from './DispatchDot'
import type { DispatchStatus } from '../../lib/dispatchFold'

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
  /** Currently focused/selected item id — its pin gets the selected ring. */
  selectedItemId?: string | null
  /** target_id (vehicle location id) → current open-dispatch status, for the
   *  expiring/expired red-dot on the zone tile. Vehicles only; absent = no dot. */
  dispatchStatusByLocation?: Map<string, DispatchStatus>
  /** Zone target_ids that must render OPAQUE (solid fill) rather than the usual
   *  translucent tint — used for exploded floor tiles so they CLIP the floor beneath
   *  instead of blending through it. */
  opaqueZoneIds?: Set<string>
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

/**
 * ItemCallout — chat-bubble item marker shared by view + edit mode.
 *
 * A precise anchor dot marks the item's exact point at a fixed screen size (so the spot reads
 * accurately at any zoom); a rounded speech bubble with a tail floats off it — like a chat
 * message — carrying the name + quantity. The bubble sits above the anchor (below it near the
 * zone's top edge) and left/right-aligns near the side edges so it never overhangs. Selection is
 * a corner dot (orthogonal to the red expiring/expired/depleted fill). The caller owns the
 * positioned wrapper (its origin = the anchor point) plus the tap/drag handlers.
 */
export function ItemCallout({ item, anchorX, anchorY, selected, dragging }: {
  item: LocalPropertyItem
  /** Pin coords in the parent's 0..1 space — drive which way the bubble points so it stays on-canvas. */
  anchorX: number
  anchorY: number
  selected?: boolean
  /** Edit-mode drag in progress → lift the bubble (scale + heavier shadow) instead of the tap press. */
  dragging?: boolean
}) {
  // Expired / expiring (≤30d) / depleted (0 on hand) → red.
  const alert = itemAlert(item)
  const below = anchorY < 0.2 // near the top edge → hang the bubble below the anchor
  const align: 'left' | 'center' | 'right' = anchorX < 0.25 ? 'left' : anchorX > 0.75 ? 'right' : 'center'

  const GAP = 8 // px between the anchor dot and the bubble edge (the tail spans it)
  const INSET = 16 // px from the bubble's near edge to the tail, for side-aligned bubbles

  // Offset the bubble wrapper off the anchor point (the wrapper's origin).
  const tx = align === 'center' ? '-50%' : align === 'left' ? `-${INSET}px` : `calc(-100% + ${INSET}px)`
  const ty = below ? `${GAP}px` : `calc(-100% - ${GAP}px)`
  // Tail rides the edge nearest the anchor, sitting over the anchor's x within the bubble.
  const tailX = align === 'right' ? { right: INSET } : { left: align === 'center' ? '50%' : INSET }
  const tailTransform = `translate(${align === 'right' ? '50%' : '-50%'}, ${below ? '-50%' : '50%'}) rotate(45deg)`

  const surface = alert ? 'bg-themeredred/90 border-themeredred' : 'bg-themewhite3/90 border-themeblue3/30'

  return (
    <>
      {/* Anchor dot — the item's exact point. Only the SELECTED item gets it; on every
          unselected pin it just reads as clutter, so unselected items show the bubble alone. */}
      {selected && (
        <span
          className={`absolute top-0 left-0 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-themewhite3 shadow-sm ${
            alert ? 'bg-themeredred' : 'bg-themeblue1'
          }`}
        />
      )}
      {/* Position wrapper — keeps `transform` free on the bubble itself for the press/drag scale. */}
      <div className="absolute top-0 left-0" style={{ transform: `translate(${tx}, ${ty})` }}>
        <div
          className={`relative px-2.5 py-1 rounded-2xl text-[9pt] font-medium shadow-sm backdrop-blur-sm min-h-[24px] min-w-[52px] max-w-[140px] flex items-center gap-1 border transition-transform ${surface} ${
            alert ? 'text-white' : 'text-primary'
          } ${dragging ? 'scale-105 shadow-md' : 'active:scale-95'}`}
        >
          {/* Selection is shown by the anchor dot alone (connected to the bubble by the tail) —
              the earlier top-right corner dot double-marked the same selection, so it's dropped. */}
          {/* Chat-bubble tail — a rotated square whose two outer sides continue the bubble border. */}
          <span
            className={`absolute w-2.5 h-2.5 ${surface} ${below ? 'border-t border-l' : 'border-b border-r'}`}
            style={{ ...(below ? { top: 0 } : { bottom: 0 }), ...tailX, transform: tailTransform }}
          />
          <span className="whitespace-nowrap truncate">{item.name}</span>
          {/* Show the count when it's not a single unit — incl. ×0 so a depleted tag reads its emptiness. */}
          {item.quantity !== 1 && (
            <span className={`shrink-0 text-[8pt] font-semibold px-1 rounded-full leading-tight ${
              alert ? 'bg-white/25 text-white' : 'text-themeblue1 bg-themeblue3/15'
            }`}>×{item.quantity}</span>
          )}
        </div>
      </div>
    </>
  )
}

/** Item callout in view mode — tap-only, no drag (drag is handled by EditItemPin in edit mode). */
function ItemPin({ pin, item, onTap, selected, zIndex }: {
  pin: LocationTag
  item: LocalPropertyItem
  onTap: (item: LocalPropertyItem) => void
  selected?: boolean
  /** Stack order — always above every zone tile (tiles carry zIndex = their array index,
   *  which is unbounded; a fixed class let opaque exploded-floor tiles bury unselected pins). */
  zIndex: number
}) {
  return (
    <div
      data-item-target={item.id}
      className="absolute select-none cursor-pointer"
      style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, zIndex }}
      onClick={(e) => { e.stopPropagation(); onTap(item) }}
    >
      <ItemCallout item={item} anchorX={pin.x} anchorY={pin.y} selected={selected} />
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
  selectedItemId,
  dispatchStatusByLocation,
  opaqueZoneIds,
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
        // Exploded floor tiles render opaque so they occlude (clip) the floor beneath.
        const isOpaque = opaqueZoneIds?.has(tag.target_id)

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
              isOpaque && !isComposite ? 'shadow-md' : '',
              isComposite
                ? ''
                : [
                    'rounded-lg border',
                    isSelected
                      ? 'ring-2 ring-themeyellow border-themeyellow/50'
                      // hover:bg would REPLACE an opaque floor's solid underlay on hover and
                      // make it see-through — only the translucent (non-opaque) tiles get it.
                      : `border-themeblue3/30 ${isOpaque ? '' : 'hover:bg-themeblue3/15'}`,
                    // Opaque (fanned floor) → solid underlay so it occludes; the matching
                    // blue/yellow tint rides on top as an overlay (below). Otherwise the usual tint.
                    !photo &&
                      (isOpaque
                        ? 'bg-themewhite2 dark:bg-themewhite3'
                        : isSelected
                          ? 'bg-themeyellow/20'
                          : 'bg-themeblue3/10'),
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
            {/* Opaque floor tile: lay the SAME blue/yellow tint the base zone uses OVER the
                solid underlay, so the fanned floors read as one material with floor 1 rather
                than as bare white cards. The underlay does the occluding; the tint does the colour. */}
            {isOpaque && !isComposite && !photo && (
              <div className={`absolute inset-0 pointer-events-none ${isSelected ? 'bg-themeyellow/20' : 'bg-themeblue3/10'}`} />
            )}
            {/* Title hidden once selected — distracting and already shown in the sheet/right pane */}
            {!isSelected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-1 gap-0.5 overflow-hidden">
                <span className="flex items-center gap-1 max-w-full">
                  <span
                    className={['text-[10pt] font-medium text-center leading-tight line-clamp-2 pointer-events-none', !photo ? 'text-primary' : ''].join(' ')}
                    style={photo
                      ? { color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' }
                      : undefined}
                  >
                    {tag.label}
                  </span>
                  <DispatchDot status={dispatchStatusByLocation?.get(tag.target_id)} />
                </span>
              </div>
            )}

          </div>
        )
      })}

      {/* Item pins — spatially positioned, tap-only in view mode. Zone tiles carry
          zIndex = their array index (0..zones.length-1); pins therefore start ABOVE the
          topmost tile so an opaque exploded-floor tile (highest index in the fan) can't
          bury them. The selected pin rides one higher still. */}
      {itemPins.map((pin) => {
        const item = itemById.get(pin.target_id)
        if (!item) return null
        const isSelected = item.id === selectedItemId
        return (
          <ItemPin
            key={pin.id}
            pin={pin}
            item={item}
            onTap={onItemTap ?? (() => {})}
            selected={isSelected}
            zIndex={zones.length + (isSelected ? 2 : 1)}
          />
        )
      })}
    </div>
  )
})
