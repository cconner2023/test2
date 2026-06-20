/**
 * auditService — emit + read for the unified append-only `audit_log`.
 *
 * Write: emitAudit encrypts the sensitive tail with the clinic key, writes the
 * event to IDB, and enqueues it offline-first. Spine-only events (personnel
 * moves) carry no payload. Read: local (IDB) for offline timelines, or the
 * `read_audit` RPC for supervisor/admin (cross-clinic dev reads included).
 *
 * See auditTypes.ts for the encryption/spine contract. Training folds events
 * into the legacy TrainingCompletion shape — that lives with the training hooks,
 * not here, so this stays domain-agnostic.
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { getErrorMessage } from '../Utilities/errorUtils'
import { encryptAuditPayload, decryptAuditPayload } from './cryptoService'
import {
  addToSyncQueue,
  saveLocalAuditLog,
  getLocalAuditLogsBySubject,
  type LocalAuditLog,
} from './offlineDb'
import type { AuditDomain, AuditEvent, EmitAuditInput } from './auditTypes'

const logger = createLogger('AuditService')

/**
 * Subject/clinic ids must be real UUIDs. During the auth token-refresh window
 * `user` is briefly null and callers fall back to the literal 'guest' — sending
 * that to a uuid-typed RPC param throws "invalid input syntax for type uuid".
 * Guard reads so a transient guest id quietly yields no events instead of a 400.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v)
}

/** Raw server row shape returned by the read_audit RPC / a direct select. */
interface AuditRow {
  seq: number | null
  id: string
  clinic_id: string
  actor_id: string | null
  domain: AuditDomain
  event_type: string
  subject_type: AuditEvent['subjectType']
  subject_id: string
  occurred_at: string
  payload_enc: string | null
  created_at?: string
}

/**
 * Read-through cache: persist server rows into the local IDB auditLog store so the
 * event fold is offline-complete (local IDB otherwise holds only this device's own
 * emits, not the backfilled / cross-device history). Best-effort, never throws.
 */
async function cacheAuditRows(rows: AuditRow[]): Promise<void> {
  await Promise.all(
    rows.map((r) =>
      saveLocalAuditLog({
        id: r.id,
        seq: r.seq ?? null,
        clinic_id: r.clinic_id,
        actor_id: r.actor_id,
        domain: r.domain,
        event_type: r.event_type,
        subject_type: r.subject_type,
        subject_id: r.subject_id,
        occurred_at: r.occurred_at,
        payload_enc: r.payload_enc,
        created_at: r.created_at ?? r.occurred_at,
        _sync_status: 'synced',
        _sync_retry_count: 0,
        _last_sync_error: null,
        _last_sync_error_message: null,
      }).catch(() => {}),
    ),
  )
}

// ---- Emit ----

/**
 * Emit an immutable audit event. Returns the local row, or null on failure.
 *
 * Encrypt-or-defer: when a payload is supplied but the clinic key is
 * unavailable, the event is stored locally in 'error' sync state and is NOT
 * enqueued — a plaintext payload must never reach Supabase. A later flush
 * (once the key is cached) re-emits it. Spine-only events always enqueue.
 */
