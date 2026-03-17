import { useRef, useEffect, useCallback } from 'react'
import { useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS, SPRING_CONFIGS } from '../Utilities/GestureUtils'

export const MENU_NAV_WIDTH_MOBILE = 280
export const MENU_NAV_WIDTH_DESKTOP = 280
/** @deprecated Use MENU_NAV_WIDTH_MOBILE / MENU_NAV_WIDTH_DESKTOP */
export const MENU_NAV_WIDTH = MENU_NAV_WIDTH_MOBILE

interface UseMenuSlideOptions {
  /** Hook is always enabled; swipe gestures are gated by isMobile */
  enabled: boolean
  /** Menu open state from navigation store */
  isOpen: boolean
  /** Called when gesture commits to opening */
  onOpen: () => void
  /** Called when gesture commits to closing */
  onClose: () => void
  /** Nav width — defaults to 280 (mobile) */
  width?: number
  /** When true, disables drag/swipe gestures (click-only) */
  disableGestures?: boolean
}

export function useMenuSlide({ enabled, isOpen, onOpen, onClose, width = MENU_NAV_WIDTH_MOBILE, disableGestures = false }: UseMenuSlideOptions) {
  const isDraggingRef = useRef(false)

  const [spring, api] = useSpring(() => ({
    x: 0,
    config: SPRING_CONFIGS.fling,
  }))

  // Sync spring with external isOpen state (menu item click, CLOSE_ALL_DRAWERS, etc.)
  useEffect(() => {
    if (isDraggingRef.current) return
    api.start({
      x: isOpen ? width : 0,
      immediate: false,
      config: isOpen ? SPRING_CONFIGS.fling : SPRING_CONFIGS.snap,
    })
  }, [isOpen, api, width])

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
    if (disableGestures) return
    isDraggingRef.current = true
    const clamped = Math.max(0, Math.min(offset, width * 1.05))
    api.start({ x: clamped, immediate: true })
  }, [api, width, disableGestures])

  const onEdgeDragEnd = useCallback((offset: number, velocity: number) => {
    if (disableGestures) return
    isDraggingRef.current = false
    const clamped = Math.max(0, offset)
    const shouldOpen = clamped > width * 0.3 || velocity > GESTURE_THRESHOLDS.FLING_VELOCITY

    if (shouldOpen) {
      api.start({ x: width, config: SPRING_CONFIGS.fling })
      onOpen()
    } else {
      api.start({ x: 0, config: SPRING_CONFIGS.snap })
    }
  }, [api, onOpen, width, disableGestures])

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
        const offset = Math.max(0, width + mx)
        api.start({ x: offset, immediate: true })
      } else {
        isDraggingRef.current = false
        const offset = Math.max(0, width + mx)
        const shouldClose = offset < width * 0.7 || (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx < 0)

        if (shouldClose) {
          api.start({ x: 0, config: SPRING_CONFIGS.snap })
          onClose()
        } else {
          api.start({ x: width, config: SPRING_CONFIGS.fling })
        }
      }
    },
    {
      enabled: enabled && isOpen && !disableGestures,
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      from: () => [0, 0],
    }
  )

  return {
    springX: spring.x,
    backdropOpacity: spring.x.to((x: number) => Math.min(x / width, 1) * 0.95),
    closeHandlers: enabled && isOpen ? closeBind() : {},
    width,
    onEdgeDrag,
    onEdgeDragEnd,
  }
}
