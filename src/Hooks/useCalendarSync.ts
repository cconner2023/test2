/**
 * useCalendarSync — Hydration for clinic calendar events.
 *
 * TWO PHASES, decoupled so a cold start paints instantly instead of blanking
 * behind the vault drain:
 *
 *  Phase A — CACHE-FIRST PAINT (ungated). On mount, load tombstones + the
 *    IndexedDB-cached events and merge them into the store immediately. The
 *    merge lets the store (vault-drain results) win on conflict, so it can't
 *    clobber anything the drain already routed if the drain wins the race.
 *    This is what makes the calendar appear offline-first: the cache is shown
 *    at once, the drain reconciles in the background.
 *
 *  Phase B — POST-DRAIN RECONCILE (on vaultReplayDone). Only a FULL clinic
 *    drain publishes an authoritative live-id set (useCalendarStore
 *    .fullReplayLiveIds, a union across all clinics drained this login). When
 *    present, drop any cached event the vault no longer has — it was deleted on
 *    another device while this one was away and its 'd' was already pair-cleaned
 *    before this device saw it. A DELTA drain leaves the set null: deletes
 *    arrive as explicit 'd' tombstones in the delta, so no destructive prune is
 *    needed (and would be wrong — the delta isn't the full archive).
 *
 * The clinic vault is the ONLY durable/cross-device calendar store (no
 * calendar_events table). The cold-start drain runs in the login flow
 * (useAuthStore → processClinicVaultMessages); realtime incoming events arrive
 * via useSignalMessages → routeCalendarEvent. IDB persistence is handled by the
 * calendarPersist middleware on useCalendarStore.
 */

import { useEffect } from 'react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { loadCalendarEvents, clearExpiredTombstones, saveCalendarEvents } from '../lib/calendarEventStore'
import { initCalendarTombstones, getTombstones } from '../lib/calendarRouting'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('CalendarSync')

export function useCalendarSync() {
  const hydrated = useCalendarStore(s => s.hydrated)
  const vaultReplayDone = useCalendarStore(s => s.vaultReplayDone)
  const setEvents = useCalendarStore(s => s.setEvents)
  const setHydrated = useCalendarStore(s => s.setHydrated)

  // Phase A — cache-first paint. Ungated by the drain so cold start is instant.
  useEffect(() => {
    if (hydrated) return
    let cancelled = false
    ;(async () => {
      try {
        await initCalendarTombstones()
        clearExpiredTombstones().catch(() => {})

        const idbEvents = await loadCalendarEvents()
        if (cancelled) return

        const tomb = getTombstones()
        // Merge into whatever the drain may have already routed; store wins on
        // conflict so a concurrent drain can't be clobbered by stale cache.
        const byId = new Map(useCalendarStore.getState().events.map(e => [e.id, e]))
        for (const e of idbEvents) {
          if (tomb.has(e.id)) continue
          if (!byId.has(e.id)) byId.set(e.id, e)
        }
        setEvents(Array.from(byId.values()))
      } catch (e) {
        logger.warn('Cache-first calendar paint failed:', e)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => { cancelled = true }
  }, [hydrated, setEvents, setHydrated])

  // Phase B — drop-stale reconcile after a FULL drain only.
  useEffect(() => {
    if (!vaultReplayDone) return
    const liveIds = useCalendarStore.getState().fullReplayLiveIds
    if (liveIds === null) return // delta drain (or poisoned) — nothing to prune

    const live = new Set(liveIds)
    const tomb = getTombstones()
    const events = useCalendarStore.getState().events
    const pruned = events.filter(e => {
      if (tomb.has(e.id)) return false
      // Keep events the full replay confirmed live, plus locally-created events
      // that never reached the vault (no originId — the drain will fan them out).
      return live.has(e.id) || !e.originId
    })

    if (pruned.length !== events.length) {
      setEvents(pruned)
      saveCalendarEvents(pruned).catch(() => {})
    }
    // Consume so a later remount can't re-prune against a stale set.
    useCalendarStore.getState().setFullReplayLiveIds(null)
  }, [vaultReplayDone, setEvents])
}
