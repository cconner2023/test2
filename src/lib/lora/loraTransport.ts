/**
 * LoRa Mesh — SignalTransport implementation.
 *
 * Plugs into TransportManager as a secondary transport. Maps Signal Protocol
 * encrypted payloads to/from LoRa mesh frames.
 *
 * Payload flow (outbound):
 *   SendMessageParams.payload → JSON → UTF-8 → pako deflateRaw → LoRa frame
 *
 * Payload flow (inbound):
 *   LoRa frame → pako inflateRaw → UTF-8 → JSON → SignalMessageRow
 */

import { deflateRaw, inflateRaw } from 'pako'
import { ok, err, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'
import type {
  SignalTransport,
  SendMessageParams,
  SendBatchParams,
} from '../signal/transport'
import type { SignalMessageRow } from '../signal/transportTypes'
import type { LoRaFrame, LoRaNodeId, MeshAdapter } from './types'
import type { MeshRouter } from './meshRouter'
import { userIdToShortId, shortIdToHex } from './wireFormat'

const logger = createLogger('LoRaTransport')

export class LoRaTransport implements SignalTransport {
  name = 'lora-mesh'

  meshRouter: MeshRouter
  private adapter: MeshAdapter | null
  private localNode: LoRaNodeId

  /** Buffer of received messages (push-based, drained by fetchUnread). */
  private receivedBuffer: SignalMessageRow[] = []

  /** Callback fired when a LoRa message is received and buffered. */
  onReceive: ((row: SignalMessageRow) => void) | null = null

  /** Cache of userId → shortIdHex for outbound routing. */
  private shortIdCache = new Map<string, string>()

  constructor(meshRouter: MeshRouter, localNode: LoRaNodeId, adapter?: MeshAdapter) {
    this.meshRouter = meshRouter
    this.localNode = localNode
    this.adapter = adapter ?? null
  }

  /** Set the adapter reference (for isAvailable check). */
  setAdapter(adapter: MeshAdapter): void {
    this.adapter = adapter
  }

  // ---- SignalTransport Implementation ----

  async sendMessage(params: SendMessageParams): Promise<Result<string>> {
    try {
      // Resolve recipient short ID
      const recipientShortId = await this.resolveShortId(params.recipientId)

      // Serialize and compress payload
      const jsonBytes = new TextEncoder().encode(JSON.stringify({
        id: params.id,
        senderId: params.senderId,
        recipientId: params.recipientId,
        senderDeviceId: params.senderDeviceId,
        recipientDeviceId: params.recipientDeviceId,
        messageType: params.messageType,
        payload: params.payload,
        groupId: params.groupId,
        originId: params.originId,
        createdAt: new Date().toISOString(),
      }))

      const compressed = deflateRaw(jsonBytes)

      // Send via mesh
      const result = await this.meshRouter.sendToMesh(recipientShortId, compressed)
      if (!result.ok) return err(result.error)

      return ok(params.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'LoRa send failed'
      logger.warn('sendMessage failed:', msg)
      return err(msg)
    }
  }

  async sendMessageBatch(params: SendBatchParams): Promise<Result<string[]>> {
    // LoRa has no batch optimization — each message goes over RF individually
    const ids: string[] = []

    for (const m of params.messages) {
      const result = await this.sendMessage({
        id: m.id,
        senderId: params.senderId,
        recipientId: params.recipientId,
        senderDeviceId: params.senderDeviceId,
        recipientDeviceId: m.recipientDeviceId,
        messageType: m.messageType,
        payload: m.payload,
        groupId: params.groupId,
        originId: params.originId,
      })

      if (result.ok) {
        ids.push(result.data)
      } else {
        logger.warn(`Batch send failed for message to device ${m.recipientDeviceId}: ${result.error}`)
      }
    }

    return ids.length > 0 ? ok(ids) : err('All batch messages failed')
  }

  /**
   * Return locally-buffered received messages.
   * LoRa is push-based — messages arrive via MeshRouter callback
   * and are buffered here until polled.
   */
  async fetchUnread(_userId: string, _deviceId?: string): Promise<Result<SignalMessageRow[]>> {
    const messages = [...this.receivedBuffer]
    this.receivedBuffer = []
    return ok(messages)
  }

  /** Local-only — no remote server to update. */
  async markRead(_messageIds: string[]): Promise<Result<void>> {
    return ok(undefined)
  }

  /** Local-only — no remote server to delete from. */
  async deleteMessages(_messageIds: string[]): Promise<Result<void>> {
    return ok(undefined)
  }

  /** No-op — hard-delete by origin_id is handled via Supabase. */
  async hardDeleteByOriginId(_originIds: string[]): Promise<Result<void>> {
    return ok(undefined)
  }

  /** No-op — soft-delete is handled via Supabase RPC. */
  async softDeleteMessages(_originIds: string[]): Promise<Result<number>> {
    return ok(0)
  }

  /** No-op — tombstone cleanup is handled via Supabase. */
  async fetchDeletedMessages(_userId: string): Promise<Result<SignalMessageRow[]>> {
    return ok([])
  }

  /** Delegate to existing message store (same IDB as Supabase messages). */
  async fetchConversation(
    _userId: string,
    _peerId: string,
    _limit?: number,
  ): Promise<Result<SignalMessageRow[]>> {
    // Conversations are already stored in messageStore by the decryption pipeline.
    // LoRa transport doesn't maintain its own conversation history.
    return ok([])
  }

  /** Delegate to existing message store. */
  async fetchGroupConversation(
    _groupId: string,
    _limit?: number,
  ): Promise<Result<SignalMessageRow[]>> {
    return ok([])
  }

  isAvailable(): boolean {
    return this.adapter?.isConnected() ?? false
  }

  // ---- Public API (called by MeshRouter callback) ----

  /**
   * Called by MeshRouter.onMessageReceived when a frame addressed to us arrives.
   * Decompresses the payload and buffers it as a SignalMessageRow.
   */
  handleReceivedFrame(frame: LoRaFrame): void {
    try {
      // Decompress
      const decompressed = inflateRaw(frame.payload)
      const json = new TextDecoder().decode(decompressed)
      const parsed = JSON.parse(json) as Record<string, unknown>

      const row: SignalMessageRow = {
        id: (parsed.id as string) ?? crypto.randomUUID(),
        sender_id: parsed.senderId as string,
        recipient_id: parsed.recipientId as string,
        sender_device_id: (parsed.senderDeviceId as string) ?? null,
        recipient_device_id: (parsed.recipientDeviceId as string) ?? null,
        group_id: (parsed.groupId as string) ?? null,
        origin_id: (parsed.originId as string) ?? null,
        message_type: parsed.messageType as SignalMessageRow['message_type'],
        payload: parsed.payload as Record<string, unknown>,
        created_at: (parsed.createdAt as string) ?? new Date().toISOString(),
        read_at: null,
        deleted_at: null,
      }

      this.receivedBuffer.push(row)
      this.onReceive?.(row)
      logger.info(`Buffered received message ${row.id.substring(0, 8)}…`)
    } catch (e) {
      logger.warn('Failed to decode received LoRa frame:', e)
    }
  }

  // ---- Internal ----

  /** Resolve a Supabase user UUID to its 8-byte short ID hex string. */
  private async resolveShortId(userId: string): Promise<string> {
    let cached = this.shortIdCache.get(userId)
    if (cached) return cached

    const shortId = await userIdToShortId(userId)
    cached = shortIdToHex(shortId)
    this.shortIdCache.set(userId, cached)
    return cached
  }
}
