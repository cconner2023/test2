import { useState, useCallback } from 'react'
import { Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { storePasswordHash } from '../lib/authService'
import { clearPinPermanentLock, resetLockout } from '../lib/pinService'
import { PasswordInput } from '@/Components/primitives/FormInputs'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { AuthBackdrop, AuthHeader, AUTH_CARD } from './AuthChrome'

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
      className="fixed inset-0 z-40 bg-themewhite dark:bg-themewhite3 overflow-y-auto select-none"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      <AuthBackdrop />
      <div className="relative min-h-full flex flex-col items-center justify-center py-8 px-6">
        <div className="w-full max-w-sm relative">
          <LoadingOverlay visible={submitting} className="rounded-2xl" />
          {success ? (
            <AuthHeader title="Password updated" subtitle="Unlock this device with your new password." />
          ) : (
            <>
              <AuthHeader
                className="mb-8"
                title="Set a new password"
                subtitle={<span className="block truncate">{email}</span>}
              />

              <ErrorDisplay message={error} centered />

              <form onSubmit={e => { e.preventDefault(); handleSubmit() }} className={AUTH_CARD}>
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
                <div className={`flex items-center justify-end gap-2 px-3 overflow-hidden transition-all duration-300 ease-out ${isValid ? 'max-h-14 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
                  <button
                    type="button"
                    onClick={() => { setPassword(''); setConfirm('') }}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                  >
                    <X size={16} />
                  </button>
                  <button
                    type="submit"
                    aria-label="Update password"
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                  >
                    <Check size={16} />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
