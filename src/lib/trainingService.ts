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

import { supabase } from './supabase'
import {
  getLocalTrainingCompletions,
  saveLocalTrainingCompletion,
  hardDeleteLocalTrainingCompletion,
  addToSyncQueue,
  updateTrainingCompletionSyncStatus,
  stripLocalFields,
  type LocalTrainingCompletion,
  type TrainingCompletionSyncStatus,
} from './offlineDb'
import type { CompletionType, CompletionResult, Json } from '../Types/database.types'
import type { StepResult } from '../Types/SupervisorTestTypes'
import { createLogger } from '../Utilities/Logger'
import { immediateSync } from './syncEngine'

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


// ============================================================
// CRUD Operations (Offline-First)
// ============================================================

/**
 * Get all training completions for a user from IndexedDB.
 */
export async function getCompletions(userId: string): Promise<TrainingCompletionUI[]> {
  const locals = await getLocalTrainingCompletions(userId)
  return locals.map(localToUI)
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
  const local: LocalTrainingCompletion = {
    id: crypto.randomUUID(),
    user_id: userId,
    training_item_id: trainingItemId,
    completed: true,
    completed_at: now,
    completion_type: 'read',
    result: 'GO',
    supervisor_id: null,
    step_results: null,
    supervisor_notes: null,
    due_date: null,
    calendar_origin_id: null,
    created_at: now,
    updated_at: now,
    _sync_status: userId === 'guest' ? 'synced' : 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }

  await saveLocalTrainingCompletion(local)

  if (userId !== 'guest') {
    const payload = stripLocalFields(local as unknown as Record<string, unknown>)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'training_completions',
      record_id: local.id,
      payload,
    })

    const synced = await immediateSync(
      { id: local.id, payload },
      {
        tableName: 'training_completions',
        upsertFn: async (rec) => {
          const { error } = await supabase
            .from('training_completions')
            .upsert(rec.payload as never, {
              onConflict: 'user_id,training_item_id,completion_type',
            })
          if (error) throw error
        },
        updateSyncStatus: updateTrainingCompletionSyncStatus,
      },
      'create'
    )
    if (synced) {
      local._sync_status = 'synced'
    }
  }

  return localToUI(local)
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

  const local: LocalTrainingCompletion = {
    id: crypto.randomUUID(),
    user_id: medicUserId,
    training_item_id: trainingItemId,
    completed: true,
    completed_at: now,
    completion_type: 'test',
    result,
    supervisor_id: supervisorId,
    step_results: stepResults as unknown as Json,
    supervisor_notes: supervisorNotes || null,
    due_date: null,
    calendar_origin_id: null,
    created_at: now,
    updated_at: now,
    _sync_status: 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }

  await saveLocalTrainingCompletion(local)

  const payload = stripLocalFields(local as unknown as Record<string, unknown>)

  // Queue for sync — user_id in queue = supervisor (the authenticated user),
  // payload.user_id = medic (the subject of the evaluation)
  await addToSyncQueue({
    user_id: supervisorId,
    action: 'create',
    table_name: 'training_completions',
    record_id: local.id,
    payload,
  })

  const synced = await immediateSync(
    { id: local.id, payload },
    {
      tableName: 'training_completions',
      upsertFn: async (rec) => {
        const { error } = await supabase
          .from('training_completions')
          .upsert(rec.payload as never, {
            onConflict: 'user_id,training_item_id,completion_type',
          })
        if (error) throw error
      },
      updateSyncStatus: updateTrainingCompletionSyncStatus,
    },
    'create'
  )
  if (synced) {
    local._sync_status = 'synced'
  }

  return localToUI(local)
}

/**
 * Delete a training completion. Hard-deletes from IndexedDB and queues sync.
 */
export async function deleteCompletion(completionId: string, userId: string): Promise<void> {
  const deletedAt = new Date().toISOString()
  await hardDeleteLocalTrainingCompletion(completionId)

  if (userId !== 'guest') {
    await addToSyncQueue({
      user_id: userId,
      action: 'delete',
      table_name: 'training_completions',
      record_id: completionId,
      payload: { _deleted_at_timestamp: deletedAt },
    })

    await immediateSync(
      { id: completionId },
      {
        tableName: 'training_completions',
        upsertFn: async () => {
          const { error } = await supabase
            .from('training_completions')
            .delete()
            .eq('id', completionId)
          if (error) throw error
        },
        updateSyncStatus: updateTrainingCompletionSyncStatus,
      },
      'delete'
    )
  }
}

/**
 * Fetch all completions for a user directly from Supabase.
 * Used for initial reconciliation.
 */
export async function fetchCompletionsFromServer(userId: string): Promise<LocalTrainingCompletion[]> {
  const { data, error } = await supabase
    .from('training_completions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch training completions from server: ${error.message}`)
  }

  return (data || []).map((row): LocalTrainingCompletion => ({
    ...row,
    due_date: row.due_date ?? null,
    calendar_origin_id: row.calendar_origin_id ?? null,
    _sync_status: 'synced' as const,
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }))
}

