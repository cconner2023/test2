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
import type { SignalTransport, SendMessageParams, SendBatchParams } from './transport'
import type { SignalMessageRow } from './transportTypes'

const logger = createLogger('SupabaseTransport')

export class SupabaseTransport implements SignalTransport {
  name = 'supabase'

  /**
   * Run a Supabase query with standardised error handling.
   * Wraps try-catch + error check + logging.
   */
  private async runQuery<T>(
    query: () => Promise<{ data: T | null; error: { message: string; code?: string } | null }>,
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
    const row: Record<string, unknown> = {
      id: params.id,
      sender_id: params.senderId,
      recipient_id: params.recipientId,
      sender_device_id: params.senderDeviceId ?? null,
      recipient_device_id: params.recipientDeviceId ?? null,
      message_type: params.messageType,
      payload: params.payload,
    }
    if (params.groupId) row.group_id = params.groupId
    if (params.originId) row.origin_id = params.originId

    const result = await this.runQuery<{ id: string }>(
      () => supabase.from('signal_messages').insert(row).select('id').single(),
      'sendMessage',
    )
    if (!result.ok) return result

    // Fire push notification (fire-and-forget, skip self-notes)
    if (params.senderId !== params.recipientId) {
      this.fireNotif(params.recipientId, params.senderId, params.messageType)
    }

    logger.info(`Message sent to ${params.recipientId} (type=${params.messageType})`)
    return ok(result.data.id)
  }

  async sendMessageBatch(params: SendBatchParams): Promise<Result<string[]>> {
    if (params.messages.length === 0) return ok([])

    const rows = params.messages.map(m => {
      const row: Record<string, unknown> = {
        id: m.id,
        sender_id: params.senderId,
        sender_device_id: params.senderDeviceId,
        recipient_id: params.recipientId,
        recipient_device_id: m.recipientDeviceId,
        message_type: m.messageType,
        payload: m.payload,
      }
      if (params.groupId) row.group_id = params.groupId
      if (params.originId) row.origin_id = params.originId
      return row
    })

    const result = await this.runQuery<{ id: string }[]>(
      () => supabase.from('signal_messages').insert(rows).select('id'),
      'sendMessageBatch', [],
    )
    if (!result.ok) return result

    const ids = result.data.map(d => d.id)

    // Single push notification for the batch (skip self-notes)
    const firstType = params.messages[0].messageType
    if (params.senderId !== params.recipientId) {
      this.fireNotif(params.recipientId, params.senderId, firstType)
    }

    logger.info(`Fan-out: ${params.messages.length} messages sent to ${params.recipientId}`)
    return ok(ids)
  }

  async fetchUnread(userId: string, deviceId?: string): Promise<Result<SignalMessageRow[]>> {
    return this.runQuery<SignalMessageRow[]>(() => {
      let query = supabase
        .from('signal_messages')
        .select('*')
        .eq('recipient_id', userId)
        .is('read_at', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (deviceId) {
        query = query.or(`recipient_device_id.eq.${deviceId},recipient_device_id.is.null`)
      }

      return query
    }, 'fetchUnread', [])
  }

  async markRead(messageIds: string[]): Promise<Result<void>> {
    if (messageIds.length === 0) return ok(undefined)
    return this.runQuery(
      () => supabase.from('signal_messages').update({ read_at: new Date().toISOString() }).in('id', messageIds),
      'markRead',
    )
  }

  async deleteMessages(messageIds: string[]): Promise<Result<void>> {
    if (messageIds.length === 0) return ok(undefined)
    const result = await this.runQuery(
      () => supabase.from('signal_messages').delete().in('id', messageIds),
      'deleteMessages',
    )
    if (result.ok) logger.info(`Deleted ${messageIds.length} messages from Supabase`)
    return result
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
        .is('deleted_at', null)
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
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit),
      'fetchGroupConversation', [],
    )
  }

  async softDeleteMessages(originIds: string[]): Promise<Result<number>> {
    if (originIds.length === 0) return ok(0)
    const result = await this.runQuery<number>(
      () => supabase.rpc('soft_delete_messages', { p_origin_ids: originIds }),
      'softDeleteMessages', 0,
    )
    if (result.ok) logger.info(`Soft-deleted ${result.data} message rows for ${originIds.length} origin IDs`)
    return result
  }

  async fetchDeletedMessages(userId: string): Promise<Result<SignalMessageRow[]>> {
    return this.runQuery<SignalMessageRow[]>(
      () => supabase
        .from('signal_messages')
        .select('*')
        .eq('recipient_id', userId)
        .not('deleted_at', 'is', null),
      'fetchDeletedMessages', [],
    )
  }

  isAvailable(): boolean {
    return navigator.onLine
  }

  private fireNotif(
    recipientId: string,
    senderId: string,
    messageType: string,
  ): void {
    // Sync messages are self-addressed — never notify
    if (messageType === 'sync') return

    const notif = messageType === 'request'
      ? { title: 'New message request', body: 'Someone wants to message you' }
      : messageType === 'request-accepted'
        ? { title: 'Request accepted', body: 'Your message request was accepted' }
        : { title: 'New secure message', body: 'You have a new encrypted message' }

    fireNotification({
      user_id: recipientId,
      ...notif,
      type: 'signal_message',
      author_id: senderId,
    })
  }
}
