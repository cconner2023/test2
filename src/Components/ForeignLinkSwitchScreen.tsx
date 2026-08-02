import { useState, useCallback } from 'react'
import { UserCog } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { useLinkGate, releaseLinkGate } from '../lib/authLinkGate'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { LoadingSpinner } from '@/Components/primitives/LoadingSpinner'

/**
 * Shown when an auth-email link opened on this browser turns out to belong to a
 * different account than the one already signed in here.
 *
 * The link has already been spent by the time we can name the account it is for,
 * so both answers are consequential and the copy says so: continuing erases the
 * incumbent's local data, declining wastes the link. Nothing here reads app data
 * — it renders above every lock and only ever decides which account this browser
 * belongs to.
 */
export function ForeignLinkSwitchScreen() {
  const { holding, incoming, incumbent, incumbentSession } = useLinkGate()
  const discardLocalIdentity = useAuthStore(s => s.discardLocalIdentity)
  const setPasswordRecovery = useAuthStore(s => s.setPasswordRecovery)
  const [busy, setBusy] = useState<'switch' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSwitch = useCallback(async () => {
    if (busy || !incoming) return
    setError(null)
    setBusy('switch')

    // Capture the incoming tokens first. The local wipe below destroys the
    // encrypted session store, so a JS-held copy is the only way back to this
    // session — and the link that minted it is single-use and already spent.
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    const refreshToken = data.session?.refresh_token
    if (!accessToken || !refreshToken) {
      setError('That sign-in link has already expired. Request a new one.')
      setBusy(null)
      return
    }

    // Release without replay: the parked event belongs to the session about to be
    // torn down, and the wipe is driven by a SIGNED_OUT the gate would otherwise
    // park too.
    releaseLinkGate(false)
    await discardLocalIdentity()

    const { error: restoreError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (restoreError) {
      setError('Could not finish switching accounts. Sign in with your password.')
      setBusy(null)
      return
    }
    // setSession fires SIGNED_IN, not PASSWORD_RECOVERY — that event only ever
    // fires at the exchange, so the reset prompt has to be re-armed by hand.
    if (incoming.kind === 'recovery') setPasswordRecovery(true)
    setBusy(null)
  }, [busy, incoming, discardLocalIdentity, setPasswordRecovery])

  const handleDecline = useCallback(async () => {
    if (busy) return
    setBusy('decline')
    releaseLinkGate(false)
    if (incumbentSession) {
      // Put the incumbent's session back exactly as it was before the exchange.
      await supabase.auth.setSession(incumbentSession).catch(() => {})
    } else {
      // Nothing live to restore (the incumbent was already locked out of its
      // Supabase session); drop the foreign one so it can't be resumed.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    }
    setBusy(null)
  }, [busy, incumbentSession])

  if (!holding || !incoming) return null

  const isRecovery = incoming.kind === 'recovery'

  return (
    <div
      className="fixed inset-0 z-[9999] bg-themewhite overflow-y-auto select-none"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-full bg-themeblue2/10 flex items-center justify-center mb-4">
              <UserCog size={26} className="text-themeblue2" />
            </div>
            <h1 className="text-xl font-bold text-primary tracking-wide">Different account</h1>
            <p className="text-sm text-tertiary mt-2 text-center">
              {isRecovery
                ? 'That password reset link is for another account.'
                : 'That sign-in link is for another account.'}
            </p>
          </div>

          <div className="rounded-2xl bg-themewhite2 overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-themegray1/20">
              <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">
                Signed in here
              </p>
              <p className="text-sm text-primary mt-0.5 truncate">{incumbent?.email}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">
                Link is for
              </p>
              <p className="text-sm text-primary mt-0.5 truncate">{incoming.email || 'another account'}</p>
            </div>
          </div>

          <ErrorDisplay message={error} centered />

          <div className="mb-6 p-3 rounded-lg bg-themeyellow/10 border border-themeyellow/20">
            <p className="text-[10pt] text-primary leading-relaxed">
              Continuing signs this device out of{' '}
              <span className="font-medium">{incumbent?.email}</span> and erases its
              messages and offline data from this browser. Anything not yet synced is lost.
            </p>
          </div>

          {busy ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <LoadingSpinner className="text-themeblue2/50" />
              <p className="text-sm text-tertiary">
                {busy === 'switch' ? 'Switching accounts…' : 'Keeping this account…'}
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={handleSwitch}
                className="w-full py-3 rounded-2xl bg-themeblue3 text-white text-sm font-medium active:scale-95 transition-all"
              >
                Continue as {incoming.email || 'the other account'}
              </button>
              <button
                onClick={handleDecline}
                className="w-full mt-3 py-3 rounded-2xl bg-themewhite2 text-primary text-sm font-medium active:scale-95 transition-all"
              >
                Stay signed in as {incumbent?.email}
              </button>
              <p className="text-[10pt] text-tertiary mt-4 text-center leading-relaxed">
                {isRecovery ? 'Reset links' : 'Sign-in links'} can only be used once. Staying
                here means a new one has to be requested to finish that reset.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
