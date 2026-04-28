import { useState } from 'react'
import { KeyRound, X, Check, RefreshCw } from 'lucide-react'
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
      className="fixed inset-0 z-30 bg-themewhite overflow-y-auto select-none"
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

        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="New password (min 12 characters)"
              autoComplete="new-password"
              hint={password.length > 0 && password.length < 12 ? 'Password must be at least 12 characters' : undefined}
            />
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              placeholder="Confirm password"
              autoComplete="new-password"
              hint={confirm.length > 0 && password !== confirm ? 'Passwords do not match' : undefined}
            />
            <div className={`flex items-center justify-end gap-2 px-3 overflow-hidden transition-all duration-300 ease-out ${password || confirm ? 'max-h-14 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'
            }`}>
              <button
                type="button"
                onClick={() => { setPassword(''); setConfirm(''); setError(null) }}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
              <button
                type="submit"
                disabled={!isValid || submitting}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
              </button>
            </div>
          </div>
        </form>
      </div>
      </div>
    </div>
  )
}
