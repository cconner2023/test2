import { useState, useCallback } from 'react'
import { Check, X, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { signIn } from '../lib/authService'
import { supabase } from '../lib/supabase'
import { ErrorDisplay } from './ErrorDisplay'
import { TextInput, PasswordInput, PinCodeInput } from './FormInputs'
import { AccountRequestForm } from './Settings/AccountRequestForm'
import { submitSupportRequest } from '../lib/accountRequestService'

type View = 'main' | 'request' | 'help'
type LoginMode = 'password' | 'pin' | 'token'

const modeLabels: Record<LoginMode, string> = {
  password: 'Password',
  pin: 'PIN',
  token: 'Reset Token',
}

export function LoginScreen() {
  const continueAsGuest = useAuthStore(s => s.continueAsGuest)

  const [view, setView] = useState<View>('main')
  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [helpName, setHelpName] = useState('')
  const [helpEmail, setHelpEmail] = useState('')
  const [helpNotes, setHelpNotes] = useState('')
  const [helpSubmitted, setHelpSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode !== 'password') return
    setLoading(true)
    setError(null)
    const result = await signIn(email, password)
    if (result.error) setError(result.error.message)
    setLoading(false)
  }

  const handlePinSubmit = useCallback(async (pin: string) => {
    if (!email.trim() || pinLoading) return
    setPinLoading(true)
    setPinError('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pin-login', {
        body: { email, pin },
      })
      if (fnError || !data?.token) {
        setPinError(data?.error || 'Invalid email or PIN.')
        setPinLoading(false)
        return
      }
      const { error: otpError } = await supabase.auth.verifyOtp({
        email, token: data.token, type: 'magiclink',
      })
      if (otpError) {
        setPinError(otpError.message)
      }
    } catch {
      setPinError('Connection error')
    }
    setPinLoading(false)
  }, [email, pinLoading])

  const handleTokenSubmit = useCallback(async (token: string) => {
    if (!email.trim() || loading) return
    setLoading(true)
    setError(null)
    const { error: otpError } = await supabase.auth.verifyOtp({
      email, token, type: 'recovery',
    })
    if (otpError) setError(otpError.message)
    setLoading(false)
  }, [email, loading])

  const handleSendResetToken = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  const switchMode = (next: LoginMode) => {
    setMode(next)
    setPassword('')
    setPinError('')
    setError(null)
    setResetSent(false)
  }

  const switchView = (next: View) => {
    setView(next)
    setError(null)
    if (next === 'main') {
      switchMode('password')
    }
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
      <style>{`
        @keyframes login-orbit {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="min-h-full flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-sm">
          {/* Branding */}
          <div className={`text-center ${view === 'request' ? 'mb-6' : 'mb-8'}`}>
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

          {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}

          {/* ── Sign In ── */}
          {view === 'main' && (
            <>
              <div className="pb-2">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Sign In</p>
              </div>
              <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <TextInput
                    value={email}
                    onChange={setEmail}
                    type="email"
                    placeholder="your.email@mail.mil"
                    required
                  />

                  {/* Mode selector */}
                  <div className="flex gap-1 p-0.5 rounded-full bg-themewhite dark:bg-themewhite3 border border-themeblue3/10">
                    {(['password', 'pin', 'token'] as LoginMode[]).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => switchMode(m)}
                        className={`flex-1 py-1.5 text-[10px] font-medium rounded-full transition-all duration-200 active:scale-95 ${
                          mode === m
                            ? 'bg-themeblue3 text-white shadow-sm'
                            : 'text-tertiary/50 hover:text-tertiary/70'
                        }`}
                      >
                        {modeLabels[m]}
                      </button>
                    ))}
                  </div>

                  {/* Credential field — swaps based on mode */}
                  {mode === 'password' && (
                    <>
                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        placeholder="Password"
                      />
                      <div className={`flex items-center justify-end gap-2 overflow-hidden transition-all duration-300 ease-out ${
                        email.trim() && password ? 'max-h-12 opacity-100 pt-1' : 'max-h-0 opacity-0'
                      }`}>
                        <button
                          type="button"
                          onClick={() => { setEmail(''); setPassword(''); setError(null) }}
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                        >
                          <X size={18} />
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                        >
                          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                        </button>
                      </div>
                    </>
                  )}

                  {mode === 'pin' && (
                    <PinCodeInput
                      onSubmit={handlePinSubmit}
                      label={pinLoading ? 'Verifying...' : undefined}
                      error={pinError}
                      disabled={pinLoading || !email.trim()}
                    />
                  )}

                  {mode === 'token' && (
                    <PinCodeInput
                      length={6}
                      onSubmit={handleTokenSubmit}
                      label={loading ? 'Verifying...' : undefined}
                      error={error ?? undefined}
                      disabled={loading}
                    />
                  )}
                </form>
              </div>

              <div className="flex items-center justify-center mt-2 px-1">
                {mode === 'token' ? (
                  <button
                    onClick={handleSendResetToken}
                    disabled={!email.trim() || loading}
                    className="text-xs text-themeblue3 dark:text-themeblue1 hover:underline active:scale-95 transition-transform disabled:opacity-30"
                  >
                    {resetSent ? 'Resend token' : 'Send reset token'}
                  </button>
                ) : (
                  <button
                    onClick={() => { switchMode('token'); if (email.trim()) handleSendResetToken() }}
                    className="text-xs text-themeblue3 dark:text-themeblue1 hover:underline active:scale-95 transition-transform"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-themeblue3/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-themewhite dark:bg-themewhite3 text-tertiary/50">or</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={continueAsGuest}
                  className="flex-1 px-4 py-3 rounded-full border border-themeblue3/10 shadow-xs text-primary text-sm
                         font-medium active:scale-95 transition-all"
                >
                  Continue as Guest
                </button>
                <button
                  onClick={() => switchView('request')}
                  className="flex-1 px-4 py-3 rounded-full border border-themeblue3/10 shadow-xs text-primary text-sm
                         font-medium active:scale-95 transition-all"
                >
                  Request Account
                </button>
              </div>

              <p className="mt-2 text-[10px] text-center text-tertiary/50">
                Guest mode keeps training and preferences local to this device.
              </p>

              <button
                onClick={() => switchView('help')}
                className="w-full text-[10px] text-center text-themeblue3 dark:text-themeblue1 hover:underline mt-1.5 active:scale-95 transition-transform"
              >
                Need help? Contact support
              </button>

              <p className="mt-6 text-[11px] text-center text-tertiary/40 leading-relaxed max-w-xs mx-auto">
                Not affiliated with or endorsed by the Department of Defense. Clinical references derived from publicly available U.S. Army doctrine.
              </p>
            </>
          )}

          {/* ── Help / Support ── */}
          {view === 'help' && (
            <>
              {helpSubmitted ? (
                <>
                  <div className="pb-2">
                    <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Support</p>
                  </div>
                  <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-primary">Request Received</p>
                      <p className="text-xs text-tertiary/50">
                        We'll review your message and get back to you at {helpEmail}.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => switchView('main')} className="w-full text-xs text-themeblue3 dark:text-themeblue1 hover:underline mt-3 active:scale-95 transition-transform">
                    Back to sign in
                  </button>
                </>
              ) : (
                <>
                  <div className="pb-2">
                    <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Support</p>
                  </div>
                  <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3">
                    <p className="text-xs text-tertiary/60 mb-3">
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
                        className="w-full px-4 py-2.5 rounded-2xl bg-themewhite dark:bg-themewhite3 text-primary text-sm
                                 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2
                                 focus:outline-none transition-all duration-300 placeholder:text-tertiary/30 resize-none"
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => switchView('main')}
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                        >
                          <X size={18} />
                        </button>
                        <button
                          type="submit"
                          disabled={loading || !helpName.trim() || !helpEmail.trim() || !helpNotes.trim()}
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                        >
                          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
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
