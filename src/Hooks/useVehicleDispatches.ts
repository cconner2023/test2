import { useEffect, useState } from 'react'
import { loadAuditByClinicDomain } from '../lib/auditService'
import { useInvalidation } from '../stores/useInvalidationStore'
import { foldOpenDispatches, type OpenDispatch } from '../lib/dispatchFold'

/**
 * Clinic-wide fold of CURRENT open vehicle dispatches → keyed by vehicle location
 * id. Feeds the red-dot on vehicle rows (tree / list / map) and the calendar
 * exp-date derivation. Offline-first: local audit_log topped up by a delta
 * read_audit pull, then refolded. Re-runs on `properties` invalidation
 * (the store bumps it after open/close/delete) so the dot stays live. `now` is
 * stamped per run so expiring/expired status reflects the current time.
 *
 * Empty map when clinicId is null. Only vehicles WITH an open dispatch appear.
 */
export function useVehicleDispatches(clinicId: string | null): Map<string, OpenDispatch> {
  const [map, setMap] = useState<Map<string, OpenDispatch>>(() => new Map())
  const propGen = useInvalidation('properties')

  useEffect(() => {
    if (!clinicId) { setMap(new Map()); return }
    let cancelled = false
    ;(async () => {
      const events = await loadAuditByClinicDomain(clinicId, 'property')
      if (cancelled) return
      setMap(foldOpenDispatches(events, Date.now()))
    })()
    return () => { cancelled = true }
  }, [clinicId, propGen])

  return map
}