export async function emitAudit(
  input: EmitAuditInput,
  userId: string,
): Promise<LocalAuditLog | null> {
  try {
    const id = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    let payloadEnc: string | null = null
    let deferred = false
    if (input.payload != null) {
      payloadEnc = await encryptAuditPayload(input.clinicId, input.payload)
      deferred = payloadEnc == null // key unavailable
    }

    const row: LocalAuditLog = {
      id,
      seq: null, // server-assigned on sync
      clinic_id: input.clinicId,
      actor_id: input.actorId,
      domain: input.domain,
      event_type: input.eventType,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      occurred_at: input.occurredAt ?? nowIso,
      payload_enc: payloadEnc,
      created_at: nowIso,
      _sync_status: deferred ? 'error' : 'pending',
      _sync_retry_count: 0,
      _last_sync_error: null,
      _last_sync_error_message: deferred
        ? 'clinic key unavailable — payload unencrypted, sync deferred'
        : null,
    }

    await saveLocalAuditLog(row)

    if (deferred) {
      logger.warn(`Audit event ${input.domain}/${input.eventType} deferred: clinic key unavailable`)
      return row
    }

    // seq + created_at are server-assigned — omit from the wire payload.
    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'audit_log',
      record_id: id,
      payload: {
        id: row.id,
        clinic_id: row.clinic_id,
        actor_id: row.actor_id,
        domain: row.domain,
        event_type: row.event_type,
        subject_type: row.subject_type,
        subject_id: row.subject_id,
        occurred_at: row.occurred_at,
        payload_enc: row.payload_enc,
      },
    })

    return row
  } catch (err) {
    // Audit emission is best-effort plumbing — never let it break the caller's
    // primary mutation (a transfer/grade/loan must still succeed).
    logger.error('emitAudit failed:', getErrorMessage(err, String(err)))
    return null
  }
}

// ---- Decrypt mapper ----

/** Map a stored/server row into a decrypted AuditEvent (payload decrypted). */
export async function toAuditEvent(row: AuditRow | LocalAuditLog): Promise<AuditEvent> {
  const payload = await decryptAuditPayload<Record<string, unknown>>(
    row.clinic_id,
    row.payload_enc,
  )
  return {
    id: row.id,
    seq: row.seq ?? null,
    clinicId: row.clinic_id,
    actorId: row.actor_id,
    domain: row.domain,
    eventType: row.event_type as AuditEvent['eventType'],
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    occurredAt: row.occurred_at,
    payload,
  }
}

// ---- Read: local (offline) ----

/** Read a subject's events from the local IDB store (offline-first), decrypted. */
export async function getAuditBySubjectLocal(subjectId: string): Promise<AuditEvent[]> {
  if (!isUuid(subjectId)) return []
  const rows = await getLocalAuditLogsBySubject(subjectId)
  return Promise.all(rows.map(toAuditEvent))
}

// ---- Read: server (read_audit RPC) ----

/**
 * Fetch a subject's audit timeline from the server via read_audit.
 * Dev callers may read cross-clinic; non-dev callers must pass their own
 * clinicId (the RPC enforces this). `since` is the last seen `seq` (delta).
 */
export async function fetchAuditBySubject(
  subjectId: string,
  opts: { clinicId?: string; since?: number; limit?: number } = {},
): Promise<AuditEvent[]> {
  if (!isUuid(subjectId)) return []
  const { data, error } = await supabase.rpc('read_audit', {
    p_subject_id: subjectId,
    p_domain: null,
    p_clinic_id: opts.clinicId ?? null,
    p_since: opts.since ?? 0,
    p_limit: opts.limit ?? 500,
  })
  if (error) {
    logger.warn('fetchAuditBySubject failed:', error.message)
    return []
  }
  const rows = (data ?? []) as AuditRow[]
  await cacheAuditRows(rows)
  return Promise.all(rows.map(toAuditEvent))
}

/**
 * Fetch all events of a domain for a clinic (e.g. domain=training for the
 * supervisor competency fold). `since` enables delta pulls by `seq`.
 */
export async function fetchAuditByClinicDomain(
  clinicId: string,
  domain: AuditDomain,
  opts: { since?: number; limit?: number } = {},
): Promise<AuditEvent[]> {
  if (!isUuid(clinicId)) return []
  const { data, error } = await supabase.rpc('read_audit', {
    p_subject_id: null,
    p_domain: domain,
    p_clinic_id: clinicId,
    p_since: opts.since ?? 0,
    p_limit: opts.limit ?? 1000,
  })
  if (error) {
    logger.warn('fetchAuditByClinicDomain failed:', error.message)
    return []
  }
  const rows = (data ?? []) as AuditRow[]
  await cacheAuditRows(rows)
  return Promise.all(rows.map(toAuditEvent))
}
