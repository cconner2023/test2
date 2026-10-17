// Hooks/useServiceWorker.ts
import { useState, useEffect, useCallback } from 'react'
import {
  subscribe,
  getState,
  skipWaiting as swSkipWaiting,
  checkForUpdate as swCheckForUpdate,
  dismissUpdate as swDismissUpdate,
} from '../lib/swService'

/**
 * React interface over swService. swService owns the SW lifecycle and fires
 * registerSW once at app startup (initSW in main.tsx), so update detection
 * works regardless of auth state.
 */
export function useServiceWorker() {
  const [swState, setSwState] = useState(getState)

  useEffect(() => subscribe(setSwState), [])

  const skipWaiting = useCallback(async () => {
    await swSkipWaiting()
  }, [])

  const checkForUpdate = useCallback(() => {
    swCheckForUpdate()
  }, [])

  const dismissUpdate = useCallback(() => {
    swDismissUpdate()
  }, [])

  return {
    updateAvailable: swState.updateAvailable,
    newVersion: swState.newVersion,
    dismissed: swState.dismissed,
    offlineReady: swState.offlineReady,
    skipWaiting,
    checkForUpdate,
    dismissUpdate,
    registration: swState.registration,
    isUpdating: swState.isUpdating,
    appVersion: __APP_VERSION__,
  }
}
