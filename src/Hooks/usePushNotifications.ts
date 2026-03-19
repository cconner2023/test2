import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  getStoredFcmToken,
  getSubscriptionInfo,
  subscribeToPush,
  unsubscribeFromPush,
  migrateOldSubscription,
  type SubscriptionInfo,
} from '../lib/pushNotificationService'

/** Manages push notification subscription state: checking support, subscribing, and unsubscribing. */
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshSubscriptionState = useCallback(() => {
    const token = getStoredFcmToken()
    setIsSubscribed(!!token)
    setSubscriptionInfo(token ? getSubscriptionInfo() : null)
  }, [])

  useEffect(() => {
    const supported = isPushSupported()
    setIsSupported(supported)

    if (supported) {
      // One-time migration from old Web Push to FCM
      migrateOldSubscription().then((migrated) => {
        if (migrated) refreshSubscriptionState()
      })
    }

    refreshSubscriptionState()
    setLoading(false)
  }, [refreshSubscriptionState])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    const result = await subscribeToPush()
    if (result.success) {
      refreshSubscriptionState()
    } else {
      setError(result.error || 'Failed to subscribe')
    }
    setLoading(false)
    return result.success
  }, [refreshSubscriptionState])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    const result = await unsubscribeFromPush()
    if (result.success) {
      setIsSubscribed(false)
      setSubscriptionInfo(null)
    } else {
      setError(result.error || 'Failed to unsubscribe')
    }
    setLoading(false)
    return result.success
  }, [])

  return { isSupported, isSubscribed, subscriptionInfo, loading, error, subscribe, unsubscribe }
}