/**
 * Fetch test completion history for a supervisor (all tests they've administered).
 */
export async function fetchSupervisorTestHistory(supervisorId: string): Promise<TrainingCompletionUI[]> {
  const { data, error } = await supabase
    .from('training_completions')
    .select('*')
    .eq('supervisor_id', supervisorId)
    .eq('completion_type', 'test')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch supervisor test history: ${error.message}`)
  }

  return (data || []).map(mapRowToTrainingCompletionUI)
}

/**
 * Fetch all graded test events for a set of clinic users, excluding a specific user.
 * Used by the supervisor History tab to show clinic-wide test history.
 */
export async function fetchClinicTestHistory(
  clinicUserIds: string[],
  excludeUserId: string
): Promise<TrainingCompletionUI[]> {
  const targetIds = clinicUserIds.filter(id => id !== excludeUserId)
  if (targetIds.length === 0) return []

  const { data, error } = await supabase
    .from('training_completions')
    .select('*')
    .in('user_id', targetIds)
    .eq('completion_type', 'test')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch clinic test history: ${error.message}`)
  }

  return (data || []).map(mapRowToTrainingCompletionUI)
}

/**
 * Fetch all pending assignments for a set of clinic users.
 * Used by the supervisor Soldier Profile to show assigned tasks.
 */
export async function fetchClinicAssignments(
  clinicUserIds: string[]
): Promise<TrainingCompletionUI[]> {
  if (clinicUserIds.length === 0) return []

  const { data, error } = await supabase
    .from('training_completions')
    .select('*')
    .in('user_id', clinicUserIds)
    .eq('completion_type', 'assignment')
    .order('due_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch clinic assignments: ${error.message}`)
  }

  return (data || []).map(mapRowToTrainingCompletionUI)
}

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

  const local: LocalTrainingCompletion = {
    id: crypto.randomUUID(),
    user_id: medicUserId,
    training_item_id: trainingItemId,
    completed: false,
    completed_at: null,
    completion_type: 'assignment',
    result: 'GO',
    supervisor_id: supervisorId,
    step_results: null,
    supervisor_notes: supervisorNotes || null,
    due_date: dueDate,
    calendar_origin_id: null,
    created_at: now,
    updated_at: now,
    _sync_status: 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }

  await saveLocalTrainingCompletion(local)

  const payload = stripLocalFields(local as unknown as Record<string, unknown>)

  await addToSyncQueue({
    user_id: supervisorId,
    action: 'create',
    table_name: 'training_completions',
    record_id: local.id,
    payload,
  })

  const synced = await immediateSync(
    { id: local.id, payload },
    {
      tableName: 'training_completions',
      upsertFn: async (rec) => {
        const { error } = await supabase
          .from('training_completions')
          .upsert(rec.payload as never, {
            onConflict: 'user_id,training_item_id,completion_type',
          })
        if (error) throw error
      },
      updateSyncStatus: updateTrainingCompletionSyncStatus,
    },
    'create'
  )
  if (synced) {
    local._sync_status = 'synced'
  }

  return localToUI(local)
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

  const locals = await getLocalTrainingCompletions(medicUserId)
  const existing = locals.find(l => l.id === completionId)
  if (!existing) {
    throw new Error(`Assignment ${completionId} not found in local store`)
  }

  const updated: LocalTrainingCompletion = {
    ...existing,
    completion_type: completionType,
    result,
    completed: true,
    completed_at: now,
    step_results: (stepResults as unknown as Json) ?? null,
    supervisor_notes: supervisorNotes ?? existing.supervisor_notes,
    supervisor_id: supervisorId,
    updated_at: now,
    _sync_status: 'pending',
  }

  await saveLocalTrainingCompletion(updated)

  const payload = stripLocalFields(updated as unknown as Record<string, unknown>)

  await addToSyncQueue({
    user_id: supervisorId,
    action: 'update',
    table_name: 'training_completions',
    record_id: completionId,
    payload,
  })

  const synced = await immediateSync(
    { id: completionId, payload },
    {
      tableName: 'training_completions',
      upsertFn: async (rec) => {
        const { error } = await supabase
          .from('training_completions')
          .update(rec.payload as never)
          .eq('id', completionId)
        if (error) throw error
      },
      updateSyncStatus: updateTrainingCompletionSyncStatus,
    },
    'update'
  )
  if (synced) {
    updated._sync_status = 'synced'
  }

  return localToUI(updated)
}

/**
 * Update the calendar_origin_id on an assignment record.
 * Called after the calendar event is created and we have the originId.
 */
export async function updateAssignmentCalendarOriginId(
  completionId: string,
  userId: string,
  calendarOriginId: string
): Promise<void> {
  const locals = await getLocalTrainingCompletions(userId)
  const existing = locals.find(l => l.id === completionId)
  if (!existing) return

  const updated: LocalTrainingCompletion = {
    ...existing,
    calendar_origin_id: calendarOriginId,
    updated_at: new Date().toISOString(),
  }

  await saveLocalTrainingCompletion(updated)
}
