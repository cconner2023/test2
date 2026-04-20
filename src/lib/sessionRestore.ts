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

/** Attempt device-credential restore via Edge Function. Returns true on success. */
export async function tryDeviceRestore(localSession: LocalSession): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('device-session-restore', {
      body: { user_id: localSession.userId, device_id: localSession.deviceId },
    })
    if (error || !data?.access_token || !data?.refresh_token) return false

    const { error: setError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })
    return !setError
  } catch {
    return false
  }
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
