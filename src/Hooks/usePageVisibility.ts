/**
 * usePageVisibility -- Returns whether the page is currently visible.
 *
 * Uses the Page Visibility API (document.visibilityState) to track
 * foreground/background state. Realtime hooks use this to pause
 * WebSocket subscriptions when the app is backgrounded, reducing
 * battery drain on mobile and desktop devices.
 */

import { useState, useEffect } from 'react'

export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(
    () => typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  )

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isVisible
}
