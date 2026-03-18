import { useCallback, useRef, useLayoutEffect, useEffect, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'

interface UseColumnCarouselOptions {
  /** Whether drag gestures are enabled (e.g., only on mobile) */
  enabled: boolean
  /** Current panel index (0 = main, 1 = subcategory, 2 = symptom-info on desktop) */
  panelIndex: number
  /** Total number of panels */
  panelCount: number
  /** Whether the carousel container is currently visible (has non-zero width).
   *  When transitioning from hidden to visible, the carousel snaps immediately
   *  to the correct panel to prevent flashing the wrong panel during CSS grid expansion. */
  isVisible?: boolean
  /** Callback when swipe-back completes (panel decreases) */
  onSwipeBack?: () => void
  /** Callback when swipe-forward completes (panel increases) */
  onSwipeForward?: () => void
  /** Called during active drag at panel 0 going right — drives menu slide */
  onEdgeDrag?: (offset: number) => void
  /** Called on release at panel 0 after right drag — commits or cancels menu slide */
  onEdgeDragEnd?: (offset: number, velocity: number) => void
  /** Called during active leftward drag from right edge — drives messages slide open */
  onRightEdgeDrag?: (offset: number) => void
  /** Called on release after right-edge leftward drag — commits or cancels messages open */
  onRightEdgeDragEnd?: (offset: number, velocity: number) => void
}

const TRANSITION_MS = 300

/**
 * Manages a CSS-transition horizontal panel carousel with drag/swipe gesture support.
 * Positions are set directly on the DOM element via ref — no spring state to drift.
 * CSS transitions handle animation; direct style manipulation handles drag tracking.
 */
export function useColumnCarousel({
  enabled,
  panelIndex,
  panelCount,
  isVisible,
  onSwipeBack,
  onSwipeForward,
  onEdgeDrag,
  onEdgeDragEnd,
  onRightEdgeDrag,
  onRightEdgeDragEnd,
}: UseColumnCarouselOptions) {
  const [isSwiping, setIsSwiping] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef(panelIndex)
  panelRef.current = panelIndex
  const prevPanelRef = useRef(panelIndex)
  const prevCountRef = useRef(panelCount)
  const swipingRef = useRef(false)
  const initializedRef = useRef(false)

  /** Set transform on the carousel container element. */
  const setTransform = useCallback((xPercent: number, animate: boolean) => {
    const el = containerRef.current
    if (!el) return
    el.style.transition = animate ? `transform ${TRANSITION_MS}ms ease-out` : 'none'
    el.style.transform = `translateX(${xPercent}%)`
  }, [])

  // ── Sync position to panelIndex / panelCount ──────────────────
  // useLayoutEffect fires before paint, preventing any visual flash.
  useLayoutEffect(() => {
    // Always track prev values (even when swiping) so the next
    // non-swipe sync sees the correct delta.
    const prev = prevPanelRef.current
    const prevCount = prevCountRef.current
    prevPanelRef.current = panelIndex
    prevCountRef.current = panelCount

    // First render: snap immediately
    if (!initializedRef.current) {
      initializedRef.current = true
      setTransform(-panelIndex * (100 / panelCount), false)
      return
    }

    // During an active swipe the drag handler owns positioning
    if (swipingRef.current) return

    // Nothing changed — skip
    if (prev === panelIndex && prevCount === panelCount) return

    // Snap (no animation) for breakpoint crossings or large jumps;
    // animate for single-step navigation (normal browsing).
    const shouldSnap = prevCount !== panelCount || Math.abs(prev - panelIndex) > 1
    setTransform(-panelIndex * (100 / panelCount), !shouldSnap)
  }, [panelIndex, panelCount, setTransform])

  // ── Snap immediately when container becomes visible ───────────
  const wasVisibleRef = useRef(isVisible ?? true)
  useLayoutEffect(() => {
    const wasVisible = wasVisibleRef.current
    const nowVisible = isVisible ?? true
    wasVisibleRef.current = nowVisible

    if (!wasVisible && nowVisible) {
      setTransform(-panelIndex * (100 / panelCount), false)
    }
  }, [isVisible, panelIndex, panelCount, setTransform])

  // ── Re-snap on foreground return ──────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && !swipingRef.current) {
        setTransform(-panelRef.current * (100 / panelCount), false)
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [panelCount, setTransform])

  // ── Drag gesture ──────────────────────────────────────────────
  const edgeDelegateRef = useRef<'menu' | 'messages' | null>(null)
  const panelPercent = 100 / panelCount

  const bind = useDrag(
    ({ active, first, movement: [mx], velocity: [vx], direction: [dx], tap, event, initial: [ix] }) => {
      if (!enabled || tap) return

      const panel = panelRef.current
      const target = event?.currentTarget as HTMLElement | null
      const containerWidth = target?.offsetWidth || window.innerWidth
      const dragPercent = (mx / containerWidth) * 100
      const currentBase = -panel * panelPercent

      // Decide delegation on first move — lock for duration of gesture
      if (first) edgeDelegateRef.current = null
      if (edgeDelegateRef.current === null && Math.abs(mx) > GESTURE_THRESHOLDS.DIRECTION_LOCK) {
        if (panel === 0 && mx > 0 && onEdgeDrag) {
          edgeDelegateRef.current = 'menu'
        } else if (mx < 0 && ix > window.innerWidth - GESTURE_THRESHOLDS.EDGE_ZONE && onRightEdgeDrag) {
          edgeDelegateRef.current = 'messages'
        }
      }

      const isMenuEdge = edgeDelegateRef.current === 'menu'
      const isMessagesEdge = edgeDelegateRef.current === 'messages'

      if (active) {
        setIsSwiping(true)
        swipingRef.current = true

        if (isMenuEdge && onEdgeDrag) {
          setTransform(0, false)
          onEdgeDrag(mx)
        } else if (isMessagesEdge && onRightEdgeDrag) {
          setTransform(currentBase, false)
          onRightEdgeDrag(Math.abs(mx))
        } else {
          // Clamp drag with edge resistance at boundaries
          const rawX = currentBase + dragPercent
          const minX = -(panelCount - 1) * panelPercent
          const maxX = 0
          let clampedX = rawX
          if (rawX > maxX) {
            clampedX = maxX + (rawX - maxX) * GESTURE_THRESHOLDS.EDGE_RESISTANCE
          } else if (rawX < minX) {
            clampedX = minX + (rawX - minX) * GESTURE_THRESHOLDS.EDGE_RESISTANCE
          }
          setTransform(clampedX, false)
        }
      } else {
        // ── Release ──
        if (isMenuEdge && onEdgeDragEnd) {
          setIsSwiping(false)
          swipingRef.current = false
          edgeDelegateRef.current = null
          onEdgeDragEnd(mx, vx)
          return
        }
        if (isMessagesEdge && onRightEdgeDragEnd) {
          setIsSwiping(false)
          swipingRef.current = false
          edgeDelegateRef.current = null
          onRightEdgeDragEnd(Math.abs(mx), vx)
          return
        }

        // Determine if swipe should navigate
        const absDrag = Math.abs(mx)
        const fraction = absDrag / containerWidth
        const shouldNavigate =
          fraction > GESTURE_THRESHOLDS.PAGE_NAV_FRACTION ||
          (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && absDrag > GESTURE_THRESHOLDS.MIN_DRAG_FOR_VELOCITY)

        if (shouldNavigate) {
          const goingBack = dx > 0
          const targetPanel = goingBack
            ? Math.max(0, panel - 1)
            : Math.min(panelCount - 1, panel + 1)

          if (targetPanel !== panel) {
            // Fire callback immediately so NavTop updates in sync
            if (goingBack) onSwipeBack?.()
            else onSwipeForward?.()
            setTransform(-targetPanel * panelPercent, true)
            // Keep swipingRef true until CSS transition completes
            // to prevent the sync effect from re-setting position
            setTimeout(() => {
              swipingRef.current = false
              setIsSwiping(false)
            }, TRANSITION_MS)
            return
          }
        }

        // Not navigating — snap back
        setTransform(currentBase, true)
        setIsSwiping(false)
        swipingRef.current = false
      }
    },
    {
      enabled,
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      from: () => [0, 0],
    }
  )

  return {
    /** Ref to attach to the carousel track element */
    containerRef,
    /** Touch/drag handlers — spread onto the carousel wrapper */
    dragHandlers: enabled ? bind() : {},
    /** Whether the user is actively dragging */
    isSwiping,
  }
}
