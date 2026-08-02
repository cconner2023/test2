import { useState, useCallback, useEffect } from 'react'
import { Lock, KeyRound, ScanFace, Timer, Activity, Camera, MapPin, ChevronRight } from 'lucide-react'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { ToggleSwitch } from './ToggleSwitch'
import { SettingsRow, SettingsToggleRow } from './SettingsToggleRow'
import { PinKeypad } from '@/Components/primitives/PinKeypad'
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
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'

type PinView = 'status' | 'set-new' | 'confirm-new' | 'verify-current' | 'change-new' | 'change-confirm'
type PendingAction = 'change' | 'remove' | null

const TIMEOUT_20_MIN = 20 * 60 * 1000

export const PinSetupPanel = () => {
  const [view, setView] = useState<PinView>('status')
  const [pinEnabled, setPinEnabled] = useState(isPinEnabled())
  const [appLockOn, setAppLockOn] = useState(isAppLockEnabled)
  const [timeoutMs, setTimeoutMs] = useState(getInactivityTimeoutMs)
  const { isAuthenticated } = useAuth()
  const [firstPin, setFirstPin] = useState('')
  const { lockout, setLockout, error, setError } = usePinLockoutTimer()
  const [success, setSuccess] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

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
            setPinEnabled(false)
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
  }, [view, firstPin, pendingAction, resetState, setError, setLockout])

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

    // App Lock is a behavior, independent of the PIN. Off→on / on→off, nothing
    // else. With a PIN it locks to the PIN screen; without one, the password.
    const handleAppLockToggle = () => {
      const next = !appLockOn
      setAppLockEnabled(next)
      setAppLockOn(next)
    }

    // PIN is a credential. Off→on collects a new PIN; on→off verifies, then
    // removes (same path as the explicit Remove PIN action row below).
    const handlePinToggle = () => {
      if (pinEnabled) {
        resetState(); setPendingAction('remove'); setView('verify-current')
      } else {
        resetState(); setView('set-new')
      }
    }

    return (
      <div className="h-full overflow-y-auto">
        <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">

          {success && <ErrorDisplay type="success" message={success} />}
          {error && <ErrorDisplay type="error" message={error} />}

          {/* ── Lock ─────────────────────────────────────────────── */}
          <div>
            <SectionHeader>Lock</SectionHeader>
            <SectionCard>

              {/* App Lock — the behavior: lock the instant you switch away */}
              {isAuthenticated && (
                <SettingsToggleRow
                  icon={Lock}
                  label="App Lock"
                  subtitle={appLockOn
                    ? (pinEnabled
                        ? 'Locks the instant you switch away — PIN to return'
                        : 'Locks the instant you switch away — password to return')
                    : 'Lock the app the moment you switch away'}
                  checked={appLockOn}
                  onChange={handleAppLockToggle}
                />
              )}

              {/* PIN — the credential */}
              {isAuthenticated && (
                <SettingsToggleRow
                  icon={KeyRound}
                  label="PIN"
                  subtitle="A 4-digit code for quicker unlocking than your password"
                  checked={pinEnabled}
                  onChange={handlePinToggle}
                  divided
                />
              )}

              {/* Change PIN — only relevant while a PIN exists. Removing a PIN is
                  the PIN toggle itself (off → verify → delete), so no separate row. */}
              {isAuthenticated && pinEnabled && (
                <SettingsRow
                  icon={KeyRound}
                  label="Change PIN"
                  indent
                  onClick={() => { resetState(); setPendingAction('change'); setView('verify-current') }}
                  trailing={<ChevronRight size={16} className="text-tertiary shrink-0" />}
                />
              )}

              {/* Face ID / Touch ID — its own unlock credential, independent of the
                  PIN. With or without a PIN it unlocks App Lock; password is the
                  fallback. */}
              {isAuthenticated && bioAvailable && (
                <SettingsToggleRow
                  icon={ScanFace}
                  label={bioLoading ? 'Setting up...' : 'Face ID / Touch ID'}
                  subtitle="Unlock with your face or fingerprint"
                  checked={bioEnrolled}
                  onChange={handleBiometricToggle}
                  disabled={bioLoading}
                  divided
                />
              )}

              {isAuthenticated && (
                <SettingsToggleRow
                  icon={Timer}
                  label="Inactivity Timeout"
                  subtitle={pinEnabled
                    ? 'Lock to PIN screen after 20 min idle'
                    : 'Require password re-entry after 20 min idle'}
                  checked={timeoutEnabled}
                  onChange={() => {
                    const next = timeoutEnabled ? 0 : TIMEOUT_20_MIN
                    setTimeoutMs(next)
                    setInactivityTimeoutMs(next)
                  }}
                  divided
                />
              )}

            </SectionCard>
          </div>

          {/* ── Permissions ──────────────────────────────────────── */}
          {(isAuthenticated || cameraPermission !== 'unsupported' || locationPermission !== 'unsupported') && (
            <div>
              <SectionHeader>Permissions</SectionHeader>
              <SectionCard>

                {/* Activity Tracking — a permission: background heartbeat. */}
                {isAuthenticated && (
                  <SettingsToggleRow
                    icon={Activity}
                    label="Activity Tracking"
                    subtitle="Background heartbeat keeps your account active and powers session tracking. Disabling may lead to account hibernation after 90 days."
                    checked={activityTracking}
                    onChange={() => {
                      const next = !activityTracking
                      setActivityTrackingEnabled(next)
                      setActivityTracking(next)
                    }}
                  />
                )}

                {/* Camera / Location — granted and denied are terminal states the app
                    cannot change; only 'prompt' is actionable, so only 'prompt' is a
                    button. The toggle reads as status in the other two. */}
                {cameraPermission !== 'unsupported' && (
                  <SettingsRow
                    icon={Camera}
                    label="Camera"
                    subtitle={cameraPermission === 'granted' ? 'Allowed — used for QR scanning and property identification'
                      : cameraPermission === 'denied' ? 'Blocked — enable in your browser or OS settings'
                      : 'Tap to allow camera access'}
                    on={cameraPermission === 'granted'}
                    onClick={cameraPermission === 'prompt' ? handleRequestCamera : undefined}
                    divided={isAuthenticated}
                    trailing={<ToggleSwitch checked={cameraPermission === 'granted'} />}
                  />
                )}

                {locationPermission !== 'unsupported' && (
                  <SettingsRow
                    icon={MapPin}
                    label="Location"
                    subtitle={locationPermission === 'granted' ? 'Allowed — used for field position tracking on missions'
                      : locationPermission === 'denied' ? 'Blocked — enable in your browser or OS settings'
                      : 'Tap to allow location access'}
                    on={locationPermission === 'granted'}
                    onClick={locationPermission === 'prompt' ? handleRequestLocation : undefined}
                    divided={isAuthenticated || cameraPermission !== 'unsupported'}
                    trailing={<ToggleSwitch checked={locationPermission === 'granted'} />}
                  />
                )}

              </SectionCard>
            </div>
          )}

        </div>
      </div>
    )
  }

  // PIN entry views (set, confirm, verify, change)
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col items-center px-4 pb-3 md:px-5 md:pb-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
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
