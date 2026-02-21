import { supabase } from './supabase'
import { urlBase64ToUint8Array } from './base64Utils'

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
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!VAPID_PUBLIC_KEY) {
      return { success: false, error: 'VAPID public key not configured' }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied' }
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const subJson = subscription.toJSON()
    const { error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: subJson.endpoint!,
      p_auth_key: subJson.keys!.auth,
      p_p256dh_key: subJson.keys!.p256dh,
    })

    if (error) {
      await subscription.unsubscribe()
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to subscribe',
    }
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const subscription = await getExistingSubscription()
    if (!subscription) return { success: true }

    const endpoint = subscription.endpoint

    await subscription.unsubscribe()

    await supabase.rpc('remove_push_subscription', {
      p_endpoint: endpoint,
    })

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unsubscribe',
    }
  }
}
