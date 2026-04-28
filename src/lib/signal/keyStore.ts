/**
 * IndexedDB persistence for Signal Protocol key material.
 *
 * Separate database from the clinic key store (packagebackend-keystore)
 * to isolate Signal Protocol state and allow independent versioning.
 *
 * Database: adtmc-signal-store
 * Stores:
 *   localIdentity  - Our own identity key pairs (single record, key="self")
 *   preKeys        - One-time pre-key pairs (keyed by keyId)
 *   signedPreKeys  - Signed pre-key pairs (keyed by keyId)
 *   peerIdentities - Known peer identity public keys (keyed by userId)
 *
 * Follows the same patterns as cryptoService.ts:
 * - Singleton IDB instance
 * - Graceful error handling (try/catch, logger.warn, return null)
 * - Transactional batch writes
 */

import { type DBSchema } from 'idb'
import { createLogger } from '../../Utilities/Logger'
import { createIdbSingleton } from '../idbFactory'
import type {
  StoredLocalIdentity,
  StoredPreKey,
  StoredSignedPreKey,
  StoredPeerIdentity,
  StoredSession,
  SenderKeyState,
} from './types'

const logger = createLogger('SignalKeyStore')

// ---- Database Schema ----

interface SignalDB extends DBSchema {
  localIdentity: {
    key: string               // always "self"
    value: StoredLocalIdentity
  }
  preKeys: {
    key: number               // keyId
    value: StoredPreKey
  }
  signedPreKeys: {
    key: number               // keyId
    value: StoredSignedPreKey
  }
  peerIdentities: {
    key: string               // identityKey: `${userId}:${deviceId}`
    value: StoredPeerIdentity
  }
  sessions: {
    key: string               // sessionKey: `${peerId}:${peerDeviceId}`
    value: StoredSession
    indexes: { 'by-peerId': string }
  }
  senderKeys: {
    key: string               // senderKeyId: `${groupId}:${memberId}:${deviceId}`
    value: SenderKeyState
    indexes: {
      'by-groupId': string
      'by-memberId': string
    }
  }
  groupSecrets: {
    key: string               // groupId
    value: { groupId: string; secret: string /* base64 */ }
  }
}

const SIGNAL_DB_NAME = 'adtmc-signal-store'
const SIGNAL_DB_VERSION = 5
const LOCAL_IDENTITY_KEY = 'self'

export const { getDb, destroy: destroySignalDb } = createIdbSingleton<SignalDB>(
  SIGNAL_DB_NAME,
  SIGNAL_DB_VERSION,
  {
    upgrade(db, oldVersion, _newVersion, tx) {
      // v1: Core key stores
      if (oldVersion < 1) {
        db.createObjectStore('localIdentity')
        db.createObjectStore('preKeys')
        db.createObjectStore('signedPreKeys')
        db.createObjectStore('peerIdentities')
      }
      // v2: Session state for Double Ratchet
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions')
        }
      }
      // v3: Index sessions by peerId to avoid full-scan in loadSessionsForPeer
      if (oldVersion < 3) {
        const store = tx.objectStore('sessions')
        if (!store.indexNames.contains('by-peerId')) {
          store.createIndex('by-peerId', 'peerId')
        }
      }
      // v4: Sender keys for group messaging (one per group × member × device)
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('senderKeys')) {
          const senderKeyStore = db.createObjectStore('senderKeys')
          senderKeyStore.createIndex('by-groupId', 'groupId')
          senderKeyStore.createIndex('by-memberId', 'memberId')
        }
      }
      // v5: Group secrets for group name encryption
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('groupSecrets')) {
          db.createObjectStore('groupSecrets')
        }
      }
    },
  },
)

// ---- Local Identity ----

export async function loadLocalIdentity(): Promise<StoredLocalIdentity | null> {
  try {
    const db = await getDb()
    const identity = await db.get('localIdentity', LOCAL_IDENTITY_KEY)
    return identity ?? null
  } catch (err) {
    logger.warn('Failed to load local identity:', err)
    return null
  }
}

export async function saveLocalIdentity(identity: StoredLocalIdentity): Promise<void> {
  const db = await getDb()
  await db.put('localIdentity', identity, LOCAL_IDENTITY_KEY)
}

// ---- Pre-Keys ----

export async function loadPreKey(keyId: number): Promise<StoredPreKey | null> {
  try {
    const db = await getDb()
    const preKey = await db.get('preKeys', keyId)
    return preKey ?? null
  } catch (err) {
    logger.warn(`Failed to load pre-key ${keyId}:`, err)
    return null
  }
}

export async function savePreKeys(preKeys: StoredPreKey[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('preKeys', 'readwrite')
  await Promise.all([
    ...preKeys.map((pk) => tx.store.put(pk, pk.keyId)),
    tx.done,
  ])
}

export async function removePreKey(keyId: number): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('preKeys', keyId)
  } catch (err) {
    logger.warn(`Failed to remove pre-key ${keyId}:`, err)
  }
}

/**
 * Atomically load and remove a pre-key in a single IDB transaction.
 * Two concurrent callers with the same keyId will serialize on the
 * object-store transaction; the loser sees null and falls back to 3DH.
 * Without this, load+remove split across two transactions allows both
 * callers to read the key before either deletes it (double-consume race).
 */
export async function consumePreKeyAtomic(keyId: number): Promise<StoredPreKey | null> {
  try {
    const db = await getDb()
    const tx = db.transaction('preKeys', 'readwrite')
    const preKey = await tx.store.get(keyId)
    if (!preKey) {
      await tx.done
      return null
    }
    await tx.store.delete(keyId)
    await tx.done
    return preKey
  } catch (err) {
    logger.warn(`Failed to atomically consume pre-key ${keyId}:`, err)
    return null
  }
}

