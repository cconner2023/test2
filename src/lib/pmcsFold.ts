import type { AuditEvent } from './auditTypes'

/**
 * pmcsFold — the pure, shared fold for property PMCS history. A PMCS IS the event:
 * the faults it finds and the faults it corrects ride INSIDE the pmcs.clear payload
 * (faultsOpened / faultsCorrected), so a single check produces ONE audit row that
 * states its own outcome instead of scattering fault.opened / fault.corrected rows
 * across the timeline.
 *
 * Open-fault state is still folded across checks: a fault opened by one PMCS stays
 * OPEN until a later PMCS lists its id in faultsCorrected. For forward-compat we
 * ALSO fold any legacy standalone fault.opened / fault.corrected events (older data
 * predating the bundle), so a currently-open legacy fault still surfaces for a new
 * check to correct (its correction rides in the new bundled payload, keyed by the
 * legacy fault.opened event id).
 *
 * No PHI: fault descriptions are equipment maintenance text and live only in the
 * clinic-key-encrypted payload — never on the cleartext spine.
 */

export const PMCS_EVENT_TYPES = new Set(['fault.opened', 'fault.corrected', 'pmcs.clear'])

/** A fault FOUND during a PMCS. `id` is a client-generated uuid so a later check
 *  can point its correction back at it. */
export interface PmcsFaultOpened {
  id: string
  description: string
}

/** A fault CORRECTED during a PMCS. `id` = the faultsOpened id (or a legacy
 *  fault.opened event id) being closed; `description` is denormalized so the
 *  history row is self-describing without resolving the originating check. */
export interface PmcsFaultCorrected {
  id: string
  description: string
  note?: string
}

/** A still-open fault for a subject — surfaced in the PMCS CHECK view so the next
 *  check can correct it, and used for the red "unresolved" accent in timelines. */
export interface OpenFault {
  id: string
  description: string
  occurredAt: string
}

function asOpened(v: unknown): PmcsFaultOpened[] {
  if (!Array.isArray(v)) return []
  const out: PmcsFaultOpened[] = []
  for (const f of v) {
    if (f && typeof f === 'object'
      && typeof (f as PmcsFaultOpened).id === 'string'
      && typeof (f as PmcsFaultOpened).description === 'string') {
      out.push({ id: (f as PmcsFaultOpened).id, description: (f as PmcsFaultOpened).description })
    }
  }
  return out
}

function asCorrected(v: unknown): PmcsFaultCorrected[] {
  if (!Array.isArray(v)) return []
  const out: PmcsFaultCorrected[] = []
  for (const f of v) {
    if (f && typeof f === 'object' && typeof (f as PmcsFaultCorrected).id === 'string') {
      const c = f as PmcsFaultCorrected
      out.push({
        id: c.id,
        description: typeof c.description === 'string' ? c.description : 'Fault',
        note: typeof c.note === 'string' ? c.note : undefined,
      })
    }
  }
  return out
}

/** Faults this PMCS reported (bundled in its payload). */
export function pmcsOpened(e: AuditEvent): PmcsFaultOpened[] {
  return asOpened(e.payload?.faultsOpened)
}

/** Faults this PMCS corrected (bundled in its payload). */
export function pmcsCorrected(e: AuditEvent): PmcsFaultCorrected[] {
  return asCorrected(e.payload?.faultsCorrected)
}

/**
 * Fold the subject's still-open faults from its audit events. Sources the new
 * bundled pmcs.clear payloads AND any legacy standalone fault events. A fault is
 * OPEN until some pmcs.clear (or legacy fault.corrected) marks its id corrected.
 * Newest-open-first is the caller's responsibility; this preserves input order.
 */
export function foldOpenFaults(events: AuditEvent[]): OpenFault[] {
  const corrected = new Set<string>()
  for (const e of events) {
    if (e.eventType === 'pmcs.clear') {
      for (const c of pmcsCorrected(e)) corrected.add(c.id)
    } else if (e.eventType === 'fault.corrected') {
      const id = e.payload?.corrects
      if (typeof id === 'string') corrected.add(id)
    }
  }

  const open: OpenFault[] = []
  for (const e of events) {
    if (e.eventType === 'pmcs.clear') {
      for (const o of pmcsOpened(e)) {
        if (!corrected.has(o.id)) open.push({ id: o.id, description: o.description, occurredAt: e.occurredAt })
      }
    } else if (e.eventType === 'fault.opened') {
      if (!corrected.has(e.id)) {
        const d = e.payload?.description
        open.push({ id: e.id, description: typeof d === 'string' && d ? d : 'Fault', occurredAt: e.occurredAt })
      }
    }
  }
  return open
}

export interface PmcsSummary {
  /** Bare outcome — "No new faults" / "Corrected: X" / "New fault: Y" (no prefix). */
  outcome: string
  /** Full headline — `PMCS — ${outcome}`. */
  title: string
  /** Readings line — "1,234 mi · Fuel 80% · RANK Last" (may be empty). */
  readings: string
  /** This check reported at least one new fault (drives the red accent). */
  foundFault: boolean
  /** This check corrected at least one prior fault. */
  correctedFault: boolean
}

/** Summarize a pmcs.clear event for display: its fault outcome + readings line. */
export function summarizePmcs(e: AuditEvent): PmcsSummary {
  const p = e.payload ?? {}
  const opened = pmcsOpened(e)
  const corrected = pmcsCorrected(e)

  const bits: string[] = []
  if (corrected.length === 1) bits.push(`Corrected: ${corrected[0].description}`)
  else if (corrected.length > 1) bits.push(`Corrected ${corrected.length} faults`)
  if (opened.length === 1) bits.push(`New fault: ${opened[0].description}`)
  else if (opened.length > 1) bits.push(`${opened.length} new faults`)
  const outcome = bits.length ? bits.join(' · ') : 'No new faults'

  const parts: string[] = []
  if (typeof p.mileage === 'number') parts.push(`${p.mileage.toLocaleString()} mi`)
  if (typeof p.fuelLevel === 'number') parts.push(`Fuel ${p.fuelLevel}%`)
  if (typeof p.operator === 'string' && p.operator) parts.push(p.operator)
  if (typeof p.mechanic === 'string' && p.mechanic) parts.push(`Mech ${p.mechanic}`)

  return {
    outcome,
    title: `PMCS — ${outcome}`,
    readings: parts.join(' · '),
    foundFault: opened.length > 0,
    correctedFault: corrected.length > 0,
  }
}
