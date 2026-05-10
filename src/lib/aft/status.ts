/**
 * AFT readiness status derivation. Pure functions over calendar events —
 * the "everything is a calendar event" thesis means readiness rollups read
 * from the existing event stream instead of a parallel store.
 */

import type { CalendarEvent } from '../../Types/CalendarTypes'
import { scoreAftEventByBracket, scoreAltEventByBracket, aftTotal, type AftEvent } from './scoring'

export type AftRecency = 'current' | 'expiring' | 'expired' | 'none'

export interface AftStatus {
  /** Most recent completed (past-dated, results filled) aft_record event. */
  lastTest: {
    eventId: string
    date: string
    total: number
    allPassing: boolean
  } | null
  recency: AftRecency
  /** Days since last test; null if no completed record exists. */
  daysSinceLastTest: number | null
}

/** AR 350-1 cadence: AFT every ~6 months. After 12 months, definitively expired. */
const SIX_MONTHS_DAYS = 180
const TWELVE_MONTHS_DAYS = 365

/** Compute AFT status for one soldier from a stream of calendar events. */
export function aftStatusForSoldier(
  soldierId: string,
  events: CalendarEvent[],
  now: Date = new Date(),
): AftStatus {
  const completed = events
    .filter(e => e.category === 'aft_record')
    .filter(e => e.assigned_to.includes(soldierId))
    .filter(e => e.aft_result != null)
    .filter(e => new Date(e.start_time) <= now)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

  if (completed.length === 0) {
    return { lastTest: null, recency: 'none', daysSinceLastTest: null }
  }

  const latest = completed[0]
  const r = latest.aft_result!

  const scored: { event: AftEvent; points: number }[] = []
  if (r.mdl_lbs != null)  scored.push({ event: 'mdl', points: scoreAftEventByBracket('mdl', r.mdl_lbs, r.bracket, r.scale).points })
  if (r.hrp_reps != null) scored.push({ event: 'hrp', points: scoreAftEventByBracket('hrp', r.hrp_reps, r.bracket, r.scale).points })
  if (r.sdc_sec != null)  scored.push({ event: 'sdc', points: scoreAftEventByBracket('sdc', r.sdc_sec, r.bracket, r.scale).points })
  if (r.plk_sec != null)  scored.push({ event: 'plk', points: scoreAftEventByBracket('plk', r.plk_sec, r.bracket, r.scale).points })

  let cardioPassing = false
  if (r.alt_event != null && r.alt_time_sec != null) {
    // Alt cardio = go/no-go only; no points contribution to total.
    cardioPassing = scoreAltEventByBracket(r.alt_event, r.alt_time_sec, r.bracket, r.scale).passing
  } else if (r.run2mi_sec != null) {
    const x = scoreAftEventByBracket('run2mi', r.run2mi_sec, r.bracket, r.scale)
    scored.push({ event: 'run2mi', points: x.points })
    cardioPassing = x.passing
  }

  const t = aftTotal(scored)
  const allPassing = t.allPassing && cardioPassing

  const days = Math.floor(
    (now.getTime() - new Date(latest.start_time).getTime()) / (1000 * 60 * 60 * 24),
  )
  const recency: AftRecency =
    days <= SIX_MONTHS_DAYS ? 'current' :
    days <= TWELVE_MONTHS_DAYS ? 'expiring' :
    'expired'

  return {
    lastTest: { eventId: latest.id, date: latest.start_time, total: t.total, allPassing },
    recency,
    daysSinceLastTest: days,
  }
}
