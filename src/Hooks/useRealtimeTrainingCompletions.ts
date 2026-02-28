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
import { mapRowToTrainingCompletionUI, type TrainingCompletionUI, type TrainingCompletionRow } from '../lib/trainingService'
import { createLogger } from '../Utilities/Logger'
import { useSupabaseSubscription } from './useSupabaseSubscription'

const logger = createLogger('RealtimeTraining')

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
    (payload: RealtimePostgresChangesPayload<TrainingCompletionRow>) => {
      const eventType = payload.eventType

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const row = payload.new
        logger.debug(`${eventType}: ${row.id}`)
        onUpsertRef.current(mapRowToTrainingCompletionUI(row))
        return
      }

      if (eventType === 'DELETE') {
        const oldRow = payload.old as Partial<TrainingCompletionRow>
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

  useSupabaseSubscription<TrainingCompletionRow>({
    shouldSubscribe: isAuthenticated && !!userId && isPageVisible,
    channelName: `personal-training:${userId}`,
    postgresFilter,
    onPayload: handlePayload,
    logger,
  })
}
