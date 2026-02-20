import { useState, useEffect, useCallback } from 'react'
import { Bell, Users, Code, Info, ShieldCheck, ShieldX } from 'lucide-react'
import { usePushNotifications } from '../../Hooks/usePushNotifications'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { isDevUser } from '../../lib/adminService'
import { supabase } from '../../lib/supabase'

export const NotificationSettingsPanel = () => {
  const { isSupported, isSubscribed, loading, error: pushError, subscribe, unsubscribe } = usePushNotifications()
  const { profile, updateProfile } = useUserProfile()
  const [isDev, setIsDev] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const clinicNotes = profile.notifyClinicNotes ?? false
  const devAlerts = profile.notifyDevAlerts ?? false

  useEffect(() => {
    isDevUser().then(setIsDev)
  }, [])

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 2000)
  }, [])

  const showError = useCallback((msg: string) => {
    setError(msg)
    setTimeout(() => setError(''), 3000)
  }, [])

  /** Persist a notification preference to Supabase and local state */
  const handleToggle = useCallback(async (
    field: 'notifyClinicNotes' | 'notifyDevAlerts',
    dbColumn: string,
    newValue: boolean,
    otherActive: boolean,
  ) => {
    setSyncing(true)
    setError('')

    if (newValue) {
      // Ensure push subscription exists
      if (!isSubscribed) {
        const ok = await subscribe()
        if (!ok) {
          setSyncing(false)
          showError(pushError || 'Could not enable notifications')
          return
        }
      }
    }

    // Persist to Supabase
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ [dbColumn]: newValue }).eq('id', user.id)
    }

    updateProfile({ [field]: newValue })

    // If turning off and no other toggles remain active, unsubscribe from push
    if (!newValue && !otherActive) {
      await unsubscribe()
    }

    setSyncing(false)
    showSuccess(newValue ? 'Notifications enabled' : 'Notifications updated')
  }, [isSubscribed, subscribe, unsubscribe, pushError, updateProfile, showSuccess, showError])

  const busy = loading || syncing

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
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-themegreen/10">
            <ShieldCheck size={16} className="text-themegreen" />
            <span className="text-sm text-themegreen font-medium">{success}</span>
          </div>
        )}

        {/* Error banner */}
        {(error || pushError) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-themeredred/10">
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

        {isSupported && (
          <>
            {/* Clinic Notes Toggle */}
            <div
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
                ${clinicNotes
                  ? 'border-themeblue2/25 bg-themeblue2/10'
                  : 'border-tertiary/15 bg-themewhite2'
                } ${busy ? 'opacity-50 pointer-events-none' : ''}`}
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
              <div className={`w-10 h-6 rounded-full relative transition-colors ${clinicNotes ? 'bg-themeblue2' : 'bg-tertiary/25'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${clinicNotes ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>

            {/* Dev Alerts Toggle — only for dev role */}
            {isDev && (
              <div
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer
                  ${devAlerts
                    ? 'border-themeblue2/25 bg-themeblue2/10'
                    : 'border-tertiary/15 bg-themewhite2'
                  } ${busy ? 'opacity-50 pointer-events-none' : ''}`}
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
                <div className={`w-10 h-6 rounded-full relative transition-colors ${devAlerts ? 'bg-themeblue2' : 'bg-tertiary/25'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${devAlerts ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
