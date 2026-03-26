/**
 * Session Cleanup — browser-mode auto-logout on tab/window close.
 *
 * When the app runs in a regular browser tab (not an installed PWA),
 * this module distinguishes **refresh** from **tab close** using sessionStorage:
 *
 *   pagehide → stash cleanup data in localStorage + set sessionStorage marker
 *   next page load →
 *     • sessionStorage marker exists  → refresh (clear stash, skip cleanup)
 *     • sessionStorage marker missing → tab was closed (execute deferred cleanup)
 *
 * sessionStorage survives same-tab navigations/refreshes but is destroyed on
 * tab close, making it a reliable discriminator.
 *
 * The Supabase client uses an encrypted IDB storage adapter (see supabase.ts),
 * so auth tokens are encrypted at rest. On tab close detection, this module
 * also removes the encrypted session from IDB and handles server-side
 * cleanup (device unregistration + token invalidation).
 */

import { isPWA } from './supabase'
import { secureRemove } from './secureStorage'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('SessionCleanup')

const UNLOAD_MARKER = '_session_unloading'
const CLEANUP_STASH  = '_session_cleanup_data'

let cachedAccessToken: string | null = null
let cachedDeviceId: string | null = null
let isPrimaryDevice = false
let cachedClinicDeviceId: string | null = null
let registered = false

/** Update the cached access token (call on every auth state change / token refresh). */
export function updateCleanupToken(accessToken: string | null): void {
  cachedAccessToken = accessToken
}

/** Update the cached device ID (call after Signal bundle initialization). */
export function updateCleanupDeviceId(deviceId: string | null): void {
  cachedDeviceId = deviceId
}

/** Update whether this is a primary device (primary devices skip cleanup on pagehide). */
export function updateCleanupIsPrimary(primary: boolean): void {
  isPrimaryDevice = primary
}

/** Update the cached clinic device ID (call after clinic device init). */
export function updateCleanupClinicDeviceId(clinicDeviceId: string | null): void {
  cachedClinicDeviceId = clinicDeviceId
}

/** Fire best-effort keepalive requests to clean up server-side state. */
function performCleanup(token: string, deviceId: string | null, clinicDeviceId?: string | null): void {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Authorization': `Bearer ${token}`,
  }

  // 1. Clean up device registration + key bundle (best-effort)
  if (deviceId) {
    fetch(`${url}/rest/v1/rpc/self_cleanup_device`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_device_id: deviceId }),
      keepalive: true,
    }).catch(() => {})
  }

  // 1b. Clean up clinic device registration + key bundle (best-effort)
  if (clinicDeviceId) {
    fetch(`${url}/rest/v1/rpc/self_cleanup_clinic_device`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_clinic_device_id: clinicDeviceId }),
      keepalive: true,
    }).catch(() => {})
  }

  // 2. Invalidate the refresh token server-side (best-effort)
  fetch(`${url}/auth/v1/logout`, {
    method: 'POST',
    headers,
    keepalive: true,
  }).catch(() => {})
}

/**
 * pagehide handler — stash cleanup data instead of firing immediately.
 *
 * Sets a sessionStorage marker that survives refresh but is destroyed on
 * tab close.  The actual cleanup decision happens on the next page load.
 */
function handlePageHide(event: PageTransitionEvent): void {
  // Primary devices never stash cleanup data — prevents browser tabs on the
  // same machine as PWA from cleaning up the shared deviceId (shared IDB).
  if (isPrimaryDevice) return
  // If the page might be restored from bfcache, don't touch anything
  if (event.persisted) return
  if (!cachedAccessToken) return

  // Mark that an unload is in progress (survives refresh, lost on close)
  try { sessionStorage.setItem(UNLOAD_MARKER, '1') } catch { /* ignore */ }

  // Stash cleanup data so a future fresh tab can execute it
  try {
    localStorage.setItem(CLEANUP_STASH, JSON.stringify({
      token: cachedAccessToken,
      deviceId: cachedDeviceId,
      clinicDeviceId: cachedClinicDeviceId,
      ts: Date.now(),
    }))
  } catch { /* ignore */ }
}

/**
 * Remove the Supabase session key from encrypted IDB after a browser tab close.
 * The key format is `sb-{project-ref}-auth-token` (set by @supabase/supabase-js).
 */
function removeSupabaseSessionFromIdb(): void {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string
    const hostname = new URL(url).hostname
    const projectRef = hostname.split('.')[0]
    const storageKey = `sb-${projectRef}-auth-token`
    secureRemove(storageKey).catch(() => {})
    // Also remove the -user suffix key that Supabase may use
    secureRemove(`${storageKey}-user`).catch(() => {})
  } catch { /* best effort */ }
}

/**
 * Register the pagehide cleanup handler. No-ops if already registered or in PWA mode.
 * Call once during app initialization.
 *
 * On page load this also resolves the refresh-vs-close question from the
 * previous unload (if any).
 */
export function registerSessionCleanup(): void {
  if (registered || isPWA) return
  registered = true

  // ── Resolve previous unload ────────────────────────────────────
  const wasRefresh = sessionStorage.getItem(UNLOAD_MARKER)

  if (wasRefresh) {
    // sessionStorage survived → this is a refresh, NOT a close.
    // Discard the stashed cleanup data — the session is still valid.
    sessionStorage.removeItem(UNLOAD_MARKER)
    localStorage.removeItem(CLEANUP_STASH)
    logger.info('Page refresh detected — session preserved')
  } else {
    // sessionStorage is empty → either a new tab or a tab was closed.
    // Check for stashed cleanup from a previously closed tab.
    const raw = localStorage.getItem(CLEANUP_STASH)
    if (raw) {
      localStorage.removeItem(CLEANUP_STASH)
      try {
        const { token, deviceId, clinicDeviceId, ts } = JSON.parse(raw) as {
          token: string; deviceId: string | null; clinicDeviceId: string | null; ts: number
        }
        const age = Date.now() - ts
        // Only clean up if the stash is recent (< 5 minutes).
        // Older entries likely expired naturally or were handled by heartbeat.
        if (age < 5 * 60 * 1000 && token) {
          logger.info(`Executing deferred session cleanup (stale by ${Math.round(age / 1000)}s)`)
          performCleanup(token, deviceId, clinicDeviceId)
          // Remove encrypted Supabase session from IDB (browser tab was closed)
          removeSupabaseSessionFromIdb()
        } else {
          logger.info('Stale cleanup data discarded (too old)')
        }
      } catch {
        // Malformed stash — ignore
      }
    }
  }

  // ── Register for future unloads ────────────────────────────────
  window.addEventListener('pagehide', handlePageHide)
  logger.info('Browser mode: session cleanup registered (deferred on close)')
}
