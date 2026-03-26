/**
 * IndexedDB persistence for clinic device Signal Protocol key material.
 *
 * Separate database from the personal signal store (adtmc-signal-store)
 * to isolate clinic device crypto state.
 *
 * Database: adtmc-clinic-signal-store
 * Stores:
 *   localIdentity  - Clinic device identity key pairs (single record, key="self")
 *   preKeys        - One-time pre-key pairs (keyed by keyId)
 *   signedPreKeys  - Signed pre-key pairs (keyed by keyId)
 *   peerIdentities - Known peer identity public keys (keyed by identityKey)
 *   sessions       - Double Ratchet session state (keyed by sessionKey)
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
} from './types'

const logger = createLogger('ClinicSignalKeyStore')

// ---- Database Schema ----

interface ClinicSignalDB extends DBSchema {
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
}

const CLINIC_SIGNAL_DB_NAME = 'adtmc-clinic-signal-store'
const CLINIC_SIGNAL_DB_VERSION = 1
const LOCAL_IDENTITY_KEY = 'self'

export const { getDb, destroy: destroyClinicSignalDb } = createIdbSingleton<ClinicSignalDB>(
  CLINIC_SIGNAL_DB_NAME,
  CLINIC_SIGNAL_DB_VERSION,
  {
    upgrade(db) {
      db.createObjectStore('localIdentity')
      db.createObjectStore('preKeys')
      db.createObjectStore('signedPreKeys')
      db.createObjectStore('peerIdentities')
      const sessionStore = db.createObjectStore('sessions')
      sessionStore.createIndex('by-peerId', 'peerId')
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
    logger.warn('Failed to load clinic local identity:', err)
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
    logger.warn(`Failed to load clinic pre-key ${keyId}:`, err)
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
    logger.warn(`Failed to remove clinic pre-key ${keyId}:`, err)
  }
}

export async function getAllPreKeyIds(): Promise<number[]> {
  try {
    const db = await getDb()
    return await db.getAllKeys('preKeys')
  } catch (err) {
    logger.warn('Failed to get clinic pre-key IDs:', err)
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
    logger.warn(`Failed to load clinic signed pre-key ${keyId}:`, err)
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
    logger.warn('Failed to get latest clinic signed pre-key ID:', err)
    return 0
  }
}

export async function loadLatestSignedPreKey(): Promise<StoredSignedPreKey | null> {
  try {
    const latestId = await getLatestSignedPreKeyId()
    if (latestId === 0) return null
    return await loadSignedPreKey(latestId)
  } catch (err) {
    logger.warn('Failed to load latest clinic signed pre-key:', err)
    return null
  }
}

// ---- Peer Identities ----

export async function loadPeerIdentity(identityKey: string): Promise<StoredPeerIdentity | null> {
  try {
    const db = await getDb()
    const peer = await db.get('peerIdentities', identityKey)
    return peer ?? null
  } catch (err) {
    logger.warn(`Failed to load clinic peer identity for ${identityKey}:`, err)
    return null
  }
}

export async function savePeerIdentity(peer: StoredPeerIdentity): Promise<void> {
  const db = await getDb()
  await db.put('peerIdentities', peer, peer.identityKey)
}

// ---- Sessions ----

export async function loadSession(sessionKey: string): Promise<StoredSession | null> {
  try {
    const db = await getDb()
    const session = await db.get('sessions', sessionKey)
    return session ?? null
  } catch (err) {
    logger.warn(`Failed to load clinic session for ${sessionKey}:`, err)
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
    logger.warn(`Failed to delete clinic session for ${sessionKey}:`, err)
  }
}

export async function loadSessionsForPeer(peerId: string): Promise<StoredSession[]> {
  try {
    const db = await getDb()
    const tx = db.transaction('sessions', 'readonly')
    const sessions = await tx.objectStore('sessions').index('by-peerId').getAll(peerId)
    return sessions
  } catch (err) {
    logger.warn(`Failed to load clinic sessions for peer ${peerId}:`, err)
    return []
  }
}

// ---- Cleanup ----

export async function clearClinicSignalStore(): Promise<void> {
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
    logger.info('Cleared clinic signal key store')
  } catch (err) {
    logger.warn('Failed to clear clinic signal key store:', err)
  }
}

export async function destroyClinicSignalStore(): Promise<void> {
  logger.info('Destroyed clinic signal key store database')
  await destroyClinicSignalDb()
}
