/**
 * Anon-bundle service for the outside→on-call leg. Thin wrappers over the
 * credential-gated SECURITY DEFINER RPCs, called with the intake bundle's anon
 * Supabase client. Imports NOTHING from `src/lib/signal/*` (bundle firewall).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateAudioKey, encryptText, sealAudioKey, sealKeyToRawP256 } from './oncallSeal'

/** Plaintext cluster voicemail greeting played to the caller on no-answer (null if none). */
export interface OncallGreetingWire {
  audio: string
  mime: string
  dur: number
}

export interface RequestOncallResult {
  call_id: string
  /** base64 SPKI of the clinic voicemail pubkey (null if none configured). */
  recipient_pub: string | null
  /** Cluster voicemail greeting — plaintext, played before recording on no-answer. */
  voicemail_greeting: OncallGreetingWire | null
  /** Whether ANYONE will be paged (→ ring) vs nobody on-call (→ straight to voicemail).
   *  Replaces the old push_target_count: the exact on-call headcount was staffing recon
   *  and no longer leaves the server. */
  will_ring: boolean
}

export async function requestOncall(
  supabase: SupabaseClient,
  passcode: string,
  passphrase: string,
  requesterName: string,
  sdpOffer: RTCSessionDescriptionInit,
): Promise<{ ok: true; data: RequestOncallResult } | { ok: false }> {
  const { data, error } = await supabase.rpc('request_oncall', {
    p_passcode: passcode,
    p_passphrase: passphrase,
    p_requester_name: requesterName,
    p_sdp_offer: sdpOffer,
  })
  if (error || !data) return { ok: false }

  const result = data as RequestOncallResult
  // Fire the on-call push. The ring itself is delivered cluster-wide by request_oncall
  // (signal_messages fan-out → every clinic member); this PING is gated server-side to the
  // on-call roster (clinics.oncall) inside the edge fn, which resolves it from the SYSTEM ring
  // copy keyed by call_id. The anon caller passes only call_id and never learns the roster.
  // Fire-and-forget — a push failure must not fail the call.
  void supabase.functions
    .invoke('send-push-notification', { body: { type: 'oncall', call_id: result.call_id } })
    .catch(() => {})

  return { ok: true, data: result }
}

export interface PollResult {
  answered: boolean
  answer_sdp?: RTCSessionDescriptionInit | null
  ended?: boolean
  outcome?: string | null
}

export async function pollOncallSignal(
  supabase: SupabaseClient,
  passcode: string,
  callId: string,
): Promise<PollResult | null> {
  const { data, error } = await supabase.rpc('poll_oncall_signal', {
    p_passcode: passcode,
    p_call_id: callId,
  })
  if (error || !data) return null
  return data as PollResult
}

export async function submitOncallVoicemail(
  supabase: SupabaseClient,
  args: {
    passcode: string
    passphrase: string
    callId: string
    audio: string
    mime: string
    duration: number
    waveform: number[]
    sealedKey: string
    ephemeralPub: string
    nonce: string
  },
): Promise<boolean> {
  const { error } = await supabase.rpc('submit_oncall_voicemail', {
    p_passcode: args.passcode,
    p_passphrase: args.passphrase,
    p_call_id: args.callId,
    p_audio: args.audio,
    p_mime: args.mime,
    p_duration: Math.round(args.duration),
    p_waveform: args.waveform,
    p_sealed_key: args.sealedKey,
    p_ephemeral_pub: args.ephemeralPub,
    p_nonce: args.nonce,
  })
  return !error
}

export async function markOncallMissedAnon(
  supabase: SupabaseClient,
  passcode: string,
  callId: string,
): Promise<void> {
  await supabase.rpc('mark_oncall_missed_anon', { p_passcode: passcode, p_call_id: callId })
}

/** The human-readable event-intake detail — sealed before it leaves the device. */
export interface IntakeDetail {
  requester_name: string
  requester_org: string | null
  requester_email: string
  /** ISO timestamp. */
  requested_start: string
  /** ISO timestamp. */
  requested_end: string
  title: string
}

/** One clinic supervisor the intake detail is sealed to — user_id + their RAW
 *  (65-byte) P-256 vault identity pubkey, from resolve_event_intake_code. */
export interface IntakeRecipient {
  user_id: string
  dhPubB64: string
}

/**
 * Outside→cluster EVENT-INTAKE submission. The detail is encrypted ONCE with a
 * per-request AES key K; K is then sealed PER SUPERVISOR to each supervisor's vault
 * identity pubkey (`recipients`, from resolve_event_intake_code.intake_recipients).
 * Supervisor-scoped and INDEPENDENT of the on-call inbound key — each supervisor
 * opens their own seal with their vault key; no shared clinic key, no wrap
 * distribution. The server only ever stores ciphertext, never plaintext PII. An
 * empty recipient set → no supervisor can read it, so the caller must surface an
 * unavailable state rather than submit.
 */
export async function submitEventIntake(
  supabase: SupabaseClient,
  args: { passcode: string; passphrase: string; recipients: IntakeRecipient[]; detail: IntakeDetail },
): Promise<boolean> {
  if (args.recipients.length === 0) return false
  let sealedPayload: {
    ciphertext: string
    recipients: Array<{ user_id: string; sealed_key: string; ephemeral_pub: string; nonce: string }>
  }
  try {
    const key = await generateAudioKey()
    const ciphertext = await encryptText(key, JSON.stringify(args.detail))
    const recipients: Array<{ user_id: string; sealed_key: string; ephemeral_pub: string; nonce: string }> = []
    for (const r of args.recipients) {
      const sealed = await sealKeyToRawP256(key, r.dhPubB64)
      recipients.push({ user_id: r.user_id, ...sealed })
    }
    sealedPayload = { ciphertext, recipients }
  } catch {
    return false
  }

  const { error } = await supabase.rpc('submit_event_intake', {
    p_passcode: args.passcode,
    p_passphrase: args.passphrase,
    p_sealed: sealedPayload,
  })
  return !error
}

/**
 * Outside→cluster ONE-WAY message. Seals the text body to the clinic inbound public key
 * (same envelope as voicemail audio) BEFORE it leaves the device — the server only ever
 * stores ciphertext. `recipientPubB64` is the clinic inbound pubkey returned by
 * resolve_event_intake_code; if it's absent the clinic has no inbound key and we can't seal.
 * On success, fires the on-call push (server resolves clinics.oncall from the SYSTEM copy
 * keyed by message_id; the anon never learns the roster). Fire-and-forget push.
 */
export async function submitClusterMessage(
  supabase: SupabaseClient,
  args: { passcode: string; passphrase: string; requesterName: string; recipientPubB64: string; body: string },
): Promise<boolean> {
  let sealedPayload: { ciphertext: string; sealed_key: string; ephemeral_pub: string; nonce: string }
  try {
    const key = await generateAudioKey()
    const ciphertext = await encryptText(key, args.body)
    const sealed = await sealAudioKey(key, args.recipientPubB64)
    sealedPayload = { ciphertext, ...sealed }
  } catch {
    return false
  }

  const { data, error } = await supabase.rpc('submit_cluster_message', {
    p_passcode: args.passcode,
    p_passphrase: args.passphrase,
    p_sealed: sealedPayload,
    p_requester_name: args.requesterName,
  })
  if (error || !data) return false

  const messageId = (data as { message_id: string }).message_id
  void supabase.functions
    .invoke('send-push-notification', { body: { type: 'cluster_message', message_id: messageId } })
    .catch(() => {})

  return true
}
