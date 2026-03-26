/**
 * useCalendarSync — Hydration for clinic calendar events.
 *
 * Startup sequence:
 *  1. Load tombstones (prevents resurrecting deleted events).
 *  2. Load the materialized event list from IndexedDB (instant render).
 *
 * Cold-start replay is handled by processClinicVaultMessages() in the
 * login flow (useAuthStore). Realtime incoming events are handled by
 * useSignalMessages → routeCalendarEvent (standard Signal fan-out).
 *
 * IDB persistence is handled by the calendarPersist middleware on
 * useCalendarStore — every mutation (add, update, remove, move, assign)
 * writes through to IDB automatically.
 */

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCalendarStore } from '../stores/useCalendarStore'
import { loadCalendarEvents, clearExpiredTombstones } from '../lib/calendarEventStore'
import { initCalendarTombstones, getTombstones } from '../lib/calendarRouting'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('CalendarSync')

export function useCalendarSync() {
  const { setEvents, hydrated, setHydrated } = useCalendarStore(useShallow(s => ({
    setEvents: s.setEvents,
    hydrated: s.hydrated,
    setHydrated: s.setHydrated,
  })))

  // Hydrate from IDB on mount
  useEffect(() => {
    if (hydrated) return
    ;(async () => {
      try {
        await initCalendarTombstones()
        clearExpiredTombstones().catch(() => {})

        const events = await loadCalendarEvents()
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
