/**
 * IndexedDB persistence for decrypted Signal Protocol messages.
 *
 * Separate database from signal key store (adtmc-signal-store) and other
 * app databases to isolate message lifecycle and allow independent versioning.
 *
 * Database: adtmc-message-store
 * Stores:
 *   messages              - Decrypted messages keyed by message id
 *     Indexes:
 *       by-peer       - peerId (for loading a conversation)
 *       by-peer-time  - [peerId, createdAt] compound (sorted retrieval)
 *   conversationTombstones - { conversationKey, deletedAt } — coarse deletion guard
 *   originTombstones       - { originId, deletedAt }       — fine per-message guard
 *
 * Delete-propagation invariant:
 *   originId is the canonical identity for delete propagation. All protocol
 *   deletes flow through deleteMessagesByOriginId, which atomically writes an
 *   originTombstone AND removes the row. saveMessage checks BOTH tombstone
 *   stores, so any later resurrection vector (realtime echo, vault drain,
 *   backup restore on a new device) drops the row silently. Both tombstone
 *   stores ride in the encrypted backup, so device rebirths inherit the
 *   deletion log along with history.
 *
 * Follows the same patterns as keyStore.ts:
 * - Singleton IDB instance
 * - Graceful error handling (try/catch, logger.warn, return defaults)
 * - idb library
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../../Utilities/Logger'
import { createIdbSingleton } from '../idbFactory'
import { encryptString, decryptString } from '../secureStorage'
import type { DecryptedSignalMessage } from './transportTypes'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

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
  conversationTombstones: {
    key: string // conversationKey
    value: {
      conversationKey: string
      deletedAt: string // ISO 8601
    }
  }
  originTombstones: {
    key: string // originId
    value: {
      originId: string
      deletedAt: string // ISO 8601
    }
  }
  peerProfiles: {
    key: string // userId
    value: ClinicMedic
  }
}

const MESSAGE_DB_NAME = 'adtmc-message-store'
const MESSAGE_DB_VERSION = 5

const { getDb, destroy: destroyMessageDb } = createIdbSingleton<MessageDB>(
  MESSAGE_DB_NAME,
  MESSAGE_DB_VERSION,
  {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 2) {
        const store = db.objectStoreNames.contains('messages')
          ? transaction.objectStore('messages')
          : db.createObjectStore('messages', { keyPath: 'id' })
        if (!store.indexNames.contains('by-peer')) {
          store.createIndex('by-peer', 'peerId')
        }
        if (!store.indexNames.contains('by-peer-time')) {
          store.createIndex('by-peer-time', ['peerId', 'createdAt'])
        }
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('conversationTombstones')) {
          db.createObjectStore('conversationTombstones', { keyPath: 'conversationKey' })
        }
      }
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('originTombstones')) {
          db.createObjectStore('originTombstones', { keyPath: 'originId' })
        }
      }
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('peerProfiles')) {
          db.createObjectStore('peerProfiles', { keyPath: 'id' })
        }
      }
    },
  },
)

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

/** Register a callback invoked after every message save (e.g. to schedule backup).
 *  Pass null to detach (e.g. on sign-out). */
export function setOnMessageSaved(cb: ((localUserId: string) => void) | null): void {
  _onMessageSaved = cb
}

// ---- Tombstone CRUD ----

/** Persist a conversation tombstone (conversationKey → deletedAt). */
export async function saveTombstone(conversationKey: string, deletedAt: string): Promise<void> {
  try {
    const db = await getDb()
    await db.put('conversationTombstones', { conversationKey, deletedAt })
  } catch (err) {
    logger.warn('Failed to save tombstone:', err)
  }
}

/** Get the deletedAt timestamp for a conversation, or null if no tombstone. */
export async function getTombstone(conversationKey: string): Promise<string | null> {
  try {
    const db = await getDb()
    const row = await db.get('conversationTombstones', conversationKey)
    return row?.deletedAt ?? null
  } catch (err) {
    logger.warn('Failed to get tombstone:', err)
    return null
  }
}

/** Load all tombstones as a map of conversationKey → deletedAt. */
export async function getAllTombstones(): Promise<Record<string, string>> {
  try {
    const db = await getDb()
    const all = await db.getAll('conversationTombstones')
    const result: Record<string, string> = {}
    for (const row of all) {
      result[row.conversationKey] = row.deletedAt
    }
    return result
  } catch (err) {
    logger.warn('Failed to load tombstones:', err)
    return {}
  }
}

/** Remove a tombstone (called when a genuinely new post-deletion message clears it). */
export async function deleteTombstone(conversationKey: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('conversationTombstones', conversationKey)
  } catch (err) {
    logger.warn('Failed to delete tombstone:', err)
  }
}

