/**
 * useCalendarVault — Calendar-specific send/delete via Signal Protocol fan-out.
 *
 * Events are encrypted per-device via X3DH/Double Ratchet and fanned out as a
 * clinic self-message (recipient_id = clinicId) to all clinic devices: the vault
 * device plus each member's clinic-scoped device.
 */

import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { useMessagingStore } from '../stores/useMessagingStore'
import { useAuthStore } from '../stores/useAuthStore'
import { createLogger } from '../Utilities/Logger'
import { serializeContent } from '../lib/signal/messageContent'
import type { CalendarEventContent, CalendarEventPayload } from '../lib/signal/messageContent'
import type { CalendarEvent } from '../Types/CalendarTypes'
import { loadPendingVaultSends, clearPendingVaultSend, patchPendingVaultSend, queuePendingVaultSend } from '../lib/calendarEventStore'
import { getTombstones } from '../lib/calendarRouting'
import { useCalendarStore } from '../stores/useCalendarStore'
import { fanOutToClinics, type FanOutOutcome } from '../lib/clinicFanOut'

const logger = createLogger('CalendarVault')

/**
 * Resolve the set of clinics an event should be distributed to:
 * {authoringClinicId} ∪ (each assignee's [home clinic, ...active loans]).
 *
 * The assignee membership sets come from get_user_clinic_sets (SECURITY DEFINER)
 * so co-assignees whose home/loan clinics fall outside the author's own
 * auth_clinic_ids() still resolve — a plain client-side join would hit RLS and
 * silently under-fan. The authoring clinic is always seeded so the author keeps
 * their own copy even when no assignee is a member of it.
 *
 * On failure (offline / RPC error) falls back to [authoringClinicId] — i.e. the
 * pre-cross-cluster single-clinic behavior — rather than dropping the send.
 */
export async function resolveTargetClinics(
  authoringClinicId: string | null | undefined,
  assignedTo: string[],
): Promise<string[]> {
  const set = new Set<string>()
  if (authoringClinicId) set.add(authoringClinicId)
  if (assignedTo.length > 0) {
    try {
      const { data, error } = await supabase.rpc('get_user_clinic_sets', { p_user_ids: assignedTo })
      if (error) {
        logger.warn('get_user_clinic_sets failed, falling back to authoring clinic only:', error.message)
      } else if (Array.isArray(data)) {
        for (const row of data as Array<{ clinic_id: string | null }>) {
          if (row.clinic_id) set.add(row.clinic_id)
        }
      }
    } catch (e) {
      logger.warn('resolveTargetClinics threw, falling back to authoring clinic only:', e instanceof Error ? e.message : e)
    }
  }
  return Array.from(set)
}

async function fanCalendarEvent(
  userId: string | null,
  fallbackClinicId: string | null,
  action: 'c' | 'u' | 'd',
  data: Partial<CalendarEvent> & { id: string },
  fanToClinics?: string[],
  originId?: string,
): Promise<{ originId: string; targets: string[]; outcome: FanOutOutcome } | null> {
  const authoringClinic = (data.clinic_id as string | undefined) ?? fallbackClinicId
  const targetClinics = (fanToClinics && fanToClinics.length > 0)
    ? Array.from(new Set(fanToClinics))
    : (data.target_clinic_ids && data.target_clinic_ids.length > 0)
      ? Array.from(new Set(data.target_clinic_ids))
      : (authoringClinic ? [authoringClinic] : [])
  if (targetClinics.length === 0 || !userId) return null
  const localDeviceId = useMessagingStore.getState().localDeviceId
  const clinicDeviceId = useMessagingStore.getState().clinicDeviceId
  if (!localDeviceId || !clinicDeviceId) return null

  const actionMap = { c: 'create', u: 'update', d: 'delete' } as const
  const content: CalendarEventContent = {
    type: 'calendar_event',
    action: actionMap[action],
    data: data as unknown as CalendarEventPayload,
  }
  const serialized = serializeContent(content)
  // ONE originId shared across every clinic batch, so the event's single
  // stored originId resolves hard-delete in any clinic that holds a copy.
  const sharedOriginId = originId ?? crypto.randomUUID()
  const outcome = await fanOutToClinics(userId, clinicDeviceId, targetClinics, serialized, sharedOriginId, 'calendar event')
  return { originId: sharedOriginId, targets: targetClinics, outcome }
}

export async function sendCalendarVaultEvent(
  userId: string | null,
  fallbackClinicId: string | null,
  action: 'c' | 'u' | 'd',
  data: Partial<CalendarEvent> & { id: string },
  fanToClinics?: string[],
  originId?: string,
): Promise<string | null> {
  const r = await fanCalendarEvent(userId, fallbackClinicId, action, data, fanToClinics, originId)
  if (!r || r.outcome.landed.length === 0) return null
  if (action === 'c') {
    if (r.outcome.failed.length > 0) {
      await queuePendingVaultSend(data, { originId: r.originId, fanTargets: r.targets, remainingTargets: r.outcome.failed })
    } else {
      await clearPendingVaultSend(data.id)
    }
  }
  return r.originId
}

let calendarDrainInflight: Promise<void> | null = null
let calendarDrainAgain = false

