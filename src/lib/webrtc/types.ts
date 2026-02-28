/**
 * WebRTC voice call — shared types and constants.
 */

// ── Call state ───────────────────────────────────────────────────────────────

export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'
export type CallDirection = 'outgoing' | 'incoming'

export interface CallPeer {
  userId: string
  displayName: string
}

// ── Signaling events ─────────────────────────────────────────────────────────

export type SignalingEvent =
  | 'call-offer'
  | 'call-answer'
  | 'ice-candidate'
  | 'call-hangup'
  | 'call-decline'

export interface CallOfferPayload {
  event: 'call-offer'
  callerId: string
  callerName: string
  offer: RTCSessionDescriptionInit
  pairwiseChannel: string
  /** Caller's ephemeral ECDH public key (base64) for signaling encryption. */
  ephemeralKey?: string
}

export interface CallAnswerPayload {
  event: 'call-answer'
  answer: RTCSessionDescriptionInit
}

export interface IceCandidatePayload {
  event: 'ice-candidate'
  candidate: RTCIceCandidateInit
}

export interface CallHangupPayload {
  event: 'call-hangup'
}

export interface CallDeclinePayload {
  event: 'call-decline'
}

export type SignalingPayload =
  | CallOfferPayload
  | CallAnswerPayload
  | IceCandidatePayload
  | CallHangupPayload
  | CallDeclinePayload

// ── WebRTC config ────────────────────────────────────────────────────────────

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export const RING_TIMEOUT_MS = 30_000
