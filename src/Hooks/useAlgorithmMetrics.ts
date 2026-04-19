import { useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useCalendarVault } from './useCalendarVault'
import { useCalendarStore } from '../stores/useCalendarStore'
import { queuePendingVaultSend } from '../lib/calendarEventStore'
import { generateId, toLocalISOString } from '../Types/CalendarTypes'
import type { CalendarEvent } from '../Types/CalendarTypes'

/**
 * Tracks algorithm open → completion time and saves a CalendarEvent
 * (category: training, status: completed) to the clinic calendar via
 * the Signal vault. No patient data — provider-operational metrics only.
 *
 * If the vault send fails (offline), the event is queued in IDB and
 * retried automatically when connectivity returns (useCalendarVault drain).
 */
export function useAlgorithmMetrics() {
  const openedAtRef = useRef<Map<string, number>>(new Map())
  const { sendEvent } = useCalendarVault()
  const { user, clinicId } = useAuth()

  const recordOpen = useCallback((algorithmId: string) => {
    openedAtRef.current.set(algorithmId, Date.now())
  }, [])

  const recordCompletion = useCallback(async (algorithmId: string, algorithmName: string) => {
    const openedAt = openedAtRef.current.get(algorithmId)
    if (!openedAt || !user?.id || !clinicId) return
    openedAtRef.current.delete(algorithmId)

    const start = new Date(openedAt)
    const end = new Date()

    const event: CalendarEvent = {
      id: generateId(),
      clinic_id: clinicId,
      title: `ADTMC ${algorithmId} \u2014 ${algorithmName}`,
      description: null,
      category: 'training',
      status: 'completed',
      start_time: toLocalISOString(start),
      end_time: toLocalISOString(end),
      all_day: false,
      location: null,
      opord_notes: null,
      uniform: null,
      report_time: null,
      assigned_to: [user.id],
      property_item_ids: [],
      structured_location: null,
      resource_allocations: null,
      created_by: user.id,
      created_at: end.toISOString(),
      updated_at: end.toISOString(),
    }

    useCalendarStore.getState().addEvent(event)

    const originId = await sendEvent('c', event)
    if (originId) {
      useCalendarStore.getState().updateEvent(event.id, { originId })
    } else {
      // Offline — queue for retry when connectivity returns
      await queuePendingVaultSend(event)
    }
  }, [sendEvent, user, clinicId])

  return { recordOpen, recordCompletion }
}
