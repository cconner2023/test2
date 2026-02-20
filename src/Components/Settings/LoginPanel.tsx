import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { signIn } from '../../lib/authService'
import { supabase } from '../../lib/supabase'

interface LoginPanelProps {
  onSuccess: () => void
  onRequestAccount: () => void
  /** When 'modal', shows "Continue as Guest" button and different styling */
  variant?: 'panel' | 'modal'
  onContinueAsGuest?: () => void
}

export const LoginPanel = ({
  onSuccess,
  onRequestAccount,
  variant = 'panel',
  onContinueAsGuest,
}: LoginPanelProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn(email, password)

    if (result.error) {
      setError(result.error.message)
    } else {
      onSuccess()
    }

    setLoading(false)
  }

  const handleMagicLink = async () => {
    if (!email) {
      setError('Please enter your email')
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }

    setLoading(false)
  }

  if (magicLinkSent) {
    return (
      <div className={variant === 'panel' ? 'h-full overflow-y-auto' : ''}>
        <div className={variant === 'panel' ? 'px-4 py-3 md:p-5' : 'p-6'}>
          <div className="text-center py-8">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-xl font-semibold text-primary mb-2">Check Your Email</h2>
            <p className="text-tertiary/70 mb-6">
              A sign-in link has been sent to <strong>{email}</strong>
              <br />
              Click the link to sign in.
            </p>
            <button
              onClick={() => {
                setMagicLinkSent(false)
                setEmail('')
              }}
              className="px-4 py-2 rounded-lg bg-tertiary/10 text-primary font-medium
                       hover:bg-tertiary/20 transition-colors"
            >
              Try Another Email
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={variant === 'panel' ? 'h-full overflow-y-auto' : ''}>
      <div className={variant === 'panel' ? 'px-4 py-3 md:p-5' : 'p-6'}>
        <p className="text-sm text-tertiary/60 mb-5">
          Sign in to sync your notes across devices and access your profile.
        </p>

        {error && (
          <div className={`mb-4 p-3 text-sm ${
            variant === 'modal'
              ? 'rounded-lg bg-red-50 border border-red-200 text-red-700'
              : 'text-themeredred'
          }`}>
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-tertiary/60 uppercase tracking-wide mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={variant === 'modal' ? 'your.email@mail.mil' : 'email'}
              required
              className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                       focus:border-themeblue2 focus:outline-none transition-colors
                       text-primary placeholder:text-tertiary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-tertiary/60 uppercase tracking-wide mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                       focus:border-themeblue2 focus:outline-none transition-colors
                       text-primary placeholder:text-tertiary/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                     text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     ${variant === 'modal' ? 'bg-themeblue2 hover:bg-themeblue2/90' : 'bg-themeblue3 hover:bg-themeblue2/90'}`}
          >
            <LogIn size={18} />
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={handleMagicLink}
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-tertiary/10 text-primary font-medium
                     hover:bg-tertiary/20 disabled:opacity-50 transition-colors text-sm"
          >
            {variant === 'modal' ? 'Send Magic Link Instead' : 'send sign-in link instead'}
          </button>
        </div>

        {variant === 'modal' ? (
          <>
            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-tertiary/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-themewhite text-tertiary/60">or</span>
              </div>
            </div>

            {/* Guest & Request Account */}
            <div className="space-y-3">
              {onContinueAsGuest && (
                <button
                  onClick={onContinueAsGuest}
                  className="w-full px-4 py-3 rounded-lg border-2 border-tertiary/20 text-primary
                           font-medium hover:bg-themewhite2 transition-colors"
                >
                  Continue as Guest
                </button>
              )}

              <button
                onClick={onRequestAccount}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                         bg-green-50 text-green-700 font-medium hover:bg-green-100
                         border border-green-200 transition-colors text-sm"
              >
                Don't have an account? Request Access
              </button>
            </div>

            <p className="mt-4 text-xs text-center text-tertiary/60">
              Guest mode: Your notes stay on this device only.
              <br />
              Sign in to sync across devices.
            </p>
          </>
        ) : (
          <div className="mt-6 pt-6 border-t border-tertiary/10">
            <p className="text-sm text-tertiary/60 mb-3 text-center">Don't have an account?</p>
            <button
              onClick={onRequestAccount}
              className="w-full px-4 py-3 rounded-lg bg-themeblue3 text-white font-medium
                       hover:bg-themeblue2 transition-all duration-300"
            >
              Request an Account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
