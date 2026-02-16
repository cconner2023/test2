import { useRef } from 'react'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'

interface UseSwipeNavigationOptions {
  /** Whether swipe navigation is enabled */
  enabled: boolean
  /** Current view depth (must be > 0 for swipe-back to be possible) */
  viewDepth: number
  /** Callback when swipe-back gesture completes */
  onSwipeBack: () => void
  /** Minimum swipe distance to trigger navigation (pixels) */
  threshold?: number
  /** Minimum velocity to trigger navigation (px/ms) */
  velocityThreshold?: number
}

/**
 * Cross-column swipe gesture detector.
 * Detects swipe-right gestures and calls onSwipeBack.
 * The actual visual transition is handled by CSS grid column animation.
 */
export function useSwipeNavigation({
  enabled,
  viewDepth,
  onSwipeBack,
  threshold = GESTURE_THRESHOLDS.SWIPE_BACK_THRESHOLD,
  velocityThreshold = GESTURE_THRESHOLDS.FLING_VELOCITY,
}: UseSwipeNavigationOptions) {
  const committedRef = useRef(false)

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap }) => {
      if (!enabled || tap) return

      if (active) {
        committedRef.current = false
      } else {
        // Gesture ended — check if threshold met
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
      enabled: enabled && viewDepth > 0,
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
