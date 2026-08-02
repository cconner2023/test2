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
  getLocalAuditLog,
  getLocalAuditLogsBySubject,
  getLocalAuditLogsByClinicDomain,
  getDeferredAuditLogs,
  getAuditCursor,
  putAuditCursor,
  deleteLocalAuditLog,
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
    rows.map(async (r) => {
      // A locally deferred EDIT of an already-synced event still holds its new
      // payload in plaintext. The server copy is the pre-edit world, so caching
      // it over the row would discard the correction before the flush ever ran.
      const local = await getLocalAuditLog(r.id).catch(() => undefined)
      if (local?.payload_plain != null) return

      await saveLocalAuditLog({
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
      }).catch(() => {})
    }),
  )
}

// ---- Emit ----

/**
 * Emit an immutable audit event. Returns the local row, or null on failure.
 *
 * Encrypt-or-defer: when a payload is supplied but the clinic key is
 * unavailable, the event is stored locally in 'error' sync state with its
 * payload in `payload_plain` and is NOT enqueued — a plaintext payload must
 * never reach Supabase. flushDeferredAudit encrypts and enqueues it once the
 * key is cached. Spine-only events always enqueue.
 *
 * Holding the plaintext is the whole point of the defer: dropping it (which is
 * what this did before) discarded the write silently, since nothing else in the
 * app holds the event once the caller returns.
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
      payload_plain: deferred ? input.payload ?? null : null,
      _deferred_action: 'create',
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

/**
 * Drain the encrypt-or-defer backlog: seal every parked event with its clinic's
 * key and enqueue it. Returns how many were released.
 *
 * Deferred rows are invisible to the sync queue by construction — emitAudit
 * deliberately does not enqueue an event it could not seal — so nothing else
 * will ever pick them up. This is the only path out of that state, which is why
 * it runs on the sync tick rather than at a call site that may never fire again.
 *
 * Scoped per clinic and NOT per row: a key that is still missing strands that
 * clinic's whole batch (there is nothing to retry but the same failing fetch),
 * while every other clinic drains normally. An event carries the clinic the
 * actor was supervising when they wrote it, so one device's backlog routinely
 * spans more than one.
 */
export async function flushDeferredAudit(userId: string): Promise<number> {
  let released = 0
  try {
    const byClinic = new Map<string, LocalAuditLog[]>()
    for (const row of await getDeferredAuditLogs()) {
      const bucket = byClinic.get(row.clinic_id)
      if (bucket) bucket.push(row)
      else byClinic.set(row.clinic_id, [row])
    }

    for (const [clinicId, rows] of byClinic) {
      if (!isUuid(clinicId)) continue
      for (const row of rows) {
        const payloadEnc = await encryptAuditPayload(clinicId, row.payload_plain)
        if (payloadEnc == null) break // key still unavailable — this clinic waits

        const action = row._deferred_action ?? 'create'
        const sealed: LocalAuditLog = {
          ...row,
          payload_enc: payloadEnc,
          payload_plain: null,
          _sync_status: 'pending',
          _last_sync_error_message: null,
        }
        await saveLocalAuditLog(sealed)
        await addToSyncQueue({
          user_id: userId,
          action,
          table_name: 'audit_log',
          record_id: sealed.id,
          payload: {
            id: sealed.id,
            clinic_id: sealed.clinic_id,
            actor_id: sealed.actor_id,
            domain: sealed.domain,
            event_type: sealed.event_type,
            subject_type: sealed.subject_type,
            subject_id: sealed.subject_id,
            occurred_at: sealed.occurred_at,
            payload_enc: sealed.payload_enc,
            // seq is GENERATED ALWAYS — never sent. updated_at backs the sync
            // layer's last-write-wins compare and is only meaningful on an edit.
            ...(action === 'update' ? { updated_at: new Date().toISOString() } : {}),
          },
        })
        released++
      }
    }
    if (released > 0) logger.info(`Released ${released} deferred audit event(s)`)
  } catch (err) {
    logger.error('flushDeferredAudit failed:', getErrorMessage(err, String(err)))
  }
  return released
}

