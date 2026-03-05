/**
 * Transport adapter abstraction for Signal Protocol messaging.
 *
 * Defines the SignalTransport interface that any transport backend must
 * implement, and the TransportManager that orchestrates primary transport
 * with offline queue fallback.
 */

import { ok, err, type Result } from '../result'
import { createLogger } from '../../Utilities/Logger'
import type { SignalMessageRow, FanOutMessageInput } from './transportTypes'

const logger = createLogger('TransportManager')

// ---- Transport Interface ----

export interface SendMessageParams {
  id: string               // client-generated UUID
  senderId?: string        // optional (used only for notification skip check)
  recipientId: string
  senderDeviceId?: string
  recipientDeviceId?: string
  messageType: 'initial' | 'message' | 'request' | 'request-accepted' | 'sync' | 'delete'
  payload: Record<string, unknown>
  groupId?: string         // set for group messages
  originId?: string        // shared UUID for delete-for-everyone
}

export interface SendBatchParams {
  senderId?: string        // optional (used only for notification skip check)
  senderDeviceId: string
  recipientId: string
  messages: Array<{ id: string } & FanOutMessageInput>
  groupId?: string         // set for group messages
  originId?: string        // shared UUID for delete-for-everyone
}

export interface SignalTransport {
  name: string
  sendMessage(params: SendMessageParams): Promise<Result<string>>
  sendMessageBatch(params: SendBatchParams): Promise<Result<string[]>>
  fetchUnread(userId: string, deviceId?: string): Promise<Result<SignalMessageRow[]>>
  markRead(messageIds: string[]): Promise<Result<void>>
  deleteMessages(messageIds: string[]): Promise<Result<void>>
  hardDeleteByOriginId(originIds: string[]): Promise<Result<void>>
  fetchConversation(userId: string, peerId: string, limit?: number): Promise<Result<SignalMessageRow[]>>
  fetchGroupConversation(groupId: string, limit?: number): Promise<Result<SignalMessageRow[]>>
  isAvailable(): boolean
}

// ---- Transport Manager ----

/**
 * Orchestrates message sending through a primary transport.
 * On network failure, queues messages for later delivery via
 * the outbound queue (offline support).
 */
export class TransportManager {
  private primary: SignalTransport | null = null
  private secondary: SignalTransport | null = null
  private onlineHandler: (() => void) | null = null

  // Lazy imports to avoid circular deps — set by signalService on init
  private enqueueFn: ((entry: SendMessageParams) => Promise<void>) | null = null
  private enqueueBatchFn: ((params: SendBatchParams) => Promise<void>) | null = null
  private dequeueFn: (() => Promise<SendMessageParams[]>) | null = null
  private markSentFn: ((ids: string[]) => Promise<void>) | null = null
  private markFailedFn: ((ids: string[]) => Promise<void>) | null = null

  setPrimary(transport: SignalTransport): void {
    this.primary = transport
    logger.info(`Primary transport set: ${transport.name}`)
  }

  /** Register a secondary (fallback) transport, e.g. LoRa mesh. */
  setSecondary(transport: SignalTransport): void {
    this.secondary = transport
    logger.info(`Secondary transport set: ${transport.name}`)
  }

  /** Wire up the outbound queue functions (called once from signalService). */
  setQueue(fns: {
    enqueue: (entry: SendMessageParams) => Promise<void>
    enqueueBatch: (params: SendBatchParams) => Promise<void>
    dequeueAll: () => Promise<SendMessageParams[]>
    markSent: (ids: string[]) => Promise<void>
    markFailed: (ids: string[]) => Promise<void>
  }): void {
    this.enqueueFn = fns.enqueue
    this.enqueueBatchFn = fns.enqueueBatch
    this.dequeueFn = fns.dequeueAll
    this.markSentFn = fns.markSent
    this.markFailedFn = fns.markFailed

    // Listen for connectivity restoration
    if (typeof window !== 'undefined' && !this.onlineHandler) {
      this.onlineHandler = () => { this.flush().catch(() => {}) }
      window.addEventListener('online', this.onlineHandler)
    }
  }

  /** Send a message. Tries secondary transport on network failure before queuing. */
  async send(params: SendMessageParams): Promise<Result<string>> {
    if (!this.primary) return err('No transport configured')

    try {
      const result = await this.primary.sendMessage(params)
      if (result.ok) return result

      // Check if it's a network error (not a server-side rejection)
      if (this.isNetworkError(result.error)) {
        return this.fallbackOrQueue(params)
      }

      return result
    } catch (e) {
      // Exception = likely network failure
      return this.fallbackOrQueue(params)
    }
  }

  /** Send a batch of messages. Tries secondary on network failure before queuing. */
  async sendBatch(params: SendBatchParams): Promise<Result<string[]>> {
    if (!this.primary) return err('No transport configured')

    try {
      const result = await this.primary.sendMessageBatch(params)
      if (result.ok) return result

      if (this.isNetworkError(result.error)) {
        return this.fallbackBatchOrQueue(params)
      }

      return result
    } catch (e) {
      return this.fallbackBatchOrQueue(params)
    }
  }

