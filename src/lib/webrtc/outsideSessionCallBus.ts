/**
 * Outside-session ring-back bus — two in-memory pub/sub channels, mirroring
 * oncallSignalBus. Imports nothing from `src/lib/signal/*`.
 *
 * 1. RINGBACK REQUEST (card → top-level host): OutsideSessionCard fires
 *    requestRingback when a medic taps "Call back"; OutsideSessionCallHost
 *    listens and mounts the call overlay (the card is deep in the message list
 *    and can't own a full-screen overlay).
 * 2. CALL SIGNAL (decryptRow → active overlay): the outside tab's answer /
 *    decline / hangup arrive as 'outside-session-call-*' SYSTEM rows addressed
 *    to the initiating medic; decryptRow emits them here for the overlay's peer.
 */

export interface OutsideRingbackRequest {
  sessionId: string
  /** base64 P-256 SPKI — the seal target (unused for media, kept for parity). */
  outsidePub: string
  /** Outside party's display name, for the overlay header. */
  requesterName: string
}

export type OutsideCallSignal =
  | { kind: 'answer'; callId: string; sessionId: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'decline'; callId: string; sessionId: string }
  | { kind: 'hangup'; callId: string; sessionId: string }

type ReqListener = (r: OutsideRingbackRequest) => void
type SigListener = (s: OutsideCallSignal) => void

const reqListeners = new Set<ReqListener>()
const sigListeners = new Set<SigListener>()

export function onRingbackRequest(cb: ReqListener): () => void {
  reqListeners.add(cb)
  return () => reqListeners.delete(cb)
}
export function requestRingback(r: OutsideRingbackRequest): void {
  for (const l of [...reqListeners]) { try { l(r) } catch { /* isolate */ } }
}

export function onOutsideCallSignal(cb: SigListener): () => void {
  sigListeners.add(cb)
  return () => sigListeners.delete(cb)
}
export function emitOutsideCallSignal(s: OutsideCallSignal): void {
  for (const l of [...sigListeners]) { try { l(s) } catch { /* isolate */ } }
}
