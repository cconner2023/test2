/**
 * IndexedDB persistence for decrypted Signal Protocol messages.
 *
 * Separate database from signal key store (adtmc-signal-store) and other
 * app databases to isolate message lifecycle and allow independent versioning.
 *
 * Database: adtmc-message-store
 * Stores:
 *   messages - Decrypted messages keyed by message id
 *     Indexes:
 *       by-peer       - peerId (for loading a conversation)
 *       by-peer-time  - [peerId, createdAt] compound (sorted retrieval)
 *
 * Follows the same patterns as keyStore.ts:
 * - Singleton IDB instance
 * - Graceful error handling (try/catch, logger.warn, return defaults)
 * - idb library
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createLogger } from '../../Utilities/Logger'
import { encryptString, decryptString } from '../secureStorage'
import type { DecryptedSignalMessage } from './transportTypes'

const logger = createLogger('MessageStore')

// ---- Stored shape ----

export interface StoredMessage extends DecryptedSignalMessage {
  /** The other user in the conversation (computed on save). */
  peerId: string
}

// ---- Database Schema ----

interface MessageDB extends DBSchema {
  messages: {
    key: string // message id
    value: StoredMessage
    indexes: {
      'by-peer': string
      'by-peer-time': [string, string]
    }
  }
}

const MESSAGE_DB_NAME = 'adtmc-message-store'
const MESSAGE_DB_VERSION = 2

let dbInstance: IDBPDatabase<MessageDB> | null = null

async function getDb(): Promise<IDBPDatabase<MessageDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<MessageDB>(MESSAGE_DB_NAME, MESSAGE_DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('messages', { keyPath: 'id' })
      store.createIndex('by-peer', 'peerId')
      store.createIndex('by-peer-time', ['peerId', 'createdAt'])
    },
  })

  return dbInstance
}

// ---- At-rest encryption helpers ----

/** Encrypt sensitive fields before writing to IndexedDB. */
async function encryptMessage(msg: StoredMessage): Promise<StoredMessage> {
  const encrypted = { ...msg }
  if (encrypted.plaintext) {
    encrypted.plaintext = await encryptString(encrypted.plaintext)
  }
  if (encrypted.content) {
    // Store encrypted content as a string (type-punned via cast)
    ;(encrypted as Record<string, unknown>).content =
      await encryptString(JSON.stringify(encrypted.content))
  }
  return encrypted
}

/** Decrypt sensitive fields after reading from IndexedDB.
 *  Handles legacy plaintext messages transparently. */
async function decryptMessage(msg: StoredMessage): Promise<StoredMessage> {
  const decrypted = { ...msg }
  if (decrypted.plaintext) {
    decrypted.plaintext = await decryptString(decrypted.plaintext)
  }
  if (decrypted.content) {
    // content may be an encrypted string stored as the plaintext field, or a plain object
    const raw = decrypted.content as unknown
    if (typeof raw === 'string') {
      try {
        decrypted.content = JSON.parse(await decryptString(raw))
      } catch { /* leave as-is */ }
    }
  }
  return decrypted
}

// ---- Save callback (used by backupService to schedule backups) ----

let _onMessageSaved: ((localUserId: string) => void) | null = null

/** Register a callback invoked after every message save (e.g. to schedule backup). */
export function setOnMessageSaved(cb: (localUserId: string) => void): void {
  _onMessageSaved = cb
}

// ---- Save ----

/** Persist a single decrypted message to IndexedDB. */
export async function saveMessage(
  msg: DecryptedSignalMessage,
  localUserId: string,
): Promise<void> {
  try {
    const peerId = msg.groupId ?? (msg.senderId === localUserId ? msg.recipientId : msg.senderId)
    const stored: StoredMessage = { ...msg, peerId }
    const encrypted = await encryptMessage(stored)
    const db = await getDb()
    await db.put('messages', encrypted)
    _onMessageSaved?.(localUserId)
  } catch (err) {
    logger.warn('Failed to save message:', err)
  }
}

// ---- Load ----

/** Load all messages for a peer, sorted oldest-first. */
export async function loadConversation(peerId: string): Promise<DecryptedSignalMessage[]> {
  try {
    const db = await getDb()
    const messages = await db.getAllFromIndex('messages', 'by-peer-time', IDBKeyRange.bound(
      [peerId, ''],
      [peerId, '\uffff'],
    ))
    return Promise.all(messages.map(decryptMessage))
  } catch (err) {
    logger.warn(`Failed to load conversation for ${peerId}:`, err)
    return []
  }
}

/** Load all messages grouped by peerId. */
export async function loadAllConversations(): Promise<Record<string, DecryptedSignalMessage[]>> {
  try {
    const db = await getDb()
    const all = await db.getAll('messages')
    const decrypted = await Promise.all(all.map(decryptMessage))
    const grouped: Record<string, DecryptedSignalMessage[]> = {}

    for (const msg of decrypted) {
      const peer = (msg as StoredMessage).peerId
      if (!grouped[peer]) grouped[peer] = []
      grouped[peer].push(msg)
    }

    // Sort each conversation oldest-first
    for (const peer of Object.keys(grouped)) {
      grouped[peer].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    }

    return grouped
  } catch (err) {
    logger.warn('Failed to load all conversations:', err)
    return {}
  }
}

/** Compute unread counts from stored messages. */
export async function loadUnreadCounts(
  localUserId: string,
): Promise<Record<string, number>> {
  try {
    const db = await getDb()
    const all = await db.getAll('messages')
    const counts: Record<string, number> = {}

    for (const msg of all) {
      if (msg.senderId !== localUserId && !msg.readAt) {
        counts[msg.peerId] = (counts[msg.peerId] ?? 0) + 1
      }
    }

    return counts
  } catch (err) {
    logger.warn('Failed to load unread counts:', err)
    return {}
  }
}

// ---- Update ----

/** Update readAt on stored messages. */
export async function updateReadAt(
  messageIds: string[],
  readAt: string,
): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('messages', 'readwrite')

    await Promise.all(
      messageIds.map(async (id) => {
        const msg = await tx.store.get(id)
        if (msg) {
          msg.readAt = readAt
          await tx.store.put(msg)
        }
      }),
    )

    await tx.done
  } catch (err) {
    logger.warn('Failed to update readAt:', err)
  }
}

/** Update the plaintext of a stored message (local-only edit). */
export async function updateMessageText(
  messageId: string,
  newText: string,
): Promise<void> {
  try {
    const db = await getDb()
    const msg = await db.get('messages', messageId)
    if (msg) {
      msg.plaintext = await encryptString(newText)
      await db.put('messages', msg)
    }
  } catch (err) {
    logger.warn('Failed to update message text:', err)
  }
}

/** Delete messages from IndexedDB by ID (local-only). */
export async function deleteMessages(messageIds: string[]): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('messages', 'readwrite')
    await Promise.all(messageIds.map(id => tx.store.delete(id)))
    await tx.done
  } catch (err) {
    logger.warn('Failed to delete messages:', err)
  }
}

// ---- Cleanup ----

/** Wipe all stored messages. Called on sign-out. */
export async function clearMessageStore(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('messages')
    logger.info('Cleared message store')
  } catch (err) {
    logger.warn('Failed to clear message store:', err)
  }
}
