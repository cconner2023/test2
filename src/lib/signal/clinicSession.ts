/**
 * Clinic device session management — encrypt/decrypt via clinic identity.
 *
 * Mirrors session.ts but uses clinicKeyStore for persistence and
 * clinicKeyManager for identity. Sessions are between clinic devices
 * (vault + member clinic devices).
 */

import { createLogger } from '../../Utilities/Logger'
import { uint8ToBase64, base64ToUint8 } from '../../Utilities/textCodec'
import {
  getClinicLocalIdentity,
  consumeClinicPreKey,
  storeClinicPeerIdentity,
  getClinicPreKeyCount,
  generateClinicPreKeys,
  assembleClinicBundle,
  importDhPublicKey,
  makeClinicDeviceId,
} from './clinicKeyManager'
import * as store from './clinicKeyStore'
import { x3dhInitiate, x3dhRespond } from './x3dh'
import { initSender, initReceiver, ratchetEncrypt, ratchetDecrypt } from './ratchet'
import { seal, unseal } from './sealedSender'
import { uploadKeyBundle } from './signalService'
import { SIGNAL } from '../constants'
import type { SealedEnvelope } from './sealedSender'
import type {
  PublicKeyBundle,
  StoredSession,
  EncryptedMessage,
  InitialMessage,
} from './types'

const logger = createLogger('ClinicSession')

// ---- Pre-Key Replenishment ----

let _replenishPromise: Promise<void> | null = null

async function replenishClinicPreKeysIfNeeded(clinicId: string, userId: string, personalDeviceId: string): Promise<void> {
  if (_replenishPromise) return _replenishPromise
  _replenishPromise = (async () => {
    try {
      const currentCount = await getClinicPreKeyCount()
      const threshold = Math.floor(SIGNAL.PREKEY_BATCH_SIZE / 2)
      if (currentCount >= threshold) return

      const needed = SIGNAL.PREKEY_BATCH_SIZE - currentCount
      await generateClinicPreKeys(needed)

      const bundle = await assembleClinicBundle(clinicId, userId, personalDeviceId)
      if (!bundle) {
        logger.warn('replenishClinicPreKeysIfNeeded: could not assemble bundle')
        return
      }

      await uploadKeyBundle(bundle)
      logger.info(`Clinic pre-key pool replenished: generated ${needed}`)
    } catch (err) {
      logger.warn('replenishClinicPreKeysIfNeeded failed', err)
    }
  })().finally(() => { _replenishPromise = null })
  return _replenishPromise
}

// ---- Helpers ----

function makeSessionKey(peerId: string, peerDeviceId: string): string {
  return `${peerId}:${peerDeviceId}`
}

// ---- Session Cache + Locking ----

const sessionCache = new Map<string, StoredSession>()
const sessionLocks = new Map<string, Promise<void>>()

function withSessionLock<T>(sessionKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = sessionLocks.get(sessionKey) ?? Promise.resolve()
  let release!: () => void
  const next = new Promise<void>((resolve) => { release = resolve })
  sessionLocks.set(sessionKey, next)
  return prev.then(() => fn()).finally(() => {
    if (sessionLocks.get(sessionKey) === next) sessionLocks.delete(sessionKey)
    release()
  })
}

async function getSession(peerId: string, peerDeviceId: string): Promise<StoredSession | null> {
  const key = makeSessionKey(peerId, peerDeviceId)
  const cached = sessionCache.get(key)
  if (cached) return cached

  const stored = await store.loadSession(key)
  if (stored) {
    sessionCache.set(key, stored)
    return stored
  }

  return null
}

async function persistSession(session: StoredSession): Promise<void> {
  sessionCache.set(session.sessionKey, session)
  await store.saveSession(session)
}

// ---- Session Creation ----

