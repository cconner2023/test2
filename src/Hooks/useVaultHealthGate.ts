import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { checkVaultHealth, VAULT_UNHEALTHY_EVENT } from '../lib/signal/vaultDevice'

/** Foreground re-checks are throttled to this; session start, prompt dismissal
 *  and VAULT_UNHEALTHY_EVENT always check. */
const RECHECK_MS = 10 * 60 * 1000

/**
 * Double-check that the signed-in user's personal vault is intact (row +
 * public bundle + device entry). If it isn't, raise the vault password gate:
 * PasswordLockScreen reason="vault" runs ensureVaultExists, which creates or
 * repairs it. Without this, a user whose vault is missing stays unmessageable
 * until they happen to type their password again.
 *
 * Never gates on 'unknown' (offline / failed read), and never for a
 * first-login user who has no password yet (SetPasswordScreen provisions).
 * Re-checks after the gate is dismissed, so a failed repair re-prompts.
 */
export function useVaultHealthGate(opts: {
  userId: string | null
  enabled: boolean
  promptOpen: boolean
}): void {
  const { userId, enabled, promptOpen } = opts
  const lastCheckAt = useRef(0)

  useEffect(() => {
    if (!userId || !enabled || promptOpen) return
    let cancelled = false

    const run = async (force: boolean) => {
      if (!force && Date.now() - lastCheckAt.current < RECHECK_MS) return
      if (!navigator.onLine) return
      lastCheckAt.current = Date.now()

      const health = await checkVaultHealth(userId)
      if (cancelled || health !== 'unhealthy') return

      // The in-memory needsPasswordSetup flag can lag the profile fetch; a
      // link-onboarded user has no password to enter, so confirm server-side.
      const { data, error } = await supabase
        .from('profiles')
        .select('needs_password_setup')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled || error || data?.needs_password_setup === true) return

      const s = useAuthStore.getState()
      if (s.user?.id !== userId || s.needsPasswordSetup || s.isPasswordRecovery) return
      s.setVaultKeyPromptNeeded(true)
    }

    void run(true)
    const onVisible = () => { if (document.visibilityState === 'visible') void run(false) }
    const onUnhealthy = () => { void run(true) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(VAULT_UNHEALTHY_EVENT, onUnhealthy)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(VAULT_UNHEALTHY_EVENT, onUnhealthy)
    }
  }, [userId, enabled, promptOpen])
}
