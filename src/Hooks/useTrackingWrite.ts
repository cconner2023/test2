/**
 * useTrackingWrite — Tracking Board entry writes over the calendar vault pipeline.
 *
 * An entry is a hidden calendar event (CalendarEvent.tracking_data), so it rides
 * useCalendarVault's Signal fan-out unchanged. Differences from useCalendarWrite:
 *  - targets = origin + every ancestor (tracking_clinic_chain RPC), not
 *    assignees' clinics. RPC failure keeps the stored set (never shrinks).
 *  - every write applies a MUTATOR to the latest store copy and sends the whole
 *    record; receivers union-merge moves / comments (calendarRouting), so two
 *    clusters editing one patient at once both keep their changes.
 *  - no assignment push, no training-completion relink.
 *
 * The prior vault row is hard-deleted in the ORIGIN cluster's vault. A member
 * of an ancestor cluster can't delete there — that call fails, is logged, and
 * the stale row goes at the next snapshot reap (cross-cluster calendar twin).
 *
 * PHI: BRN + comments live only inside the E2E payload. Never log tracking_data.
 */

import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useCalendarVault } from './useCalendarVault'
import { useAuth } from './useAuth'
import { getTombstones } from '../lib/calendarRouting'
import { addCalendarTombstone, clearPendingVaultSend, queuePendingVaultSend } from '../lib/calendarEventStore'
import { generateId, type CalendarEvent } from '../Types/CalendarTypes'
import { mergeTrackingData, type TrackingData } from '../Types/TrackingTypes'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('TrackingWrite')

/** Origin + ancestors, nearest first. null on failure. */
async function fetchChain(originClinicId: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.rpc('tracking_clinic_chain', { p_clinic_id: originClinicId })
    if (error || !Array.isArray(data)) {
      if (error) logger.warn('tracking_clinic_chain failed:', error.message)
      return null
    }
    const ids = (data as Array<{ clinic_id: string | null }>).map(r => r.clinic_id).filter((x): x is string => !!x)
    return ids.length > 0 ? ids : null
  } catch (e) {
    logger.warn('tracking_clinic_chain threw:', e instanceof Error ? e.message : e)
    return null
  }
}

const findTracking = (id: string) => useCalendarStore.getState().tracking.find(e => e.id === id)

export interface UseTrackingWriteResult {
  /** New entry at `originClinicId`. Resolves once the fan-out settles. */
  checkIn: (originClinicId: string, data: TrackingData, createdBy: string) => Promise<void>
  /** Apply `mutate` to the latest copy of entry `id`, then fan it out. */
  updateEntry: (id: string, mutate: (d: TrackingData) => TrackingData) => Promise<void>
  /** Remove from every board in the chain. */
  deleteEntry: (id: string) => Promise<void>
}

export function useTrackingWrite(): UseTrackingWriteResult {
  const { sendEvent, deleteEvents } = useCalendarVault()
  const { user } = useAuth()
  const userId = user?.id ?? null

  /** Commit `next` to the store, fan to old ∪ new targets, record originId. */
  const send = useCallback(async (next: CalendarEvent, prev: CalendarEvent | undefined): Promise<void> => {
    const store = useCalendarStore.getState()
    const oldTargets = prev?.target_clinic_ids ?? []
    // Optimistic commit first — the board reflects the change before the RPC.
    if (prev) store.updateEvent(next.id, next)
    else store.addEvent({ ...next, target_clinic_ids: [next.clinic_id] })

    const chain = await fetchChain(next.clinic_id)
    const targets = chain ?? (oldTargets.length > 0 ? oldTargets : [next.clinic_id])
    // Merge with whatever landed while the RPC was out (a peer's move/comment).
    const latest = findTracking(next.id)
    if (!latest) return // deleted meanwhile
    const stamped: CalendarEvent = {
      ...next,
      target_clinic_ids: targets,
      tracking_data: latest.tracking_data && next.tracking_data
        ? mergeTrackingData(latest.tracking_data, next.tracking_data)
        : next.tracking_data,
    }
    useCalendarStore.getState().updateEvent(stamped.id, stamped)

    if (prev?.originId) deleteEvents([prev.originId], prev.clinic_id).catch(() => {})

    const fanTo = Array.from(new Set([...oldTargets, ...targets]))
    const originId = await sendEvent('c', stamped, fanTo)
    if (originId) {
      useCalendarStore.getState().updateEvent(stamped.id, { originId })
      clearPendingVaultSend(stamped.id).catch(() => {})
    } else {
      // Offline / fan-out failure — the calendar vault drain re-sends on reconnect.
      queuePendingVaultSend(stamped).catch(() => {})
    }
  }, [sendEvent, deleteEvents])

  const checkIn = useCallback(async (originClinicId: string, data: TrackingData, createdBy: string) => {
    const now = new Date(data.checked_in_at).toISOString()
    const ev: CalendarEvent = {
      id: generateId(),
      clinic_id: originClinicId,
      // Generic title — the event never renders on the calendar, and the BRN
      // stays inside tracking_data only.
      title: 'Tracking',
      description: null,
      category: 'other',
      status: 'in_progress',
      start_time: now,
      end_time: now,
      all_day: false,
      location: null,
      opord_notes: null,
      uniform: null,
      report_time: null,
      assigned_to: [],
      property_item_ids: [],
      created_by: createdBy || userId || '',
      created_at: now,
      updated_at: now,
      tracking_data: data,
    }
    await send(ev, undefined)
  }, [send, userId])

  const updateEntry = useCallback(async (id: string, mutate: (d: TrackingData) => TrackingData) => {
    if (getTombstones().has(id)) return
    const prev = findTracking(id)
    if (!prev?.tracking_data) return
    await send({ ...prev, tracking_data: mutate(prev.tracking_data) }, prev)
  }, [send])

  const deleteEntry = useCallback(async (id: string) => {
    const store = useCalendarStore.getState()
    const prev = findTracking(id)
    getTombstones().add(id)
    addCalendarTombstone(id).catch(() => {})
    clearPendingVaultSend(id).catch(() => {})
    store.removeEvent(id)
    if (!prev) return
    const targets = prev.target_clinic_ids?.length ? prev.target_clinic_ids : [prev.clinic_id]
    await sendEvent('d', { id, clinic_id: prev.clinic_id, target_clinic_ids: targets })
    if (prev.originId) deleteEvents([prev.originId], prev.clinic_id).catch(() => {})
  }, [sendEvent, deleteEvents])

  return { checkIn, updateEntry, deleteEntry }
}
