import { useState } from 'react'
import { KeyRound, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'

export const SetPasswordScreen = () => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery)

  const isValid = password.length >= 12 && password === confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setError(null)
    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setPasswordRecovery(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-themewhite flex flex-col items-center justify-center select-none px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-4">
            <KeyRound size={26} className="text-themeblue2" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-wide">ADTMC</h1>
          <p className="text-sm text-tertiary mt-1 text-center">Set your password to complete account setup</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">New Password</span>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 12 characters"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-themewhite2 text-primary text-base
                           border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                           transition-colors placeholder:text-tertiary/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary/40 hover:text-tertiary/70 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password.length > 0 && password.length < 12 && (
              <p className="text-xs text-themeredred mt-1">Password must be at least 12 characters</p>
            )}
          </label>

          {/* Confirm password */}
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Confirm Password</span>
            <div className="relative mt-1">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-themewhite2 text-primary text-base
                           border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                           transition-colors placeholder:text-tertiary/30"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary/40 hover:text-tertiary/70 transition-colors"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirm.length > 0 && password !== confirm && (
              <p className="text-xs text-themeredred mt-1">Passwords do not match</p>
            )}
          </label>

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full px-4 py-3 rounded-lg bg-themeblue2 text-white font-medium
                       hover:bg-themeblue2/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Setting Password...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
