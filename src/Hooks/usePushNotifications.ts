import { useState, useEffect, useCallback, useRef } from 'react'
import {
  isPushSupported,
  getStoredFcmToken,
  getSubscriptionInfo,
  subscribeToPush,
  unsubscribeFromPush,
  migrateOldSubscription,
  type SubscriptionInfo,
} from '../lib/pushNotificationService'
import { useNavigationStore } from '../stores/useNavigationStore'

export interface ForegroundPush {
  title: string
  body: string
  url?: string
}

/** Manages push notification subscription state: checking support, subscribing, and unsubscribing. */
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [foregroundPush, setForegroundPush] = useState<ForegroundPush | null>(null)
  const foregroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismissForegroundPush = useCallback(() => {
    setForegroundPush(null)
    if (foregroundTimerRef.current) {
      clearTimeout(foregroundTimerRef.current)
      foregroundTimerRef.current = null
    }
  }, [])

  const refreshSubscriptionState = useCallback(() => {
    const token = getStoredFcmToken()
    setIsSubscribed(!!token)
    setSubscriptionInfo(token ? getSubscriptionInfo() : null)
  }, [])

  // Listen for SW messages: foreground push toasts + notification click navigation
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        if (foregroundTimerRef.current) clearTimeout(foregroundTimerRef.current)
        setForegroundPush({
          title: event.data.title || 'Notification',
          body: event.data.body || '',
          url: event.data.url,
        })
        foregroundTimerRef.current = setTimeout(() => {
          setForegroundPush(null)
          foregroundTimerRef.current = null
        }, 6000)
      } else if (event.data?.type === 'NOTIFICATION_CLICK') {
        // iOS doesn't support client.navigate() — handle navigation via store
        const url = event.data.url as string | undefined
        if (url?.includes('view=')) {
          const params = new URLSearchParams(url.split('?')[1] || '')
          const view = params.get('view')
          const nav = useNavigationStore.getState()
          if (view === 'messages') nav.setShowMessagesDrawer(true)
          else if (view === 'admin') nav.setShowAdminDrawer(true)
          else if (view === 'clinicNotes') nav.setShowProviderDrawer(true)
          else if (view === 'calendar') nav.setShowCalendarDrawer(true)
        } else {
          // Default: open messages for signal_message notifications
          useNavigationStore.getState().setShowMessagesDrawer(true)
        }
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
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

  return { isSupported, isSubscribed, subscriptionInfo, loading, error, subscribe, unsubscribe, foregroundPush, dismissForegroundPush }
}
