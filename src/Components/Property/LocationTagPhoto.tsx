import { useRef, useState, useCallback } from 'react'
import { useDrag } from '@use-gesture/react'
import { MapPin, Package, ZoomIn, ZoomOut } from 'lucide-react'
import { clamp } from '../../Utilities/GestureUtils'
import type { LocationTag } from '../../Types/PropertyTypes'

interface LocationTagPhotoProps {
  photoData?: string | null
  tags: LocationTag[]
  isEditMode: boolean
  onTagTap?: (tag: LocationTag) => void
  onTagDrag?: (tagId: string, x: number, y: number) => void
}

export function LocationTagPhoto({
  photoData,
  tags,
  isEditMode,
  onTagTap,
  onTagDrag,
}: LocationTagPhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  return (
    <div className="relative">
      {/* Scrollable viewport */}
      <div
        className="max-h-[40vh] rounded-lg"
        style={{ overflow: zoom > 1 ? 'auto' : 'hidden' }}
      >
        {/* Zoomable content — width scales with zoom so native scroll handles panning */}
        <div
          ref={containerRef}
          className="relative select-none"
          style={{
            width: `${zoom * 100}%`,
            touchAction: isEditMode ? 'none' : 'auto',
          }}
        >
          {photoData ? (
            <img
              src={photoData}
              alt="Location"
              className="w-full rounded-lg"
              draggable={false}
            />
          ) : (
            <div
              className="w-full rounded-lg"
              style={{
                aspectRatio: '1 / 1',
                backgroundColor: '#f0f0f0',
                backgroundImage:
                  'linear-gradient(to right, #e0e0e0 1px, transparent 1px), linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }}
            />
          )}

          {tags.map((tag) =>
            isEditMode ? (
              <DraggableTag
                key={tag.id}
                tag={tag}
                containerRef={containerRef}
                onDrag={onTagDrag}
              />
            ) : (
              <StaticTag
                key={tag.id}
                tag={tag}
                onTap={onTagTap}
              />
            )
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1 z-10">
        <button
          className="p-1.5 rounded-full bg-black/50 text-white shadow-md hover:bg-black/60 transition-colors disabled:opacity-30"
          onClick={() => setZoom((z) => Math.min(z + 0.5, 3))}
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="p-1.5 rounded-full bg-black/50 text-white shadow-md hover:bg-black/60 transition-colors disabled:opacity-30"
          onClick={() => setZoom((z) => Math.max(z - 0.5, 1))}
          disabled={zoom <= 1}
        >
          <ZoomOut size={14} />
        </button>
      </div>
    </div>
  )
}

function StaticTag({ tag, onTap }: { tag: LocationTag; onTap?: (tag: LocationTag) => void }) {
  return (
    <button
      className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-medium shadow-md -translate-x-1/2 -translate-y-1/2 hover:bg-black/80 transition-colors max-w-[120px]"
      style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
      onClick={() => onTap?.(tag)}
    >
      {tag.target_type === 'location' ? (
        <MapPin size={10} className="shrink-0" />
      ) : (
        <Package size={10} className="shrink-0" />
      )}
      <span className="truncate">{tag.label}</span>
    </button>
  )
}

function DraggableTag({
  tag,
  containerRef,
  onDrag,
}: {
  tag: LocationTag
  containerRef: React.RefObject<HTMLDivElement | null>
  onDrag?: (tagId: string, x: number, y: number) => void
}) {
  const labelRef = useRef<HTMLDivElement>(null)

  const bind = useDrag(
    ({ active, xy: [clientX, clientY], event }) => {
      event?.preventDefault()
      const container = containerRef.current
      const el = labelRef.current
      if (!container || !el) return

      const rect = container.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top

      if (active) {
        const pctX = clamp(px / rect.width, 0, 1) * 100
        const pctY = clamp(py / rect.height, 0, 1) * 100
        el.style.left = `${pctX}%`
        el.style.top = `${pctY}%`
      } else {
        const normalX = clamp(px / rect.width, 0, 1)
        const normalY = clamp(py / rect.height, 0, 1)
        onDrag?.(tag.id, normalX, normalY)
      }
    },
    { filterTaps: true },
  )

  return (
    <div
      ref={labelRef}
      {...bind()}
      className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-themeblue3/90 text-white text-[10px] font-medium shadow-md -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing max-w-[120px] ring-2 ring-white/50"
      style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%`, touchAction: 'none' }}
    >
      {tag.target_type === 'location' ? (
        <MapPin size={10} className="shrink-0" />
      ) : (
        <Package size={10} className="shrink-0" />
      )}
      <span className="truncate">{tag.label}</span>
    </div>
  )
}
