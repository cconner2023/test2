import { useEffect, useState } from 'react'
import { getLocalAuditLogs } from '../lib/offlineDb'
import { toAuditEvent, fetchAuditByClinicDomain } from '../lib/auditService'
import type { AuditEvent } from '../lib/auditTypes'
import { useInvalidation } from '../stores/useInvalidationStore'
import { foldOpenDispatches, type OpenDispatch } from '../lib/dispatchFold'

/**
 * Clinic-wide fold of CURRENT open vehicle dispatches → keyed by vehicle location
 * id. Feeds the red-dot on vehicle rows (tree / list / map) and the calendar
 * exp-date derivation. Offline-first: reads local audit_log first, merges the
 * server (read_audit) copy by id, refolds. Re-runs on `properties` invalidation
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
      const [localRows, server] = await Promise.all([
        getLocalAuditLogs(clinicId).catch(() => []),
        fetchAuditByClinicDomain(clinicId, 'property').catch(() => [] as AuditEvent[]),
      ])
      const local = await Promise.all(localRows.map(toAuditEvent)).catch(() => [] as AuditEvent[])
      if (cancelled) return
      const byId = new Map<string, AuditEvent>()
      for (const e of [...local, ...server]) byId.set(e.id, e)
      setMap(foldOpenDispatches([...byId.values()], Date.now()))
    })()
    return () => { cancelled = true }
  }, [clinicId, propGen])

  return map
}
