import { useState, useCallback, useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import { PinKeypad } from './PinKeypad'
import {
  verifyPin,
  setSessionUnlocked,
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
import { usePinLockoutTimer } from '../Hooks/usePinLockoutTimer'

interface PinLockScreenProps {
  onUnlock: () => void
}

export const PinLockScreen = ({ onUnlock }: PinLockScreenProps) => {
  const { lockout, setLockout, error, setError } = usePinLockoutTimer()
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

  // Auto-trigger biometric on mount
  useEffect(() => {
    if (!biometricReady || biometricAttempted.current) return
    biometricAttempted.current = true
    handleBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricReady])

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
    setError('')
    const valid = await verifyPin(pin)
    if (valid) {
      resetLockout()
      setSessionUnlocked()
      onUnlock()
    } else {
      const state = recordFailedAttempt()
      setLockout(state)
      setError('Incorrect PIN')
    }
  }, [onUnlock, setError, setLockout])

  const lockoutMessage = lockout.isPermanentlyLocked
    ? 'PIN locked. Enter password to unlock.'
    : lockout.isLockedOut
      ? `Too many attempts. Try again in ${lockout.remainingSeconds}s`
      : undefined

  const passwordForm = lockout.isPermanentlyLocked ? (
    <div className="flex flex-col items-center gap-3 mb-6 w-full">
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
        className="w-full py-3 rounded-lg bg-themeblue3 text-white text-sm font-medium disabled:opacity-40"
      >
        Unlock
      </button>
    </div>
  ) : undefined

  return (
    <div className="fixed inset-0 z-[100] bg-themewhite overflow-y-auto select-none"
         style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-6">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-4">
          <Lock size={26} className="text-themeblue2" />
        </div>
        <h1 className="text-xl font-bold text-primary tracking-wide">ADTMC</h1>
      </div>

      {/* PIN Keypad */}
      <div className="w-[270px]">
        <PinKeypad
          onSubmit={handleSubmit}
          label="Enter your PIN"
          error={error}
          disabled={lockout.isLockedOut || lockout.isPermanentlyLocked}
          lockoutMessage={lockoutMessage}
          biometricReady={biometricReady}
          onBiometric={handleBiometric}
          extraContent={passwordForm}
        />
      </div>
      </div>
    </div>
  )
}
