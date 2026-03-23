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
import { ok, err, callRpc, type Result } from '../result'
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
  const result = await callRpc(
    () => supabase
      .from('user_devices')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        device_label: deviceLabel ?? getDeviceLabel(),
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' }),
    'registerDevice', logger,
  )
  if (result.ok) logger.info(`Device ${deviceId} registered`)
  return result
}

/** Unregister a device (delete from user_devices). */
export async function unregisterDevice(
  userId: string,
  deviceId: string
): Promise<Result<void>> {
  const result = await callRpc(
    () => supabase.from('user_devices').delete().eq('user_id', userId).eq('device_id', deviceId),
    'unregisterDevice', logger,
  )
  if (result.ok) logger.info(`Device ${deviceId} unregistered`)
  return result
}

/** Register a device with role classification (primary/linked/provisional). */
export async function registerDeviceWithRole(
  deviceId: string,
  deviceLabel: string,
  isPrimary: boolean
): Promise<Result<DeviceRegistrationResult>> {
  return callRpc<DeviceRegistrationResult>(
    () => supabase.rpc('register_device_with_role', {
      p_device_id: deviceId,
      p_device_label: deviceLabel,
      p_is_primary: isPrimary,
    }),
    'registerDeviceWithRole', logger,
  )
}

/** Fetch all devices for the current user (reuses fetchPeerDevices). */
export async function fetchOwnDevices(
  userId: string
): Promise<Result<PeerDevice[]>> {
  return fetchPeerDevices(userId)
}

/** Primary device: force-logout all linked devices and invalidate sessions. */
export async function primaryLogoutAll(): Promise<Result<{ devicesDeleted: number; bundlesDeleted: number; sessionsDeleted: number }>> {
  return callRpc<{ devicesDeleted: number; bundlesDeleted: number; sessionsDeleted: number }>(
    () => supabase.rpc('primary_logout_all'),
    'primaryLogoutAll', logger,
  )
}

/** Clean up stale linked devices (called on login). */
export async function cleanupStaleDevices(
  staleMinutes: number = 30
): Promise<Result<{ devicesDeleted: number; bundlesDeleted: number }>> {
  return callRpc<{ devicesDeleted: number; bundlesDeleted: number }>(
    () => supabase.rpc('cleanup_stale_linked_devices', { p_stale_minutes: staleMinutes }),
    'cleanupStaleDevices', logger,
  )
}

/** Fetch all registered devices for a peer. */
export async function fetchPeerDevices(
  peerId: string
): Promise<Result<PeerDevice[]>> {
  return callRpc<PeerDevice[]>(
    () => supabase.rpc('fetch_peer_devices', { p_peer_id: peerId }),
    'fetchPeerDevices', logger, [],
  )
}

// ---- Key Bundle Operations ----

export async function uploadKeyBundle(
  bundle: PublicKeyBundle
): Promise<Result<void>> {
  const result = await callRpc(
    () => supabase
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
      }, { onConflict: 'user_id,device_id' }),
    'uploadKeyBundle', logger,
  )
  if (result.ok) logger.info('Key bundle uploaded')
  return result
}

export async function fetchPeerBundle(
  peerId: string
): Promise<Result<PeerBundleRpcResult>> {
  const result = await callRpc<PeerBundleRpcResult | null>(
    () => supabase.rpc('consume_peer_bundle', { p_peer_id: peerId }),
    'fetchPeerBundle', logger,
  )
  if (!result.ok) return result
  if (!result.data) return err('No key bundle found for peer')
  return ok(result.data)
}

export async function fetchPeerBundleForDevice(
  peerId: string,
  deviceId: string
): Promise<Result<PeerBundleRpcResult>> {
  const result = await callRpc<PeerBundleRpcResult | null>(
    () => supabase.rpc('consume_peer_bundle_for_device', {
      p_peer_id: peerId,
      p_device_id: deviceId,
    }),
    'fetchPeerBundleForDevice', logger,
  )
  if (!result.ok) return result
  if (!result.data) return err(`No key bundle found for peer ${peerId} device ${deviceId}`)
  return ok(result.data)
}

export async function deleteKeyBundle(
  userId: string,
  deviceId: string
): Promise<Result<void>> {
  const result = await callRpc(
    () => supabase.from('signal_key_bundles').delete().eq('user_id', userId).eq('device_id', deviceId),
    'deleteKeyBundle', logger,
  )
  if (result.ok) logger.info(`Key bundle deleted for device ${deviceId}`)
  return result
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
  messageType: 'initial' | 'message' | 'request' | 'request-accepted' | 'receipt',
  senderDeviceId?: string,
  recipientDeviceId?: string,
  groupId?: string,
  originId?: string
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
    originId,
  })
}

/**
 * Send a pre-encrypted group message to a single recipient.
 *
 * Used for sender-key-message and sender-key-distribution types where the
 * payload is ALREADY encrypted by the sender key protocol — no Double Ratchet
 * wrapping should occur. The payload is stored as-is in the signal_messages row.
 */