export async function getAllPreKeyIds(): Promise<number[]> {
  try {
    const db = await getDb()
    return await db.getAllKeys('preKeys')
  } catch (err) {
    logger.warn('Failed to get pre-key IDs:', err)
    return []
  }
}

// ---- Signed Pre-Keys ----

export async function loadSignedPreKey(keyId: number): Promise<StoredSignedPreKey | null> {
  try {
    const db = await getDb()
    const spk = await db.get('signedPreKeys', keyId)
    return spk ?? null
  } catch (err) {
    logger.warn(`Failed to load signed pre-key ${keyId}:`, err)
    return null
  }
}

export async function saveSignedPreKey(spk: StoredSignedPreKey): Promise<void> {
  const db = await getDb()
  await db.put('signedPreKeys', spk, spk.keyId)
}

export async function getLatestSignedPreKeyId(): Promise<number> {
  try {
    const db = await getDb()
    const keys = await db.getAllKeys('signedPreKeys')
    return keys.length > 0 ? Math.max(...keys) : 0
  } catch (err) {
    logger.warn('Failed to get latest signed pre-key ID:', err)
    return 0
  }
}

/** Load the latest signed pre-key (by highest keyId), or null if none exist. */
export async function loadLatestSignedPreKey(): Promise<StoredSignedPreKey | null> {
  try {
    const latestId = await getLatestSignedPreKeyId()
    if (latestId === 0) return null
    return await loadSignedPreKey(latestId)
  } catch (err) {
    logger.warn('Failed to load latest signed pre-key:', err)
    return null
  }
}

/**
 * Delete signed pre-keys older than maxAgeDays, keeping the latest
 * regardless of age so there's always at least one available.
 * Returns the number of pruned keys.
 */
export async function pruneOldSignedPreKeys(maxAgeDays: number): Promise<number> {
  try {
    const db = await getDb()
    const all = await db.getAll('signedPreKeys')
    if (all.length <= 1) return 0

    const latestId = Math.max(...all.map(s => s.keyId))
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const toDelete = all.filter(
      s => s.keyId !== latestId && new Date(s.createdAt).getTime() < cutoff
    )

    if (toDelete.length === 0) return 0

    const tx = db.transaction('signedPreKeys', 'readwrite')
    await Promise.all([
      ...toDelete.map(s => tx.store.delete(s.keyId)),
      tx.done,
    ])

    logger.info(`Pruned ${toDelete.length} old signed pre-key(s)`)
    return toDelete.length
  } catch (err) {
    logger.warn('Failed to prune old signed pre-keys:', err)
    return 0
  }
}

// ---- Peer Identities ----

export async function loadPeerIdentity(identityKey: string): Promise<StoredPeerIdentity | null> {
  try {
    const db = await getDb()
    const peer = await db.get('peerIdentities', identityKey)
    return peer ?? null
  } catch (err) {
    logger.warn(`Failed to load peer identity for ${identityKey}:`, err)
    return null
  }
}

export async function savePeerIdentity(peer: StoredPeerIdentity): Promise<void> {
  const db = await getDb()
  await db.put('peerIdentities', peer, peer.identityKey)
}

export async function getAllPeerIdentities(): Promise<StoredPeerIdentity[]> {
  try {
    const db = await getDb()
    return await db.getAll('peerIdentities')
  } catch (err) {
    logger.warn('Failed to get peer identities:', err)
    return []
  }
}

// ---- Sessions ----

export async function loadSession(sessionKey: string): Promise<StoredSession | null> {
  try {
    const db = await getDb()
    const session = await db.get('sessions', sessionKey)
    return session ?? null
  } catch (err) {
    logger.warn(`Failed to load session for ${sessionKey}:`, err)
    return null
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  const db = await getDb()
  await db.put('sessions', session, session.sessionKey)
}

export async function deleteSession(sessionKey: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('sessions', sessionKey)
  } catch (err) {
    logger.warn(`Failed to delete session for ${sessionKey}:`, err)
  }
}

/** Load all sessions for a given peer across all their devices. */
export async function loadSessionsForPeer(peerId: string): Promise<StoredSession[]> {
  try {
    const db = await getDb()
    const tx = db.transaction('sessions', 'readonly')
    const sessions = await tx.objectStore('sessions').index('by-peerId').getAll(peerId)
    return sessions
  } catch (err) {
    logger.warn(`Failed to load sessions for peer ${peerId}:`, err)
    return []
  }
}

// ---- Cleanup ----

/** Clear all Signal Protocol key material and sessions from IndexedDB.
 *  Called on sign-out alongside clearKeyStore() from cryptoService. */
export async function clearSignalStore(): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(
      ['localIdentity', 'preKeys', 'signedPreKeys', 'peerIdentities', 'sessions', 'senderKeys', 'groupSecrets'],
      'readwrite'
    )
    await Promise.all([
      tx.objectStore('localIdentity').clear(),
      tx.objectStore('preKeys').clear(),
      tx.objectStore('signedPreKeys').clear(),
      tx.objectStore('peerIdentities').clear(),
      tx.objectStore('sessions').clear(),
      tx.objectStore('senderKeys').clear(),
      tx.objectStore('groupSecrets').clear(),
      tx.done,
    ])
    logger.info('Cleared signal key store')
  } catch (err) {
    logger.warn('Failed to clear signal key store:', err)
  }
}

/**
 * Aggressively destroy the entire signal key store database.
 * Closes the connection, deletes the DB, and resets module state.
 * Called on primary logout for a clean slate.
 */
export async function destroySignalStore(): Promise<void> {
  logger.info('Destroyed signal key store database')
  await destroySignalDb()
}
