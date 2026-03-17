import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { deriveAndStoreBackupKey, createBackup } from '../lib/signal/backupService'
import { PasswordInput } from './FormInputs'
import { ErrorDisplay } from './ErrorDisplay'

interface SetPasswordScreenProps {
  /** 'recovery' = user clicked a password-reset link (forgot password flow)
   *  'setup'    = new account first login — clears the needs_password_setup flag */
  mode?: 'recovery' | 'setup'
}

export const SetPasswordScreen = ({ mode = 'recovery' }: SetPasswordScreenProps) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery)
  const setNeedsPasswordSetup = useAuthStore((s) => s.setNeedsPasswordSetup)
  const user = useAuthStore((s) => s.user)

  const isValid = password.length >= 12 && password === confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setError(null)
    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    // Derive non-extractable backup CryptoKey from new password
    await deriveAndStoreBackupKey(password, user?.id ?? '')
    if (user) {
      const deviceRole = useAuthStore.getState().deviceRole
      if (deviceRole === 'primary') {
        createBackup(user.id).catch(() => { })
      }
    }

    // Always clear needs_password_setup in DB — the in-memory flag may not be
    // loaded yet (race with refreshProfile), so unconditionally clear it.
    if (user) {
      await supabase
        .from('profiles')
        .update({ needs_password_setup: false } as any)
        .eq('id', user.id)
    }

    setSubmitting(false)
    setNeedsPasswordSetup(false)
    setPasswordRecovery(false)

    // Refresh profile so the settings panel has up-to-date data from the DB
    useAuthStore.getState().refreshProfile()
  }

  const isSetup = mode === 'setup'

  return (
    <div
      className="fixed inset-0 z-[100] bg-themewhite overflow-y-auto select-none"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-4">
            <KeyRound size={26} className="text-themeblue2" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-wide">ADTMC</h1>
          <p className="text-sm text-tertiary mt-1 text-center">
            {isSetup
              ? 'Set your password to complete account setup'
              : 'Create a new password to regain access'}
          </p>
        </div>

        <ErrorDisplay message={error} centered />

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
            className="w-full px-4 py-3 rounded-lg bg-themeblue3 text-white font-medium
                       hover:bg-themeblue3/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Setting Password...' : isSetup ? 'Set Password' : 'Update Password'}
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}
