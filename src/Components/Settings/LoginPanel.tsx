import { useState } from 'react'
import { LogIn, ChevronDown } from 'lucide-react'
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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tokenEmail, setTokenEmail] = useState('')
  const [loginToken, setLoginToken] = useState('')
  const [showTokenSection, setShowTokenSection] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (email: string, pass: string) => {
    setLoading(true)
    setError(null)
    const result = await signIn(email, pass)
    if (result.error) {
      setError(result.error.message)
    } else {
      onSuccess()
    }
    setLoading(false)
  }

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault()
    handleSignIn(username, password)
  }

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: tokenEmail,
      token: loginToken,
      type: 'recovery',
    })
    if (otpError) {
      setError(otpError.message)
    } else {
      onSuccess()
    }
    setLoading(false)
  }

  const toggleTokenSection = () => {
    setShowTokenSection((prev) => !prev)
    setError(null)
  }

  return (
    <div className={variant === 'panel' ? 'h-full overflow-y-auto' : ''}>
      <div className={variant === 'panel' ? 'px-4 py-3 md:p-5' : 'p-6'}>

        {error && (
          <div className={`mb-4 p-3 text-sm ${variant === 'modal'
            ? 'rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred'
            : 'text-themeredred'
            }`}>
            {error}
          </div>
        )}

        {/* ── Primary: username / password ── */}
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-tertiary/60 uppercase tracking-wide mb-2">
              Username
            </label>
            <input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

        {/* ── Token login (new account first login) ── */}
        <div className="mt-4">
          <button
            type="button"
            onClick={toggleTokenSection}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-lg bg-tertiary/10
                     text-primary font-medium hover:bg-tertiary/20 transition-colors text-sm"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${showTokenSection ? 'rotate-180' : ''}`}
            />
            {showTokenSection ? 'Sign in with password instead' : 'New account? Enter your login token'}
          </button>

          {showTokenSection && (
            <form
              onSubmit={handleTokenLogin}
              className="mt-3 space-y-3 p-4 rounded-lg bg-themewhite2 border border-tertiary/10"
            >
              <p className="text-xs text-tertiary/60">
                Enter the username and login token from your approval email. You will be prompted to set a password after signing in.
              </p>

              <input
                type="email"
                value={tokenEmail}
                onChange={(e) => setTokenEmail(e.target.value)}
                placeholder="Username (your email)"
                required
                className="w-full px-3 py-2 rounded-lg bg-themewhite border border-tertiary/10
                         focus:border-themeblue2 focus:outline-none text-primary placeholder:text-tertiary/30"
              />

              <input
                type="text"
                value={loginToken}
                onChange={(e) => setLoginToken(e.target.value)}
                placeholder="Login token (from your email)"
                required
                className="w-full px-3 py-2 rounded-lg bg-themewhite border border-tertiary/10
                         focus:border-themeblue2 focus:outline-none text-primary placeholder:text-tertiary/30
                         font-mono"
              />

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                         text-white font-medium disabled:opacity-50 transition-colors text-sm
                         ${variant === 'modal' ? 'bg-themeblue2 hover:bg-themeblue2/90' : 'bg-themeblue3 hover:bg-themeblue2/90'}`}
              >
                <LogIn size={16} />
                {loading ? 'Verifying...' : 'Verify Token'}
              </button>
            </form>
          )}
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
                         bg-themewhite2 text-primary font-medium
                         border border-tertiary/20 hover:bg-tertiary/10 transition-colors text-sm"
              >
                Request an Account
              </button>
            </div>

            <p className="mt-4 text-xs text-center text-tertiary/60">
              Guest mode: Your training and preferences will stay local on this device.
              <br />
              Sign in to sync across devices.
            </p>
          </>
        ) : (
          <div className="mt-6 pt-6 border-t border-tertiary/10">
            <button
              onClick={onRequestAccount}
              className="w-full text-xs text-themeblue2 font-medium hover:underline transition-colors"
            >
              Don't have an account? Request one
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
