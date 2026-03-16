import { useRef, useEffect, useCallback } from 'react'
import { useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS, SPRING_CONFIGS } from '../Utilities/GestureUtils'

interface UseMessagesSlideOptions {
  /** Only active on mobile */
  enabled: boolean
  /** Messages panel open state */
  isOpen: boolean
  /** Called when gesture/tap commits to closing */
  onClose: () => void
}

/**
 * Spring-based slide animation for the messages panel.
 * Mirrors useMenuSlide but from the right at 100% viewport width.
 * Progress: 0 = closed (off-screen right), 1 = open (visible).
 */
export function useMessagesSlide({ enabled, isOpen, onClose }: UseMessagesSlideOptions) {
  const isDraggingRef = useRef(false)

  const [spring, api] = useSpring(() => ({
    progress: 0,
    config: SPRING_CONFIGS.fling,
  }))

  // Sync spring with external isOpen state
  useEffect(() => {
    if (!enabled) return
    if (isDraggingRef.current) return
    api.start({
      progress: isOpen ? 1 : 0,
      immediate: false,
      config: isOpen ? SPRING_CONFIGS.fling : SPRING_CONFIGS.snap,
    })
  }, [isOpen, api, enabled])

  // Body scroll lock when open
  useEffect(() => {
    if (!enabled) return
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen, enabled])

  // Backdrop: tap to close, drag left to close
  const closeBind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap }) => {
      if (tap) {
        api.start({ progress: 0, config: SPRING_CONFIGS.snap })
        onClose()
        return
      }

      if (active) {
        isDraggingRef.current = true
        // Drag right on backdrop → close (positive mx = rightward)
        const clamped = Math.max(0, Math.min(1, 1 - mx / window.innerWidth))
        api.start({ progress: clamped, immediate: true })
      } else {
        isDraggingRef.current = false
        const clamped = Math.max(0, 1 - mx / window.innerWidth)
        const shouldClose = clamped < 0.7 || (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx > 0)

        if (shouldClose) {
          api.start({ progress: 0, config: SPRING_CONFIGS.snap })
          onClose()
        } else {
          api.start({ progress: 1, config: SPRING_CONFIGS.fling })
        }
      }
    },
    {
      enabled: enabled && isOpen,
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      from: () => [0, 0],
    }
  )

  const handleClose = useCallback(() => {
    api.start({ progress: 0, config: SPRING_CONFIGS.snap })
    onClose()
  }, [api, onClose])

  return {
    /** Raw animated progress value (0 = closed, 1 = open) for composing with other springs */
    springProgress: spring.progress,
    /** Animated backdrop opacity (matches menu backdrop max) */
    backdropOpacity: spring.progress.to((p: number) => p * 0.95),
    /** Spread onto backdrop element for tap/drag-to-close */
    closeHandlers: enabled && isOpen ? closeBind() : {},
    /** Programmatic close with spring animation */
    handleClose,
  }
}
