/**
 * Training completions service — offline-first CRUD for read and test completions.
 *
 * Follows the same patterns as notesService.ts:
 *   1. All writes go to IndexedDB first (immediate, always available)
 *   2. Writes are queued for Supabase sync via the sync queue
 *   3. When online, an immediate sync to Supabase is attempted
 *   4. On reconnect, the sync service reconciles local vs. server state
 *
 * Two completion types:
 *   - 'read': self-reported by the medic (scrolled to bottom / clicked "Mark Complete")
 *   - 'test': evaluated by a supervisor (GO/NO_GO per performance step)
 */

import {
  getLocalTrainingCompletions,
  type LocalTrainingCompletion,
  type TrainingCompletionSyncStatus,
  setTrainingCalendarLink,
  getTrainingCalendarLink,
  getTrainingCalendarLinksByOrigin,
  deleteTrainingCalendarLink,
  relinkTrainingCalendarOrigin,
} from './offlineDb'
import type { CompletionType, CompletionResult } from '../Types/database.types'
import type { StepResult } from '../Types/SupervisorTestTypes'
import { createLogger } from '../Utilities/Logger'
import { succeed, fail, type ServiceResult } from './result'
import { emitAudit, deleteAuditEvent, loadAuditBySubject } from './auditService'
import { useAuthStore } from '../stores/useAuthStore'
import { parseFoldRowId, foldRowId } from './trainingFold'
import { aliasTrainingItemId } from '../Data/trainingItemAlias'
import type { AuditEventType } from './auditTypes'

/**
 * Emit a training lifecycle event into the unified audit_log. The event IS the
 * completion — the fold is the only source of current state — so a failure here
 * is a lost grade, not a lost shadow copy, and it is reported rather than
 * swallowed. Every caller propagates it so the UI can drop its optimistic row
 * instead of showing a completion that no store holds.
 *
 * subject = the soldier; clinic = the ACTIVE clinic (own clinic for self-report,
 * the supervised cluster when toggled into one); actor = the authed user, which
 * is also the sync-queue owner.
 *
 * training_item_id rides in the (encrypted) payload, not the spine: the fold
 * groups by (subject, training_item_id) client-side after decrypt; it is never
 * a SQL filter. result/step_results/supervisor_notes are the sensitive tail.
 */
async function emitTrainingEvent(
  eventType: AuditEventType,
  subjectUserId: string,
  actorUserId: string,
  payload: Record<string, unknown>,
  occurredAt: string,
): Promise<ServiceResult<{ eventId: string }>> {
  // The ACTIVE clinic, not the home one. A supervisor toggled into a loaned
  // cluster grades that cluster's roster, so the event belongs to it — and the
  // supervisor fold reads `supervisingClinicId ?? clinicId`, so stamping the
  // home id here wrote every loaned-in grade to a clinic nothing reads back.
  // It also sealed the payload with the wrong clinic key, leaving the event
  // undecryptable by the cluster whose soldier it is about.
  const { clinicId, supervisingClinicId } = useAuthStore.getState()
  const activeClinicId = supervisingClinicId ?? clinicId
  // Both of these used to `return` silently, which is what made a graded walk
  // look like a dead button: the caller still handed the UI an optimistic row,
  // and the next refold — reading a store nothing had been written to — took it
  // straight back off the screen with nothing logged anywhere.
  if (!activeClinicId) return fail('No active clinic — sign in again before grading.')
  if (actorUserId === 'guest') return fail('Not signed in — training cannot be recorded.')

  const row = await emitAudit(
    {
      clinicId: activeClinicId,
      actorId: actorUserId,
      domain: 'training',
      eventType,
      subjectType: 'user',
      subjectId: subjectUserId,
      occurredAt,
      payload,
    },
    actorUserId,
  )
  // emitAudit swallows its own errors and reports them as null. A deferred row
  // is NOT one of them: it is written locally, folds from its held plaintext,
  // and the sync flush seals it later — the write succeeded, it just has not
  // left the device.
  if (!row) return fail('Could not record the training event. Try again.')
  // The event id is the read's identity in the fold — one row per rep — so it
  // has to come back out rather than being dropped on the floor here.
  return succeed({ eventId: row.id })
}

const logger = createLogger('TrainingService')

// ============================================================
// Public Types
// ============================================================

/** UI-friendly representation of a training completion. */
export interface TrainingCompletionUI {
  id: string
  userId: string
  trainingItemId: string
  completionType: CompletionType
  result: CompletionResult
  supervisorId: string | null
  stepResults: StepResult[] | null
  supervisorNotes: string | null
  dueDate: string | null
  calendarOriginId: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  syncStatus: TrainingCompletionSyncStatus
}

