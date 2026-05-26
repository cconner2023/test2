/**
 * Call-signal bus — decouples the Signal decrypt path from the call orchestrator.
 *
 * Call signaling rides the Signal message transport as `message_type='call-signal'`
 * control-plane rows (decrypted-through-session, never surfaced as chat). The
 * decrypt path (useSignalMessages.decryptRow) parses the payload and `emitCallSignal`s
 * it here; useCall subscribes via `onCallSignal`. This module imports nothing from
 * `src/lib/signal/*` — it is a plain in-memory pub/sub.
 */

import type { CallMode } from './types'

export type CallSignalKind = 'offer' | 'answer' | 'ice' | 'hangup' | 'decline'

/** The wire body of a call-signal message (what gets JSON-serialized into the
 *  encrypted payload). `callId` scopes every event to one call so stale/replayed
 *  rows from a previous call are ignored. */
export interface CallSignalBody {
  callId: string
  k: CallSignalKind
  /** offer / answer */
  sdp?: RTCSessionDescriptionInit
  /** ice (one candidate per message — trickle) */
  cand?: RTCIceCandidateInit
  /** offer only */
  mode?: CallMode
  /** offer only — display name for the incoming-call UI */
  callerName?: string
}

/** A decrypted incoming call signal, tagged with the peer who sent it. */
export interface IncomingCallSignal extends CallSignalBody {
  /** Decrypted sender UUID (the peer). */
  senderId: string
}

type Listener = (sig: IncomingCallSignal) => void

const listeners = new Set<Listener>()

/** Subscribe to incoming call signals. Returns an unsubscribe function. */
export function onCallSignal(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Fire all subscribers with a decrypted incoming call signal. */
export function emitCallSignal(sig: IncomingCallSignal): void {
  for (const l of [...listeners]) {
    try {
      l(sig)
    } catch {
      // a listener throwing must not break delivery to the others
    }
  }
}
