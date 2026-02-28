/**
 * WebRTC voice call — barrel export.
 */

// ---- Types ----

export type {
  CallStatus,
  CallDirection,
  CallPeer,
  SignalingEvent,
  CallOfferPayload,
  CallAnswerPayload,
  IceCandidatePayload,
  CallHangupPayload,
  CallDeclinePayload,
  SignalingPayload,
} from './types'

export { RTC_CONFIG, RING_TIMEOUT_MS } from './types'

// ---- WebRTC Service ----

export type { WebRTCService, WebRTCCallbacks } from './webrtcService'
export { createWebRTCService } from './webrtcService'

// ---- Signaling ----

export type { CallSignaling } from './callSignaling'
export {
  buildChannelName,
  createCallSignaling,
  listenForIncomingCalls,
  sendCallOffer,
} from './callSignaling'

// ---- Signaling Crypto ----

export type { SignalingCrypto } from './signalingCrypto'
export { createSignalingCrypto } from './signalingCrypto'
