/**
 * Vault-first send path — ONE row per recipient user.
 *
 * Every personal message (1:1, own-device sync, receipts, call signaling,
 * deletes, group content) is a self-contained X3DH InitialMessage from this
 * device's identity to the recipient's VAULT identity, written as a single
 * row with recipient_device_id = 'vault'. Each of the recipient's devices
 * reads it from its vault cursor (see vaultCursor.ts) and opens it with the
 * vault keys (session.openVaultEnvelope). No pairwise sessions, no per-device
 * fan-out, no per-send device lookup.
 *
 * - X3DH uses the vault's signed pre-key only (no one-time pre-key): the vault
 *   never replies and every device of the user must be able to open the row.
 * - The vault bundle is READ (never consumed) and cached; the vault retains its
 *   previous signed pre-keys for weeks, so a cached copy keeps opening.
 * - SYSTEM has no vault; its inbox device ('primary') gets the same stateless
 *   envelope (drainSystemInbox opens InitialMessages).
 */

import { createLogger } from '../../Utilities/Logger'
import { err, ok, type Result } from '../result'
import { VAULT } from '../constants'
import { ensureLocalIdentity } from './keyManager'
import { encryptAsSystemWith } from './systemSender'
import { SYSTEM_USER_ID, SYSTEM_DEVICE_ID } from './systemConstants'
import { fetchPeerBundlePublic, sendMessageFanOut } from './signalService'
import type { PublicKeyBundle } from './types'
import type { FanOutMessageInput, SignalMessageType } from './transportTypes'

const logger = createLogger('VaultSend')


/** Bundles are read, never consumed; refresh often enough that a re-provisioned
 *  vault (password reset) is picked up quickly. */
const BUNDLE_TTL_MS = 10 * 60 * 1000
const bundleCache = new Map<string, { bundle: PublicKeyBundle; at: number }>()

function inboxDeviceFor(userId: string): string {
  return userId === SYSTEM_USER_ID ? SYSTEM_DEVICE_ID : VAULT.DEVICE_ID
}

async function getInboxBundle(userId: string): Promise<PublicKeyBundle | null> {
  const cached = bundleCache.get(userId)
  if (cached && Date.now() - cached.at < BUNDLE_TTL_MS) return cached.bundle
  const deviceId = inboxDeviceFor(userId)
  const result = await fetchPeerBundlePublic(userId, deviceId)
  if (!result.ok) return cached?.bundle ?? null
  const r = result.data
  const bundle: PublicKeyBundle = {
    userId: r.userId,
    deviceId: r.deviceId,
    identitySigningKey: r.identitySigningKey,
    identityDhKey: r.identityDhKey,
    signedPreKey: { keyId: r.signedPreKeyId, publicKey: r.signedPreKey, signature: r.signedPreKeySig },
    oneTimePreKeys: [],
  }
  bundleCache.set(userId, { bundle, at: Date.now() })
  return bundle
}

/** Drop a cached inbox bundle (e.g. after the recipient's vault re-provisions). */
export function forgetInboxBundle(userId: string): void {
  bundleCache.delete(userId)
}

/**
 * Encrypt `serialized` for a recipient user's inbox (their vault). Returns null
 * when the recipient has no vault yet (never signed in on a vault-first build).
 */
export async function encryptForUser(
  recipientId: string,
  serialized: string,
  senderUuid: string,
  messageType: SignalMessageType,
): Promise<FanOutMessageInput | null> {
  const bundle = await getInboxBundle(recipientId)
  if (!bundle) return null
  const identity = await ensureLocalIdentity()
  const envelope = await encryptAsSystemWith(identity, senderUuid, recipientId, bundle, serialized)
  return {
    recipientDeviceId: inboxDeviceFor(recipientId),
    payload: envelope as unknown as Record<string, unknown>,
    messageType,
  }
}

/**
 * Encrypt and send one row to a recipient user's inbox. Sending to yourself
 * (own-device sync) writes to your own vault; this device skips its own rows
 * on receive (sender_device_id).
 *
 * @returns the server row id
 */
export async function sendToUser(
  senderId: string,
  senderDeviceId: string,
  recipientId: string,
  serialized: string,
  messageType: SignalMessageType,
  opts: { groupId?: string; originId?: string; silent?: boolean } = {},
): Promise<Result<string>> {
  try {
    const input = await encryptForUser(recipientId, serialized, senderId, messageType)
    if (!input) return err(`Recipient ${recipientId} has no vault yet`)
    const sent = await sendMessageFanOut(
      senderId, senderDeviceId, recipientId, [input], opts.groupId, opts.originId, opts.silent,
    )
    if (!sent.ok) return err(sent.error)
    return ok(sent.data[0] ?? crypto.randomUUID())
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn(`sendToUser ${recipientId} (${messageType}) failed:`, message)
    return err(message)
  }
}
