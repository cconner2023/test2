import { useRef, useCallback, useEffect } from 'react'
import { GESTURE_THRESHOLDS } from '../Utilities/GestureUtils'

interface UseSwipeGestureProps {
  actionWidth: number
  isOpen: boolean
  enabled: boolean
  onOpen: () => void
  onClose: () => void
  onTap?: () => void
}

export function useSwipeGesture({
  actionWidth,
  isOpen,
  enabled,
  onOpen,
  onClose,
  onTap,
}: UseSwipeGestureProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const touchRef = useRef<{
    startX: number
    startY: number
    swiping: boolean
    dirDecided: boolean
  } | null>(null)
  const wasTouchRef = useRef(false)

  const openThreshold = actionWidth * 0.3

  const snapTo = useCallback((x: number) => {
    const el = rowRef.current
    if (!el) return
    el.style.transition = 'transform 200ms ease-out'
    el.style.transform = `translateX(${x}px)`
  }, [])

  useEffect(() => {
    snapTo(isOpen ? -actionWidth : 0)
  }, [isOpen, snapTo, actionWidth])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    wasTouchRef.current = true
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, dirDecided: false }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    const t = e.touches[0]
    const dx = t.clientX - state.startX
    const dy = t.clientY - state.startY

    if (!state.dirDecided) {
      if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return
      state.dirDecided = true
      if (Math.abs(dy) > Math.abs(dx)) { touchRef.current = null; return }
      if (!enabled) { touchRef.current = null; return }
      state.swiping = true
    }
    if (!state.swiping) return

    const base = isOpen ? -actionWidth : 0
    const offset = Math.max(-actionWidth, Math.min(0, base + dx))
    const el = rowRef.current
    if (el) {
      el.style.transition = 'none'
      el.style.transform = `translateX(${offset}px)`
    }
  }, [isOpen, enabled, actionWidth])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    touchRef.current = null

    if (state.swiping) {
      const dx = e.changedTouches[0].clientX - state.startX
      const base = isOpen ? -actionWidth : 0
      const shouldOpen = Math.abs(base + dx) > openThreshold
      snapTo(shouldOpen ? -actionWidth : 0)
      if (shouldOpen && !isOpen) onOpen()
      else if (!shouldOpen && isOpen) onClose()
      return
    }

    if (!state.dirDecided) {
      if (isOpen) { snapTo(0); onClose() }
      else { onTap?.() }
    }
  }, [isOpen, snapTo, onOpen, onClose, onTap, actionWidth, openThreshold])

  const handleTouchCancel = useCallback(() => {
    touchRef.current = null
    snapTo(isOpen ? -actionWidth : 0)
  }, [isOpen, snapTo, actionWidth])

  const handleClick = useCallback(() => {
    if (wasTouchRef.current) { wasTouchRef.current = false; return }
    if (isOpen) { snapTo(0); onClose() }
    else { onTap?.() }
  }, [isOpen, snapTo, onClose, onTap])

  const handlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    onClick: handleClick,
  }

  return { rowRef, handlers, snapTo }
}
