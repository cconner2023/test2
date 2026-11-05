/**
 * Silent session restore — 2-tier background recovery for dead Supabase sessions.
 *
 * Called when `localSession` exists but `user` is null (iOS kill, IDB eviction,
 * token expiry). Tries to recover without any user interaction:
 *
 *   Tier 1 — Supabase refreshSession()
 *     Works if the refresh token still lives in encrypted IDB. Free, instant.
 *
 *   Tier 2 — Device-credential restore (Edge Function)
 *     Validates device registration (72h TTL) and issues a fresh session via
 *     Admin SDK. Requires the device to have been active within the window.
 *
 * Returns 'ok' if a session was restored (onAuthStateChange will fire),
 * 'retry' if the server couldn't be reached (offline / lie-fi / captive portal —
 * the refresh token is intact, try again when connectivity returns),
 * or 'needs-reauth' if the user must provide a credential manually.
 */

import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { LocalSession } from '../stores/useAuthStore'

/** Attempt Supabase's built-in token refresh. */
export async function tryRefreshSession(): Promise<'ok' | 'retry' | 'fail'> {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session) return 'ok'
    return error && isAuthRetryableFetchError(error) ? 'retry' : 'fail'
  } catch {
    return 'retry'
  }
}

/** Attempt device-credential restore via Edge Function. Returns true on success.
 *
 * DISABLED: the `device-session-restore` Edge Function is not deployed on this
 * project, so the invoke always 404s and returns false — pure wasted round-trips
 * (and a steady stream of 404s in the edge logs) on every silent-restore attempt.
 * Short-circuit to false until/unless the function is actually deployed; re-enable
 * by restoring the invoke below. Tier 1 (refreshSession) remains the live path. */
export async function tryDeviceRestore(_localSession: LocalSession): Promise<boolean> {
  return false
}

/**
 * Run both silent restore tiers in sequence.
 * A network-level refresh failure returns 'retry' — never escalate an
 * unreachable server into a reauth prompt.
 */
export async function attemptSilentRestore(
  localSession: LocalSession
): Promise<'ok' | 'retry' | 'needs-reauth'> {
  const refresh = await tryRefreshSession()
  if (refresh === 'ok') return 'ok'
  if (await tryDeviceRestore(localSession)) return 'ok'
  return refresh === 'retry' ? 'retry' : 'needs-reauth'
}
