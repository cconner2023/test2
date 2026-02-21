import { useState, useCallback, useEffect, useRef } from 'react'
import { Lock, Eye, EyeOff, Lightbulb } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { verifyPasswordLocally, storePasswordHash } from '../lib/authService'

interface PasswordLockScreenProps {
  onUnlock: () => void
  email: string
  reason?: 'inactivity' | 'initial'
}

export const PasswordLockScreen = ({ onUnlock, email, reason = 'inactivity' }: PasswordLockScreenProps) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (!authError) {
        // Success — update local hash for future offline use
        storePasswordHash(password).catch(() => {})
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
      className="fixed inset-0 z-[100] bg-themewhite flex flex-col items-center justify-center select-none px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-4">
            <Lock size={26} className="text-themeblue2" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-wide">ADTMC</h1>
          <p className="text-sm text-tertiary mt-1 text-center">
            {reason === 'initial' ? 'Enter your password to continue' : 'Session locked due to inactivity'}
          </p>
        </div>

        {/* Email display */}
        <div className="mb-4">
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Account</span>
          <p className="text-sm text-primary mt-0.5 truncate">{email}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred text-sm text-center">
            {error}
          </div>
        )}

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
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Password</span>
            <div className="relative mt-1">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLockedOut}
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-themewhite2 text-primary text-base
                           border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                           transition-colors placeholder:text-tertiary/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary/40 hover:text-tertiary/70 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={!password.trim() || submitting || isLockedOut}
            className="w-full px-4 py-3 rounded-lg bg-themeblue2 text-white font-medium
                       hover:bg-themeblue2/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        {/* Forgot password */}
        {isOnline && !resetSent && (
          <button
            onClick={handleForgotPassword}
            className="w-full mt-3 text-xs text-themeblue2 hover:text-themeblue2/80 transition-colors text-center"
          >
            Forgot Password?
          </button>
        )}

        {/* Tip banner */}
        <div className="mt-8 flex items-start gap-2.5 p-3 rounded-lg bg-themeblue2/5 border border-themeblue2/10">
          <Lightbulb size={16} className="text-themeblue2 shrink-0 mt-0.5" />
          <p className="text-xs text-tertiary leading-relaxed">
            <span className="font-medium text-primary">Tip:</span> Enable App Lock in Settings &gt; Security for quicker re-entry with a PIN.
          </p>
        </div>
      </div>
    </div>
  )
}
