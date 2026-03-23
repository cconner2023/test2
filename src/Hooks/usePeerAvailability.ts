/**
 * usePeerAvailability — checks which peers have registered devices and key bundles.
 *
 * Calls the `check_users_messageable` RPC with all medic IDs in a single
 * batch query. Returns a Map of user IDs to unavailability reasons for users
 * that cannot receive encrypted messages.
 *
 * If any peers are unavailable on the first check, a single delayed recheck
 * runs after 5 seconds to catch vaults that were still being created.
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type UnavailableReason = 'no_device' | 'no_keys'

const RECHECK_DELAY_MS = 5_000

async function fetchAvailability(
  userIds: string[]
): Promise<Map<string, UnavailableReason>> {
  const { data, error } = await supabase.rpc('check_users_messageable', {
    p_user_ids: userIds,
  })

  const map = new Map<string, UnavailableReason>()
  if (error || !data) return map

  for (const row of data as { user_id: string; has_devices: boolean; has_keys: boolean }[]) {
    if (!row.has_devices) {
      map.set(row.user_id, 'no_device')
    } else if (!row.has_keys) {
      map.set(row.user_id, 'no_keys')
    }
  }
  return map
}

export function usePeerAvailability(medicIds: string[]): Map<string, UnavailableReason> {
  const [unavailableMap, setUnavailableMap] = useState<Map<string, UnavailableReason>>(new Map())
  const prevKeyRef = useRef('')

  useEffect(() => {
    if (medicIds.length === 0) return

    // Dedupe + sort to create a stable cache key
    const sorted = [...new Set(medicIds)].sort()
    const key = sorted.join(',')
    if (key === prevKeyRef.current) return
    prevKeyRef.current = key

    let cancelled = false
    let recheckTimer: ReturnType<typeof setTimeout> | undefined

    async function check() {
      const map = await fetchAvailability(sorted)
      if (cancelled) return
      setUnavailableMap(map)

      // If any peers are unavailable, schedule a single recheck to catch
      // vaults that were still being created during the first query.
      if (map.size > 0) {
        const unavailableIds = [...map.keys()]
        recheckTimer = setTimeout(async () => {
          const refreshed = await fetchAvailability(unavailableIds)
          if (cancelled) return
          if (refreshed.size < map.size) {
            // Some peers became available — update the map
            setUnavailableMap(refreshed)
          }
        }, RECHECK_DELAY_MS)
      }
    }

    check()
    return () => {
      cancelled = true
      if (recheckTimer) clearTimeout(recheckTimer)
    }
  }, [medicIds])

  return unavailableMap
}
