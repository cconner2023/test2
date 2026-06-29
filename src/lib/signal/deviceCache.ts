/**
 * localStorage cache for the caller's own registered-device list.
 *
 * SessionsDevicesPanel previously showed a full-screen loader on every open while
 * fetchOwnDevicesWithRole round-tripped — the list is tiny and changes rarely, so
 * a blocking spinner on a re-open is the wrong treatment. We cache the last-known
 * list per user, paint it instantly, then reconcile with a background fetch.
 *
 * NOT on deltaCache: device removal is a HARD delete (signalService.unregisterDevice
 * deletes the user_devices row), and an updated_at delta can't carry a hard delete
 * (the row just stops appearing in .gt(updated_at), so other readers keep it forever).
 * deltaCache's contract REQUIRES soft-delete tombstones. So this is a plain
 * cache-first list: serve the cache, fetch the full set in the background, replace.
 *
 * Synchronous load (localStorage is sync) so the panel can seed initial state
 * without a render flash. Mirrors subClusterCache's "paint cached, refresh quietly"
 * rationale; cleared on sign-out alongside the other account-scoped caches.
 */

import { createLogger } from '../../Utilities/Logger'
import type { DeviceWithRole } from './deviceService'

const logger = createLogger('DeviceCache')

const LS_PREFIX = 'adtmc_device_cache_v1'
const lsKey = (userId: string) => `${LS_PREFIX}:${userId}`

/** Last-known device list for this user, or empty array on miss/parse failure. */
export function loadCachedDevices(userId: string): DeviceWithRole[] {
  try {
    const raw = localStorage.getItem(lsKey(userId))
    if (!raw) return []
    const rows = JSON.parse(raw) as unknown
    return Array.isArray(rows) ? (rows as DeviceWithRole[]) : []
  } catch (err) {
    logger.warn('Failed to load cached devices:', err)
    return []
  }
}

/** Replace the cached device list for this user. */
export function saveCachedDevices(userId: string, devices: DeviceWithRole[]): void {
  try {
    localStorage.setItem(lsKey(userId), JSON.stringify(devices))
  } catch (err) {
    // Quota / private mode — best effort; the live fetch still drives the UI.
    logger.warn('Failed to save cached devices:', err)
  }
}

/** Wipe every cached device list. Called on sign-out with the other caches. */
export function clearDeviceCache(): void {
  try {
    const p = `${LS_PREFIX}:`
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(p)) localStorage.removeItem(k)
    }
  } catch (err) {
    logger.warn('Failed to clear device cache:', err)
  }
}
