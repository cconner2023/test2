/**
 * SessionReauthScreen — shown when localSession exists but Supabase session is dead.
 *
 * Orchestrates credential verification in priority order:
 *   1. Biometric (if enrolled) → verifyBiometric() + device-restore for JWT
 *   2. PIN (if enabled)        → pin-login edge function → verifyOtp
 *   3. Password (always)       → signInWithPassword
 *
 * All paths produce a live Supabase session. On success, onAuthStateChange fires,
 * user is set in the store, and LockGate unmounts this screen automatically.
 *
 * "Use password instead" escape is always available from bio/PIN paths.
 * "Forgot password?" is available in PIN and password paths.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  isPinEnabled,
  verifyPin,
  recordFailedAttempt,
  resetLockout,
  setSessionUnlocked,
} from '../lib/pinService'
import { usePinLockoutTimer } from '../Hooks/usePinLockoutTimer'
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  verifyBiometric,
} from '../lib/biometricService'
import { tryDeviceRestore } from '../lib/sessionRestore'
import { useAuthStore } from '../stores/useAuthStore'
import { PinKeypad } from './PinKeypad'
import { PasswordLockScreen } from './PasswordLockScreen'
import { LoadingSpinner } from './LoadingSpinner'

type Phase =
  | 'restoring'   // silent restore in progress
  | 'bio'         // biometric prompt
  | 'pin'         // PIN keypad
  | 'password'    // password form

interface SessionReauthScreenProps {
  email: string
}

export function SessionReauthScreen({ email }: SessionReauthScreenProps) {
  const localSession = useAuthStore(s => s.localSession)
  const [phase, setPhase] = useState<Phase>('restoring')
  const [bioReady, setBioReady] = useState(false)
  const [bioError, setBioError] = useState<string | null>(null)
  const biometricAttempted = useRef(false)
  const { lockout, setLockout, error: pinError, setError: setPinError } = usePinLockoutTimer()

  // ── Phase resolution after silent restore fails ──────────────────────────
  const resolvePhase = useCallback(async () => {
    if (isBiometricEnrolled()) {
      const available = await isBiometricAvailable()
      if (available) {
        setBioReady(true)
        setPhase('bio')
        return
      }
    }
    setPhase(isPinEnabled() ? 'pin' : 'password')
  }, [])

  // Silent restore runs inside SessionReauthScreen so the overlay can show a
  // spinner while T1/T2 run, then transition to the right credential UI.
  useEffect(() => {
    if (!localSession) {
      resolvePhase()
      return
    }
    // T1: Supabase refreshSession — the store already tried this on SIGNED_OUT,
    // but try again in case the token recovered (race with IDB write).
    // T2: device-restore — store already tried, but try once more here since
    // some time has passed and the network may have recovered.
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.refreshSession()
        if (!cancelled && data.session) return // onAuthStateChange fires → overlay closes
      } catch { /* ignore */ }

      try {
        const ok = await tryDeviceRestore(localSession)
        if (!cancelled && ok) return // onAuthStateChange fires → overlay closes
      } catch { /* ignore */ }

      if (!cancelled) resolvePhase()
    })()
    return () => { cancelled = true }
  // resolvePhase is stable (useCallback, no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Biometric ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'bio' || !bioReady || biometricAttempted.current) return
    biometricAttempted.current = true
    handleBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bioReady])

  const handleBiometric = useCallback(async () => {
    setBioError(null)
    try {
      const success = await verifyBiometric()
      if (!success) {
        setBioError('Biometric verification failed. Try again or use password.')
        return
      }
      // Biometric confirms user presence — use device-restore to get a JWT
      if (localSession) {
        const ok = await tryDeviceRestore(localSession)
        if (ok) return // onAuthStateChange fires → overlay closes
      }
      // Device window expired — biometric alone can't issue a JWT; need password
      setBioError(null)
      setPhase('password')
    } catch {
      setBioError('Biometric unavailable. Please use your password.')
      setPhase('password')
    }
  }, [localSession])

  // ── PIN ───────────────────────────────────────────────────────────────────
  const handlePin = useCallback(async (pin: string) => {
    setPinError('')

    // First verify locally to avoid burning a server call on a wrong PIN
    const localValid = await verifyPin(pin)
    if (!localValid) {
      const state = recordFailedAttempt()
      setLockout(state)
      setPinError('Incorrect PIN')
      return
    }

    // PIN correct — call pin-login to exchange for a Supabase magic-link token
    try {
      const { data, error } = await supabase.functions.invoke('pin-login', {
        body: { email, pin },
      })
      if (error || !data?.token) {
        setPinError('Authentication failed. Try again.')
        return
      }
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: data.token,
        type: 'magiclink',
      })
      if (otpError) {
        setPinError('Session restore failed. Please use your password.')
        return
      }
      // Success — onAuthStateChange fires, user set, overlay closes
      resetLockout()
      setSessionUnlocked()
    } catch {
      setPinError('Network error. Please try again.')
    }
  }, [email, setPinError, setLockout])

  const lockoutMessage = lockout.isPermanentlyLocked
    ? 'PIN locked. Use password to continue.'
    : lockout.isLockedOut
    ? `Too many attempts. Try again in ${lockout.remainingSeconds}s`
    : undefined

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'restoring') {
    return (
      <div className="fixed inset-0 z-30 bg-themewhite flex flex-col items-center justify-center gap-3"
           style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
        <LoadingSpinner className="text-themeblue2/50" />
        <p className="text-sm text-tertiary">Restoring session…</p>
      </div>
    )
  }

  if (phase === 'password') {
    return (
      <PasswordLockScreen
        email={email}
        reason="session-expired"
        onUnlock={() => {
          // onAuthStateChange fires on successful signInWithPassword and sets user —
          // LockGate will unmount this overlay automatically. No-op needed here.
        }}
      />
    )
  }

  // ── Bio or PIN shell ──────────────────────────────────────────────────────
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
          <p className="text-sm text-tertiary mt-1 text-center">
            {phase === 'bio'
              ? 'Verify your identity to restore your session'
              : 'Enter your PIN to restore your session'}
          </p>
        </div>

        {/* Email */}
        <div className="mb-4 w-full max-w-[270px]">
          <span className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Account</span>
          <p className="text-sm text-primary mt-0.5 truncate">{email}</p>
        </div>

        {phase === 'bio' && (
          <div className="w-[270px] flex flex-col items-center gap-4">
            {bioError && (
              <p className="text-[10pt] text-themeredred text-center">{bioError}</p>
            )}
            <button
              onClick={handleBiometric}
              className="w-full py-3 rounded-lg bg-themeblue3 text-white font-medium hover:bg-themeblue3/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => setPhase('password')}
              className="text-[10pt] text-themeblue2 hover:text-themeblue2/80 transition-colors"
            >
              Use password instead
            </button>
          </div>
        )}

        {phase === 'pin' && (
          <div className="w-[270px]">
            <PinKeypad
              onSubmit={handlePin}
              label="Enter your PIN"
              error={pinError}
              disabled={lockout.isLockedOut || lockout.isPermanentlyLocked}
              lockoutMessage={lockoutMessage}
              extraContent={
                <button
                  onClick={() => setPhase('password')}
                  className="text-[10pt] text-themeblue2 hover:text-themeblue2/80 transition-colors w-full text-center mt-1"
                >
                  Use password instead
                </button>
              }
            />
          </div>
        )}

      </div>
    </div>
  )
}
