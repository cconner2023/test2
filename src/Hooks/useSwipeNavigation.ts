import { useRef } from 'react'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'

interface UseSwipeNavigationOptions {
  /** Whether swipe navigation is enabled */
  enabled: boolean
  /** Current view depth (must be > 0 for swipe-back to be possible) */
  viewDepth: number
  /** Callback when swipe-back gesture completes (rightward swipe) */
  onSwipeBack: () => void
  /** Called during active leftward drag from right edge — drives messages slide open */
  onRightEdgeDrag?: (offset: number) => void
  /** Called on release after right-edge leftward drag — commits or cancels messages open */
  onRightEdgeDragEnd?: (offset: number, velocity: number) => void
  /** Minimum swipe distance to trigger navigation (pixels) */
  threshold?: number
  /** Minimum velocity to trigger navigation (px/ms) */
  velocityThreshold?: number
}

/**
 * Cross-column swipe gesture detector.
 * Detects swipe-right gestures and calls onSwipeBack.
 * Detects right-edge leftward drags and delegates to messages slide.
 * The actual visual transition is handled by CSS grid column animation.
 */
export function useSwipeNavigation({
  enabled,
  viewDepth,
  onSwipeBack,
  onRightEdgeDrag,
  onRightEdgeDragEnd,
  threshold = GESTURE_THRESHOLDS.SWIPE_BACK_THRESHOLD,
  velocityThreshold = GESTURE_THRESHOLDS.FLING_VELOCITY,
}: UseSwipeNavigationOptions) {
  const committedRef = useRef(false)
  const edgeDelegateRef = useRef(false)

  const bind = useDrag(
    ({ active, first, movement: [mx], velocity: [vx], direction: [dx], tap, initial: [ix] }) => {
      if (!enabled || tap) return

      // Decide delegation on first significant move
      if (first) {
        edgeDelegateRef.current = false
        committedRef.current = false
      }
      if (!edgeDelegateRef.current && !committedRef.current && Math.abs(mx) > GESTURE_THRESHOLDS.DIRECTION_LOCK) {
        if (mx < 0 && ix > window.innerWidth - GESTURE_THRESHOLDS.EDGE_ZONE && onRightEdgeDrag) {
          edgeDelegateRef.current = true
        }
      }

      if (edgeDelegateRef.current && onRightEdgeDrag) {
        if (active) {
          onRightEdgeDrag(Math.abs(mx))
        } else if (onRightEdgeDragEnd) {
          edgeDelegateRef.current = false
          onRightEdgeDragEnd(Math.abs(mx), vx)
        }
        return
      }

      if (active) {
        committedRef.current = false
      } else {
        // Gesture ended — check if threshold met for back navigation
        if (committedRef.current) return
        const clampedOffset = Math.max(0, mx)
        const shouldNav = clampedOffset > threshold || (vx > velocityThreshold && dx > 0)

        if (shouldNav && viewDepth > 0) {
          committedRef.current = true
          onSwipeBack()
        }
      }
    },
    {
      enabled: enabled && (viewDepth > 0 || !!onRightEdgeDrag),
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      from: () => [0, 0],
    }
  )

  return {
    touchHandlers: enabled ? bind() : {},
  }
}
