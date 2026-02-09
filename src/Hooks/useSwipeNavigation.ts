import { useRef, useCallback, useState } from 'react'
import { useSpring } from '@react-spring/web'

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
  threshold = 60,
  velocityThreshold = 0.3,
}: UseSwipeNavigationOptions) {
  const [isSwiping, setIsSwiping] = useState(false)
  const [animatingDirection, setAnimatingDirection] = useState<'left' | 'right' | null>(null)

  // Spring for the current (top) layer being swiped away
  const [springStyles, springApi] = useSpring(() => ({
    x: 0,
    config: { tension: 300, friction: 30 },
  }))

  // Spring for the parallax layer underneath
  const [parallaxStyles, parallaxApi] = useSpring(() => ({
    x: -80,
    opacity: 0.6,
    config: { tension: 300, friction: 30 },
  }))

  const touchRef = useRef<{
    startX: number
    startY: number
    startTime: number
    isHorizontal: boolean | null
    hasMoved: boolean
  } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    if (viewDepth <= 0) return

    const touch = e.touches[0]
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isHorizontal: null,
      hasMoved: false,
    }
  }, [enabled, viewDepth])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchRef.current) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - touchRef.current.startX
    const deltaY = touch.clientY - touchRef.current.startY
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // Determine direction on first significant movement (8px threshold)
    if (touchRef.current.isHorizontal === null) {
      if (absDeltaX > 8 || absDeltaY > 8) {
        touchRef.current.isHorizontal = absDeltaX > absDeltaY
        if (!touchRef.current.isHorizontal) {
          touchRef.current = null
          return
        }
      } else {
        return
      }
    }

    if (!touchRef.current.isHorizontal) return

    touchRef.current.hasMoved = true

    // Only allow swiping right (positive deltaX) to go back
    const clampedOffset = Math.max(0, Math.min(deltaX, window.innerWidth))

    // Apply dampening for resistance feel
    const dampened = clampedOffset > threshold
      ? threshold + (clampedOffset - threshold) * 0.4
      : clampedOffset

    setIsSwiping(true)
    setAnimatingDirection(null)

    // Immediately set spring values (no animation during drag)
    springApi.start({ x: dampened, immediate: true })

    // Parallax effect for layer underneath
    const parallaxOffset = -80 + (dampened / window.innerWidth) * 80
    const parallaxOpacity = 0.6 + (dampened / window.innerWidth) * 0.4
    parallaxApi.start({ x: parallaxOffset, opacity: parallaxOpacity, immediate: true })
  }, [enabled, threshold, springApi, parallaxApi])

  const onTouchEnd = useCallback(() => {
    if (!enabled || !touchRef.current) return

    const { startTime, hasMoved } = touchRef.current
    const currentX = springStyles.x.get()
    touchRef.current = null

    if (!hasMoved || !isSwiping) {
      setIsSwiping(false)
      setAnimatingDirection(null)
      springApi.start({ x: 0, immediate: false })
      parallaxApi.start({ x: -80, opacity: 0.6, immediate: false })
      return
    }

    const deltaTime = Date.now() - startTime
    const velocity = currentX / Math.max(deltaTime, 1)

    if (currentX > threshold || velocity > velocityThreshold) {
      // Animate out to the right with spring physics
      setAnimatingDirection('right')
      setIsSwiping(false)

      springApi.start({
        x: window.innerWidth,
        immediate: false,
        config: { tension: 200, friction: 25 },
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
        config: { tension: 200, friction: 25 },
      })
    } else {
      // Snap back with spring physics
      setIsSwiping(false)
      springApi.start({
        x: 0,
        immediate: false,
        config: { tension: 300, friction: 30 },
      })
      parallaxApi.start({
        x: -80,
        opacity: 0.6,
        immediate: false,
        config: { tension: 300, friction: 30 },
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
