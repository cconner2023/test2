import { useState, useEffect, useCallback } from 'react'
import { Mail, Code, Info, Volume2 } from 'lucide-react'
import { usePushNotifications } from '../../Hooks/usePushNotifications'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { useAuth } from '../../Hooks/useAuth'
import { isDevUser } from '../../lib/adminService'
import { isMessageSoundsEnabled, setMessageSoundsEnabled } from '../../lib/soundService'
import { ToggleSwitch } from './ToggleSwitch'
import { StatusBanner } from './StatusBanner'
import { UI_TIMING } from '../../Utilities/constants'

export const NotificationSettingsPanel = () => {
  const { isSupported, isSubscribed, loading, error: pushError, subscribe, unsubscribe } = usePushNotifications()
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const { isAuthenticated } = useAuth()
  const [isDev, setIsDev] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const devAlerts = profile.notifyDevAlerts ?? false
  const messageNotifs = profile.notifyMessages ?? true
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

  /** Persist a notification preference optimistically */
  const handleToggle = useCallback(async (
    field: 'notifyDevAlerts' | 'notifyMessages',
    dbColumn: string,
    newValue: boolean,
  ) => {
    setError('')

    // If enabling, ensure push subscription exists (device permission — must await)
    if (newValue && !isSubscribed) {
      const ok = await subscribe()
      if (!ok) {
        showError(pushError || 'Could not enable notifications')
        return
      }
    }

    // Immediate local update
    updateProfile({ [field]: newValue })

    // Fire-and-forget Supabase sync
    syncProfileField({ [dbColumn]: newValue })

    showSuccess(newValue ? 'Notifications enabled' : 'Notifications updated')
  }, [isSubscribed, subscribe, pushError, updateProfile, syncProfileField, showSuccess, showError])

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-5">
        {/* Description */}
        <p className="text-xs text-tertiary leading-relaxed">
          Choose which notifications you'd like to receive. Your preferences sync across devices —
          each device still needs its own browser permission.
        </p>

        {/* Success banner */}
        {success && (
          <StatusBanner type="success" message={success} />
        )}

        {/* Error banner */}
        {(error || pushError) && (
          <StatusBanner type="error" message={error || pushError || ''} />
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

        {/* Messages toggle — visible to all authenticated users */}
        {isSupported && isAuthenticated && (
          <div className={`rounded-xl border overflow-hidden transition-all
            ${messageNotifs ? 'border-themeblue2/25 bg-themeblue2/10' : 'border-tertiary/15 bg-themewhite2'}
            ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div
              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
              onClick={() => handleToggle('notifyMessages', 'notify_messages', !messageNotifs)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle('notifyMessages', 'notify_messages', !messageNotifs); } }}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${messageNotifs ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                <Mail size={18} className={messageNotifs ? 'text-themeblue2' : 'text-tertiary/50'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${messageNotifs ? 'text-primary' : 'text-tertiary'}`}>Messages</p>
                <p className="text-[11px] text-tertiary/70 mt-0.5">New messages, requests, and accepted requests</p>
              </div>
              <ToggleSwitch checked={messageNotifs} />
            </div>

            {/* Nested: Message Sounds */}
            {messageNotifs && (
              <div className="border-t border-tertiary/10 px-4 py-3">
                <div
                  onClick={() => {
                    const next = !soundsEnabled
                    setMessageSoundsEnabled(next)
                    setSoundsEnabled(next)
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-tertiary/15 bg-themewhite transition-all cursor-pointer`}
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
              </div>
            )}
          </div>
        )}

        {/* Dev alerts toggle — only visible to dev users */}
        {isSupported && isDev && (
          <div
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
              ${devAlerts
                ? 'border-themeblue2/25 bg-themeblue2/10'
                : 'border-tertiary/15 bg-themewhite2'
              } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => handleToggle('notifyDevAlerts', 'notify_dev_alerts', !devAlerts)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle('notifyDevAlerts', 'notify_dev_alerts', !devAlerts); } }}
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
    </div>
  )
}
