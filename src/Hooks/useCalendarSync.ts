/**
 * useCalendarSync — Hydration for clinic calendar events.
 *
 * Startup sequence:
 *  1. Load tombstones (prevents resurrecting deleted events).
 *  2. Load persisted events from IndexedDB.
 *  3. Merge with vault-replayed events already in the store.
 *
 * Vault replay is full (replay-all, age-pruned 90 days) so the store is
 * authoritative after processClinicVaultMessages() completes. IDB events
 * whose vault message was hard-deleted (i.e. deleted on another device)
 * are excluded from the merge to prevent resurrection.
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

        // Vault replay is authoritative — it replays ALL vault messages on every login
        // (no ACK pruning). Any IDB event absent from the vault-replayed store either:
        //   (a) was deleted on another device (vault 'c' was hard-deleted), or
        //   (b) aged out past 90 days.
        // In both cases the IDB copy is stale and must not be merged in.
        //
        // Exception: events with no originId were created locally and never vaulted
        // (pending sends). Keep those — the drain will send them.
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
