/**
 * useRealtimeTrainingCompletions -- Supabase Realtime subscription for the
 * current user's training completions across devices.
 *
 * Subscribes to INSERT, UPDATE, and DELETE events on the `training_completions`
 * table filtered by `user_id`. When the same user completes, updates, or
 * removes a training completion on another device, the change is reflected
 * locally without requiring a manual refresh or page reload.
 *
 * Handlers are idempotent -- on the originating device the optimistic
 * state already matches, so the upsert is a no-op (or harmless overwrite
 * with the same data).
 *
 * The channel automatically pauses when the page is hidden (backgrounded)
 * and resumes when visible again, reducing battery drain.
 *
 * Requires the `training_completions` table to be in the Supabase Realtime
 * publication.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { TrainingCompletionUI } from '../lib/trainingService'
import type { CompletionType, CompletionResult } from '../Types/database.types'
import type { StepResult } from '../Types/SupervisorTestTypes'
import { createLogger } from '../Utilities/Logger'
import { useSupabaseSubscription } from './useSupabaseSubscription'

const logger = createLogger('RealtimeTraining')

interface RealtimeTrainingCompletionRow {
  id: string
  user_id: string
  training_item_id: string
  completed: boolean
  completed_at: string | null
  completion_type: string
  result: string
  supervisor_id: string | null
  step_results: unknown
  supervisor_notes: string | null
  created_at: string
  updated_at: string
}

function realtimeRowToTrainingCompletionUI(row: RealtimeTrainingCompletionRow): TrainingCompletionUI {
  return {
    id: row.id,
    userId: row.user_id,
    trainingItemId: row.training_item_id,
    completionType: row.completion_type as CompletionType,
    result: row.result as CompletionResult,
    supervisorId: row.supervisor_id,
    stepResults: (row.step_results as StepResult[] | null) ?? null,
    supervisorNotes: row.supervisor_notes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  }
}

interface UseRealtimeTrainingCompletionsOptions {
  userId: string | null
  isAuthenticated: boolean
  isPageVisible: boolean
  onUpsert: (completion: TrainingCompletionUI) => void
  onDelete: (completionId: string) => void
}

export function useRealtimeTrainingCompletions({
  userId,
  isAuthenticated,
  isPageVisible,
  onUpsert,
  onDelete,
}: UseRealtimeTrainingCompletionsOptions): void {
  const onUpsertRef = useRef(onUpsert)
  const onDeleteRef = useRef(onDelete)
  useEffect(() => {
    onUpsertRef.current = onUpsert
    onDeleteRef.current = onDelete
  }, [onUpsert, onDelete])

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<RealtimeTrainingCompletionRow>) => {
      const eventType = payload.eventType

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const row = payload.new
        logger.debug(`${eventType}: ${row.id}`)
        onUpsertRef.current(realtimeRowToTrainingCompletionUI(row))
        return
      }

      if (eventType === 'DELETE') {
        const oldRow = payload.old as Partial<RealtimeTrainingCompletionRow>
        const completionId = oldRow.id
        if (!completionId) {
          logger.warn('DELETE event missing row id, ignoring')
          return
        }
        logger.debug(`DELETE: ${completionId}`)
        onDeleteRef.current(completionId)
      }
    },
    [],
  )

  const postgresFilter = useMemo(
    () => ({
      table: 'training_completions',
      filter: `user_id=eq.${userId}`,
    }),
    [userId],
  )

  useSupabaseSubscription<RealtimeTrainingCompletionRow>({
    shouldSubscribe: isAuthenticated && !!userId && isPageVisible,
    channelName: `personal-training:${userId}`,
    postgresFilter,
    onPayload: handlePayload,
    logger,
  })
}
