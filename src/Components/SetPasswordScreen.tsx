import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { PasswordInput } from './FormInputs'
import { ErrorMessage } from './ErrorMessage'

export const SetPasswordScreen = () => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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

        <ErrorMessage error={error} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="New Password"
            value={password}
            onChange={setPassword}
            placeholder="Min 12 characters"
            autoComplete="new-password"
            hint={password.length > 0 && password.length < 12 && (
              <p className="text-xs text-themeredred mt-1">Password must be at least 12 characters</p>
            )}
          />

          <PasswordInput
            label="Confirm Password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Re-enter password"
            autoComplete="new-password"
            hint={confirm.length > 0 && password !== confirm && (
              <p className="text-xs text-themeredred mt-1">Passwords do not match</p>
            )}
          />

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
