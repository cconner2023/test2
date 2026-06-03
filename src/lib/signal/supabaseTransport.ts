/**
 * Supabase implementation of SignalTransport.
 *
 * Extracts the messaging CRUD operations from signalService.ts into a class
 * implementing the SignalTransport interface. Same Supabase calls, just
 * organized behind the transport adapter.
 */

import { supabase } from '../supabase'
import { ok, err, getErrorMessage, type Result } from '../result'
import { fireNotification } from '../notifyDispatcher'
import { createLogger } from '../../Utilities/Logger'
import type { Json } from '../../Types/database.types.generated'
import type { SignalTransport, SendMessageParams, SendBatchParams } from './transport'
import type { SignalMessageRow } from './transportTypes'

const logger = createLogger('SupabaseTransport')

/**
 * Unread catch-up horizon. Rows older than this are NOT re-fetched — they are
 * permanently undecryptable past the pre-key / SPK rotation window, yet
 * fetchUnread re-pulls full payloads on every foreground (egress leak). This
 * is a FETCH floor only: read_at is never written, so decrypt-retry semantics
 * are unchanged (legit transient failures resolve within a session or two,
 * far inside this window — see the 2026-04-26 request-accepted disappearance
 * bug, which forbids markRead-on-decrypt-failure). Content beyond this window
 * recovers via backup/vault, not the unread queue.
 */
