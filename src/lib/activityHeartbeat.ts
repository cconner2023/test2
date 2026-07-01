/**
 * Activity Heartbeat
 *
 * Periodically updates profiles.last_active_at while the app is in
 * the foreground. Throttled to once every 5 minutes to avoid
 * excessive writes. Also fires on visibility-change (tab re-focus)
 * so the timestamp is fresh even if the user was away.
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

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MIN_ELAPSED_MS = 4 * 60 * 1000        // guard against double-fires
const REAP_INTERVAL_MS = 30 * 60 * 1000     // stale-clinic-device reap gate (matches the 30-min TTL)

const ACTIVITY_TRACKING_KEY = 'adtmc_activity_tracking_enabled'

let intervalId: ReturnType<typeof setInterval> | null = null
let lastSentAt = 0
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

    if (!error) lastSentAt = now
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
  } catch {
    // Network error — silently skip, will retry next interval
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    sendHeartbeat()
  }
}

export function startHeartbeat(userId: string, deviceId?: string) {
  stopHeartbeat()
  if (!isActivityTrackingEnabled()) return
  currentUserId = userId
  currentDeviceId = deviceId ?? null
  lastSentAt = 0
  // Login already ran cleanupStaleClinicDevices per clinic, so the roster is
  // fresh — arm the gate to now so the first heartbeat reap is ~30 min out,
  // not a redundant immediate call.
  lastReapAt = Date.now()

  // Immediate first heartbeat
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
  currentClinicDevices.clear()
  lastReapAt = 0
}
