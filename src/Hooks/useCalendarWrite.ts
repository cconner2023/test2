/**
 * useCalendarWrite — Consolidated calendar event write operations.
 *
 * Provides two operations:
 *   writeEvent  — awaits vault confirmation before committing to the store.
 *                 Call for all form-driven creates and edits.
 *   vaultUpdate — fire-and-forget vault update for optimistic UI paths
 *                 (drag, status change, mission board) where the caller has
 *                 already written the new state to the store.
 *   deleteEvent — tombstones immediately; queues vault hard-delete for retry.
 *
 * Loading state (`isWriting`) is exposed for the caller to show an overlay.
 */

import { useState, useCallback } from 'react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarVault } from './useCalendarVault'
import { getTombstones } from '../lib/calendarRouting'
import { addCalendarTombstone, queuePendingVaultDelete, clearPendingVaultSend } from '../lib/calendarEventStore'
import type { CalendarEvent } from '../Types/CalendarTypes'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('CalendarWrite')

export interface UseCalendarWriteResult {
  /**
   * Atomic write: awaits vault confirmation, then commits to the store.
   * Sets isWriting=true for the duration — caller shows loading overlay.
   * Handles create (event not yet in store) and update (event already exists).
   */
  writeEvent: (event: CalendarEvent) => Promise<void>

  /**
   * Fire-and-forget vault update for paths where the store has already been
   * updated optimistically (drag, status change, mission board).
   * Deletes the old vault message, sends the replacement, patches originId.
   * Does NOT set isWriting — no loading overlay.
   */
  vaultUpdate: (event: CalendarEvent) => void

  /**
   * Tombstones immediately (resurrection guard), awaits vault fan-out 'd',
   * then removes from store. Sets isDeleting=true so callers can show an
   * overlay while the Supabase call is in flight.
   */
  deleteEvent: (id: string) => Promise<void>

  /** True while writeEvent is in flight. */
  isWriting: boolean

  /** True while deleteEvent is awaiting vault fan-out. */
  isDeleting: boolean
}

export function useCalendarWrite(): UseCalendarWriteResult {
  const [isWriting, setIsWriting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { sendEvent, deleteEvents } = useCalendarVault()

  const writeEvent = useCallback(async (event: CalendarEvent): Promise<void> => {
    const store = useCalendarStore.getState()
    const existing = store.events.find(e => e.id === event.id)
    const oldOriginIds = existing?.originId ? [existing.originId] : []

    setIsWriting(true)
    try {
      // Queue hard-delete of old vault message (best-effort; drain covers offline case)
      if (oldOriginIds.length > 0) {
        deleteEvents(oldOriginIds).catch(() => {
          queuePendingVaultDelete(event.id, oldOriginIds).catch(() => {})
        })
      }

      // Await vault send — originId is known before store write
      const originId = await sendEvent('c', event)
      const committed = { ...event, ...(originId ? { originId } : {}) }

      if (existing) {
        store.updateEvent(event.id, committed)
      } else {
        store.addEvent(committed)
      }
    } catch (e) {
      logger.warn('writeEvent failed, committing without originId:', e)
      // Commit anyway so the event is not lost
      if (existing) {
        useCalendarStore.getState().updateEvent(event.id, event)
      } else {
        useCalendarStore.getState().addEvent(event)
      }
    } finally {
      setIsWriting(false)
    }
  }, [sendEvent, deleteEvents])

  const vaultUpdate = useCallback((event: CalendarEvent): void => {
    const existing = useCalendarStore.getState().events.find(e => e.id === event.id)
    const oldOriginIds = existing?.originId ? [existing.originId] : []

    if (oldOriginIds.length > 0) {
      deleteEvents(oldOriginIds).catch(() => {
        queuePendingVaultDelete(event.id, oldOriginIds).catch(() => {})
      })
    }

    sendEvent('c', event).then(originId => {
      if (originId) useCalendarStore.getState().updateEvent(event.id, { originId })
    }).catch(() => {})
  }, [sendEvent, deleteEvents])

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    const store = useCalendarStore.getState()
    const event = store.events.find(e => e.id === id)
    const originIds = event?.originId ? [event.originId] : []

    // Tombstone first (sync) — resurrection guard before any await
    getTombstones().add(id)
    addCalendarTombstone(id).catch(() => {})

    // Cancel any pending offline vault send for this event so it never fires.
    // If the drain already sent it and patched originId into the store, the
    // originIds list above will catch it. If the drain sent it but hasn't
    // patched the store yet, the drain will see the tombstone and clean up.
    clearPendingVaultSend(id).catch(() => {})

    setIsDeleting(true)
    try {
      // Queue vault hard-delete unconditionally; drain covers offline retry
      if (originIds.length > 0) {
        deleteEvents(originIds).catch(() => {
          queuePendingVaultDelete(id, originIds).catch(() => {})
        })
        queuePendingVaultDelete(id, originIds).catch(() => {})
      }

      // Await fan-out 'd' — the Supabase call that takes wall-clock time
      await sendEvent('d', { id }).catch(() => {})
    } finally {
      setIsDeleting(false)
      // Remove from store after vault op so the overlay has a surface to render on
      useCalendarStore.getState().removeEvent(id)
      useCalendarStore.getState().selectEvent(null)
    }
  }, [sendEvent, deleteEvents])

  return { writeEvent, vaultUpdate, deleteEvent, isWriting, isDeleting }
}
