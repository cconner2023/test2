import { useRef, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'

// Matches MessageBubble's swipe feel so the gesture reads identically across the
// app. Cards diverge from bubbles only in the REVEAL: a solid theme-red panel
// with a black icon (no growing icon-circle), which keeps this primitive cheap
// to drop onto any row.
const SWIPE_THRESHOLD = 80 // px past which release fires onDelete
const SWIPE_MAX = 120 // px hard cap on travel

interface SwipeToDeleteRowProps {
  /** Fired once a right-to-left swipe is released past threshold. Open your
   *  ConfirmDialog here — the swipe requests deletion, it does not commit it. */
  onDelete: () => void
  /** No swipe surface when true (no permission / own row). Taps still pass through. */
  disabled?: boolean
  /** Applied to the clipping wrapper — pass row rounding (e.g. `rounded-lg`) so
   *  the red reveal is clipped to match a spaced/rounded row. Omit for seamless
   *  full-bleed rows inside an already-rounded container. */
  className?: string
  children: ReactNode
}

/**
 * Wraps a list/card row with an iOS-style swipe-left-to-delete gesture. The row
 * translates under the finger to reveal a solid red panel + black trash icon;
 * releasing past threshold calls `onDelete` (which should open a ConfirmDialog —
 * we never delete on the gesture alone). Direction-locked (via
 * GESTURE_THRESHOLDS.DIRECTION_LOCK) so vertical scroll is handed back to the
 * container, and the tap the swipe would otherwise spawn is swallowed so the
 * row's own onClick doesn't also fire.
 */
export function SwipeToDeleteRow({ onDelete, disabled, className, children }: SwipeToDeleteRowProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; startY: number; locked: boolean | null } | null>(null)
  // Timer that hides the reveal once the row has finished snapping back.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set the instant a swipe locks horizontal; consumed by onClickCapture to
  // swallow the trailing tap. Reset on every touchstart so a real tap that
  // follows a swipe (no click fired by the browser) is never eaten.
  const didSwipe = useRef(false)

  const setX = (x: number) => {
    if (contentRef.current) contentRef.current.style.transform = `translateX(${x}px)`
  }

  // The red reveal is painted ONLY during an active swipe. At rest it stays
  // hidden so it can't bleed through the content's promoted compositor layer
  // during fast/overscroll (the flash bug). Toggled via ref — no re-render.
  const showReveal = (on: boolean) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    if (revealRef.current) revealRef.current.style.opacity = on ? '1' : '0'
  }

  const snap = () => {
    const el = contentRef.current
    if (!el) return
    el.style.transition = 'transform 0.2s ease-out'
    el.style.transform = 'translateX(0)'
    // Keep the reveal painted until the row has slid fully back over it, then
    // drop it so nothing red remains behind the row at rest.
    hideTimer.current = setTimeout(() => showReveal(false), 200)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    didSwipe.current = false
    if (disabled) return
    const t = e.touches[0]
    drag.current = { startX: t.clientX, startY: t.clientY, locked: null }
    if (contentRef.current) contentRef.current.style.transition = 'none'
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const state = drag.current
    if (!state) return
    const t = e.touches[0]
    const dx = t.clientX - state.startX
    const dy = t.clientY - state.startY
    if (state.locked === null) {
      if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return
      state.locked = Math.abs(dx) > Math.abs(dy)
      // A vertical lock hands the gesture back to the scroll container.
      if (!state.locked) { drag.current = null; snap(); return }
      didSwipe.current = true
      showReveal(true)
    }
    // Left drag reveals; a wrong-way (right) drag rubber-bands a hair.
    const offset = dx < 0 ? Math.max(-SWIPE_MAX, dx) : Math.min(8, dx * 0.1)
    setX(offset)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const state = drag.current
    drag.current = null
    if (!state || !state.locked) return
    const dx = e.changedTouches[0].clientX - state.startX
    snap()
    if (dx < -SWIPE_THRESHOLD) onDelete()
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Solid reveal beneath the row — black icon, no growing circle. Hidden
          at rest (opacity 0) so it never bleeds through during scroll; shown
          only while a swipe is locked horizontal. */}
      <div
        ref={revealRef}
        aria-hidden
        style={{ opacity: 0 }}
        className="absolute inset-0 flex items-center justify-end bg-themeredred pr-6"
      >
        <Trash2 size={20} className="text-black" />
      </div>
      <div
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { drag.current = null; snap() }}
        onClickCapture={(e) => {
          if (didSwipe.current) { e.stopPropagation(); e.preventDefault(); didSwipe.current = false }
        }}
        className="relative bg-themewhite2 will-change-transform"
      >
        {children}
      </div>
    </div>
  )
}
