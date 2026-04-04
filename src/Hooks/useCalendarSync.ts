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
import { loadCalendarEvents, clearExpiredTombstones, saveCalendarEvents } from '../lib/calendarEventStore'
import { initCalendarTombstones, getTombstones } from '../lib/calendarRouting'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('CalendarSync')

export function useCalendarSync() {
  const { setEvents, hydrated, setHydrated, vaultReplayDone } = useCalendarStore(useShallow(s => ({
    setEvents: s.setEvents,
    hydrated: s.hydrated,
    setHydrated: s.setHydrated,
    vaultReplayDone: s.vaultReplayDone,
  })))

  // Hydrate from IDB on mount — waits for vault replay so the merge sees
  // the full vault state and the destructive IDB clear is already done.
  useEffect(() => {
    if (hydrated || !vaultReplayDone) return
    ;(async () => {
      try {
        await initCalendarTombstones()
        clearExpiredTombstones().catch(() => {})

        const idbEvents = await loadCalendarEvents()
        const idbLive = idbEvents.filter(e => !getTombstones().has(e.id))

        // Vault replay may have routed events to the Zustand store before hydration
        // (IDB writes are gated on hydrated=true, so those events aren't persisted yet).
        // Merge IDB events with any vault-replayed events already in the store.
        const storeEvents = useCalendarStore.getState().events
        const merged = new Map<string, typeof storeEvents[number]>()
        for (const e of idbLive) merged.set(e.id, e)
        // Vault-replayed events take precedence (newer state)
        for (const e of storeEvents) {
          if (!getTombstones().has(e.id)) merged.set(e.id, e)
        }

        const final = Array.from(merged.values())
        if (final.length > 0) {
          setEvents(final)
          // Persist merged set to IDB so vault-replayed events survive page refresh
          if (final.length !== idbLive.length || storeEvents.length > 0) {
            saveCalendarEvents(final).catch(() => {})
          }
        }
      } catch (e) {
        logger.warn('Failed to load cached calendar events:', e)
      } finally {
        setHydrated(true)
      }
    })()
  }, [hydrated, vaultReplayDone, setEvents, setHydrated])
}
