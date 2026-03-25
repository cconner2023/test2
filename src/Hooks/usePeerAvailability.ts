/**
 * usePeerAvailability — checks which peers have registered devices and key bundles.
 *
 * Offline-first: hydrates from localStorage cache immediately, then fetches
 * from the server in the background and silently updates. Progressive rechecks
 * at 5s and 15s catch peers whose vaults were still being created.
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type UnavailableReason = 'no_device' | 'no_keys'

const RECHECK_DELAYS_MS = [5_000, 15_000]
const CACHE_KEY = 'adtmc_peer_availability'

// ---- Cache helpers ----

type CachedEntry = { reason: UnavailableReason; ts: number }
type CacheShape = Record<string, CachedEntry>

function readCache(): CacheShape {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return JSON.parse(raw) as CacheShape
  } catch { /* ignore */ }
  return {}
}

function writeCache(map: Map<string, UnavailableReason>): void {
  try {
    const now = Date.now()
    const cache = readCache()
    // Merge: update entries that are still unavailable, remove ones that became available
    const freshIds = new Set<string>()
    for (const [id, reason] of map) {
      cache[id] = { reason, ts: now }
      freshIds.add(id)
    }
    // Prune entries older than 1 hour (stale peers that logged in long ago)
    const pruneThreshold = now - 60 * 60 * 1000
    for (const id of Object.keys(cache)) {
      if (!freshIds.has(id) && cache[id].ts < pruneThreshold) {
        delete cache[id]
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore — offline storage may be full */ }
}

/** Remove peers from cache that are now available. */
function evictFromCache(availableIds: string[]): void {
  try {
    const cache = readCache()
    let changed = false
    for (const id of availableIds) {
      if (id in cache) {
        delete cache[id]
        changed = true
      }
    }
    if (changed) localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore */ }
}

function hydrateFromCache(userIds: string[]): Map<string, UnavailableReason> {
  const cache = readCache()
  const map = new Map<string, UnavailableReason>()
  for (const id of userIds) {
    if (id in cache) {
      map.set(id, cache[id].reason)
    }
  }
  return map
}

// ---- Server fetch ----

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

// ---- Hook ----

export function usePeerAvailability(medicIds: string[]): Map<string, UnavailableReason> {
  // Compute a stable sorted key for dedup — also used for cache hydration
  const sorted = medicIds.length > 0 ? [...new Set(medicIds)].sort() : []
  const key = sorted.join(',')

  // Initialize state directly from localStorage cache — synchronous, no flash
  const [unavailableMap, setUnavailableMap] = useState<Map<string, UnavailableReason>>(
    () => sorted.length > 0 ? hydrateFromCache(sorted) : new Map()
  )
  const prevKeyRef = useRef(key)

  // Re-hydrate from cache when the input list changes
  if (key !== prevKeyRef.current) {
    prevKeyRef.current = key
    const cached = sorted.length > 0 ? hydrateFromCache(sorted) : new Map<string, UnavailableReason>()
    setUnavailableMap(cached)
  }

  useEffect(() => {
    if (sorted.length === 0) return

    // Background server fetch + silent update
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    async function refresh() {
      const serverMap = await fetchAvailability(sorted)
      if (cancelled) return

      // Persist to cache
      writeCache(serverMap)

      // Evict peers that are now available
      const nowAvailable = sorted.filter(id => !serverMap.has(id))
      if (nowAvailable.length > 0) evictFromCache(nowAvailable)

      // Silent update — only set state if data actually changed
      setUnavailableMap(prev => {
        if (prev.size !== serverMap.size) return serverMap
        for (const [id, reason] of serverMap) {
          if (prev.get(id) !== reason) return serverMap
        }
        return prev
      })

      // Progressive rechecks for still-unavailable peers
      if (serverMap.size > 0) {
        let currentMap = serverMap

        for (const delay of RECHECK_DELAYS_MS) {
          const timer = setTimeout(async () => {
            if (cancelled) return
            const stillUnavailable = [...currentMap.keys()]
            if (stillUnavailable.length === 0) return

            const refreshed = await fetchAvailability(stillUnavailable)
            if (cancelled) return

            if (refreshed.size < currentMap.size) {
              currentMap = refreshed
              writeCache(refreshed)
              const resolved = stillUnavailable.filter(id => !refreshed.has(id))
              if (resolved.length > 0) evictFromCache(resolved)
              setUnavailableMap(refreshed)
            }
          }, delay)
          timers.push(timer)
        }
      }
    }

    refresh()
    return () => {
      cancelled = true
      for (const timer of timers) clearTimeout(timer)
    }
  }, [medicIds])

  return unavailableMap
}
