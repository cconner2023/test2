import { useCallback, useMemo, useRef, useState } from 'react'

/** One selectable floor stop on the slider (top = highest floor, bottom = ground). */
export interface FloorStop {
  id: string
  label: string
}

/** Center-to-center spacing between floor notches, and the thumb diameter (px). */
const STOP = 38
const THUMB = 34
const PAD = 3

/**
 * Vertical "elevator" floor picker — a liquid-glass slider whose thumb rides up/down the
 * building's floors. Up = higher floor (entries are pre-sorted highest-first). The thumb
 * follows the finger smoothly but SNAPS to floor notches, surfacing each floor live as the
 * drag crosses its stop, so it feels continuous while the result stays discrete. Every stop
 * is also tappable, so drag isn't the only way in.
 *
 * Controlled: the highlighted stop is always `activeId` (re-derived from store state after
 * onSelect); local drag offset only drives the thumb visually while a pointer is down.
 */
export function FloorSlider({
  entries,
  activeId,
  onSelect,
}: {
  entries: FloorStop[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState<number | null>(null)

  const n = entries.length
  const trackH = 2 * PAD + THUMB + (n - 1) * STOP
  const activeIndex = Math.max(0, entries.findIndex((e) => e.id === activeId))

  // Center Y of stop i within the track.
  const centerY = useCallback((i: number) => PAD + THUMB / 2 + i * STOP, [])
  // Nearest stop index for a raw Y in track space.
  const indexAt = useCallback(
    (y: number) => {
      const raw = Math.round((y - (PAD + THUMB / 2)) / STOP)
      return Math.min(n - 1, Math.max(0, raw))
    },
    [n],
  )

  const thumbCenter = dragY != null ? dragY : centerY(activeIndex)
  const thumbTop = Math.min(
    PAD + (n - 1) * STOP,
    Math.max(PAD, thumbCenter - THUMB / 2),
  )
  const activeLabel = entries[activeIndex]?.label ?? ''

  const applyFromClientY = useCallback(
    (clientY: number, commit: boolean) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const y = clientY - rect.top
      setDragY(commit ? null : Math.min(trackH - PAD, Math.max(PAD, y)))
      const id = entries[indexAt(y)]?.id
      if (id && id !== activeId) onSelect(id)
    },
    [entries, indexAt, activeId, onSelect, trackH],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      applyFromClientY(e.clientY, false)
    },
    [applyFromClientY],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragY == null && !e.currentTarget.hasPointerCapture(e.pointerId)) return
      applyFromClientY(e.clientY, false)
    },
    [applyFromClientY, dragY],
  )
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      applyFromClientY(e.clientY, true)
    },
    [applyFromClientY],
  )

  // Faint labels behind the thumb, one per notch — makes it read as a floor axis.
  const ticks = useMemo(
    () =>
      entries.map((e, i) => ({
        id: e.id,
        label: e.label,
        top: centerY(i) - THUMB / 2,
      })),
    [entries, centerY],
  )

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label="Floor"
      aria-valuetext={`Floor ${activeLabel}`}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={n - 1 - activeIndex}
      className="relative w-10 touch-none select-none rounded-full border border-white/40 bg-themewhite2/60 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-themewhite3/50"
      style={{ height: trackH }}
    >
      {/* Notch labels (faint) — the axis behind the moving thumb */}
      {ticks.map((t) => (
        <button
          key={t.id}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(t.id)
          }}
          className={`absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full text-[8pt] font-semibold transition-opacity ${
            t.id === activeId ? 'opacity-0' : 'text-tertiary/70 active:text-primary'
          }`}
          style={{ top: t.top, height: THUMB, width: THUMB }}
          title={`Floor ${t.label}`}
          aria-label={`Floor ${t.label}`}
        >
          {t.label}
        </button>
      ))}

      {/* Thumb — the liquid-glass lens over the current floor */}
      <div
        className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-themeblue3 text-[9pt] font-bold text-white shadow-md ring-1 ring-white/40"
        style={{
          top: thumbTop,
          height: THUMB,
          width: THUMB,
          transition: dragY == null ? 'top 0.18s cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}
      >
        {activeLabel}
      </div>
    </div>
  )
}
