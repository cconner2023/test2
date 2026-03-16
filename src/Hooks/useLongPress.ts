import { useRef, useCallback } from 'react'

interface UseLongPressOptions {
  /** Duration in ms before long-press fires (default 500). */
  delay?: number
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
  onTouchCancel: () => void
}

/**
 * Returns touch handlers that fire `onLongPress(x, y)` after holding
 * for `delay` ms without moving beyond a small threshold.
 *
 * Movement beyond 10px cancels the long-press timer.
 * The caller is responsible for calling `e.preventDefault()` on the
 * native `contextmenu` event to suppress the browser default.
 */
export function useLongPress(
  onLongPress: (x: number, y: number) => void,
  options?: UseLongPressOptions,
): LongPressHandlers {
  const delay = options?.delay ?? 500
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0]
      startRef.current = { x: t.clientX, y: t.clientY }
      firedRef.current = false
      clear()
      timerRef.current = setTimeout(() => {
        firedRef.current = true
        onLongPress(t.clientX, t.clientY)
      }, delay)
    },
    [onLongPress, delay, clear],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startRef.current) return
      const t = e.touches[0]
      const dx = t.clientX - startRef.current.x
      const dy = t.clientY - startRef.current.y
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clear()
      }
    },
    [clear],
  )

  const onTouchEnd = useCallback(() => {
    clear()
  }, [clear])

  const onTouchCancel = useCallback(() => {
    clear()
  }, [clear])

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }
}

/** Whether the last long-press already fired (use to skip tap). */
export function useLongPressFired(): React.MutableRefObject<boolean> {
  const ref = useRef(false)
  return ref
}
