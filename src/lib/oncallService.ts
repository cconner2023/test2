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

/**
 * Whether `userId` is currently on-call in ANY of the given clinics
 * (clinics.oncall — public SELECT). Used as the HARD runtime override for the
 * per-user call silence: on-call always rings regardless of profiles.allow_calls.
 * A fresh read (never cached) so a teammate flipping your presence takes effect
 * immediately. Returns false on any error — fail toward respecting the silence.
 *
 * The roster (clinics.oncall) is NOT cleared when a supervisor turns the cluster's
 * "Allow calls" master off, so a bare roster read reports the last on-call member
 * indefinitely. Being on-call only means something while the call channel is open,
 * so we additionally require the cluster's GATE-2 `oncall_enabled` master (on the
 * credential, read via the membership-gated status RPC) — otherwise on-call pings
 * nothing and must not override the personal silence.
 */
export async function fetchSelfOnCall(clinicIds: string[], userId: string): Promise<boolean> {
  const ids = clinicIds.filter(Boolean)
  if (ids.length === 0 || !userId) return false
  const { data, error } = await supabase.from('clinics').select('id, oncall').in('id', ids)
  if (error || !data) return false
  const rosteredIn = (data as { id: string; oncall?: string[] | null }[])
    .filter((row) => (row.oncall ?? []).includes(userId))
    .map((row) => row.id)
  if (rosteredIn.length === 0) return false
  const statuses = await Promise.all(rosteredIn.map((id) => getOutsideContactStatus(id)))
  return statuses.some((s) => s.ok && s.data.oncall_enabled)
}

// ─── GATE 3: presence (any cluster member toggles self or teammate) ───
//
// Presence is stored ONCE per cluster (clinics.oncall) but is always READ through a
// line: the push fan intersects the roster with the line's scope before ringing, so
// "who is on-call" has no cluster-wide answer worth showing. Both readers below
// return that intersection and are membership-gated, not supervisor-gated — the
// toggle is mutual, and the line's passcode never rides along.

export interface LineOncallRoster {
  /** The line's clinic — presence writes are clinic-keyed, and a supervisor may be
   *  looking at a surrogate cluster rather than their own. */
  clinicId: string
  /** Everyone this line addresses (its scope, HQ excluded — on-call never auto-adds HQ). */
  memberIds: string[]
  /** Those of them currently on duty. */
  oncallIds: string[]
}

export async function getLineOncallRoster(credentialId: string): Promise<Result<LineOncallRoster>> {
  const res = await callRpc<{ clinic_id?: string; member_ids?: string[]; oncall_ids?: string[] } | null>(
    () => supabase.rpc('get_line_oncall_roster', { p_cred_id: credentialId }),
    'get_line_oncall_roster', logger,
  )
  if (!res.ok) return res
  return {
    ok: true,
    data: {
      clinicId: res.data?.clinic_id ?? '',
      memberIds: res.data?.member_ids ?? [],
      oncallIds: res.data?.oncall_ids ?? [],
    },
  }
}

export interface LineOncallSummary {
  id: string
  name: string
  oncallEnabled: boolean
  messageEnabled: boolean
  memberCount: number
  oncallCount: number
}

/** Every line in the cluster with its duty counts — the member-facing view of the
 *  supervisor's line list, carrying names and counts but no credential material. */
export async function listLineOncallRosters(clinicId: string): Promise<Result<LineOncallSummary[]>> {
  const res = await callRpc<Record<string, unknown>[] | null>(
    () => supabase.rpc('list_line_oncall_rosters', { p_clinic_id: clinicId }),
    'list_line_oncall_rosters', logger,
  )
  if (!res.ok) return res
  const rows = Array.isArray(res.data) ? res.data : []
  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? 'Main',
      oncallEnabled: r.oncall_enabled === true,
      messageEnabled: r.outside_message_enabled === true,
      memberCount: Number(r.member_count ?? 0),
      oncallCount: Number(r.oncall_count ?? 0),
    })),
  }
}

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

// ─── GATE 2: supervisor channel toggles, PER LINE (flag-only; no key lifecycle) ───
//
// A cluster runs several intake lines and each one opens its channels
// independently — the SD phone can take calls while the front-desk line only takes
// event requests. All four take a credential (line) id, never a clinic id.

/** Allow outside callers to ring this line's on-call scope. Flips the master flag —
 *  there is no inbound key to provision; outside calls/voicemail are E2E via the
 *  edge-authored envelope. */
export async function setLineOncallEnabled(credentialId: string, on: boolean): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_line_oncall_enabled', { p_cred_id: credentialId, p_enabled: on }),
    'set_line_oncall_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Allow the outside→cluster one-way message channel on this line. */
export async function setLineMessageEnabled(credentialId: string, on: boolean): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_line_message_enabled', { p_cred_id: credentialId, p_enabled: on }),
    'set_line_message_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Allow OUTBOUND outside-contact — any clinic member emails a secure 1:1 invite to
 *  an outside recipient (reverse of the inbound channels). Outbound is medic-initiated
 *  and not line-routed, so ANY line permitting it opens the gate for the cluster. */
export async function setLineOutboundEnabled(credentialId: string, on: boolean): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_line_outbound_enabled', { p_cred_id: credentialId, p_enabled: on }),
    'set_line_outbound_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}

/** Allow the outside event-request (scheduling intake) channel on this line. Separate
 *  from the line's existence so a cluster can keep calls/messages live while closing
 *  event intake. Intake is supervisor-scoped: it reaches the line's supervisors plus
 *  HQ, which never has none. */
export async function setLineIntakeEnabled(credentialId: string, on: boolean): Promise<Result<true>> {
  const res = await callRpc(
    () => supabase.rpc('set_line_intake_enabled', { p_cred_id: credentialId, p_enabled: on }),
    'set_line_intake_enabled', logger,
  )
  if (!res.ok) return res
  return { ok: true, data: true }
}
