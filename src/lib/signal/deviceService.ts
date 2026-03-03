/**
 * Device service — fetches the current user's devices with role info.
 *
 * Queries user_devices directly (instead of fetch_peer_devices RPC)
 * so we get the is_primary column that the RPC doesn't return.
 */

import { supabase } from '../supabase'
import { ok, err, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('DeviceService')

export interface DeviceWithRole {
  deviceId: string
  deviceLabel: string | null
  lastActiveAt: string
  isPrimary: boolean
}

/** Fetch all devices for the given user, including the is_primary flag. */
export async function fetchOwnDevicesWithRole(
  userId: string
): Promise<Result<DeviceWithRole[]>> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('device_id, device_label, last_active_at, is_primary')
      .eq('user_id', userId)

    if (error) {
      logger.warn('fetchOwnDevicesWithRole failed:', error.message)
      return err(error.message)
    }

    const devices: DeviceWithRole[] = (data ?? []).map((row) => ({
      deviceId: row.device_id as string,
      deviceLabel: row.device_label as string | null,
      lastActiveAt: row.last_active_at as string,
      isPrimary: row.is_primary as boolean,
    }))

    return ok(devices)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.warn('fetchOwnDevicesWithRole exception:', msg)
    return err(msg)
  }
}
