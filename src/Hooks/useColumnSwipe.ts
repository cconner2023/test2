import { useCallback, useRef, type CSSProperties } from 'react'
import { useDrag } from '@use-gesture/react'
import { GESTURE_THRESHOLDS, isGestureZoneStart } from '../Utilities/GestureUtils'

interface UseColumnSwipeOptions {
  enabled: boolean
  panelIndex: number
  onSwipeBack?: () => void
  onEdgeDrag?: (offset: number) => void
  onEdgeDragEnd?: (offset: number, velocity: number) => void
  onRightEdgeDrag?: (offset: number) => void
  onRightEdgeDragEnd?: (offset: number, velocity: number) => void
}

export const PANEL_MS = 220
const PANEL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const PANEL_SHIFT_PX = 12
const PANEL_TRANSITION = `opacity ${PANEL_MS}ms ${PANEL_EASE}, transform ${PANEL_MS}ms ${PANEL_EASE}`
const PANEL_HIDE_TRANSITION = `${PANEL_TRANSITION}, visibility 0s linear ${PANEL_MS}ms`

const BACK_FOLLOW = 0.2
const BACK_FOLLOW_MAX = 48

/** Nudge a panel with a back-swipe; px = raw drag, 0 to settle. */
export function followPanel(el: HTMLElement | null | undefined, px: number, dragging: boolean) {
  if (!el) return
  el.style.transition = dragging ? 'none' : PANEL_TRANSITION
  el.style.transform = `translateX(${Math.min(Math.max(px, 0) * BACK_FOLLOW, BACK_FOLLOW_MAX)}px)`
}

/** Stacked-panel crossfade props for panel `i` of a level stack. */
export function panelMotion(i: number, active: number) {
  const isActive = i === active
  const style: CSSProperties = {
    opacity: isActive ? 1 : 0,
    transform: `translateX(${isActive ? 0 : Math.sign(i - active) * PANEL_SHIFT_PX}px)`,
    visibility: isActive ? 'visible' : 'hidden',
    transition: isActive ? PANEL_TRANSITION : PANEL_HIDE_TRANSITION,
  }
  return {
    'data-panel-active': isActive,
    'aria-hidden': !isActive,
    inert: !isActive,
    style,
  }
}

export function useColumnSwipe({
  enabled,
  panelIndex,
  onSwipeBack,
  onEdgeDrag,
  onEdgeDragEnd,
  onRightEdgeDrag,
  onRightEdgeDragEnd,
}: UseColumnSwipeOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef(panelIndex)
  panelRef.current = panelIndex
  const delegateRef = useRef<'menu' | 'messages' | 'back' | null>(null)
  const zoneOwnedRef = useRef(false)

  const setFollow = useCallback((px: number, dragging: boolean) => {
    followPanel(containerRef.current?.querySelector<HTMLElement>('[data-panel-active="true"]'), px, dragging)
  }, [])

  const bind = useDrag(
    ({ active, first, movement: [mx], velocity: [vx], direction: [dx], tap, event, initial: [ix, iy] }) => {
      if (!enabled || tap) return

      if (first) {
        zoneOwnedRef.current = isGestureZoneStart(ix, iy)
        delegateRef.current = null
      }
      if (zoneOwnedRef.current) {
        if (!active) zoneOwnedRef.current = false
        return
      }

      const panel = panelRef.current
      if (delegateRef.current === null && Math.abs(mx) > GESTURE_THRESHOLDS.DIRECTION_LOCK) {
        if (mx > 0 && panel === 0 && onEdgeDrag) delegateRef.current = 'menu'
        else if (mx > 0 && panel > 0) delegateRef.current = 'back'
        else if (mx < 0 && ix > window.innerWidth - GESTURE_THRESHOLDS.EDGE_ZONE && onRightEdgeDrag) delegateRef.current = 'messages'
      }
      const mode = delegateRef.current

      if (active) {
        if (mode === 'menu') onEdgeDrag?.(mx)
        else if (mode === 'messages') onRightEdgeDrag?.(Math.abs(mx))
        else if (mode === 'back') setFollow(mx, true)
        return
      }

      delegateRef.current = null
      if (mode === 'menu') { onEdgeDragEnd?.(mx, vx); return }
      if (mode === 'messages') { onRightEdgeDragEnd?.(Math.abs(mx), vx); return }
      if (mode === 'back') {
        setFollow(0, false)
        const width = (event?.currentTarget as HTMLElement | null)?.offsetWidth || window.innerWidth
        const commit =
          dx > 0 &&
          (mx / width > GESTURE_THRESHOLDS.PAGE_NAV_FRACTION ||
            (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && mx > GESTURE_THRESHOLDS.MIN_DRAG_FOR_VELOCITY))
        if (commit) onSwipeBack?.()
      }
    },
    {
      enabled,
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      from: () => [0, 0],
    }
  )

  return {
    containerRef,
    dragHandlers: enabled ? bind() : {},
  }
}
