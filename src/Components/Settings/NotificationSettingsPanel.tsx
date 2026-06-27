import { useState, useCallback } from 'react'
import { Bell, Code, Info, Volume2, CalendarClock } from 'lucide-react'
import { usePushNotifications } from '../../Hooks/usePushNotifications'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { useAuth } from '../../Hooks/useAuth'
import { isMessageSoundsEnabled, setMessageSoundsEnabled } from '../../lib/soundService'
import { ToggleSwitch } from './ToggleSwitch'
import { ErrorDisplay } from '../ErrorDisplay'
import { UI_TIMING } from '../../Utilities/constants'

export const NotificationSettingsPanel = () => {
  const { isSupported, isSubscribed, subscriptionInfo, loading, error: pushError, subscribe, unsubscribe } = usePushNotifications()
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const { isAuthenticated, isDevRole } = useAuth()
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const devAlerts = profile.notifyDevAlerts ?? false
  const calendarAssignments = profile.notifyCalendarAssignments ?? false
  const [soundsEnabled, setSoundsEnabled] = useState(isMessageSoundsEnabled)

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

  const handleCalendarAssignToggle = useCallback(async (newValue: boolean) => {
    setError('')

    if (newValue && !isSubscribed) {
      const ok = await subscribe()
      if (!ok) {
        showError(pushError || 'Could not enable notifications')
        return
      }
    }

    updateProfile({ notifyCalendarAssignments: newValue })
    syncProfileField({ notify_calendar_assignments: newValue })
    showSuccess(newValue ? 'Event assignment alerts enabled' : 'Event assignment alerts disabled')
  }, [isSubscribed, subscribe, pushError, updateProfile, syncProfileField, showSuccess, showError])

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
        <p className="text-[10pt] text-tertiary leading-relaxed">
          Manage your push notification subscription and preferences for this device.
        </p>

        {success && <ErrorDisplay type="success" message={success} />}
        {(error || pushError) && <ErrorDisplay type="error" message={error || pushError || ''} />}

        {/* Not supported */}
        {!isSupported && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tertiary/5">
            <Info size={16} className="text-tertiary" />
            <span className="text-sm text-tertiary">
              Push notifications are not supported in this browser.
            </span>
          </div>
        )}

        {/* ── Notifications Block ─────────────────────────────────── */}
        {isSupported && isAuthenticated && (
          <div className={`rounded-xl border overflow-hidden transition-all ${loading ? 'opacity-50 pointer-events-none' : ''} border-tertiary/15 bg-themewhite2`}>

            {/* Master toggle — the device subscription on/off */}
            <div
              onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isSubscribed ? handleUnsubscribe() : handleSubscribe() } }}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isSubscribed ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                <Bell size={18} className={isSubscribed ? 'text-themeblue2' : 'text-tertiary'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isSubscribed ? 'text-primary' : 'text-tertiary'}`}>Push Notifications</p>
                <p className="text-[9pt] text-tertiary mt-0.5 truncate">
                  {isSubscribed && subscriptionInfo
                    ? subscriptionInfo.provider
                    : 'This device is not receiving push notifications'
                  }
                </p>
              </div>
              <ToggleSwitch checked={isSubscribed} />
            </div>

            {/* Per-category toggles — only when subscribed */}
            {isSubscribed && (
              <>
                {/* Message Sounds */}
                <div
                  onClick={() => {
                    const next = !soundsEnabled
                    setMessageSoundsEnabled(next)
                    setSoundsEnabled(next)
                  }}
                  className="flex items-center gap-3 px-4 py-3.5 border-t border-tertiary/10 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
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
                    <Volume2 size={18} className={soundsEnabled ? 'text-themeblue2' : 'text-tertiary'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${soundsEnabled ? 'text-primary' : 'text-tertiary'}`}>Message Sounds</p>
                    <p className="text-[9pt] text-tertiary mt-0.5">Play sounds when sending and receiving messages</p>
                  </div>
                  <ToggleSwitch checked={soundsEnabled} />
                </div>

                {/* Event Assignments — all users */}
                <div
                  onClick={() => handleCalendarAssignToggle(!calendarAssignments)}
                  className="flex items-center gap-3 px-4 py-3.5 border-t border-tertiary/10 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCalendarAssignToggle(!calendarAssignments); } }}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${calendarAssignments ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                    <CalendarClock size={18} className={calendarAssignments ? 'text-themeblue2' : 'text-tertiary'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${calendarAssignments ? 'text-primary' : 'text-tertiary'}`}>Event Assignments</p>
                    <p className="text-[9pt] text-tertiary mt-0.5">Get notified when you're assigned to a calendar event</p>
                  </div>
                  <ToggleSwitch checked={calendarAssignments} />
                </div>

                {/* Dev Alerts — dev users only */}
                {isDevRole && (
                  <div
                    onClick={() => handleDevAlertToggle(!devAlerts)}
                    className="flex items-center gap-3 px-4 py-3.5 border-t border-tertiary/10 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDevAlertToggle(!devAlerts); } }}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${devAlerts ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                      <Code size={18} className={devAlerts ? 'text-themeblue2' : 'text-tertiary'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${devAlerts ? 'text-primary' : 'text-tertiary'}`}>Dev Alerts</p>
                      <p className="text-[9pt] text-tertiary mt-0.5">Login alerts, account requests, and feedback</p>
                    </div>
                    <ToggleSwitch checked={devAlerts} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
