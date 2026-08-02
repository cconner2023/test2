import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { Check, X, RefreshCw, ArrowLeft, ChevronLeft } from 'lucide-react'
import { DeviceLinkQrView } from './DeviceLinkQrView'
import { LoadingSpinner } from '@/Components/primitives/LoadingSpinner'
import { HudLoader } from '@/Components/primitives/HudLoader'
import { StackBody } from '@/Components/primitives/StackBody'
import { StackNavContext, type StackNav, type StackScreen } from './stackNav'
import { useAuthStore } from '../stores/useAuthStore'
import { signIn } from '../lib/authService'
import { supabase } from '../lib/supabase'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { TextInput, TextArea, PasswordInput } from '@/Components/primitives/FormInputs'
import { AccountRequestForm } from './Settings/AccountRequestForm'
import { submitSupportRequest } from '../lib/accountRequestService'
import { getRememberedEmail, forgetRememberedEmail } from '../lib/loginPrefill'
import { useIsMobile } from '@/Hooks/useIsMobile'

/** The login surface is one morphing card. Each value is a screen the view-level
 *  StackBody slides + height-morphs between (the same drill-down morph OverlayStack
 *  uses everywhere else). `signin` carries the password/qr sub-toggle internally. */
type View = 'signin' | 'forgot-email' | 'forgot-sent' | 'help' | 'request'
type LoginMode = 'password' | 'qr'

/** Handoff key: a lock/re-auth screen stashes the account email here, then signs
 *  out to surface LoginScreen, which prefills it and auto-opens the reset flow —
 *  so "Forgot password?" everywhere drives this one canonical email→PIN→recovery
 *  flow instead of a duplicate. */
export const FORGOT_PREFILL_KEY = 'adtmc_forgot_prefill'