const UNREAD_FETCH_HORIZON_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export class SupabaseTransport implements SignalTransport {
  name = 'supabase'

  /**
   * Run a Supabase query with standardised error handling.
   * Wraps try-catch + error check + logging.
   */
  private async runQuery<T>(
    query: () => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
    label: string,
    fallback?: T,
  ): Promise<Result<T>> {
    try {
      const { data, error } = await query()
      if (error) {
        logger.error(`${label} error:`, error.message)
        return err(error.message, error.code)
      }
      return ok((data ?? fallback) as T)
    } catch (e) {
      const msg = getErrorMessage(e)
      logger.error(`${label} exception:`, msg)
      return err(msg)
    }
  }

  async sendMessage(params: SendMessageParams): Promise<Result<string>> {
    const result = await this.runQuery<string>(
      () => supabase.rpc('send_signal_message', {
        p_id: params.id,
        p_recipient_id: params.recipientId,
        p_sender_device_id: params.senderDeviceId ?? null,
        p_recipient_device_id: params.recipientDeviceId ?? null,
        p_message_type: params.messageType,
        p_payload: params.payload as Json,
        p_group_id: params.groupId ?? null,
        p_origin_id: params.originId ?? null,
      }),
      'sendMessage',
    )
    if (!result.ok) return result

    // Fire push notification (fire-and-forget, skip self-notes and silent sends)
    if (!params.silent) {
      if (params.senderId && params.senderId !== params.recipientId) {
        this.fireNotif(params.recipientId, params.messageType)
      } else if (!params.senderId) {
        // senderId not provided — always notify (conservative)
        this.fireNotif(params.recipientId, params.messageType)
      }
    }

    logger.info(`Message sent to ${params.recipientId} (type=${params.messageType})`)
    return ok(params.id)
  }

  async sendMessageBatch(params: SendBatchParams): Promise<Result<string[]>> {
    if (params.messages.length === 0) return ok([])

    const rows = params.messages.map(m => {
      const row: Record<string, unknown> = {
        id: m.id,
        recipient_id: params.recipientId,
        sender_device_id: params.senderDeviceId ?? null,
        recipient_device_id: m.recipientDeviceId ?? null,
        message_type: m.messageType,
        payload: m.payload,
        group_id: params.groupId ?? null,
        origin_id: params.originId ?? null,
      }
      return row
    })

    const result = await this.runQuery<string[]>(
      () => supabase.rpc('send_signal_messages_batch', { p_messages: rows as unknown as Json }),
      'sendMessageBatch', [],
    )
    if (!result.ok) return result

    // Single notification for the batch (skip silent sends)
    if (!params.silent) {
      const firstType = params.messages[0].messageType
      if (params.senderId && params.senderId !== params.recipientId) {
        this.fireNotif(params.recipientId, firstType)
      } else if (!params.senderId) {
        this.fireNotif(params.recipientId, firstType)
      }
    }

    logger.info(`Fan-out: ${params.messages.length} messages sent to ${params.recipientId}`)
    return ok(result.data)
  }

  async fetchUnread(userId: string, deviceId?: string): Promise<Result<SignalMessageRow[]>> {
    // Per-recipient read state lives in signal_message_reads. Legacy
    // signal_messages.read_at is kept as a silent-fail "already read"
    // fallback for rows that pre-date the 20260514_signal_message_reads
    // migration, so cutover doesn't replay history.
    const { data: readRows, error: readErr } = await supabase
      .from('signal_message_reads')
      .select('message_id')
      .eq('recipient_id', userId)
    if (readErr) {
      logger.error('fetchUnread reads-lookup error:', readErr.message)
      return err(readErr.message)
    }
    const readIds = (readRows ?? []).map(r => r.message_id)

    return this.runQuery<SignalMessageRow[]>(() => {
      const horizon = new Date(Date.now() - UNREAD_FETCH_HORIZON_MS).toISOString()
      let query = supabase
        .from('signal_messages')
        .select('*')
        .eq('recipient_id', userId)
        .is('read_at', null)
        .gte('created_at', horizon)
        .order('created_at', { ascending: true })

      if (readIds.length > 0) {
        query = query.not('id', 'in', `(${readIds.join(',')})`)
      }
      if (deviceId) {
        query = query.or(`recipient_device_id.eq.${deviceId},recipient_device_id.is.null`)
      }

      return query
    }, 'fetchUnread', [])
  }

  async markRead(messageIds: string[], recipientId?: string): Promise<Result<void>> {
    if (messageIds.length === 0) return ok(undefined)
    return this.runQuery(
      () => supabase.rpc('mark_signal_messages_read', {
        p_message_ids: messageIds,
        p_recipient_id: recipientId ?? null,
      }),
      'markRead',
    )
  }

  async deleteMessages(messageIds: string[]): Promise<Result<void>> {
    if (messageIds.length === 0) return ok(undefined)
    const result = await this.runQuery<void>(
      () => supabase.from('signal_messages').delete().in('id', messageIds),
      'deleteMessages',
    )
    if (result.ok) logger.info(`Deleted ${messageIds.length} messages from Supabase`)
    return result
  }

  async hardDeleteByOriginId(originIds: string[]): Promise<Result<void>> {
    if (originIds.length === 0) return ok(undefined)

    // 1. Delete sender's own rows via SECURITY DEFINER RPC (bypasses RLS)
    const rpcResult = await this.runQuery<number>(
      () => supabase.rpc('hard_delete_by_origin_id', { p_origin_ids: originIds }),
      'hardDeleteByOriginId:rpc',
    )
    if (!rpcResult.ok) logger.warn('hardDeleteByOriginId RPC error:', rpcResult.error)

    // 2. Delete received copies (RLS: recipient_id = auth.uid())
    const directResult = await this.runQuery<void>(
      () => supabase.from('signal_messages').delete().in('origin_id', originIds),
      'hardDeleteByOriginId:direct',
    )
    if (!directResult.ok) logger.warn('hardDeleteByOriginId direct error:', directResult.error)

    logger.info(`Hard-deleted by origin_id: ${originIds.length} origin IDs`)
    return ok(undefined)
  }

  // Cluster-wide purge for SYSTEM-authored, sealed-sender cards (intake / outside-message /
  // oncall-call): sender_id is NULL so hardDeleteByOriginId's sender-scoped RPC deletes
  // nothing, and RLS lets a member clear only their own copy. This RPC deletes EVERY row for
  // an origin the caller is a recipient of, server-side (SECURITY DEFINER bypasses RLS).
  async hardDeleteRecipientOrigin(originIds: string[]): Promise<Result<void>> {
    if (originIds.length === 0) return ok(undefined)

    const rpcResult = await this.runQuery<number>(
      () => supabase.rpc('hard_delete_recipient_origin', { p_origin_ids: originIds }),
      'hardDeleteRecipientOrigin:rpc',
    )
    if (!rpcResult.ok) logger.warn('hardDeleteRecipientOrigin RPC error:', rpcResult.error)
    else logger.info(`Hard-deleted recipient origins cluster-wide: ${rpcResult.data} rows`)
    return ok(undefined)
  }

  // Dev-gated purge for SYSTEM-authored rows (operator outbound via
  // send_signal_message_as_system stamps sender_id = SYSTEM). The sender-scoped
  // hardDeleteByOriginId (sender_id = auth.uid() = the dev) cannot touch them and
  // hardDeleteRecipientOrigin is recipient-scoped; this RPC deletes every copy
  // server-side (SECURITY DEFINER bypasses RLS, is_dev() gated).
  async hardDeleteSystemOrigin(originIds: string[]): Promise<Result<void>> {
    if (originIds.length === 0) return ok(undefined)

    const rpcResult = await this.runQuery<number>(
      () => supabase.rpc('hard_delete_system_origin', { p_origin_ids: originIds }),
      'hardDeleteSystemOrigin:rpc',
    )
    if (!rpcResult.ok) logger.warn('hardDeleteSystemOrigin RPC error:', rpcResult.error)
    else logger.info(`Hard-deleted SYSTEM-authored origins: ${rpcResult.data} rows`)
    return ok(undefined)
  }

  async fetchConversation(userId: string, peerId: string, limit: number = 50): Promise<Result<SignalMessageRow[]>> {
    return this.runQuery<SignalMessageRow[]>(
      () => supabase
        .from('signal_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${peerId}),` +
          `and(sender_id.eq.${peerId},recipient_id.eq.${userId})`
        )
        .order('created_at', { ascending: false })
        .limit(limit),
      'fetchConversation', [],
    )
  }

  async fetchGroupConversation(groupId: string, limit: number = 50): Promise<Result<SignalMessageRow[]>> {
    return this.runQuery<SignalMessageRow[]>(
      () => supabase
        .from('signal_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit),
      'fetchGroupConversation', [],
    )
  }

  isAvailable(): boolean {
    return navigator.onLine
  }

  private fireNotif(recipientId: string, messageType: string): void {
    // Only notify for user-visible message types — receipts, syncs, deletes are protocol-level
    if (messageType !== 'message' && messageType !== 'initial' && messageType !== 'request') return

    fireNotification({
      user_id: recipientId,
      title: 'ADTMC',
      body: 'New Message',
      type: 'signal_message',
    })
  }
}
