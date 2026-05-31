/**
 * On-call service (main app, authed). Thin wrappers over the on-call RPCs plus
 * the supervisor key-distribution orchestration. Pure I/O + crypto glue.
 *
 * Split from the anon bundle's oncallAnonService (request/poll/voicemail) so the
 * intake bundle never pulls in `src/lib/signal/*` (bundle firewall).
 *
 * NOTE: the seal-to-clinic-key voicemail/message subsystem was RETIRED — outside
 * calls/messages/voicemail are now authored by edge fns as real E2E Signal
 * envelopes (the AES key rides the envelope). The GATE-2 toggles below just flip
 * the master flags; there is no inbound keypair to provision/wrap/distribute.
 */

import { supabase } from './supabase'
import { createLogger } from '../Utilities/Logger'
import { callRpc } from './result'
import type { Result } from './result'

const logger = createLogger('Oncall')

// ─── Outside-contact status (any cluster member) ───
/** Whether GATE-2 "allow calls" and/or "allow text messaging" are on for the
 *  cluster. Membership-gated (not supervisor) so any member's messaging settings
 *  can decide whether the on-call roster is worth showing. */
export async function getOutsideContactStatus(
  clinicId: string,
): Promise<Result<{ oncall_enabled: boolean; outside_message_enabled: boolean }>> {
  const res = await callRpc<{ oncall_enabled?: boolean; outside_message_enabled?: boolean } | null>(
    () => supabase.rpc('get_clinic_outside_contact_status', { p_clinic_id: clinicId }),
    'get_clinic_outside_contact_status', logger,
  )
  if (!res.ok) return res
  return {
    ok: true,
    data: {
      oncall_enabled: res.data?.oncall_enabled === true,
      outside_message_enabled: res.data?.outside_message_enabled === true,
    },
  }
}

// ─── GATE 3: presence (any cluster member toggles self or teammate) ───
export async function toggleOncallPresence(
  clinicId: string,
  userId: string,
  on: boolean,
): Promise<Result<{ on: boolean }>> {
  const res = await callRpc(
    () => supabase.rpc('toggle_oncall_presence', { p_clinic_id: clinicId, p_user_id: userId, p_on: on }),
    'toggle_oncall_presence', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: { on } }
}

// ─── Medic call control ───
export async function acceptOncall(
  callId: string,
  answerSdp: RTCSessionDescriptionInit,
): Promise<{ won: boolean }> {
  const res = await callRpc(
    () => supabase.rpc('accept_oncall', { p_call_id: callId, p_answer_sdp: answerSdp }),
    'accept_oncall', logger,
  )
  if (!res.ok) return { won: false }
  return { won: (res.data as { won?: boolean })?.won === true }
}

export async function markOncallEnded(callId: string): Promise<void> {
  // Authoring the resolved card moved to the oncall-resolve EDGE FN (SQL can't run
  // Signal crypto). The medic is authenticated; the edge verifies the JWT and checks
  // they were the answering medic before authoring the connected_ended card E2E to the
  // whole cluster. Fire-and-forget — a failure must not block hang-up.
  try {
    await supabase.functions.invoke('oncall-resolve', {
      body: { outcome: 'connected_ended', call_id: callId },
    })
  } catch (e) {
    logger.warn('markOncallEnded (oncall-resolve) failed:', e instanceof Error ? e.message : e)
  }
}

// ─── GATE 2: supervisor master toggles (flag-only; no key lifecycle) ───

/** Enable on-call (GATE 2). Flips the master flag — there is no inbound key to
 *  provision; outside calls/voicemail are E2E via the edge-authored envelope. */
export async function enableOncall(clinicId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_oncall_master', { p_clinic_id: clinicId, p_enabled: true }),
    'set_oncall_master', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Disable on-call (GATE 2). */
export async function disableOncall(clinicId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_oncall_master', { p_clinic_id: clinicId, p_enabled: false }),
    'set_oncall_master', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Enable the outside→cluster one-way message channel (GATE 2). Flag-only. */
export async function enableOutsideMessaging(clinicId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_outside_message_enabled', { p_clinic_id: clinicId, p_enabled: true }),
    'set_outside_message_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Disable the outside→cluster message channel. Leaves the inbound key in place. */
export async function disableOutsideMessaging(clinicId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_outside_message_enabled', { p_clinic_id: clinicId, p_enabled: false }),
    'set_outside_message_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Enable the outside event-request (scheduling intake) channel (GATE 2). Flag-only.
 *  Separate from the credential's existence so a cluster can keep calls/messages live
 *  while closing event intake. */
export async function enableIntake(clinicId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_intake_enabled', { p_clinic_id: clinicId, p_enabled: true }),
    'set_intake_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Disable the outside event-request channel. */
export async function disableIntake(clinicId: string): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_intake_enabled', { p_clinic_id: clinicId, p_enabled: false }),
    'set_intake_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}
