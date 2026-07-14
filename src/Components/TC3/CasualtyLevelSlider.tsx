import { useCallback, useRef, useState } from 'react'
import type { CasualtyStop } from './casualtyOrder'

/** Center-to-center notch spacing, thumb diameter, track padding (px). */
const STOP = 38
const THUMB = 34
const PAD = 3
/** Cap the visible track height at this many notches; overflow scrolls. */
const MAX_VISIBLE = 5

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Vertical "triage ladder" casualty picker — a liquid-glass slider whose thumb
 * rides up/down the casualty roster, most-urgent on top. Modeled on the property
 * FloorSlider: the thumb follows the finger but SNAPS to notches, surfacing each
 * casualty live as the drag crosses its stop, so it feels continuous while the
 * result stays discrete. Every notch is tappable too, so drag isn't the only way.
 *
 * Each notch is coloured by its triage band (Urgent red / Priority amber /
 * Routine green / unassigned grey) and labelled band-code + ordinal (U1, P1, R2…).
 *
 * When the roster exceeds {@link MAX_VISIBLE}, the track caps its height and the
 * visible window scrolls: dragging to the top/bottom edge surfaces the next
 * casualties in that direction. At rest the window centers the active casualty.
 *
 * Controlled: the highlighted stop is always `activeId`; local drag state only
 * drives the thumb + window visually while a pointer is down.
 */
export function CasualtyLevelSlider({
  entries,
  activeId,
  onSelect,
}: {
  entries: CasualtyStop[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState<number | null>(null)
  const [dragWindow, setDragWindow] = useState<number | null>(null)

  const n = entries.length
  const visibleCount = Math.min(n, MAX_VISIBLE)
  const windowH = 2 * PAD + THUMB + (visibleCount - 1) * STOP
  const maxWindow = Math.max(0, n - visibleCount)
  const activeIndex = Math.max(0, entries.findIndex((e) => e.id === activeId))

  // At rest, center the active casualty in the window (clamped to the ends).
  const restingWindow = clamp(activeIndex - Math.floor((visibleCount - 1) / 2), 0, maxWindow)
  const windowStart = dragWindow ?? restingWindow
  const visible = entries.slice(windowStart, windowStart + visibleCount)

  // Center Y of local stop i within the (windowed) track.
  const centerY = (i: number) => PAD + THUMB / 2 + i * STOP
  const activeLocal = clamp(activeIndex - windowStart, 0, visibleCount - 1)
  const thumbCenter = dragY != null ? dragY : centerY(activeLocal)
  const thumbTop = clamp(thumbCenter - THUMB / 2, PAD, PAD + (visibleCount - 1) * STOP)
  const active = entries[activeIndex]
  const activeLabel = active?.label ?? ''
  const activeColor = active?.colorClass ?? 'bg-tertiary/40'

  const applyFromClientY = useCallback(
    (clientY: number, commit: boolean) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const y = clientY - rect.top

      // Edge-scroll: dragging past the top/bottom of a capped track shifts the
      // window one notch toward the finger, surfacing the next casualty.
      let ws = dragWindow ?? restingWindow
      if (!commit) {
        if (y < PAD && ws > 0) ws -= 1
        else if (y > windowH - PAD && ws < maxWindow) ws += 1
      }

      const localI = clamp(Math.round((y - (PAD + THUMB / 2)) / STOP), 0, visibleCount - 1)
      const realIdx = clamp(ws + localI, 0, n - 1)

      setDragWindow(commit ? null : ws)
      setDragY(commit ? null : clamp(y, PAD + THUMB / 2, windowH - PAD - THUMB / 2))

      const id = entries[realIdx]?.id
      if (id && id !== activeId) onSelect(id)
    },
    [dragWindow, restingWindow, windowH, maxWindow, visibleCount, n, entries, activeId, onSelect],
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

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label="Casualty"
      aria-valuetext={`Casualty ${activeLabel}`}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={n - 1 - activeIndex}
      className="relative w-10 touch-none select-none overflow-hidden rounded-full border border-white/40 bg-themewhite2/60 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-themewhite3/50"
      style={{ height: windowH }}
    >
      {/* More-above / more-below affordance when the window is scrolled. */}
      {windowStart > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-4 rounded-t-full bg-gradient-to-b from-primary/15 to-transparent" />
      )}
      {windowStart < maxWindow && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-full bg-gradient-to-t from-primary/15 to-transparent" />
      )}

      {/* Notch labels (faint) — the triage axis behind the moving thumb. */}
      {visible.map((stop, localI) => (
        <button
          key={stop.id}
          onClick={(e) => {
            e.stopPropagation()
            if (stop.id !== activeId) onSelect(stop.id)
          }}
          className={`absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full text-[8pt] font-semibold transition-opacity ${
            stop.id === activeId ? 'opacity-0' : 'text-tertiary/70 active:text-primary'
          }`}
          style={{ top: centerY(localI) - THUMB / 2, height: THUMB, width: THUMB }}
          title={`Casualty ${stop.label}`}
          aria-label={`Casualty ${stop.label}`}
        >
          {stop.label}
        </button>
      ))}

      {/* Thumb — the liquid-glass lens over the current casualty, band-coloured. */}
      <div
        className={`pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full text-[8pt] font-bold tracking-tight text-white shadow-md ring-1 ring-white/40 ${activeColor}`}
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
