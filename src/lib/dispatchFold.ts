/**
 * Vehicle-dispatch fold — shared by the DispatchSheet, the clinic-wide red-dot
 * hook (useVehicleDispatches), and the calendar exp-date derivation.
 *
 * A dispatch lives entirely in audit_log as append-only events on a vehicle
 * location (see auditTypes.ts dispatch.opened / dispatch.closed). There is NO
 * dispatch table or dispatch column — the CURRENT dispatch is folded in-browser:
 * the open `dispatch.opened` with no `dispatch.closed` pointing back at it (the
 * same shape as the open-fault fold). No PHI on the spine.
 */
import type { AuditEvent } from './auditTypes'

export const DISPATCH_EVENT_TYPES = new Set<string>(['dispatch.opened', 'dispatch.closed'])

/** A dispatch authorization within this many days of its exp date reads as
 *  "expiring soon" (amber/red-dot warn) rather than plainly active. */
export const DISPATCH_EXPIRING_DAYS = 2

export type DispatchStatus = 'active' | 'expiring' | 'expired'

/** The current (open) dispatch on a vehicle, as folded from its events. */
export interface OpenDispatch {
  /** The dispatch.opened event id (so a return can close it). */
  dispatchId: string
  /** ISO date the dispatch authorization expires. */
  expDate: string
  status: DispatchStatus
  /** Vehicle location id the dispatch is on. */
  subjectId: string
  openedAt: string
  odoOut?: number
}

/** Status of a dispatch given its exp date and the current time. */
export function dispatchStatusOf(expDate: string, now: number): DispatchStatus {
  const exp = new Date(expDate).getTime()
  if (!Number.isFinite(exp)) return 'active'
  if (exp < now) return 'expired'
  if (exp - now <= DISPATCH_EXPIRING_DAYS * 86_400_000) return 'expiring'
  return 'active'
}

/**
 * Fold a flat list of audit events (any subjects) to the CURRENT open dispatch
 * per vehicle: the newest `dispatch.opened` whose id no `dispatch.closed`
 * references via `dispatches`. Returns subjectId → OpenDispatch (only vehicles
 * with an open dispatch appear). `now` is passed in (callers stamp it) so the
 * fold itself stays pure.
 */
export function foldOpenDispatches(events: AuditEvent[], now: number): Map<string, OpenDispatch> {
  const closedIds = new Set<string>()
  for (const e of events) {
    if (e.eventType === 'dispatch.closed' && typeof e.payload?.dispatches === 'string') {
      closedIds.add(e.payload.dispatches)
    }
  }

  // Newest opened-per-subject wins (events are not assumed sorted).
  const open = new Map<string, OpenDispatch>()
  for (const e of events) {
    if (e.eventType !== 'dispatch.opened' || closedIds.has(e.id)) continue
    const expDate = typeof e.payload?.exp_date === 'string' ? e.payload.exp_date : null
    if (!expDate) continue
    const prev = open.get(e.subjectId)
    if (prev && new Date(prev.openedAt).getTime() >= new Date(e.occurredAt).getTime()) continue
    open.set(e.subjectId, {
      dispatchId: e.id,
      expDate,
      status: dispatchStatusOf(expDate, now),
      subjectId: e.subjectId,
      openedAt: e.occurredAt,
      odoOut: typeof e.payload?.odo_out === 'number' ? e.payload.odo_out : undefined,
    })
  }
  return open
}
