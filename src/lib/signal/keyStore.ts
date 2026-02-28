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

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createLogger } from '../../Utilities/Logger'
import type {
  StoredLocalIdentity,
  StoredPreKey,
  StoredSignedPreKey,
  StoredPeerIdentity,
  StoredSession,
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
  }
}

const SIGNAL_DB_NAME = 'adtmc-signal-store'
const SIGNAL_DB_VERSION = 2
const LOCAL_IDENTITY_KEY = 'self'

let dbInstance: IDBPDatabase<SignalDB> | null = null

async function getDb(): Promise<IDBPDatabase<SignalDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<SignalDB>(SIGNAL_DB_NAME, SIGNAL_DB_VERSION, {
    upgrade(db, oldVersion) {
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
    },
  })

  return dbInstance
}

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
    const all = await db.getAll('sessions')
    return all.filter(s => s.peerId === peerId)
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
      ['localIdentity', 'preKeys', 'signedPreKeys', 'peerIdentities', 'sessions'],
      'readwrite'
    )
    await Promise.all([
      tx.objectStore('localIdentity').clear(),
      tx.objectStore('preKeys').clear(),
      tx.objectStore('signedPreKeys').clear(),
      tx.objectStore('peerIdentities').clear(),
      tx.objectStore('sessions').clear(),
      tx.done,
    ])
    logger.info('Cleared signal key store')
  } catch (err) {
    logger.warn('Failed to clear signal key store:', err)
  }
}
