import { useEffect, useCallback, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'
import { DRAWER_FADE_TRANSITION } from '../Utilities/constants'

/** Nav width: the mobile off-canvas SideNav and the expanded NavRail. */
export const MENU_NAV_WIDTH = 280

/** Mobile off-canvas nav. md+ uses NavRail, so pass enabled=false there: the
 *  position stays 0 and every gesture is inert. */
interface UseMenuSlideOptions {
  enabled: boolean
  /** Menu open state from navigation store */
  isOpen: boolean
  /** Called when gesture commits to opening */
  onOpen: () => void
  /** Called when gesture commits to closing */
  onClose: () => void
}

export function useMenuSlide({ enabled, isOpen, onOpen, onClose }: UseMenuSlideOptions) {
  const [position, setPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Sync position with external isOpen state (menu item click, CLOSE_ALL_DRAWERS, etc.)
  useEffect(() => {
    if (isDragging) return
    setPosition(enabled && isOpen ? MENU_NAV_WIDTH : 0)
  }, [enabled, isOpen, isDragging])

  // Body scroll lock when menu is open
  useEffect(() => {
    if (!enabled || !isOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [enabled, isOpen])

  // ── Carousel edge-drag integration (open gesture) ──

  const onEdgeDrag = useCallback((offset: number) => {
    if (!enabled) return
    setIsDragging(true)
    const clamped = Math.max(0, Math.min(offset, MENU_NAV_WIDTH * 1.05))
    setPosition(clamped)
  }, [enabled])

  const onEdgeDragEnd = useCallback((offset: number, velocity: number) => {
    if (!enabled) return
    setIsDragging(false)
    const clamped = Math.max(0, offset)
    const shouldOpen = clamped > MENU_NAV_WIDTH * 0.3 || velocity > GESTURE_THRESHOLDS.FLING_VELOCITY

    if (shouldOpen) {
      setPosition(MENU_NAV_WIDTH)
      onOpen()
    } else {
      setPosition(0)
    }
  }, [onOpen, enabled])

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
        const offset = Math.max(0, MENU_NAV_WIDTH + mx)
        setPosition(offset)
      } else {
        setIsDragging(false)
        const offset = Math.max(0, MENU_NAV_WIDTH + mx)
        const shouldClose = offset < MENU_NAV_WIDTH * 0.7 || (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx < 0)

        if (shouldClose) {
          setPosition(0)
          onClose()
        } else {
          setPosition(MENU_NAV_WIDTH)
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
    position,
    isDragging,
    // TRAVEL fraction (0 -> 1) for <Scrim progress>, NOT a dim level — the tint
    // lives in Scrim's class (the nav uses variant="solid", 94% black, no blur).
    // Multiplying a dim level in here would park the element at fractional
    // opacity, which is what composited the blur away. See Scrim.tsx.
    backdropProgress: Math.min(position / MENU_NAV_WIDTH, 1),
    backdropTransition: isDragging ? 'none' : DRAWER_FADE_TRANSITION,
    closeHandlers: enabled && isOpen ? closeBind() : {},
    onEdgeDrag,
    onEdgeDragEnd,
  }
}
