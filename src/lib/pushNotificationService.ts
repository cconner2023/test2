import { supabase } from './supabase'
import { base64urlToBytes } from './base64Utils'
import { succeed, fail, type ServiceResult } from './result'
import { getErrorMessage } from '../Utilities/errorUtils'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

export async function subscribeToPush(): Promise<ServiceResult> {
  try {
    if (!VAPID_PUBLIC_KEY) {
      return fail('VAPID public key not configured')
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return fail('Notification permission denied')
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64urlToBytes(VAPID_PUBLIC_KEY),
    })

    const subJson = subscription.toJSON()
    const { error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: subJson.endpoint!,
      p_auth_key: subJson.keys!.auth,
      p_p256dh_key: subJson.keys!.p256dh,
    })

    if (error) {
      await subscription.unsubscribe()
      return fail(error.message)
    }

    return succeed()
  } catch (err) {
    return fail(getErrorMessage(err, 'Failed to subscribe'))
  }
}

/**
 * Re-sync an existing browser push subscription to the database for the
 * current authenticated user.  Called on login so that stale / orphaned
 * browser subscriptions are re-associated with the logged-in user and
 * the backend can deliver pushes again.
 */
export async function resyncPushSubscription(): Promise<void> {
  try {
    const subscription = await getExistingSubscription()
    if (!subscription) return

    const subJson = subscription.toJSON()
    if (!subJson.endpoint || !subJson.keys?.auth || !subJson.keys?.p256dh) return

    await supabase.rpc('save_push_subscription', {
      p_endpoint: subJson.endpoint,
      p_auth_key: subJson.keys.auth,
      p_p256dh_key: subJson.keys.p256dh,
    })
  } catch {
    // Best-effort — don't block login if sync fails
  }
}

export async function unsubscribeFromPush(): Promise<ServiceResult> {
  try {
    const subscription = await getExistingSubscription()
    if (!subscription) return succeed()

    const endpoint = subscription.endpoint

    await subscription.unsubscribe()

    await supabase.rpc('remove_push_subscription', {
      p_endpoint: endpoint,
    })

    return succeed()
  } catch (err) {
    return fail(getErrorMessage(err, 'Failed to unsubscribe'))
  }
}
