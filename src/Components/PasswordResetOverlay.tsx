import { useState, useEffect } from 'react'
import { Check, RefreshCw, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { deriveAndStoreBackupKey, createBackup } from '../lib/signal/backupService'
import { reEncryptVaultKeysWithCachedKey } from '../lib/signal/vaultDevice'
import { storePasswordHash } from '../lib/authService'
import { clearPinPermanentLock, resetLockout } from '../lib/pinService'
import { PreviewOverlay } from './PreviewOverlay'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { PasswordInput } from '@/Components/primitives/FormInputs'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'

/**
 * Non-blocking password reset surfaced after a recovery OTP login.
 *
 * A recovery OTP is now treated as a real login (see useAuthStore.handleSignedIn),
 * so the user is already in the app. This centered PreviewOverlay rides on top to
 * let them set a new password without the old blocking SetPasswordScreen (which
 * got buried under the acknowledgment/loader gates). Identity is proven by the
 * email + OTP, so there is no current-password check and the new password may
 * match the previous one.
 *
 * Driven by useAuthStore.isPasswordRecovery, which is persisted (PW_RESET_PENDING_KEY)
 * so it survives a refresh until the user actually resets.
 */
export default function PasswordResetOverlay() {
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery)
  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery)
  const user = useAuthStore((s) => s.user)
  const lockActive = useAuthStore((s) => s.lockActive)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  // Per-session dismiss. The pending flag is PERSISTED, so dismissing only defers
  // — the overlay re-appears on the next app open until the user actually resets.
  const [dismissed, setDismissed] = useState(false)

  // Reset transient field + dismiss state whenever a fresh recovery flow opens.
  useEffect(() => {
    if (isPasswordRecovery) {
      setPassword(''); setConfirm(''); setError(null); setSuccess(false); setDismissed(false)
    }
  }, [isPasswordRecovery])

  // Min-length floor only; same-as-previous is allowed (key + email is the proof).
  const isValid = password.length >= 12 && password === confirm

  const handleSubmit = async () => {
    if (!isValid || submitting) return
    setError(null)
    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    if (user) {
      // Preserve the personal vault: re-wrap the blob under the new password using
      // the old wrapping key still held locally (the recovery-login drain restores
      // it on the user's usual device). Best-effort — on a brand-new device the old
      // key isn't available and the blob is unrecoverable, so this no-ops (ok(false))
      // and the existing wipe-on-next-login path re-provisions cleanly. Run BEFORE
      // re-deriving the backup key so the cached old key is still in scope.
      await reEncryptVaultKeysWithCachedKey(user.id, password).catch(() => {})

      // Re-derive the backup key from the new password (mirrors SetPasswordScreen).
      await deriveAndStoreBackupKey(password, user.id)
      if (useAuthStore.getState().deviceRole === 'primary') {
        createBackup(user.id).catch(() => {})
      }
    }

    // Offline verification reads a locally stored hash that only signIn and
    // PasswordLockScreen ever wrote, so without this the device keeps accepting
    // the OLD password offline and rejecting the new one. Clearing the PIN lock
    // matters for the same reason: its only escape is a password check against
    // that hash.
    await storePasswordHash(password).catch(() => {})
    clearPinPermanentLock()
    resetLockout()

    setSubmitting(false)
    setSuccess(true)
    setPassword(''); setConfirm('')
    useAuthStore.getState().refreshProfile()
    // Keep the recovery flag set through the success view so the (recovery-
    // suppressed) acknowledgment gate doesn't pop over it; clear both — the
    // persisted flag and the in-memory state — once it auto-closes.
    setTimeout(() => {
      setSuccess(false)
      setPasswordRecovery(false)
    }, 1600)
  }

  // Behind a lock this overlay is invisible anyway, and its success timer would
  // clear the recovery flag out from under RecoveryPasswordSetScreen, which owns
  // that case. See LockGate.
  const isOpen = ((isPasswordRecovery && !dismissed) || success) && !!user && !lockActive

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={() => setDismissed(true)}
      anchorRect={null}
      title="Set a new password"
      maxWidth={360}
      rightFooter={
        !success ? (
          <FooterPill side="right">
            <ActionButton
              icon={submitting ? RefreshCw : Check}
              label={submitting ? 'Updating…' : 'Update password'}
              variant={!isValid || submitting ? 'disabled' : 'confirm'}
              onClick={handleSubmit}
            />
          </FooterPill>
        ) : undefined
      }
    >
      {success ? (
        <div className="px-5 py-8 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-themegreen/10 flex items-center justify-center mb-4">
            <CheckCircle size={28} className="text-themegreen" />
          </div>
          <h2 className="text-lg font-semibold text-primary">Password updated</h2>
          <p className="text-sm text-tertiary mt-2 text-center">
            You're all set — your new password is active.
          </p>
        </div>
      ) : (
        <div>
          <div className="px-4 pt-3 pb-1">
            <p className="text-sm text-tertiary text-center">
              Create a new password to finish regaining access.
            </p>
          </div>
          {error && (
            <div className="px-4 pt-2">
              <ErrorDisplay message={error} />
            </div>
          )}
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
      )}
    </PreviewOverlay>
  )
}