/**
 * Edit an existing event's encrypted payload in place — re-encrypts `newPayload`
 * with the clinic key and enqueues a hard `update` to audit_log. The event keeps
 * its id, seq, subject and occurred_at; only payload_enc (and a fresh updated_at
 * for last-write-wins) change. Used for PMCS history edits (fix a fault's text /
 * a correction note). audit_log gained UPDATE/DELETE RLS on 2026-06-21 — before
 * that it was strictly append-only.
 *
 * Encrypt-or-defer mirrors emitAudit: if the clinic key is unavailable the edit
 * is held as plaintext in `payload_plain` and NOT enqueued (no plaintext on the
 * wire), and the PRIOR ciphertext is left in place — overwriting it with null
 * would destroy the original event to stage an edit that has not been sealed.
 * Returns the updated local row, or null if the event is unknown / edit failed.
 */
export async function updateAuditEvent(
  eventId: string,
  newPayload: Record<string, unknown>,
  userId: string,
): Promise<LocalAuditLog | null> {
  try {
    const existing = await getLocalAuditLog(eventId)
    if (!existing) {
      logger.warn(`updateAuditEvent: event ${eventId} not found locally`)
      return null
    }

    const payloadEnc = await encryptAuditPayload(existing.clinic_id, newPayload)
    const deferred = payloadEnc == null // key unavailable
    const nowIso = new Date().toISOString()

    const row: LocalAuditLog = {
      ...existing,
      payload_enc: deferred ? existing.payload_enc : payloadEnc,
      payload_plain: deferred ? newPayload : null,
      _deferred_action: 'update',
      _sync_status: deferred ? 'error' : 'pending',
      _sync_retry_count: 0,
      _last_sync_error: null,
      _last_sync_error_message: deferred
        ? 'clinic key unavailable — payload unencrypted, sync deferred'
        : null,
    }

    await saveLocalAuditLog(row)

    if (deferred) {
      logger.warn(`Audit edit ${eventId} deferred: clinic key unavailable`)
      return row
    }

    // seq is GENERATED ALWAYS — never send it in an update. updated_at backs
    // the sync layer's last-write-wins compare.
    await addToSyncQueue({
      user_id: userId,
      action: 'update',
      table_name: 'audit_log',
      record_id: eventId,
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
        updated_at: nowIso,
      },
    })

    return row
  } catch (err) {
    logger.error('updateAuditEvent failed:', getErrorMessage(err, String(err)))
    return null
  }
}

/**
 * Hard-delete an audit event — removes the local row and enqueues a `delete` to
 * audit_log. Used for deleting a PMCS history entry (fault / correction / clean
 * check). Append-only was relaxed for this on 2026-06-21; the row is physically
 * removed, not tombstoned. Returns true if the local delete + enqueue succeeded.
 *
 * NOTE: the server delete only lands for event types in the audit_log_delete RLS
 * allow-list. A blocked delete returns 0 rows (not an error) and the row survives
 * server-side, so the next read-through re-cache resurrects it. The allow-list was
 * widened on 2026-06-24 to cover the property item.* lifecycle types.
 */
export async function deleteAuditEvent(eventId: string, userId: string): Promise<boolean> {
  try {
    await deleteLocalAuditLog(eventId)
    await addToSyncQueue({
      user_id: userId,
      action: 'delete',
      table_name: 'audit_log',
      record_id: eventId,
      payload: {},
    })
    return true
  } catch (err) {
    logger.error('deleteAuditEvent failed:', getErrorMessage(err, String(err)))
    return false
  }
}

/**
 * Cascade hard-delete EVERY audit event for a subject — used when an item is
 * removed from accountability and the user opted to take its history with it.
 * Enumerates the local rows AND (best-effort, when online) the server set via
 * fetchAuditBySubject, so rows never cached on this device are still enqueued for
 * deletion. Each row is deleted locally and a server `delete` is enqueued.
 *
 * Relies on the widened audit_log_delete RLS (2026-06-24, item.* lifecycle types)
 * — otherwise the lifecycle/custody rows would silently no-op server-side and
 * resurrect via the read-through cache. The caller must flush the queue (await
 * the sync) before any audit refetch, for the same reason. Returns the count
 * enqueued; never throws (item delete must not fail on an audit hiccup).
 */
export async function deleteAuditEventsBySubject(
  subjectId: string,
  userId: string,
  opts: { clinicId?: string } = {},
): Promise<number> {
  try {
    if (!isUuid(subjectId)) return 0
    const ids = new Set<string>()
    const local = await getLocalAuditLogsBySubject(subjectId)
    local.forEach((r) => ids.add(r.id))
    // Pull the server set too so uncached rows are caught. fetchAuditBySubject
    // re-caches into IDB; we immediately delete those local rows below — net
    // result is a clean local delete + enqueued server delete for every row.
    try {
      const remote = await fetchAuditBySubject(subjectId, { clinicId: opts.clinicId })
      remote.forEach((e) => ids.add(e.id))
    } catch {
      // offline — fall back to the local set only; the rest flush on reconnect.
    }

    for (const id of ids) {
      await deleteLocalAuditLog(id)
      await addToSyncQueue({
        user_id: userId,
        action: 'delete',
        table_name: 'audit_log',
        record_id: id,
        payload: {},
      })
    }
    return ids.size
  } catch (err) {
    logger.error('deleteAuditEventsBySubject failed:', getErrorMessage(err, String(err)))
    return 0
  }
}