export function LoginScreen() {
  const continueAsGuest = useAuthStore(s => s.continueAsGuest)
  const isMobile = useIsMobile()

  const [view, setView] = useState<View>('signin')
  // Direction the view-level morph slides (1 = drill in / from the right, -1 = back).
  const [viewDir, setViewDir] = useState<1 | -1>(1)
  const [mode, setMode] = useState<LoginMode>('password')
  // QR-side readiness gate for the mode HUD morph — flips true once the device-link
  // channel has a scannable code (or errored into a retry).
  const [qrReady, setQrReady] = useState(false)
  // The address of whoever last signed in on this device. Held separately from
  // `email` so editing the field doesn't retract the returning-user framing
  // mid-keystroke — only "Not you?" does.
  const [remembered, setRemembered] = useState(() => getRememberedEmail())
  const [email, setEmail] = useState(remembered)
  const [password, setPassword] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)
  const [helpName, setHelpName] = useState('')
  const [helpEmail, setHelpEmail] = useState('')
  const [helpNotes, setHelpNotes] = useState('')
  const [helpSubmitted, setHelpSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ad-hoc screens pushed by primitive pickers (FormInputs PickerInput) inside the
  // request form. Login is a StackNav host: instead of stacking the picker's own
  // nested popover, the picker calls nav.pushScreen and its option list morphs in
  // over the current card — same drill-down feel as OverlayStack, full-screen.
  const [pushed, setPushed] = useState<StackScreen[]>([])

  const nav: StackNav = useMemo(() => ({
    push: () => {},
    replace: () => {},
    pushScreen: (screen) => { setViewDir(1); setPushed(s => [...s, screen]) },
    pop: () => { setViewDir(-1); setPushed(s => s.slice(0, -1)) },
    reset: () => { setViewDir(-1); setPushed([]) },
    depth: pushed.length + 1,
  }), [pushed.length])

  // A lock/re-auth screen routed here for "Forgot password?" — prefill the email
  // it stashed and jump straight into the reset flow's email step.
  useEffect(() => {
    let pre: string | null = null
    try { pre = sessionStorage.getItem(FORGOT_PREFILL_KEY) } catch { /* ignore */ }
    if (pre === null) return
    try { sessionStorage.removeItem(FORGOT_PREFILL_KEY) } catch { /* ignore */ }
    setEmail(pre)
    setViewDir(1)
    setView('forgot-email')
  }, [])

  // DEV-only: the dev tunnel's QR can carry a test account's credentials in the
  // URL hash (#dev-login=<base64url of {e,p}>) so scanning it on a phone PREFILLS
  // this form without typing. Guarded by import.meta.env.DEV so the code is inert
  // and tree-shaken from production builds. Never auto-submits — you tap sign-in.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const m = window.location.hash.match(/dev-login=([^&]+)/)
    if (!m) return
    try {
      const b64 = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/')
      const { e, p } = JSON.parse(decodeURIComponent(escape(atob(b64))))
      if (e) setEmail(e)
      if (p) setPassword(p)
    } catch { /* malformed payload — ignore */ }
    // Strip the secret from the URL bar / history immediately.
    try { history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* ignore */ }
  }, [])

  // A returning user's only remaining task is the password, so start there.
  // Desktop only: on iOS this would throw the keyboard up over the branding
  // before the user has looked at the screen (same reasoning as the picker
  // search field in FormInputs).
  useEffect(() => {
    if (!remembered || isMobile) return
    passwordRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Support is reached mid-failure, so carry over whatever the user already typed
   *  rather than making them re-enter an address to describe why they can't get in. */
  const openHelp = () => {
    setHelpSubmitted(false)
    setHelpEmail(prev => prev || email.trim() || remembered)
    go('help', 1)
  }

  /** Shared device, different medic — drop the remembered address and the fields it seeded. */
  const forgetIdentity = () => {
    forgetRememberedEmail()
    setRemembered('')
    setEmail('')
    setPassword('')
    setError(null)
  }

  /** Navigate the view-level morph. `dir` controls the slide direction. */
  const go = (next: View, dir: 1 | -1 = 1) => {
    setViewDir(dir)
    setView(next)
    setPushed([])
    setError(null)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode !== 'password') return
    setLoading(true)
    setError(null)
    const result = await signIn(email, password)
    if (result.error) setError(result.error.message)
    setLoading(false)
  }

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setLoading(true)
    setError(null)
    // send-auth-email mints a 24h single-use recovery link (GoTrue) and delivers
    // it (Resend, with .mil relay routing). Always resolves generic success, so we
    // advance to the confirmation step regardless of whether the account exists.
    const { error: sendError } = await supabase.functions.invoke('send-auth-email', {
      body: { kind: 'recovery', email: email.trim() },
    })
    if (sendError) {
      setError('Could not send the reset link. Please try again.')
    } else {
      go('forgot-sent', 1)
    }
    setLoading(false)
  }

  const switchMode = (next: LoginMode) => {
    if (next === mode) return
    if (next === 'qr') setQrReady(false)
    setMode(next)
    setPassword('')
    setError(null)
  }

  const backToSignin = () => {
    switchMode('password')
    go('signin', -1)
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

      <div className="min-h-full flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-sm">
          {/* Branding */}
          <div className={`text-center ${view === 'request' ? 'mb-6' : 'mb-8'}`}>
            <div className={`relative mx-auto mb-2 transition-all duration-300 ease-out ${view === 'request' ? 'w-10 h-10' : 'w-17 h-17'}`}>
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

          {/* ── View-level morph — one card slides + height-morphs between screens.
                A picker pushed from inside the request form morphs in over the top. ── */}
          <StackNavContext.Provider value={nav}>
          <StackBody screenKey={view} dir={viewDir}>

            {/* ── Sign In ── */}
            {view === 'signin' && (
              <div>
                <div className="pb-2 flex items-baseline justify-between gap-3">
                  <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">
                    {remembered ? 'Welcome back' : 'Sign In'}
                  </p>
                  {remembered && mode === 'password' && (
                    <button
                      type="button"
                      onClick={forgetIdentity}
                      className="shrink-0 text-[9pt] text-themeblue2 dark:text-themeblue1 hover:underline active:scale-95 transition-transform"
                    >
                      Not you?
                    </button>
                  )}
                </div>
                <form onSubmit={handleSignIn}>
                  {/* Whole card collapses to a HUD puck and re-expands when the
                      Password ⇄ Link Device mode flips (both directions). */}
                  <HudCardMorph morphKey={mode} ready={mode === 'password' || qrReady}>
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

                    {mode === 'password' ? (
                      <div>
                        <TextInput
                          value={email}
                          onChange={setEmail}
                          type="email"
                          inputMode="email"
                          placeholder="Email *"
                          name="email"
                          autoComplete="username"
                          required
                        />
                        <PasswordInput
                          value={password}
                          onChange={setPassword}
                          placeholder="Password *"
                          name="password"
                          autoComplete="current-password"
                          inputRef={passwordRef}
                        />
                        <div className={`flex items-center justify-end gap-2 px-3 overflow-hidden transition-all duration-300 ease-out ${email.trim() && password ? 'max-h-14 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'
                        }`}>
                          <button
                            type="button"
                            // Resets to the smart default rather than to blank — clearing a
                            // mistyped password shouldn't cost you the remembered address.
                            onClick={() => { setEmail(remembered); setPassword(''); setError(null) }}
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
                    ) : (
                      <div className="px-4 py-3">
                        <DeviceLinkQrView onSettledChange={setQrReady} />
                      </div>
                    )}
                  </HudCardMorph>
                </form>

                {mode === 'password' && (
                  <div className="flex items-center justify-center mt-2 px-1">
                    <button
                      onClick={() => go('forgot-email', 1)}
                      className="text-[10pt] text-themeblue2 dark:text-themeblue1 hover:underline active:scale-95 transition-transform"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Footer — guest / request / support, shared by the signin family */}
                <SigninFooter onGuest={continueAsGuest} onRequest={() => go('request', 1)} onHelp={openHelp} />
              </div>
            )}

            {/* ── Forgot password — step 1: email ── */}
            {view === 'forgot-email' && (
              <div>
                <div className="pb-2">
                  <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Reset Password</p>
                </div>
                <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                  <p className="px-4 pt-3 pb-2 text-[10pt] text-secondary leading-relaxed border-b border-primary/6">
                    Enter your email - if an account exists you'll receive a password reset link. Open it on this device to set a new password.
                  </p>
                  <TextInput
                    value={email}
                    onChange={setEmail}
                    type="email"
                    inputMode="email"
                    placeholder="Email"
                    name="email"
                    autoComplete="username"
                  />
                  <div className="flex items-center justify-end gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => go('signin', -1)}
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                    >
                      <X size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSendResetLink}
                      disabled={loading}
                      className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${email.trim() ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                    >
                      {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                    </button>
                  </div>
                </div>
                <SigninFooter onGuest={continueAsGuest} onRequest={() => go('request', 1)} onHelp={openHelp} />
              </div>
            )}

            {/* ── Forgot password — step 2: link sent ── */}
            {view === 'forgot-sent' && (
              <div>
                <div className="pb-2">
                  <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Reset Password</p>
                </div>
                <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                  <p className="px-4 pt-3 pb-3 text-[10pt] text-secondary leading-relaxed border-b border-primary/6">
                    If an account exists for <span className="font-medium text-primary">{email}</span>, a password reset link is on its way. Open it on this device to set a new password — the link expires in 24 hours.
                  </p>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => go('signin', -1)}
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSendResetLink}
                      disabled={loading}
                      className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full text-[9pt] font-medium text-tertiary disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                      Resend
                    </button>
                  </div>
                </div>
                <SigninFooter onGuest={continueAsGuest} onRequest={() => go('request', 1)} onHelp={openHelp} />
              </div>
            )}

            {/* ── Help / Support ── */}
            {view === 'help' && (
              <div>
                <div className="pb-2">
                  <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Contact Support</p>
                </div>
                {helpSubmitted ? (
                  <>
                    <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3">
                      <p className="text-[10pt] text-secondary">
                        We'll review your message and get back to you at {helpEmail}.
                      </p>
                    </div>
                    <button onClick={() => go('signin', -1)} className="w-full text-[10pt] text-themeblue2 dark:text-themeblue1 hover:underline mt-3 active:scale-95 transition-transform">
                      Back to sign in
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleSupportSubmit}>
                    <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                      <p className="px-4 pt-3 pb-2 text-[10pt] text-secondary leading-relaxed border-b border-primary/6">
                        No account needed to reach us. Describe what happened and we'll reply to the address below — include the error text if you saw one.
                      </p>
                      <TextInput
                        value={helpName}
                        onChange={setHelpName}
                        placeholder="Your name *"
                        name="name"
                        autoComplete="name"
                        required
                      />
                      <TextInput
                        value={helpEmail}
                        onChange={setHelpEmail}
                        type="email"
                        inputMode="email"
                        placeholder="Email *"
                        name="email"
                        autoComplete="email"
                        required
                      />
                      <TextArea
                        value={helpNotes}
                        onChange={setHelpNotes}
                        placeholder="How can we help? *"
                        required
                        rows={3}
                      />
                      <div className="flex items-center justify-end gap-2 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => go('signin', -1)}
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
            )}

            {/* ── Request Account ── */}
            {view === 'request' && (
              <div className="relative">
                {/* Form stays MOUNTED (display:none) while a picker is up so its
                    field state survives — a remount would wipe it. */}
                <div className={pushed.length > 0 ? 'hidden' : undefined}>
                  <AccountRequestForm
                    onBack={backToSignin}
                    initialEmail={email.trim()}
                    onSignIn={(addr) => { setEmail(addr); backToSignin() }}
                  />
                </div>
                {pushed.length > 0 && (
                  <PickerScreen screen={pushed[pushed.length - 1]} nav={nav} />
                )}
              </div>
            )}

          </StackBody>
          </StackNavContext.Provider>
        </div>
      </div>
    </div>
  )
}

