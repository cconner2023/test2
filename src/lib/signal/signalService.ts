/**
 * Signal Protocol Supabase transport — CRUD operations.
 *
 * All functions return Result<T> and never throw. The caller decides
 * how to handle errors (toast, retry, ignore).
 */

import { supabase } from '../supabase'
import { ok, err, type Result } from '../result'
import { fireNotification } from '../notifyDispatcher'
import { createLogger } from '../../Utilities/Logger'
import type { PublicKeyBundle, EncryptedMessage, InitialMessage } from './types'
import type {
  PeerBundleRpcResult,
  SignalMessageRow,
  PeerDevice,
  FanOutMessageInput,
} from './transportTypes'

const logger = createLogger('SignalService')

// ---- Device Registration ----

/** Parse the User-Agent for a human-readable device label. */
export function getDeviceLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

/** Register a device for the current user (upsert into user_devices). */
export async function registerDevice(
  userId: string,
  deviceId: string,
  deviceLabel?: string
): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        device_label: deviceLabel ?? getDeviceLabel(),
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' })

    if (error) {
      logger.error('Failed to register device:', error.message)
      return err(error.message, error.code)
    }

    logger.info(`Device ${deviceId} registered`)
    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('registerDevice exception:', msg)
    return err(msg)
  }
}

/** Unregister a device (delete from user_devices). */
export async function unregisterDevice(
  userId: string,
  deviceId: string
): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId)

    if (error) {
      logger.error('Failed to unregister device:', error.message)
      return err(error.message, error.code)
    }

    logger.info(`Device ${deviceId} unregistered`)
    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('unregisterDevice exception:', msg)
    return err(msg)
  }
}

/** Fetch all registered devices for a peer. */
export async function fetchPeerDevices(
  peerId: string
): Promise<Result<PeerDevice[]>> {
  try {
    const { data, error } = await supabase
      .rpc('fetch_peer_devices', { p_peer_id: peerId })

    if (error) {
      logger.error('fetchPeerDevices RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok((data ?? []) as unknown as PeerDevice[])
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('fetchPeerDevices exception:', msg)
    return err(msg)
  }
}

// ---- Key Bundle Operations ----

/**
 * Upsert the local user's public key bundle to Supabase.
 * Called on sign-in (via signalInit) and whenever keys are rotated.
 */
export async function uploadKeyBundle(
  bundle: PublicKeyBundle
): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('signal_key_bundles')
      .upsert({
        user_id: bundle.userId,
        device_id: bundle.deviceId,
        identity_signing_key: bundle.identitySigningKey,
        identity_dh_key: bundle.identityDhKey,
        signed_pre_key_id: bundle.signedPreKey.keyId,
        signed_pre_key: bundle.signedPreKey.publicKey,
        signed_pre_key_sig: bundle.signedPreKey.signature,
        one_time_pre_keys: bundle.oneTimePreKeys,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' })

    if (error) {
      logger.error('Failed to upload key bundle:', error.message)
      return err(error.message, error.code)
    }

    logger.info('Key bundle uploaded')
    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('uploadKeyBundle exception:', msg)
    return err(msg)
  }
}

/**
 * Atomically fetch a peer's key bundle and consume one OTP key.
 * Uses the `consume_peer_bundle` RPC to prevent race conditions.
 * Kept for backward compatibility — new code should use fetchPeerBundleForDevice.
 */
export async function fetchPeerBundle(
  peerId: string
): Promise<Result<PeerBundleRpcResult>> {
  try {
    const { data, error } = await supabase
      .rpc('consume_peer_bundle', { p_peer_id: peerId })

    if (error) {
      logger.error('fetchPeerBundle RPC error:', error.message)
      return err(error.message, error.code)
    }

    if (!data) {
      return err('No key bundle found for peer')
    }

    return ok(data as unknown as PeerBundleRpcResult)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('fetchPeerBundle exception:', msg)
    return err(msg)
  }
}

/**
 * Atomically fetch a specific device's key bundle and consume one OTP key.
 * Uses the `consume_peer_bundle_for_device` RPC.
 */
export async function fetchPeerBundleForDevice(
  peerId: string,
  deviceId: string
): Promise<Result<PeerBundleRpcResult>> {
  try {
    const { data, error } = await supabase
      .rpc('consume_peer_bundle_for_device', {
        p_peer_id: peerId,
        p_device_id: deviceId,
      })

    if (error) {
      logger.error('fetchPeerBundleForDevice RPC error:', error.message)
      return err(error.message, error.code)
    }

    if (!data) {
      return err(`No key bundle found for peer ${peerId} device ${deviceId}`)
    }

    return ok(data as unknown as PeerBundleRpcResult)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('fetchPeerBundleForDevice exception:', msg)
    return err(msg)
  }
}

// ---- Message Operations ----

/**
 * Send an encrypted message to a recipient.
 * Inserts into `signal_messages` and fires a push notification.
 */
export async function sendMessage(
  senderId: string,
  recipientId: string,
  payload: InitialMessage | EncryptedMessage | { text: string } | Record<string, never>,
  messageType: 'initial' | 'message' | 'request' | 'request-accepted',
  senderDeviceId?: string,
  recipientDeviceId?: string
): Promise<Result<string>> {
  try {
    const { data, error } = await supabase
      .from('signal_messages')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        sender_device_id: senderDeviceId ?? null,
        recipient_device_id: recipientDeviceId ?? null,
        message_type: messageType,
        payload: payload as unknown as Record<string, unknown>,
      })
      .select('id')
      .single()

    if (error) {
      logger.error('sendMessage insert error:', error.message)
      return err(error.message, error.code)
    }

    // Fire push notification (fire-and-forget)
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

    logger.info(`Message sent to ${recipientId} (type=${messageType})`)
    return ok(data.id as string)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('sendMessage exception:', msg)
    return err(msg)
  }
}

