import { useEffect, useMemo, useState } from 'react'
import { fetchChildClinics, type ChildClinicRow } from '../lib/echelonService'
import { getEchelonSummaries } from '../lib/offlineDb'
import { useInvalidation } from '../stores/useInvalidationStore'
import type { EchelonReadinessSummary } from '../lib/echelonSummary'

export interface ChildClinicCard {
  clinicId: string
  clinicName: string
  /** Live assigned-personnel count from the RPC (independent of publish state). */
  medicCount: number
  /** The child's last-published readiness rollup, or null if none has arrived
   *  (cluster inactive) → card shows "No active users…". */
  summary: EchelonReadinessSummary | null
}

/**
 * Direct child clusters of `clinicId` joined with any de-identified readiness
 * summaries they have fanned up (read from the parent-side IDB cache). Returns
 * [] when the clinic has no children — the caller renders nothing.
 *
 * NOTE: summaries are written by the deferred vault-consume path (see the
 * _ideas note echelon-readiness-vault-transport.md); until that ships, `summary`
 * is null and cards show the "No active users" state with live medic counts.
 */
export function useEchelonSummaries(
  clinicId: string | null,
  isSupervisor: boolean,
): { cards: ChildClinicCard[]; loading: boolean } {
  const [children, setChildren] = useState<ChildClinicRow[]>([])
  const [summaries, setSummaries] = useState<Record<string, EchelonReadinessSummary>>({})
  const [loading, setLoading] = useState(false)
  // Bumped by routeReadinessSummary when a child's rollup lands in the cache —
  // re-runs the fetch so a newly-consumed summary paints without a remount.
  const echelonGen = useInvalidation('echelon')

  useEffect(() => {
    if (!clinicId || !isSupervisor) {
      setChildren([])
      setSummaries({})
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const rows = await fetchChildClinics(clinicId)
      if (cancelled) return
      setChildren(rows)
      const sums = await getEchelonSummaries(rows.map((r) => r.id))
      if (cancelled) return
      setSummaries(Object.fromEntries(sums.map((s) => [s.source_clinic_id, s])))
    })().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [clinicId, isSupervisor, echelonGen])

  const cards = useMemo<ChildClinicCard[]>(
    () =>
      children.map((c) => ({
        clinicId: c.id,
        clinicName: c.name,
        medicCount: c.medic_count,
        summary: summaries[c.id] ?? null,
      })),
    [children, summaries],
  )

  return { cards, loading }
}
