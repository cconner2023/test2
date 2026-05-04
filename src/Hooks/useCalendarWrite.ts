/**
 * useCalendarWrite — Consolidated calendar event write operations.
 *
 * Provides two operations:
 *   writeEvent  — awaits vault confirmation before committing to the store.
 *                 Call for all form-driven creates and edits.
 *   vaultUpdate — fire-and-forget vault update for optimistic UI paths
 *                 (drag, status change, mission board) where the caller has
 *                 already written the new state to the store.
 *   deleteEvent — tombstones immediately, fans out 'd' to every clinic
 *                 device including the vault (the vault pair-cleans its own
 *                 'c'/'d' rows on next replay), and cascades to any linked
 *                 training_completions row.
 *
 * Loading state (`isWriting`) is exposed for the caller to show an overlay.
 */

import { useState, useCallback } from 'react'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarVault } from './useCalendarVault'
import { useAuth } from './useAuth'
import { getTombstones } from '../lib/calendarRouting'
import { addCalendarTombstone, clearPendingVaultSend } from '../lib/calendarEventStore'
import { deleteCompletionsByCalendarOriginId, relinkCompletionsByOriginId } from '../lib/trainingService'
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
  const { user } = useAuth()
  const userId = user?.id ?? null

  // Rotate any training_completions' calendar_origin_id to the new originId
  // so the cascade link survives edits. No-op when unlinked or unauthenticated.
  const relinkIfNeeded = useCallback((oldOriginId: string | null, newOriginId: string | null): void => {
    if (!oldOriginId || !newOriginId || !userId) return
    relinkCompletionsByOriginId(oldOriginId, newOriginId, userId).catch(() => {})
  }, [userId])

  const writeEvent = useCallback(async (event: CalendarEvent): Promise<void> => {
    const store = useCalendarStore.getState()
    const existing = store.events.find(e => e.id === event.id)
    const oldOriginId = existing?.originId ?? null

    setIsWriting(true)
    try {
      if (oldOriginId) deleteEvents([oldOriginId], existing?.clinic_id ?? event.clinic_id)

      const originId = await sendEvent('c', event)
      const committed = { ...event, ...(originId ? { originId } : {}) }

      if (existing) {
        store.updateEvent(event.id, committed)
      } else {
        store.addEvent(committed)
      }

      relinkIfNeeded(oldOriginId, originId)
    } catch (e) {
      logger.warn('writeEvent failed, committing without originId:', e)
      if (existing) {
        useCalendarStore.getState().updateEvent(event.id, event)
      } else {
        useCalendarStore.getState().addEvent(event)
      }
    } finally {
      setIsWriting(false)
    }
  }, [sendEvent, deleteEvents, relinkIfNeeded])

  const vaultUpdate = useCallback((event: CalendarEvent): void => {
    const existing = useCalendarStore.getState().events.find(e => e.id === event.id)
    const oldOriginId = existing?.originId ?? null

    if (oldOriginId) deleteEvents([oldOriginId], existing?.clinic_id ?? event.clinic_id)

    sendEvent('c', event).then(originId => {
      if (originId) useCalendarStore.getState().updateEvent(event.id, { originId })
      relinkIfNeeded(oldOriginId, originId)
    })
  }, [sendEvent, deleteEvents, relinkIfNeeded])

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    // Short-circuit if already tombstoned (e.g. cascade re-entry). The event
    // row is already gone or about to be; avoid a duplicate 'd' fan-out.
    if (getTombstones().has(id)) {
      useCalendarStore.getState().removeEvent(id)
      useCalendarStore.getState().selectEvent(null)
      return
    }

    const store = useCalendarStore.getState()
    const event = store.events.find(e => e.id === id)
    const originId = event?.originId ?? null
    const eventClinicId = event?.clinic_id

    // Tombstone first (sync) — resurrection guard before any await.
    getTombstones().add(id)
    addCalendarTombstone(id).catch(() => {})

    // Cancel any pending offline vault send for this event so it never fires.
    clearPendingVaultSend(id).catch(() => {})

    setIsDeleting(true)
    try {
      // Fan-out 'd' to every clinic device including the vault. Pass the
      // event's clinic_id so the fan-out targets the right clinic vault
      // (could be assigned or surrogate). The vault pair-cleans its own
      // 'c'/'d' rows on next processClinicVaultMessages — no client-side
      // hard-delete RPC needed from this path. sendEvent swallows its own
      // errors and returns null on failure.
      await sendEvent('d', { id, ...(eventClinicId ? { clinic_id: eventClinicId } : {}) })

      // Cascade: if this event was a training assignment surface, remove the
      // linked completion row too. Idempotent; no-op when nothing is linked.
      if (originId && userId) {
        deleteCompletionsByCalendarOriginId(originId, userId).catch(() => {})
      }
    } finally {
      setIsDeleting(false)
      useCalendarStore.getState().removeEvent(id)
      useCalendarStore.getState().selectEvent(null)
    }
  }, [sendEvent, userId])

  return { writeEvent, vaultUpdate, deleteEvent, isWriting, isDeleting }
}
