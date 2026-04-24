/**
 * useCalendarSync — Hydration for clinic calendar events.
 *
 * Startup sequence:
 *  1. Load tombstones (prevents resurrecting deleted events).
 *  2. Load persisted events from IndexedDB.
 *  3. Merge with events already routed by processClinicVaultMessages.
 *
 * The clinic vault is a Signal peer device that's always online — every 'c',
 * 'u', 'd' fan-out lands in its inbox, and processClinicVaultMessages drains
 * that inbox (pair-cleaning 'c'/'d' pairs by event_id) into the calendar
 * store. After it completes, the store reflects the vault's current peer
 * state, so any IDB row absent from it is stale: the event was deleted on
 * another device (pair-cleaned away) or its 'c' was never vaulted.
 *
 * Cold-start drain runs in the login flow (useAuthStore →
 * processClinicVaultMessages). Realtime incoming events arrive on member
 * devices via useSignalMessages → routeCalendarEvent.
 *
 * IDB persistence is handled by the calendarPersist middleware on
 * useCalendarStore — every mutation writes through automatically.
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

        // The store now reflects the vault peer's current state (post pair-clean).
        // Any IDB event absent from it is stale — its 'c'/'d' pair was cleaned,
        // or its 'c' aged past decryptability.
        //
        // Exception: events with no originId were created locally and never
        // reached the vault (pending sends). Keep those — the drain will send them.
        const storeEvents = useCalendarStore.getState().events
        const vaultIds = new Set(storeEvents.map(e => e.id))
        const idbLive = idbEvents.filter(e => {
          if (getTombstones().has(e.id)) return false
          return vaultIds.has(e.id) || !e.originId
        })

        const merged = new Map<string, typeof storeEvents[number]>()
        for (const e of idbLive) merged.set(e.id, e)
        // Vault-replayed events take precedence (newer state)
        for (const e of storeEvents) {
          if (!getTombstones().has(e.id)) merged.set(e.id, e)
        }

        const final = Array.from(merged.values())
        setEvents(final)
        // Persist merged set to IDB so vault-replayed events survive page refresh
        if (final.length !== idbLive.length || storeEvents.length > 0) {
          saveCalendarEvents(final).catch(() => {})
        }
      } catch (e) {
        logger.warn('Failed to load cached calendar events:', e)
      } finally {
        setHydrated(true)
      }
    })()
  }, [hydrated, vaultReplayDone, setEvents, setHydrated])
}
