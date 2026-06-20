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
import { emitAudit } from './auditService'
import { useAuthStore } from '../stores/useAuthStore'
import { parseFoldRowId, foldRowId } from './trainingFold'
import type { AuditEventType } from './auditTypes'

/**
 * Shadow-emit a training lifecycle event into the unified audit_log.
 *
 * Additive during the event-sourcing transition: training_completions stays
 * authoritative until the server gate flips the read path to the event fold
 * (see v2/training event-sourcing). subject = the soldier; clinic = the authed
 * user's clinic (own clinic for self-report, the soldier's cluster for
 * supervisor actions — they are the same cluster). actor = the authed user
 * (= the sync-queue owner, matching the training_completions write). Best-effort
 * — emitAudit never throws, so it can't break a completion write.
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
): Promise<void> {
  const clinicId = useAuthStore.getState().clinicId
  if (!clinicId || actorUserId === 'guest') return
  await emitAudit(
    {
      clinicId,
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
  } = {},
): TrainingCompletionUI {
  const now = new Date().toISOString()
  return {
    id: foldRowId(userId, trainingItemId, type),
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
): Promise<void> {
  await emitTrainingEvent(
    'completion.voided',
    subjectUserId,
    actorUserId,
    { training_item_id: trainingItemId, completion_type: completionType },
    new Date().toISOString(),
  )
}

/**
 * Create a read completion (medic self-reports completing a training task).
 * Writes to IndexedDB immediately and queues for sync.
 */
export async function createReadCompletion(
  trainingItemId: string,
  userId: string
): Promise<TrainingCompletionUI> {
  const now = new Date().toISOString()
  await emitTrainingEvent('read.recorded', userId, userId, {
    training_item_id: trainingItemId,
  }, now)
  return foldStub(userId, trainingItemId, 'read', 'GO', now)
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
}): Promise<TrainingCompletionUI> {
  const { medicUserId, trainingItemId, result, stepResults, supervisorNotes, supervisorId } = params
  const now = new Date().toISOString()

  await emitTrainingEvent('test.graded', medicUserId, supervisorId, {
    training_item_id: trainingItemId,
    result,
    step_results: stepResults,
    supervisor_notes: supervisorNotes ?? null,
    supervisor_id: supervisorId,
  }, now)

  return foldStub(medicUserId, trainingItemId, 'test', result, now, {
    supervisorId,
    stepResults,
    supervisorNotes: supervisorNotes ?? null,
  })
}

/**
 * Delete a training completion (event-sourced): emit a completion.voided event
 * and drop any calendar link. `completionId` is a fold id (`fold:user:item:type`)
 * — there is no server row to hard-delete. Non-fold ids are a no-op.
 */
export async function deleteCompletion(completionId: string, userId: string): Promise<void> {
  const parsed = parseFoldRowId(completionId)
  if (!parsed) return
  await voidTrainingCompletion(parsed.userId, parsed.trainingItemId, parsed.completionType, userId)
  await deleteTrainingCalendarLink(parsed.userId, parsed.trainingItemId, parsed.completionType)
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
}): Promise<TrainingCompletionUI> {
  const { medicUserId, trainingItemId, supervisorId, dueDate, supervisorNotes } = params
  const now = new Date().toISOString()

  await emitTrainingEvent('assignment.created', medicUserId, supervisorId, {
    training_item_id: trainingItemId,
    due_date: dueDate,
    supervisor_notes: supervisorNotes ?? null,
    supervisor_id: supervisorId,
  }, now)

  return foldStub(medicUserId, trainingItemId, 'assignment', 'GO', null, {
    supervisorId,
    supervisorNotes: supervisorNotes ?? null,
    dueDate,
  })
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
}): Promise<TrainingCompletionUI> {
  const { completionId, medicUserId, completionType, result, stepResults, supervisorNotes, supervisorId } = params
  const now = new Date().toISOString()

  // completionId is the assignment's fold id (`fold:user:item:assignment`).
  const parsed = parseFoldRowId(completionId)
  const trainingItemId = parsed?.trainingItemId
  if (!trainingItemId) {
    throw new Error(`completeAssignment: unresolvable completion id ${completionId}`)
  }

  await emitTrainingEvent('assignment.completed', medicUserId, supervisorId, {
    training_item_id: trainingItemId,
    completion_type: completionType,
    result,
    step_results: stepResults ?? null,
    supervisor_notes: supervisorNotes ?? null,
    supervisor_id: supervisorId,
  }, now)

  // The assignment row becomes a read/test under the fold — move any calendar
  // link from the assignment key to the new completion-type key.
  const existingLink = await getTrainingCalendarLink(medicUserId, trainingItemId, 'assignment')
  if (existingLink) {
    await setTrainingCalendarLink(medicUserId, trainingItemId, completionType, existingLink.origin_id)
    await deleteTrainingCalendarLink(medicUserId, trainingItemId, 'assignment')
  }

  return foldStub(medicUserId, trainingItemId, completionType, result, now, {
    supervisorId,
    stepResults: stepResults ?? null,
    supervisorNotes: supervisorNotes ?? null,
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
    await voidTrainingCompletion(l.user_id, l.training_item_id, l.completion_type, userId)
    await deleteTrainingCalendarLink(l.user_id, l.training_item_id, l.completion_type)
  }
}
