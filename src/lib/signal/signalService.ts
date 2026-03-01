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
import { LORA_MESH_ENABLED } from '../featureFlags'
import type { PublicKeyBundle, EncryptedMessage, InitialMessage } from './types'
import type {
  PeerBundleRpcResult,
  SignalMessageRow,
  PeerDevice,
  FanOutMessageInput,
  DeviceRegistrationResult,
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

// Expose diagnostic test on window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__testSignalSend = async () => {
    const { getLocalDeviceId } = await import('./keyManager')
    const { supabase: sb } = await import('../supabase')
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { console.error('[Diagnostic] Not authenticated'); return }
    const deviceId = await getLocalDeviceId()
    if (!deviceId) { console.error('[Diagnostic] No localDeviceId'); return }
    console.log('[Diagnostic] user:', user.id, 'device:', deviceId)
    await supabaseTransport.testInsert(user.id, deviceId)
  }
}

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

/** Register a device with role classification (primary/linked/provisional). */
export async function registerDeviceWithRole(
  deviceId: string,
  deviceLabel: string,
  isPrimary: boolean
): Promise<Result<DeviceRegistrationResult>> {
  try {
    const { data, error } = await supabase
      .rpc('register_device_with_role', {
        p_device_id: deviceId,
        p_device_label: deviceLabel,
        p_is_primary: isPrimary,
      })

    if (error) {
      logger.error('registerDeviceWithRole RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok(data as unknown as DeviceRegistrationResult)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('registerDeviceWithRole exception:', msg)
    return err(msg)
  }
}

/** Fetch all devices for the current user (reuses fetchPeerDevices). */
export async function fetchOwnDevices(
  userId: string
): Promise<Result<PeerDevice[]>> {
  return fetchPeerDevices(userId)
}

/** Primary device: force-logout all linked devices and invalidate sessions. */
export async function primaryLogoutAll(): Promise<Result<{ devicesDeleted: number; bundlesDeleted: number; sessionsDeleted: number }>> {
  try {
    const { data, error } = await supabase
      .rpc('primary_logout_all')

    if (error) {
      logger.error('primaryLogoutAll RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok(data as unknown as { devicesDeleted: number; bundlesDeleted: number; sessionsDeleted: number })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('primaryLogoutAll exception:', msg)
    return err(msg)
  }
}

/** Clean up stale linked devices (called on login). */
export async function cleanupStaleDevices(
  staleMinutes: number = 30
): Promise<Result<{ devicesDeleted: number; bundlesDeleted: number }>> {
  try {
    const { data, error } = await supabase
      .rpc('cleanup_stale_linked_devices', { p_stale_minutes: staleMinutes })

    if (error) {
      logger.error('cleanupStaleDevices RPC error:', error.message)
      return err(error.message, error.code)
    }

    return ok(data as unknown as { devicesDeleted: number; bundlesDeleted: number })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error('cleanupStaleDevices exception:', msg)
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
  recipientDeviceId?: string,
  groupId?: string
): Promise<Result<string>> {
  return transportManager.send({
    id: crypto.randomUUID(),
    senderId,
    recipientId,
    senderDeviceId,
    recipientDeviceId,
    messageType,
    payload: payload as unknown as Record<string, unknown>,
    groupId,
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
  messages: FanOutMessageInput[],
  groupId?: string
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
    groupId,
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

export async function fetchGroupConversation(
  groupId: string,
  limit: number = 50
): Promise<Result<SignalMessageRow[]>> {
  return transportManager.fetchGroupConversation(groupId, limit)
}

// ---- LoRa Mesh (behind feature flag) ----

import type { BleAdapter } from '../lora/bleAdapter'
import type { MeshRouter } from '../lora/meshRouter'
import type { LoRaTransport } from '../lora/loraTransport'

let loraBleAdapter: BleAdapter | null = null
let loraMeshRouter: MeshRouter | null = null
let loraTransportInstance: LoRaTransport | null = null

/**
 * Initialize the LoRa mesh subsystem.
 * Called once from the auth store after Signal bundle init.
 * Lazy-imports to avoid loading LoRa code when the flag is off.
 */
export async function initLoRaMesh(userId: string): Promise<void> {
  if (!LORA_MESH_ENABLED) return

  try {
    const { BleAdapter } = await import('../lora/bleAdapter')
    const { MeshRouter } = await import('../lora/meshRouter')
    const { LoRaTransport } = await import('../lora/loraTransport')
    const { userIdToShortId, shortIdToHex } = await import('../lora/wireFormat')

    const shortId = await userIdToShortId(userId)
    const localNode = {
      userId,
      shortId,
      shortIdHex: shortIdToHex(shortId),
    }

    loraBleAdapter = new BleAdapter({
      onStateChange: (state) => {
        logger.info(`LoRa BLE state: ${state}`)
      },
      onReceive: (frame) => {
        loraMeshRouter?.handleIncoming(frame)
      },
      onError: (error) => {
        logger.warn(`LoRa BLE error: ${error}`)
      },
    })

    loraTransportInstance = new LoRaTransport(
      null as unknown as MeshRouter, // will be set after MeshRouter is created
      localNode,
      loraBleAdapter,
    )

    loraMeshRouter = new MeshRouter(localNode, loraBleAdapter, (frame) => {
      loraTransportInstance?.handleReceivedFrame(frame)
    })

    // Wire up the real router reference
    loraTransportInstance.meshRouter = loraMeshRouter

    transportManager.setSecondary(loraTransportInstance)
    logger.info('LoRa mesh subsystem initialized')
  } catch (e) {
    logger.warn('Failed to initialize LoRa mesh:', e)
  }
}

/**
 * Connect to a LoRa BLE radio module.
 * Triggers the browser BLE device picker, then connects and starts the mesh router.
 */
export async function connectLoRa(): Promise<Result<void>> {
  if (!LORA_MESH_ENABLED || !loraBleAdapter || !loraMeshRouter) {
    return err('LoRa mesh not initialized')
  }

  const deviceResult = await loraBleAdapter.requestDevice()
  if (!deviceResult.ok) return deviceResult

  const connectResult = await loraBleAdapter.connect()
  if (!connectResult.ok) return connectResult

  loraMeshRouter.start()
  loraBleAdapter.startAutoReconnect()
  return ok(undefined)
}

/** Disconnect from the LoRa BLE radio module. */
export function disconnectLoRa(): void {
  loraMeshRouter?.stop()
  loraBleAdapter?.disconnect()
}