/**
 * Fan-out send: insert one message row per recipient device in a single batch.
 * Only fires one push notification (to the recipient user).
 */
export async function sendMessageFanOut(
  senderId: string,
  senderDeviceId: string,
  recipientId: string,
  messages: FanOutMessageInput[]
): Promise<Result<string[]>> {
  if (messages.length === 0) return ok([])

  try {
    const rows = messages.map(m => ({
      sender_id: senderId,
      sender_device_id: senderDeviceId,
      recipient_id: recipientId,
      recipient_device_id: m.recipientDeviceId,
      message_type: m.messageType,
      payload: m.payload,
    }))

    const { data, error } = await supabase
      .from('signal_messages')
      .insert(rows)
      .select('id')

    if (error) {
      logger.error('sendMessageFanOut insert error:', error.message)
      return err(error.message, error.code)
    }

    const ids = (data ?? []).map((d: { id: string }) => d.id)

    // Single push notification for the batch
    const firstType = messages[0].messageType
    const notif = firstType === 'request'
      ? { title: 'New message request', body: 'Someone wants to message you' }
      : firstType === 'request-accepted'
        ? { title: 'Request accepted', body: 'Your message request was accepted' }
        : { title: 'New secure message', body: 'You have a new encrypted message' }

    fireNotification({
      user_id: recipientId,
      ...notif,
      type: 'signal_message',
      author_id: senderId,
    })

    logger.info(`Fan-out: ${messages.length} messages sent to ${recipientId}`)
    return ok(ids)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('sendMessageFanOut exception:', msg)
    return err(msg)
  }
}

/**
 * Fetch unread messages for offline catch-up.
 * Returns messages ordered by creation time (oldest first).
 * When deviceId is provided, filters to messages for that device (or null device for legacy).
 */
export async function fetchUnreadMessages(
  userId: string,
  deviceId?: string
): Promise<Result<SignalMessageRow[]>> {
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
      logger.error('fetchUnreadMessages error:', error.message)
      return err(error.message, error.code)
    }

    return ok((data ?? []) as unknown as SignalMessageRow[])
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('fetchUnreadMessages exception:', msg)
    return err(msg)
  }
}

/**
 * Mark messages as read by setting `read_at` timestamp.
 */
export async function markMessagesRead(
  messageIds: string[]
): Promise<Result<void>> {
  if (messageIds.length === 0) return ok(undefined)

  try {
    const { error } = await supabase
      .from('signal_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', messageIds)

    if (error) {
      logger.error('markMessagesRead error:', error.message)
      return err(error.message, error.code)
    }

    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('markMessagesRead exception:', msg)
    return err(msg)
  }
}

/**
 * Fetch paginated conversation history between two users.
 * Returns messages ordered newest-first (caller reverses for display).
 */
export async function fetchConversation(
  userId: string,
  peerId: string,
  limit: number = 50
): Promise<Result<SignalMessageRow[]>> {
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
