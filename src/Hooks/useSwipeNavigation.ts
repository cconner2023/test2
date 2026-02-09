import { useRef, useCallback, useState } from 'react'
import { useSpring } from '@react-spring/web'
import {
  GESTURE_THRESHOLDS,
  SPRING_CONFIGS,
  createTouchState,
  processTouchMove,
  dampedOffset,
  parallaxTransform,
  type TouchState,
} from '../Utilities/GestureUtils'

interface UseSwipeNavigationOptions {
  /** Whether swipe navigation is enabled (e.g., only on mobile) */
  enabled: boolean
  /** Current view depth: 0 = categories, 1 = subcategories, 2 = algorithm */
  viewDepth: number
  /** Callback when swipe-back completes */
  onSwipeBack: () => void
  /** Minimum swipe distance to trigger navigation (pixels) */
  threshold?: number
  /** Minimum velocity to trigger navigation (px/ms) */
  velocityThreshold?: number
}

export function useSwipeNavigation({
  enabled,
  viewDepth,
  onSwipeBack,
  threshold = GESTURE_THRESHOLDS.SWIPE_BACK_THRESHOLD,
  velocityThreshold = GESTURE_THRESHOLDS.FLING_VELOCITY,
}: UseSwipeNavigationOptions) {
  const [isSwiping, setIsSwiping] = useState(false)
  const [animatingDirection, setAnimatingDirection] = useState<'left' | 'right' | null>(null)

  // Spring for the current (top) layer being swiped away
  const [springStyles, springApi] = useSpring(() => ({
    x: 0,
    config: SPRING_CONFIGS.snap,
  }))

  // Spring for the parallax layer underneath
  const [parallaxStyles, parallaxApi] = useSpring(() => ({
    x: -80,
    opacity: 0.6,
    config: SPRING_CONFIGS.snap,
  }))

  const touchRef = useRef<TouchState | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || viewDepth <= 0) return

    const touch = e.touches[0]
    touchRef.current = createTouchState(touch, e.target)
  }, [enabled, viewDepth])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchRef.current) return

    const touch = e.touches[0]
    const result = processTouchMove(touchRef.current, touch)

    // Bail if direction locked to vertical
    if (result.direction === 'vertical') {
      touchRef.current = null
      return
    }

    // Wait for direction lock
    if (result.direction === 'none') return

    // Only allow swiping right (positive deltaX) to go back
    const clampedOffset = Math.max(0, Math.min(result.deltaX, window.innerWidth))

    // Apply dampening for iOS-style resistance feel
    const dampened = dampedOffset(clampedOffset, threshold)

    setIsSwiping(true)
    setAnimatingDirection(null)

    // Immediately set spring values (no animation during drag)
    springApi.start({ x: dampened, immediate: true })

    // Parallax effect for layer underneath
    const px = parallaxTransform(dampened, window.innerWidth)
    parallaxApi.start({ x: px.x, opacity: px.opacity, immediate: true })
  }, [enabled, threshold, springApi, parallaxApi])

  const onTouchEnd = useCallback(() => {
    if (!enabled || !touchRef.current) return

    const { hasMoved, velocityX } = touchRef.current
    const currentX = springStyles.x.get()
    const velocity = velocityX.velocity
    touchRef.current = null

    if (!hasMoved || !isSwiping) {
      setIsSwiping(false)
      setAnimatingDirection(null)
      springApi.start({ x: 0, immediate: false })
      parallaxApi.start({ x: -80, opacity: 0.6, immediate: false })
      return
    }

    if (currentX > threshold || velocity > velocityThreshold) {
      // Animate out to the right with fling spring physics
      setAnimatingDirection('right')
      setIsSwiping(false)

      springApi.start({
        x: window.innerWidth,
        immediate: false,
        config: SPRING_CONFIGS.fling,
        onRest: () => {
          onSwipeBack()
          // Reset after navigation
          springApi.start({ x: 0, immediate: true })
          parallaxApi.start({ x: -80, opacity: 0.6, immediate: true })
          setAnimatingDirection(null)
        },
      })
      parallaxApi.start({
        x: 0,
        opacity: 1,
        immediate: false,
        config: SPRING_CONFIGS.fling,
      })
    } else {
      // Snap back with snap spring physics
      setIsSwiping(false)
      springApi.start({
        x: 0,
        immediate: false,
        config: SPRING_CONFIGS.snap,
      })
      parallaxApi.start({
        x: -80,
        opacity: 0.6,
        immediate: false,
        config: SPRING_CONFIGS.snap,
      })
    }
  }, [enabled, isSwiping, threshold, velocityThreshold, onSwipeBack, springApi, parallaxApi, springStyles.x])

  const touchHandlers = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }

  return {
    /** Current swipe offset — use springStyles.x for animated value */
    offsetX: springStyles.x.get(),
    isSwiping,
    animatingDirection,
    touchHandlers,
    /** react-spring animated styles for the top layer being swiped */
    springStyles,
    /** react-spring animated styles for the parallax layer underneath */
    parallaxStyles,
  }
}
