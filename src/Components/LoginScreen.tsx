import { useState, useCallback } from 'react'
import { Lock } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { signIn } from '../lib/authService'
import { supabase } from '../lib/supabase'
import { PinKeypad } from './PinKeypad'
import { ErrorDisplay } from './ErrorDisplay'
import { TextInput, PasswordInput } from './FormInputs'
import { AccountRequestForm } from './Settings/AccountRequestForm'
import { submitSupportRequest } from '../lib/accountRequestService'

type View = 'main' | 'reset' | 'resetToken' | 'pin' | 'request' | 'help'


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
  const [helpName, setHelpName] = useState('')
  const [helpEmail, setHelpEmail] = useState('')
  const [helpNotes, setHelpNotes] = useState('')
  const [helpSubmitted, setHelpSubmitted] = useState(false)
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
    if (next === 'help') {
      setHelpSubmitted(false)
    }
  }

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await submitSupportRequest(helpName, helpEmail, helpNotes)
    if (result.success) {
      setHelpSubmitted(true)
    } else {
      setError(result.error || 'Failed to submit request')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[90] bg-themewhite dark:bg-themewhite3 overflow-y-auto"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
      {/* Keyframes for orbiting glow */}
      <style>{`
        @keyframes login-orbit {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="min-h-full flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-sm">
          {/* Branding */}
          <div className={`text-center ${view === 'request' ? 'mb-6' : 'mb-15'}`}>
            <div className={`relative mx-auto mb-2 ${view === 'request' ? 'w-10 h-10' : 'w-17 h-17'}`}>
              <svg className="relative w-full h-full" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(20,20)">
                  <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" />
                  <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(60)" />
                  <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(120)" />
                </g>
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-[2px] text-themeblue3 dark:text-themeblue1">
              ADTMC {view !== 'request' && <div className='text-[10pt]'>Medical Knowledge Repository and Operational Network</div>}
            </h1>
          </div>

          {error && <ErrorDisplay message={error} />}

          {/* ── Sign In (email / password) ── */}
          {view === 'main' && (
            <>
              <form onSubmit={handleSignIn} className="space-y-3">
                <TextInput
                  value={email}
                  onChange={setEmail}
                  type="email"
                  placeholder="your.email@mail.mil"
                  required
                />
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="Password"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-lg
                         bg-themeblue3 text-white disabled:opacity-50 transition-colors"
                >
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
                  <span className="px-3 bg-themewhite dark:bg-themewhite3 text-tertiary/50">or</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={continueAsGuest}
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-tertiary/10 text-primary
                         font-medium"
                >
                  Continue as Guest
                </button>
                <button
                  onClick={() => switchView('request')}
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-tertiary/10 text-primary
                         font-medium"
                >
                  Request Account
                </button>
              </div>

              <p className="mt-3 text-[10px] text-center text-tertiary/50">
                Guest mode keeps training and preferences local to this device.
              </p>

              <button
                onClick={() => switchView('help')}
                className="w-full text-[10px] text-center text-themeblue2 hover:underline mt-2 active:scale-95 transition-transform"
              >
                Need help? Contact support
              </button>
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
                  <TextInput
                    value={pinEmail}
                    onChange={setPinEmail}
                    type="email"
                    placeholder="your.email@mail.mil"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                           bg-themeblue3 text-white font-medium transition-colors"
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
                <TextInput
                  value={resetEmail}
                  onChange={setResetEmail}
                  type="email"
                  placeholder="your.email@mail.mil"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-lg
                         bg-themeblue3 text-white font-medium disabled:opacity-50 transition-colors"
                >

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
                <TextInput
                  value={resetEmail}
                  onChange={setResetEmail}
                  type="email"
                  placeholder="your.email@mail.mil"
                  required
                />
                <TextInput
                  value={resetToken}
                  onChange={setResetToken}
                  placeholder="Reset token (from your email)"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-lg
                         bg-themeblue3 text-white font-medium disabled:opacity-50 transition-colors"
                >

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

          {/* ── Help / Support ── */}
          {view === 'help' && (
            <>
              {helpSubmitted ? (
                <div className="rounded-xl border border-tertiary/15 p-5">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-primary">Request Received</p>
                    <p className="text-xs text-tertiary/50">
                      We'll review your message and get back to you at {helpEmail}.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-tertiary/60 mb-4">
                    Having trouble signing in or need assistance? Send us a message.
                  </p>
                  <form onSubmit={handleSupportSubmit} className="space-y-3">
                    <TextInput
                      value={helpName}
                      onChange={setHelpName}
                      placeholder="Your name *"
                      required
                    />
                    <TextInput
                      value={helpEmail}
                      onChange={setHelpEmail}
                      type="email"
                      placeholder="your.email@mail.mil *"
                      required
                    />
                    <textarea
                      value={helpNotes}
                      onChange={(e) => setHelpNotes(e.target.value)}
                      placeholder="How can we help? *"
                      required
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg bg-themewhite dark:bg-themewhite3 text-primary text-base
                               border border-tertiary/10 focus:border-themeblue1/30 focus:bg-themewhite2
                               focus:outline-none transition-all placeholder:text-tertiary/30 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-lg bg-themeblue3 text-white font-medium
                               disabled:opacity-50 transition-colors active:scale-95"
                    >
                      {loading ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                </>
              )}
              <button onClick={() => switchView('main')} className="w-full text-xs text-themeblue2 hover:underline mt-3 active:scale-95 transition-transform">
                Back to sign in
              </button>
            </>
          )}

          {/* ── Request Account ── */}
          {view === 'request' && (
            <AccountRequestForm onBack={() => switchView('main')} />
          )}
        </div>
      </div>
    </div>
  )
}
