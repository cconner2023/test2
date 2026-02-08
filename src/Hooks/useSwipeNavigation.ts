import { useRef, useCallback, useState } from 'react'

interface SwipeState {
  /** Current swipe offset in pixels (positive = swiping right/back) */
  offsetX: number
  /** Whether a swipe gesture is actively in progress */
  isSwiping: boolean
  /** Direction of the completed swipe animation ('left' | 'right' | null) */
  animatingDirection: 'left' | 'right' | null
}

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
  const [swipeState, setSwipeState] = useState<SwipeState>({
    offsetX: 0,
    isSwiping: false,
    animatingDirection: null,
  })

  const touchRef = useRef<{
    startX: number
    startY: number
    startTime: number
    isHorizontal: boolean | null
    hasMoved: boolean
  } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    // Don't intercept if we're at the top level (nothing to swipe back to)
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
          // Vertical scroll - abort swipe tracking
          touchRef.current = null
          return
        }
      } else {
        return // Not enough movement yet
      }
    }

    if (!touchRef.current.isHorizontal) return

    touchRef.current.hasMoved = true

    // Only allow swiping right (positive deltaX) to go back
    // Clamp: no negative offset (no forward swipe) and max to screen width
    const clampedOffset = Math.max(0, Math.min(deltaX, window.innerWidth))

    // Apply dampening for resistance feel when pulling beyond threshold
    const dampened = clampedOffset > threshold
      ? threshold + (clampedOffset - threshold) * 0.4
      : clampedOffset

    setSwipeState({
      offsetX: dampened,
      isSwiping: true,
      animatingDirection: null,
    })
  }, [enabled, threshold])

  const onTouchEnd = useCallback(() => {
    if (!enabled || !touchRef.current) return

    const { startTime, hasMoved } = touchRef.current
    touchRef.current = null

    if (!hasMoved || !swipeState.isSwiping) {
      setSwipeState({ offsetX: 0, isSwiping: false, animatingDirection: null })
      return
    }

    const deltaTime = Date.now() - startTime
    const velocity = swipeState.offsetX / Math.max(deltaTime, 1)

    // Trigger back navigation if threshold met or velocity is high enough
    if (swipeState.offsetX > threshold || velocity > velocityThreshold) {
      // Animate out to the right
      setSwipeState({
        offsetX: window.innerWidth,
        isSwiping: false,
        animatingDirection: 'right',
      })

      // Trigger navigation after animation completes
      setTimeout(() => {
        onSwipeBack()
        // Reset state after navigation
        setSwipeState({ offsetX: 0, isSwiping: false, animatingDirection: null })
      }, 280)
    } else {
      // Snap back - didn't meet threshold
      setSwipeState({ offsetX: 0, isSwiping: false, animatingDirection: null })
    }
  }, [enabled, swipeState.isSwiping, swipeState.offsetX, threshold, velocityThreshold, onSwipeBack])

  const touchHandlers = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }

  return {
    ...swipeState,
    touchHandlers,
  }
}
