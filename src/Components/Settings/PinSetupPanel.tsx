import { useState, useCallback, useEffect } from 'react'
import { Lock, KeyRound, ScanFace, Timer, Activity, Smartphone, ChevronRight, Camera, MapPin } from 'lucide-react'
import { ErrorDisplay } from '../ErrorDisplay'
import { ToggleSwitch } from './ToggleSwitch'
import { PinKeypad } from '../PinKeypad'
import { UI_TIMING } from '../../Utilities/constants'
import {
  isPinEnabled,
  isAppLockEnabled,
  setAppLockEnabled,
  savePin,
  removePin,
  verifyPin,
  recordFailedAttempt,
  resetLockout,
  getStoredPin,
  syncPinToCloud,
  clearPinFromCloud,
  getInactivityTimeoutMs,
  setInactivityTimeoutMs,
} from '../../lib/pinService'
import {
  isActivityTrackingEnabled,
  setActivityTrackingEnabled,
} from '../../lib/activityHeartbeat'
import { useAuth } from '../../Hooks/useAuth'
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  enrollBiometric,
  removeBiometric,
} from '../../lib/biometricService'
import { usePinLockoutTimer } from '../../Hooks/usePinLockoutTimer'

type PinView = 'status' | 'set-new' | 'confirm-new' | 'verify-current' | 'change-new' | 'change-confirm'
type PendingAction = 'change' | 'remove' | null

const TIMEOUT_20_MIN = 20 * 60 * 1000

interface PinSetupPanelProps {
  onNavigateToDevices?: () => void
}

