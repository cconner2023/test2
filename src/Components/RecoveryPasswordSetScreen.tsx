import { useState, useCallback } from 'react'
import { KeyRound, Check, RefreshCw, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { storePasswordHash } from '../lib/authService'
import { clearPinPermanentLock, resetLockout } from '../lib/pinService'
import { PasswordInput } from '@/Components/primitives/FormInputs'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'

/**
 * Password reset for a recovery link opened on a LOCKED browser belonging to the
 * same account. Renders above the lock overlays and grants no app access — the
 * lock stays up and the user unlocks with the new password afterwards.
 *
 * Deliberately not PasswordResetOverlay: that one runs behind the lock, inside the
 * app, and re-wraps the vault under the new password. Doing that here would let
 * mailbox access plus physical possession of a locked device read the message
 * history it currently cannot, so this path keeps the existing wipe-on-next-login
 * behaviour instead. See the task list entry for the decision.
 *
 * The three local writes after updateUser are what make the reset usable at all:
 * without them the offline verifier still holds the OLD password (storePasswordHash
 * has only two callers in the codebase) and a permanent PIN lock has no clearing
 * path other than a password this screen just replaced.
 */
export function RecoveryPasswordSetScreen({ email }: { email: string }) {
  const setPasswordRecovery = useAuthStore(s => s.setPasswordRecovery)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isValid = password.length >= 12 && password === confirm

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return
    setError(null)
    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    // Offline verification and the PIN escape both read local state, so the new
    // password has to land there or the user cannot get past their own lock.
    await storePasswordHash(password).catch(() => {})
    clearPinPermanentLock()
    resetLockout()

    setSubmitting(false)
    setSuccess(true)
    setPassword('')
    setConfirm('')
    setTimeout(() => setPasswordRecovery(false), 1800)
  }, [isValid, submitting, password, setPasswordRecovery])

  return (
    <div
      className="fixed inset-0 z-40 bg-themewhite overflow-y-auto select-none"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-6">
        <div className="w-full max-w-sm">
          {success ? (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-themegreen/10 flex items-center justify-center mb-4">
                <CheckCircle size={28} className="text-themegreen" />
              </div>
              <h1 className="text-xl font-bold text-primary">Password updated</h1>
              <p className="text-sm text-tertiary mt-2 text-center">
                Unlock this device with your new password.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-4">
                  <KeyRound size={26} className="text-themeblue2" />
                </div>
                <h1 className="text-xl font-bold text-primary tracking-wide">Set a new password</h1>
                <p className="text-sm text-tertiary mt-2 text-center">
                  This device stays locked until you sign back in with it.
                </p>
              </div>

              <div className="mb-3 px-1">
                <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Account</p>
                <p className="text-sm text-primary mt-0.5 truncate">{email}</p>
              </div>

              <ErrorDisplay message={error} centered />

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
              </div>

              {isValid && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full mt-3 py-3 rounded-2xl bg-themeblue3 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-all"
                >
                  {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                  {submitting ? 'Updating…' : 'Update password'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
