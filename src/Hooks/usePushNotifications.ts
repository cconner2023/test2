import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePushStore, initPushRouting } from '../stores/usePushStore'

export type { ForegroundPush } from '../stores/usePushStore'

/** Manages push notification subscription state: checking support, subscribing, and unsubscribing. */
export function usePushNotifications() {
  useEffect(() => {
    initPushRouting()
  }, [])

  return usePushStore(useShallow((s) => ({
    isSupported: s.isSupported,
    isSubscribed: s.isSubscribed,
    subscriptionInfo: s.subscriptionInfo,
    loading: s.loading,
    error: s.error,
    subscribe: s.subscribe,
    unsubscribe: s.unsubscribe,
    foregroundPush: s.foregroundPush,
    dismissForegroundPush: s.dismissForegroundPush,
  })))
}
