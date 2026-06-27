import { useCallback, useEffect, useState } from 'react'
import { fetchSubClusters, type SubCluster } from '../lib/subClusterService'
import { useAuthStore } from '../stores/useAuthStore'
import { useInvalidation } from '../stores/useInvalidationStore'

/**
 * The caller's clinic sub-cluster list (platoon/squad groups). RLS-scoped to the
 * own clinic. Refetches when the `subClusters` invalidation generation bumps
 * (create/rename/delete). Render-only grouping layer — see v2/supervisor.
 */
export function useSubClusters() {
  const userId = useAuthStore(s => s.user?.id ?? null)
  const gen = useInvalidation('subClusters')
  const [subClusters, setSubClusters] = useState<SubCluster[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!userId) { setSubClusters([]); return }
    setLoading(true)
    const res = await fetchSubClusters()
    if (res.ok) setSubClusters(res.data)
    setLoading(false)
  }, [userId])

  useEffect(() => { void load() }, [load, gen])

  return { subClusters, loading, refresh: load }
}
