import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/pushNotificationService'

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supported = isPushSupported()
    setIsSupported(supported)

    if (!supported) {
      setLoading(false)
      return
    }

    getExistingSubscription().then((sub) => {
      setIsSubscribed(!!sub)
      setLoading(false)
    })
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    const result = await subscribeToPush()
    if (result.success) {
      setIsSubscribed(true)
    } else {
      setError(result.error || 'Failed to subscribe')
    }
    setLoading(false)
    return result.success
  }, [])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    const result = await unsubscribeFromPush()
    if (result.success) {
      setIsSubscribed(false)
    } else {
      setError(result.error || 'Failed to unsubscribe')
    }
    setLoading(false)
    return result.success
  }, [])

  return { isSupported, isSubscribed, loading, error, subscribe, unsubscribe }
}
