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

import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js'
import type { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js'
import type { Logger } from '../Utilities/Logger'

interface PostgresChangesFilter {
  schema?: string
  table: string
  filter?: string
  /**
   * Which row events to subscribe to. Defaults to '*'. Narrow to 'INSERT'
   * when the handler only acts on inserts — '*' makes Postgres re-broadcast
   * the FULL new row over realtime on every UPDATE/DELETE (egress the client
   * then discards). Append-only consumers should always pin 'INSERT'.
   */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
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
  /**
   * Every channel status change, including the SUBSCRIBED that follows an
   * automatic rejoin. Realtime does not replay rows inserted while the channel
   * was down — callers that must not miss rows re-fetch on rejoin.
   */
  onStatus?: (status: `${REALTIME_SUBSCRIBE_STATES}`) => void
}

/** Delays before rebuilding a server-closed channel; reset once it joins. */
const REOPEN_BACKOFF_MS = [3_000, 10_000, 30_000, 60_000]

export function useSupabaseSubscription<TRow extends Record<string, unknown>>({
  shouldSubscribe,
  channelName,
  postgresFilter,
  onPayload,
  logger,
  onStatus,
}: UseSupabaseSubscriptionOptions<TRow>): void {
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Bumped to rebuild a channel the server closed. supabase-js rejoins after
  // CHANNEL_ERROR/TIMED_OUT on its own, but a server-side close is final.
  const [reopen, setReopen] = useState(0)
  const reopenAttempt = useRef(0)
  // Per-subscribe topic suffix. removeChannel is async — the old channel stays
  // registered until the leave reply — so re-subscribing under the same name
  // (a quick hidden→visible flip) would get the leaving channel back from
  // supabase.channel() and never receive SUBSCRIBED.
  const topicSeq = useRef(0)

  // Keep the payload handler in a ref so the subscription never goes stale
  // while also not causing re-subscriptions when the callback identity changes.
  const onPayloadRef = useRef(onPayload)
  useEffect(() => {
    onPayloadRef.current = onPayload
  }, [onPayload])

  const onStatusRef = useRef(onStatus)
  useEffect(() => {
    onStatusRef.current = onStatus
  }, [onStatus])

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
    let disposed = false
    let reopenTimer: ReturnType<typeof setTimeout> | null = null
    topicSeq.current += 1

    const channel = supabase
      .channel(`${channelName}:${topicSeq.current}`)
      .on<TRow>(
        'postgres_changes',
        {
          event: postgresFilter.event ?? '*',
          schema: postgresFilter.schema ?? 'public',
          table: postgresFilter.table,
          ...(postgresFilter.filter ? { filter: postgresFilter.filter } : {}),
        },
        (payload) => onPayloadRef.current(payload),
      )
      .subscribe((status, err) => {
        onStatusRef.current?.(status)
        if (status === 'SUBSCRIBED') reopenAttempt.current = 0
        if (status === 'CLOSED' && !disposed && !reopenTimer) {
          const delay = REOPEN_BACKOFF_MS[Math.min(reopenAttempt.current, REOPEN_BACKOFF_MS.length - 1)]
          reopenAttempt.current += 1
          logger.warn(`${channelName} closed by server, reopening in ${delay}ms`)
          reopenTimer = setTimeout(() => { if (!disposed) setReopen(n => n + 1) }, delay)
        }
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

    return () => {
      disposed = true
      if (reopenTimer) clearTimeout(reopenTimer)
      cleanup()
    }
    // channelName and postgresFilter are expected to change when the
    // caller's identity values (userId, clinicId, etc.) change, which
    // should trigger a re-subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldSubscribe, channelName, postgresFilter.table, postgresFilter.filter, postgresFilter.event, cleanup, reopen])
}
