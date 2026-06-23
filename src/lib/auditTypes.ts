/**
 * Unified audit-log types.
 *
 * `audit_log` is the single append-only event store for the property and
 * training domains. It replaces per-domain audit tables (custody_ledger folds
 * in; training_completions becomes a fold over training events). Each row is an
 * immutable event; current state is a projection. Personnel/account lifecycle
 * (account creation, home-cluster moves, loans) is intentionally NOT audited
 * here — strictly training + property.
 *
 * WIRE/ENCRYPTION CONTRACT (Tier 1 — clinic-key at rest):
 * - The SPINE (seq, clinic_id, actor_id, domain, event_type, subject_type,
 *   subject_id, occurred_at) is cleartext operational vocabulary — it MUST be,
 *   so RLS, realtime and the `seq` delta-cursor can filter on it. No PHI.
 * - The TAIL (`payload_enc`) is AES-256-GCM(clinic key), `enc.v1:` framed, via
 *   encryptAuditPayload/decryptAuditPayload in cryptoService. Spine-only events
 *   (e.g. a clean PMCS check) store payload_enc = null.
 * - `seq` is a server-assigned monotonic bigint — the delta cursor. It is null
 *   locally until the row syncs.
 */

/** Domains tracked in the unified audit_log. Strictly property + training
 *  (cert reserved). Personnel/account events are NOT tracked here. */
export type AuditDomain = 'property' | 'training' | 'cert'

/** What an event is about. `location` covers property zones incl. vehicles
 *  (a vehicle is a kind='vehicle' property_location that carries its own 5988). */
export type AuditSubjectType = 'user' | 'item' | 'algorithm' | 'location'

/**
 * Event vocabulary, namespaced `<noun>.<verb>`. Stored as text server-side
 * (open vocabulary, no enum churn) but enumerated here for client exhaustiveness.
 */
export type AuditEventType =
  // property — payload: { quantity_delta?, condition_code?, from_holder_id?, to_holder_id?, notes?, sub_item_check? }
  | 'item.transferred'
  | 'item.expended'
  // property lifecycle — payload varies:
  //  created:  { name, nsn?, serial_number?, quantity?, is_serialized?, condition_code?, location_id?, parent_item_id? }
  //  moved:    { from_location_id, to_location_id }
  //  assigned: { from_holder_id, to_holder_id }
  //  edited:   { changed: string[] }
  //  deleted:  { name?, nsn?, serial_number? }   // item removed from accountability
  | 'item.created'
  | 'item.moved'
  | 'item.assigned'
  | 'item.edited'
  | 'item.deleted'
  // property faults — a fault can belong to ANY property item (vehicle 5988
  // faults, a broken med fridge, an unserviceable monitor). Append-only:
  // correcting never removes the opened event, so the full found→fixed history
  // stays in the item timeline. Free-text lives in the encrypted payload.
  //  opened:    { description }
  //  corrected: { corrects, note? }   // `corrects` = the fault.opened event id
  | 'fault.opened'
  | 'fault.corrected'
  // property PMCS — a preventive-maintenance check was performed. The standard
  // intake captures readings in the (encrypted) payload; faults found during the
  // same check are separate fault.opened events. Logged so every PMCS leaves a
  // paper-trail entry (proof the subject was inspected on this date).
  //  payload: { mileage?, fuelLevel?, operator?, mechanic?, doc? }  — vehicle
  //           intake readings + who did it: `operator` (the soldier who performed
  //           the check, picked from the clinic roster) + `mechanic` (optional
  //           free-text name of who serviced it). No PHI (operational names only).
  //           Optionally an attached 5988E worksheet. `doc` = { path, key, mime?,
  //           name? }: the worksheet is encrypted client-side into the
  //           message-attachments bucket (random AES key) and the decryption key
  //           rides inside this (clinic-key-encrypted) payload — server never
  //           sees the file plaintext.
  //  payload = null                     — clean check on a non-vehicle item, no doc.
  | 'pmcs.clear'
  // property DISPATCH — a vehicle (kind='vehicle' location) was put on dispatch
  // (DA 5982/5987 motor-equipment dispatch). subjectType is ALWAYS 'location'
  // (vehicles only). Append-only, mirroring faults: opening never mutates the
  // vehicle, and closing leaves the opened event intact so the full
  // dispatched→returned history stays in the timeline. The CURRENT dispatch is
  // the open dispatch.opened with no dispatch.closed pointing back at it (the
  // same client-side fold as open faults); a dispatch with exp_date < now is
  // lapsed even without a close. exp_date / odometer / the dispatch form are
  // operational, no PHI — they ride in the (clinic-key) encrypted payload.
  //  opened:  { exp_date, doc?, note?, odo_out?, operator?, tc? }   // exp_date =
  //           ISO date the dispatch authorization expires; operator/tc = free-text
  //           names of the driver + track commander (so we can see who took it
  //           out); `doc` = the encrypted DA 5982/5987
  //           ({ path, key, mime?, name? }, same attachment pipeline as the 5988E).
  //  closed:  { dispatches, returned_at, doc?, note?, odo_in? }  // `dispatches`
  //           = the dispatch.opened event id this return closes.
  | 'dispatch.opened'
  | 'dispatch.closed'
  // training — payload: { training_item_id, result?, step_results?, supervisor_notes?, due_date?, supersedes? }
  | 'read.recorded'
  | 'test.graded'
  | 'assignment.created'
  | 'assignment.completed'
  | 'completion.voided'
  // cert — payload: { cert_id, expires_at? }
  | 'cert.earned'
  | 'cert.expired'

/** A decrypted audit event as consumed by the UI / timeline / folds. */
export interface AuditEvent {
  id: string
  /** Server-assigned monotonic delta cursor. Null until synced. */
  seq: number | null
  clinicId: string
  actorId: string | null
  domain: AuditDomain
  eventType: AuditEventType
  subjectType: AuditSubjectType
  subjectId: string
  occurredAt: string
  /** Decrypted payload object, or null for spine-only events. */
  payload: Record<string, unknown> | null
}

/** Args to emit a new event (id/seq/occurred_at filled by the emitter). */
export interface EmitAuditInput {
  clinicId: string
  actorId: string | null
  domain: AuditDomain
  eventType: AuditEventType
  subjectType: AuditSubjectType
  subjectId: string
  occurredAt?: string
  /** Sensitive tail — encrypted before write. Omit for spine-only events. */
  payload?: Record<string, unknown> | null
}