  async fetchUnread(userId: string, deviceId?: string): Promise<Result<SignalMessageRow[]>> {
    if (!this.primary) return err('No transport configured')

    const primaryResult = await this.primary.fetchUnread(userId, deviceId)
    if (!primaryResult.ok) return primaryResult

    // Merge secondary transport buffer (e.g. LoRa-received messages)
    if (this.secondary?.isAvailable()) {
      try {
        const secResult = await this.secondary.fetchUnread(userId, deviceId)
        if (secResult.ok && secResult.data.length > 0) {
          // Deduplicate by message ID
          const seen = new Set(primaryResult.data.map(m => m.id))
          const merged = [...primaryResult.data]
          for (const row of secResult.data) {
            if (!seen.has(row.id)) {
              merged.push(row)
              seen.add(row.id)
            }
          }
          return ok(merged)
        }
      } catch {
        // Secondary fetch failed — return primary results only
      }
    }

    return primaryResult
  }

  async markRead(messageIds: string[]): Promise<Result<void>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.markRead(messageIds)
  }

  async deleteMessages(messageIds: string[]): Promise<Result<void>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.deleteMessages(messageIds)
  }

  async hardDeleteByOriginId(originIds: string[]): Promise<Result<void>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.hardDeleteByOriginId(originIds)
  }

  async fetchConversation(userId: string, peerId: string, limit?: number): Promise<Result<SignalMessageRow[]>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.fetchConversation(userId, peerId, limit)
  }

  async fetchGroupConversation(groupId: string, limit?: number): Promise<Result<SignalMessageRow[]>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.fetchGroupConversation(groupId, limit)
  }

  /** Flush the offline queue through primary (or secondary if primary is down). */
  async flush(): Promise<number> {
    if (!this.primary || !this.dequeueFn || !this.markSentFn || !this.markFailedFn) return 0

    // Allow flush via secondary even when offline (e.g. LoRa mesh is up)
    const primaryUp = navigator.onLine
    const secondaryUp = this.secondary?.isAvailable() ?? false
    if (!primaryUp && !secondaryUp) return 0

    try {
      const queued = await this.dequeueFn()
      if (queued.length === 0) return 0

      logger.info(`Flushing ${queued.length} queued messages`)

      const sentIds: string[] = []
      const failedIds: string[] = []

      for (const entry of queued) {
        // Try primary first if online
        let sent = false
        if (primaryUp) {
          const result = await this.primary.sendMessage(entry)
          if (result.ok) sent = true
        }
        // Fall back to secondary
        if (!sent && secondaryUp && this.secondary) {
          const result = await this.secondary.sendMessage(entry)
          if (result.ok) sent = true
        }

        if (sent) {
          sentIds.push(entry.id)
        } else {
          failedIds.push(entry.id)
        }
      }

      if (sentIds.length > 0) await this.markSentFn(sentIds)
      if (failedIds.length > 0) await this.markFailedFn(failedIds)

      logger.info(`Flush complete: ${sentIds.length} sent, ${failedIds.length} failed`)
      return sentIds.length
    } catch (e) {
      logger.warn('Queue flush failed:', e)
      return 0
    }
  }

  /** Notify the service worker that the queue has new entries. */
  private notifySw(): void {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({ type: 'QUEUE_UPDATED' })
      }).catch(() => {})
    }
  }

  /** Try secondary transport, then fall back to offline queue. */
  private async fallbackOrQueue(params: SendMessageParams): Promise<Result<string>> {
    if (this.secondary?.isAvailable()) {
      try {
        const secResult = await this.secondary.sendMessage(params)
        if (secResult.ok) {
          logger.info(`Sent via secondary transport (${this.secondary.name})`)
          return secResult
        }
      } catch { /* fall through to queue */ }
    }
    await this.queueMessage(params)
    return ok(params.id)
  }

  /** Try secondary transport for batch, then fall back to offline queue. */
  private async fallbackBatchOrQueue(params: SendBatchParams): Promise<Result<string[]>> {
    if (this.secondary?.isAvailable()) {
      try {
        const secResult = await this.secondary.sendMessageBatch(params)
        if (secResult.ok) {
          logger.info(`Batch sent via secondary transport (${this.secondary.name})`)
          return secResult
        }
      } catch { /* fall through to queue */ }
    }
    await this.queueBatch(params)
    return ok(params.messages.map(m => m.id))
  }

  private async queueMessage(params: SendMessageParams): Promise<void> {
    if (!this.enqueueFn) {
      logger.warn('No queue configured — message will be lost')
      return
    }
    await this.enqueueFn(params)
    logger.info(`Queued message ${params.id} for offline delivery`)
    this.notifySw()
  }

  private async queueBatch(params: SendBatchParams): Promise<void> {
    if (!this.enqueueBatchFn) {
      logger.warn('No queue configured — batch will be lost')
      return
    }
    await this.enqueueBatchFn(params)
    logger.info(`Queued batch of ${params.messages.length} messages for offline delivery`)
    this.notifySw()
  }

  private isNetworkError(error: string): boolean {
    const lower = error.toLowerCase()
    return (
      lower.includes('fetch') ||
      lower.includes('network') ||
      lower.includes('failed to fetch') ||
      lower.includes('load failed') ||
      lower.includes('offline') ||
      lower.includes('timeout') ||
      !navigator.onLine
    )
  }

  destroy(): void {
    if (this.onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler)
      this.onlineHandler = null
    }
  }
}
