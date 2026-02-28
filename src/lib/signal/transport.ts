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
  senderId: string
  recipientId: string
  senderDeviceId?: string
  recipientDeviceId?: string
  messageType: 'initial' | 'message' | 'request' | 'request-accepted'
  payload: Record<string, unknown>
}

export interface SendBatchParams {
  senderId: string
  senderDeviceId: string
  recipientId: string
  messages: Array<{ id: string } & FanOutMessageInput>
}

export interface SignalTransport {
  name: string
  sendMessage(params: SendMessageParams): Promise<Result<string>>
  sendMessageBatch(params: SendBatchParams): Promise<Result<string[]>>
  fetchUnread(userId: string, deviceId?: string): Promise<Result<SignalMessageRow[]>>
  markRead(messageIds: string[]): Promise<Result<void>>
  deleteMessages(messageIds: string[]): Promise<Result<void>>
  fetchConversation(userId: string, peerId: string, limit?: number): Promise<Result<SignalMessageRow[]>>
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

  /** Send a message. Falls back to offline queue on network failure. */
  async send(params: SendMessageParams): Promise<Result<string>> {
    if (!this.primary) return err('No transport configured')

    try {
      const result = await this.primary.sendMessage(params)
      if (result.ok) return result

      // Check if it's a network error (not a server-side rejection)
      if (this.isNetworkError(result.error)) {
        await this.queueMessage(params)
        return ok(params.id) // optimistic return
      }

      return result
    } catch (e) {
      // Exception = likely network failure
      await this.queueMessage(params)
      return ok(params.id)
    }
  }

  /** Send a batch of messages. Falls back to offline queue on network failure. */
  async sendBatch(params: SendBatchParams): Promise<Result<string[]>> {
    if (!this.primary) return err('No transport configured')

    try {
      const result = await this.primary.sendMessageBatch(params)
      if (result.ok) return result

      if (this.isNetworkError(result.error)) {
        await this.queueBatch(params)
        return ok(params.messages.map(m => m.id))
      }

      return result
    } catch (e) {
      await this.queueBatch(params)
      return ok(params.messages.map(m => m.id))
    }
  }

  async fetchUnread(userId: string, deviceId?: string): Promise<Result<SignalMessageRow[]>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.fetchUnread(userId, deviceId)
  }

  async markRead(messageIds: string[]): Promise<Result<void>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.markRead(messageIds)
  }

  async deleteMessages(messageIds: string[]): Promise<Result<void>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.deleteMessages(messageIds)
  }

  async fetchConversation(userId: string, peerId: string, limit?: number): Promise<Result<SignalMessageRow[]>> {
    if (!this.primary) return err('No transport configured')
    return this.primary.fetchConversation(userId, peerId, limit)
  }

  /** Flush the offline queue through the primary transport. */
  async flush(): Promise<number> {
    if (!this.primary || !this.dequeueFn || !this.markSentFn || !this.markFailedFn) return 0
    if (!navigator.onLine) return 0

    try {
      const queued = await this.dequeueFn()
      if (queued.length === 0) return 0

      logger.info(`Flushing ${queued.length} queued messages`)

      const sentIds: string[] = []
      const failedIds: string[] = []

      for (const entry of queued) {
        const result = await this.primary.sendMessage(entry)
        if (result.ok) {
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