/** Delete tombstones older than 30 days (both conversation + origin stores). */
export async function cleanExpiredTombstones(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  try {
    const db = await getDb()
    const convoAll = await db.getAll('conversationTombstones')
    const convoTx = db.transaction('conversationTombstones', 'readwrite')
    await Promise.all(
      convoAll
        .filter(row => row.deletedAt < cutoff)
        .map(row => convoTx.store.delete(row.conversationKey)),
    )
    await convoTx.done
  } catch (err) {
    logger.warn('Failed to clean expired conversation tombstones:', err)
  }
  try {
    const db = await getDb()
    const originAll = await db.getAll('originTombstones')
    const originTx = db.transaction('originTombstones', 'readwrite')
    await Promise.all(
      originAll
        .filter(row => row.deletedAt < cutoff)
        .map(row => originTx.store.delete(row.originId)),
    )
    await originTx.done
  } catch (err) {
    logger.warn('Failed to clean expired origin tombstones:', err)
  }
}

// ---- Origin tombstone CRUD (per-message delete identity) ----

/** Persist origin tombstones for one or more deleted messages. */
export async function saveOriginTombstones(originIds: string[], deletedAt: string): Promise<void> {
  if (originIds.length === 0) return
  try {
    const db = await getDb()
    const tx = db.transaction('originTombstones', 'readwrite')
    await Promise.all(originIds.map(originId => tx.store.put({ originId, deletedAt })))
    await tx.done
  } catch (err) {
    logger.warn('Failed to save origin tombstones:', err)
  }
}

/** Look up an origin tombstone, or null if the originId has not been deleted. */
export async function getOriginTombstone(originId: string): Promise<string | null> {
  try {
    const db = await getDb()
    const row = await db.get('originTombstones', originId)
    return row?.deletedAt ?? null
  } catch (err) {
    logger.warn('Failed to get origin tombstone:', err)
    return null
  }
}

/** Load all origin tombstones as a map of originId → deletedAt. */
export async function getAllOriginTombstones(): Promise<Record<string, string>> {
  try {
    const db = await getDb()
    const all = await db.getAll('originTombstones')
    const result: Record<string, string> = {}
    for (const row of all) {
      result[row.originId] = row.deletedAt
    }
    return result
  } catch (err) {
    logger.warn('Failed to load origin tombstones:', err)
    return {}
  }
}

// ---- Save ----

/** Persist a single decrypted message to IndexedDB.
 *  Checks tombstone store first — skips messages created before the tombstone.
 *  Always preserves a locally-set readAt when the incoming copy has none —
 *  prevents a stale server row (markRead not yet acked) or backup from
 *  resurfacing already-read messages. */
