/**
 * SliderRail — the one liquid-glass slider used for every discrete selector in the
 * app, in both orientations. A track holds evenly-spaced stops; a thumb rides to
 * the active one, following the finger during a drag but SNAPPING to stops, so the
 * gesture feels continuous while the result stays discrete. Every stop is also
 * tappable, so drag is never the only way in.
 *
 * Consolidates three drifted recipes: the property FloorSlider, the TC3
 * CasualtyLevelSlider (both vertical, each carrying its own copy of this drag
 * engine), and the horizontal bottom island, which used to repaint its active
 * button in place with no thumb and no drag at all.
 *
 * Controlled: the highlighted stop is always `activeId`, re-derived from store
 * state after `onSelect`. Local drag state only moves the thumb visually while a
 * pointer is down. A stop whose handler does not change `activeId` therefore
 * springs the thumb back on release, which is what makes {@link SliderStop.momentary}
 * work.
 *
 * ORIENTATION is the only geometry switch — spacing, thumb size and chrome are
 * shared constants so the two axes are literally the same control turned 90°.
 * 'vertical' rails are index-0-at-top (callers pre-sort highest-first).
 *
 * WINDOWING: when stops exceed `maxVisible`, the track caps its length and the
 * visible window scrolls — dragging to either edge surfaces the next stops in that
 * direction. At rest the window centers the active stop.
 */
import type { ReactNode } from 'react'
import { useCallback, useRef, useState } from 'react'

/** Center-to-center stop spacing, thumb diameter, track padding (px). */
export const STOP = 44
export const THUMB = 40
export const PAD = 5

/**
 * The glass track chrome, shared verbatim by every surface that is "a rail or a
 * piece of one": this track, the BottomIsland bar, the AddFab tray, the
 * FloorSelector delete chip. Exported so those cannot drift apart again.
 *
 * No border. A hairline stroke on a translucent pill reads as a seam against busy
 * content (map tiles, photos) and fought the blur; edge definition now comes from
 * `.rail-shadow` alone, which is why that shadow carries a contact layer.
 */
export const RAIL_GLASS =
  'rounded-full bg-themewhite2/60 rail-shadow backdrop-blur-md dark:bg-themewhite3/50'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface SliderStop {
  id: string
  /** Short text shown in the thumb and behind it on the axis. Omit when using `icon`. */
  label?: string
  /** Glyph rendered instead of `label` (bottom islands). Caller sizes it. */
  icon?: ReactNode
  /** Accessible name; falls back to `label`. */
  title?: string
  /** Thumb fill when this stop is active (triage bands). Default `bg-themeblue3`. */
  colorClass?: string
  /**
   * One-shot action rather than a destination (Property's camera, Calendar's view
   * options). Fires on tap/release only — a drag sweeping ACROSS it does not
   * trigger it, and since the rail is controlled the thumb springs back unless the
   * handler actually moves `activeId` here.
   */
  momentary?: boolean
  /** Overlay node anchored to this stop (unread count, recording dot). */
  badge?: ReactNode
  /**
   * Draw a hairline in the gap before this stop, splitting the rail into groups —
   * Calendar uses it so its options toggle doesn't read as a fourth view. Purely
   * decorative; the thumb crosses it like any other gap.
   */
  dividerBefore?: boolean
}

interface SliderRailProps {
  stops: SliderStop[]
  activeId: string | null
  onSelect: (id: string) => void
  orientation?: 'horizontal' | 'vertical'
  /** Cap the visible stop count; overflow scrolls the window. Default: show all. */
  maxVisible?: number
  /** Accessible name for the rail. */
  label: string
  /** Prefix for each stop's accessible name, e.g. 'Floor' → "Floor 2F". */
  stopNoun?: string
  /** ARIA role for the track. Default 'slider'; pass 'tablist' for view switchers. */
  role?: string
  /** Extra classes on the track (positioning is the caller's; sizing is ours). */
  className?: string
}

