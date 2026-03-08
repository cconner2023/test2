/**
 * usePeerAvailability — checks which peers have registered devices and key bundles.
 *
 * Calls the `check_users_messageable` RPC with all medic IDs in a single
 * batch query. Returns a Map of user IDs to unavailability reasons for users
 * that cannot receive encrypted messages.
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type UnavailableReason = 'no_device' | 'no_keys'

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

    async function check() {
      const { data, error } = await supabase.rpc('check_users_messageable', {
        p_user_ids: sorted,
      })

      if (cancelled || error || !data) return

      const map = new Map<string, UnavailableReason>()
      for (const row of data as { user_id: string; has_devices: boolean; has_keys: boolean }[]) {
        if (!row.has_devices) {
          map.set(row.user_id, 'no_device')
        } else if (!row.has_keys) {
          map.set(row.user_id, 'no_keys')
        }
      }
      setUnavailableMap(map)
    }

    check()
    return () => { cancelled = true }
  }, [medicIds])

  return unavailableMap
}
