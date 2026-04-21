// Hooks/useServiceWorker.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { subscribe, getState, skipWaiting as swSkipWaiting, checkForUpdate as swCheckForUpdate } from '../lib/swService'

const UPDATE_DISMISS_TIMEOUT_MS = 60 * 60 * 1000

/**
 * React interface over swService. swService owns the SW lifecycle and fires
 * registerSW once at app startup (initSW in main.tsx), so update detection
 * works regardless of auth state.
 */
export function useServiceWorker() {
  const [swState, setSwState] = useState(getState)
  const dismissTimeoutRef = useRef<number>(0)

  useEffect(() => subscribe(setSwState), [])

  const skipWaiting = useCallback(async () => {
    await swSkipWaiting()
  }, [])

  const checkForUpdate = useCallback(() => {
    swCheckForUpdate()
  }, [])

  const dismissUpdate = useCallback(() => {
    try { localStorage.setItem('updateDismissed', Date.now().toString()) } catch { /* storage unavailable */ }
    if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current)
    dismissTimeoutRef.current = window.setTimeout(() => {
      try { localStorage.removeItem('updateDismissed') } catch { /* storage unavailable */ }
      dismissTimeoutRef.current = 0
    }, UPDATE_DISMISS_TIMEOUT_MS)
  }, [])

  return {
    updateAvailable: swState.updateAvailable,
    offlineReady: swState.offlineReady,
    skipWaiting,
    checkForUpdate,
    dismissUpdate,
    registration: swState.registration,
    isUpdating: swState.isUpdating,
    appVersion: __APP_VERSION__,
  }
}
