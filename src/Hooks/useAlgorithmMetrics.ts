import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { useCalendarVault } from './useCalendarVault'
import { useCalendarStore } from '../stores/useCalendarStore'
import { queuePendingVaultSend } from '../lib/calendarEventStore'
import { generateId, toLocalISOString } from '../Types/CalendarTypes'
import type { CalendarEvent } from '../Types/CalendarTypes'

export function useAlgorithmMetrics() {
  const { sendEvent } = useCalendarVault()
  const { user, clinicId } = useAuth()

  const logNow = useCallback(async (algorithmId: string, algorithmName: string) => {
    if (!user?.id || !clinicId) return

    const now = new Date()
    const nowStr = toLocalISOString(now)

    const event: CalendarEvent = {
      id: generateId(),
      clinic_id: clinicId,
      title: `ADTMC ${algorithmId} \u2014 ${algorithmName}`,
      description: null,
      category: 'training',
      status: 'completed',
      start_time: nowStr,
      end_time: nowStr,
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
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }

    useCalendarStore.getState().addEvent(event)

    const originId = await sendEvent('c', event)
    if (originId) {
      useCalendarStore.getState().updateEvent(event.id, { originId })
    } else {
      await queuePendingVaultSend(event)
    }
  }, [sendEvent, user, clinicId])

  return { logNow }
}