export function SliderRail({
  stops,
  activeId,
  onSelect,
  orientation = 'vertical',
  maxVisible,
  label,
  stopNoun,
  role = 'slider',
  className = '',
}: SliderRailProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragPos, setDragPos] = useState<number | null>(null)
  const [dragWindow, setDragWindow] = useState<number | null>(null)
  /**
   * The track takes pointer capture, so a tap's `pointerup` retargets from the stop
   * button to the track and the button's `click` may never fire — the pointer path
   * has to be able to select on its own. When the click DOES arrive it would be a
   * second selection, which for a momentary stop means toggling twice and looking
   * dead. So: cleared on pointerdown, set on pointerup, consumed by the click.
   * A keyboard activation never sets it, so Enter/Space still selects.
   */
  const pointerHandled = useRef(false)

  const horizontal = orientation === 'horizontal'
  const n = stops.length
  const visibleCount = Math.min(n, maxVisible ?? n)
  const trackLen = 2 * PAD + THUMB + (visibleCount - 1) * STOP
  const maxWindow = Math.max(0, n - visibleCount)
  const activeIndex = Math.max(0, stops.findIndex((s) => s.id === activeId))

  // At rest the window centers the active stop, clamped to the ends.
  const restingWindow = clamp(activeIndex - Math.floor((visibleCount - 1) / 2), 0, maxWindow)
  const windowStart = dragWindow ?? restingWindow
  const visible = stops.slice(windowStart, windowStart + visibleCount)

  /** Center of local stop i along the track axis. */
  const centerAt = (i: number) => PAD + THUMB / 2 + i * STOP
  const activeLocal = clamp(activeIndex - windowStart, 0, visibleCount - 1)
  const thumbCenter = dragPos ?? centerAt(activeLocal)
  const thumbOffset = clamp(thumbCenter - THUMB / 2, PAD, PAD + (visibleCount - 1) * STOP)

  const active = stops[activeIndex]
  const activeColor = active?.colorClass ?? 'bg-themeblue3'
  const named = (s?: SliderStop) => s?.title ?? [stopNoun, s?.label].filter(Boolean).join(' ')

  const applyFromPointer = useCallback(
    (client: number, commit: boolean) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const p = client - (horizontal ? rect.left : rect.top)

      // Edge-scroll: dragging past either end of a capped track shifts the window
      // one stop toward the finger, surfacing the next stop.
      let ws = dragWindow ?? restingWindow
      if (!commit) {
        if (p < PAD && ws > 0) ws -= 1
        else if (p > trackLen - PAD && ws < maxWindow) ws += 1
      }

      const localI = clamp(Math.round((p - (PAD + THUMB / 2)) / STOP), 0, visibleCount - 1)
      const target = stops[clamp(ws + localI, 0, n - 1)]

      setDragWindow(commit ? null : ws)
      setDragPos(commit ? null : clamp(p, PAD + THUMB / 2, trackLen - PAD - THUMB / 2))

      if (!target) return
      // Momentary stops are actions, not destinations: a drag sweeping ACROSS one
      // must not fire it, only a gesture ENDING on it — and then every time, since
      // re-tapping an open toggle is how it closes.
      const fire = commit ? target.momentary || target.id !== activeId : !target.momentary && target.id !== activeId
      if (fire) onSelect(target.id)
    },
    [horizontal, dragWindow, restingWindow, trackLen, maxWindow, visibleCount, n, stops, activeId, onSelect],
  )

  const coord = (e: React.PointerEvent) => (horizontal ? e.clientX : e.clientY)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointerHandled.current = false
      e.currentTarget.setPointerCapture(e.pointerId)
      applyFromPointer(coord(e), false)
    },
    [applyFromPointer, horizontal],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragPos == null && !e.currentTarget.hasPointerCapture(e.pointerId)) return
      applyFromPointer(coord(e), false)
    },
    [applyFromPointer, dragPos, horizontal],
  )
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      applyFromPointer(coord(e), true)
      pointerHandled.current = true
    },
    [applyFromPointer, horizontal],
  )

  const axis = horizontal
    ? { width: trackLen, height: 2 * PAD + THUMB }
    : { width: 2 * PAD + THUMB, height: trackLen }
  const thumbStyle = horizontal
    ? { left: thumbOffset, top: PAD }
    : { top: thumbOffset, left: PAD }
  // Clip only when the window actually scrolls — an unwindowed rail must let a
  // stop's badge (TC3's casualty count) hang over the track edge.
  const clip = maxWindow > 0 ? 'overflow-hidden' : ''
  // Fades hinting at stops outside a scrolled window, on the axis in play.
  const fadeStart = horizontal ? 'inset-y-0 left-0 w-4 bg-gradient-to-r' : 'inset-x-0 top-0 h-4 bg-gradient-to-b'
  const fadeEnd = horizontal ? 'inset-y-0 right-0 w-4 bg-gradient-to-l' : 'inset-x-0 bottom-0 h-4 bg-gradient-to-t'

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role={role}
      aria-label={label}
      {...(role === 'slider'
        ? {
            'aria-valuetext': named(active),
            'aria-valuemin': 0,
            'aria-valuemax': n - 1,
            // Vertical rails are highest-first, so invert to make up = larger.
            'aria-valuenow': horizontal ? activeIndex : n - 1 - activeIndex,
          }
        : {})}
      className={`relative touch-none select-none ${RAIL_GLASS} ${clip} ${className}`}
      style={axis}
    >
      {windowStart > 0 && (
        <div className={`pointer-events-none absolute ${fadeStart} from-primary/15 to-transparent`} />
      )}
      {windowStart < maxWindow && (
        <div className={`pointer-events-none absolute ${fadeEnd} from-primary/15 to-transparent`} />
      )}

      {/* Group hairlines, centred in the gap before their stop. */}
      {visible.map((stop, localI) =>
        stop.dividerBefore && localI > 0 ? (
          <div
            key={`div-${stop.id}`}
            aria-hidden
            className="pointer-events-none absolute bg-tertiary/20"
            style={
              horizontal
                ? { left: centerAt(localI) - STOP / 2, top: PAD + 5, width: 1, height: THUMB - 10 }
                : { top: centerAt(localI) - STOP / 2, left: PAD + 5, height: 1, width: THUMB - 10 }
            }
          />
        ) : null,
      )}

      {/* The axis behind the thumb: every stop faint and tappable, the active one
          hidden because the thumb is drawing it. */}
      {visible.map((stop, localI) => (
        <button
          key={stop.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (pointerHandled.current) { pointerHandled.current = false; return }
            if (stop.momentary || stop.id !== activeId) onSelect(stop.id)
          }}
          {...(role === 'tablist' ? { role: 'tab', 'aria-selected': stop.id === activeId } : {})}
          className={`absolute flex items-center justify-center rounded-full text-[9pt] font-semibold transition-opacity ${
            stop.id === activeId ? 'opacity-0' : 'text-tertiary/70 active:text-primary'
          }`}
          style={{
            ...(horizontal ? { left: centerAt(localI) - THUMB / 2, top: PAD } : { top: centerAt(localI) - THUMB / 2, left: PAD }),
            height: THUMB,
            width: THUMB,
          }}
          title={named(stop)}
          aria-label={named(stop)}
        >
          {stop.icon ?? stop.label}
          {stop.badge}
        </button>
      ))}

      {/* Thumb — the glass lens over the current stop. */}
      <div
        className={`pointer-events-none absolute flex items-center justify-center rounded-full text-[9pt] font-bold tracking-tight text-white shadow-md ring-1 ring-white/40 ${activeColor}`}
        style={{
          ...thumbStyle,
          height: THUMB,
          width: THUMB,
          transition: dragPos == null ? `${horizontal ? 'left' : 'top'} 0.18s cubic-bezier(0.22,1,0.36,1)` : 'none',
        }}
      >
        {active?.icon ?? active?.label}
        {active?.badge}
      </div>
    </div>
  )
}
