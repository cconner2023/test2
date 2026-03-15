import { useRef, useEffect, useCallback } from 'react'
import { useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS, SPRING_CONFIGS } from '../Utilities/GestureUtils'

export const MENU_NAV_WIDTH = 280

interface UseMenuSlideOptions {
  /** Only active on mobile */
  enabled: boolean
  /** Menu open state from navigation store */
  isOpen: boolean
  /** Called when gesture commits to opening */
  onOpen: () => void
  /** Called when gesture commits to closing */
  onClose: () => void
}

export function useMenuSlide({ enabled, isOpen, onOpen, onClose }: UseMenuSlideOptions) {
  const isDraggingRef = useRef(false)

  const [spring, api] = useSpring(() => ({
    x: 0,
    config: SPRING_CONFIGS.fling,
  }))

  // Sync spring with external isOpen state (menu item click, CLOSE_ALL_DRAWERS, etc.)
  useEffect(() => {
    if (isDraggingRef.current) return
    api.start({
      x: isOpen ? MENU_NAV_WIDTH : 0,
      immediate: false,
      config: isOpen ? SPRING_CONFIGS.fling : SPRING_CONFIGS.snap,
    })
  }, [isOpen, api])

  // Body scroll lock when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── Carousel edge-drag integration (open gesture) ──

  const onEdgeDrag = useCallback((offset: number) => {
    isDraggingRef.current = true
    const clamped = Math.max(0, Math.min(offset, MENU_NAV_WIDTH * 1.05))
    api.start({ x: clamped, immediate: true })
  }, [api])

  const onEdgeDragEnd = useCallback((offset: number, velocity: number) => {
    isDraggingRef.current = false
    const clamped = Math.max(0, offset)
    const shouldOpen = clamped > MENU_NAV_WIDTH * 0.3 || velocity > GESTURE_THRESHOLDS.FLING_VELOCITY

    if (shouldOpen) {
      api.start({ x: MENU_NAV_WIDTH, config: SPRING_CONFIGS.fling })
      onOpen()
    } else {
      api.start({ x: 0, config: SPRING_CONFIGS.snap })
    }
  }, [api, onOpen])

  // ── Backdrop close gesture (drag left or tap to close) ──

  const closeBind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap }) => {
      if (tap) {
        api.start({ x: 0, config: SPRING_CONFIGS.snap })
        onClose()
        return
      }

      if (active) {
        isDraggingRef.current = true
        const offset = Math.max(0, MENU_NAV_WIDTH + mx)
        api.start({ x: offset, immediate: true })
      } else {
        isDraggingRef.current = false
        const offset = Math.max(0, MENU_NAV_WIDTH + mx)
        const shouldClose = offset < MENU_NAV_WIDTH * 0.7 || (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx < 0)

        if (shouldClose) {
          api.start({ x: 0, config: SPRING_CONFIGS.snap })
          onClose()
        } else {
          api.start({ x: MENU_NAV_WIDTH, config: SPRING_CONFIGS.fling })
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

  return {
    springX: spring.x,
    backdropOpacity: spring.x.to((x: number) => Math.min(x / MENU_NAV_WIDTH, 1) * 0.95),
    closeHandlers: enabled && isOpen ? closeBind() : {},
    onEdgeDrag,
    onEdgeDragEnd,
  }
}
