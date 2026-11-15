/**
 * Activity Heartbeat
 *
 * Periodically updates profiles.last_active_at (and this device's user_devices
 * rows) while the app is in the foreground. One send per MIN_ELAPSED_MS at most,
 * across boot, tab re-focus and the tick; the gate is persisted so reloads and
 * resumes don't each force a send. Every send is a billed gateway log line per
 * row, so keep it sparse.
 *
 * Users can opt out of activity tracking in Security settings.
 * Accounts with no activity for 90+ days may be deactivated.
 *
 * EGRESS: piggybacks a gated stale-clinic-device reap on the heartbeat.
 * Clinic-vault fan-out targets = every user_devices row for the clinic
 * (fetch_peer_devices is unfiltered), and staleness is otherwise only
 * cleaned at login. On a long-lived session, devices that go dark after
 * login keep drawing a full sealed envelope per edit until the next login.
 * Firing cleanup_stale_clinic_devices on a 30-min gate (matching its TTL)
 * sweeps the roster mid-session, shrinking fan-out. The reap RPC is tiny
 * and idempotent; culled clinic devices rebuild from the vault snapshot on
 * return, so this is a timing change only — same safe op login already runs.
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('ActivityHeartbeat')

// The tick is local and cheap; MIN_ELAPSED_MS is the real send rate. Worst-case
// gap between sends is tick + min-elapsed (15 min), which must stay well inside
// the 30-min stale-device TTL of cleanup_stale_clinic_devices /
// cleanup_stale_linked_devices or a foregrounded device gets reaped.
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000
const MIN_ELAPSED_MS = 10 * 60 * 1000
const REAP_INTERVAL_MS = 30 * 60 * 1000     // stale-clinic-device reap gate (matches the 30-min TTL)

const ACTIVITY_TRACKING_KEY = 'adtmc_activity_tracking_enabled'

let intervalId: ReturnType<typeof setInterval> | null = null
let lastSentAt = 0

const lastSentKey = (userId: string) => `adtmc_heartbeat_at:${userId}`

function readLastSent(userId: string): number {
  const v = Number(localStorage.getItem(lastSentKey(userId)))
  return Number.isFinite(v) ? v : 0
}
/** Last time the stale-clinic-device reap fired (ms). Gated to REAP_INTERVAL_MS. */
let lastReapAt = 0
let currentUserId: string | null = null
let currentDeviceId: string | null = null
/** clinicId → clinicDeviceId. Multi-entry to support dual-clinic membership (surrogate). */
const currentClinicDevices = new Map<string, string>()

/** Check if the user has opted out of activity tracking */
export function isActivityTrackingEnabled(): boolean {
  const stored = localStorage.getItem(ACTIVITY_TRACKING_KEY)
  // Default to enabled if never set
  return stored !== 'false'
}

/** Toggle activity tracking on/off */
export function setActivityTrackingEnabled(enabled: boolean) {
  localStorage.setItem(ACTIVITY_TRACKING_KEY, String(enabled))
  // If disabling while heartbeat is running, stop it
  if (!enabled) stopHeartbeat()
}

/**
 * Register a clinic device for heartbeat. Multi-entry: callable once per
 * clinic the user belongs to (assigned + surrogate). Re-registering the
 * same clinicId updates its device id.
 */
export function updateHeartbeatClinicDevice(clinicId: string, clinicDeviceId: string): void {
  currentClinicDevices.set(clinicId, clinicDeviceId)
}

/** Drop heartbeat tracking for a clinic (e.g. surrogate revoked). */
export function clearHeartbeatClinicDevice(clinicId: string): void {
  currentClinicDevices.delete(clinicId)
}