// ============================================================
// Conversion Functions
// ============================================================

/** Row shape shared by Supabase query results and Realtime payloads. */
export interface TrainingCompletionRow {
  [key: string]: unknown
  id: string
  user_id: string
  training_item_id: string
  completion_type: string
  result: string
  supervisor_id: string | null
  step_results: unknown
  supervisor_notes: string | null
  due_date: string | null
  calendar_origin_id: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

/** Map a snake_case Supabase/Realtime row to the camelCase UI type. */
export function mapRowToTrainingCompletionUI(row: TrainingCompletionRow): TrainingCompletionUI {
  return {
    id: row.id,
    userId: row.user_id,
    trainingItemId: row.training_item_id,
    completionType: row.completion_type as CompletionType,
    result: row.result as CompletionResult,
    supervisorId: row.supervisor_id,
    stepResults: row.step_results as StepResult[] | null,
    supervisorNotes: row.supervisor_notes,
    dueDate: row.due_date ?? null,
    calendarOriginId: row.calendar_origin_id ?? null,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  }
}

/** Convert a LocalTrainingCompletion (IndexedDB) to UI format. */
export function localToUI(local: LocalTrainingCompletion): TrainingCompletionUI {
  return {
    id: local.id,
    userId: local.user_id,
    trainingItemId: local.training_item_id,
    completionType: local.completion_type,
    result: local.result,
    supervisorId: local.supervisor_id,
    stepResults: local.step_results as StepResult[] | null,
    supervisorNotes: local.supervisor_notes,
    dueDate: local.due_date ?? null,
    calendarOriginId: local.calendar_origin_id ?? null,
    completedAt: local.completed_at,
    createdAt: local.created_at,
    updatedAt: local.updated_at,
    syncStatus: local._sync_status,
  }
}


/**
 * Build a fold-shaped TrainingCompletionUI for optimistic return from a write.
 * Under event-sourcing there is no server row — the id matches what the fold
 * produces (`fold:user:item:type`) so optimistic state lines up with the next
 * refold and the delete path can re-derive (user, item, type).
 */
function foldStub(
  userId: string,
  trainingItemId: string,
  type: CompletionType,
  result: CompletionResult,
  completedAt: string | null,
  opts: {
    supervisorId?: string | null
    stepResults?: StepResult[] | null
    supervisorNotes?: string | null
    dueDate?: string | null
    /** The emitted event's id. REQUIRED for a read: without it every rep stubs
     *  to the same id, and an optimistic re-read would key-collide with the row
     *  already on screen instead of landing beside it. */
    eventId?: string
  } = {},
): TrainingCompletionUI {
  const now = new Date().toISOString()
  return {
    id: foldRowId(userId, trainingItemId, type, type === 'read' ? opts.eventId : undefined),
    userId,
    trainingItemId,
    completionType: type,
    result,
    supervisorId: opts.supervisorId ?? null,
    stepResults: opts.stepResults ?? null,
    supervisorNotes: opts.supervisorNotes ?? null,
    dueDate: opts.dueDate ?? null,
    calendarOriginId: null,
    completedAt,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  }
}

// ============================================================
// CRUD Operations (event-sourced — emit to audit_log, no training_completions)
// ============================================================

/**
 * Local IDB training completions (legacy store). Retained only for the rare
 * code path that still reads it directly; the UI sources from the event fold.
 */
export async function getCompletions(userId: string): Promise<TrainingCompletionUI[]> {
  const locals = await getLocalTrainingCompletions(userId)
  return locals.map(localToUI)
}

/**
 * Enrich folded completions with their calendar link (origin id) from the link
 * projection, so the UI's calendar-cascade delete and "open linked event" still
 * work under event-sourcing (the fold itself carries no calendar origin).
 */
export async function enrichCalendarLinks(
  rows: TrainingCompletionUI[],
): Promise<TrainingCompletionUI[]> {
  return Promise.all(
    rows.map(async (r) => {
      const link = await getTrainingCalendarLink(r.userId, r.trainingItemId, r.completionType)
      return link ? { ...r, calendarOriginId: link.origin_id } : r
    }),
  )
}

/**
 * Emit a completion.voided event for a (user, item, type) that has no backing
 * training_completions row (event-sourced delete). Actor = the authed user.
 */
export async function voidTrainingCompletion(
  subjectUserId: string,
  trainingItemId: string,
  completionType: string,
  actorUserId: string,
  /** The one read to retire. Omitted for the replacing types, and omitted
   *  deliberately by the calendar cascade, where every read of the item goes.
   *  A void without it stays a whole-type void — which is also what every
   *  tombstone written before reads stacked has to keep meaning. */
  eventId?: string,
): Promise<ServiceResult<{ eventId: string }>> {
  return emitTrainingEvent(
    'completion.voided',
    subjectUserId,
    actorUserId,
    {
      training_item_id: trainingItemId,
      completion_type: completionType,
      ...(eventId ? { event_id: eventId } : {}),
    },
    new Date().toISOString(),
  )
}

/**
 * Create a read completion (medic self-reports completing a training task).
 * Writes to IndexedDB immediately and queues for sync.
 *
 * Every call is a NEW record, including a repeat of a task already read. That is
 * the point: a task carries a doctrine refresh interval, so the reps are a
 * series and the newest one is what currency is measured from. See trainingFold.
 */
export async function createReadCompletion(
  trainingItemId: string,
  userId: string
): Promise<ServiceResult<{ completion: TrainingCompletionUI }>> {
  const now = new Date().toISOString()
  const emitted = await emitTrainingEvent('read.recorded', userId, userId, {
    training_item_id: trainingItemId,
  }, now)
  if (!emitted.success) return emitted
  return succeed({
    completion: foldStub(userId, trainingItemId, 'read', 'GO', now, { eventId: emitted.eventId }),
  })
}

/**
 * Create a test completion (supervisor evaluates a medic).
 * The supervisor writes a completion record for the medic's user_id.
 */
export async function createTestCompletion(params: {
  medicUserId: string
  trainingItemId: string
  result: CompletionResult
  stepResults: StepResult[]
  supervisorNotes?: string
  supervisorId: string
}): Promise<ServiceResult<{ completion: TrainingCompletionUI }>> {
  const { medicUserId, trainingItemId, result, stepResults, supervisorNotes, supervisorId } = params
  const now = new Date().toISOString()

  const emitted = await emitTrainingEvent('test.graded', medicUserId, supervisorId, {
    training_item_id: trainingItemId,
    result,
    step_results: stepResults,
    supervisor_notes: supervisorNotes ?? null,
    supervisor_id: supervisorId,
  }, now)
  if (!emitted.success) return emitted

  return succeed({
    completion: foldStub(medicUserId, trainingItemId, 'test', result, now, {
      supervisorId,
      stepResults,
      supervisorNotes: supervisorNotes ?? null,
    }),
  })
}

/** Which raw event types feed a given completion type in the fold. */
function contributesTo(
  eventType: string,
  payloadCompletionType: string | undefined,
  completionType: string,
): boolean {
  switch (eventType) {
    case 'read.recorded': return completionType === 'read'
    case 'test.graded': return completionType === 'test'
    case 'assignment.created': return completionType === 'assignment'
    // An assignment that was worked off BECOMES a read or a test, so the event
    // that produced this completion may carry a different name than the type.
    case 'assignment.completed':
      return (payloadCompletionType === 'test' ? 'test' : 'read') === completionType
    default: return false
  }
}

/**
 * Hard-delete the raw events that produced one folded completion.
 *
 * Matching happens AFTER decrypt: training_item_id rides in the encrypted
 * payload, never the spine, so there is no server-side predicate for it — the
 * rows must be pulled, decrypted, and filtered here. Aliased the same way the
 * fold aliases, or a historical STP-numbered event would not match the ICTL
 * task the caller is deleting.
 *
 * Every event for that (subject, item, type) goes, not just the latest: a
 * re-grade appends rather than replaces, so leaving the earlier ones behind
 * would resurrect a superseded grade the moment the newest row is removed.
 */
async function purgeTrainingEventRows(
  subjectUserId: string,
  trainingItemId: string,
  completionType: string,
  actorUserId: string,
  /** Purge exactly this event and nothing else. Set when one read of a task is
   *  being deleted — the other reps are separate records and stay on the log. */
  eventId?: string,
): Promise<number> {
  const { clinicId, supervisingClinicId } = useAuthStore.getState()
  const activeClinicId = supervisingClinicId ?? clinicId
  const events = await loadAuditBySubject(subjectUserId, activeClinicId ?? '')
  let purged = 0
  for (const e of events) {
    if (e.domain !== 'training') continue
    if (eventId && e.id !== eventId) continue
    const raw = (e.payload?.training_item_id as string) || ''
    if (!raw) continue
    if (aliasTrainingItemId(raw, e.occurredAt) !== trainingItemId) continue
    if (!contributesTo(e.eventType, e.payload?.completion_type as string | undefined, completionType)) continue
    if (await deleteAuditEvent(e.id, actorUserId)) purged++
  }
  return purged
}

/**
 * Delete a training completion. Tombstone THEN purge, in that order:
 *
 *  - completion.voided is emitted first and is never deleted (the widened
 *    audit_log_delete allow-list deliberately omits it). It is the durable
 *    suppressor — any copy of a graded row that escapes the purge, on a peer
 *    device's cache or a queue that had not drained, stays retired forever.
 *  - the raw rows are then hard-deleted so they also stop appearing on the RAW
 *    surfaces, which read events rather than the fold and so never saw the void.
 *
 * The purge is best-effort by design: it can only reach rows this device can
 * pull, and a peer's local cache is not one of them. That is precisely what the
 * tombstone covers, which is why it is emitted first rather than instead.
 *
 * `completionId` is a fold id (`fold:user:item:type`); non-fold ids are a no-op.
 */
export async function deleteCompletion(
  completionId: string,
  userId: string,
): Promise<ServiceResult> {
  const parsed = parseFoldRowId(completionId)
  if (!parsed) return fail(`Unresolvable completion id ${completionId}`)
  // Nothing after this point is conditional on the void — drop the link and
  // purge only once the tombstone that justifies them exists.
  const voided = await voidTrainingCompletion(
    parsed.userId, parsed.trainingItemId, parsed.completionType, userId,
    parsed.eventId ?? undefined,
  )
  if (!voided.success) return voided
  // The calendar link is keyed (user, item, type) and cannot name one rep, so
  // deleting ONE read leaves it alone: the other reps of that task are still
  // live records, and dropping the link would cut the cascade that retires them
  // when the calendar event goes. A stranded link is a no-op — the cascade
  // voids a row that is not there — while a missing one loses real work.
  if (!parsed.eventId) {
    await deleteTrainingCalendarLink(parsed.userId, parsed.trainingItemId, parsed.completionType)
  }
  try {
    await purgeTrainingEventRows(
      parsed.userId, parsed.trainingItemId, parsed.completionType, userId,
      parsed.eventId ?? undefined,
    )
  } catch (err) {
    // The void already landed, so the completion is gone from every fold —
    // a failed purge leaves raw rows visible, not a resurrected completion.
    logger.warn('Training event purge failed (completion still voided):', err)
  }
  return succeed()
}

// Server reader functions (fetchCompletionsFromServer / fetchSupervisorTestHistory
// / fetchClinicTestHistory / fetchClinicAssignments) were removed with the
// training_completions table — all reads now come from the audit_log event fold.

// ============================================================
// Assignment Operations
// ============================================================

/**
 * Create a training assignment (supervisor assigns homework to a medic).
 * Uses completion_type='assignment' with a due_date and no result yet.
 */
export async function createAssignment(params: {
  medicUserId: string
  trainingItemId: string
  supervisorId: string
  dueDate: string
  supervisorNotes?: string
}): Promise<ServiceResult<{ completion: TrainingCompletionUI }>> {
  const { medicUserId, trainingItemId, supervisorId, dueDate, supervisorNotes } = params
  const now = new Date().toISOString()

  const emitted = await emitTrainingEvent('assignment.created', medicUserId, supervisorId, {
    training_item_id: trainingItemId,
    due_date: dueDate,
    supervisor_notes: supervisorNotes ?? null,
    supervisor_id: supervisorId,
  }, now)
  if (!emitted.success) return emitted

  return succeed({
    completion: foldStub(medicUserId, trainingItemId, 'assignment', 'GO', null, {
      supervisorId,
      supervisorNotes: supervisorNotes ?? null,
      dueDate,
    }),
  })
}

/**
 * Edit a pending assignment's due date or notes.
 *
 * There is no UPDATE path to take. audit_log's update policy is scoped to
 * pmcs.clear / fault.opened / fault.corrected, so a training row cannot be
 * rewritten server-side, and rewriting one would be the wrong shape anyway —
 * the log is the record, not a cache of it.
 *
 * What makes this an edit rather than a duplicate is the FOLD: it keys on
 * (subject, training_item, type) and takes the latest seq, so a second
 * assignment.created for the same pair REPLACES the row rather than adding one.
 * The supervisor sees one assignment with a new due date; the spine keeps both
 * events, which is the history the edit is accountable to.
 *
 * The calendar link is keyed on (user, item, 'assignment') too, so it survives
 * untouched — an edited assignment stays attached to the event it was born from.
 */
export async function updateAssignment(params: {
  medicUserId: string
  trainingItemId: string
  supervisorId: string
  dueDate: string
  supervisorNotes?: string | null
}): Promise<ServiceResult> {
  const { medicUserId, trainingItemId, supervisorId, dueDate, supervisorNotes } = params
  return emitTrainingEvent('assignment.created', medicUserId, supervisorId, {
    training_item_id: trainingItemId,
    due_date: dueDate,
    supervisor_notes: supervisorNotes ?? null,
    supervisor_id: supervisorId,
  }, new Date().toISOString())
}

/**
 * Complete a training assignment — mutates the record from 'assignment' to 'read' or 'test'.
 * Uses UPDATE by id (not upsert) because the completion_type changes.
 */
export async function completeAssignment(params: {
  completionId: string
  medicUserId: string
  completionType: 'read' | 'test'
  result: CompletionResult
  stepResults?: StepResult[]
  supervisorNotes?: string
  supervisorId: string
}): Promise<ServiceResult<{ completion: TrainingCompletionUI }>> {
  const { completionId, medicUserId, completionType, result, stepResults, supervisorNotes, supervisorId } = params
  const now = new Date().toISOString()

  // completionId is the assignment's fold id (`fold:user:item:assignment`).
  const parsed = parseFoldRowId(completionId)
  const trainingItemId = parsed?.trainingItemId
  if (!trainingItemId) {
    return fail(`Unresolvable completion id ${completionId}`)
  }

  const emitted = await emitTrainingEvent('assignment.completed', medicUserId, supervisorId, {
    training_item_id: trainingItemId,
    completion_type: completionType,
    result,
    step_results: stepResults ?? null,
    supervisor_notes: supervisorNotes ?? null,
    supervisor_id: supervisorId,
  }, now)
  // Bail BEFORE moving the calendar link. The link follows the assignment into
  // its read/test key, so rotating it against an event that was never recorded
  // would orphan the link on a completion the fold does not produce.
  if (!emitted.success) return emitted

  // The assignment row becomes a read/test under the fold — move any calendar
  // link from the assignment key to the new completion-type key.
  const existingLink = await getTrainingCalendarLink(medicUserId, trainingItemId, 'assignment')
  if (existingLink) {
    await setTrainingCalendarLink(medicUserId, trainingItemId, completionType, existingLink.origin_id)
    await deleteTrainingCalendarLink(medicUserId, trainingItemId, 'assignment')
  }

  return succeed({
    completion: foldStub(medicUserId, trainingItemId, completionType, result, now, {
      supervisorId,
      stepResults: stepResults ?? null,
      supervisorNotes: supervisorNotes ?? null,
      // A worked-off assignment BECOMES a read, and a read is keyed by the event
      // that made it — so the stub has to carry the same id the refold will
      // produce, or the optimistic row is replaced by a second one beside it.
      eventId: emitted.eventId,
    }),
  })
}

/**
 * Link an assignment (its logical completion) to the calendar event it was born
 * from. Called after the calendar event is created and we have the originId.
 * completionId is the assignment's fold id.
 */
export async function updateAssignmentCalendarOriginId(
  completionId: string,
  _userId: string,
  calendarOriginId: string
): Promise<void> {
  const parsed = parseFoldRowId(completionId)
  if (!parsed) return
  await setTrainingCalendarLink(parsed.userId, parsed.trainingItemId, parsed.completionType, calendarOriginId)
}

/**
 * Re-link when a calendar event's originId rotates (every edit mints a fresh
 * originId via the Signal fan-out ratchet). Now a pure projection update — the
 * link is mutable on purpose and is NOT an event (rotating it on every edit
 * would otherwise flood the append-only log).
 */
export async function relinkCompletionsByOriginId(
  oldOriginId: string,
  newOriginId: string,
  _userId: string
): Promise<void> {
  await relinkTrainingCalendarOrigin(oldOriginId, newOriginId)
}

/**
 * Cascade a calendar delete into training: void every completion linked to the
 * event's originId and drop the links. Used by the calendar delete gate.
 * Idempotent: no-op if no match.
 */
export async function deleteCompletionsByCalendarOriginId(
  calendarOriginId: string,
  userId: string
): Promise<void> {
  const links = await getTrainingCalendarLinksByOrigin(calendarOriginId)
  for (const l of links) {
    const voided = await voidTrainingCompletion(l.user_id, l.training_item_id, l.completion_type, userId)
    // Keep the link when the void is refused. Dropping it would strand a live
    // completion with no route back to the event, and the cascade could never
    // find it again to retry.
    if (!voided.success) {
      logger.warn(`Calendar cascade: void refused for ${l.training_item_id} (${voided.error})`)
      continue
    }
    await deleteTrainingCalendarLink(l.user_id, l.training_item_id, l.completion_type)
  }
}
