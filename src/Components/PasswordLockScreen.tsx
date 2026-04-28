import { useState, useCallback, useEffect, useRef } from 'react'
import { Lock, Lightbulb, X, Check, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { verifyPasswordLocally, storePasswordHash } from '../lib/authService'
import { deriveAndStoreBackupKey } from '../lib/signal/backupService'
import { ensureVaultExists, deriveAndCacheVaultKey, setVaultKeyReady } from '../lib/signal/vaultDevice'
import { PasswordInput } from './FormInputs'
import { ErrorDisplay } from './ErrorDisplay'

interface PasswordLockScreenProps {
  onUnlock: () => void
  email: string
  reason?: 'inactivity' | 'initial' | 'session-expired'
}

export const PasswordLockScreen = ({ onUnlock, email, reason = 'inactivity' }: PasswordLockScreenProps) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Lockout state (mirrors PIN pattern: 5 failures → 30s escalating, cap 300s)
  const [failures, setFailures] = useState(0)
  const [lockoutUntil, setLockoutUntil] = useState(0)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Lockout countdown
  useEffect(() => {
    if (lockoutUntil <= Date.now()) {
      setLockoutRemaining(0)
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      return
    }
    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockoutRemaining(0)
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      } else {
        setLockoutRemaining(remaining)
      }
    }
    tick()
    lockoutTimerRef.current = setInterval(tick, 1000)
    return () => { if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current) }
  }, [lockoutUntil])

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const recordFailure = useCallback(() => {
    setFailures(prev => {
      const next = prev + 1
      if (next >= 5) {
        const tier = Math.floor((next - 5) / 5)
        const cooldown = Math.min(30 * Math.pow(2, tier), 300)
        setLockoutUntil(Date.now() + cooldown * 1000)
      }
      return next
    })
  }, [])

  const isLockedOut = lockoutRemaining > 0

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || submitting || isLockedOut) return

    setError(null)
    setSubmitting(true)

    try {
      // Online-first: try Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (!authError) {
        // Success — update local hash for future offline use
        storePasswordHash(password).catch(() => { })
        deriveAndStoreBackupKey(password, authData.user?.id ?? '').catch(() => { })
        // Re-cache vault wrapping key (cleared on page reload) so processVaultMessages
        // can run after the SIGNED_IN event fires from this re-auth.
        const uid = authData.user?.id ?? ''
        if (uid) {
          const vaultKeyP = ensureVaultExists(uid, password)
            .then(() => deriveAndCacheVaultKey(password, uid))
            .catch(() => {})
          setVaultKeyReady(vaultKeyP)
        }
        setFailures(0)
        onUnlock()
        return
      }

      // Check if it's a network error (offline fallback)
      const isNetworkError = !navigator.onLine ||
        authError.message?.toLowerCase().includes('fetch') ||
        authError.message?.toLowerCase().includes('network') ||
        authError.message?.toLowerCase().includes('failed to fetch')

      if (isNetworkError) {
        // Offline fallback: local hash verification
        const localValid = await verifyPasswordLocally(password)
        if (localValid) {
          setFailures(0)
          onUnlock()
          return
        }
        setError('Incorrect password (verified offline)')
        recordFailure()
      } else {
        // Online but wrong password
        setError('Incorrect password')
        recordFailure()
      }
    } catch {
      // Unexpected error — try offline fallback
      try {
        const localValid = await verifyPasswordLocally(password)
        if (localValid) {
          setFailures(0)
          onUnlock()
          return
        }
      } catch { /* ignore */ }
      setError('Unable to verify. Please try again.')
      recordFailure()
    } finally {
      setSubmitting(false)
      setPassword('')
    }
  }, [password, submitting, isLockedOut, email, onUnlock, recordFailure])

  const handleForgotPassword = useCallback(async () => {
    if (resetSent || !isOnline) return
    try {
      await supabase.auth.resetPasswordForEmail(email)
      setResetSent(true)
    } catch {
      setError('Could not send reset email. Try again later.')
    }
  }, [email, resetSent, isOnline])

  return (
    <div
      className="fixed inset-0 z-30 bg-themewhite overflow-y-auto select-none"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-4">
            <Lock size={26} className="text-themeblue2" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-wide">ADTMC</h1>
          <p className="text-sm text-tertiary mt-1 text-center">
            {reason === 'initial'
              ? 'Enter your password to continue'
              : reason === 'session-expired'
              ? 'Your session has expired. Re-enter your password to continue.'
              : 'Session locked due to inactivity'}
          </p>
        </div>

        {/* Account */}
        <div className="mb-3 px-1">
          <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Account</p>
          <p className="text-sm text-primary mt-0.5 truncate">{email}</p>
        </div>

        {/* Error */}
        <ErrorDisplay message={error} centered />

        {/* Lockout */}
        {isLockedOut && (
          <div className="mb-4 p-3 rounded-lg bg-themeyellow/10 border border-themeyellow/20 text-primary text-sm text-center">
            Too many attempts. Try again in {lockoutRemaining}s
          </div>
        )}

        {/* Reset sent confirmation */}
        {resetSent && (
          <div className="mb-4 p-3 rounded-lg bg-themegreen/10 border border-themegreen/20 text-themegreen text-sm text-center">
            Password reset email sent. Check your inbox.
          </div>
        )}

        {/* Password form */}
        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Password"
              autoComplete="current-password"
              disabled={isLockedOut}
              inputRef={inputRef}
            />
            <div className={`flex items-center justify-end gap-2 px-3 overflow-hidden transition-all duration-300 ease-out ${password.trim() && !isLockedOut ? 'max-h-14 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'
            }`}>
              <button
                type="button"
                onClick={() => setPassword('')}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
              <button
                type="submit"
                disabled={submitting || isLockedOut}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
              </button>
            </div>
          </div>
        </form>

        {/* Forgot password */}
        {isOnline && !resetSent && (
          <button
            onClick={handleForgotPassword}
            className="w-full mt-3 text-[10pt] text-themeblue2 hover:text-themeblue2/80 transition-colors text-center"
          >
            Forgot Password?
          </button>
        )}

        {/* Tip banner — only shown for inactivity/initial lock, not session-expired */}
        {reason !== 'session-expired' && (
          <div className="mt-8 flex items-start gap-2.5 p-3 rounded-lg bg-themeblue2/5 border border-themeblue2/10">
            <Lightbulb size={16} className="text-themeblue2 shrink-0 mt-0.5" />
            <p className="text-[10pt] text-tertiary leading-relaxed">
              <span className="font-medium text-primary">Tip:</span> Enable App Lock in Settings &gt; Security for quicker re-entry with a PIN.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
