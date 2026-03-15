/**
 * Call signaling via Supabase Realtime Broadcast.
 *
 * Two-phase flow:
 * 1. Callee is always subscribed to their personal `call-listen:{userId}` channel.
 * 2. Caller sends a `call-offer` to the callee's listen channel, including
 *    the pairwise channel name for subsequent signaling.
 * 3. Both sides join the pairwise channel `call:{sortedIds}` for
 *    answer / ICE / hangup / decline messages.
 *
 * Signaling encryption (ephemeral ECDH + AES-256-GCM):
 * - The call offer includes the caller's ephemeral public key.
 * - The answer includes the callee's ephemeral public key.
 * - Once both keys are exchanged, ICE candidates and control messages
 *   are encrypted, protecting IP addresses and call metadata from the
 *   Supabase infrastructure.
 */

import { supabase } from '../supabase'
import { createLogger } from '../../Utilities/Logger'
import { errorBus } from '../errorBus'
import { ErrorCode } from '../errorCodes'
import { createSignalingCrypto, type SignalingCrypto } from './signalingCrypto'
import type {
  CallMode,
  CallOfferPayload,
  CallAnswerPayload,
  IceCandidatePayload,
  CallHangupPayload,
  CallDeclinePayload,
  SignalingPayload,
} from './types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const logger = createLogger('CallSignaling')

/** Deterministic pairwise channel name from two user IDs. */
export function buildChannelName(userA: string, userB: string): string {
  const sorted = [userA, userB].sort()
  return `call:${sorted[0]}:${sorted[1]}`
}

// ── Encrypted signaling envelope ──────────────────────────────────────────────

interface EncryptedEnvelope {
  /** Sender's ephemeral public key (included in first message from each side). */
  ephemeralKey?: string
  /** AES-256-GCM encrypted JSON of the SignalingPayload. */
  encrypted?: string
  /** Plaintext event type (always present for backward compat & routing). */
  event: string
}

// ── Pairwise signaling channel ───────────────────────────────────────────────

export interface CallSignaling {
  join: (onMessage: (payload: SignalingPayload) => void) => void
  sendAnswer: (answer: RTCSessionDescriptionInit) => void
  sendIceCandidate: (candidate: RTCIceCandidateInit) => void
  sendHangup: () => void
  sendDecline: () => void
  leave: () => void
  /** Set the peer's ephemeral key from the call offer (callee side). */
  setPeerEphemeralKey: (key: string) => void
  /** Get this side's ephemeral public key (for including in messages). */
  getEphemeralKey: () => Promise<string>
}

