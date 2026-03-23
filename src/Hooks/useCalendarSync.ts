/**
 * useCalendarSync — Hydration and realtime sync for encrypted calendar events.
 *
 * Startup sequence:
 *  1. Get-or-create the clinic's system calendar group (lazy, idempotent).
 *  2. Load the materialized event list from IndexedDB (instant render).
 *
 * IDB persistence is handled by the calendarPersist middleware on
 * useCalendarStore — every mutation (add, update, remove, move, assign)
 * writes through to IDB automatically. No explicit saveCalendarEvents()
 * calls are needed anywhere.
 */

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from './useAuth'
import { useCalendarStore } from '../stores/useCalendarStore'
import { getOrCreateClinicCalendarGroup } from '../lib/signal/groupService'
import { loadCalendarEvents, clearExpiredTombstones } from '../lib/calendarEventStore'
import { initCalendarTombstones, getTombstones } from '../lib/calendarRouting'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('CalendarSync')

export function useCalendarSync() {
  const { clinicId } = useAuth()
  const { calendarGroupId, setCalendarGroupId, setEvents, hydrated, setHydrated } = useCalendarStore(useShallow(s => ({
    calendarGroupId: s.calendarGroupId,
    setCalendarGroupId: s.setCalendarGroupId,
    setEvents: s.setEvents,
    hydrated: s.hydrated,
    setHydrated: s.setHydrated,
  })))

  // 1. Lazy-create calendar group and cache the ID
  useEffect(() => {
    if (!clinicId || calendarGroupId) return
    getOrCreateClinicCalendarGroup(clinicId).then(result => {
      if (result.ok) {
        setCalendarGroupId(result.data)
        logger.info('Calendar group ready:', result.data)
      } else {
        logger.warn('Failed to get/create calendar group:', result.error)
      }
    })
  }, [clinicId, calendarGroupId, setCalendarGroupId])

  // 2. Hydrate from IndexedDB (instant render of cached events)
  useEffect(() => {
    if (hydrated) return
    ;(async () => {
      try {
        // Init tombstone set first so the in-memory guard is populated before
        // any message routing happens, and prune stale entries on startup.
        await initCalendarTombstones()
        clearExpiredTombstones().catch(() => {})

        const events = await loadCalendarEvents()
        // Filter out any events whose IDs are now tombstoned (handles stale IDB
        // entries from a prior delete that didn't fully propagate).
        const live = events.filter(e => !getTombstones().has(e.id))
        if (live.length > 0) setEvents(live)
      } catch (e) {
        logger.warn('Failed to load cached calendar events:', e)
      } finally {
        setHydrated(true)
      }
    })()
  }, [hydrated, setEvents, setHydrated])
}
