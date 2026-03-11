/**
 * LocationTagPhoto — Renders zones as positioned divs within a scaled canvas.
 * Zones use their 0..1 normalised coords as CSS percentages.
 * No camera transforms — the canvas div itself scales and scrolls.
 *
 * Merged zones (those with `rects`) render as a single SVG composite shape
 * using clipPath for uniform fill + traced outline for the border.
 */
import { memo, useRef, useCallback } from 'react'
import { traceCompositeOutline } from '../../lib/tagIndex'
import type { LocationTag, ZoneRect } from '../../Types/PropertyTypes'

const TAP_THRESHOLD = 8

interface LocationTagPhotoProps {
  tags: LocationTag[]
  selectedZoneId: string | null
  onZoneTap: (targetId: string) => void
  scale: number
  /** Map of target_id → photo_data base64 URL for zone background images */
  photoMap?: Map<string, string>
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

export const LocationTagPhoto = memo(function LocationTagPhoto({
  tags,
  selectedZoneId,
  onZoneTap,
  scale,
  photoMap,
}: LocationTagPhotoProps) {
  const downRef = useRef<{ id: string; x: number; y: number } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent, targetId: string) => {
    e.stopPropagation()
    downRef.current = { id: targetId, x: e.clientX, y: e.clientY }
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const d = downRef.current
    if (!d) return
    downRef.current = null

    const dx = Math.abs(e.clientX - d.x)
    const dy = Math.abs(e.clientY - d.y)
    if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) {
      e.stopPropagation()
      onZoneTap(d.id)
    }
  }, [onZoneTap])

  const zones = tags.filter((t) => (t.width ?? 0) > 0 && (t.height ?? 0) > 0)

  return (
    <div
      className="relative origin-top-left"
      style={{
        width: `${scale * 100}%`,
        height: `${scale * 100}%`,
        minHeight: '100%',
      }}
    >
      {zones.map((tag) => {
        const isSelected = tag.target_id === selectedZoneId
        const isComposite = tag.rects && tag.rects.length > 0
        const photo = photoMap?.get(tag.target_id)

        return (
          <div
            key={tag.id}
            data-zone-target
            className={[
              'absolute cursor-pointer transition-shadow duration-150 overflow-hidden',
              isComposite
                ? (isSelected ? 'ring-2 ring-themeyellow' : '')
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
            }}
            onPointerDown={(e) => handlePointerDown(e, tag.target_id)}
            onPointerUp={handlePointerUp}
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
            <div className="absolute inset-0 flex items-center justify-center p-1 overflow-hidden pointer-events-none">
              <span className={[
                'text-[10pt] font-medium text-center leading-tight line-clamp-2',
                photo ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-themeblue1 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]',
              ].join(' ')}>
                {tag.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
})
