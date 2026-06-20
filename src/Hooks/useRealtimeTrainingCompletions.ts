/**
 * useRealtimeTrainingCompletions -- Supabase Realtime subscription for the
 * current user's training events on the unified `audit_log` table.
 *
 * Under event-sourcing, training state is a fold over audit_log domain=training
 * events. This subscribes to INSERTs on audit_log filtered by `subject_id` (the
 * soldier). audit_log is append-only, so there are no UPDATE/DELETE events — a
 * "delete" is itself a completion.voided INSERT. Any insert for this subject may
 * change the fold, so the handler just signals a re-fold (`onChange`); the hook
 * owner re-reads + re-folds rather than mutating in place (fold ids are synthetic).
 *
 * The channel pauses when the page is hidden and resumes when visible.
 * Requires `audit_log` to be in the Supabase Realtime publication.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createLogger } from '../Utilities/Logger'
import { useSupabaseSubscription } from './useSupabaseSubscription'

const logger = createLogger('RealtimeTraining')

interface AuditLogRealtimeRow {
  id: string
  subject_id: string
  domain: string
  [key: string]: unknown
}

interface UseRealtimeTrainingCompletionsOptions {
  userId: string | null
  isAuthenticated: boolean
  isPageVisible: boolean
  /** Fired when a training audit event arrives for this subject — re-fold. */
  onChange: () => void
}

export function useRealtimeTrainingCompletions({
  userId,
  isAuthenticated,
  isPageVisible,
  onChange,
}: UseRealtimeTrainingCompletionsOptions): void {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<AuditLogRealtimeRow>) => {
      if (payload.eventType !== 'INSERT') return
      const row = payload.new
      if (row.domain !== 'training') return
      logger.debug(`audit insert for ${row.subject_id} (${row.id})`)
      onChangeRef.current()
    },
    [],
  )

  const postgresFilter = useMemo(
    () => ({
      table: 'audit_log',
      filter: `subject_id=eq.${userId}`,
    }),
    [userId],
  )

  useSupabaseSubscription<AuditLogRealtimeRow>({
    shouldSubscribe: isAuthenticated && !!userId && isPageVisible,
    channelName: `personal-audit:${userId}`,
    postgresFilter,
    onPayload: handlePayload,
    logger,
  })
}
