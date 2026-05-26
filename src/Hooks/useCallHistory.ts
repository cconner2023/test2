import { useMemo } from 'react'
import { useMessagingStore } from '../stores/useMessagingStore'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

export type CallDirection = 'in' | 'out'
export type CallOutcome = 'answered' | 'missed' | 'declined' | 'failed'
export type CallHistoryMode = 'audio' | 'video'

/** One row in the Messaging "Calls" lens. Operational metadata only — no PHI. */
export interface CallHistoryEntry {
  /** Groups one call's signaling; also the row key. */
  callId: string
  /** The other party. */
  peerId: string
  /** Resolved peer profile for avatar/name + redial. */
  peer: ClinicMedic
  direction: CallDirection
  outcome: CallOutcome
  mode: CallHistoryMode
  /** Connected duration in seconds (0 for never-connected). */
  durationSec: number
  /** Call-end timestamp, ISO. */
  at: string
}

/**
 * Call history for the Messaging "Calls" lens.
 *
 * DATA SOURCE DEFERRED (2026-05-25): the per-call history record (`call_event`)
 * is not yet implemented. Call signaling rides `message_type='call-signal'`
 * control-plane rows — decrypted, routed to the call layer via callSignalBus,
 * and deliberately never stored in `useMessagingStore` (mirrors
 * sender-key-distribution). So there is currently no clean per-call record to
 * list here, and this hook returns [].
 *
 * The Calls-lens UI (Chat|Calls toggle + mobile island + redial) is wired
 * against this seam, so surfacing real history later is a single change here:
 * once a rendered `call_event` lands in `conversations` (see
 * .claude/Projects/_ideas/call-history-and-tabs.md), derive entries from those
 * messages below — resolving each peer against `medics`.
 */
export function useCallHistory(_medics: ClinicMedic[]): CallHistoryEntry[] {
  const conversations = useMessagingStore(s => s.conversations)
  return useMemo<CallHistoryEntry[]>(() => {
    // TODO(call_event): iterate conversations for call_event messages,
    // resolve each peer against `_medics`, and build CallHistoryEntry rows.
    void conversations
    return []
  }, [conversations])
}
