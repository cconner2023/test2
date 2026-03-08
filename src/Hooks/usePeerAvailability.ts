/**
 * usePeerAvailability — checks which peers have registered devices.
 *
 * Calls the `check_users_messageable` RPC with all medic IDs in a single
 * batch query. Returns a Set of user IDs that have NO devices and thus
 * cannot receive encrypted messages.
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function usePeerAvailability(medicIds: string[]): Set<string> {
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set())
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

      const unavailable = new Set<string>()
      for (const row of data as { user_id: string; has_devices: boolean }[]) {
        if (!row.has_devices) unavailable.add(row.user_id)
      }
      setUnavailableIds(unavailable)
    }

    check()
    return () => { cancelled = true }
  }, [medicIds])

  return unavailableIds
}
