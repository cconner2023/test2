import { useState, useCallback, useEffect } from 'react'
import { Lock, KeyRound, Trash2, ScanFace, Timer, Activity } from 'lucide-react'
import { StatusBanner } from './StatusBanner'
import { PinKeypad } from '../PinKeypad'
import { UI_TIMING } from '../../Utilities/constants'
import {
  isPinEnabled,
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

const TIMEOUT_OPTIONS = [
  { label: '20 minutes', value: 20 * 60 * 1000 },
  { label: 'Never', value: 0 },
]

export const PinSetupPanel = () => {
  const [view, setView] = useState<PinView>('status')
  const [pinEnabled, setPinEnabled] = useState(isPinEnabled())
  const [timeoutMs, setTimeoutMs] = useState(getInactivityTimeoutMs)
  const { isAuthenticated } = useAuth()
  const [firstPin, setFirstPin] = useState('')
  const { lockout, setLockout, error, setError } = usePinLockoutTimer()
  const [success, setSuccess] = useState('')
  const [pendingAction, setPendingAction] = useState<'change' | 'remove' | null>(null)

  // Activity tracking state
  const [activityTracking, setActivityTracking] = useState(isActivityTrackingEnabled)

  // Biometric state
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnrolled, setBioEnrolled] = useState(isBiometricEnrolled())
  const [bioLoading, setBioLoading] = useState(false)

  // Check biometric availability
  useEffect(() => {
    let cancelled = false
    async function check() {
      const available = await isBiometricAvailable()
      if (!cancelled) setBioAvailable(available)
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
        setSuccess('Face ID / Touch ID disabled')
        setTimeout(() => setSuccess(''), UI_TIMING.COPY_FEEDBACK)
      } else {
        const enrolled = await enrollBiometric()
        if (enrolled) {
          setBioEnrolled(true)
          setSuccess('Face ID / Touch ID enabled')
          setTimeout(() => setSuccess(''), UI_TIMING.COPY_FEEDBACK)
        } else {
          setError('Biometric setup was cancelled or failed')
          setTimeout(() => setError(''), UI_TIMING.SAVE_ERROR_DURATION)
        }
      }
    } finally {
      setBioLoading(false)
    }
  }, [bioEnrolled, setError])

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
          setError('PINs don\'t match')
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
            setBioEnrolled(false)
            setSuccess('PIN removed')
            setTimeout(() => { resetState(); setView('status') }, 1200)
          }
        } else {
          const state = recordFailedAttempt()
          setLockout(state)
          setError('Incorrect PIN')
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
          setError('PINs don\'t match')
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
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-3 md:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-themeblue2/10 flex items-center justify-center">
              <Lock size={20} className="text-themeblue2" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">App Lock</p>
              <p className="text-xs text-tertiary">
                {pinEnabled ? 'PIN lock is enabled' : 'Protect your app with a PIN'}
              </p>
            </div>
          </div>

          <p className="text-xs text-tertiary/70 mb-5 leading-relaxed">
            When enabled, a 4-digit PIN will be required each time you open the application.
            Your PIN persists across devices and protects cached notes.
          </p>

          {success && (
            <StatusBanner type="success" message={success} className="mb-4" />
          )}

          {error && (
            <StatusBanner type="error" message={error} className="mb-4" />
          )}

          {!pinEnabled ? (
            <button
              onClick={() => { resetState(); setView('set-new') }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-themeblue2/10
                         hover:bg-themeblue2/15 active:scale-[0.98] transition-all"
            >
              <KeyRound size={18} className="text-themeblue2" />
              <span className="text-sm font-medium text-themeblue2">Set Up PIN Lock</span>
            </button>
          ) : (
            <div className="space-y-2">
              {/* Biometric toggle — only show when PIN is enabled and device supports it */}
              {bioAvailable && (
                <button
                  onClick={handleBiometricToggle}
                  disabled={bioLoading}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all active:scale-[0.98] ${bioEnrolled
                    ? 'bg-themegreen/10 hover:bg-themegreen/15'
                    : 'bg-themeblue2/10 hover:bg-themeblue2/15'
                    } disabled:opacity-50`}
                >
                  <ScanFace size={18} className={bioEnrolled ? 'text-themegreen' : 'text-themeblue2'} />
                  <div className="flex-1 text-left">
                    <span className={`text-sm font-medium ${bioEnrolled ? 'text-themegreen' : 'text-themeblue2'}`}>
                      {bioLoading ? 'Setting up...' : bioEnrolled ? 'Face ID / Touch ID On' : 'Enable Face ID / Touch ID'}
                    </span>
                    <p className="text-[11px] text-tertiary/70 mt-0.5">
                      {bioEnrolled ? 'Tap to disable biometric unlock' : 'Use biometrics instead of PIN to unlock'}
                    </p>
                  </div>
                </button>
              )}

              <button
                onClick={() => { resetState(); setPendingAction('change'); setView('verify-current') }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-themeblue2/10
                           hover:bg-themeblue2/15 active:scale-[0.98] transition-all"
              >
                <KeyRound size={18} className="text-themeblue2" />
                <span className="text-sm font-medium text-themeblue2">Change PIN</span>
              </button>
              <button
                onClick={() => { resetState(); setPendingAction('remove'); setView('verify-current') }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-themeredred/10
                           hover:bg-themeredred/15 active:scale-[0.98] transition-all"
              >
                <Trash2 size={18} className="text-themeredred" />
                <span className="text-sm font-medium text-themeredred">Remove PIN</span>
              </button>
            </div>
          )}

          {/* Inactivity timeout picker — visible to all authenticated users */}
          {isAuthenticated && (
            <>
              <div className="border-t border-tertiary/10 mt-5 pt-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-themeblue2/10 flex items-center justify-center">
                    <Timer size={16} className="text-themeblue2" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">Inactivity Timeout</p>
                    <p className="text-[11px] text-tertiary/70">
                      {pinEnabled
                        ? 'Locks to PIN screen after inactivity'
                        : 'Requires password re-entry after inactivity'}
                    </p>
                  </div>
                </div>
                <select
                  value={timeoutMs}
                  onChange={(e) => {
                    const ms = Number(e.target.value)
                    setTimeoutMs(ms)
                    setInactivityTimeoutMs(ms)
                  }}
                  className="w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-sm
                             border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                             transition-colors appearance-none cursor-pointer"
                >
                  {TIMEOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Activity tracking toggle */}
              <div className="border-t border-tertiary/10 mt-5 pt-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-themeblue2/10 flex items-center justify-center">
                    <Activity size={16} className="text-themeblue2" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-primary">Activity Tracking</p>
                    <p className="text-[11px] text-tertiary/70">
                      Periodically record activity date/time when interacting with the server
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !activityTracking
                    setActivityTrackingEnabled(next)
                    setActivityTracking(next)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all active:scale-[0.98] ${activityTracking
                      ? 'bg-themegreen/10 hover:bg-themegreen/15'
                      : 'bg-tertiary/10 hover:bg-tertiary/15'
                    }`}
                >
                  <Activity size={18} className={activityTracking ? 'text-themegreen' : 'text-tertiary'} />
                  <div className="flex-1 text-left">
                    <span className={`text-sm font-medium ${activityTracking ? 'text-themegreen' : 'text-tertiary'}`}>
                      {activityTracking ? 'Activity Tracking On' : 'Activity Tracking Off'}
                    </span>
                    <p className="text-[11px] text-tertiary/70 mt-0.5">
                      {activityTracking
                        ? 'Your last-active timestamp is updated periodically when you interact with our server'
                        : 'Disabled. After ~90 days inactivity your account may be placed in hibernation status'}
                    </p>
                  </div>
                </button>
              </div>
            </>
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
          className="mt-5 text-xs text-tertiary hover:text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
