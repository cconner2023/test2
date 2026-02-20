import { useState, useEffect, useCallback } from 'react'
import { Bell, Users, Code, Info } from 'lucide-react'
import { usePushNotifications } from '../../Hooks/usePushNotifications'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { isDevUser } from '../../lib/adminService'
import { ToggleSwitch } from './ToggleSwitch'
import { StatusBanner } from './StatusBanner'
import { UI_TIMING } from '../../Utilities/constants'

export const NotificationSettingsPanel = () => {
  const { isSupported, isSubscribed, loading, error: pushError, subscribe, unsubscribe } = usePushNotifications()
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const [isDev, setIsDev] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const clinicNotes = profile.notifyClinicNotes ?? false
  const devAlerts = profile.notifyDevAlerts ?? false

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
    field: 'notifyClinicNotes' | 'notifyDevAlerts',
    dbColumn: string,
    newValue: boolean,
    otherActive: boolean,
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

    // If turning off and no other toggles remain active, unsubscribe (fire-and-forget)
    if (!newValue && !otherActive) {
      unsubscribe()
    }

    showSuccess(newValue ? 'Notifications enabled' : 'Notifications updated')
  }, [isSubscribed, subscribe, unsubscribe, pushError, updateProfile, syncProfileField, showSuccess, showError])

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

        {isSupported && (
          <>
            {/* Clinic Notes Toggle */}
            <div
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
                ${clinicNotes
                  ? 'border-themeblue2/25 bg-themeblue2/10'
                  : 'border-tertiary/15 bg-themewhite2'
                } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => handleToggle('notifyClinicNotes', 'notify_clinic_notes', !clinicNotes, devAlerts)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle('notifyClinicNotes', 'notify_clinic_notes', !clinicNotes, devAlerts); } }}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${clinicNotes ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                <Users size={18} className={clinicNotes ? 'text-themeblue2' : 'text-tertiary/50'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${clinicNotes ? 'text-primary' : 'text-tertiary'}`}>Clinic Notes</p>
                <p className="text-[11px] text-tertiary/70 mt-0.5">Get notified when someone contributes a note in your clinic</p>
              </div>
              <ToggleSwitch checked={clinicNotes} />
            </div>

            {/* Dev Alerts Toggle — only for dev role */}
            {isDev && (
              <div
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
                  ${devAlerts
                    ? 'border-themeblue2/25 bg-themeblue2/10'
                    : 'border-tertiary/15 bg-themewhite2'
                  } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => handleToggle('notifyDevAlerts', 'notify_dev_alerts', !devAlerts, clinicNotes)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle('notifyDevAlerts', 'notify_dev_alerts', !devAlerts, clinicNotes); } }}
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
          </>
        )}
      </div>
    </div>
  )
}
