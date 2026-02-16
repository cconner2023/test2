/**
 * useRealtimeTrainingCompletions -- Supabase Realtime subscription for the
 * current user's training completions across devices.
 *
 * Subscribes to INSERT, UPDATE, and DELETE events on the `training_completions`
 * table filtered by `user_id`. When the same user completes, updates, or
 * removes a training completion on another device, the change is reflected
 * locally without requiring a manual refresh or page reload.
 *
 * Follows the same pattern as useRealtimePersonalNotes: handlers are
 * idempotent -- on the originating device the optimistic state already
 * matches, so the upsert is a no-op (or harmless overwrite with the same
 * data).
 *
 * Requires the `training_completions` table to be in the Supabase Realtime
 * publication.
 */

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { TrainingCompletionUI } from '../lib/trainingService'
import type { CompletionType, CompletionResult } from '../Types/database.types'
import type { StepResult } from '../Types/SupervisorTestTypes'

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
  onUpsert: (completion: TrainingCompletionUI) => void
  onDelete: (completionId: string) => void
}

export function useRealtimeTrainingCompletions({
  userId,
  isAuthenticated,
  onUpsert,
  onDelete,
}: UseRealtimeTrainingCompletionsOptions): void {
  const channelRef = useRef<RealtimeChannel | null>(null)

  const onUpsertRef = useRef(onUpsert)
  const onDeleteRef = useRef(onDelete)
  useEffect(() => {
    onUpsertRef.current = onUpsert
    onDeleteRef.current = onDelete
  }, [onUpsert, onDelete])

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('[RealtimeTrainingCompletions] Unsubscribing from channel')
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      cleanup()
      return
    }

    cleanup()

    console.log(`[RealtimeTrainingCompletions] Subscribing to training_completions for user ${userId}`)

    const handlePayload = (payload: RealtimePostgresChangesPayload<RealtimeTrainingCompletionRow>) => {
      const eventType = payload.eventType

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const row = payload.new
        console.log(`[RealtimeTrainingCompletions] ${eventType}: ${row.id}`)
        onUpsertRef.current(realtimeRowToTrainingCompletionUI(row))
        return
      }

      if (eventType === 'DELETE') {
        const oldRow = payload.old as Partial<RealtimeTrainingCompletionRow>
        const completionId = oldRow.id
        if (!completionId) {
          console.warn('[RealtimeTrainingCompletions] DELETE event missing row id, ignoring')
          return
        }
        console.log(`[RealtimeTrainingCompletions] DELETE: ${completionId}`)
        onDeleteRef.current(completionId)
      }
    }

    const channel = supabase
      .channel(`personal-training:${userId}`)
      .on<RealtimeTrainingCompletionRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_completions',
          filter: `user_id=eq.${userId}`,
        },
        handlePayload,
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[RealtimeTrainingCompletions] Subscribed for user ${userId}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeTrainingCompletions] Channel error:', err?.message ?? 'unknown')
        } else if (status === 'TIMED_OUT') {
          console.warn('[RealtimeTrainingCompletions] Subscription timed out, will retry')
        } else {
          console.log(`[RealtimeTrainingCompletions] Channel status: ${status}`)
        }
      })

    channelRef.current = channel

    return cleanup
  }, [isAuthenticated, userId, cleanup])
}
