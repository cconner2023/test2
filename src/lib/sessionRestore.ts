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
 * or 'needs-reauth' if the user must provide a credential manually.
 */

import { supabase } from './supabase'
import type { LocalSession } from '../stores/useAuthStore'

/** Attempt Supabase's built-in token refresh. Returns true on success. */
export async function tryRefreshSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    return !error && !!data.session
  } catch {
    return false
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
 * Returns 'ok' if session was restored, 'needs-reauth' if manual auth is required.
 */
export async function attemptSilentRestore(
  localSession: LocalSession
): Promise<'ok' | 'needs-reauth'> {
  if (await tryRefreshSession()) return 'ok'
  if (await tryDeviceRestore(localSession)) return 'ok'
  return 'needs-reauth'
}
