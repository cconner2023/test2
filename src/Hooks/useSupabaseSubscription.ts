/**
 * useSupabaseSubscription -- shared Supabase Realtime subscription lifecycle.
 *
 * Encapsulates the boilerplate that every Realtime hook needs:
 *   - RealtimeChannel ref management
 *   - Automatic cleanup on unmount
 *   - Pause when `shouldSubscribe` becomes false (page hidden, logged out, etc.)
 *   - Status logging via a caller-provided Logger
 *
 * The caller is responsible for:
 *   - Computing `shouldSubscribe` from their own preconditions
 *   - Providing the channel name, table filter, and payload handler
 *   - Wrapping mutable callbacks in refs before passing `onPayload`
 */

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js'
import type { Logger } from '../Utilities/Logger'

interface PostgresChangesFilter {
  schema?: string
  table: string
  filter?: string
}

interface UseSupabaseSubscriptionOptions<TRow extends Record<string, unknown>> {
  /** When false the channel is torn down; when true it is (re-)created. */
  shouldSubscribe: boolean
  /** Unique channel name passed to `supabase.channel()`. */
  channelName: string
  /** Postgres changes filter (table, optional schema & row-level filter). */
  postgresFilter: PostgresChangesFilter
  /** Called for every INSERT / UPDATE / DELETE event on the channel. */
  onPayload: (payload: RealtimePostgresChangesPayload<TRow>) => void
  /** Logger instance for status messages. */
  logger: Logger
}

export function useSupabaseSubscription<TRow extends Record<string, unknown>>({
  shouldSubscribe,
  channelName,
  postgresFilter,
  onPayload,
  logger,
}: UseSupabaseSubscriptionOptions<TRow>): void {
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Keep the payload handler in a ref so the subscription never goes stale
  // while also not causing re-subscriptions when the callback identity changes.
  const onPayloadRef = useRef(onPayload)
  useEffect(() => {
    onPayloadRef.current = onPayload
  }, [onPayload])

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      logger.debug('Unsubscribing from channel')
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [logger])

  useEffect(() => {
    if (!shouldSubscribe) {
      cleanup()
      return
    }

    // Clean up any previous subscription before creating a new one
    cleanup()

    logger.info(`Subscribing to ${channelName}`)

    const channel = supabase
      .channel(channelName)
      .on<TRow>(
        'postgres_changes',
        {
          event: '*',
          schema: postgresFilter.schema ?? 'public',
          table: postgresFilter.table,
          ...(postgresFilter.filter ? { filter: postgresFilter.filter } : {}),
        },
        (payload) => onPayloadRef.current(payload),
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Subscribed to ${channelName}`)
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Channel error:', err?.message ?? 'unknown')
        } else if (status === 'TIMED_OUT') {
          logger.warn('Subscription timed out, will retry')
        } else {
          logger.debug(`Channel status: ${status}`)
        }
      })

    channelRef.current = channel

    return cleanup
    // channelName and postgresFilter are expected to change when the
    // caller's identity values (userId, clinicId, etc.) change, which
    // should trigger a re-subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldSubscribe, channelName, postgresFilter.table, postgresFilter.filter, cleanup])
}
