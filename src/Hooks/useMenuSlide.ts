import { useEffect, useCallback, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'
import type { CSSProperties } from 'react'
import { DRAWER_TIMING } from '../Utilities/constants'

/** Expanded NavRail width (desktop). */
export const MENU_NAV_WIDTH = 280

/** Mobile reveal: the card keeps under a quarter of the screen. */
const MOBILE_NAV_FRACTION = 0.8
const mobileNavWidth = () => Math.round(window.innerWidth * MOBILE_NAV_FRACTION)

const CARD_SCALE = 0.12
const CARD_RADIUS = 24
const CARD_EASE = `${DRAWER_TIMING.TRANSITION}ms cubic-bezier(0.32, 0.72, 0, 1)`

/** Mobile content card while the nav is revealed: shrinks toward the nav edge. */
function menuCardStyle(p: number, isDragging: boolean): CSSProperties {
  return {
    transform: p > 0 ? `scale(${1 - CARD_SCALE * p})` : undefined,
    transformOrigin: 'left center',
    borderRadius: CARD_RADIUS * p,
    boxShadow: `0 12px 40px rgba(0,0,0,${0.18 * p})`,
    overflow: 'hidden',
    transition: isDragging ? 'none' : `transform ${CARD_EASE}, border-radius ${CARD_EASE}, box-shadow ${CARD_EASE}`,
    willChange: isDragging ? 'transform' : 'auto',
  }
}

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
  const [navWidth, setNavWidth] = useState(mobileNavWidth)

  useEffect(() => {
    const onResize = () => setNavWidth(mobileNavWidth())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Sync position with external isOpen state (menu item click, CLOSE_ALL_DRAWERS, etc.)
  useEffect(() => {
    if (isDragging) return
    setPosition(enabled && isOpen ? navWidth : 0)
  }, [enabled, isOpen, isDragging, navWidth])

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
    const clamped = Math.max(0, Math.min(offset, navWidth * 1.05))
    setPosition(clamped)
  }, [enabled, navWidth])

  const onEdgeDragEnd = useCallback((offset: number, velocity: number) => {
    if (!enabled) return
    setIsDragging(false)
    const clamped = Math.max(0, offset)
    const shouldOpen = clamped > navWidth * 0.3 || velocity > GESTURE_THRESHOLDS.FLING_VELOCITY

    if (shouldOpen) {
      setPosition(navWidth)
      onOpen()
    } else {
      setPosition(0)
    }
  }, [onOpen, enabled, navWidth])

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
        const offset = Math.max(0, navWidth + mx)
        setPosition(offset)
      } else {
        setIsDragging(false)
        const offset = Math.max(0, navWidth + mx)
        const shouldClose = offset < navWidth * 0.7 || (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx < 0)

        if (shouldClose) {
          setPosition(0)
          onClose()
        } else {
          setPosition(navWidth)
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
    navWidth,
    position,
    isDragging,
    cardStyle: menuCardStyle(Math.min(position / navWidth, 1), isDragging),
    closeHandlers: enabled && isOpen ? closeBind() : {},
    onEdgeDrag,
    onEdgeDragEnd,
  }
}
