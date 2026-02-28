/**
 * Signal Protocol transport — thin facade.
 *
 * Device management and key bundle operations remain here (online-only,
 * no transport abstraction needed). Messaging operations delegate to the
 * TransportManager which handles offline queue fallback.
 *
 * All functions return Result<T> and never throw.
 */

import { supabase } from '../supabase'
import { ok, err, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'
import { TransportManager } from './transport'
import { SupabaseTransport } from './supabaseTransport'
import {
  enqueue,
  enqueueBatch,
  dequeueAll,
  markSent,
  markFailed,
} from './outboundQueue'
import type { PublicKeyBundle, EncryptedMessage, InitialMessage } from './types'
import type {
  PeerBundleRpcResult,
  SignalMessageRow,
  PeerDevice,
  FanOutMessageInput,
} from './transportTypes'

const logger = createLogger('SignalService')

// ---- Transport Manager (singleton) ----

export const transportManager = new TransportManager()

// Initialize primary transport and wire up the offline queue
const supabaseTransport = new SupabaseTransport()
transportManager.setPrimary(supabaseTransport)
transportManager.setQueue({
  enqueue,
  enqueueBatch,
  dequeueAll,
  markSent,
  markFailed,
})

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

export async function deleteKeyBundle(
  userId: string,
  deviceId: string
): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('signal_key_bundles')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId)

    if (error) {
      logger.error('Failed to delete key bundle:', error.message)
      return err(error.message, error.code)
    }

    logger.info(`Key bundle deleted for device ${deviceId}`)
    return ok(undefined)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('deleteKeyBundle exception:', msg)
    return err(msg)
  }
}

// ---- Message Operations (delegated to TransportManager) ----

/**
 * Send an encrypted message to a recipient.
 * Same signature as before — hooks don't change.
 */
export async function sendMessage(
  senderId: string,
  recipientId: string,
  payload: InitialMessage | EncryptedMessage | { text: string } | Record<string, never>,
  messageType: 'initial' | 'message' | 'request' | 'request-accepted',
  senderDeviceId?: string,
  recipientDeviceId?: string
): Promise<Result<string>> {
  return transportManager.send({
    id: crypto.randomUUID(),
    senderId,
    recipientId,
    senderDeviceId,
    recipientDeviceId,
    messageType,
    payload: payload as unknown as Record<string, unknown>,
  })
}

/**
 * Fan-out send: one message per recipient device.
 * Same signature as before — hooks don't change.
 */
export async function sendMessageFanOut(
  senderId: string,
  senderDeviceId: string,
  recipientId: string,
  messages: FanOutMessageInput[]
): Promise<Result<string[]>> {
  if (messages.length === 0) return ok([])

  return transportManager.sendBatch({
    senderId,
    senderDeviceId,
    recipientId,
    messages: messages.map(m => ({
      id: crypto.randomUUID(),
      ...m,
    })),
  })
}

export async function fetchUnreadMessages(
  userId: string,
  deviceId?: string
): Promise<Result<SignalMessageRow[]>> {
  return transportManager.fetchUnread(userId, deviceId)
}

export async function markMessagesRead(
  messageIds: string[]
): Promise<Result<void>> {
  return transportManager.markRead(messageIds)
}

export async function deleteMessages(
  messageIds: string[]
): Promise<Result<void>> {
  return transportManager.deleteMessages(messageIds)
}

export async function fetchConversation(
  userId: string,
  peerId: string,
  limit: number = 50
): Promise<Result<SignalMessageRow[]>> {
  return transportManager.fetchConversation(userId, peerId, limit)
}
