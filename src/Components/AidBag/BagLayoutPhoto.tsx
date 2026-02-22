/**
 * Displays a bag layout photo with positioned label pins.
 * View mode: static labels with tap handler.
 * Edit mode: draggable labels with remove button.
 */
import { useRef, useCallback } from 'react'
import { useDrag } from '@use-gesture/react'
import { MapPin, X } from 'lucide-react'
import { clamp } from '../../Utilities/GestureUtils'
import type { BagLabel } from '../../Types/BagLayoutTypes'

interface BagLayoutPhotoProps {
  photoData: string
  labels: BagLabel[]
  editable?: boolean
  onLabelTap?: (label: BagLabel) => void
  onLabelDrag?: (labelId: string, x: number, y: number) => void
  onLabelRemove?: (labelId: string) => void
}

export function BagLayoutPhoto({
  photoData,
  labels,
  editable = false,
  onLabelTap,
  onLabelDrag,
  onLabelRemove,
}: BagLayoutPhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ touchAction: editable ? 'none' : 'auto' }}
    >
      <img
        src={photoData}
        alt="Bag layout"
        className="w-full h-auto rounded-lg"
        draggable={false}
      />

      {labels.map(label => (
        editable ? (
          <DraggableLabel
            key={label.id}
            label={label}
            containerRef={containerRef}
            onDrag={onLabelDrag}
            onRemove={onLabelRemove}
          />
        ) : (
          <button
            key={label.id}
            className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-medium shadow-md -translate-x-1/2 -translate-y-1/2 hover:bg-black/80 transition-colors max-w-[120px]"
            style={{ left: `${label.x * 100}%`, top: `${label.y * 100}%` }}
            onClick={() => onLabelTap?.(label)}
          >
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{label.text}</span>
          </button>
        )
      ))}
    </div>
  )
}

/** Individual draggable label for edit mode */
function DraggableLabel({
  label,
  containerRef,
  onDrag,
  onRemove,
}: {
  label: BagLabel
  containerRef: React.RefObject<HTMLDivElement>
  onDrag?: (labelId: string, x: number, y: number) => void
  onRemove?: (labelId: string) => void
}) {
  const labelRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: label.x, y: label.y })
  posRef.current = { x: label.x, y: label.y }

  const handleDragEnd = useCallback((px: number, py: number) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const normalX = clamp(px / rect.width, 0, 1)
    const normalY = clamp(py / rect.height, 0, 1)
    onDrag?.(label.id, normalX, normalY)
  }, [containerRef, label.id, onDrag])

  const bind = useDrag(({ active, xy: [clientX, clientY], event }) => {
    event?.preventDefault()
    const container = containerRef.current
    const el = labelRef.current
    if (!container || !el) return

    const rect = container.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top

    if (active) {
      // Move label visually during drag
      const pctX = clamp(px / rect.width, 0, 1) * 100
      const pctY = clamp(py / rect.height, 0, 1) * 100
      el.style.left = `${pctX}%`
      el.style.top = `${pctY}%`
    } else {
      handleDragEnd(px, py)
    }
  }, { filterTaps: true })

  return (
    <div
      ref={labelRef}
      {...bind()}
      className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-themeblue3/90 text-white text-[10px] font-medium shadow-md -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing max-w-[140px] touch-none"
      style={{ left: `${label.x * 100}%`, top: `${label.y * 100}%` }}
    >
      <MapPin size={10} className="shrink-0" />
      <span className="truncate">{label.text}</span>
      <button
        className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 shrink-0"
        onClick={(e) => { e.stopPropagation(); onRemove?.(label.id) }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <X size={8} />
      </button>
    </div>
  )
}