export function createCallSignaling(channelName: string): CallSignaling {
  let channel: RealtimeChannel | null = null
  let crypto: SignalingCrypto | null = null
  const cryptoReady = createSignalingCrypto().then(c => { crypto = c; return c })
  let peerKeyReceived = false

  const join: CallSignaling['join'] = (onMessage) => {
    channel = supabase.channel(channelName, { config: { broadcast: { self: false } } })

    channel
      .on('broadcast', { event: 'call-signal' }, async ({ payload }) => {
        try {
          const envelope = payload as EncryptedEnvelope

          // If the peer included their ephemeral key, derive shared secret
          if (envelope.ephemeralKey && !peerKeyReceived) {
            peerKeyReceived = true
            const c = await cryptoReady
            await c.setPeerKey(envelope.ephemeralKey)
          }

          // Decrypt if encrypted
          if (envelope.encrypted && crypto?.isReady()) {
            const decrypted = await crypto.decrypt(envelope.encrypted)
            onMessage(decrypted as SignalingPayload)
          } else {
            // Plaintext fallback (backward compat or pre-key-exchange)
            onMessage(payload as SignalingPayload)
          }
        } catch (err) {
          logger.warn('Failed to decrypt signaling message, using plaintext:', err)
          onMessage(payload as SignalingPayload)
        }
      })
      .subscribe((status) => {
        logger.debug(`Pairwise channel ${channelName} status:`, status)
      })
  }

  const broadcast = async (payload: SignalingPayload, includeEphemeralKey = false) => {
    if (!channel) {
      logger.warn('Cannot broadcast — channel not joined')
      return
    }

    const c = await cryptoReady
    let envelope: Record<string, unknown> = { ...payload }

    if (includeEphemeralKey) {
      envelope.ephemeralKey = await c.getPublicKeyBase64()
    }

    // Encrypt if shared key is available
    if (c.isReady()) {
      try {
        const encrypted = await c.encrypt(payload)
        envelope = { event: payload.event, encrypted, ephemeralKey: envelope.ephemeralKey }
      } catch {
        // Fall back to plaintext if encryption fails
      }
    }

    channel.send({ type: 'broadcast', event: 'call-signal', payload: envelope }).catch((err) => {
      errorBus.emit({ code: ErrorCode.NETWORK_ERROR, message: `Call signal broadcast failed: ${err}`, source: 'callSignaling.broadcast', timestamp: Date.now() })
    })
  }

  const sendAnswer: CallSignaling['sendAnswer'] = (answer) => {
    // Include our ephemeral key in the answer so the caller can derive the shared key
    broadcast({ event: 'call-answer', answer } as CallAnswerPayload, true)
  }

  const sendIceCandidate: CallSignaling['sendIceCandidate'] = (candidate) => {
    broadcast({ event: 'ice-candidate', candidate } as IceCandidatePayload)
  }

  const sendHangup: CallSignaling['sendHangup'] = () => {
    broadcast({ event: 'call-hangup' } as CallHangupPayload)
  }

  const sendDecline: CallSignaling['sendDecline'] = () => {
    broadcast({ event: 'call-decline' } as CallDeclinePayload)
  }

  const leave: CallSignaling['leave'] = () => {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  const setPeerEphemeralKey: CallSignaling['setPeerEphemeralKey'] = (key) => {
    if (!peerKeyReceived) {
      peerKeyReceived = true
      cryptoReady.then(c => c.setPeerKey(key)).catch((err) => {
        errorBus.emit({ code: ErrorCode.ENCRYPTION_FAILED, message: `Failed to set peer ephemeral key: ${err}`, source: 'callSignaling.setPeerEphemeralKey', timestamp: Date.now() })
      })
    }
  }

  const getEphemeralKey: CallSignaling['getEphemeralKey'] = async () => {
    const c = await cryptoReady
    return c.getPublicKeyBase64()
  }

  return { join, sendAnswer, sendIceCandidate, sendHangup, sendDecline, leave, setPeerEphemeralKey, getEphemeralKey }
}

// ── Personal listen channel ──────────────────────────────────────────────────

/**
 * Subscribe to incoming call offers on the user's personal channel.
 * Should be active whenever the user is authenticated.
 * Returns a cleanup function.
 */
export function listenForIncomingCalls(
  userId: string,
  onOffer: (payload: CallOfferPayload) => void,
): () => void {
  const channelName = `call-listen:${userId}`

  const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } })

  channel
    .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
      logger.info('Incoming call offer received')
      onOffer(payload as CallOfferPayload)
    })
    .subscribe((status) => {
      logger.debug(`Listen channel ${channelName} status:`, status)
    })

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Send a call offer to a peer's personal listen channel.
 * This is a one-shot: send and immediately remove the channel.
 * Includes the caller's ephemeral ECDH public key for signaling encryption.
 */
export async function sendCallOffer(
  callerId: string,
  callerName: string,
  peerId: string,
  offer: RTCSessionDescriptionInit,
  pairwiseChannel: string,
  ephemeralKey?: string,
  callMode?: CallMode,
): Promise<void> {
  const channelName = `call-listen:${peerId}`
  const channel = supabase.channel(channelName)

  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const payload: CallOfferPayload = {
          event: 'call-offer',
          callerId,
          callerName,
          offer,
          pairwiseChannel,
          ephemeralKey,
          callMode,
        }
        channel.send({ type: 'broadcast', event: 'call-offer', payload }).then(() => {
          logger.info('Call offer sent to', peerId)
          supabase.removeChannel(channel)
          resolve()
        }).catch(() => {
          supabase.removeChannel(channel)
          resolve()
        })
      }
    })
  })
}
