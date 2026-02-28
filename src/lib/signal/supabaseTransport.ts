/**
 * Supabase implementation of SignalTransport.
 *
 * Extracts the messaging CRUD operations from signalService.ts into a class
 * implementing the SignalTransport interface. Same Supabase calls, just
 * organized behind the transport adapter.
 */

import { supabase } from '../supabase'
import { ok, err, type Result } from '../result'
import { fireNotification } from '../notifyDispatcher'
import { createLogger } from '../../Utilities/Logger'
import type { SignalTransport, SendMessageParams, SendBatchParams } from './transport'
import type { SignalMessageRow } from './transportTypes'

const logger = createLogger('SupabaseTransport')

export class SupabaseTransport implements SignalTransport {
  name = 'supabase'

  async sendMessage(params: SendMessageParams): Promise<Result<string>> {
    try {
      const { data, error } = await supabase
        .from('signal_messages')
        .insert({
          id: params.id,
          sender_id: params.senderId,
          recipient_id: params.recipientId,
          sender_device_id: params.senderDeviceId ?? null,
          recipient_device_id: params.recipientDeviceId ?? null,
          message_type: params.messageType,
          payload: params.payload,
        })
        .select('id')
        .single()

      if (error) {
        logger.error('sendMessage insert error:', error.message)
        return err(error.message, error.code)
      }

      // Fire push notification (fire-and-forget, skip self-notes)
      if (params.senderId !== params.recipientId) {
        this.fireNotif(params.recipientId, params.senderId, params.messageType)
      }

      logger.info(`Message sent to ${params.recipientId} (type=${params.messageType})`)
      return ok(data.id as string)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      logger.error('sendMessage exception:', msg)
      return err(msg)
    }
  }

  async sendMessageBatch(params: SendBatchParams): Promise<Result<string[]>> {
    if (params.messages.length === 0) return ok([])

    try {
      const rows = params.messages.map(m => ({
        id: m.id,
        sender_id: params.senderId,
        sender_device_id: params.senderDeviceId,
        recipient_id: params.recipientId,
        recipient_device_id: m.recipientDeviceId,
        message_type: m.messageType,
        payload: m.payload,
      }))

      const { data, error } = await supabase
        .from('signal_messages')
        .insert(rows)
        .select('id')

      if (error) {
        logger.error('sendMessageBatch insert error:', error.message)
        return err(error.message, error.code)
      }

      const ids = (data ?? []).map((d: { id: string }) => d.id)

      // Single push notification for the batch (skip self-notes)
      const firstType = params.messages[0].messageType
      if (params.senderId !== params.recipientId) {
        this.fireNotif(params.recipientId, params.senderId, firstType)
      }

      logger.info(`Fan-out: ${params.messages.length} messages sent to ${params.recipientId}`)
      return ok(ids)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      logger.error('sendMessageBatch exception:', msg)
      return err(msg)
    }
  }

  async fetchUnread(userId: string, deviceId?: string): Promise<Result<SignalMessageRow[]>> {
    try {
      let query = supabase
        .from('signal_messages')
        .select('*')
        .eq('recipient_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: true })

      if (deviceId) {
        query = query.or(`recipient_device_id.eq.${deviceId},recipient_device_id.is.null`)
      }

      const { data, error } = await query

      if (error) {
        logger.error('fetchUnread error:', error.message)
        return err(error.message, error.code)
      }

      return ok((data ?? []) as unknown as SignalMessageRow[])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      logger.error('fetchUnread exception:', msg)
      return err(msg)
    }
  }

  async markRead(messageIds: string[]): Promise<Result<void>> {
    if (messageIds.length === 0) return ok(undefined)

    try {
      const { error } = await supabase
        .from('signal_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', messageIds)

      if (error) {
        logger.error('markRead error:', error.message)
        return err(error.message, error.code)
      }

      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      logger.error('markRead exception:', msg)
      return err(msg)
    }
  }

  async deleteMessages(messageIds: string[]): Promise<Result<void>> {
    if (messageIds.length === 0) return ok(undefined)

    try {
      const { error } = await supabase
        .from('signal_messages')
        .delete()
        .in('id', messageIds)

      if (error) {
        logger.error('deleteMessages error:', error.message)
        return err(error.message, error.code)
      }

      logger.info(`Deleted ${messageIds.length} messages from Supabase`)
      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      logger.error('deleteMessages exception:', msg)
      return err(msg)
    }
  }

  async fetchConversation(userId: string, peerId: string, limit: number = 50): Promise<Result<SignalMessageRow[]>> {
    try {
      const { data, error } = await supabase
        .from('signal_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${peerId}),` +
          `and(sender_id.eq.${peerId},recipient_id.eq.${userId})`
        )
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        logger.error('fetchConversation error:', error.message)
        return err(error.message, error.code)
      }

      return ok((data ?? []) as unknown as SignalMessageRow[])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      logger.error('fetchConversation exception:', msg)
      return err(msg)
    }
  }

  isAvailable(): boolean {
    return navigator.onLine
  }

  private fireNotif(
    recipientId: string,
    senderId: string,
    messageType: string,
  ): void {
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
