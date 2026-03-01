import { useRef, useCallback } from 'react'
import { useDrag } from '@use-gesture/react'
import { MapPin, Package } from 'lucide-react'
import { clamp } from '../../Utilities/GestureUtils'
import type { LocationTag } from '../../Types/PropertyTypes'

interface LocationTagPhotoProps {
  photoData: string
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

  return (
    <div ref={containerRef} className="relative w-full select-none touch-none">
      <img
        src={photoData}
        alt="Location"
        className="w-full rounded-lg"
        draggable={false}
      />

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
