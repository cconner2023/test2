/* Non-blocking re-auth prompt: when the vault drain bails because the
 * password-derived wrapping key isn't cached (live-session resume / post-SW-update
 * reload with no persisted key) and messages are waiting, offer an inline password
 * re-entry to unlock + drain WITHOUT a full logout/login. Banner+dismiss over a
 * modal, per Beacon UX. Mirrors PasswordLockScreen's verify→derive→cache sequence;
 * the SIGNED_IN event from signInWithPassword re-runs the drain. */
import React, { useState, useCallback, useEffect } from 'react'
import { Lock, X, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'
import { verifyPasswordLocally, storePasswordHash } from '../lib/authService'
import { deriveAndStoreBackupKey, createBackup } from '../lib/signal/backupService'
import { ensureVaultExists, deriveAndCacheVaultKey, setVaultKeyReady, processVaultMessages, ackVaultDrain } from '../lib/signal/vaultDevice'
import { PasswordInput } from './FormInputs'
import { ErrorDisplay } from './ErrorDisplay'

// Mirror UpdateNotification's dismiss pattern: timestamp + 1-hour expiry so the
// banner reappears next session if still unresolved, but doesn't nag this one.
const DISMISS_KEY = 'vaultUnlockDismissed'
const DISMISS_TTL_MS = 60 * 60 * 1000

const VaultUnlockBanner: React.FC = () => {
  const promptNeeded = useAuthStore(s => s.vaultKeyPromptNeeded)
  const setPromptNeeded = useAuthStore(s => s.setVaultKeyPromptNeeded)
  const email = useAuthStore(s => s.user?.email ?? s.localSession?.email ?? '')
  const userId = useAuthStore(s => s.user?.id ?? s.localSession?.userId ?? '')

  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (raw) {
        const at = parseInt(raw, 10)
        if (!isNaN(at) && Date.now() - at < DISMISS_TTL_MS) setDismissed(true)
        else localStorage.removeItem(DISMISS_KEY)
      }
    } catch { /* localStorage unavailable — treat as not dismissed */ }
  }, [])

  const handleDismiss = useCallback(() => {
    setExpanded(false)
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || submitting || !email || !userId) return
    setError(null)
    setSubmitting(true)
    try {
      // HARD GATE: verify the password before deriving the wrapping key. A key
      // derived from the WRONG password fails AES-GCM on the vault blob, which
      // trips processVaultMessages' password-reset WIPE path — so we never derive
      // from an unverified password. signInWithPassword online (which also fires
      // SIGNED_IN → re-runs the drain), local hash offline. Same gate as
      // PasswordLockScreen.
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      let verified = !authError
      if (authError) {
        const isNetworkError = !navigator.onLine || /fetch|network/i.test(authError.message ?? '')
        if (isNetworkError) verified = await verifyPasswordLocally(password)
      }
      if (!verified) {
        setError('Incorrect password')
        return
      }

      // Password verified — safe to derive + cache the vault wrapping key.
      // Online: the SIGNED_IN event above re-runs handleSignedIn → drains with
      // the now-cached key. Offline: key is cached + persisted for the next drain.
      storePasswordHash(password).catch(() => {})
      deriveAndStoreBackupKey(password, userId).catch(() => {})
      const vaultKeyP = ensureVaultExists(userId, password)
        .then(() => deriveAndCacheVaultKey(password, userId))
        .catch(() => {})
      setVaultKeyReady(vaultKeyP)
      await vaultKeyP

      // Drain explicitly now that the key is cached. signInWithPassword's
      // SIGNED_IN event also re-runs handleSignedIn's drain, but that RACES this
      // (slow PBKDF2) key derivation and bails if it wins — so don't depend on
      // it. This is idempotent with that drain (rows stay unread until
      // ackVaultDrain; createBackup dedupes by id) and guarantees a drain AFTER
      // the key exists. Offline / transient failures just retry on the next drain.
      try {
        const drained = await processVaultMessages(userId)
        if (drained > 0) {
          const uploaded = await createBackup(userId)
          if (uploaded) await ackVaultDrain()
        }
      } catch { /* next online drain retries */ }

      setPromptNeeded(false)
      setExpanded(false)
    } catch {
      setError('Unable to verify. Please try again.')
    } finally {
      setSubmitting(false)
      setPassword('')
    }
  }, [password, submitting, email, userId, setPromptNeeded])

  if (!promptNeeded || dismissed || !email) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-60 flex justify-center p-4 pointer-events-none">
      <div className="relative w-full sm:w-auto sm:max-w-sm pointer-events-auto animate-slideInUp">
        <div className="bg-themewhite rounded-2xl shadow-2xl border border-tertiary/10 overflow-hidden backdrop-blur-xl">
          <div className="h-1 bg-themeblue2" />
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-themeblue2/15 flex items-center justify-center flex-shrink-0">
                  <Lock className="h-5 w-5 text-themeblue2" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Encrypted messages waiting</p>
                  <p className="text-[10pt] text-tertiary mt-0.5">
                    Re-enter your password to unlock them.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg hover:bg-themewhite2 active:scale-95 transition-all text-tertiary"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {expanded ? (
              <form onSubmit={handleSubmit} className="mt-4">
                <ErrorDisplay message={error} />
                <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    placeholder="Password"
                    autoComplete="current-password"
                    disabled={submitting}
                  />
                </div>
                <div className="flex items-center gap-2.5 mt-3">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-tertiary bg-themewhite2 hover:bg-themegray1/40 active:scale-95 transition-all"
                  >
                    Later
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !password.trim()}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-themeblue3 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Unlocking...</>
                    ) : (
                      <><ShieldCheck className="h-3.5 w-3.5" />Unlock</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2.5 mt-4">
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-tertiary bg-themewhite2 hover:bg-themegray1/40 active:scale-95 transition-all"
                >
                  Later
                </button>
                <button
                  onClick={() => setExpanded(true)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-themeblue3 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Unlock
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VaultUnlockBanner
