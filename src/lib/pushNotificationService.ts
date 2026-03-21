import { supabase } from './supabase'
import { succeed, fail, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'
import { getFirebaseMessaging, getToken, deleteToken } from './firebase'

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const FCM_TOKEN_KEY = 'adtmc_fcm_token'

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_KEY
  )
}

export function getStoredFcmToken(): string | null {
  return localStorage.getItem(FCM_TOKEN_KEY)
}

export interface SubscriptionInfo {
  provider: string
}

export function getSubscriptionInfo(): SubscriptionInfo | null {
  const token = getStoredFcmToken()
  if (!token) return null
  return { provider: 'Firebase Cloud Messaging' }
}

export async function subscribeToPush(): Promise<ServiceResult> {
  try {
    if (!VAPID_KEY) return fail('VAPID public key not configured')

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return fail('Notification permission denied')

    const messaging = await getFirebaseMessaging()
    if (!messaging) return fail('Firebase Messaging not supported')

    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!token) return fail('Failed to get FCM token')

    // If re-subscribing and the token changed, remove the stale DB row first
    const previousToken = getStoredFcmToken()
    if (previousToken && previousToken !== token) {
      try {
        await supabase.rpc('remove_push_subscription', {
          p_fcm_token: previousToken,
        })
      } catch { /* best-effort cleanup of stale token */ }
    }

    const { error } = await supabase.rpc('save_push_subscription', {
      p_fcm_token: token,
    })

    if (error) return fail(error.message)

    localStorage.setItem(FCM_TOKEN_KEY, token)
    return succeed()
  } catch (err) {
    return fail(getErrorMessage(err, 'Failed to subscribe'))
  }
}

/**
 * Re-sync the FCM token on login. Calls getToken() to handle
 * automatic token refresh (expired tokens get rotated by Firebase).
 */
export async function resyncPushSubscription(): Promise<void> {
  try {
    const storedToken = getStoredFcmToken()
    if (!storedToken) return

    let tokenToSave = storedToken

    const messaging = await getFirebaseMessaging()
    if (messaging && VAPID_KEY) {
      const registration = await navigator.serviceWorker.ready
      const freshToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      })
      if (freshToken) {
        tokenToSave = freshToken
        if (freshToken !== storedToken) {
          // Token rotated — remove the stale DB row before saving the new one
          // to prevent orphaned subscriptions from accumulating.
          try {
            await supabase.rpc('remove_push_subscription', {
              p_fcm_token: storedToken,
            })
          } catch { /* best-effort cleanup of rotated token */ }
          localStorage.setItem(FCM_TOKEN_KEY, freshToken)
        }
      }
    }

    await supabase.rpc('save_push_subscription', {
      p_fcm_token: tokenToSave,
    })
  } catch {
    // Best-effort — don't block login if sync fails
  }
}

const FCM_MIGRATED_KEY = 'adtmc_fcm_migrated'

/**
 * One-time migration: if the browser has an old Web Push subscription
 * (from the pre-FCM era) but no FCM token in localStorage, automatically
 * re-subscribe via Firebase and clean up the old subscription.
 * Returns true if migration occurred (caller should refresh state).
 */
export async function migrateOldSubscription(): Promise<boolean> {
  try {
    if (localStorage.getItem(FCM_MIGRATED_KEY)) return false
    if (getStoredFcmToken()) {
      localStorage.setItem(FCM_MIGRATED_KEY, '1')
      return false
    }

    // Check for an old PushManager subscription
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return false
    const oldSub = await registration.pushManager.getSubscription()
    if (!oldSub) {
      localStorage.setItem(FCM_MIGRATED_KEY, '1')
      return false
    }

    // Notification permission is already granted (old sub exists)
    const messaging = await getFirebaseMessaging()
    if (!messaging || !VAPID_KEY) return false

    // Unsubscribe the old Web Push subscription
    await oldSub.unsubscribe().catch(() => {})

    // Get a fresh FCM token
    const swReg = await navigator.serviceWorker.ready
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    if (!token) return false

    const { error } = await supabase.rpc('save_push_subscription', {
      p_fcm_token: token,
    })

    if (error) return false

    localStorage.setItem(FCM_TOKEN_KEY, token)
    localStorage.setItem(FCM_MIGRATED_KEY, '1')
    return true
  } catch {
    return false
  }
}

export async function unsubscribeFromPush(): Promise<ServiceResult> {
  try {
    const token = getStoredFcmToken()
    if (!token) return succeed()

    const messaging = await getFirebaseMessaging()
    if (messaging) {
      await deleteToken(messaging).catch(() => {})
    }

    await supabase.rpc('remove_push_subscription', {
      p_fcm_token: token,
    })

    localStorage.removeItem(FCM_TOKEN_KEY)
    return succeed()
  } catch (err) {
    return fail(getErrorMessage(err, 'Failed to unsubscribe'))
  }
}
