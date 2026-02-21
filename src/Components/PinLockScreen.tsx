import { useState, useCallback, useEffect, useRef } from 'react'
import { Lock, Delete, ScanFace } from 'lucide-react'
import {
  verifyPin,
  setSessionUnlocked,
  checkLockout,
  recordFailedAttempt,
  resetLockout,
  clearPinPermanentLock,
} from '../lib/pinService'
import { verifyPasswordLocally } from '../lib/authService'
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  verifyBiometric,
} from '../lib/biometricService'

interface PinLockScreenProps {
  onUnlock: () => void
}

export const PinLockScreen = ({ onUnlock }: PinLockScreenProps) => {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [lockout, setLockout] = useState(checkLockout())
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [biometricReady, setBiometricReady] = useState(false)
  const biometricAttempted = useRef(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)

  // Check biometric availability on mount
  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!isBiometricEnrolled()) return
      const available = await isBiometricAvailable()
      if (!cancelled && available) setBiometricReady(true)
    }
    check()
    return () => { cancelled = true }
  }, [])

  // Auto-trigger biometric on mount (requires user gesture on some browsers,
  // but iOS standalone PWAs allow it on page load for platform authenticators)
  useEffect(() => {
    if (!biometricReady || biometricAttempted.current) return
    biometricAttempted.current = true
    handleBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricReady])

  // Countdown timer for lockout (skip for permanent lock — no countdown)
  useEffect(() => {
    if (!lockout.isLockedOut || lockout.isPermanentlyLocked) {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      return
    }

    lockoutTimerRef.current = setInterval(() => {
      const state = checkLockout()
      setLockout(state)
      if (!state.isLockedOut) {
        setError(false)
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      }
    }, 1000)

    return () => {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    }
  }, [lockout.isLockedOut, lockout.isPermanentlyLocked])

  const handlePasswordUnlock = useCallback(async () => {
    if (!passwordInput) return
    const valid = await verifyPasswordLocally(passwordInput)
    if (valid) {
      clearPinPermanentLock()
      resetLockout()
      setSessionUnlocked()
      onUnlock()
    } else {
      setPasswordError(true)
      setPasswordInput('')
    }
  }, [passwordInput, onUnlock])

  const handleBiometric = useCallback(async () => {
    try {
      const success = await verifyBiometric()
      if (success) {
        resetLockout()
        setSessionUnlocked()
        onUnlock()
      }
    } catch {
      // User cancelled or biometric failed — fall back to PIN
    }
  }, [onUnlock])

  const handleSubmit = useCallback(async (pin: string) => {
    const valid = await verifyPin(pin)
    if (valid) {
      resetLockout()
      setSessionUnlocked()
      onUnlock()
    } else {
      const state = recordFailedAttempt()
      setLockout(state)
      setError(true)
      setShaking(true)
      setTimeout(() => {
        setShaking(false)
        setDigits('')
      }, 400)
    }
  }, [onUnlock])

  const handleDigitPress = useCallback((digit: string) => {
    if (lockout.isLockedOut) return
    setError(false)

    setDigits(prev => {
      const next = prev + digit
      if (next.length === 4) {
        // Auto-submit on 4th digit
        handleSubmit(next)
      }
      return next.length <= 4 ? next : prev
    })
  }, [lockout.isLockedOut, handleSubmit])

  const handleBackspace = useCallback(() => {
    if (lockout.isLockedOut) return
    setError(false)
    setDigits(prev => prev.slice(0, -1))
  }, [lockout.isLockedOut])

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitPress(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDigitPress, handleBackspace])

  const keypadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [biometricReady ? 'bio' : '', '0', 'back'],
  ]

  return (
    <div className="fixed inset-0 z-[100] bg-themewhite flex flex-col items-center justify-center select-none"
         style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-4">
          <Lock size={26} className="text-themeblue2" />
        </div>
        <h1 className="text-xl font-bold text-primary tracking-wide">ADTMC</h1>
        <p className="text-sm text-tertiary mt-1">
          {lockout.isPermanentlyLocked
            ? 'PIN locked. Enter password to unlock.'
            : lockout.isLockedOut
              ? `Too many attempts. Try again in ${lockout.remainingSeconds}s`
              : error
                ? 'Incorrect PIN'
                : 'Enter your PIN'}
        </p>
      </div>

      {/* Dot indicators */}
      <div className={`flex gap-4 mb-10 ${shaking ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
              i < digits.length
                ? error ? 'bg-themeredred scale-110' : 'bg-themeblue2 scale-110'
                : 'bg-themegray1/50'
            }`}
          />
        ))}
      </div>

      {/* Password unlock for permanent lock */}
      {lockout.isPermanentlyLocked && (
        <div className="flex flex-col items-center gap-3 mb-6 w-[270px]">
          <input
            type="password"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
            onKeyDown={e => e.key === 'Enter' && handlePasswordUnlock()}
            placeholder="Account password"
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-themewhite2 text-primary text-center text-sm border border-themegray1/30 focus:outline-none focus:border-themeblue2"
          />
          {passwordError && (
            <p className="text-xs text-themeredred">Incorrect password</p>
          )}
          <button
            onClick={handlePasswordUnlock}
            disabled={!passwordInput}
            className="w-full py-3 rounded-lg bg-themeblue2 text-white text-sm font-medium disabled:opacity-40"
          >
            Unlock
          </button>
        </div>
      )}

      {/* Numeric keypad */}
      <div className={`grid grid-cols-3 gap-x-6 gap-y-3 w-[270px] ${lockout.isPermanentlyLocked ? 'opacity-30 pointer-events-none' : ''}`}>
        {keypadButtons.flat().map((key, idx) => {
          if (key === '') {
            return <div key={idx} />
          }
          if (key === 'bio') {
            return (
              <button
                key={idx}
                onClick={handleBiometric}
                disabled={lockout.isLockedOut}
                className="w-[74px] h-[74px] rounded-full flex items-center justify-center
                           active:bg-themeblue2/20 transition-colors disabled:opacity-30"
              >
                <ScanFace size={26} className="text-themeblue2" />
              </button>
            )
          }
          if (key === 'back') {
            return (
              <button
                key={idx}
                onClick={handleBackspace}
                disabled={lockout.isLockedOut}
                className="w-[74px] h-[74px] rounded-full flex items-center justify-center
                           active:bg-themegray1/20 transition-colors disabled:opacity-30"
              >
                <Delete size={24} className="text-primary" />
              </button>
            )
          }
          return (
            <button
              key={idx}
              onClick={() => handleDigitPress(key)}
              disabled={lockout.isLockedOut}
              className="w-[74px] h-[74px] rounded-full bg-themewhite2 flex items-center justify-center
                         text-2xl font-medium text-primary
                         active:bg-themegray1/40 transition-colors disabled:opacity-30"
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
