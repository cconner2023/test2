/**
 * Cluster-side service for the OUTSIDE-SESSION reply lane. Authenticated clinic
 * members call this to reply to an open outside session; ring-back lands in
 * slice 5. Seals the reply body to the session's public key with `outsideSeal`
 * (standalone WebCrypto, NOT signal/*), then hands both the sealed blob and the
 * plaintext to `send_outside_session_reply`, which fans a plaintext bubble to the
 * whole cluster and enqueues the sealed copy for the outside tab to poll.
 */

import { supabase } from './supabase'
import { callRpc, type Result } from './result'
import { createLogger } from '../Utilities/Logger'
import { sealToOutsidePub } from './outsideSeal'

const logger = createLogger('OutsideSessionService')

/**
 * Reply to an outside session. `outsidePubB64` is the session's published public
 * key (carried on the card's OutsideSessionContent.outside_pub). The server
 * rejects the reply if the session is closed or the tab has gone quiet (>30s) —
 * surfaced as a 'outside party has disconnected' error.
 */
export async function sendOutsideSessionReply(
  sessionId: string,
  outsidePubB64: string,
  text: string,
): Promise<Result<{ reply_id: string }>> {
  const sealed = await sealToOutsidePub(outsidePubB64, text)
  return callRpc<{ reply_id: string }>(
    () => supabase.rpc('send_outside_session_reply', {
      p_session_id: sessionId,
      p_text: text,
      p_sealed: sealed,
    }),
    'sendOutsideSessionReply', logger,
  )
}

/**
 * Place a ring-back to an open outside session: the medic is the OFFERER (the
 * inverse of the outside→on-call leg). `offer` is the full gather-once SDP from
 * oncallPeer. Server rejects if the session is closed / stale (>30s). The
 * outside tab's answer arrives back via decryptRow → outsideSessionCallBus.
 */
export async function ringOutsideSession(
  sessionId: string,
  callId: string,
  offer: RTCSessionDescriptionInit,
): Promise<Result<{ ok?: boolean; from_name?: string }>> {
  return callRpc<{ ok?: boolean; from_name?: string }>(
    () => supabase.rpc('ring_outside_session', {
      p_session_id: sessionId,
      p_call_id: callId,
      p_offer_sdp: offer,
    }),
    'ringOutsideSession', logger,
  )
}

/** Medic's outbound call leg: 'hangup' (after connect) or 'cancel' (while ringing). */
export async function sendOutsideSessionCallSignal(
  callId: string,
  kind: 'hangup' | 'cancel',
): Promise<void> {
  await supabase.rpc('send_outside_session_call_signal', { p_call_id: callId, p_kind: kind, p_sdp: null })
}
