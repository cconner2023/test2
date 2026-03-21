/**
 * Encrypted outbound message queue (IndexedDB).
 *
 * Stores messages that couldn't be sent due to network failure.
 * Payload is encrypted at rest using encryptString/decryptString
 * from secureStorage (same AES-GCM key as messageStore).
 *
 * Database: adtmc-outbound-queue
 * Store: queue (keyed by message id)
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../../Utilities/Logger'
import { createIdbSingleton } from '../idbFactory'
import { encryptString, decryptString } from '../secureStorage'
import type { SendMessageParams, SendBatchParams } from './transport'

const logger = createLogger('OutboundQueue')

// ---- Stored Shape ----

export interface OutboundQueueEntry {
  id: string              // crypto.randomUUID() — client-generated
  senderId?: string       // optional (used only for notification skip check)
  recipientId: string
  senderDeviceId: string | null
  recipientDeviceId: string | null
  groupId: string | null  // set for group messages
  messageType: 'initial' | 'message' | 'request' | 'request-accepted' | 'sync' | 'delete'
  payload: string         // encrypted via encryptString()
  createdAt: string       // ISO timestamp
  status: 'pending' | 'sending' | 'failed'
  retryCount: number
  batchId: string | null  // groups fan-out entries
  silent?: boolean        // suppress push notification on flush (e.g. calendar events)
}

// ---- Database Schema ----

interface OutboundQueueDB extends DBSchema {
  queue: {
    key: string // entry id
    value: OutboundQueueEntry
    indexes: {
      'by-status': string
    }
  }
}

const DB_NAME = 'adtmc-outbound-queue'
const DB_VERSION = 1

const { getDb, destroy: destroyQueueDb } = createIdbSingleton<OutboundQueueDB>(
  DB_NAME,
  DB_VERSION,
  {
    upgrade(db) {
      const store = db.createObjectStore('queue', { keyPath: 'id' })
      store.createIndex('by-status', 'status')
    },
  },
)

// ---- Enqueue ----

/** Queue a single message for offline delivery. */
export async function enqueue(params: SendMessageParams): Promise<void> {
  try {
    const encPayload = await encryptString(JSON.stringify(params.payload))

    const entry: OutboundQueueEntry = {
      id: params.id,
      senderId: params.senderId,
      recipientId: params.recipientId,
      senderDeviceId: params.senderDeviceId ?? null,
      recipientDeviceId: params.recipientDeviceId ?? null,
      groupId: params.groupId ?? null,
      messageType: params.messageType,
      payload: encPayload,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
      batchId: null,
      silent: params.silent,
    }

    const db = await getDb()
    await db.put('queue', entry)
    logger.info(`Enqueued message ${params.id}`)
  } catch (e) {
    logger.warn('Failed to enqueue message:', e)
  }
}

/** Queue a batch of fan-out messages for offline delivery. */
export async function enqueueBatch(params: SendBatchParams): Promise<void> {
  try {
    const batchId = crypto.randomUUID()
    const db = await getDb()
    const tx = db.transaction('queue', 'readwrite')

    for (const m of params.messages) {
      const encPayload = await encryptString(JSON.stringify(m.payload))
      const entry: OutboundQueueEntry = {
        id: m.id,
        senderId: params.senderId,
        recipientId: params.recipientId,
        senderDeviceId: params.senderDeviceId,
        recipientDeviceId: m.recipientDeviceId,
        groupId: params.groupId ?? null,
        messageType: m.messageType,
        payload: encPayload,
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
        batchId,
        silent: params.silent,
      }
      tx.store.put(entry)
    }

    await tx.done
    logger.info(`Enqueued batch of ${params.messages.length} messages (batchId=${batchId})`)
  } catch (e) {
    logger.warn('Failed to enqueue batch:', e)
  }
}

// ---- Dequeue ----

/** Read all pending entries, decrypt payloads, and return as SendMessageParams. */
export async function dequeueAll(): Promise<SendMessageParams[]> {
  try {
    const db = await getDb()
    const entries = await db.getAllFromIndex('queue', 'by-status', 'pending')

    const result: SendMessageParams[] = []
    for (const entry of entries) {
      try {
        const decrypted = await decryptString(entry.payload)
        const payload = JSON.parse(decrypted) as Record<string, unknown>
        result.push({
          id: entry.id,
          senderId: entry.senderId,
          recipientId: entry.recipientId,
          senderDeviceId: entry.senderDeviceId ?? undefined,
          recipientDeviceId: entry.recipientDeviceId ?? undefined,
          groupId: entry.groupId ?? undefined,
          messageType: entry.messageType,
          payload,
          silent: entry.silent,
        })
      } catch {
        logger.warn(`Failed to decrypt queue entry ${entry.id} — skipping`)
      }
    }

    return result
  } catch (e) {
    logger.warn('Failed to dequeue messages:', e)
    return []
  }
}

// ---- Status Updates ----

/** Mark entries as sent (removes them from the queue). */
export async function markSent(ids: string[]): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('queue', 'readwrite')
    await Promise.all(ids.map(id => tx.store.delete(id)))
    await tx.done
    logger.info(`Removed ${ids.length} sent entries from queue`)
  } catch (e) {
    logger.warn('Failed to mark entries as sent:', e)
  }
}

/** Mark entries as failed and increment retry count. */
export async function markFailed(ids: string[]): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('queue', 'readwrite')

    for (const id of ids) {
      const entry = await tx.store.get(id)
      if (entry) {
        entry.status = 'failed'
        entry.retryCount += 1
        // Reset to pending so the next flush attempt picks it up
        // (unless retry count is too high)
        if (entry.retryCount < 10) {
          entry.status = 'pending'
        }
        tx.store.put(entry)
      }
    }

    await tx.done
  } catch (e) {
    logger.warn('Failed to mark entries as failed:', e)
  }
}

// ---- Cleanup ----

/** Wipe all queued messages. Called on sign-out. */
export async function clearOutboundQueue(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('queue')
    logger.info('Cleared outbound queue')
  } catch (e) {
    logger.warn('Failed to clear outbound queue:', e)
  }
}

/**
 * Aggressively destroy the entire outbound queue database.
 * Closes the connection, deletes the DB, and resets module state.
 */
export async function destroyOutboundQueue(): Promise<void> {
  logger.info('Destroyed outbound queue database')
  await destroyQueueDb()
}