async function runCalendarDrain(): Promise<void> {
  const { user, clinicId } = useAuthStore.getState()
  const userId = user?.id ?? null
  if (!clinicId || !userId) return
  const pendingSends = await loadPendingVaultSends()
  for (const item of pendingSends) {
    if (useAuthStore.getState().user?.id !== userId) return
    // Re-resolve cross-cluster targets here: the event may have been
    // enqueued offline, where resolveTargetClinics fell back to the
    // authoring clinic only. Now that we're online (drain runs on mount /
    // 'online'), resolve the full set so loaned-assignee events reach
    // every relevant clinic vault. Falls back to the event's own clinic
    // on RPC failure.
    // Tracking records fan along the origin's chain (stamped at write), not
    // by assignee — keep their stored targets.
    const resolved = item.fanTargets?.length
      ? null
      : item.event.tracking_data && item.event.target_clinic_ids?.length
        ? item.event.target_clinic_ids
        : await resolveTargetClinics(item.event.clinic_id, item.event.assigned_to ?? [])
    const targets = resolved ?? item.fanTargets ?? []
    const stampedTargets = resolved ?? item.event.target_clinic_ids ?? targets
    const fanNow = item.remainingTargets?.length ? item.remainingTargets : targets
    const stamped = { ...item.event, target_clinic_ids: stampedTargets }
    const stableOriginId = item.originId ?? crypto.randomUUID()
    if (!item.originId) await patchPendingVaultSend(item, { originId: stableOriginId })
    const result = await fanCalendarEvent(userId, clinicId, 'c', stamped, fanNow, stableOriginId)
    if (!result || result.outcome.landed.length === 0) continue
    const { originId, outcome } = result
    // If the event was deleted while this send was in flight, fan-out
    // a matching 'd' to every target so each clinic tombstones it.
    if (getTombstones().has(item.id)) {
      sendCalendarVaultEvent(userId, clinicId, 'd', { id: item.id, clinic_id: item.event.clinic_id, target_clinic_ids: targets }).catch(() => {})
      await clearPendingVaultSend(item.id, item.queuedAt)
      continue
    }
    useCalendarStore.getState().updateEvent(item.id, { originId, target_clinic_ids: stampedTargets })
    if (outcome.failed.length === 0) {
      await clearPendingVaultSend(item.id, item.queuedAt)
    } else {
      await patchPendingVaultSend(item, { event: stamped, originId, fanTargets: targets, remainingTargets: outcome.failed })
    }
  }
}

export function drainPendingVaultSends(): Promise<void> {
  if (calendarDrainInflight) {
    calendarDrainAgain = true
    return calendarDrainInflight
  }
  calendarDrainInflight = (async () => {
    try {
      do {
        calendarDrainAgain = false
        await runCalendarDrain()
      } while (calendarDrainAgain)
    } catch (e) {
      logger.warn('Calendar vault drain failed:', e instanceof Error ? e.message : e)
    } finally {
      calendarDrainInflight = null
    }
  })()
  return calendarDrainInflight
}

// ---- Hook ----

interface UseCalendarVaultResult {
  /** True when the hook has enough context to send (clinic + userId + deviceId). */
  ready: boolean
  /**
   * Encrypt and send a calendar event via Signal fan-out. Returns the originId on success.
   *
   * Fan-out targets (in priority order):
   *   1. `fanToClinics` when provided — the explicit clinic list to fan to.
   *      Used for edits/retracts where the fan set (union of old+new targets)
   *      differs from the payload's stamped `target_clinic_ids` (new targets).
   *   2. else `data.target_clinic_ids` when non-empty — the cross-cluster set.
   *   3. else `[data.clinic_id ?? clinicId]` — legacy single-clinic fallback.
   * The same originId is shared across every clinic batch.
   */
  sendEvent: (action: 'c' | 'u' | 'd', data: Partial<CalendarEvent> & { id: string }, fanToClinics?: string[]) => Promise<string | null>
  /** Hard-delete messages by origin ID. Caller passes the clinic that owns the vault. */
  deleteEvents: (originIds: string[], clinicId: string) => Promise<void>
}

export function useCalendarVault(): UseCalendarVaultResult {
  const { clinicId, user } = useAuth()
  const userId = user?.id ?? null

  const sendEvent = useCallback((
    action: 'c' | 'u' | 'd',
    data: Partial<CalendarEvent> & { id: string },
    fanToClinics?: string[],
  ): Promise<string | null> => sendCalendarVaultEvent(userId, clinicId, action, data, fanToClinics), [clinicId, userId])

  const deleteEvents = useCallback(async (originIds: string[], clinicId: string): Promise<void> => {
    if (originIds.length === 0 || !clinicId) return
    try {
      // All copies are under recipient_id = clinicId
      await supabase.rpc('hard_delete_clinic_vault_messages', {
        p_clinic_id: clinicId,
        p_origin_ids: originIds,
      })
    } catch (e) {
      logger.warn('Failed to delete vault messages:', e instanceof Error ? e.message : e)
    }
  }, [])

  return {
    ready: !!clinicId && !!userId,
    sendEvent,
    deleteEvents,
  }
}
