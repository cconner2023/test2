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

    // Fire push notification (fire-and-forget, skip self-notes)
    if (params.senderId && params.senderId !== params.recipientId) {
      this.fireNotif(params.recipientId, params.messageType)
    } else if (!params.senderId) {
      // senderId not provided — always notify (conservative)
      this.fireNotif(params.recipientId, params.messageType)
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

    // Single notification for the batch
    const firstType = params.messages[0].messageType
    if (params.senderId && params.senderId !== params.recipientId) {
      this.fireNotif(params.recipientId, firstType)
    } else if (!params.senderId) {
      this.fireNotif(params.recipientId, firstType)
    }

    logger.info(`Fan-out: ${params.messages.length} messages sent to ${params.recipientId}`)
    return ok(result.data)
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
    const result = await this.runQuery<void>(
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

  isAvailable(): boolean {
    return navigator.onLine
  }

  private fireNotif(recipientId: string, messageType: string): void {
    if (messageType === 'sync' || messageType === 'delete') return

    const notif = messageType === 'request'
      ? { title: 'New message request', body: 'Someone wants to message you' }
      : messageType === 'request-accepted'
        ? { title: 'Request accepted', body: 'Your message request was accepted' }
        : { title: 'New secure message', body: 'You have a new encrypted message' }

    fireNotification({
      user_id: recipientId,
      ...notif,
      type: 'signal_message',
      // author_id removed (sealed sender — server doesn't know who sent)
    })
  }
}
