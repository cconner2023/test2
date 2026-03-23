/**
 * IndexedDB persistence for Sender Key state.
 *
 * Sender keys live in the same `adtmc-signal-store` database as sessions
 * (added in v4 upgrade). Each record is keyed by the compound identifier
 * `${groupId}:${memberId}:${deviceId}` and indexed by groupId and memberId
 * to support efficient group-level and member-level queries.
 *
 * All functions follow the same patterns as keyStore.ts:
 * - Return null / [] on not-found (never throw on missing)
 * - logger.warn on unexpected errors, then re-throw or return safe default
 * - Use getDb() from the shared keyStore singleton
 */

import { createLogger } from '../../Utilities/Logger'
import { getDb } from './keyStore'
import type { SenderKeyState } from './types'

const logger = createLogger('SenderKeyStore')

// ---- Compound Key Helper ----

/** Build the compound IDB key for a sender key record. */
function makeSenderKeyId(groupId: string, memberId: string, deviceId: string): string {
  return `${groupId}:${memberId}:${deviceId}`
}

// ---- CRUD ----

/**
 * Persist a SenderKeyState record.
 *
 * Overwrites any existing record with the same senderKeyId. Called after
 * generating a new key, receiving a distribution, or advancing the chain.
 */
export async function saveSenderKey(key: SenderKeyState): Promise<void> {
  try {
    const db = await getDb()
    await db.put('senderKeys', key, key.senderKeyId)
  } catch (err) {
    logger.warn(`Failed to save sender key ${key.senderKeyId}:`, err)
    throw err
  }
}

/**
 * Load a specific sender key by (groupId, memberId, deviceId).
 * Returns null if the key does not exist.
 */
export async function loadSenderKey(
  groupId: string,
  memberId: string,
  deviceId: string
): Promise<SenderKeyState | null> {
  try {
    const db = await getDb()
    const record = await db.get('senderKeys', makeSenderKeyId(groupId, memberId, deviceId))
    return record ?? null
  } catch (err) {
    logger.warn(`Failed to load sender key for ${groupId}:${memberId}:${deviceId}:`, err)
    return null
  }
}

/**
 * Load all sender keys for a group (across all members and devices).
 *
 * Uses the `by-groupId` index for an efficient range scan.
 * Returns an empty array if the group has no stored keys.
 */
export async function loadSenderKeysForGroup(groupId: string): Promise<SenderKeyState[]> {
  try {
    const db = await getDb()
    const tx = db.transaction('senderKeys', 'readonly')
    const results = await tx.objectStore('senderKeys').index('by-groupId').getAll(groupId)
    return results
  } catch (err) {
    logger.warn(`Failed to load sender keys for group ${groupId}:`, err)
    return []
  }
}

/**
 * Load all sender keys for a given member (across all groups and devices).
 *
 * Uses the `by-memberId` index. Useful for finding all groups a peer
 * participates in when performing member-level cleanup.
 */
export async function loadSenderKeysForMember(memberId: string): Promise<SenderKeyState[]> {
  try {
    const db = await getDb()
    const tx = db.transaction('senderKeys', 'readonly')
    const results = await tx.objectStore('senderKeys').index('by-memberId').getAll(memberId)
    return results
  } catch (err) {
    logger.warn(`Failed to load sender keys for member ${memberId}:`, err)
    return []
  }
}

/**
 * Delete a specific sender key by (groupId, memberId, deviceId).
 * No-op if the key does not exist.
 */
export async function deleteSenderKey(
  groupId: string,
  memberId: string,
  deviceId: string
): Promise<void> {
  try {
    const db = await getDb()
    await db.delete('senderKeys', makeSenderKeyId(groupId, memberId, deviceId))
  } catch (err) {
    logger.warn(`Failed to delete sender key for ${groupId}:${memberId}:${deviceId}:`, err)
  }
}

/**
 * Delete all sender keys for a group.
 *
 * Called when a group is deleted or the user leaves a group. Uses the
 * `by-groupId` index to collect keys then deletes them in a single
 * readwrite transaction for atomicity.
 */
export async function deleteSenderKeysForGroup(groupId: string): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction('senderKeys', 'readwrite')
    const store = tx.objectStore('senderKeys')
    const keys = await store.index('by-groupId').getAllKeys(groupId)
    await Promise.all([
      ...keys.map((k) => store.delete(k)),
      tx.done,
    ])
    logger.info(`Deleted ${keys.length} sender key(s) for group ${groupId}`)
  } catch (err) {
    logger.warn(`Failed to delete sender keys for group ${groupId}:`, err)
  }
}

/**
 * Clear all sender keys from the store.
 * Called on sign-out as part of the full signal-store wipe.
 */
export async function clearAllSenderKeys(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('senderKeys')
    logger.info('Cleared all sender keys')
  } catch (err) {
    logger.warn('Failed to clear sender keys:', err)
  }
}
