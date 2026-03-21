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
import { loadCalendarEvents } from '../lib/calendarEventStore'
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
    loadCalendarEvents().then(events => {
      if (events.length > 0) setEvents(events)
      setHydrated(true)
    }).catch(e => {
      logger.warn('Failed to load cached calendar events:', e)
      setHydrated(true)
    })
  }, [hydrated, setEvents, setHydrated])
}
