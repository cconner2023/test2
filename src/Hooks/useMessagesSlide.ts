import { useEffect, useCallback, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'
import { DRAWER_TIMING } from '../Utilities/constants'

const SLIDE_TRANSITION = `transform ${DRAWER_TIMING.TRANSITION}ms cubic-bezier(0.32, 0.72, 0, 1)`
const OPACITY_TRANSITION = `opacity ${DRAWER_TIMING.TRANSITION}ms cubic-bezier(0.32, 0.72, 0, 1)`

interface UseMessagesSlideOptions {
  /** Only active on mobile */
  enabled: boolean
  /** Messages panel open state */
  isOpen: boolean
  /** Called when gesture commits to opening */
  onOpen: () => void
  /** Called when gesture/tap commits to closing */
  onClose: () => void
}

/**
 * CSS-transition-based slide animation for the messages panel.
 * Progress: 0 = closed (off-screen right), 1 = open (visible).
 * Includes right-edge drag-to-open via onEdgeDrag/onEdgeDragEnd delegation.
 */
export function useMessagesSlide({ enabled, isOpen, onOpen, onClose }: UseMessagesSlideOptions) {
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Sync progress with external isOpen state
  useEffect(() => {
    if (!enabled) return
    if (isDragging) return
    setProgress(isOpen ? 1 : 0)
  }, [isOpen, enabled, isDragging])

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

  // ── Right-edge drag-to-open integration ──

  const onEdgeDrag = useCallback((offset: number) => {
    setIsDragging(true)
    // offset is the absolute drag distance (always positive from caller)
    const normalized = Math.max(0, Math.min(1, offset / window.innerWidth))
    setProgress(normalized)
  }, [])

  const onEdgeDragEnd = useCallback((offset: number, velocity: number) => {
    setIsDragging(false)
    const normalized = offset / window.innerWidth
    const shouldOpen = normalized > 0.3 || velocity > GESTURE_THRESHOLDS.FLING_VELOCITY

    if (shouldOpen) {
      setProgress(1)
      onOpen()
    } else {
      setProgress(0)
    }
  }, [onOpen])

  // ── Backdrop close gesture (drag right or tap to close) ──

  const closeBind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap }) => {
      if (tap) {
        setProgress(0)
        onClose()
        return
      }

      if (active) {
        setIsDragging(true)
        // Drag right on backdrop → close (positive mx = rightward)
        const clamped = Math.max(0, Math.min(1, 1 - mx / window.innerWidth))
        setProgress(clamped)
      } else {
        setIsDragging(false)
        const clamped = Math.max(0, 1 - mx / window.innerWidth)
        const shouldClose = clamped < 0.7 || (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx > 0)

        if (shouldClose) {
          setProgress(0)
          onClose()
        } else {
          setProgress(1)
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
    setProgress(0)
    onClose()
  }, [onClose])

  const transition = isDragging ? 'none' : SLIDE_TRANSITION

  return {
    progress,
    isDragging,
    transition,
    backdropOpacity: progress * 0.95,
    backdropTransition: isDragging ? 'none' : OPACITY_TRANSITION,
    closeHandlers: enabled && isOpen ? closeBind() : {},
    handleClose,
    onEdgeDrag,
    onEdgeDragEnd,
  }
}