export async function saveMessage(
  msg: DecryptedSignalMessage,
  localUserId: string,
  _options?: { preserveReadAt?: boolean }
): Promise<void> {
  try {
    const peerId = msg.groupId ?? (msg.senderId === localUserId ? msg.recipientId : msg.senderId)

    // Tombstone guards — see invariant block at file head.
    // (1) Conversation tombstone: skip messages that predate a conversation deletion.
    const tombstone = await getTombstone(peerId)
    if (tombstone && msg.createdAt < tombstone) {
      return
    }
    // (2) Origin tombstone: skip any message whose originId has been deleted.
    // Catches realtime echoes, vault drains, and backup restores on new devices.
    if (msg.originId) {
      const originTombstone = await getOriginTombstone(msg.originId)
      if (originTombstone) {
        return
      }
    }

    let stored: StoredMessage = { ...msg, peerId }
    const db = await getDb()

    if (!stored.readAt) {
      const existing = await db.get('messages', stored.id)
      if (existing?.readAt) {
        stored = { ...stored, readAt: existing.readAt }
      }
    }

    const encrypted = await encryptMessage(stored)
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

    // Sort each conversation oldest-first and deduplicate by originId.
    // Backup restore can introduce rows from another device that share the
    // same originId as this device's own row, producing visual duplicates.
    for (const peer of Object.keys(grouped)) {
      grouped[peer].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      const seenOrigins = new Set<string>()
      grouped[peer] = grouped[peer].filter(msg => {
        if (msg.originId) {
          if (seenOrigins.has(msg.originId)) return false
          seenOrigins.add(msg.originId)
        }
        return true
      })
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
      if (
        msg.senderId !== localUserId &&
        !msg.readAt &&
        msg.messageType !== 'request-accepted'
      ) {
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

/** Update the delivery status of stored messages. */
export async function updateMessageStatus(
  messageIds: string[],
  status: 'sending' | 'sent' | 'delivered',
): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('messages', 'readwrite')
    await Promise.all(
      messageIds.map(async (id) => {
        const msg = await tx.store.get(id)
        if (msg) {
          msg.status = status
          await tx.store.put(msg)
        }
      }),
    )
    await tx.done
  } catch (err) {
    logger.warn('Failed to update message status:', err)
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

/** Delete messages by originId AND record an origin tombstone in one atomic
 *  transaction (cross-device/peer delete sync). The tombstone is what makes
 *  the delete survive backup restores and vault drains on new devices — see
 *  the invariant block at the top of this file. */
export async function deleteMessagesByOriginId(
  originIds: string[],
  deletedAt: string = new Date().toISOString(),
): Promise<void> {
  if (originIds.length === 0) return
  try {
    const db = await getDb()
    const tx = db.transaction(['messages', 'originTombstones'], 'readwrite')
    const originSet = new Set(originIds)

    // Tombstone first (writes are idempotent — re-deletes just refresh deletedAt).
    await Promise.all(
      originIds.map(originId => tx.objectStore('originTombstones').put({ originId, deletedAt })),
    )

    // Then sweep matching rows from `messages`.
    const messagesStore = tx.objectStore('messages')
    let cursor = await messagesStore.openCursor()
    while (cursor) {
      if (cursor.value.originId && originSet.has(cursor.value.originId)) {
        await cursor.delete()
      }
      cursor = await cursor.continue()
    }

    await tx.done
  } catch (err) {
    logger.warn('Failed to delete messages by originId:', err)
  }
}

/** Delete all messages for a conversation (by peerId / groupId) AND record a
 *  per-origin tombstone for each in the same transaction. The origin tombstone
 *  is the canonical delete identity — it is what makes a conversation delete
 *  survive backup restores, vault drains, and realtime echoes (see the
 *  invariant block at the top of this file). The coarse conversation tombstone
 *  alone is NOT durable: addMessage's clear-on-newer logic drops it the moment
 *  any message with createdAt >= deletedAt arrives, so a conversation-delete
 *  that only wrote the conversation tombstone would resurrect. Mirrors
 *  deleteMessagesByOriginId. Returns the origins tombstoned so the store can
 *  mirror them into in-memory state for same-session suppression. */
export async function deleteConversation(
  conversationKey: string,
  deletedAt: string = new Date().toISOString(),
): Promise<string[]> {
  try {
    const db = await getDb()
    const tx = db.transaction(['messages', 'originTombstones'], 'readwrite')
    const messagesStore = tx.objectStore('messages')
    const originStore = tx.objectStore('originTombstones')
    const index = messagesStore.index('by-peer')
    const purgedOrigins: string[] = []
    let cursor = await index.openCursor(conversationKey)
    while (cursor) {
      const originId = cursor.value.originId
      if (originId) {
        await originStore.put({ originId, deletedAt })
        purgedOrigins.push(originId)
      }
      await cursor.delete()
      cursor = await cursor.continue()
    }
    await tx.done
    return purgedOrigins
  } catch (err) {
    logger.warn(`Failed to delete conversation ${conversationKey}:`, err)
    return []
  }
}

// ---- Peer profiles CRUD ----
// Persistent cache of every user we've talked to — cluster-agnostic.
// Populated by (1) email-lookup success, (2) inbound envelope from an unknown
// sender (one-shot resolve via fetch_profiles_by_ids). Replaces the older
// `extraMedics` ephemeral state + `useOrphanedProfiles` per-render fetch.
// Result: cluster vs email-lookup peers are indistinguishable for name resolution.

export async function savePeerProfile(profile: ClinicMedic): Promise<void> {
  try {
    const db = await getDb()
    await db.put('peerProfiles', profile)
  } catch (err) {
    logger.warn('Failed to save peer profile:', err)
  }
}

export async function loadAllPeerProfiles(): Promise<ClinicMedic[]> {
  try {
    const db = await getDb()
    return await db.getAll('peerProfiles')
  } catch (err) {
    logger.warn('Failed to load peer profiles:', err)
    return []
  }
}

export async function clearPeerProfiles(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('peerProfiles')
  } catch (err) {
    logger.warn('Failed to clear peer profiles:', err)
  }
}

export async function deletePeerProfile(peerId: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('peerProfiles', peerId)
  } catch (err) {
    logger.warn('Failed to delete peer profile:', err)
  }
}

// ---- Cleanup ----

/** Wipe all stored messages. Called on sign-out (linked-device path).
 *  Also clears peerProfiles + both tombstone stores so a subsequent sign-in
 *  on the same browser doesn't hydrate prior-account artifacts. Primary
 *  logout uses destroyMessageStore which drops the whole DB. */
export async function clearMessageStore(): Promise<void> {
  try {
    const db = await getDb()
    await Promise.all([
      db.clear('messages'),
      db.clear('peerProfiles'),
      db.clear('conversationTombstones'),
      db.clear('originTombstones'),
    ])
    logger.info('Cleared message store')
  } catch (err) {
    logger.warn('Failed to clear message store:', err)
  }
}

/**
 * Aggressively destroy the entire message store database.
 * Closes the connection, deletes the DB, and resets module state.
 */
export async function destroyMessageStore(): Promise<void> {
  _onMessageSaved = null
  logger.info('Destroyed message store database')
  await destroyMessageDb()
}
