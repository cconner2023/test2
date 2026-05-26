/**
 * WebRTC call — shared types and constants.
 */

// ── Call state ───────────────────────────────────────────────────────────────

export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'
export type CallDirection = 'outgoing' | 'incoming'
export type CallMode = 'audio' | 'video'

export interface CallPeer {
  userId: string
  displayName: string
}

// Call signaling shapes live in ./callSignalBus (CallSignalBody/IncomingCallSignal) —
// signaling rides the Signal message transport, not a Realtime side-channel.

// ── WebRTC config ────────────────────────────────────────────────────────────

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export const RING_TIMEOUT_MS = 30_000
