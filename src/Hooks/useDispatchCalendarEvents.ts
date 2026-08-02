import { useEffect, useMemo, useState } from 'react'
import { getLocalPropertyLocations } from '../lib/offlineDb'
import { useInvalidation } from '../stores/useInvalidationStore'
import type { CalendarEvent } from '../Types/CalendarTypes'
import { useVehicleDispatches } from './useVehicleDispatches'

/** Sentinel id prefix for derived dispatch-expiry calendar entries. NOT real
 *  events — never written to IDB or fanned to the vault. The calendar's own
 *  edit/move/delete handlers can't touch them (they resolve through the store,
 *  where these never exist); selecting one is routed by the prefix to the
 *  dispatch detail instead (CalendarPanel → DispatchExpiryDetail), which reads
 *  and edits the underlying dispatch.opened audit event. The suffix after the
 *  prefix IS that event's id. */
export const DISPATCH_CAL_ID_PREFIX = 'dispatch-exp:'

/**
 * Derived, read-only calendar entries for vehicles currently ON dispatch — one
 * all-day entry on each open dispatch's exp_date. The calendar has NO events
 * table (vault-fed); these are synthesized at render time from the audit-log
 * dispatch fold and merged into the view list AFTER the store events, so they
 * surface the expiry on the schedule without ever touching the vault/sync path
 * (honoring the calendar's no-resurrect invariants). Vehicle names come straight
 * from IDB so this works even when the property store isn't hydrated (e.g. the
 * user is in the calendar drawer, not property).
 */
export function useDispatchCalendarEvents(clinicId: string | null): CalendarEvent[] {
  const dispatches = useVehicleDispatches(clinicId)
  const propGen = useInvalidation('properties')
  const [names, setNames] = useState<Map<string, string>>(() => new Map())

  useEffect(() => {
    if (!clinicId) { setNames(new Map()); return }
    let cancelled = false
    getLocalPropertyLocations(clinicId)
      .then((locs) => { if (!cancelled) setNames(new Map(locs.map((l) => [l.id, l.name]))) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clinicId, propGen])

  return useMemo(() => {
    if (!clinicId || dispatches.size === 0) return []
    const out: CalendarEvent[] = []
    for (const [locId, d] of dispatches) {
      const name = names.get(locId) ?? 'Vehicle'
      const at = `${d.expDate}T00:00`
      out.push({
        id: `${DISPATCH_CAL_ID_PREFIX}${d.dispatchId}`,
        clinic_id: clinicId,
        title: d.status === 'expired' ? `${name} — dispatch expired` : `${name} — dispatch expires`,
        description: null,
        category: 'other',
        status: 'pending',
        start_time: at,
        end_time: at,
        all_day: true,
        location: null,
        opord_notes: null,
        uniform: null,
        report_time: null,
        assigned_to: [],
        property_item_ids: [],
        room_id: locId,
        target_clinic_ids: [clinicId],
        created_by: '',
        created_at: at,
        updated_at: at,
      })
    }
    return out
  }, [clinicId, dispatches, names])
}
