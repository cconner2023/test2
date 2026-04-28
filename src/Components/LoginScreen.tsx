import { useState, useCallback } from 'react'
import bwipjs from 'bwip-js'
import { useLinkeeChannel } from '../Hooks/useDeviceLink'
import { Check, X, RefreshCw, ArrowLeft } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'
import { useAuthStore } from '../stores/useAuthStore'
import { signIn } from '../lib/authService'
import { supabase } from '../lib/supabase'
import { ErrorDisplay } from './ErrorDisplay'
import { TextInput, PasswordInput, PinCodeInput } from './FormInputs'
import { AccountRequestForm } from './Settings/AccountRequestForm'
import { submitSupportRequest } from '../lib/accountRequestService'

type View = 'main' | 'request' | 'help'
type LoginMode = 'password' | 'qr'
type ForgotStep = null | 'email' | 'token'

/** Rendered only when mode === 'qr'. Subscribes to Realtime and shows QR. */
function DeviceLinkQrView() {
  const { channelId, status, error, channelState, regenerate } = useLinkeeChannel()

  const qrCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !channelId) return
    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'qrcode',
        text: channelId,
        scale: 4,
        padding: 3,
      })
    } catch {
      // non-critical
    }
  }, [channelId])

  if (channelState !== 'ready') {
    return (
      <div className="py-4 flex flex-col items-center justify-center gap-2">
        <LoadingSpinner className="text-tertiary" />
        {channelState === 'error' && (
          <button
            onClick={regenerate}
            className="text-[10pt] text-tertiary active:opacity-70 transition-opacity"
          >
            Tap to retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="py-2 overflow-hidden">
      <div className="float-right ml-3 mb-1 w-[38%]">
        <canvas ref={qrCanvasRef} className="block w-full border border-themegreen/30 bg-white rounded-xl" />
      </div>
      <p className="text-sm font-semibold text-primary mb-1.5">Link This Device</p>
      <p className="text-[10pt] text-secondary leading-relaxed">
        Open the application on another logged-in device, go to <span className="font-medium text-primary">Settings → Linked Devices</span>, and scan this code to log in.
      </p>
      {status === 'receiving' && (
        <p className="text-[10pt] text-themegreen font-medium mt-1.5">Linking device…</p>
      )}
      {status === 'error' && error && (
        <p className="text-[10pt] text-themeredred mt-1.5">{error}</p>
      )}
    </div>
  )
}

export function LoginScreen() {
  const continueAsGuest = useAuthStore(s => s.continueAsGuest)

  const [view, setView] = useState<View>('main')
  const [mode, setMode] = useState<LoginMode>('password')
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
    if (resetError) {
      setError(resetError.message)
    } else {
      setForgotStep('token')
    }
    setLoading(false)
  }

  const switchMode = (next: LoginMode) => {
    setMode(next)
    setPassword('')
    setError(null)
  }

  const switchView = (next: View) => {
    setView(next)
    setError(null)
    if (next === 'main') {
      switchMode('password')
      setForgotStep(null)
    }
    if (next === 'help') setHelpSubmitted(false)
  }

  const openForgot = () => {
    setForgotStep('email')
    setError(null)
  }

  const closeForgot = () => {
    setForgotStep(null)
    setError(null)
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
    <div className="fixed inset-0 z-30 bg-themewhite dark:bg-themewhite3 overflow-y-auto"
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
            <h1 className="text-xl font-semibold tracking-[2px] text-themeblue2 dark:text-themeblue1">
              {view !== 'request' && <div className='text-[10pt] text-secondary'>Medical Knowledge Repository and Operational Network</div>}
            </h1>
          </div>

          {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}

          {/* ── View panels ── */}
          <div className="relative overflow-hidden">

            {/* ── Sign In ── */}
            <div className={`transition-all duration-300 ease-out ${view === 'main'
              ? 'relative opacity-100 translate-x-0'
              : 'absolute inset-x-0 top-0 opacity-0 -translate-x-3 pointer-events-none'
            }`}>
              <div className="pb-2">
                <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Sign In</p>
              </div>
              <form onSubmit={handleSignIn}>
                <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                  <div className="relative">

                    {/* ── Main login content ── */}
                    <div className={`transition-all duration-300 ease-out ${forgotStep === null
                      ? 'relative opacity-100 translate-y-0'
                      : 'absolute inset-x-0 top-0 opacity-0 -translate-y-2 pointer-events-none'
                    }`}>
                      {/* Pill selector row */}
                      <div className="px-3 pt-3 pb-2 border-b border-primary/6">
                        <div className="relative flex p-0.5 rounded-full bg-themewhite dark:bg-themewhite3">
                          <div className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-themeblue3 shadow-sm transition-transform duration-200 ease-out ${mode === 'qr' ? 'translate-x-full' : 'translate-x-0'}`} />
                          {(['password', 'qr'] as LoginMode[]).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => switchMode(m)}
                              className={`relative flex-1 py-1.5 text-[9pt] font-medium rounded-full transition-colors duration-200 active:scale-95 ${mode === m
                                ? 'text-white'
                                : 'text-tertiary hover:text-tertiary'
                              }`}
                            >
                              {m === 'password' ? 'Password' : 'Link Device'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Content panels — active is in flow, inactive is absolute */}
                      <div className="relative">
                        <div className={`transition-all duration-300 ease-out ${mode === 'password'
                          ? 'relative opacity-100 translate-x-0'
                          : 'absolute inset-x-0 top-0 opacity-0 -translate-x-3 pointer-events-none'
                        }`}>
                          <TextInput
                            value={email}
                            onChange={setEmail}
                            type="email"
                            placeholder="your.email@mail.mil *"
                            required
                          />
                          <PasswordInput
                            value={password}
                            onChange={setPassword}
                            placeholder="Password *"
                          />
                          <div className={`flex items-center justify-end gap-2 px-3 overflow-hidden transition-all duration-300 ease-out ${email.trim() && password ? 'max-h-14 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'
                          }`}>
                            <button
                              type="button"
                              onClick={() => { setEmail(''); setPassword(''); setError(null) }}
                              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                            >
                              <X size={16} />
                            </button>
                            <button
                              type="submit"
                              disabled={loading}
                              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                            >
                              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                            </button>
                          </div>
                        </div>

                        <div className={`transition-all duration-300 ease-out ${mode === 'qr'
                          ? 'relative opacity-100 translate-x-0'
                          : 'absolute inset-x-0 top-0 opacity-0 translate-x-3 pointer-events-none'
                        }`}>
                          <div className="px-4 py-3">
                            <DeviceLinkQrView />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Forgot password flow ── */}
                    <div className={`transition-all duration-300 ease-out ${forgotStep !== null
                      ? 'relative opacity-100 translate-y-0'
                      : 'absolute inset-x-0 top-0 opacity-0 translate-y-2 pointer-events-none'
                    }`}>
                      <div className="relative">
                        {/* Step 1 — email */}
                        <div className={`transition-all duration-300 ease-out ${forgotStep === 'email'
                          ? 'relative opacity-100 translate-x-0'
                          : 'absolute inset-x-0 top-0 opacity-0 -translate-x-3 pointer-events-none'
                        }`}>
                          <p className="px-4 pt-3 pb-2 text-[10pt] text-secondary leading-relaxed border-b border-primary/6">
                            Enter your email - if an account exists you'll receive an 8 digit password reset pin.
                          </p>
                          <TextInput
                            value={email}
                            onChange={setEmail}
                            type="email"
                            placeholder="your.email@mail.mil"
                          />
                          <div className="flex items-center justify-end gap-2 px-3 py-2">
                            <button
                              type="button"
                              onClick={closeForgot}
                              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                            >
                              <X size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={handleSendResetToken}
                              disabled={loading}
                              className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${email.trim() ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                            >
                              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Step 2 — token entry */}
                        <div className={`transition-all duration-300 ease-out ${forgotStep === 'token'
                          ? 'relative opacity-100 translate-x-0'
                          : 'absolute inset-x-0 top-0 opacity-0 translate-x-3 pointer-events-none'
                        }`}>
                          <p className="px-4 pt-3 pb-2 text-[10pt] text-secondary leading-relaxed border-b border-primary/6">
                            Check <span className="font-medium text-primary">{email}</span> for an 8-digit reset token and enter it below.
                          </p>
                          <PinCodeInput
                            length={8}
                            onSubmit={handleTokenSubmit}
                            placeholder="Reset code"
                            label={loading ? 'Verifying...' : undefined}
                            error={error ?? undefined}
                            disabled={loading}
                          />
                          <div className="flex items-center justify-end gap-2 px-3 py-2">
                            <button
                              type="button"
                              onClick={closeForgot}
                              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                            >
                              <ArrowLeft size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={handleSendResetToken}
                              disabled={loading}
                              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                            >
                              <RefreshCw size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </form>

              {forgotStep === null && mode === 'password' && (
                <div className="flex items-center justify-center mt-2 px-1">
                  <button
                    onClick={openForgot}
                    className="text-[10pt] text-themeblue2 dark:text-themeblue1 hover:underline active:scale-95 transition-transform"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-themeblue3/10" />
                </div>
                <div className="relative flex justify-center text-[10pt]">
                  <span className="px-3 bg-themewhite dark:bg-themewhite3 text-secondary">or</span>
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

              <button
                onClick={() => switchView('help')}
                className="w-full text-[10pt] text-center text-themeblue2 dark:text-themeblue1 hover:underline mt-1.5 active:scale-95 transition-transform"
              >
                Need help? Contact support
              </button>

              <p className="mt-6 text-[10pt] text-center text-secondary leading-relaxed max-w-xs mx-auto">
                Not affiliated with or endorsed by the Department of Defense. Clinical references derived from publicly available U.S. Army doctrine.
              </p>
            </div>

            {/* ── Help / Support ── */}
            <div className={`transition-all duration-300 ease-out ${view === 'help'
              ? 'relative opacity-100 translate-x-0'
              : 'absolute inset-x-0 top-0 opacity-0 translate-x-3 pointer-events-none'
            }`}>
              {helpSubmitted ? (
                <>
                  <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3">
                    <p className="text-[10pt] text-secondary">
                      We'll review your message and get back to you at {helpEmail}.
                    </p>
                  </div>
                  <button onClick={() => switchView('main')} className="w-full text-[10pt] text-themeblue2 dark:text-themeblue1 hover:underline mt-3 active:scale-95 transition-transform">
                    Back to sign in
                  </button>
                </>
              ) : (
                <form onSubmit={handleSupportSubmit}>
                  <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                    <label className="block border-b border-primary/6">
                      <textarea
                        value={helpNotes}
                        onChange={(e) => setHelpNotes(e.target.value)}
                        placeholder="How can we help? *"
                        required
                        rows={3}
                        className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
                      />
                    </label>
                    <div className="flex items-center justify-end gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => switchView('main')}
                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                      >
                        <X size={16} />
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${helpName.trim() && helpEmail.trim() && helpNotes.trim() ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                      >
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* ── Request Account ── */}
            <div className={`transition-all duration-300 ease-out ${view === 'request'
              ? 'relative opacity-100 translate-x-0'
              : 'absolute inset-x-0 top-0 opacity-0 translate-x-3 pointer-events-none'
            }`}>
              <AccountRequestForm onBack={() => switchView('main')} />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
