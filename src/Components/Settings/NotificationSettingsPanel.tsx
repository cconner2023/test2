import { useState, useCallback } from 'react'
import { Bell, BellOff, BellRing, ShieldCheck, ShieldX, Info } from 'lucide-react'
import { usePushNotifications } from '../../Hooks/usePushNotifications'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { supabase } from '../../lib/supabase'

export const NotificationSettingsPanel = () => {
  const { isSupported, isSubscribed, loading, error: pushError, subscribe, unsubscribe } = usePushNotifications()
  const { profile, updateProfile } = useUserProfile()
  const [syncing, setSyncing] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 2000)
  }, [])

  const showError = useCallback((msg: string) => {
    setError(msg)
    setTimeout(() => setError(''), 3000)
  }, [])

  const handleEnable = useCallback(async () => {
    setSyncing(true)
    setError('')

    // Subscribe to push on this device
    const ok = await subscribe()
    if (!ok) {
      setSyncing(false)
      showError(pushError || 'Could not enable notifications')
      return
    }

    // Persist preference to cloud
    await supabase.rpc('update_own_security_settings', {
      p_notifications_enabled: true,
    })
    updateProfile({ notificationsEnabled: true })

    setSyncing(false)
    showSuccess('Notifications enabled')
  }, [subscribe, pushError, updateProfile, showSuccess, showError])

  const handleDisable = useCallback(async () => {
    setSyncing(true)
    setError('')

    // Unsubscribe on this device
    const ok = await unsubscribe()
    if (!ok) {
      setSyncing(false)
      showError(pushError || 'Could not disable notifications')
      return
    }

    // Persist preference to cloud
    await supabase.rpc('update_own_security_settings', {
      p_notifications_enabled: false,
    })
    updateProfile({ notificationsEnabled: false })

    setSyncing(false)
    showSuccess('Notifications disabled')
  }, [unsubscribe, pushError, updateProfile, showSuccess, showError])

  const handleResubscribe = useCallback(async () => {
    setSyncing(true)
    setError('')

    const ok = await subscribe()
    if (ok) {
      showSuccess('Subscribed on this device')
    } else {
      showError(pushError || 'Could not subscribe on this device')
    }
    setSyncing(false)
  }, [subscribe, pushError, showSuccess, showError])

  const busy = loading || syncing

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-themeblue2/10 flex items-center justify-center">
            <Bell size={20} className="text-themeblue2" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Push Notifications</p>
            <p className="text-xs text-tertiary">
              {profile.notificationsEnabled
                ? 'Notifications are enabled'
                : 'Get notified about important updates'}
            </p>
          </div>
        </div>

        <p className="text-xs text-tertiary/70 mb-5 leading-relaxed">
          Receive push notifications for clinic updates and training reminders.
          Your notification preference syncs across devices — each device still needs
          its own browser permission.
        </p>

        {/* Success banner */}
        {success && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-themegreen/10">
            <ShieldCheck size={16} className="text-themegreen" />
            <span className="text-sm text-themegreen font-medium">{success}</span>
          </div>
        )}

        {/* Error banner */}
        {(error || pushError) && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-themeredred/10">
            <ShieldX size={16} className="text-themeredred" />
            <span className="text-sm text-themeredred font-medium">{error || pushError}</span>
          </div>
        )}

        {/* Not supported */}
        {!isSupported && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tertiary/5">
            <Info size={16} className="text-tertiary/60" />
            <span className="text-sm text-tertiary/70">
              Push notifications are not supported in this browser.
            </span>
          </div>
        )}

        {/* Main toggle */}
        {isSupported && (
          <div className="space-y-2">
            {!profile.notificationsEnabled ? (
              <button
                onClick={handleEnable}
                disabled={busy}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-themeblue2/10
                           hover:bg-themeblue2/15 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <BellRing size={18} className="text-themeblue2" />
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium text-themeblue2">
                    {busy ? 'Enabling...' : 'Enable Notifications'}
                  </span>
                  <p className="text-[11px] text-tertiary/70 mt-0.5">
                    Allow push notifications on this device
                  </p>
                </div>
              </button>
            ) : (
              <>
                {/* Re-subscribe hint: cloud says enabled but this device has no subscription */}
                {!isSubscribed && !busy && (
                  <button
                    onClick={handleResubscribe}
                    disabled={busy}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-amber-500/10
                               hover:bg-amber-500/15 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <BellRing size={18} className="text-amber-500" />
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium text-amber-500">Subscribe This Device</span>
                      <p className="text-[11px] text-tertiary/70 mt-0.5">
                        Notifications are enabled but this device isn't subscribed yet
                      </p>
                    </div>
                  </button>
                )}

                {/* Disable button */}
                <button
                  onClick={handleDisable}
                  disabled={busy}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-themeredred/10
                             hover:bg-themeredred/15 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <BellOff size={18} className="text-themeredred" />
                  <div className="flex-1 text-left">
                    <span className="text-sm font-medium text-themeredred">
                      {busy ? 'Disabling...' : 'Disable Notifications'}
                    </span>
                    <p className="text-[11px] text-tertiary/70 mt-0.5">
                      Turn off notifications on all devices
                    </p>
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
