import { useState } from 'react'
import { X, LogIn, UserPlus } from 'lucide-react'
import { signIn } from '../lib/authService'
import { supabase } from '../lib/supabase'

interface LoginModalProps {
  isVisible: boolean
  onClose: () => void
  onContinueAsGuest: () => void
  onRequestAccount?: () => void
}

export const LoginModal = ({
  isVisible,
  onClose,
  onContinueAsGuest,
  onRequestAccount,
}: LoginModalProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  if (!isVisible) return null

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn(email, password)

    if (result.error) {
      setError(result.error.message)
    } else {
      onClose()
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="w-full max-w-md bg-themewhite rounded-2xl shadow-xl p-6">
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-xl font-semibold text-primary mb-2">Check Your Email</h2>
            <p className="text-tertiary/70 mb-6">
              We've sent a magic link to <strong>{email}</strong>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-themewhite rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-tertiary/10">
          <h2 className="text-xl font-semibold text-primary">Sign In</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-themewhite2 transition-colors"
          >
            <X size={20} className="text-tertiary/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-tertiary/70 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@mail.mil"
                required
                className="w-full px-4 py-3 rounded-lg bg-themewhite2 border border-tertiary/10
                         focus:border-themeblue2 focus:outline-none transition-colors
                         text-primary placeholder:text-tertiary/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-tertiary/70 mb-2">
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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                       bg-themeblue2 text-white font-medium hover:bg-themeblue2/90
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              Send Magic Link Instead
            </button>
          </div>

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
            <button
              onClick={onContinueAsGuest}
              className="w-full px-4 py-3 rounded-lg border-2 border-tertiary/20 text-primary
                       font-medium hover:bg-themewhite2 transition-colors"
            >
              Continue as Guest
            </button>

            {onRequestAccount && (
              <button
                onClick={() => {
                  onClose()
                  onRequestAccount()
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                         bg-green-50 text-green-700 font-medium hover:bg-green-100
                         border border-green-200 transition-colors text-sm"
              >
                <UserPlus size={18} />
                Don't have an account? Request Access
              </button>
            )}
          </div>

          <p className="mt-4 text-xs text-center text-tertiary/60">
            Guest mode: Your notes stay on this device only.
            <br />
            Sign in to sync across devices.
          </p>
        </div>
      </div>
    </div>
  )
}
