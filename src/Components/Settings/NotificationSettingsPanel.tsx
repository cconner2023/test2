import { useState, useCallback } from 'react'
import { Bell, Code, Info, Volume2, CalendarClock } from 'lucide-react'
import { usePushNotifications } from '../../Hooks/usePushNotifications'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { useAuth } from '../../Hooks/useAuth'
import { isMessageSoundsEnabled, setMessageSoundsEnabled } from '../../lib/soundService'
import { SettingsToggleRow } from './SettingsToggleRow'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { SectionCard } from '@/Components/primitives/Section'
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
          <SectionCard className={`transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}>

            {/* Master toggle — the device subscription on/off */}
            <SettingsToggleRow
              icon={Bell}
              label="Push Notifications"
              subtitle={isSubscribed && subscriptionInfo
                ? subscriptionInfo.provider
                : 'This device is not receiving push notifications'}
              checked={isSubscribed}
              onChange={isSubscribed ? handleUnsubscribe : handleSubscribe}
            />

            {/* Per-category toggles — only when subscribed */}
            {isSubscribed && (
              <>
                <SettingsToggleRow
                  icon={Volume2}
                  label="Message Sounds"
                  subtitle="Play sounds when sending and receiving messages"
                  checked={soundsEnabled}
                  onChange={() => {
                    const next = !soundsEnabled
                    setMessageSoundsEnabled(next)
                    setSoundsEnabled(next)
                  }}
                  divided
                />

                <SettingsToggleRow
                  icon={CalendarClock}
                  label="Event Assignments"
                  subtitle="Get notified when you're assigned to a calendar event"
                  checked={calendarAssignments}
                  onChange={() => handleCalendarAssignToggle(!calendarAssignments)}
                  divided
                />

                {isDevRole && (
                  <SettingsToggleRow
                    icon={Code}
                    label="Dev Alerts"
                    subtitle="Account requests and feedback"
                    checked={devAlerts}
                    onChange={() => handleDevAlertToggle(!devAlerts)}
                    divided
                  />
                )}
              </>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  )
}