export async function createClinicOutboundSession(
  clinicId: string,
  targetDeviceId: string,
  peerBundle: PublicKeyBundle,
  firstMessage: string,
  senderUuid: string,
): Promise<SealedEnvelope> {
  const identity = await getClinicLocalIdentity()
  if (!identity) throw new Error('Clinic identity not initialized')

  return withSessionLock(makeSessionKey(clinicId, targetDeviceId), async () => {
    const x3dh = await x3dhInitiate(identity, peerBundle)

    await storeClinicPeerIdentity(
      clinicId,
      targetDeviceId,
      peerBundle.identitySigningKey,
      peerBundle.identityDhKey
    )

    const peerSpk = await importDhPublicKey(peerBundle.signedPreKey.publicKey)
    const ratchetState = await initSender(
      x3dh.sharedSecret,
      peerSpk,
      peerBundle.signedPreKey.publicKey
    )

    const plaintext = new TextEncoder().encode(firstMessage)
    const { state, message } = await ratchetEncrypt(
      ratchetState, plaintext, x3dh.associatedData
    )

    const sessionKey = makeSessionKey(clinicId, targetDeviceId)
    const session: StoredSession = {
      peerId: clinicId,
      peerDeviceId: targetDeviceId,
      sessionKey,
      state,
      associatedData: uint8ToBase64(x3dh.associatedData),
      peerIdentityDhKey: peerBundle.identityDhKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await persistSession(session)

    const initialMessage: InitialMessage = {
      identitySigningKey: identity.signingPublicKeyBase64,
      identityDhKey: identity.dhPublicKeyBase64,
      ephemeralKey: x3dh.ephemeralPublicKeyBase64,
      signedPreKeyId: x3dh.signedPreKeyId,
      oneTimePreKeyId: x3dh.oneTimePreKeyId,
      message,
    }

    logger.info(`Clinic outbound session created with ${clinicId}:${targetDeviceId}`)

    return seal(
      initialMessage as unknown as Record<string, unknown>,
      senderUuid,
      identity,
      clinicId,
      peerBundle.identityDhKey
    )
  })
}

// ---- Message Encryption ----

export async function encryptClinicMessage(
  clinicId: string,
  targetDeviceId: string,
  plaintext: string,
  senderUuid: string,
): Promise<SealedEnvelope> {
  const identity = await getClinicLocalIdentity()
  if (!identity) throw new Error('Clinic identity not initialized')

  return withSessionLock(makeSessionKey(clinicId, targetDeviceId), async () => {
    const session = await getSession(clinicId, targetDeviceId)
    if (!session) {
      throw new Error(`No clinic session with ${clinicId}:${targetDeviceId}`)
    }

    if (!session.peerIdentityDhKey) {
      throw new Error(`Clinic session with ${clinicId}:${targetDeviceId} has no peerIdentityDhKey`)
    }

    const ad = base64ToUint8(session.associatedData)
    const plaintextBytes = new TextEncoder().encode(plaintext)
    const { state, message } = await ratchetEncrypt(session.state, plaintextBytes, ad)

    await persistSession({
      ...session,
      state,
      updatedAt: new Date().toISOString(),
    })

    return seal(
      message as unknown as Record<string, unknown>,
      senderUuid,
      identity,
      clinicId,
      session.peerIdentityDhKey
    )
  })
}

// ---- Inbound Handler ----

export async function processClinicIncomingMessage(
  senderDeviceId: string,
  envelope: SealedEnvelope,
  clinicId: string,
  userId?: string,
  personalDeviceId?: string,
): Promise<{ plaintext: string; senderUuid: string }> {
  const identity = await getClinicLocalIdentity()
  if (!identity) throw new Error('Clinic identity not initialized')

  const { inner, senderUuid, cert } = await unseal(
    envelope,
    clinicId,
    identity.dhPrivateKey,
    identity.dhPublicKeyBase64
  )

  return withSessionLock(makeSessionKey(senderUuid, senderDeviceId), async () => {
    await storeClinicPeerIdentity(
      senderUuid,
      senderDeviceId,
      cert.senderIdentitySigningKey,
      cert.senderIdentityDhKey
    )

    if ('identitySigningKey' in inner) {
      const initial = inner as unknown as InitialMessage

      const signedPreKey = await store.loadSignedPreKey(initial.signedPreKeyId)
      if (!signedPreKey) {
        throw new Error(`Clinic signed pre-key ${initial.signedPreKeyId} not found`)
      }

      let oneTimePreKeyPair = null
      if (initial.oneTimePreKeyId !== null) {
        const otpk = await consumeClinicPreKey(initial.oneTimePreKeyId)
        if (otpk) oneTimePreKeyPair = { publicKey: otpk.publicKey, privateKey: otpk.privateKey }
      }

      const x3dh = await x3dhRespond(
        identity,
        { publicKey: signedPreKey.publicKey, privateKey: signedPreKey.privateKey },
        oneTimePreKeyPair,
        initial.identityDhKey,
        initial.ephemeralKey
      )

      const ratchetState = await initReceiver(x3dh.sharedSecret, {
        publicKey: signedPreKey.publicKey,
        privateKey: signedPreKey.privateKey,
        publicKeyBase64: signedPreKey.publicKeyBase64,
      })

      const { state, plaintext } = await ratchetDecrypt(ratchetState, initial.message, x3dh.associatedData)

      const sessionKey = makeSessionKey(senderUuid, senderDeviceId)
      const session: StoredSession = {
        peerId: senderUuid,
        peerDeviceId: senderDeviceId,
        sessionKey,
        state,
        associatedData: uint8ToBase64(x3dh.associatedData),
        peerIdentityDhKey: initial.identityDhKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await persistSession(session)

      if (userId && personalDeviceId) {
        replenishClinicPreKeysIfNeeded(clinicId, userId, personalDeviceId).catch(() => {})
      }

      logger.info(`Clinic inbound session created with ${senderUuid}:${senderDeviceId}`)
      return { plaintext: new TextDecoder().decode(plaintext), senderUuid }
    } else {
      const encMsg = inner as unknown as EncryptedMessage

      const session = await getSession(senderUuid, senderDeviceId)
      if (!session) {
        throw new Error(`No clinic session with ${senderUuid}:${senderDeviceId}`)
      }

      const ad = base64ToUint8(session.associatedData)
      const { state, plaintext } = await ratchetDecrypt(session.state, encMsg, ad)

      await persistSession({
        ...session,
        state,
        updatedAt: new Date().toISOString(),
      })

      return { plaintext: new TextDecoder().decode(plaintext), senderUuid }
    }
  })
}

// ---- Session Queries ----

export async function hasClinicSession(clinicId: string, deviceId: string): Promise<boolean> {
  return (await getSession(clinicId, deviceId)) !== null
}

export async function clearAllClinicSessions(): Promise<void> {
  sessionCache.clear()
}

export async function deleteClinicSession(clinicId: string, deviceId: string): Promise<void> {
  const key = makeSessionKey(clinicId, deviceId)
  sessionCache.delete(key)
  await store.deleteSession(key)
}