/**
 * Delete the item.transferred timeline row(s) a custody/sign-out entry dual-wrote.
 * recordLedgerEntry stamps the custody row's recorded_at and the audit event's
 * occurred_at from the SAME `now`, so a custody row maps to its timeline entry by
 * (subjectId = item_id, eventType = 'item.transferred', occurredAt = recorded_at).
 * Used when a DA 2062 receipt (or one of its items) is deleted with the
 * records+timeline scope. Local delete + enqueued server delete; never throws.
 */
export async function deleteTransferAuditForCustody(
  itemId: string,
  recordedAt: string,
  userId: string,
): Promise<number> {
  try {
    if (!isUuid(itemId)) return 0
    const rows = await getLocalAuditLogsBySubject(itemId)
    let n = 0
    for (const r of rows) {
      if (r.event_type !== 'item.transferred' || r.occurred_at !== recordedAt) continue
      await deleteLocalAuditLog(r.id)
      await addToSyncQueue({
        user_id: userId,
        action: 'delete',
        table_name: 'audit_log',
        record_id: r.id,
        payload: {},
      })
      n++
    }
    return n
  } catch (err) {
    logger.error('deleteTransferAuditForCustody failed:', getErrorMessage(err, String(err)))
    return 0
  }
}

// ---- Decrypt mapper ----

/**
 * Map a stored/server row into a decrypted AuditEvent (payload decrypted).
 *
 * A local row deferred for want of a clinic key is read from its held plaintext,
 * and that WINS over the ciphertext rather than merely standing in for it: on a
 * deferred edit both are present and the plaintext is the newer of the two. It
 * is cleared the instant the flush seals it, so this never shadows a live
 * payload.
 *
 * Without the fallback the fold drops such an event whole — every fold keys off
 * a payload field (training_item_id, item id), so a payload-less event is
 * invisible, and a grade taken offline looked like a button that did nothing.
 */
