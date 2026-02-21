import { useEffect, useRef, useCallback } from 'react'
import { getInactivityTimeoutMs } from '../lib/pinService'

interface UseInactivityTimerOptions {
  enabled: boolean
  onTimeout: () => void
}

/**
 * Monitors user activity and fires `onTimeout` after the configured inactivity period.
 *
 * - Tracks: mousemove, keydown, touchstart, scroll, pointerdown (all passive)
 * - Throttles resets to 1/sec via lastResetRef timestamp
 * - Pauses on visibilitychange → hidden, restarts on → visible
 * - Reads timeout from getInactivityTimeoutMs() internally
 * - enabled=false for guests, or when already locked
 * - timeoutMs === 0 means disabled ("Never")
 */
export function useInactivityTimer({ enabled, onTimeout }: UseInactivityTimerOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastResetRef = useRef(0)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    const ms = getInactivityTimeoutMs()
    if (ms === 0) return // "Never" — disabled
    timerRef.current = setTimeout(() => {
      onTimeoutRef.current()
    }, ms)
  }, [clearTimer])

  const resetTimer = useCallback(() => {
    const now = Date.now()
    // Throttle: skip if last reset was < 1s ago
    if (now - lastResetRef.current < 1000) return
    lastResetRef.current = now
    startTimer()
  }, [startTimer])

  useEffect(() => {
    if (!enabled) {
      clearTimer()
      return
    }

    // Start initial timer
    startTimer()

    // Activity events
    const events: (keyof DocumentEventMap)[] = ['mousemove', 'keydown', 'touchstart', 'scroll', 'pointerdown']
    const opts: AddEventListenerOptions = { passive: true }

    for (const ev of events) {
      document.addEventListener(ev, resetTimer, opts)
    }

    // Visibility: pause on hidden, restart on visible
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimer()
      } else {
        startTimer()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimer()
      for (const ev of events) {
        document.removeEventListener(ev, resetTimer)
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, startTimer, resetTimer, clearTimer])
}
