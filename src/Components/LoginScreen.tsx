import { useState, useCallback } from 'react'
import { LogIn, KeyRound, Lock } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { useNavigationStore } from '../stores/useNavigationStore'
import { signIn } from '../lib/authService'
import { supabase } from '../lib/supabase'
import { PinKeypad } from './PinKeypad'

type View = 'main' | 'reset' | 'resetToken' | 'pin'

export function LoginScreen() {
  const continueAsGuest = useAuthStore(s => s.continueAsGuest)

  const [view, setView] = useState<View>('main')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [pinEmail, setPinEmail] = useState('')
  const [pinEmailConfirmed, setPinEmailConfirmed] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await signIn(email, password)
    if (result.error) setError(result.error.message)
    setLoading(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail)
    if (resetError) {
      setError(resetError.message)
    } else {
      // Move to token entry view
      setView('resetToken')
      setError(null)
    }
    setLoading(false)
  }

  const handleResetTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: resetEmail,
      token: resetToken,
      type: 'recovery',
    })
    if (otpError) setError(otpError.message)
    setLoading(false)
  }

  const handlePinSubmit = useCallback(async (pin: string) => {
    if (!pinEmail || pinLoading) return
    setPinLoading(true)
    setPinError('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pin-login', {
        body: { email: pinEmail, pin },
      })
      if (fnError || !data?.token) {
        setPinError(data?.error || 'Invalid email or PIN')
        setPinLoading(false)
        return
      }
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: pinEmail, token: data.token, type: 'magiclink',
      })
      if (otpError) {
        setPinError(otpError.message)
      }
    } catch {
      setPinError('Connection error')
    }
    setPinLoading(false)
  }, [pinEmail, pinLoading])

  const switchView = (next: View) => {
    setView(next)
    setError(null)
    setResetToken('')
    setPinError('')
    setPinEmailConfirmed(false)
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-start pt-[12vh] bg-themewhite dark:bg-[rgba(25,35,45,1)]">
      <div className="w-full max-w-sm mx-auto px-4">
        {/* Branding */}
        <div className="text-center mb-15">
          <svg className="w-14 h-14 mx-auto mb-3" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(20,20)">
              <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" />
              <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(60)" />
              <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(120)" />
            </g>
          </svg>
          <h1 className="text-xl font-semibold tracking-[2px] text-themeblue3 dark:text-themeblue1">
            ADTMC <div className='text-[10pt]'>Medical Knowledge Repository and Operational Network</div>
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 text-sm rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred">
            {error}
          </div>
        )}

        {/* ── Sign In (email / password) ── */}
        {view === 'main' && (
          <>
            <form onSubmit={handleSignIn} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.email@mail.mil"
                required
                className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                         focus:border-themeblue2 focus:outline-none text-primary placeholder:text-tertiary/30"
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                         focus:border-themeblue2 focus:outline-none text-primary placeholder:text-tertiary/30"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                         bg-themeblue2 text-white font-medium disabled:opacity-50 transition-colors"
              >
                <LogIn size={18} />
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="flex items-center justify-between mt-3 px-1">
              <button onClick={() => switchView('pin')} className="text-xs text-themeblue2 hover:underline">
                Sign in with PIN
              </button>
              <button onClick={() => switchView('resetToken')} className="text-xs text-themeblue2 hover:underline">
                Sign in with reset token
              </button>
              <button onClick={() => switchView('reset')} className="text-xs text-themeblue2 hover:underline">
                Forgot password?
              </button>
            </div>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-tertiary/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-themewhite dark:bg-[rgba(25,35,45,1)] text-tertiary/50">or</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={continueAsGuest}
                className="flex-1 px-4 py-3 rounded-lg border-2 border-tertiary/20 text-primary
                         font-medium hover:bg-themewhite2 transition-colors"
              >
                Continue as Guest
              </button>
              <button
                onClick={() => {
                  continueAsGuest()
                  useNavigationStore.getState().setShowSettings(true)
                }}
                className="flex-1 px-4 py-3 rounded-lg border-2 border-tertiary/20 text-primary
                         font-medium hover:bg-themewhite2 transition-colors"
              >
                Request Account
              </button>
            </div>

            <p className="mt-3 text-[10px] text-center text-tertiary/50">
              Guest mode keeps training and preferences local to this device.
            </p>
          </>
        )}

        {/* ── PIN Login ── */}
        {view === 'pin' && (
          <>
            {!pinEmailConfirmed ? (
              <form onSubmit={e => { e.preventDefault(); if (pinEmail.trim()) setPinEmailConfirmed(true) }} className="space-y-3">
                <p className="text-xs text-tertiary/60">
                  Enter your email, then unlock with your PIN.
                </p>
                <input
                  type="email"
                  value={pinEmail}
                  onChange={e => setPinEmail(e.target.value)}
                  placeholder="your.email@mail.mil"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                           focus:border-themeblue2 focus:outline-none text-primary placeholder:text-tertiary/30"
                />
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                           bg-themeblue2 text-white font-medium transition-colors"
                >
                  Continue
                </button>
              </form>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-2">
                  <Lock size={24} className="text-themeblue2" />
                </div>
                <p className="text-xs text-tertiary/50 mb-4">{pinEmail}</p>
                <div className="w-[270px]">
                  <PinKeypad
                    onSubmit={handlePinSubmit}
                    label={pinLoading ? 'Verifying...' : 'Enter your PIN'}
                    error={pinError}
                    disabled={pinLoading}
                  />
                </div>
                <button
                  onClick={() => setPinEmailConfirmed(false)}
                  className="text-xs text-themeblue2 hover:underline mt-4"
                >
                  Change email
                </button>
              </div>
            )}
            <button onClick={() => switchView('main')} className="w-full text-xs text-themeblue2 hover:underline mt-3">
              Back to sign in
            </button>
          </>
        )}

        {/* ── Password Reset (request) ── */}
        {view === 'reset' && (
          <>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <p className="text-xs text-tertiary/60">
                Enter your email and we'll send a reset token.
              </p>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="your.email@mail.mil"
                required
                className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                         focus:border-themeblue2 focus:outline-none text-primary placeholder:text-tertiary/30"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                         bg-themeblue2 text-white font-medium disabled:opacity-50 transition-colors"
              >
                <KeyRound size={18} />
                {loading ? 'Sending...' : 'Send Reset Token'}
              </button>
            </form>
            <button onClick={() => switchView('main')} className="w-full text-xs text-themeblue2 hover:underline mt-3">
              Back to sign in
            </button>
          </>
        )}

        {/* ── Reset Token Login ── */}
        {view === 'resetToken' && (
          <>
            <form onSubmit={handleResetTokenLogin} className="space-y-3">
              <p className="text-xs text-tertiary/60">
                Enter your email and the reset token from your email. You will be prompted to set a new password.
              </p>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="your.email@mail.mil"
                required
                className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                         focus:border-themeblue2 focus:outline-none text-primary placeholder:text-tertiary/30"
              />
              <input
                type="text"
                value={resetToken}
                onChange={e => setResetToken(e.target.value)}
                placeholder="Reset token (from your email)"
                required
                className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                         focus:border-themeblue2 focus:outline-none text-primary placeholder:text-tertiary/30 font-mono"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                         bg-themeblue2 text-white font-medium disabled:opacity-50 transition-colors"
              >
                <KeyRound size={18} />
                {loading ? 'Verifying...' : 'Verify & Reset'}
              </button>
            </form>
            <div className="flex items-center justify-between mt-3 px-1">
              <button onClick={() => switchView('reset')} className="text-xs text-themeblue2 hover:underline">
                Request a new token
              </button>
              <button onClick={() => switchView('main')} className="text-xs text-themeblue2 hover:underline">
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