export async function sendRawGroupMessage(
  senderId: string,
  recipientId: string,
  payload: Record<string, unknown>,
  messageType: 'sender-key-message' | 'sender-key-distribution',
  senderDeviceId: string,
  groupId: string,
  originId?: string,
  silent?: boolean,
): Promise<Result<string>> {
  return transportManager.send({
    id: crypto.randomUUID(),
    senderId,
    recipientId,
    senderDeviceId,
    messageType,
    payload,
    groupId,
    originId,
    silent,
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
  groupId?: string,
  originId?: string,
  silent?: boolean,
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
    originId,
    silent,
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

export async function hardDeleteByOriginId(
  originIds: string[]
): Promise<Result<void>> {
  return transportManager.hardDeleteByOriginId(originIds)
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

import type { MeshAdapter, MeshAdapterState } from '../lora/types'
import type { MeshRouter } from '../lora/meshRouter'
import type { LoRaTransport } from '../lora/loraTransport'

let loraAdapter: MeshAdapter | null = null
let loraMeshRouter: MeshRouter | null = null
let loraTransportInstance: LoRaTransport | null = null
let loraPruneTimer: ReturnType<typeof setInterval> | null = null
let loraFlushTimer: ReturnType<typeof setInterval> | null = null

// ---- LoRa pub/sub listeners ----

const loraStateListeners = new Set<(state: MeshAdapterState) => void>()
const loraMessageListeners = new Set<(row: SignalMessageRow) => void>()

/** Subscribe to LoRa adapter state changes. Returns an unsubscribe function. */
export function onLoRaStateChange(cb: (state: MeshAdapterState) => void): () => void {
  loraStateListeners.add(cb)
  return () => { loraStateListeners.delete(cb) }
}

/** Subscribe to LoRa incoming messages. Returns an unsubscribe function. */
export function onLoRaMessage(cb: (row: SignalMessageRow) => void): () => void {
  loraMessageListeners.add(cb)
  return () => { loraMessageListeners.delete(cb) }
}

/** Get the current LoRa adapter state. */
export function getLoRaState(): MeshAdapterState {
  return loraAdapter?.state ?? 'disconnected'
}

/** Get mesh stats (witness + route counts). Returns null if LoRa is not initialized. */
export async function getLoRaMeshStats(): Promise<{ witnessCount: number; routeCount: number } | null> {
  if (!loraTransportInstance) return null
  try {
    const { countWitnesses, countRoutes } = await import('../lora/loraDb')
    const [witnessCount, routeCount] = await Promise.all([countWitnesses(), countRoutes()])
    return { witnessCount, routeCount }
  } catch {
    return null
  }
}

/**
 * Initialize the LoRa mesh subsystem.
 * Called once from the auth store after Signal bundle init.
 * Lazy-imports to avoid loading LoRa code when the flag is off.
 */
export async function initLoRaMesh(userId: string): Promise<void> {
  if (!LORA_MESH_ENABLED) return

  try {
    const { createMeshAdapter } = await import('../lora/adapterFactory')
    const { MeshRouter } = await import('../lora/meshRouter')
    const { LoRaTransport } = await import('../lora/loraTransport')
    const { userIdToShortId, shortIdToHex } = await import('../lora/wireFormat')

    const shortId = await userIdToShortId(userId)
    const localNode = {
      userId,
      shortId,
      shortIdHex: shortIdToHex(shortId),
    }

    loraAdapter = await createMeshAdapter({
      onStateChange: (state) => {
        logger.info(`LoRa adapter state: ${state}`)
        for (const cb of loraStateListeners) cb(state)
      },
      onReceive: (frame) => {
        loraMeshRouter?.handleIncoming(frame)
      },
      onError: (error) => {
        logger.warn(`LoRa adapter error: ${error}`)
      },
    })

    loraTransportInstance = new LoRaTransport(
      null as unknown as MeshRouter, // will be set after MeshRouter is created
      localNode,
      loraAdapter,
    )

    // Wire up push callback for incoming LoRa messages
    loraTransportInstance.onReceive = (row) => {
      for (const cb of loraMessageListeners) cb(row)
    }

    loraMeshRouter = new MeshRouter(localNode, loraAdapter, (frame) => {
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
 * Connect to a LoRa radio module.
 * Triggers the browser BLE device picker, then connects and starts the mesh router.
 */
export async function connectLoRa(): Promise<Result<void>> {
  if (!LORA_MESH_ENABLED || !loraAdapter || !loraMeshRouter) {
    return err('LoRa mesh not initialized')
  }

  const deviceResult = await loraAdapter.requestDevice()
  if (!deviceResult.ok) return deviceResult

  const connectResult = await loraAdapter.connect()
  if (!connectResult.ok) return connectResult

  loraMeshRouter.start()
  loraAdapter.startAutoReconnect()

  // Start periodic maintenance tasks
  startPeriodicTasks()

  return ok(undefined)
}

/** Disconnect from the LoRa radio module. */
export function disconnectLoRa(): void {
  stopPeriodicTasks()
  loraMeshRouter?.stop()
  loraAdapter?.disconnect()
}

/** Start periodic pruning and queue flushing while LoRa is connected. */
function startPeriodicTasks(): void {
  stopPeriodicTasks()

  // Prune stale witnesses and routes every 15 minutes
  loraPruneTimer = setInterval(() => {
    loraMeshRouter?.pruneStaleData().catch(() => {})
  }, 15 * 60 * 1000)

  // Flush offline queue via LoRa every 30 seconds
  loraFlushTimer = setInterval(() => {
    transportManager.flush().catch(() => {})
  }, 30 * 1000)
}

/** Stop periodic maintenance tasks. */
function stopPeriodicTasks(): void {
  if (loraPruneTimer) { clearInterval(loraPruneTimer); loraPruneTimer = null }
  if (loraFlushTimer) { clearInterval(loraFlushTimer); loraFlushTimer = null }
}
