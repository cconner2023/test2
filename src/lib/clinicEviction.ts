/**
 * Cluster membership eviction — the "clean break" when a user is removed from a
 * cluster (home clinic reassigned, or a loan revoked).
 *
 * RLS already severs the user's *server* access the instant membership changes:
 * auth_clinic_ids() stops returning the clinic, so no future snapshot, tail, or
 * fan-out copy can be read, and remaining members stop fanning out to the removed
 * devices. This module handles the *device* side — it nukes everything that clinic
 * left in local caches so no stale cluster data lingers after access is gone.
 *
 * No vault re-key is required: the removed member simply stops receiving the
 * clinic's messages, and this wipes whatever they already cached. Forward secrecy
 * is delivered by eviction-on-detection, not by rotating the clinic vault.
 *
 * Detection + the prev/next membership diff live in useAuthStore.refreshProfile
 * (the single membership-apply funnel). This module is the per-clinic teardown it
 * calls for each dropped clinic.
 *
 * INVARIANT: tombstones (calendar + map overlay) are deliberately preserved,
 * identical to the logout contract — a still-reachable clinic's replay must not be
 * able to resurrect a deleted event/overlay.
 */

import { clearClinicVaultKey } from './signal/clinicVaultDevice'
import { deleteCalendarEventsForClinic } from './calendarEventStore'
import { purgeClinicScopedData } from './offlineDb'
import { clearClinicUsersCache } from './clinicUsersCache'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useMapOverlaysStore } from '../stores/useMapOverlaysStore'
import { usePropertyStore } from '../stores/usePropertyStore'
import { invalidate } from '../stores/useInvalidationStore'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('ClinicEviction')

/**
 * Wipe all local data for a single clinic the user has been removed from.
 * Best-effort: a failure in one subsystem does not block the others.
 */
export async function evictClinicData(clinicId: string): Promise<void> {
  logger.info(`Evicting all local data for removed cluster ${clinicId}`)

  // 1. In-memory clinic vault wrapping key — no future snapshot/tail decrypts.
  clearClinicVaultKey(clinicId)

  // 2. IDB projections (tombstones preserved by both helpers).
  await Promise.allSettled([
    deleteCalendarEventsForClinic(clinicId),
    purgeClinicScopedData(clinicId),
  ])

  // 3. In-memory stores — drop anything still pointing at the removed clinic.
  try {
    const cal = useCalendarStore.getState()
    // setEvents is the unwrapped hydration setter (no write-back), safe here.
    cal.setEvents(cal.events.filter(e => e.clinic_id !== clinicId))
  } catch (e) {
    logger.warn('Failed to prune in-memory calendar events:', e)
  }

  if (useMapOverlaysStore.getState().clinicId === clinicId) {
    useMapOverlaysStore.getState().clear()
  }

  if (usePropertyStore.getState().clinicId === clinicId) {
    usePropertyStore.setState({
      items: [],
      locations: [],
      holders: new Map(),
      clinicMembers: [],
      clinicId: null,
    })
  }

  // 4. Roster cache is a flat contact list spanning reachable clinics — clear it
  //    wholesale; the next RLS-scoped fetch repopulates only reachable clinics.
  await clearClinicUsersCache().catch(() => {})

  // 5. Nudge every clinic-scoped view to refetch against the new reach.
  invalidate('calendar', 'mapOverlays', 'properties', 'users', 'clinics')
}
