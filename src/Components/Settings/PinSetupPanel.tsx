import { useState, useCallback, useEffect, useRef } from 'react'
import { Lock, Delete, KeyRound, Trash2, ScanFace, ShieldX, Timer } from 'lucide-react'
import { StatusBanner } from './StatusBanner'
import { UI_TIMING } from '../../Utilities/constants'
import {
  isPinEnabled,
  savePin,
  removePin,
  verifyPin,
  checkLockout,
  recordFailedAttempt,
  resetLockout,
  getStoredPin,
  syncPinToCloud,
  clearPinFromCloud,
  getInactivityTimeoutMs,
  setInactivityTimeoutMs,
} from '../../lib/pinService'
import { useAuth } from '../../Hooks/useAuth'
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  enrollBiometric,
  removeBiometric,
} from '../../lib/biometricService'

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
  const [digits, setDigits] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [shaking, setShaking] = useState(false)
  const [lockout, setLockout] = useState(checkLockout())
  const [pendingAction, setPendingAction] = useState<'change' | 'remove' | null>(null)
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Lockout countdown
  useEffect(() => {
    if (!lockout.isLockedOut) {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      return
    }
    lockoutTimerRef.current = setInterval(() => {
      const state = checkLockout()
      setLockout(state)
      if (!state.isLockedOut && lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    }, 1000)
    return () => { if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current) }
  }, [lockout.isLockedOut])

  const resetState = useCallback(() => {
    setDigits('')
    setFirstPin('')
    setError('')
    setSuccess('')
    setShaking(false)
    setPendingAction(null)
  }, [])

  const triggerShake = useCallback(() => {
    setShaking(true)
    setTimeout(() => { setShaking(false); setDigits('') }, 400)
  }, [])

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
  }, [bioEnrolled])

  const handleSubmit = useCallback(async (pin: string) => {
    switch (view) {
      case 'set-new':
        setFirstPin(pin)
        setDigits('')
        setError('')
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
          triggerShake()
        }
        break

      case 'verify-current': {
        const valid = await verifyPin(pin)
        if (valid) {
          resetLockout()
          if (pendingAction === 'change') {
            setDigits('')
            setError('')
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
          setError(state.isLockedOut ? `Locked for ${state.remainingSeconds}s` : 'Incorrect PIN')
          triggerShake()
        }
        break
      }

      case 'change-new':
        setFirstPin(pin)
        setDigits('')
        setError('')
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
          triggerShake()
        }
        break
    }
  }, [view, firstPin, pendingAction, resetState, triggerShake])

  const handleDigitPress = useCallback((digit: string) => {
    if (lockout.isLockedOut) return
    setError('')
    setDigits(prev => {
      const next = prev + digit
      if (next.length === 4) handleSubmit(next)
      return next.length <= 4 ? next : prev
    })
  }, [lockout.isLockedOut, handleSubmit])

  const handleBackspace = useCallback(() => {
    if (lockout.isLockedOut) return
    setError('')
    setDigits(prev => prev.slice(0, -1))
  }, [lockout.isLockedOut])

  // Keyboard support
  useEffect(() => {
    if (view === 'status') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigitPress(e.key)
      else if (e.key === 'Backspace') handleBackspace()
      else if (e.key === 'Escape') { resetState(); setView('status') }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, handleDigitPress, handleBackspace, resetState])

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
        {/* Label */}
        <p className="text-sm font-medium text-primary mb-1">{viewLabels[view]}</p>
        {error && (
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldX size={14} className="text-themeredred" />
            <span className="text-xs text-themeredred">{error}</span>
          </div>
        )}
        {!error && <div className="h-5" />}

        {/* Dot indicators */}
        <div className={`flex gap-3 mb-6 ${shaking ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-150 ${i < digits.length
                ? error ? 'bg-themeredred scale-110' : 'bg-themeblue2 scale-110'
                : 'bg-themegray1/50'
                }`}
            />
          ))}
        </div>

        {/* Compact keypad */}
        <div className="grid grid-cols-3 gap-x-5 gap-y-2 w-[220px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key, idx) => {
            if (key === '') return <div key={idx} />
            if (key === 'back') {
              return (
                <button
                  key={idx}
                  onClick={handleBackspace}
                  disabled={lockout.isLockedOut}
                  className="w-[60px] h-[60px] rounded-full flex items-center justify-center
                             active:bg-themegray1/20 transition-colors disabled:opacity-30"
                >
                  <Delete size={20} className="text-primary" />
                </button>
              )
            }
            return (
              <button
                key={idx}
                onClick={() => handleDigitPress(key)}
                disabled={lockout.isLockedOut}
                className="w-[60px] h-[60px] rounded-full bg-themewhite2 flex items-center justify-center
                           text-xl font-medium text-primary
                           active:bg-themegray1/40 transition-colors disabled:opacity-30"
              >
                {key}
              </button>
            )
          })}
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
