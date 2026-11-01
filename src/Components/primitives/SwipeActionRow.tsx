import { useRef, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { GESTURE_THRESHOLDS } from '@/Utilities/GestureUtils'

/**
 * SwipeActionRow — the chat-bubble gesture set for a list row / card:
 *   - swipe right (ltr, dx > 0) / swipe left (rtl, dx < 0) → per-side bound action
 *   - long-press (and right-click) → `onLongPress(rect)`, for the LiftedRowMenu
 *   - tap → `onClick`
 *
 * Gesture mechanics are SwipeToDeleteRow's (direction lock, threshold/max, reveal
 * painted only while a swipe is live, trailing tap swallowed) generalized to two
 * sides with caller-supplied icon + panel colour, so a user's swipe bindings
 * (Messaging-style picker) can drive it. A side with no `SwipeSide` rubber-bands.
 *
 * Touches starting in the left edge zone are ignored so panel swipe-back wins
 * (same rule as MessageBubble). Long-press fires after `longPressMs` held
 * without crossing the direction-lock distance; any swipe cancels it.
 */

const SWIPE_THRESHOLD = 80
const SWIPE_MAX = 120

export interface SwipeSide {
  icon: LucideIcon
  /** Tailwind bg class for the reveal panel. */
  panel: string
  /** Receives the row's rect (a `menu` binding anchors the LiftedRowMenu to it). */
  onFire: (rect: DOMRect) => void
}

interface SwipeActionRowProps {
  /** Swipe right (dx > 0) — reveal sits on the LEFT. */
  ltr?: SwipeSide | null
  /** Swipe left (dx < 0) — reveal sits on the RIGHT. */
  rtl?: SwipeSide | null
  onClick?: () => void
  onLongPress?: (rect: DOMRect) => void
  longPressMs?: number
  /** Clipping wrapper classes — pass the row's rounding (e.g. `rounded-2xl`). */
  className?: string
  /** Content surface bg (covers the reveal at rest). Default `bg-themewhite2`. */
  surfaceClassName?: string
  children: ReactNode
}

export function SwipeActionRow({
  ltr, rtl, onClick, onLongPress, longPressMs = 400,
  className = '', surfaceClassName = 'bg-themewhite2', children,
}: SwipeActionRowProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; startY: number; locked: boolean | null } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set when a swipe locks horizontal or a long-press fires; eats the trailing click.
  const consumed = useRef(false)

  const setX = (x: number) => {
    if (contentRef.current) contentRef.current.style.transform = `translateX(${x}px)`
  }

  const showReveal = (side: 'left' | 'right' | null) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    if (leftRef.current) leftRef.current.style.opacity = side === 'left' ? '1' : '0'
    if (rightRef.current) rightRef.current.style.opacity = side === 'right' ? '1' : '0'
  }

  const snap = () => {
    const el = contentRef.current
    if (!el) return
    el.style.transition = 'transform 0.2s ease-out'
    el.style.transform = 'translateX(0)'
    hideTimer.current = setTimeout(() => showReveal(null), 200)
  }

  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  const fireLongPress = () => {
    if (!onLongPress || !wrapRef.current) return
    consumed.current = true
    onLongPress(wrapRef.current.getBoundingClientRect())
  }

  const onTouchStart = (e: React.TouchEvent) => {
    consumed.current = false
    const t = e.touches[0]
    if (t.clientX < GESTURE_THRESHOLDS.EDGE_ZONE) return
    drag.current = { startX: t.clientX, startY: t.clientY, locked: null }
    if (contentRef.current) contentRef.current.style.transition = 'none'
    cancelPress()
    if (onLongPress) {
      pressTimer.current = setTimeout(() => {
        pressTimer.current = null
        drag.current = null
        fireLongPress()
      }, longPressMs)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const state = drag.current
    if (!state) return
    const t = e.touches[0]
    const dx = t.clientX - state.startX
    const dy = t.clientY - state.startY
    if (state.locked === null) {
      if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return
      cancelPress()
      state.locked = Math.abs(dx) > Math.abs(dy)
      if (!state.locked) { drag.current = null; snap(); return }
      consumed.current = true
    }
    const side = dx > 0 ? ltr : rtl
    showReveal(side ? (dx > 0 ? 'left' : 'right') : null)
    // Bound side travels to SWIPE_MAX; an unbound side rubber-bands a hair.
    const offset = side
      ? Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx))
      : Math.max(-8, Math.min(8, dx * 0.1))
    setX(offset)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    cancelPress()
    const state = drag.current
    drag.current = null
    if (!state || !state.locked) return
    const dx = e.changedTouches[0].clientX - state.startX
    snap()
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    if (dx > SWIPE_THRESHOLD && ltr) ltr.onFire(rect)
    else if (dx < -SWIPE_THRESHOLD && rtl) rtl.onFire(rect)
  }

  const reveal = (side: SwipeSide | null | undefined, ref: React.RefObject<HTMLDivElement | null>, align: 'left' | 'right') => {
    if (!side) return null
    const Icon = side.icon
    return (
      <div
        ref={ref}
        aria-hidden
        style={{ opacity: 0 }}
        className={`absolute inset-0 flex items-center ${align === 'left' ? 'justify-start pl-6' : 'justify-end pr-6'} ${side.panel}`}
      >
        <Icon size={20} className="text-white" />
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${className}`}>
      {reveal(ltr, leftRef, 'left')}
      {reveal(rtl, rightRef, 'right')}
      <div
        ref={contentRef}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { cancelPress(); drag.current = null; snap() }}
        onClickCapture={(e) => {
          if (consumed.current) { e.stopPropagation(); e.preventDefault(); consumed.current = false }
        }}
        onClick={onClick}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
        onContextMenu={onLongPress ? (e) => { e.preventDefault(); fireLongPress(); consumed.current = false } : undefined}
        // iOS: suppress the native callout/selection that would touchcancel the long-press.
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'pan-y' }}
        className={`relative will-change-transform select-none ${surfaceClassName}`}
      >
        {children}
      </div>
    </div>
  )
}
