import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  getExistingSubscription,
  getSubscriptionInfo,
  subscribeToPush,
  unsubscribeFromPush,
  type SubscriptionInfo,
} from '../lib/pushNotificationService'

/** Manages push notification subscription state: checking support, subscribing, and unsubscribing. */
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshSubscriptionState = useCallback(async () => {
    const sub = await getExistingSubscription()
    setIsSubscribed(!!sub)
    setSubscriptionInfo(sub ? getSubscriptionInfo(sub) : null)
  }, [])

  useEffect(() => {
    const supported = isPushSupported()
    setIsSupported(supported)

    if (!supported) {
      setLoading(false)
      return
    }

    refreshSubscriptionState().then(() => setLoading(false))
  }, [refreshSubscriptionState])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    const result = await subscribeToPush()
    if (result.success) {
      await refreshSubscriptionState()
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
