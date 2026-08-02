import { useEffect, useState } from 'react'
import { loadAuditByClinicDomain } from '../lib/auditService'
import type { AuditEvent } from '../lib/auditTypes'
import { useInvalidation } from '../stores/useInvalidationStore'

/**
 * Clinic-wide recent PMCS + dispatch + expenditure activity, newest first — the
 * "what got inspected / dispatched / used up lately" feed for the DA 2062 custody
 * surface (item.expended drives the "Usage" section). Mirrors
 * useVehicleDispatches' offline-first read (loadAuditByClinicDomain — local
 * audit_log topped up by a delta pull) but, instead of folding to current state, it
 * returns the raw events so the custody panel can list them and hand each one to
 * RecordPreview (view 5988E / dispatch form, delete). Re-runs on `properties`
 * invalidation so a freshly recorded PMCS/dispatch shows up immediately.
 *
 * Only the activity event types within the window are returned. Empty when
 * clinicId is null. `now` is stamped per run so the window is relative.
 */
const ACTIVITY_EVENT_TYPES = new Set<string>([
  'pmcs.clear',
  'dispatch.opened',
  'dispatch.closed',
  'item.expended', // consumables used/expended — the custody panel's "Usage" feed
])

/** How far back the custody activity feed reaches — "this week". */
export const ACTIVITY_WINDOW_DAYS = 7

export function useRecentPropertyActivity(clinicId: string | null): AuditEvent[] {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const propGen = useInvalidation('properties')

  useEffect(() => {
    if (!clinicId) { setEvents([]); return }
    let cancelled = false
    ;(async () => {
      const events = await loadAuditByClinicDomain(clinicId, 'property')
      if (cancelled) return
      const cutoff = Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000
      const recent = events
        .filter((e) => ACTIVITY_EVENT_TYPES.has(e.eventType))
        .filter((e) => new Date(e.occurredAt).getTime() >= cutoff)
        .sort((a, b) => {
          if (a.seq != null && b.seq != null) return b.seq - a.seq
          return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        })
      setEvents(recent)
    })()
    return () => { cancelled = true }
  }, [clinicId, propGen])

  return events
}
