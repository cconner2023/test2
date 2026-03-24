import { useState, useEffect, useRef } from 'react'

/**
 * Aggregates blocking UI signals (update notification, install prompt,
 * post-update release notes) into a single readiness boolean.
 * Returns true only after all blocking overlays have been dismissed
 * and a short settle delay has passed.
 */
export function useOnboardingReady(blocked: boolean): boolean {
  const [ready, setReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Clear any pending settle timer when blocked state changes
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (blocked) {
      // Something is blocking — not ready
      setReady(false)
    } else {
      // All clear — wait 600ms settle time before signaling ready.
      // This prevents false-starts if one blocker dismisses but another
      // appears shortly after (e.g., install prompt after update check).
      timerRef.current = setTimeout(() => {
        setReady(true)
      }, 600)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [blocked])

  return ready
}
