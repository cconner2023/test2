/**
 * WebRTC call — barrel export.
 */

// ---- Types ----

export type {
  CallStatus,
  CallDirection,
  CallMode,
  CallPeer,
} from './types'

export { RTC_CONFIG, RING_TIMEOUT_MS } from './types'

// ---- WebRTC Service ----

export type { WebRTCService, WebRTCCallbacks } from './webrtcService'
export { createWebRTCService } from './webrtcService'

// ---- Call signaling (rides the Signal message transport — see callSignalBus) ----

export type { CallSignalKind, CallSignalBody, IncomingCallSignal } from './callSignalBus'
export { onCallSignal, emitCallSignal } from './callSignalBus'
