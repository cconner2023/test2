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
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('ActivityHeartbeat')

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MIN_ELAPSED_MS = 4 * 60 * 1000        // guard against double-fires

const ACTIVITY_TRACKING_KEY = 'adtmc_activity_tracking_enabled'

let intervalId: ReturnType<typeof setInterval> | null = null
let lastSentAt = 0
let currentUserId: string | null = null

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

async function sendHeartbeat() {
  if (!currentUserId) return
  if (!isActivityTrackingEnabled()) return
  const now = Date.now()
  if (now - lastSentAt < MIN_ELAPSED_MS) return

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', currentUserId)

    if (!error) lastSentAt = now
    else logger.warn('Heartbeat update failed:', error.message)
  } catch {
    // Network error — silently skip, will retry next interval
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    sendHeartbeat()
  }
}

export function startHeartbeat(userId: string) {
  stopHeartbeat()
  if (!isActivityTrackingEnabled()) return
  currentUserId = userId
  lastSentAt = 0

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
}