async function sendHeartbeat() {
  if (!currentUserId) return
  if (!isActivityTrackingEnabled()) return
  const now = Date.now()
  if (now - lastSentAt < MIN_ELAPSED_MS) return

  try {
    const ts = new Date().toISOString()

    const { error } = await supabase
      .from('profiles')
      .update({ last_active_at: ts })
      .eq('id', currentUserId)

    if (!error) {
      lastSentAt = now
      try { localStorage.setItem(lastSentKey(currentUserId), String(now)) } catch { /* ignore */ }
    }
    else logger.warn('Heartbeat update failed:', error.message)

    // Also update device last_active_at if device is registered
    if (currentDeviceId) {
      supabase
        .from('user_devices')
        .update({ last_active_at: ts })
        .eq('user_id', currentUserId)
        .eq('device_id', currentDeviceId)
        .then(({ error: devErr }) => {
          if (devErr) logger.warn('Device heartbeat update failed:', devErr.message)
        })
    }

    // Also update clinic device last_active_at for every registered clinic
    // (assigned + surrogate). One row per clinic; same device_id across them.
    for (const [clinicId, clinicDeviceId] of currentClinicDevices) {
      supabase
        .from('user_devices')
        .update({ last_active_at: ts })
        .eq('user_id', clinicId)
        .eq('device_id', clinicDeviceId)
        .then(({ error: clinicErr }) => {
          if (clinicErr) logger.warn(`Clinic device heartbeat update failed (${clinicId}):`, clinicErr.message)
        })
    }

    // Gated stale-clinic-device reap (this device's row was just refreshed
    // above, so it is never the target). Shrinks the clinic-vault fan-out set
    // mid-session; gate matches the reaper's 30-min TTL so the added egress is
    // one tiny idempotent RPC per clinic per half hour. Set lastReapAt before
    // firing so a slow import can't double-trigger on the next tick.
    if (currentClinicDevices.size > 0 && now - lastReapAt >= REAP_INTERVAL_MS) {
      lastReapAt = now
      const clinicIds = Array.from(currentClinicDevices.keys())
      import('./signal/signalService')
        .then(({ cleanupStaleClinicDevices }) => {
          for (const cId of clinicIds) cleanupStaleClinicDevices(cId).catch(() => {})
        })
        .catch(() => {})
    }

    // Echelon readiness-summary publish (downtrace fan-out) — DELTA-GATED, no
    // timer. Runs every heartbeat (already throttled to ~MIN_ELAPSED by the guard
    // at the top), but the REAL gates are inside publishReadinessSummary: a
    // cached parent lookup, a 30-min recompute gate, and then it fans ONLY when
    // the recomputed rollup moved vs the
    // last-sent key (roster changed / a percentage changed). If a prior summary
    // exists and nothing changed, the fan is skipped — a stable cluster emits
    // zero egress between real changes. The recompute is read-only; the first
    // post-login heartbeat backfills the parent. Fire-and-forget, per registered
    // clinic (home + surrogate).
    if (currentUserId && currentClinicDevices.size > 0) {
      const uid = currentUserId
      const clinicIds = Array.from(currentClinicDevices.keys())
      import('./echelonVault')
        .then(({ publishReadinessSummary }) => {
          for (const cId of clinicIds) publishReadinessSummary(uid, cId).catch(() => {})
        })
        .catch(() => {})
    }
  } catch {
    // Network error — silently skip, will retry next interval
  }
}

/** lastSentAt as it stood when the page last became visible, captured before
 *  the resume beat goes out. 0 = heartbeat not running. */
let lastSentAtResume = 0

/**
 * How long this device's rows had gone unrefreshed when the page last resumed.
 * The stale-device reapers delete user_devices + key bundles after 30 min
 * without a beat, so a resume past that may find this device (personal linked
 * or clinic) already gone. useAuthStore re-runs the login pipeline then, which
 * re-registers and re-uploads. Infinity when the heartbeat isn't running
 * (tracking opted out), so callers fall back to always re-running.
 */
export function heartbeatGapAtResumeMs(): number {
  return lastSentAtResume ? Date.now() - lastSentAtResume : Infinity
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    lastSentAtResume = lastSentAt
    sendHeartbeat()
  }
}

export function startHeartbeat(userId: string, deviceId?: string) {
  // Login calls this twice (before and after Signal init). The second call only
  // adds the device id: register_device_with_role already stamped that row's
  // last_active_at, and restarting here would wipe the clinic devices and send
  // a second profile PATCH.
  if (intervalId && currentUserId === userId) {
    if (deviceId) currentDeviceId = deviceId
    return
  }
  stopHeartbeat()
  if (!isActivityTrackingEnabled()) return
  currentUserId = userId
  currentDeviceId = deviceId ?? null
  lastSentAt = readLastSent(userId)
  // The pipeline that called us just registered this device, so it's fresh.
  lastSentAtResume = Date.now()
  // Login already ran cleanupStaleClinicDevices per clinic, so the roster is
  // fresh — arm the gate to now so the first heartbeat reap is ~30 min out,
  // not a redundant immediate call.
  lastReapAt = Date.now()

  // First heartbeat, unless one went out within MIN_ELAPSED_MS (reload/resume).
  sendHeartbeat()

  // Periodic
  intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

  // Tab re-focus
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

export function stopHeartbeat() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  currentUserId = null
  currentDeviceId = null
  lastSentAtResume = 0
  currentClinicDevices.clear()
  lastReapAt = 0
}