/**
 * HudCardMorph — collapses its whole card to a HUD puck and re-expands when
 * `morphKey` changes, in both directions. Same mechanic as PreviewOverlay's
 * loading morph (declarative spring width/height + HUD/content crossfade), but
 * driven by a key flip (the Password ⇄ Link Device toggle) instead of an async
 * loading flag.
 *
 * Idle = a plain responsive card (natural reflow). On a key change it switches to
 * spring control and collapses to the puck (content fades out, HUD fades in),
 * PARKS there until the incoming content reports `ready` (the QR side withholds
 * `ready` until it has a scannable code or errors into a retry), then expands to
 * the content's live-measured height and drops back to plain layout.
 *
 * Declarative on purpose: the spring targets are derived from `collapsed`, and the
 * expand height tracks a ResizeObserver on the content — so there is no imperative
 * collapse→hold→expand phase chain to get stuck mid-flight or measure at the wrong
 * frame (the failure mode of the earlier version: card dropping to ~0 between the
 * puck and the re-expand, and never recovering for the instantly-ready password
 * side). Content is never frozen — the HUD overlay covers it (opacity 0) through
 * the collapse, so swapping in the incoming children immediately is invisible.
 */
function HudCardMorph({ morphKey, ready = true, children }: { morphKey: string; ready?: boolean; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const shownKey = useRef(morphKey)

  // Match the admin Sheet loading morph (Sheet.tsx) verbatim so login reads with
  // the same iOS Face-ID texture: soft spring grow + a HUD that dissolves OUTWARD
  // (scale 1→1.08, fade) while the content fades in just behind it.
  const HUD = 88
  const PUCK_W = 140
  const PUCK_H = HUD + 56
  const cfg = { tension: 210, friction: 24 }

  // A morph is running from the key flip until the expand spring rests.
  const [active, setActive] = useState(false)
  // Parked at the HUD puck until the incoming content reports ready.
  const [collapsed, setCollapsed] = useState(false)
  // Live natural size, tracked only while morphing. Width is the full container
  // (the puck is narrower + centred); height follows the content so the expand
  // grows to the real size — and keeps tracking as the QR panel reveals.
  const [fullW, setFullW] = useState(0)
  const [contentH, setContentH] = useState(0)

  // The settled HUD holds for a minimum dwell so it reads as a deliberate shape,
  // not a flicker — matches the admin Sheet puck (1400ms). The clock restarts on
  // every collapse; the password side (ready at once) still settles the full beat.
  const HUD_MIN_DWELL_MS = 1400
  const [dwellDone, setDwellDone] = useState(false)

  // Kick off a morph when the key changes: snapshot the full width, collapse to
  // puck, and reset the dwell clock IN THE SAME BATCH as the collapse. If the
  // reset lived in a separate [collapsed] effect, the release effect below would
  // read a stale dwellDone=true left from the prior morph and expand instantly —
  // that was the reverse-to-password "no animation" bug.
  useEffect(() => {
    if (morphKey === shownKey.current) return
    shownKey.current = morphKey
    setFullW(rootRef.current?.offsetWidth ?? 0)
    setActive(true)
    setCollapsed(true)
    setDwellDone(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morphKey])

  // Start the minimum-dwell clock whenever we're collapsed at the puck.
  useEffect(() => {
    if (!collapsed) return
    const t = window.setTimeout(() => setDwellDone(true), HUD_MIN_DWELL_MS)
    return () => window.clearTimeout(t)
  }, [collapsed])

  // Release the puck once the incoming content is ready AND the HUD has held its
  // minimum dwell (password is ready at once; the QR side also parks until its
  // channel hands over a scannable code or fails). Expand fires at the later of the two.
  useEffect(() => {
    if (collapsed && ready && dwellDone) setCollapsed(false)
  }, [collapsed, ready, dwellDone])

  // Track the content's natural height while morphing so the expand target — and
  // any in-content growth (the QR reveal) — is always the real size.
  useLayoutEffect(() => {
    if (!active) return
    const el = innerRef.current
    if (!el) return
    const measure = () => setContentH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [active])

  const morph = useSpring({
    width: collapsed ? PUCK_W : (fullW || PUCK_W),
    height: collapsed ? PUCK_H : (contentH || PUCK_H),
    config: cfg,
    onRest: () => { if (!collapsed) setActive(false) },
  })
  // HUD dissolves outward on reveal (scale 1→1.08 + fade); content fades in just
  // behind it on a short delay — the Sheet/PreviewOverlay crossfade, spring-driven
  // (not a flat CSS opacity) so it carries the same Face-ID texture.
  const hudFade = useSpring({
    from: { opacity: 0, scale: 1 },
    opacity: collapsed ? 1 : 0,
    scale: collapsed ? 1 : 1.08,
    config: cfg,
  })
  // Hiding is instant (the HUD overlay covers the swap); only the reveal animates.
  // Matches the admin Sheet fix — a spring-driven fade-OUT let the outgoing card
  // bleed through the collapse for a frame.
  const contentFade = useSpring({
    opacity: collapsed ? 0 : 1,
    immediate: collapsed,
    delay: collapsed ? 0 : 90,
    config: cfg,
  })

  return (
    <div ref={rootRef} className="w-full">
      <animated.div
        className="rounded-2xl bg-themewhite2 overflow-hidden relative mx-auto"
        style={active ? { width: morph.width, height: morph.height } : undefined}
      >
        <animated.div
          ref={innerRef}
          style={active ? { width: fullW, opacity: contentFade.opacity } : undefined}
        >
          {children}
        </animated.div>
        {active && (
          <animated.div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: hudFade.opacity,
              transform: hudFade.scale.to((v) => `scale(${v})`),
              pointerEvents: 'none',
            }}
          >
            <HudLoader size={HUD} />
          </animated.div>
        )}
      </animated.div>
    </div>
  )
}

/** A picker screen pushed by a FormInputs PickerInput — its option list morphs in
 *  over the card with a back chevron that pops back to the form. Mirrors the title
 *  + back-derivation OverlayStack gives drill-down screens, in login's full-screen
 *  card idiom. */
function PickerScreen({ screen, nav }: { screen: StackScreen; nav: StackNav }) {
  const title = typeof screen.title === 'function' ? screen.title(undefined) : screen.title
  const body = screen.render(undefined, nav) as ReactNode
  // Slide + fade in on mount (the height change is morphed by the enclosing StackBody).
  const [reveal, setReveal] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReveal(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div className={`transition-all duration-300 ease-out ${reveal ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}>
      <div className="pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => nav.pop()}
          aria-label="Back"
          className="w-7 h-7 -ml-1 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase truncate">{title}</p>
      </div>
      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        {body}
      </div>
    </div>
  )
}

/** Guest / Request / Support footer shared by the signin-family screens. */
function SigninFooter({ onGuest, onRequest, onHelp }: { onGuest: () => void; onRequest: () => void; onHelp: () => void }) {
  return (
    <>
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
          onClick={onGuest}
          className="flex-1 px-4 py-3 rounded-full border border-themeblue3/10 shadow-xs text-primary text-sm
                 font-medium active:scale-95 transition-all"
        >
          Continue as Guest
        </button>
        <button
          onClick={onRequest}
          className="flex-1 px-4 py-3 rounded-full border border-themeblue3/10 shadow-xs text-primary text-sm
                 font-medium active:scale-95 transition-all"
        >
          Request Account
        </button>
      </div>

      <button
        onClick={onHelp}
        className="w-full text-[10pt] text-center text-themeblue2 dark:text-themeblue1 hover:underline mt-1.5 active:scale-95 transition-transform"
      >
        Need help? Contact support
      </button>

      <p className="mt-6 text-[10pt] text-center text-secondary leading-relaxed max-w-xs mx-auto">
        Not affiliated with or endorsed by the Department of Defense. Clinical references derived from publicly available U.S. Army doctrine.
      </p>
    </>
  )
}
