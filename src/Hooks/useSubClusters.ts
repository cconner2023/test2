import { useCallback, useEffect, useState } from 'react'
import { fetchSubClusters, type SubCluster } from '../lib/subClusterService'
import { useAuthStore } from '../stores/useAuthStore'
import { useInvalidation } from '../stores/useInvalidationStore'
import { loadCachedSubClusters, saveCachedSubClusters } from '../lib/subClusterCache'

/**
 * The caller's clinic sub-cluster list (platoon/squad groups). RLS-scoped to the
 * own clinic. Render-only grouping layer — see v2/supervisor.
 *
 * STALE-WHILE-REVALIDATE (mirrors useClinicLoans / useClinicMedics): ~9 mount
 * points read this list (calendar, property, messages, supervisor, clinic
 * settings) to drive collapsible roster trees. Previously each mount fired its
 * own `fetchSubClusters` select starting from `[]`, so every panel flashed its
 * roster flat → grouped while the query resolved, and concurrent panels stacked
 * duplicate selects.
 *
 * Now reads through a shared in-memory snapshot keyed by (userId, `subClusters`
 * generation): the first consumer in a generation fetches; the rest reuse the
 * resolved list synchronously on mount (no flash, no duplicate query). An IDB
 * cache hydrates the snapshot on cold start so the tree paints instantly even on
 * the first open after a reload, with a silent background refresh. A
 * create/rename/delete bumps the `subClusters` generation → new key → one shared
 * refetch across all consumers.
 */

// Resolved lists + in-flight promises, keyed `${userId}::${gen}`. Module-scoped
// so every concurrent mount shares one fetch and one cached result.
const snapshots = new Map<string, SubCluster[]>()
const inflight = new Map<string, Promise<SubCluster[]>>()
// IDB hydrated at most once per session (the persisted list is generation-agnostic
// "last known", so it only seeds the very first cold paint).
let idbHydrated = false

/** Drop the in-memory snapshots on sign-out so a new account never reads the
 *  previous user's sub-clusters. The IDB cache is cleared separately. */
export function clearSubClusterSnapshots(): void {
  snapshots.clear()
  inflight.clear()
  idbHydrated = false
}

function fetchAndCache(key: string, clinicId: string): Promise<SubCluster[]> {
  const existing = inflight.get(key)
  if (existing) return existing

  const p = fetchSubClusters(clinicId)
    .then(res => {
      inflight.delete(key)
      // Don't cache failures — let the next mount retry instead of pinning [].
      if (!res.ok) return snapshots.get(key) ?? []
      snapshots.set(key, res.data)
      // Bound the map: drop older generations for this user.
      const prefix = key.split('::')[0] + '::'
      for (const k of snapshots.keys()) {
        if (k !== key && k.startsWith(prefix)) snapshots.delete(k)
      }
      void saveCachedSubClusters(res.data)
      return res.data
    })
    .catch(() => {
      inflight.delete(key)
      return snapshots.get(key) ?? []
    })

  inflight.set(key, p)
  return p
}

export function useSubClusters() {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const clinicId = useAuthStore(s => s.clinicId)
  const gen = useInvalidation('subClusters')
  // clinicId is part of the key so a home-clinic change yields a fresh key →
  // fresh fetch, and never reuses the previous clinic's in-memory snapshot
  // (a clinic switch bumps neither userId nor the generation counter).
  const key = userId && clinicId ? `${userId}::${clinicId}::${gen}` : ''
  const [subClusters, setSubClusters] = useState<SubCluster[]>(() => (key && snapshots.get(key)) || [])
  // Cold start (no snapshot for this generation yet) shows the spinner; warm
  // remounts and cache hits paint instantly without one.
  const [loading, setLoading] = useState(() => !!key && !snapshots.has(key))

  const load = useCallback(async () => {
    if (!key || !clinicId) { setSubClusters([]); setLoading(false); return }

    const cached = snapshots.get(key)
    if (cached) { setSubClusters(cached); setLoading(false); return }

    // No snapshot yet for this generation. Seed from IDB once for an instant
    // first paint, then refresh from the network and adopt the fresh list.
    if (!idbHydrated) {
      idbHydrated = true
      const persisted = await loadCachedSubClusters()
      if (persisted.length > 0 && !snapshots.has(key)) setSubClusters(persisted)
    }
    const fresh = await fetchAndCache(key, clinicId)
    setSubClusters(fresh)
    setLoading(false)
  }, [key, clinicId])

  useEffect(() => { void load() }, [load])

  // Force a network refetch regardless of cache (e.g. pull-to-refresh). Mutations
  // should prefer invalidate('subClusters'), which refreshes every consumer.
  const refresh = useCallback(async () => {
    if (!key || !clinicId) return
    snapshots.delete(key)
    inflight.delete(key)
    setLoading(true)
    const fresh = await fetchAndCache(key, clinicId)
    setSubClusters(fresh)
    setLoading(false)
  }, [key, clinicId])

  return { subClusters, loading, refresh }
}
