/**
 * On-call ring bus — decouples the Signal decrypt path from the on-call call
 * orchestrator (mirrors callSignalBus.ts). The inbound ring rides SYSTEM-authored
 * `oncall-ring` / `oncall-ring-cancel` plaintext system messages; decryptRow /
 * drainSystemInbox emit them here and useOncall subscribes. The live ring is NOT
 * stored as a chat card — only the resolved `oncall-call` message is. Plain
 * in-memory pub/sub: imports nothing from `src/lib/signal/*`.
 */

export type OncallRingEvent =
  | {
      kind: 'ring'
      callId: string
      clinicId: string
      requesterName: string
      sdpOffer: RTCSessionDescriptionInit
    }
  | { kind: 'cancel'; callId: string }

type Listener = (e: OncallRingEvent) => void

const listeners = new Set<Listener>()

export function onOncallRing(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function emitOncallRing(e: OncallRingEvent): void {
  for (const l of [...listeners]) {
    try {
      l(e)
    } catch {
      // a listener throwing must not break delivery to the others
    }
  }
}
