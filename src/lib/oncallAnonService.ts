/**
 * Anon-bundle service for the outside→on-call leg. Thin wrappers over the
 * credential-gated SECURITY DEFINER RPCs, called with the intake bundle's anon
 * Supabase client. Imports NOTHING from `src/lib/signal/*` (bundle firewall).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Plaintext cluster voicemail greeting played to the caller on no-answer (null if none). */
export interface OncallGreetingWire {
  audio: string
  mime: string
  dur: number
}

export interface RequestOncallResult {
  call_id: string
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

/**
 * Outside→cluster VOICEMAIL. The audio is AES-GCM ciphertext (IV‖ct) the caller produced
 * client-side; `audio` is its base64 and `key` is the raw AES key (base64). Both go to the
 * oncall-resolve EDGE FN over TLS — the edge (service_role) uploads the ciphertext blob to
 * the message-attachments bucket and authors the resolved card as a real per-device SYSTEM
 * envelope carrying {key, path}. No seal-to-clinic-key; server holds ciphertext only.
 */
export async function submitOncallVoicemail(
  supabase: SupabaseClient,
  args: {
    passcode: string
    passphrase: string
    callId: string
    audio: string
    key: string
    mime: string
    duration: number
    waveform: number[]
  },
): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('oncall-resolve', {
    body: {
      outcome: 'voicemail',
      call_id: args.callId,
      passcode: args.passcode,
      passphrase: args.passphrase,
      audio: args.audio,
      key: args.key,
      mime: args.mime,
      duration: Math.round(args.duration),
      waveform: args.waveform,
    },
  })
  if (error) return false
  return (data as { ok?: boolean } | null)?.ok === true
}

export async function markOncallMissedAnon(
  supabase: SupabaseClient,
  passcode: string,
  callId: string,
): Promise<void> {
  await supabase.functions.invoke('oncall-resolve', {
    body: { outcome: 'missed', call_id: callId, passcode },
  })
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

/**
 * Outside→cluster EVENT-INTAKE submission. Hands the detail (cleartext, over TLS) to
 * the `intake-submit` EDGE FUNCTION, which authors it as a real SYSTEM group message
 * (per-device X3DH) to every clinic supervisor — so the Signal envelope encrypts it
 * end-to-end and it rides the normal group pipeline (backup/delete/vault/render). No
 * client-side crypto here; the anon bundle stays signal-free. The server only ever
 * stores ciphertext; event_intake_requests PHI columns stay NULL. Returns false on
 * any failure (the edge returns a uniform {ok:false} — no passphrase oracle).
 */
export async function submitEventIntake(
  supabase: SupabaseClient,
  args: { passcode: string; passphrase: string; detail: IntakeDetail },
): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('intake-submit', {
    body: { passcode: args.passcode, passphrase: args.passphrase, detail: args.detail },
  })
  if (error) return false
  return (data as { ok?: boolean } | null)?.ok === true
}

/**
 * Outside→cluster ONE-WAY message. Hands the body (cleartext, over TLS) to the
 * `outside-message-submit` EDGE FUNCTION, which authors it as a real per-device SYSTEM
 * group message (per-device X3DH, sender_device_id='edge') to every clinic member — so
 * the Signal envelope encrypts it end-to-end and it rides the normal group pipeline
 * (decrypt/backup/vault/delete/render). No client-side crypto here; the anon bundle stays
 * signal-free, and there is no more seal-to-clinic-key. The on-call push is fired
 * server-side by the edge fn. Returns false on any failure (uniform {ok:false} — no oracle).
 */
export async function submitClusterMessage(
  supabase: SupabaseClient,
  args: { passcode: string; passphrase: string; requesterName: string; body: string },
): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('outside-message-submit', {
    body: {
      passcode: args.passcode,
      passphrase: args.passphrase,
      requesterName: args.requesterName,
      body: args.body,
    },
  })
  if (error) return false
  return (data as { ok?: boolean } | null)?.ok === true
}