export const PinSetupPanel = ({ onNavigateToDevices }: PinSetupPanelProps) => {
  const [view, setView] = useState<PinView>('status')
  const [pinEnabled, setPinEnabled] = useState(isPinEnabled())
  const [appLockOn, setAppLockOn] = useState(isAppLockEnabled)
  const [timeoutMs, setTimeoutMs] = useState(getInactivityTimeoutMs)
  const { isAuthenticated } = useAuth()
  const [firstPin, setFirstPin] = useState('')
  const { lockout, setLockout, error, setError } = usePinLockoutTimer()
  const [success, setSuccess] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  // When true, enabling app lock is deferred until after a new PIN is set
  const [pendingEnableLock, setPendingEnableLock] = useState(false)

  // Activity tracking state
  const [activityTracking, setActivityTracking] = useState(isActivityTrackingEnabled)

  // Biometric state
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnrolled, setBioEnrolled] = useState(isBiometricEnrolled())
  const [bioLoading, setBioLoading] = useState(false)

  // Device permission state
  type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported'
  const [cameraPermission, setCameraPermission] = useState<PermState>('unsupported')
  const [locationPermission, setLocationPermission] = useState<PermState>('unsupported')

  // Check biometric availability + device permissions
  useEffect(() => {
    let cancelled = false
    async function check() {
      const available = await isBiometricAvailable()
      if (!cancelled) setBioAvailable(available)

      if (navigator.permissions) {
        try {
          const cam = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (!cancelled) {
            setCameraPermission(cam.state as PermState)
            cam.onchange = () => setCameraPermission(cam.state as PermState)
          }
        } catch { /* browser doesn't support querying camera */ }

        try {
          const geo = await navigator.permissions.query({ name: 'geolocation' })
          if (!cancelled) {
            setLocationPermission(geo.state as PermState)
            geo.onchange = () => setLocationPermission(geo.state as PermState)
          }
        } catch { /* browser doesn't support querying geolocation */ }
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const resetState = useCallback(() => {
    setFirstPin('')
    setError('')
    setSuccess('')
    setPendingAction(null)
    setPendingEnableLock(false)
  }, [setError])

  // Escape key to cancel PIN entry
  useEffect(() => {
    if (view === 'status') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { resetState(); setView('status') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view, resetState])

  const handleBiometricToggle = useCallback(async () => {
    setBioLoading(true)
    try {
      if (bioEnrolled) {
        removeBiometric()
        setBioEnrolled(false)
        setSuccess('Biometrics disabled.')
        setTimeout(() => setSuccess(''), UI_TIMING.COPY_FEEDBACK)
      } else {
        const enrolled = await enrollBiometric()
        if (enrolled) {
          setBioEnrolled(true)
          setSuccess('Biometrics enabled.')
          setTimeout(() => setSuccess(''), UI_TIMING.COPY_FEEDBACK)
        } else {
          setError('Biometric setup failed.')
          setTimeout(() => setError(''), UI_TIMING.SAVE_ERROR_DURATION)
        }
      }
    } finally {
      setBioLoading(false)
    }
  }, [bioEnrolled, setError])

  const handleRequestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
      setCameraPermission('granted')
    } catch {
      setCameraPermission('denied')
    }
  }, [])

  const handleRequestLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      () => setLocationPermission('granted'),
      () => setLocationPermission('denied'),
    )
  }, [])

  const handleSubmit = useCallback(async (pin: string) => {
    setError('')

    switch (view) {
      case 'set-new':
        setFirstPin(pin)
        setView('confirm-new')
        break

      case 'confirm-new':
        if (pin === firstPin) {
          await savePin(pin)
          const stored = getStoredPin()
          if (stored) syncPinToCloud(stored.hash, stored.salt)
          resetLockout()
          setPinEnabled(true)
          if (pendingEnableLock) {
            setAppLockEnabled(true)
            setAppLockOn(true)
          }
          setSuccess('PIN enabled')
          setTimeout(() => { resetState(); setView('status') }, 1200)
        } else {
          setError('PINs do not match.')
        }
        break

      case 'verify-current': {
        const valid = await verifyPin(pin)
        if (valid) {
          resetLockout()
          if (pendingAction === 'change') {
            setView('change-new')
          } else if (pendingAction === 'remove') {
            removePin()
            clearPinFromCloud()
            removeBiometric()
            setPinEnabled(false)
            setAppLockOn(false)
            setBioEnrolled(false)
            setSuccess('PIN removed')
            setTimeout(() => { resetState(); setView('status') }, 1200)
          }
        } else {
          const state = recordFailedAttempt()
          setLockout(state)
          setError('Incorrect PIN.')
        }
        break
      }

      case 'change-new':
        setFirstPin(pin)
        setView('change-confirm')
        break

      case 'change-confirm':
        if (pin === firstPin) {
          await savePin(pin)
          const changedStored = getStoredPin()
          if (changedStored) syncPinToCloud(changedStored.hash, changedStored.salt)
          resetLockout()
          setPinEnabled(true)
          setSuccess('PIN changed')
          setTimeout(() => { resetState(); setView('status') }, 1200)
        } else {
          setError('PINs do not match.')
        }
        break
    }
  }, [view, firstPin, pendingAction, pendingEnableLock, resetState, setError, setLockout])

  const viewLabels: Record<string, string> = {
    'set-new': 'Create a 4-digit PIN',
    'confirm-new': 'Confirm your PIN',
    'verify-current': 'Enter current PIN',
    'change-new': 'Enter new PIN',
    'change-confirm': 'Confirm new PIN',
  }

  // Status view — show enable/disable options
  if (view === 'status') {
    const timeoutEnabled = timeoutMs > 0

    const handleAppLockToggle = () => {
      if (appLockOn) {
        // Disable app lock — keep the PIN
        setAppLockEnabled(false)
        setAppLockOn(false)
      } else if (pinEnabled) {
        // PIN exists — just enable app lock
        setAppLockEnabled(true)
        setAppLockOn(true)
      } else {
        // No PIN yet — collect one, then enable app lock
        resetState()
        setPendingEnableLock(true)  // after resetState so it isn't cleared
        setView('set-new')
      }
    }

    return (
      <div className="h-full overflow-y-auto">
        <div className="px-5 py-4 space-y-5">

          {success && <ErrorDisplay type="success" message={success} />}
          {error && <ErrorDisplay type="error" message={error} />}

          {/* ── Lock ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Lock</p>
            </div>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">

              <div
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                onClick={handleAppLockToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAppLockToggle() } }}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${appLockOn ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                  <Lock size={18} className={appLockOn ? 'text-themeblue2' : 'text-tertiary'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${appLockOn ? 'text-primary' : 'text-tertiary'}`}>App Lock</p>
                  <p className="text-[9pt] text-tertiary mt-0.5">Lock when switching away or after inactivity</p>
                </div>
                <ToggleSwitch checked={appLockOn} />
              </div>

              {pinEnabled && (
                <>
                  {bioAvailable && (
                    <div
                      onClick={bioLoading ? undefined : handleBiometricToggle}
                      className={`flex items-center gap-3 pl-16 pr-4 py-3 bg-tertiary/5 transition-all ${bioLoading ? 'opacity-50' : 'cursor-pointer hover:bg-themeblue2/5 active:scale-95'}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (!bioLoading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleBiometricToggle() } }}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bioEnrolled ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                        <ScanFace size={16} className={bioEnrolled ? 'text-themeblue2' : 'text-tertiary'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${bioEnrolled ? 'text-primary' : 'text-tertiary'}`}>
                          {bioLoading ? 'Setting up...' : 'Face ID / Touch ID'}
                        </p>
                        <p className="text-[9pt] text-tertiary mt-0.5">Use biometrics instead of PIN</p>
                      </div>
                      <ToggleSwitch checked={bioEnrolled} />
                    </div>
                  )}
                  <div
                    className="flex items-center gap-3 pl-16 pr-4 py-3 bg-tertiary/5 cursor-pointer transition-all hover:bg-themeblue2/5 active:scale-95"
                    onClick={() => { resetState(); setPendingAction('change'); setView('verify-current') }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetState(); setPendingAction('change'); setView('verify-current') } }}
                  >
                    <KeyRound size={16} className="text-themeblue2 shrink-0" />
                    <span className="text-sm font-medium text-themeblue2">Change PIN</span>
                  </div>
                  <div
                    className="flex items-center gap-3 pl-16 pr-4 py-3 bg-tertiary/5 cursor-pointer transition-all hover:bg-themeblue2/5 active:scale-95"
                    onClick={() => { resetState(); setPendingAction('remove'); setView('verify-current') }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetState(); setPendingAction('remove'); setView('verify-current') } }}
                  >
                    <KeyRound size={16} className="text-themered shrink-0" />
                    <span className="text-sm font-medium text-themered">Remove PIN</span>
                  </div>
                </>
              )}

              {isAuthenticated && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                  onClick={() => {
                    const next = timeoutEnabled ? 0 : TIMEOUT_20_MIN
                    setTimeoutMs(next)
                    setInactivityTimeoutMs(next)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      const next = timeoutEnabled ? 0 : TIMEOUT_20_MIN
                      setTimeoutMs(next)
                      setInactivityTimeoutMs(next)
                    }
                  }}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${timeoutEnabled ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                    <Timer size={18} className={timeoutEnabled ? 'text-themeblue2' : 'text-tertiary'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${timeoutEnabled ? 'text-primary' : 'text-tertiary'}`}>Inactivity Timeout</p>
                    <p className="text-[9pt] text-tertiary mt-0.5">
                      {appLockOn
                        ? 'Lock to PIN screen after 20 min'
                        : 'Require password re-entry after 20 min'}
                    </p>
                  </div>
                  <ToggleSwitch checked={timeoutEnabled} />
                </div>
              )}

            </div>
          </div>

          {/* ── Session ──────────────────────────────────────────── */}
          {isAuthenticated && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Session</p>
              </div>
              <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">

                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                  onClick={() => {
                    const next = !activityTracking
                    setActivityTrackingEnabled(next)
                    setActivityTracking(next)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      const next = !activityTracking
                      setActivityTrackingEnabled(next)
                      setActivityTracking(next)
                    }
                  }}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${activityTracking ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                    <Activity size={18} className={activityTracking ? 'text-themeblue2' : 'text-tertiary'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${activityTracking ? 'text-primary' : 'text-tertiary'}`}>Activity Tracking</p>
                    <p className="text-[9pt] text-tertiary mt-0.5">Background heartbeat keeps your account active and powers session tracking. Disabling may lead to account hibernation after 90 days.</p>
                  </div>
                  <ToggleSwitch checked={activityTracking} />
                </div>

                {onNavigateToDevices && (
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
                    onClick={onNavigateToDevices}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToDevices() } }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                      <Smartphone size={18} className="text-tertiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary">Sessions & Devices</p>
                      <p className="text-[9pt] text-tertiary mt-0.5">View and manage registered devices</p>
                    </div>
                    <ChevronRight size={16} className="text-tertiary shrink-0" />
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── Permissions ──────────────────────────────────────── */}
          {(cameraPermission !== 'unsupported' || locationPermission !== 'unsupported') && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Permissions</p>
              </div>
              <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">

                {cameraPermission !== 'unsupported' && (() => {
                  const granted = cameraPermission === 'granted'
                  const denied = cameraPermission === 'denied'
                  return (
                    <div
                      className={`flex items-center gap-3 px-4 py-3.5 transition-all ${cameraPermission === 'prompt' ? 'cursor-pointer active:scale-95 hover:bg-themeblue2/5' : ''}`}
                      onClick={cameraPermission === 'prompt' ? handleRequestCamera : undefined}
                      role={cameraPermission === 'prompt' ? 'button' : undefined}
                      tabIndex={cameraPermission === 'prompt' ? 0 : undefined}
                      onKeyDown={cameraPermission === 'prompt' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRequestCamera() } } : undefined}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${granted ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                        <Camera size={18} className={granted ? 'text-themeblue2' : 'text-tertiary'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${granted ? 'text-primary' : 'text-tertiary'}`}>Camera</p>
                        <p className="text-[9pt] text-tertiary mt-0.5">
                          {granted ? 'Allowed — used for QR scanning and property identification'
                            : denied ? 'Blocked — enable in your browser or OS settings'
                            : 'Tap to allow camera access'}
                        </p>
                      </div>
                      <ToggleSwitch checked={granted} />
                    </div>
                  )
                })()}

                {locationPermission !== 'unsupported' && (() => {
                  const granted = locationPermission === 'granted'
                  const denied = locationPermission === 'denied'
                  return (
                    <div
                      className={`flex items-center gap-3 px-4 py-3.5 transition-all ${locationPermission === 'prompt' ? 'cursor-pointer active:scale-95 hover:bg-themeblue2/5' : ''}`}
                      onClick={locationPermission === 'prompt' ? handleRequestLocation : undefined}
                      role={locationPermission === 'prompt' ? 'button' : undefined}
                      tabIndex={locationPermission === 'prompt' ? 0 : undefined}
                      onKeyDown={locationPermission === 'prompt' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRequestLocation() } } : undefined}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${granted ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
                        <MapPin size={18} className={granted ? 'text-themeblue2' : 'text-tertiary'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${granted ? 'text-primary' : 'text-tertiary'}`}>Location</p>
                        <p className="text-[9pt] text-tertiary mt-0.5">
                          {granted ? 'Allowed — used for field position tracking on missions'
                            : denied ? 'Blocked — enable in your browser or OS settings'
                            : 'Tap to allow location access'}
                        </p>
                      </div>
                      <ToggleSwitch checked={granted} />
                    </div>
                  )
                })()}

              </div>
            </div>
          )}

        </div>
      </div>
    )
  }

  // PIN entry views (set, confirm, verify, change)
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col items-center px-4 py-3 md:p-5">
        <div className="w-[220px]">
          <PinKeypad
            onSubmit={handleSubmit}
            label={viewLabels[view] || ''}
            error={error}
            disabled={lockout.isLockedOut}
            lockoutMessage={lockout.isLockedOut ? `Locked for ${lockout.remainingSeconds}s` : undefined}
          />
        </div>

        {/* Cancel link */}
        <button
          onClick={() => { resetState(); setView('status') }}
          className="mt-5 text-[10pt] text-tertiary hover:text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
