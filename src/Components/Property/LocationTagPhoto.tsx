/**
 * LocationTagPhoto — Renders zones as positioned divs within a scaled canvas.
 * Zones use their 0..1 normalised coords as CSS percentages.
 * No camera transforms — the canvas div itself scales and scrolls.
 *
 * Merged zones (those with `rects`) render as a single SVG composite shape
 * using clipPath for uniform fill + traced outline for the border.
 *
 * Item pins float at their x/y positions over the canvas and are draggable.
 */
import { memo, useState, useRef, useCallback } from 'react'
import { MoreHorizontal } from 'lucide-react'
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
  /** Called when ellipsis menu button is tapped — provides targetId and tap coords */
  onZoneMenu?: (targetId: string, x: number, y: number) => void
  /** Called when an item pin is dragged to a new position */
  onItemPinMove?: (targetId: string, canvasId: string, newX: number, newY: number) => void
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

interface ItemPinProps {
  pin: LocationTag
  item: LocalPropertyItem
  onTap: (item: LocalPropertyItem) => void
  onPinMove?: (targetId: string, canvasId: string, newX: number, newY: number) => void
  canvasRef: React.RefObject<HTMLDivElement | null>
}

function ItemPin({ pin, item, onTap, onPinMove, canvasRef }: ItemPinProps) {
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const dragState = useRef<{
    startClientX: number
    startClientY: number
    moved: boolean
    pointerId: number
  } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragState.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    }
    setDragOffset({ dx: 0, dy: 0 })
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    e.stopPropagation()
    const dx = e.clientX - dragState.current.startClientX
    const dy = e.clientY - dragState.current.startClientY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragState.current.moved = true
    }
    setDragOffset({ dx, dy })
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    e.stopPropagation()
    const wasMoved = dragState.current.moved
    dragState.current = null

    if (!wasMoved) {
      setDragOffset(null)
      onTap(item)
      return
    }

    // Compute new normalised position relative to the canvas container
    const canvas = canvasRef.current
    if (!canvas || !onPinMove) {
      setDragOffset(null)
      return
    }

    const rect = canvas.getBoundingClientRect()
    const newX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    setDragOffset(null)
    onPinMove(pin.target_id, pin.location_id, newX, newY)
  }, [item, onTap, onPinMove, pin.target_id, pin.location_id, canvasRef])

  const isDragging = dragOffset !== null && (dragState.current?.moved ?? false)

  return (
    <div
      className={[
        'absolute z-20 select-none touch-none',
        isDragging ? 'cursor-grabbing' : 'cursor-pointer',
      ].join(' ')}
      style={{
        left: `${pin.x * 100}%`,
        top: `${pin.y * 100}%`,
        transform: dragOffset
          ? `translate(calc(-50% + ${dragOffset.dx}px), calc(-50% + ${dragOffset.dy}px))`
          : 'translate(-50%, -50%)',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className={[
          'px-2 py-1 rounded-full text-[8pt] font-medium whitespace-nowrap max-w-[100px] truncate',
          'bg-themewhite3/90 text-primary border border-themeblue3/30 shadow-sm backdrop-blur-sm',
          'min-h-[32px] flex items-center active:scale-95 transition-transform',
          isDragging ? 'shadow-md scale-105' : '',
        ].join(' ')}
      >
        {item.name}
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
  onZoneMenu,
  onItemPinMove,
}: LocationTagPhotoProps) {
  const zones = tags.filter((t) => (t.width ?? 0) > 0 && (t.height ?? 0) > 0)
  const itemPins = tags.filter((t) => t.target_type === 'item')
  const canvasRef = useRef<HTMLDivElement>(null)

  // Build item lookup by id
  const itemById = new Map<string, LocalPropertyItem>()
  if (items) {
    for (const item of items) itemById.set(item.id, item)
  }

  return (
    <div
      ref={canvasRef}
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
              <span className={[
                'text-[10pt] font-medium text-center leading-tight line-clamp-2 pointer-events-none',
                photo ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-themeblue1 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]',
              ].join(' ')}>
                {tag.label}
              </span>
              {zoneItemCount > 0 && (
                <span className="text-[8pt] px-1.5 py-0.5 rounded-full bg-black/10 text-themeblue1 pointer-events-none">
                  {zoneItemCount} {zoneItemCount === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>

            {/* Ellipsis menu button — visible on selected (mobile) or hover (desktop) */}
            {onZoneMenu && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onZoneMenu(tag.target_id, e.clientX, e.clientY)
                }}
                className={[
                  'absolute top-1 right-1 w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-all',
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                ].join(' ')}
              >
                <MoreHorizontal size={14} className="text-white" />
              </button>
            )}
          </div>
        )
      })}

      {/* Item pins — spatially positioned, draggable */}
      {itemPins.map((pin) => {
        const item = itemById.get(pin.target_id)
        if (!item) return null
        return (
          <ItemPin
            key={pin.id}
            pin={pin}
            item={item}
            onTap={onItemTap ?? (() => {})}
            onPinMove={onItemPinMove}
            canvasRef={canvasRef}
          />
        )
      })}
    </div>
  )
})
