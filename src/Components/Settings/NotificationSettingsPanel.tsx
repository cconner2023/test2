import { useState, useEffect, useCallback } from 'react'
import { Bell, Mail, Code, Info, Volume2, Plus, Trash2, Wifi, WifiOff } from 'lucide-react'
import { usePushNotifications } from '../../Hooks/usePushNotifications'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { useAuth } from '../../Hooks/useAuth'
import { isDevUser } from '../../lib/adminService'
import { isMessageSoundsEnabled, setMessageSoundsEnabled } from '../../lib/soundService'
import { ToggleSwitch } from './ToggleSwitch'
import { ErrorDisplay } from '../ErrorDisplay'
import { UI_TIMING } from '../../Utilities/constants'

export const NotificationSettingsPanel = () => {
  const { isSupported, isSubscribed, subscriptionInfo, loading, error: pushError, subscribe, unsubscribe } = usePushNotifications()
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const { isAuthenticated } = useAuth()
  const [isDev, setIsDev] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const devAlerts = profile.notifyDevAlerts ?? false
  const [soundsEnabled, setSoundsEnabled] = useState(isMessageSoundsEnabled)

  useEffect(() => {
    isDevUser().then(setIsDev)
  }, [])

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), UI_TIMING.COPY_FEEDBACK)
  }, [])

  const showError = useCallback((msg: string) => {
    setError(msg)
    setTimeout(() => setError(''), UI_TIMING.SAVE_ERROR_DURATION)
  }, [])

  const handleSubscribe = useCallback(async () => {
    setError('')
    const ok = await subscribe()
    if (!ok) {
      showError(pushError || 'Could not enable notifications')
      return
    }
    showSuccess('Subscription created')
  }, [subscribe, pushError, showSuccess, showError])

  const handleUnsubscribe = useCallback(async () => {
    setError('')
    const ok = await unsubscribe()
    if (!ok) {
      showError(pushError || 'Could not remove subscription')
      return
    }
    showSuccess('Subscription removed')
  }, [unsubscribe, pushError, showSuccess, showError])

  const handleDevAlertToggle = useCallback(async (newValue: boolean) => {
    setError('')

    if (newValue && !isSubscribed) {
      const ok = await subscribe()
      if (!ok) {
        showError(pushError || 'Could not enable notifications')
        return
      }
    }

    updateProfile({ notifyDevAlerts: newValue })
    syncProfileField({ notify_dev_alerts: newValue })
    showSuccess(newValue ? 'Dev alerts enabled' : 'Dev alerts disabled')
  }, [isSubscribed, subscribe, pushError, updateProfile, syncProfileField, showSuccess, showError])

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-5">
        <p className="text-xs text-tertiary leading-relaxed">
          Manage your push notification subscription and preferences for this device.
        </p>

        {success && <ErrorDisplay type="success" message={success} />}
        {(error || pushError) && <ErrorDisplay type="error" message={error || pushError || ''} />}

        {/* Not supported */}
        {!isSupported && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tertiary/5">
            <Info size={16} className="text-tertiary/60" />
            <span className="text-sm text-tertiary/70">
              Push notifications are not supported in this browser.
            </span>
          </div>
        )}

        {/* ── Notifications Block ─────────────────────────────────── */}
        {isSupported && isAuthenticated && (
          <div className={`rounded-xl border overflow-hidden transition-all ${loading ? 'opacity-50 pointer-events-none' : ''} border-tertiary/15 bg-themewhite2`}>

            {/* Subscription Status */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isSubscribed ? 'bg-themegreen/15' : 'bg-tertiary/10'}`}>
                {isSubscribed
                  ? <Wifi size={18} className="text-themegreen" />
                  : <WifiOff size={18} className="text-tertiary/50" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isSubscribed ? 'text-primary' : 'text-tertiary'}`}>
                  {isSubscribed ? 'Active Subscription' : 'No Subscription'}
                </p>
                <p className="text-[11px] text-tertiary/70 mt-0.5 truncate">
                  {isSubscribed && subscriptionInfo
                    ? subscriptionInfo.domain
                    : 'This device is not receiving push notifications'
                  }
                </p>
              </div>
              {isSubscribed ? (
                <button
                  onClick={handleUnsubscribe}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-themeredred bg-themeredred/10 active:scale-95 transition-all"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              ) : (
                <button
                  onClick={handleSubscribe}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-themeblue2 bg-themeblue2/10 active:scale-95 transition-all"
                >
                  <Plus size={14} />
                  Add
                </button>
              )}
            </div>

            {/* Toggles — only when subscribed */}
            {isSubscribed && (
              <div className="border-t border-tertiary/10 px-4 py-3 space-y-2">

                {/* Messages Toggle */}
                <div
                  onClick={() => {
                    const next = !soundsEnabled
                    setMessageSoundsEnabled(next)
                    setSoundsEnabled(next)
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-tertiary/15 bg-themewhite transition-all cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      const next = !soundsEnabled
                      setMessageSoundsEnabled(next)
                      setSoundsEnabled(next)
                    }
                  }}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${soundsEnabled ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                    <Volume2 size={18} className={soundsEnabled ? 'text-themeblue2' : 'text-tertiary/50'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${soundsEnabled ? 'text-primary' : 'text-tertiary'}`}>Message Sounds</p>
                    <p className="text-[11px] text-tertiary/70 mt-0.5">Play sounds when sending and receiving messages</p>
                  </div>
                  <ToggleSwitch checked={soundsEnabled} />
                </div>

                {/* Dev Alerts Toggle — dev users only */}
                {isDev && (
                  <div
                    onClick={() => handleDevAlertToggle(!devAlerts)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-tertiary/15 bg-themewhite transition-all cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDevAlertToggle(!devAlerts); } }}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${devAlerts ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                      <Code size={18} className={devAlerts ? 'text-themeblue2' : 'text-tertiary/50'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${devAlerts ? 'text-primary' : 'text-tertiary'}`}>Dev Alerts</p>
                      <p className="text-[11px] text-tertiary/70 mt-0.5">Login alerts, account requests, and feedback</p>
                    </div>
                    <ToggleSwitch checked={devAlerts} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