export async function toAuditEvent(row: AuditRow | LocalAuditLog): Promise<AuditEvent> {
  const pending = 'payload_plain' in row ? row.payload_plain ?? null : null
  const payload =
    pending ??
    (await decryptAuditPayload<Record<string, unknown>>(row.clinic_id, row.payload_enc))
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

/** Read a clinic's events in one domain from local IDB (offline-first), decrypted. */
export async function getAuditByClinicDomainLocal(
  clinicId: string,
  domain: AuditDomain,
): Promise<AuditEvent[]> {
  if (!isUuid(clinicId)) return []
  const rows = await getLocalAuditLogsByClinicDomain(clinicId, domain)
  return Promise.all(rows.map(toAuditEvent))
}

// ---- Read: local-first + delta (the shape every audit consumer should use) ----

/**
 * Merge two event sets by id, server copy winning.
 *
 * The overlap is not incidental: a locally-emitted event and its synced twin
 * are the SAME id, and only the server copy carries `seq`. Preferring it is
 * what lets the fold order a just-written event correctly the moment it syncs.
 */
function mergeEvents(local: AuditEvent[], fresh: AuditEvent[]): AuditEvent[] {
  const byId = new Map(local.map((e) => [e.id, e]))
  for (const e of fresh) byId.set(e.id, e)
  return [...byId.values()]
}

/** Highest seq in a pulled page — the mark the next delta resumes from. */
function maxSeq(events: AuditEvent[]): number {
  let max = 0
  for (const e of events) if (e.seq != null && e.seq > max) max = e.seq
  return max
}

/**
 * Local-first read of a clinic's domain events, topped up by a delta pull.
 *
 * Local IDB answers first and ALWAYS contributes, which is the whole point: an
 * event emitted seconds ago is in IDB with `seq: null` and `_sync_status:
 * 'pending'`, and the sync queue only drains on its 30s tick. A server-only
 * read refetches a world that does not contain the caller's own write yet, so
 * the surface that just wrote comes back blank — and stays blank offline.
 *
 * The server half pulls only `seq > cursor`. audit_log is append-only, so
 * anything at or below the mark is already cached and immutable; there is
 * nothing to re-read. A short page (limit hit) advances the cursor to its last
 * seq and the next call resumes there, so coverage is monotonic either way.
 */
export async function loadAuditByClinicDomain(
  clinicId: string,
  domain: AuditDomain,
  opts: { limit?: number } = {},
): Promise<AuditEvent[]> {
  if (!isUuid(clinicId)) return []
  const cursorKey = `clinic|${clinicId}|${domain}`
  const [local, since] = await Promise.all([
    getAuditByClinicDomainLocal(clinicId, domain).catch(() => [] as AuditEvent[]),
    getAuditCursor(cursorKey),
  ])
  const fresh = await fetchAuditByClinicDomain(clinicId, domain, {
    since,
    limit: opts.limit,
  }).catch(() => [] as AuditEvent[])
  await putAuditCursor(cursorKey, maxSeq(fresh))
  return mergeEvents(local, fresh)
}

/**
 * Local-first read of one subject's events, topped up by a delta pull.
 * Subject-scoped sibling of loadAuditByClinicDomain — same contract, and the
 * cursor is keyed by clinic too because the RPC filters on it.
 */
export async function loadAuditBySubject(
  subjectId: string,
  clinicId: string,
  opts: { limit?: number } = {},
): Promise<AuditEvent[]> {
  if (!isUuid(subjectId)) return []
  const cursorKey = `subject|${clinicId}|${subjectId}`
  const [local, since] = await Promise.all([
    getAuditBySubjectLocal(subjectId).catch(() => [] as AuditEvent[]),
    getAuditCursor(cursorKey),
  ])
  const fresh = isUuid(clinicId)
    ? await fetchAuditBySubject(subjectId, {
        clinicId,
        since,
        limit: opts.limit,
      }).catch(() => [] as AuditEvent[])
    : []
  await putAuditCursor(cursorKey, maxSeq(fresh))
  return mergeEvents(local, fresh)
}

// ---- Read: server (read_audit RPC) ----

/**
 * In-flight coalescing for read_audit pulls. The property surface mounts several
 * audit-backed hooks in one commit — useVehicleDispatches (dispatch sheet /
 * readiness / calendar) and useRecentPropertyActivity (custody panel) all pull the
 * SAME (clinicId, 'property') set, and dev StrictMode double-invokes each effect.
 * Without this, each fires its own identical RPC (the millisecond-spaced bursts
 * seen in the API logs). Concurrent reads with identical params share one network
 * call instead. Keyed by every param that determines the result and dropped the
 * instant the promise settles — so each `properties` invalidation still refetches
 * fresh (no staleness window, purely a same-tick coalescer).
 */
const inFlightAudit = new Map<string, Promise<AuditEvent[]>>()

function coalesceAudit(key: string, run: () => Promise<AuditEvent[]>): Promise<AuditEvent[]> {
  const existing = inFlightAudit.get(key)
  if (existing) return existing
  const p = run().finally(() => { inFlightAudit.delete(key) })
  inFlightAudit.set(key, p)
  return p
}

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
  const clinicId = opts.clinicId ?? null
  const since = opts.since ?? 0
  const limit = opts.limit ?? 500
  return coalesceAudit(`subject|${subjectId}|${clinicId ?? ''}|${since}|${limit}`, async () => {
    const { data, error } = await supabase.rpc('read_audit', {
      p_subject_id: subjectId,
      p_domain: null,
      p_clinic_id: clinicId,
      p_since: since,
      p_limit: limit,
    })
    if (error) {
      logger.warn('fetchAuditBySubject failed:', error.message)
      return []
    }
    const rows = (data ?? []) as AuditRow[]
    await cacheAuditRows(rows)
    return Promise.all(rows.map(toAuditEvent))
  })
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
  const since = opts.since ?? 0
  const limit = opts.limit ?? 1000
  return coalesceAudit(`domain|${clinicId}|${domain}|${since}|${limit}`, async () => {
    const { data, error } = await supabase.rpc('read_audit', {
      p_subject_id: null,
      p_domain: domain,
      p_clinic_id: clinicId,
      p_since: since,
      p_limit: limit,
    })
    if (error) {
      logger.warn('fetchAuditByClinicDomain failed:', error.message)
      return []
    }
    const rows = (data ?? []) as AuditRow[]
    await cacheAuditRows(rows)
    return Promise.all(rows.map(toAuditEvent))
  })
}
