import { useEffect, useCallback, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'
import { DRAWER_TIMING } from '../Utilities/constants'

export const MENU_NAV_WIDTH_MOBILE = 280
export const MENU_NAV_WIDTH_DESKTOP = 280
/** @deprecated Use MENU_NAV_WIDTH_MOBILE / MENU_NAV_WIDTH_DESKTOP */
export const MENU_NAV_WIDTH = MENU_NAV_WIDTH_MOBILE

const SLIDE_TRANSITION = `transform ${DRAWER_TIMING.TRANSITION}ms cubic-bezier(0.32, 0.72, 0, 1)`
const OPACITY_TRANSITION = `opacity ${DRAWER_TIMING.TRANSITION}ms cubic-bezier(0.32, 0.72, 0, 1)`

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
  const [position, setPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Sync position with external isOpen state (menu item click, CLOSE_ALL_DRAWERS, etc.)
  useEffect(() => {
    if (isDragging) return
    setPosition(isOpen ? width : 0)
  }, [isOpen, width, isDragging])

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
    setIsDragging(true)
    const clamped = Math.max(0, Math.min(offset, width * 1.05))
    setPosition(clamped)
  }, [width, disableGestures])

  const onEdgeDragEnd = useCallback((offset: number, velocity: number) => {
    if (disableGestures) return
    setIsDragging(false)
    const clamped = Math.max(0, offset)
    const shouldOpen = clamped > width * 0.3 || velocity > GESTURE_THRESHOLDS.FLING_VELOCITY

    if (shouldOpen) {
      setPosition(width)
      onOpen()
    } else {
      setPosition(0)
    }
  }, [onOpen, width, disableGestures])

  // ── Backdrop close gesture (drag left or tap to close) ──

  const closeBind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap }) => {
      if (tap) {
        setPosition(0)
        onClose()
        return
      }

      if (active) {
        setIsDragging(true)
        const offset = Math.max(0, width + mx)
        setPosition(offset)
      } else {
        setIsDragging(false)
        const offset = Math.max(0, width + mx)
        const shouldClose = offset < width * 0.7 || (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx < 0)

        if (shouldClose) {
          setPosition(0)
          onClose()
        } else {
          setPosition(width)
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

  const transition = isDragging ? 'none' : SLIDE_TRANSITION

  return {
    position,
    isDragging,
    transition,
    backdropOpacity: Math.min(position / width, 1) * 0.95,
    backdropTransition: isDragging ? 'none' : OPACITY_TRANSITION,
    closeHandlers: enabled && isOpen ? closeBind() : {},
    width,
    onEdgeDrag,
    onEdgeDragEnd,
  }
}
