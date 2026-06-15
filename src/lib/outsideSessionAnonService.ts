/**
 * Anon-bundle service for the OUTSIDE-SESSION reply lane (cluster→outside text +
 * medic ring-back while the outside tab stays open). Thin wrappers over the
 * credential/session-gated SECURITY DEFINER RPCs, called with the intake
 * bundle's anon Supabase client.
 *
 * Imports NOTHING from `src/lib/signal/*` (bundle firewall). The outside party
 * holds its session private key DIRECTLY in this tab's JS heap, so no vault
 * unwrap is ever needed anon-side. Reply decryption (slice 4) uses a standalone
 * `outsideSeal.ts` built on raw WebCrypto — also signal-free.
 *
 * Session lifetime = tab-open only. The keypair is in-memory (never persisted to
 * IDB/localStorage/sessionStorage); a reload zeroes it and starts a fresh
 * session. See .claude/Projects/_ideas/outside-session.md.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { bytesToBase64 } from './base64Utils'

/** Ephemeral outside-session keypair — private stays in the tab heap, public ships on the wire. */
export interface OutsideSessionKeypair {
  /** ECDH P-256 private key. Heap-only; never exported, never persisted. */
  privateKey: CryptoKey
  /** base64 P-256 SPKI public key — the seal target the cluster encrypts replies to. */
  publicKeyB64: string
}

/**
 * Generate the per-tab ephemeral ECDH P-256 keypair. The pair is `extractable`
 * so we can export the PUBLIC key as SPKI; the private key object is held in
 * memory and never exported — it dies with the tab. (Single-call generateKey
 * can't mark only the private non-extractable; heap-only + never-exported is the
 * load-bearing property, not the extractable flag.)
 */
export async function generateOutsideSessionKeypair(): Promise<OutsideSessionKeypair> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
  return { privateKey: pair.privateKey, publicKeyB64: bytesToBase64(new Uint8Array(spki)) }
}

export interface RegisterOutsideSessionResult {
  session_id: string
  clinic_id: string
}

/**
 * Register a session (auto-fired the moment Stage-1 passphrase clears). bcrypt-
 * gated server-side with the same dummy-hash anti-enumeration as request_oncall;
 * a failure returns a uniform `{ ok: false }` (no passphrase oracle).
 */
export async function registerOutsideSession(
  supabase: SupabaseClient,
  passcode: string,
  passphrase: string,
  outsidePubB64: string,
  requesterName: string,
): Promise<{ ok: true; data: RegisterOutsideSessionResult } | { ok: false }> {
  const { data, error } = await supabase.rpc('register_outside_session', {
    p_passcode: passcode,
    p_passphrase: passphrase,
    p_outside_pub: outsidePubB64,
    p_requester_name: requesterName,
  })
  if (error || !data) return { ok: false }
  const result = data as RegisterOutsideSessionResult
  // Fire the on-call push (fire-and-forget). The edge fn resolves the clinic from
  // the bcrypt-gated 'outside-session-open' SYSTEM row by session_id (anon can't
  // forge one) and pings only the on-call roster. No-PHI copy. A push failure
  // must not fail registration.
  void supabase.functions
    .invoke('send-push-notification', { body: { type: 'outside_session', session_id: result.session_id } })
    .catch(() => {})
  return { ok: true, data: result }
}

/** A pending cluster→outside reply, drained by poll. `sealed` (text) / call-signal fields decode in slice 4. */
export interface OutsideSessionReply {
  reply_id: string
  /** outside-session-reply-{text,call-offer,call-ice,call-hangup,call-cancel} */
  kind: string
  created_at: string
  /** Sealed text body (present on '...-text'); decrypted with the session private key. */
  sealed?: unknown
  /** Ring-back call signaling (present on '...-call-*'). Non-trickle: full SDP. */
  call_id?: string
  sdp?: RTCSessionDescriptionInit
  /** Cluster member display name (operational, server-stamped — not PHI). */
  from_name?: string
}

export interface PollOutsideSessionResult {
  active: boolean
  replies?: OutsideSessionReply[]
  session_ended?: boolean
  /** ttl_expired | stale_30s | ended | unknown */
  reason?: string
}

/**
 * Poll: heartbeats the session (bumps last_seen_at) and drains any pending
 * cluster→outside replies. session_id IS the capability (uuid, no per-poll
 * bcrypt — mirrors poll_oncall_signal). Returns null on transport error; the
 * caller keeps polling. `active: false` ⇒ session ended, tear down.
 */
export async function pollOutsideSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<PollOutsideSessionResult | null> {
  const { data, error } = await supabase.rpc('poll_outside_session', { p_session_id: sessionId })
  if (error || !data) return null
  return data as PollOutsideSessionResult
}

/** Acknowledge consumed replies so the server drops them from the inbox. Best-effort. */
export async function ackOutsideSessionReplies(
  supabase: SupabaseClient,
  sessionId: string,
  replyIds: string[],
): Promise<void> {
  if (!replyIds.length) return
  await supabase.rpc('ack_outside_session_reply', { p_session_id: sessionId, p_reply_ids: replyIds })
}

/**
 * Explicitly end the session (fired on `beforeunload` / explicit "End session").
 * Best-effort — beforeunload is unreliable on mobile Safari; the server-side
 * staleness sweep (5-min) and 60-min TTL are the real backstops.
 */
export async function endOutsideSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  await supabase.rpc('end_outside_session', { p_session_id: sessionId })
}

/**
 * Outside party's leg of a medic-initiated ring-back: 'answer' (with the full
 * gather-once SDP), 'decline', or 'hangup'. Routed server-side to the initiating
 * medic. session_id is the capability (must own the call_id).
 */
export async function submitOutsideSessionCallSignal(
  supabase: SupabaseClient,
  sessionId: string,
  kind: 'answer' | 'decline' | 'hangup',
  callId: string,
  sdp?: RTCSessionDescriptionInit,
): Promise<void> {
  await supabase.rpc('submit_outside_session_call_signal', {
    p_session_id: sessionId,
    p_kind: kind,
    p_call_id: callId,
    p_sdp: sdp ?? null,
  })
}
