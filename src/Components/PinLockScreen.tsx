import { useState, useCallback, useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import { PinKeypad } from '@/Components/primitives/PinKeypad'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { DeviceLinkQrView } from './DeviceLinkQrView'
import { FORGOT_PREFILL_KEY } from './LoginScreen'
import { useAuthStore } from '../stores/useAuthStore'
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
  /** Account on this device, for the escape hatches. Absent for a local-only lock. */
  email?: string
}

export const PinLockScreen = ({ onUnlock, email }: PinLockScreenProps) => {
  const { lockout, setLockout, error, setError } = usePinLockoutTimer()
  const [biometricReady, setBiometricReady] = useState(false)
  const biometricAttempted = useRef(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [showSwitch, setShowSwitch] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const signOut = useAuthStore(s => s.signOut)
  const isPasswordRecovery = useAuthStore(s => s.isPasswordRecovery)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

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

  const handleForgotPassword = useCallback(() => {
    if (!isOnline || !email || isPasswordRecovery) return
    // Same handoff PasswordLockScreen uses: stash the email and sign out so
    // LoginScreen's reset flow takes over.
    try { sessionStorage.setItem(FORGOT_PREFILL_KEY, email) } catch { /* ignore */ }
    signOut()
  }, [email, isOnline, isPasswordRecovery, signOut])

  const handleSwitchUser = useCallback(async () => {
    setSwitching(true)
    try {
      await signOut()
    } catch {
      setSwitching(false)
      setShowSwitch(false)
    }
  }, [signOut])

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
        <p className="text-[10pt] text-themeredred">Incorrect password</p>
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
    <div className="fixed inset-0 z-30 bg-themewhite overflow-y-auto select-none"
         style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
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

        {/* Escapes. Without these a user who has forgotten both the PIN and the
            password has no exit from this screen at all — the permanent lock asks
            for the one credential they don't have. The device link is the only
            lane that needs neither. */}
        {showLink ? (
          <div className="mt-6">
            <DeviceLinkQrView />
            <button
              onClick={() => setShowLink(false)}
              className="w-full mt-2 text-[10pt] text-tertiary hover:text-secondary transition-colors text-center"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {isOnline && email && !isPasswordRecovery && (
              <button
                onClick={handleForgotPassword}
                className="w-full text-[10pt] text-themeblue2 hover:text-themeblue2/80 transition-colors text-center"
              >
                Forgot password?
              </button>
            )}
            <button
              onClick={() => setShowLink(true)}
              className="w-full text-[10pt] text-themeblue2 hover:text-themeblue2/80 transition-colors text-center"
            >
              Link this device from another device
            </button>
            <button
              onClick={() => setShowSwitch(true)}
              className="w-full text-[10pt] text-tertiary hover:text-secondary transition-colors text-center"
            >
              Sign in as a different user
            </button>
          </div>
        )}
      </div>
      </div>

      <ConfirmDialog
        visible={showSwitch}
        title="Sign in as a different user?"
        subtitle="Signs you out on this device and returns to the login screen. Your conversations are backed up and restored on next login."
        confirmLabel="Sign Out"
        variant="danger"
        processing={switching}
        onConfirm={handleSwitchUser}
        onCancel={() => setShowSwitch(false)}
      />
    </div>
  )
}
