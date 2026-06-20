/**
 * auditBackfill — ONE-TIME dev migration: backfill historical training_completions
 * into the unified audit_log as encrypted training events ("populate the crypt").
 *
 * WHY A CLIENT SCRIPT: server plpgsql cannot produce client-compatible enc.v1:
 * ciphertext (the clinic key + AES-GCM framing live in the browser). So the
 * encryption must happen here. A dev runs it once — devs can read every clinic's
 * encryption_key (clinics RLS) and the two RPCs below are dev-gated.
 *
 * IDEMPOTENT + concurrent-safe: each event id is SHA-256(rowId:eventType) and the
 * insert RPC is on-conflict-do-nothing, so re-runs (or two devs) never duplicate.
 *
 * NOT wired into UI — invoke manually (e.g. a temporary dev action / console):
 *   import { runTrainingAuditBackfill } from './lib/auditBackfill'
 *   await runTrainingAuditBackfill()
 *
 * Coverage: a complete run (deferredNoKey === 0, errors === 0) means every
 * clinic-scoped training_completions row now has events — the precondition for
 * flipping training reads to the fold and eventually dropping training_completions.
 */

import { supabase } from './supabase'
import { encryptAuditPayload } from './cryptoService'
import { createLogger } from '../Utilities/Logger'
import { getErrorMessage } from '../Utilities/errorUtils'
import type { AuditEventType } from './auditTypes'

const logger = createLogger('AuditBackfill')

/** Row shape returned by backfill_list_training_completions (clinic resolved). */
interface BackfillRow {
  id: string
  user_id: string
  clinic_id: string
  training_item_id: string
  completed: boolean
  completed_at: string | null
  completion_type: string
  result: string
  supervisor_id: string | null
  step_results: unknown
  supervisor_notes: string | null
  due_date: string | null
  created_at: string
  updated_at: string
}

interface PlannedEvent {
  eventType: AuditEventType
  actorId: string
  occurredAt: string
  payload: Record<string, unknown>
}

export interface BackfillReport {
  /** Source rows returned by the RPC (clinic-scoped only). */
  rows: number
  /** Events planned from those rows. */
  planned: number
  /** Newly inserted events. */
  inserted: number
  /** Already-present events (idempotent skip — safe). */
  skipped: number
  /** Events skipped because the clinic key was unavailable — RE-RUN when online. */
  deferredNoKey: number
  /** Insert/encrypt errors. */
  errors: number
  clinicsCovered: number
}

/**
 * Deterministic uuid from a source key — SHA-256, first 16 bytes as 8-4-4-4-12.
 * Postgres uuid accepts any 32-hex layout; we don't need RFC version/variant bits,
 * only stable + collision-resistant ids so the backfill is idempotent.
 */
async function deterministicId(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))
  const h = [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

/**
 * Map one training_completions row to the audit event(s) it should produce.
 * Note: a COMPLETED assignment was mutated in place to a 'read'/'test' row by
 * completeAssignment, so pure 'assignment' rows here are always still pending.
 */
function planEvents(r: BackfillRow): PlannedEvent[] {
  const base = { training_item_id: r.training_item_id }
  switch (r.completion_type) {
    case 'read':
      return [{
        eventType: 'read.recorded',
        actorId: r.user_id,
        occurredAt: r.completed_at ?? r.created_at,
        payload: base,
      }]
    case 'test':
      return [{
        eventType: 'test.graded',
        actorId: r.supervisor_id ?? r.user_id,
        occurredAt: r.completed_at ?? r.created_at,
        payload: {
          ...base,
          result: r.result,
          step_results: r.step_results ?? null,
          supervisor_notes: r.supervisor_notes ?? null,
          supervisor_id: r.supervisor_id,
        },
      }]
    case 'assignment':
      return [{
        eventType: 'assignment.created',
        actorId: r.supervisor_id ?? r.user_id,
        occurredAt: r.created_at,
        payload: {
          ...base,
          due_date: r.due_date,
          supervisor_notes: r.supervisor_notes ?? null,
          supervisor_id: r.supervisor_id,
        },
      }]
    default:
      return []
  }
}

/**
 * Run the one-time training → audit_log backfill. Dev-only (RPCs are dev-gated).
 * Safe to re-run; returns a coverage report. If deferredNoKey > 0, a clinic key
 * could not be fetched (offline / missing) — re-run online to close the gap.
 */
export async function runTrainingAuditBackfill(): Promise<BackfillReport> {
  const report: BackfillReport = {
    rows: 0, planned: 0, inserted: 0, skipped: 0, deferredNoKey: 0, errors: 0, clinicsCovered: 0,
  }

  const { data, error } = await supabase.rpc('backfill_list_training_completions')
  if (error) {
    logger.error('backfill_list_training_completions failed:', error.message)
    throw new Error(error.message)
  }
  const rows = (data ?? []) as BackfillRow[]
  report.rows = rows.length

  // Group by clinic so each clinic key is fetched once.
  const byClinic = new Map<string, BackfillRow[]>()
  for (const r of rows) {
    const arr = byClinic.get(r.clinic_id)
    if (arr) arr.push(r)
    else byClinic.set(r.clinic_id, [r])
  }

  for (const [clinicId, clinicRows] of byClinic) {
    report.clinicsCovered++
    for (const r of clinicRows) {
      for (const ev of planEvents(r)) {
        report.planned++
        try {
          const payloadEnc = await encryptAuditPayload(clinicId, ev.payload)
          if (payloadEnc == null) {
            report.deferredNoKey++ // clinic key unavailable — re-run online
            continue
          }
          const id = await deterministicId(`${r.id}:${ev.eventType}`)
          const { data: inserted, error: insErr } = await supabase.rpc('_emit_audit_backfill', {
            p_id: id,
            p_clinic_id: clinicId,
            p_actor: ev.actorId,
            p_domain: 'training',
            p_event: ev.eventType,
            p_subject_type: 'user',
            p_subject_id: r.user_id,
            p_occurred_at: ev.occurredAt,
            p_payload_enc: payloadEnc,
          })
          if (insErr) {
            report.errors++
            logger.warn(`_emit_audit_backfill failed for ${r.id}/${ev.eventType}:`, insErr.message)
            continue
          }
          if (inserted) report.inserted++
          else report.skipped++
        } catch (err) {
          report.errors++
          logger.warn(`backfill row ${r.id} error:`, getErrorMessage(err, String(err)))
        }
      }
    }
  }

  logger.info('Training audit backfill complete:', report)
  return report
}
