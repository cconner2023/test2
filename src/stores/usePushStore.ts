import { create } from 'zustand'
import {
  isPushSupported,
  getStoredFcmToken,
  getSubscriptionInfo,
  subscribeToPush,
  unsubscribeFromPush,
  migrateOldSubscription,
  type SubscriptionInfo,
} from '../lib/pushNotificationService'
import { useNavigationStore } from './useNavigationStore'
import { invalidate } from './useInvalidationStore'

export interface ForegroundPush {
  title: string
  body: string
  url?: string
}

interface PushState {
  isSupported: boolean
  isSubscribed: boolean
  subscriptionInfo: SubscriptionInfo | null
  loading: boolean
  error: string | null
  foregroundPush: ForegroundPush | null
  refreshSubscriptionState: () => void
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  showForegroundPush: (push: ForegroundPush) => void
  dismissForegroundPush: () => void
}

let foregroundTimer: ReturnType<typeof setTimeout> | null = null

export const usePushStore = create<PushState>()((set, get) => ({
  isSupported: false,
  isSubscribed: false,
  subscriptionInfo: null,
  loading: true,
  error: null,
  foregroundPush: null,

  refreshSubscriptionState: () => {
    const token = getStoredFcmToken()
    set({ isSubscribed: !!token, subscriptionInfo: token ? getSubscriptionInfo() : null })
  },

  subscribe: async () => {
    set({ loading: true, error: null })
    const result = await subscribeToPush()
    if (result.success) {
      get().refreshSubscriptionState()
    } else {
      set({ error: result.error || 'Failed to subscribe' })
    }
    set({ loading: false })
    return result.success
  },

  unsubscribe: async () => {
    set({ loading: true, error: null })
    const result = await unsubscribeFromPush()
    if (result.success) {
      set({ isSubscribed: false, subscriptionInfo: null })
    } else {
      set({ error: result.error || 'Failed to unsubscribe' })
    }
    set({ loading: false })
    return result.success
  },

  showForegroundPush: (push) => {
    if (foregroundTimer) clearTimeout(foregroundTimer)
    set({ foregroundPush: push })
    foregroundTimer = setTimeout(() => {
      set({ foregroundPush: null })
      foregroundTimer = null
    }, 6000)
  },

  dismissForegroundPush: () => {
    set({ foregroundPush: null })
    if (foregroundTimer) {
      clearTimeout(foregroundTimer)
      foregroundTimer = null
    }
  },
}))

let pushRoutingStarted = false

export function initPushRouting(): void {
  if (pushRoutingStarted) return
  pushRoutingStarted = true

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'PUSH_RECEIVED') {
      // Message-routed pushes carry only the generic FCM copy ('New Message').
      // The locally-decrypted realtime path already renders a specific
      // "Sender / message" banner via MessageNotificationToast, so suppress the
      // generic duplicate here and let that rich banner be the sole one.
      const url = event.data.url as string | undefined
      if (url?.includes('view=messages')) return
      // Admin-routed pushes (new_account / new_feedback both land on
      // view=admin) carry server-originated rows the admin drawer can't otherwise
      // know about — it has no realtime subscription. Bust the 'requests' gen so
      // an OPEN admin inbox re-pulls (useAdminInbox's combined requests+feedback+
      // suggestions feed keys off this gen). Cheap: one query, only if mounted.
      if (url?.includes('view=admin')) invalidate('requests')
      usePushStore.getState().showForegroundPush({
        title: event.data.title || 'Notification',
        body: event.data.body || '',
        url: event.data.url,
      })
    } else if (event.data?.type === 'NOTIFICATION_CLICK') {
      // iOS doesn't support client.navigate() — handle navigation via store
      const url = event.data.url as string | undefined
      if (url?.includes('view=')) {
        const params = new URLSearchParams(url.split('?')[1] || '')
        const view = params.get('view')
        const nav = useNavigationStore.getState()
        if (view === 'messages') nav.setShowMessagesDrawer(true)
        else if (view === 'admin') {
          // Tapping the request push opens the drawer (defaults to the requests
          // tab). Bust 'requests' first so a backgrounded-not-killed app — whose
          // gen-keyed cache is warm-but-stale — refetches instead of showing the
          // pre-request list it had cached.
          invalidate('requests')
          nav.setShowAdminDrawer(true)
        }
        else if (view === 'clinicNotes') nav.setShowProviderDrawer(true)
        else if (view === 'calendar') nav.setShowCalendarDrawer(true)
        // On-call ring + voicemail-delivered notifications. The live ring
        // modal (OncallCallModal) is mounted globally and surfaces from the
        // realtime ring row once foregrounded; the voicemail card lives in the
        // messages surface — both just need the PWA foregrounded here.
        else if (view === 'oncall' || view === 'voicemail') nav.setShowMessagesDrawer(true)
      } else {
        // Default: open messages for signal_message notifications
        useNavigationStore.getState().setShowMessagesDrawer(true)
      }
    }
  }
  navigator.serviceWorker?.addEventListener('message', handler)

  const store = usePushStore.getState()
  const supported = isPushSupported()
  usePushStore.setState({ isSupported: supported })
  if (supported) {
    // One-time migration from old Web Push to FCM
    migrateOldSubscription().then((migrated) => {
      if (migrated) usePushStore.getState().refreshSubscriptionState()
    })
  }
  store.refreshSubscriptionState()
  usePushStore.setState({ loading: false })
}
