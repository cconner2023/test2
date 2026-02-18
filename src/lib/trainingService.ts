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
  type LocalTrainingCompletion,
  type TrainingCompletionSyncStatus,
} from './offlineDb'
import { isOnline } from './syncService'
import type { CompletionType, CompletionResult, Json } from '../Types/database.types'
import type { StepResult } from '../Types/SupervisorTestTypes'

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
  completedAt: string | null
  createdAt: string
  updatedAt: string
  syncStatus: TrainingCompletionSyncStatus
}

// ============================================================
// Conversion Functions
// ============================================================

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
    completedAt: local.completed_at,
    createdAt: local.created_at,
    updatedAt: local.updated_at,
    syncStatus: local._sync_status,
  }
}

/** Strip local-only fields (prefixed with _) for Supabase payload. */
function localToSupabasePayload(local: LocalTrainingCompletion): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(local)) {
    if (!key.startsWith('_')) {
      payload[key] = value
    }
  }
  return payload
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
    created_at: now,
    updated_at: now,
    _sync_status: userId === 'guest' ? 'synced' : 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }

  await saveLocalTrainingCompletion(local)

  if (userId !== 'guest') {
    const payload = localToSupabasePayload(local)

    await addToSyncQueue({
      user_id: userId,
      action: 'create',
      table_name: 'training_completions',
      record_id: local.id,
      payload,
    })

    // Attempt immediate sync if online
    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('training_completions')
          .upsert(payload as never, {
            onConflict: 'user_id,training_item_id,completion_type',
          })

        if (!error) {
          await updateTrainingCompletionSyncStatus(local.id, 'synced')
          local._sync_status = 'synced'
        } else {
          console.warn(`[TrainingService] Immediate sync failed, queued: ${error.message}`)
        }
      } catch (err) {
        console.warn('[TrainingService] Immediate sync failed, queued:', err)
      }
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
    created_at: now,
    updated_at: now,
    _sync_status: 'pending',
    _sync_retry_count: 0,
    _last_sync_error: null,
    _last_sync_error_message: null,
  }

  await saveLocalTrainingCompletion(local)

  const payload = localToSupabasePayload(local)

  // Queue for sync — user_id in queue = supervisor (the authenticated user),
  // payload.user_id = medic (the subject of the evaluation)
  await addToSyncQueue({
    user_id: supervisorId,
    action: 'create',
    table_name: 'training_completions',
    record_id: local.id,
    payload,
  })

  // Attempt immediate sync
  if (isOnline()) {
    try {
      const { error } = await supabase
        .from('training_completions')
        .upsert(payload as never, {
          onConflict: 'user_id,training_item_id,completion_type',
        })

      if (!error) {
        await updateTrainingCompletionSyncStatus(local.id, 'synced')
        local._sync_status = 'synced'
      } else {
        console.warn(`[TrainingService] Immediate test sync failed, queued: ${error.message}`)
      }
    } catch (err) {
      console.warn('[TrainingService] Immediate test sync failed, queued:', err)
    }
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

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('training_completions')
          .delete()
          .eq('id', completionId)

        if (error) {
          console.warn(`[TrainingService] Immediate delete failed, queued: ${error.message}`)
        }
      } catch {
        // Will be retried by sync queue
      }
    }
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

  return (data || []).map((row): TrainingCompletionUI => ({
    id: row.id,
    userId: row.user_id,
    trainingItemId: row.training_item_id,
    completionType: row.completion_type as CompletionType,
    result: row.result as CompletionResult,
    supervisorId: row.supervisor_id,
    stepResults: row.step_results as StepResult[] | null,
    supervisorNotes: row.supervisor_notes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  }))
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

  return (data || []).map((row): TrainingCompletionUI => ({
    id: row.id,
    userId: row.user_id,
    trainingItemId: row.training_item_id,
    completionType: row.completion_type as CompletionType,
    result: row.result as CompletionResult,
    supervisorId: row.supervisor_id,
    stepResults: row.step_results as StepResult[] | null,
    supervisorNotes: row.supervisor_notes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  }))
}
